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

		m = new form.Map('controlplus', _('Control Plus - Time Limit'),
			_('<b><font color="green">Use nftables to control data packet filtering to prohibit users who meet the set conditions from connecting to the Internet.</font></b><br/>' +
			  'Time Limit: Restrict whether a specified MAC address machine can access the Internet.<br/>' +
			  'Leaving MAC blank means restricting all machines. Weekdays are represented by 1-7. For multiple days, use custom: 1,5 for Monday and Friday.'));

		s = m.section(form.NamedSection, 'basic', 'basic', _(''));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Current Status'));
		o.cfgvalue = function() { return statusEl; };

		o = s.option(form.Flag, 'time_enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'control_mode', _('Control Strength'),
			_('Normal: Disconnect.<br/>Strict: Disconnect, and cannot connect to the router backend!'));
		o.value('0', _('Normal Control'));
		o.value('1', _('Strict Control'));
		o.default = '0';

		s = m.section(form.GridSection, 'time', _('Time Limit List'));
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

		// 支持 HH:MM 或 HH:MM:SS
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
			return fs.stat('/tmp/controlplus.time.running').then(function() {
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

		return m.render();
	}
});