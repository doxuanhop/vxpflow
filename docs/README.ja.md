<div align="center">

<img src="../public/app-icon.png" width="96" alt="VXPFlow" />

# VXPFlow

**Nokia S30+（MediaTek MRE）アプリ開発のためのオールインワン・ドラッグ＆ドロップ・スタジオ — Lua ブロック、ライブエミュレータ、本物の .vxp コンパイラ。**

[English](../README.md) · **日本語**

</div>

---

## ✨ VXPFlow とは？

**Nokia S30+ / MediaTek MRE（.vxp）** 向けの完全な IDE です。MIT App Inventor / Kodular の精神を受け継ぎ、**外部依存ゼロ**のオールインワン Windows インストーラーとして再設計しました：

- 🧩 **ブロックプログラミング** — イベント/ロジック/数学/キャンバスブロックを接続。右クリックメニュー：複製、コメント、折りたたみ、無効化、バックパック、PNG 出力、**生成 Lua との比較**、元に戻す/やり直し。
- 🎨 **ビジュアルデザイナー** — 240×320 QVGA キャンバス、S30+ 標準カラーパレット、グリッドスナップ、マルチスクリーン。
- ▶️ **ライブテスト** — 本物の Lua 5.1 VM（fengari）が内蔵の電話エミュレータ（D-pad + T9 キー付き）でブロックを即実行。
- 📦 **本物の .vxp コンパイラ** — ワンクリックで Lua → バイトコード（`luac` ARM）→ `PackApp` による本物の **.vxp** パッケージへ。MREmu や実機で動作。
- 🌍 **13 言語 UI** — 英語・ベトナム語・中国語・日本語・韓国語ほか。
- 🈳 **完全環境同梱** — インストーラーに MRE ツールチェーン全体（約 174 MB：`luac`、`PackApp`、**GCC ARM**、MRE SDK、エミュレータ）を同梱。ターミナルは**非表示**で動作します。

## 🚀 クイックスタート

1. [Releases](https://github.com/doxuanhop/vxpflow/releases) から **`VXPFlow_x64-setup.exe`** をダウンロードしてインストール。
2. 初回起動時に内蔵開発環境が自動セットアップされます（一度だけ）。
3. **サンプルプロジェクトを読み込む** をクリックして開く。
4. **Live Testing** → 画面キーで操作。
5. **Build .VXP** → `build/<プロジェクト>.vxp` が完成。

## 📄 ライセンス

MIT © 2026 [doxuanhop](https://github.com/doxuanhop) — [LICENSE](../LICENSE) 参照。

本プロジェクトはプロジェクト責任者の指揮・設計のもと、AI の支援を受けて開発されました。

<div align="center">**🌐 [qeafivels.com](http://qeafivels.com/) · ✉️ dohop96@gmail.com**</div>
