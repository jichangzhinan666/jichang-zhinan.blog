---
title: "Clash Verge Rev 安装和订阅导入教程：下载、导入订阅、选节点、系统代理与 TUN"
description: "面向新手的 Clash Verge Rev 图文步骤：从 GitHub Releases 下载对应系统的安装包，导入机场订阅链接，选择节点与规则模式，开启系统代理或 TUN 模式，以及导入失败、WebView2 缺失等常见问题的排查。同时说明哪些机场根本不提供订阅链接。"
category: tutorials
primaryKeyword: "Clash Verge Rev 教程"
tags: ["Clash Verge Rev", "Clash", "订阅导入", "Windows", "macOS", "Linux", "新手教程"]
author: "机场阿南"
publishedAt: "2026-11-10"
updatedAt: "2026-11-10"
status: published
featured: true
order: 3
relatedBrands: ["dalaoyun", "flycat", "lingdongyun"]
references:
  - label: "Clash Verge Rev 项目主页与 Releases（GitHub：clash-verge-rev/clash-verge-rev）"
    url: "https://github.com/clash-verge-rev/clash-verge-rev/releases"
  - label: "Mihomo（Clash Meta 内核）配置文档"
    url: "https://wiki.metacubex.one/"
faq:
  - q: "Clash Verge Rev 和 Clash for Windows 是什么关系？"
    a: "Clash for Windows 已于 2023 年停止维护。Clash Verge Rev 是另一个开源项目，界面使用 Tauri 构建，内核为 Mihomo（Clash Meta），支持 Windows、macOS、Linux，是目前常见的桌面替代之一。两者都使用 Clash 格式的订阅。"
  - q: "导入订阅时提示失败怎么办？"
    a: "先确认复制的是完整 URL（没有多余空格、没有被聊天软件截断）；再确认当前网络能访问订阅服务器，部分机场的订阅地址本身需要先开启代理；最后检查订阅是否过期或流量用尽。仍失败时联系机场客服确认订阅链接格式是否为 Clash 兼容。"
  - q: "我买的机场没有订阅链接，能用 Clash Verge Rev 吗？"
    a: "不能。本站收录的品牌中，飞V、微风网络不发放订阅链接，浪网暂不支持订阅，暮光加速不推荐导入第三方客户端，这些品牌需要使用官方客户端。灵动云需向客服申请订阅链接，隐形人支持导入兼容客户端但需通过客服确认，大佬云与飞猫云资料写明可导入 Clash。"
---

Clash Verge Rev 是目前桌面端最常见的开源代理客户端之一，内核为 Mihomo（Clash Meta），支持 Windows、macOS 与 Linux。这篇教程只讲“从零到能用”的最短路径，并在每一步标出新手最容易出错的地方。软件界面随版本变化，菜单名称以你安装的版本为准；下载地址以项目 GitHub Releases 页面为准。

## 开始之前：确认你的机场提供订阅链接

Clash 系客户端需要一条**订阅链接**（Subscription URL）来获取节点。不是所有机场都提供：

- 本站收录的品牌中，[大佬云](/reviews/dalaoyun/)、[飞猫云](/reviews/flycat/)的资料写明可导入 Clash；[灵动云](/reviews/lingdongyun/)需向客服申请订阅链接。
- [飞V](/reviews/flyv/)、[微风网络](/reviews/breezenet/)不发放订阅链接，[浪网](/reviews/langwang/)暂不支持订阅，[暮光加速](/reviews/twilight/)不推荐导入第三方客户端——这些品牌请直接使用官方客户端。[隐形人](/reviews/invisible/)支持导入兼容的第三方客户端，但请先通过客服确认。

订阅链接等同于账号凭据。不要发到群里、不要粘贴进来历不明的“订阅转换”网站，原因见[隐私政策](/privacy/#tools)。

## 第一步：下载与安装

1. 打开项目的 GitHub Releases 页面（见文末参考链接），只从这里下载。网盘、QQ 群分发的安装包无法确认是否被篡改。
2. 按系统选择安装包：
   - **Windows**：通常提供 x64 与 arm64 的安装程序（`.exe`），以及便携版。若你的系统没有 Microsoft Edge WebView2 运行时，安装或启动时会提示；按提示安装 WebView2 或选择带“fixed webview2”字样的版本。
   - **macOS**：按芯片选择 Apple Silicon（aarch64）或 Intel（x64）的 `.dmg`。首次打开若提示“无法验证开发者”，在“系统设置 → 隐私与安全性”中允许。
   - **Linux**：提供 `.deb`、`.rpm` 或 AppImage，按发行版选择。
3. 安装完成后首次启动，界面默认可能是英文，在设置中可切换为中文。

## 第二步：导入订阅

1. 在机场后台复制订阅链接（通常在“我的订阅”“一键导入”附近，选择 Clash 格式）。
2. 打开 Clash Verge Rev → 左侧“订阅”（Profiles）页面 → 顶部输入框粘贴链接 → 点击“导入”。
3. 导入成功后会出现一张订阅卡片，显示流量用量与到期时间（取决于机场是否提供这些信息）。点击卡片使其处于选中状态。
4. 建议在卡片菜单中设置“自动更新”间隔（例如 24 小时），机场更换节点时能自动同步。

**常见失败原因**：链接复制不完整；当前网络无法访问订阅服务器（部分订阅地址需要先连上代理才能访问）；订阅已过期或流量用尽；机场提供的不是 Clash 格式。

## 第三步：选择节点与模式

1. 左侧“代理”（Proxies）页面会列出订阅中的策略组与节点。常见策略组有“自动选择”（按延迟自动切换）、“手动选择”，以及按地区分组。
2. 点击策略组右上角的闪电图标可以测延迟。注意：这里测的是**到节点的握手延迟**，不是带宽；延迟低不代表速度快，原因见[机场节点低延迟却速度慢的原因](/wiki/jiedian-di-yanchi-que-sudu-man/)。
3. 页面顶部有三种模式：
   - **规则**（Rule）：按订阅内置规则分流，国内直连、国外走代理。日常推荐。
   - **全局**（Global）：所有流量走代理。只在排查问题时临时使用。
   - **直连**（Direct）：全部不走代理。
   三者的区别与误区见[TUN 模式与全局代理（系统代理）区别](/wiki/tun-moshi-yu-quanju-daili/)。

## 第四步：开启系统代理或 TUN 模式

进入左侧“设置”（Settings）：

- **系统代理**：打开后，浏览器等遵守系统代理设置的程序会走代理。这是最简单、兼容性最好的方式，适合大多数人。
- **TUN 模式**：创建虚拟网卡接管全部流量，游戏、命令行工具等不走系统代理的程序也能生效。Windows 上需要先“安装服务”（服务模式），macOS 需要授权。开启 TUN 时通常不需要再开系统代理。

两者一般二选一。开启后访问一个显示出口 IP 的页面确认已经生效（例如 IPCheck.ing 等 IP 检测站点，只看 IP，不要上传任何订阅信息）。

## 第五步：验证

1. 打开一个海外网站确认能访问，再打开一个国内网站确认走直连（规则模式下国内网站速度应与平时一致）。
2. 左侧“连接”（Connections）页面能看到每条连接走的是哪个节点、命中了哪条规则，排查“为什么这个网站打不开”时最有用。
3. 想量化速度，请按[节点测速方法](/tutorials/jiedian-cesu-fangfa-ipcheck-speedtest/)记录，并在 20:00–23:00 复测。

## 常见问题速查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 启动提示缺少 WebView2 | Windows 未安装 WebView2 运行时 | 安装运行时，或下载带 fixed webview2 的版本 |
| 导入订阅失败 | 链接不完整 / 需先连代理 / 已过期 | 重新复制；先用其他方式连上代理再导入；查后台状态 |
| 系统代理开了但某些软件不走 | 该软件不遵守系统代理 | 改用 TUN 模式 |
| TUN 开不起来 | 未安装服务 / 无管理员权限 | 设置页“安装服务”，以管理员身份运行 |
| 国内网站变慢或提示异地登录 | 误用全局模式 | 切回规则模式 |
| 所有节点超时 | 订阅过期、节点维护或本地网络问题 | 查机场后台公告；换网络测试 |

更多系统级问题见[iOS、Android 和 Windows 常见客户端问题](/tutorials/windows-kehuduan-changjian-wenti/)。

## 安全提醒

- 只从 GitHub Releases 或项目官网下载客户端；只从机场官网后台获取订阅。
- 不要把订阅链接提交到任何第三方网页工具。
- 本文为通用软件教程，不代表本站对任何机场的评价；品牌政策以[品牌资料库](/reviews/)中的核实日期为准。
