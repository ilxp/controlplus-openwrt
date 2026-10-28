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
		return Promise.all([uci.load('controlplus'), callHostHints()]);
	},

	render: function(data) {
		var hosts = data[1];
		var m, s, o;
		var statusEl = E('span', { 'style': 'color:orange;font-weight:bold;' }, _('Checking...'));

		m = new form.Map('controlplus', _('Control Plus - MAC Access'),
			_('<b><font color="green">MAC Black/White List: Low-level network access control.</font></b><br/>' +
			  '<span style="color:red;">Note: In whitelist mode, devices not in the list will be completely unable to access the Internet.</span>'));

		s = m.section(form.NamedSection, 'basic', 'basic', _(''));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Current Status'));
		o.cfgvalue = function() { return statusEl; };

		o = s.option(form.Flag, 'maclist_enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'maclist_mode', _('Access Mode'),
			_('Blacklist: Devices in the list are prohibited from accessing the Internet.<br/>Whitelist: Only devices in the list are allowed to access the Internet, all others are blocked!'));
		o.value('black', _('Blacklist Mode (Deny Access)'));
		o.value('white', _('Whitelist Mode (Allow Access)'));
		o.default = 'black';
		o.rmempty = false;

		s = m.section(form.GridSection, 'maclist', _('Device List'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'remarks', _('Remarks'));

		o = s.option(form.Flag, 'enable', _('Active'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'mac', _('MAC Address'));
		o.datatype = "macaddr";
		o.rmempty = false;
		if (hosts) {
			Object.keys(hosts).forEach(function(mac) {
				var host = hosts[mac];
				var name = host.name || (host.ipaddrs && host.ipaddrs[0]) || '';
				o.value(mac, mac + (name ? ' (' + name + ')' : ''));
			});
		}

		var checkStatus = function() {
			return fs.stat('/tmp/controlplus.maclist.running').then(function() {
				statusEl.style.color = 'green'; statusEl.innerHTML = _('RUNNING');
			}).catch(function() {
				statusEl.style.color = 'red'; statusEl.innerHTML = _('NOT RUNNING');
			});
		};
		poll.add(checkStatus, 2); checkStatus();

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