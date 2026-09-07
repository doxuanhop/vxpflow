<div align="center">

<img src="public/app-icon.png" width="96" alt="VXPFlow" />

# VXPFlow

**All-in-one drag & drop studio for building Nokia S30+ (MediaTek MRE) apps — with Lua blocks, live emulator and a real .vxp compiler.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)](#)
[![Lua](https://img.shields.io/badge/Lua-5.1-00007f.svg)](#)
[![Made with AI](https://img.shields.io/badge/built%20with-AI%20assistance-8b5cf6.svg)](#-credits)

**README**: [English](README.md) · [Tiếng Việt](docs/README.vi.md) · [中文](docs/README.zh.md) · [日本語](docs/README.ja.md)

</div>

---

## ✨ What is VXPFlow?

VXPFlow is a complete IDE for the **Nokia S30+ / MediaTek MRE (.vxp)** platform, in the spirit of MIT App Inventor and Kodular — redesigned as an all-in-one Windows installer with **zero external dependencies**:

- 🧩 **Blocks programming** — snap event/logic/math/canvas blocks together (App-Inventor style: Initialize, Procedures, Notifier, any-key…). Right-click menus: duplicate, comment, collapse, disable, backpack, download PNG, **compare with generated Lua**.
- 🎨 **Visual Designer** — 240×320 QVGA canvas with real component palette (buttons, labels, canvas, timers, keypad…), S30+ color palette, grid snapping, multi-screen support.
- ▶️ **Live Testing** — a real Lua 5.1 VM (fengari) runs your blocks instantly in the built-in phone emulator with a working keypad (D-pad + T9), no build step needed.
- 📦 **True .vxp compiler** — one click compiles Lua → bytecode (`luac` ARM) → embeds it into a genuine **.vxp** package via `PackApp`, ready for MREmu or a real phone.
- 🌍 **13 languages UI** — English, Tiếng Việt, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português, ไทย, Bahasa Indonesia, हिन्दी.
- 🈳 **Full environment bundled** — the installer ships the complete MRE toolchain (~174 MB): `luac`, `PackApp`, **GCC ARM cross-compiler**, MRE SDK, emulator files. Install once, build forever. The terminal runs **hidden** — everything is driven from the GUI.

## 🚀 Quick start

1. Download **`VXPFlow_x64-setup.exe`** from [Releases](https://github.com/doxuanhop/vxpflow/releases) and install.
2. On first launch, VXPFlow sets up the bundled development environment (one-time dialog).
3. Click **Load sample projects** and open *Snake Classic S30+*, *Space Retro Shooter*, *S30+ Retro Calculator* or the asset-powered *Space Runner 2D*.
4. Press **Live Testing** → use the on-screen keypad.
5. Press **Build .VXP** → your `build/<project>.vxp` is ready. Run it with MREmu or copy to the phone's memory card.

### From source (developers)

```bash
git clone https://github.com/doxuanhop/vxpflow.git
cd vxpflow
npm install
npm run dev          # studio at http://localhost:3000
npm run desktop:dev  # Tauri desktop shell (needed for .vxp build)
npm run tauri build  # produce the one-file NSIS installer
```

Requirements: Node 18+, Rust toolchain (for Tauri), Windows x64.

## 🗂️ Project structure

```
├─ src/                    # Studio (React + TypeScript + Zustand)
│  ├─ components/          #   Designer, Blocks, Emulator, Settings, Modals…
│  ├─ data/                #   Block definitions, component palette, 4 sample games
│  └─ utils/               #   Lua code generator, fengari runtime, i18n…
├─ src-tauri/              # Desktop shell (Rust) — .vxp build pipeline, workspace IO
├─ mre-tool/               # ⛓ Bundled MRE toolchain (luac, PackApp, GCC ARM, SDK)
├─ mre/                    # LuaEngine runtime template (Lua C core → .axf)
└─ workspace/              # Your projects: /workspace/<slug>/{assets,src,build}
```

## 🧠 How the compiler works

```
Design + Blocks ──▶ Lua source ──▶ luac (5.1, ARM) ──▶ main.lub
                                                       │
LuaEngine.axf (runtime) ──┐                            ▼
                          ├──── PackApp ─────▶  <project>.vxp
resource.bin (script)  ───┘      (name-table + id-table, embedded)
```

The generated `.vxp` carries the script inside its resource section — no external files needed. Verified end-to-end on **MREmu**.

## ⌨️ Sample game: Space Runner 2D

Bundled with real sprites, this sample demonstrates: **Initialize blocks**, KeyInit (S30+/Nokia 225 keypad), clock-driven animation, any-key events, score HUD — build it and run on MREmu in one minute.

## 🌐 Extension system (.mvxp)

Import community extensions (a Lua file + JSON manifest) via **Blocks → Manage extensions** — or pull the latest from **Settings → Load extensions**. Each extension registers new blocks and library code injected into the compiled app.

## 🛠️ Settings & updates

The **gear icon** on the Hub opens *Settings & Environment*:

- **Check for updates** — compares against the release manifest.
- **Load libraries** — verifies every bundled toolchain component.
- **Load extensions** — fetches the latest community extension index.

## 🤝 Contributing

Contributions welcome! Block definitions live in `src/data/blockDefinitions.ts` (one object per block), component palette in `src/components/Designer/DesignerWorkspace.tsx`. UI strings are plain keys in `src/i18n.tsx` — adding a language = adding one dictionary.

## 📄 License

MIT © 2026 [doxuanhop](https://github.com/doxuanhop) — see [LICENSE](LICENSE).

## 🙏 Credits

Built with: **Lua 5.1 + fengari** (browser VM) · **MediaTek MRE SDK** · **luac / PackApp** (TinyMRESDK) · **React + Tauri + Zustand + TailwindCSS** · **lucide-react icons**.

This project was developed with the assistance of AI, under the direction and design of the project lead.

<div align="center">

**🌐 [qeafivels.com](http://qeafivels.com/) · ✉️ dohop96@gmail.com**

</div>
