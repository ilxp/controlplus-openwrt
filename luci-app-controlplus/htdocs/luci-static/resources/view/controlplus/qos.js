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

		m = new form.Map('controlplus', _('Control Plus - Network Limit'),
			_('<b><font color="green">Network Limit: Limit the bandwidth of specific devices based on MAC address.</font></b><br/>' +
			  '<span style="color:red;">Note: You must disable "Software/Hardware Flow Offloading" in the firewall settings, otherwise the speed limit will not work!</span>'));

		s = m.section(form.NamedSection, 'basic', 'basic', _(''));
		s.anonymous = true;
		o = s.option(form.DummyValue, '_status', _('Current Status'));
		o.cfgvalue = function() { return statusEl; };

		o = s.option(form.Flag, 'qos_enabled', _('Enable'));
		o.rmempty = false;

		s = m.section(form.GridSection, 'qos', _('Speed Limit List'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'remarks', _('Remarks'));

		o = s.option(form.Flag, 'enable', _('Enable'));
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

		o = s.option(form.Value, 'down', _('Download Limit (KB/s)'));
		o.placeholder = _('e.g., 1250 (approx. 10Mbps)');
		o.datatype = "uinteger";
		o.rmempty = true;

		o = s.option(form.Value, 'up', _('Upload Limit (KB/s)'));
		o.placeholder = _('e.g., 125');
		o.datatype = "uinteger";
		o.rmempty = true;

		var checkStatus = function() {
			return fs.stat('/tmp/controlplus.qos.running').then(function() {
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