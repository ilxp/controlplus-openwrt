# Control Plus (管控 Plus)

`Control Plus` 是一款专为 OpenWrt 打造的轻量级、多合一的网络行为与流量综合管控插件。采用纯 LuCI JS 前端与 Linux 底层核心工具（`nftables`、`tc`、`dnsmasq`）深度结合，旨在为家庭或企业局域网提供无死角的设备管理与网络控制。

## ✨ 核心功能

*   ⏰ **时间限制 (Time Control)**: 
    *   基于 MAC 地址限制设备联网时段。
    *   支持星期选择，支持跨天时间段（如 `22:00` 到次日 `06:00`，自动拆分并顺延星期）。
    *   支持强力管控模式（断网并禁止访问路由器后台）。
*   🚫 **协议过滤 (Protocol Filter)**: 
    *   精准控制指定设备是否可以使用 TCP / UDP / ICMP 协议。
    *   支持单端口、连续端口范围（如 `5000:5100`）以及混合多端口（如 `80,443,8000:8080`）的拦截。
*   🌐 **网址过滤 (Web URL Filter)**: 
    *   通过 DNS 层拦截，**完美封杀 HTTPS 网站**。
    *   支持完整域名与通配符（如 `*.xxx.com`）。
    *   **多设备隔离**：为不同 MAC 地址分配独立拦截集合，互不误杀。
    *   **IPv6 物理兜底**：彻底封死浏览器通过 IPv6 绕过拦截的漏洞。
*   🚦 **网络限速 (QoS Control)**: 
    *   基于 MAC 地址精确限制下载与上传带宽。
    *   底层使用 `tc + htb + fq_codel` 算法，限速的同时保证网络延迟（Ping）平稳不卡顿。
*   🛡️ **设备准入 (MAC Access)**: 
    *   MAC 黑白名单底层控制。
    *   白名单模式防蹭网，且完美放行局域网内网互访（如投屏、NAS 共享）。
*   💻 **网络唤醒 (Wake on LAN)**: 
    *   内置 WOL 功能，支持在界面上直接一键唤醒局域网内支持的设备。

## 📦 依赖要求

本插件依赖以下 OpenWrt 核心组件及内核模块，请在编译或安装时确保已选中：

```text
+luci-base
+nftables
+dnsmasq-full (必须为 full 版本)
+tc
+kmod-sched-core
+kmod-sched-flower
+kmod-ifb
+etherwake
```

## 🚀 安装说明

1. 将源码放入 OpenWrt 源码目录的 `package/luci-app-controlplus` 下。
2. 执行 `make menuconfig`，选中 `LuCI -> Applications -> luci-app-controlplus`。
3. 编译并刷入固件，或者单独编译出 `ipk` 安装包。

在路由器上直接测试时，请确保赋予脚本执行权限：
```bash
chmod +x /etc/init.d/controlplus
/etc/init.d/controlplus enable
/etc/init.d/controlplus start
```

## ⚠️ 重要注意事项

为了让本插件的各项功能完美生效，您必须注意以下几点：

1. **网址过滤与代理冲突**：如果路由器上开启了 OpenClash、PassWall 等代理插件，它们会劫持 DNS 或流量，导致网址过滤失效。请将受管控设备的流量在代理插件中设置为“直连”。
2. **客户端 DNS 设置**：网址过滤依赖路由器的 `dnsmasq` 进行解析。客户端设备**不可**手动指定公共 DNS（如 `8.8.8.8`），也不可开启浏览器的“安全 DNS (DoH)”。
3. **QoS 限速与硬件加速**：`tc` 限速规则与 OpenWrt 的“软件/硬件流量分载 (Flow Offloading)”冲突。**使用网络限速功能前，必须在防火墙设置中关闭流量分载**，否则限速无效。

## 🛠️ 技术架构与原理

*   **前端**：纯 LuCI JS 重写，原生支持 RPC 动态获取设备列表，支持中英双语。
*   **时间与协议**：使用 `nftables` 的 `meta hour` 和 `meta day` 原生语法匹配，实现高精度的时段与协议管控。
*   **网址过滤**：采用 **DNS 黑洞（Sinkhole）技术**，通过 `dnsmasq` 的 `address` 指令将目标域名直接解析劫持至无效地址（IPv4 `0.0.0.0` / IPv6 `::`）。彻底抛弃了容易漏包的 `nftset` 方案，无视 CDN 套娃与 QUIC 协议，从应用层根源瞬间阻断连接，且不占用防火墙性能。
*   **网络限速**：使用 Linux 原生的 `tc qdisc` 配合 `ifb10` 独立虚拟网卡处理上下行流量。采用 `pfifo` 极短队列暴力丢包机制压制 Bufferbloat（缓冲膨胀），在精准限速的同时确保极低的网络延迟，且绝不干扰其他 QoS 插件。

## 📄 开源协议

本项目基于 MIT License 开源。欢迎提交 Issue 或 PR！