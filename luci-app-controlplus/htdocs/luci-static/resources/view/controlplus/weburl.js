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

		m = new form.Map('controlplus', _('Control Plus - Web URL Filter'),
			_('<b><font color="green">Web URL Filter: Intercept via DNS resolution, perfectly supporting HTTPS blocking.</font></b><br/>' +
			  '<span style="color:red;">Note: The device must use this router\'s DNS service for it to take effect.</span><br/>' +
			  'Supports full domain names (e.g., example.com) or wildcards (e.g., *.example.com). <b>Separate multiple domains with commas.</b> ' +
			  'Leaving MAC blank means restricting all machines.' +
			  '<br/><span style="color:orange;">⚠ IPv6 fallback: when a MAC is specified, all of its IPv6 80/443 traffic ' +
			  '(except LAN/link-local addresses) will be blocked as a safety net, even if the target domain is not in the list.</span>'));

		s = m.section(form.NamedSection, 'basic', 'basic', _(''));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Current Status'));
		o.cfgvalue = function() { return statusEl; };

		o = s.option(form.Flag, 'weburl_enabled', _('Enable'));
		o.rmempty = false;

		s = m.section(form.GridSection, 'weburl', _('Web URL Filter List'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'remarks', _('Remarks'));

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		// 留空=全局限制
		o = s.option(form.Value, 'mac', _('MAC Address <font color="green">(Leave blank to restrict all clients)</font>'));
		o.datatype = "macaddr";
		o.rmempty = true;
		if (hosts) {
			Object.keys(hosts).forEach(function(mac) {
				var host = hosts[mac];
				var name = host.name || (host.ipaddrs && host.ipaddrs[0]) || '';
				o.value(mac, mac + (name ? ' (' + name + ')' : ''));
			});
		}

		// 增加多域名支持提示
		o = s.option(form.Value, 'word', _('Domain/URL <font color="green">(Separate multiple domains with commas)</font>'));
		o.placeholder = "example.com, *.qq.com";
		o.rmempty = true;

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

		s = m.section(form.NamedSection, 'basic', 'basic', _('Advanced Settings - Local Black/White List'));
		s.anonymous = true;
		s.description = _('The whitelist has the highest priority and will not be intercepted. ' +
			'Enter one domain per line (supports wildcards like *.baidu.com), starting with # for comments. ' +
			'The global black/white list always takes effect regardless of the time fields above.');

		o = s.option(form.TextValue, '_blacklist', _('Global Blacklist (black.list)'));
		o.rows = 5;
		o.cfgvalue = function() {
			return fs.read('/etc/controlplus/black.list').catch(function() { return ''; });
		};
		o.write = function(section_id, value) {
			return fs.write('/etc/controlplus/black.list', value || '');
		};

		o = s.option(form.TextValue, '_whitelist', _('Global Whitelist (white.list)'));
		o.rows = 5;
		o.cfgvalue = function() {
			return fs.read('/etc/controlplus/white.list').catch(function() { return ''; });
		};
		o.write = function(section_id, value) {
			return fs.write('/etc/controlplus/white.list', value || '');
		};

		var checkStatus = function() {
			return fs.stat('/tmp/controlplus.weburl.running').then(function() {
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