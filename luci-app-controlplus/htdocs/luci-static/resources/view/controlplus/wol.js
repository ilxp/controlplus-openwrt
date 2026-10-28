'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require fs';
'require ui';
'require tools.widgets as widgets';

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
		var hosts = data[1] || {};
		var m, s, o;

		m = new form.Map('controlplus', _('Control Plus - Wake on LAN'),
			_('<b><font color="green">Wake on LAN (WOL): Send a magic packet to wake up a device.</font></b><br/>' +
			  'The device must be connected via Ethernet and have WOL enabled in BIOS/OS.'));

		s = m.section(form.GridSection, 'wol', _('WOL Device List'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;

		o = s.option(form.Value, 'remarks', _('Remarks'));

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

		o = s.option(widgets.DeviceSelect, 'interface', _('Interface'));
		o.default = 'br-lan';
		o.noaliases = true;
		o.noinactive = true;
		o.rmempty = false;

		var gridSection = s;
		s.renderRowActions = L.bind(function(section_id) {
			var defaultButtons = form.GridSection.prototype.renderRowActions.call(gridSection, section_id, _('Edit'));

			var awakeButton = E('button', {
				'class': 'cbi-button cbi-button-action important',
				'style': 'margin-right: 5px;',
				'click': ui.createHandlerFn(this, function() {
					return this.handleAwake(section_id);
				})
			}, _('Awake'));

			var buttonContainer = defaultButtons.querySelector('div');
			if (buttonContainer) {
				buttonContainer.insertBefore(awakeButton, buttonContainer.firstChild);
			}

			return defaultButtons;
		}, this);

		return m.render();
	},

	handleAwake: function(section_id) {
		var mac = uci.get('controlplus', section_id, 'mac');
		var iface = uci.get('controlplus', section_id, 'interface') || 'br-lan';

		if (!mac) {
			ui.addNotification(null, E('p', _('MAC address is empty!')), 'danger');
			return;
		}

		ui.showModal(_('Waking up...'), [E('p', { 'class': 'spinning' }, _('Sending magic packet...'))]);

		return fs.exec('/usr/bin/etherwake', ['-i', iface, mac]).then(function(res) {
			ui.hideModal();
			if (res.code === 0) {
				ui.addTimeLimitedNotification(null,
					E('p', {}, _('Magic packet sent successfully to ') + mac),
					3000, 'info'
				);
			} else {
				ui.showModal(_('Wake up failed'), [
					E('p', {}, res.stderr || res.stdout || 'Unknown error'),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Close'))
					])
				]);
			}
		}).catch(function(err) {
			ui.hideModal();
			ui.showModal(_('Wake up failed'), [
				E('p', {}, String(err)),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Close'))
				])
			]);
		});
	}
});