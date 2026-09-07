<div align="center">

<img src="../public/app-icon.png" width="96" alt="VXPFlow" />

# VXPFlow

**一站式拖拽式开发工作室 — 为 Nokia S30+（MediaTek MRE）构建应用：Lua 积木编程、内置模拟器与真正的 .vxp 编译器。**

[English](../README.md) · **中文**

</div>

---

## ✨ VXPFlow 是什么？

VXPFlow 是面向 **Nokia S30+ / MediaTek MRE（.vxp）** 平台的完整 IDE，秉承 MIT App Inventor / Kodular 的理念，重新设计为一站式 Windows 安装包，**无需任何外部依赖**：

- 🧩 **积木编程** — 拼接事件/逻辑/数学/画布积木（Initialize、过程、Notifier、任意键…）。右键菜单：复制、注释、折叠、禁用、书包、下载 PNG、**与生成的 Lua 对照**、撤销/重做。
- 🎨 **可视化设计器** — 240×320 QVGA 画布、真实组件面板、S30+ 标准色板、网格吸附、多屏幕。
- ▶️ **实时测试** — 真正的 Lua 5.1 虚拟机（fengari）在带键盘（方向键 + T9）的手机模拟器中即时运行积木。
- 📦 **真正的 .vxp 编译器** — 一键：Lua → 字节码（`luac` ARM）→ 经 `PackApp` 嵌入真正的 **.vxp** 包，可在 MREmu 或真机运行。
- 🌍 **13 种界面语言** — 英语、越南语、中文、日语、韩语、西语、法语、德语、俄语、葡语、泰语、印尼语、印地语。
- 🈳 **完整环境内置** — 安装包附带完整 MRE 工具链（约 174 MB）：`luac`、`PackApp`、**GCC ARM**、MRE SDK、模拟器与签名工具。一次安装，永久构建。终端**隐藏运行**。

## 🚀 快速开始

1. 从 [Releases](https://github.com/doxuanhop/vxpflow/releases) 下载 **`VXPFlow_x64-setup.exe`** 并安装。
2. 首次启动时会自动配置内置开发环境（仅一次）。
3. 点击 **加载示例项目**，打开贪吃蛇、太空射击、计算器或带真实素材的 *Space Runner 2D*。
4. 按 **Live Testing** → 使用屏幕键盘。
5. 按 **Build .VXP** → 生成 `build/<项目>.vxp`。

### 从源码构建

```bash
git clone https://github.com/doxuanhop/vxpflow.git
cd vxpflow && npm install
npm run dev          # 工作室 http://localhost:3000
npm run desktop:dev  # Tauri 桌面壳（构建 .vxp 需要）
npm run tauri build  # 生成 NSIS 单文件安装包
```

## 📄 许可证

MIT © 2026 [doxuanhop](https://github.com/doxuanhop) — 见 [LICENSE](../LICENSE)。

本项目在项目负责人的指导与设计下，借助 AI 协助开发完成。

<div align="center">**🌐 [qeafivels.com](http://qeafivels.com/) · ✉️ dohop96@gmail.com**</div>
