<div align="center">

<img src="../public/app-icon.png" width="96" alt="VXPFlow" />

# VXPFlow

**Studio kéo-thả tất cả-trong-một để tạo ứng dụng Nokia S30+ (MediaTek MRE) — lập trình khối Lua, giả lập trực tiếp và trình biên dịch .vxp thật.**

[English](../README.md) · **Tiếng Việt**

</div>

---

## ✨ VXPFlow là gì?

VXPFlow là IDE hoàn chỉnh cho nền tảng **Nokia S30+ / MediaTek MRE (.vxp)**, theo tinh thần MIT App Inventor / Kodular — thiết kế lại thành bộ cài Windows **tất cả-trong-một, không cần cài thêm gì**:

- 🧩 **Lập trình khối** — ghép khối sự kiện/logic/toán/canvas (kiểu App Inventor: Initialize, Thủ tục, Notifier, phím bất kỳ…). Chuột phải: nhân đôi, ghi chú, thu gọn, vô hiệu, ba lô, tải PNG, **đối chiếu mã Lua sinh ra**, Undo/Redo.
- 🎨 **Designer trực quan** — canvas QVGA 240×320, bảng thành phần thật (nút, nhãn, canvas, đồng hồ, bàn phím, KeyInit…), bảng màu chuẩn S30+, hút lưới, đa màn hình.
- ▶️ **Live Testing** — máy ảo Lua 5.1 thật (fengari) chạy khối ngay trong giả lập điện thoại có bàn phím D-pad + T9, không cần build.
- 📦 **Biên dịch .vxp thật** — một cú nhấp: Lua → bytecode (`luac` ARM) → nhúng vào gói **.vxp** thật bằng `PackApp`, chạy được trên MREmu hoặc máy thật.
- 🌍 **Giao diện 13 ngôn ngữ** — English, Tiếng Việt, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português, ไทย, Bahasa Indonesia, हिन्दी.
- 🈳 **Môi trường đóng gói trọn bộ** — installer kèm toàn bộ toolchain MRE (~174 MB): `luac`, `PackApp`, **GCC ARM**, MRE SDK, tệp giả lập. Cài một lần là build vĩnh viễn. Terminal chạy **ẩn** — mọi thao tác qua GUI.

## 🚀 Bắt đầu nhanh

1. Tải **`VXPFlow_x64-setup.exe`** tại [Releases](https://github.com/doxuanhop/vxpflow/releases) và cài đặt.
2. Lần đầu mở app, hộp thoại cài môi trường phát triển sẽ chạy (chỉ một lần).
3. Bấm **Tải dự án mẫu**, mở *Snake Classic S30+*, *Space Retro Shooter*, *S30+ Retro Calculator* hoặc *Space Runner 2D* (sprite thật).
4. Bấm **Live Testing** → dùng bàn phím trên màn hình.
5. Bấm **Build .VXP** → file `build/<dự_án>.vxp` sẵn sàng. Chạy bằng MREmu hoặc chép vào thẻ nhớ.

### Dùng mã nguồn (nhà phát triển)

```bash
git clone https://github.com/doxuanhop/vxpflow.git
cd vxpflow
npm install
npm run dev          # studio tại http://localhost:3000
npm run desktop:dev  # vỏ desktop Tauri (cần cho build .vxp)
npm run tauri build  # tạo installer NSIS một file
```

Yêu cầu: Node 18+, Rust toolchain (cho Tauri), Windows x64.

## 🧠 Trình biên dịch hoạt động thế nào

```
Design + Blocks ──▶ mã Lua ──▶ luac (5.1, ARM) ──▶ main.lub
                                                    │
LuaEngine.axf (runtime) ──┐                         ▼
                          ├──── PackApp ───▶  <dự_án>.vxp
resource.bin (script)  ───┘     (name-table + id-table, nhúng sẵn)
```

File `.vxp` sinh ra chứa script ngay trong phần resource — không cần file ngoài. Đã kiểm chứng đầu-cuối trên **MREmu**.

## 🌐 Tiện ích mở rộng (.mvxp)

Nhập tiện ích cộng đồng (file Lua + manifest JSON) ở **Blocks → Quản lý tiện ích** — hoặc tải bản mới nhất ở **Cài đặt → Load tiện ích**. Mỗi tiện ích đăng ký khối mới + mã thư viện chèn vào app khi biên dịch.

## 🛠️ Cài đặt & cập nhật

**Icon bánh răng** trên Hub mở *Cài đặt & Môi trường*:

- **Kiểm tra cập nhật** — so với manifest bản phát hành.
- **Load thư viện** — xác minh từng thành phần toolchain tích hợp.
- **Load tiện ích** — tải danh mục tiện ích cộng đồng mới nhất.

## 📄 Giấy phép

MIT © 2026 [doxuanhop](https://github.com/doxuanhop) — xem [LICENSE](../LICENSE).

## 🙏 Ghi công

Xây dựng với: **Lua 5.1 + fengari** · **MediaTek MRE SDK** · **luac / PackApp** (TinyMRESDK) · **React + Tauri + Zustand + TailwindCSS** · **lucide-react**.

Dự án được phát triển với sự hỗ trợ của AI, dưới sự chỉ đạo và thiết kế của người điều hành phát triển.

<div align="center">**🌐 [qeafivels.com](http://qeafivels.com/) · ✉️ dohop96@gmail.com**</div>
