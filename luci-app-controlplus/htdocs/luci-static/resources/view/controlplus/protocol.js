'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require fs';
'require poll';
'require ui';

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('controlplus'),
			callHostHints()
		]);
	},

	render: function(data) {
		var hosts = data[1];
		var m, s, o;

		var statusEl = E('span', { 'style': 'color:orange;font-weight:bold;' }, _('Checking...'));

		m = new form.Map('controlplus', _('Control Plus - Protocol Filter'),
			_('<b><font color="green">Protocol Filter: Control whether a specified MAC machine can use specific protocol ports.</font></b><br/>' +
			  'Ports can be a continuous range separated by a colon, e.g., 5000:5100, or multiple ports separated by commas, e.g., 5100,5110,5001:5002'));

		s = m.section(form.NamedSection, 'basic', 'basic', _(''));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Current Status'));
		o.cfgvalue = function() { return statusEl; };

		o = s.option(form.Flag, 'proto_enabled', _('Enable'));
		o.rmempty = false;

		s = m.section(form.GridSection, 'protocol', _('Protocol Filter List'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'remarks', _('Remarks'));

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'mac', _('MAC Address <font color="green">(Leave blank for all clients)</font>'));
		o.datatype = "macaddr";
		o.rmempty = true;
		if (hosts) {
			Object.keys(hosts).forEach(function(mac) {
				var host = hosts[mac];
				var name = host.name || (host.ipaddrs && host.ipaddrs[0]) || '';
				o.value(mac, mac + (name ? ' (' + name + ')' : ''));
			});
		}

		o = s.option(form.ListValue, 'proto', _('Port Protocol'));
		o.value('tcp', _('TCP'));
		o.value('udp', _('UDP'));
		o.value('both', _('TCP + UDP (Both)'));
		o.value('icmp', _('ICMP'));
		o.default = 'tcp';
		o.rmempty = false;

		var port_validate = function(section_id, value) {
			if (!value) return true;
			return /^[0-9\-:,]+$/.test(value) ? true : _('Invalid port format. Only numbers, colons, and commas are allowed (no spaces)');
		};

		o = s.option(form.Value, 'ports', _('Source Port'));
		o.placeholder = _('e.g., 1024,5000:5100 (blank = any)');
		o.rmempty = true;
		o.validate = port_validate;

		o = s.option(form.Value, 'portd', _('Destination Port'));
		o.placeholder = _('e.g., 80,443,5000:5100');
		// 使用 span 包裹长注释，以便在表格中隐藏
		o.description = _('<span class="hide-in-table"><b>Common ports:</b> 80=HTTP, 443=HTTPS, 22=SSH, 23=Telnet, 3389=RDP, 21=FTP, 25=SMTP, 110=POP3, 143=IMAP, 445=SMB, 53=DNS (TCP/UDP), 853=Encrypted DNS, 1723=PPTP, 20=UDP-FTP, 69=UDP-TFTP, 161=UDP-SNMP, 500=UDP-IPSEC, 1701=UDP-L2TP.</span>');
		o.rmempty = true;
		o.validate = port_validate;

		var validate_time = function(section_id, value) {
			if (!value) return true;
			return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value) ? true : _('Time format must be HH:MM or HH:MM:SS');
		};

		o = s.option(form.Value, 'timestart', _('Start Time'));
		o.placeholder = '00:00';
		o.default = '00:00';
		o.rmempty = true;
		o.validate = validate_time;

		o = s.option(form.Value, 'timeend', _('End Time'));
		o.placeholder = '00:00';
		o.default = '00:00';
		o.rmempty = true;
		o.validate = validate_time;

		o = s.option(form.ListValue, 'week', _('Week Day'));
		o.value('*', _('Every Day'));
		o.value('1', _('Monday'));
		o.value('2', _('Tuesday'));
		o.value('3', _('Wednesday'));
		o.value('4', _('Thursday'));
		o.value('5', _('Friday'));
		o.value('6', _('Saturday'));
		o.value('7', _('Sunday'));
		o.default = '*';
		o.rmempty = false;

		var checkStatus = function() {
			return fs.stat('/tmp/controlplus.proto.running').then(function() {
				statusEl.style.color = 'green';
				statusEl.innerHTML = _('RUNNING');
			}).catch(function() {
				statusEl.style.color = 'red';
				statusEl.innerHTML = _('NOT RUNNING');
			});
		};

		poll.add(checkStatus, 2);
		checkStatus();

		// 保存后立即重启服务
		var origSaveApply = m.saveApply;
		m.saveApply = L.bind(function() {
			return origSaveApply.call(this).then(L.bind(function(ret) {
				if (ret === false || ret === undefined || ret === null) return ret;
				return fs.exec('/etc/init.d/controlplus', ['restart']).then(function() { return ret; });
			}, this));
		}, m);

		// 注入 CSS，只在表格 (List) 中隐藏长注释，保留编辑弹窗中的显示
		document.head.appendChild(E('style', {}, '.cbi-section-table .hide-in-table { display: none !important; }'));

		return m.render();
	}
});