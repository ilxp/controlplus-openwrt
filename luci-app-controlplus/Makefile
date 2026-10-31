include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-controlplus
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Build/Compile
endef

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI Control Plus (管控 Plus)
  PKGARCH:=all
  DEPENDS:=+luci-base +nftables +dnsmasq-full +tc \
           +kmod-sched-core +kmod-sched-flower +kmod-ifb +etherwake
endef

define Package/$(PKG_NAME)/description
  Network Access Control (MAC, Time, Protocol, Web URL, QoS, WOL)
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/controlplus
/etc/controlplus/black.list
/etc/controlplus/white.list
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/controlplus $(1)/etc/init.d/controlplus
	chmod 0755 $(1)/etc/init.d/controlplus

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/controlplus $(1)/etc/config/controlplus

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/99-luci-app-controlplus $(1)/etc/uci-defaults/99-luci-app-controlplus
	chmod 0755 $(1)/etc/uci-defaults/99-luci-app-controlplus

	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) ./root/etc/hotplug.d/iface/99-controlplus $(1)/etc/hotplug.d/iface/99-controlplus
	chmod 0755 $(1)/etc/hotplug.d/iface/99-controlplus

	$(INSTALL_DIR) $(1)/etc/controlplus
	touch $(1)/etc/controlplus/black.list
	touch $(1)/etc/controlplus/white.list

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-controlplus.json $(1)/usr/share/luci/menu.d/luci-app-controlplus.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-controlplus.json $(1)/usr/share/rpcd/acl.d/luci-app-controlplus.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/controlplus
	$(CP) ./htdocs/luci-static/resources/view/controlplus/* $(1)/www/luci-static/resources/view/controlplus/
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
[ -f "/etc/init.d/controlplus" ] && /etc/init.d/controlplus stop
[ -f "/etc/init.d/controlplus" ] && /etc/init.d/controlplus disable
rm -rf /etc/config/controlplus
rm -rf /etc/controlplus
rm -f /tmp/controlplus*
rm -f /tmp/log/controlplus.log
rm -f /tmp/dnsmasq.d/controlplus.conf
rm -rf /tmp/controlplus_maclist.nft
/etc/init.d/dnsmasq restart 2>/dev/null
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

$(eval $(call BuildPackage,$(PKG_NAME)))

# call BuildPackage - OpenWrt buildroot signature