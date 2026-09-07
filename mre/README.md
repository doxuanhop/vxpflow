# LuaEngine — Lua Runtime cho MRE (Nokia S30+)

`LuaEngine.vxp` là một **Runtime Environment MRE thuần C**: nó nhúng máy ảo
**Lua 5.1.5** và khi khởi chạy trên điện thoại sẽ **đọc `script.lua` từ thẻ
nhớ** rồi dùng `luaL_dostring()` thực thi. Bạn chỉ cần thay `script.lua` là
game/ứng dụng đổi mà không cần cài lại gì.

## Nguyên lý hoạt động trên MRE

```
1. Tích hợp Lua Core (C code) ── mre/lua-5.1.5/src
   Toàn bộ .c/.h của máy ảo Lua C thuần (Lua 5.1.5) được đưa vào dự án MRE.
   Chỉ dùng các thư viện an toàn (base/table/string/math/debug) — không kéo
   package/io/os để tránh phụ thuộc dlopen/fopen không có trên máy thật.

2. MRE SDK biên dịch → LuaEngine.vxp ── BuildApp.bat
   arm-none-eabi-gcc biên dịch Lua core + LuaEngine.c → liên kết với
   gccmain.c (điểm vào vm_entry) + scat.ld + lib MRE30 → TinyMRESDK
   (PackRes + PackApp) đóng gói + ký → LuaEngine.vxp.

3. Thực thi script ── lúc chạy trên điện thoại
   LuaEngine.vxp (Runtime Environment) đọc \mod\LuaEngine\script.lua từ thẻ
   nhớ bằng vm_file_open / vm_file_read và thực thi bằng luaL_dostring().
```

## Cấu trúc

```
mre/
├── lua-5.1.5/            Lua Core — mã nguồn máy ảo Lua C thuần (MIT)
├── LuaEngine/            Dự án runtime MRE
│   ├── LuaEngine.c       vm_main() + nhúng Lua + binding mre_* (vẽ/phím/timer/log)
│   ├── mre_stubs.c       Cầu libc (newlib) → MRE: malloc→vm_malloc, syscall stubs,
│   │                     reentrant allocators (_malloc_r…), __assert_func bắt lỗi
│   ├── BuildApp.bat      Pipeline MRE SDK đầy đủ (compile → link → PackRes → PackApp)
│   ├── LuaEngine.vcproj  Project VS2008 cho ResEditor/PackDigist (nếu dùng IDE cũ)
│   ├── LuaEngine.def     EXPORTS vm_entry @1
│   ├── ResID/ config.xml res/  Hồ sơ đóng gói
│   ├── script.lua        Script demo (bóng nảy + điểm số — chạy được ngay)
│   └── arm/LuaEngine.vxp Kết quả build (887 KB, unsigned, appid 0)
└── dist/LuaEngine.vxp    Bản phát hành — được sao vào public/mre/ để studio
                          đính kèm khi "Xuất gói MRE (LuaEngine)"
```

## Build

### Cách 1 — ngay trong app desktop (Tauri)

Nút **🔨 Build VXP** (cạnh nút Giả lập, chỉ hiện khi chạy bằng `npx tauri dev`)
gọi command Rust `build_vxp` → chạy đúng `BuildApp.bat` rồi đồng bộ kết quả.
Khi bấm **Xuất gói MRE**, app cũng **tự build LuaEngine.vxp mới** trước khi
đóng gói — gói zip luôn kèm runtime vừa build, không dùng file tĩnh cũ.
Log build đầy đủ nằm trong Debug Console / DevTools console.

### Cách 2 — dòng lệnh

Máy đã cài sẵn các công cụ (xem "Công cụ" bên dưới) — chỉ cần chạy:

```bat
cd mre\LuaEngine
BuildApp.bat
:: kết quả: arm\LuaEngine.vxp (+ đồng bộ sang mre\dist và public\mre)
```

hoặc từ gốc dự án: `pnpm mre:build`.

Biến môi trường tuỳ chỉnh:

| Biến         | Mặc định                                              | Ý nghĩa                    |
|--------------|-------------------------------------------------------|----------------------------|
| `MRE_SDK`    | `D:\MRE\XimikBoda\third_party\mre-sdk\app`            | SDK MRE (include + lib)    |
| `ARM_GCC`    | `arm-none-eabi`                                        | Bộ biên dịch ARM           |
| `TinyMRESDK` | `D:\MRE\XimikBoda\TinyMRESDK-main`                     | PackRes/PackApp (đóng gói) |

Các bước trong `BuildApp.bat` (khớp đúng nguyên lý):

1. compile `gccmain.c` (stub `vm_entry` của SDK, gọi `vm_main`)
2. compile Lua core: `lapi lauxlib lbaselib lcode ldblib ldebug ldo ldump
   lfunc lgc llex lmathlib lmem lobject lopcodes lparser lstate lstring
   lstrlib ltable ltablib ltm lundump lvm lzio` (loại lua/luac/liolib/loadlib/…)
3. compile `LuaEngine.c` + `mre_stubs.c`
4. link: `-fpic -pie -nostartfiles -T scat.ld` + `percommon.a perfile.a
   persysfile.a -lm`
5. `PackRes.exe` (resource rỗng) + `PackApp.exe -a LuaEngine.axf -o
   LuaEngine.vxp -tai 0` (unsigned → chạy trên MREmu; muốn chạy máy thật,
   ký bằng `cert100-key.pem` — xem "Chạy trên máy thật")

> Lưu ý MREmu quirk: `vm_file_read` của MREmu trả *số byte đã đọc* thay vì 0
> như máy thật — `LuaEngine.c` chấp nhận cả hai.

## Chạy

**Trên MREmu (giả lập PC):** đặt script rồi chạy file .vxp:

```bat
copy mre\LuaEngine\script.lua "%LOCALAPPDATA%\MREmu\fs\e\mod\LuaEngine\script.lua"
mkdir "%LOCALAPPDATA%\MREmu\fs\e\mod\LuaEngine"   :: nếu chưa có
D:\MRE\lua-engine\mre-core\emulator\MREmu.exe mre\LuaEngine\arm\LuaEngine.vxp -l
```

MREmu ánh xạ `\mod\LuaEngine\script.lua` (thẻ nhớ ảo) sang
`%LOCALAPPDATA%\MREmu\fs\e\mod\LuaEngine\script.lua` — copy script vào đó là
chạy. Log runtime in ra console của MREmu (dòng `[LuaEngine] ...`).

**Trên máy thật (Nokia S30+):**

1. Cài `LuaEngine.vxp` (bản có ký — xem dưới) vào máy.
2. Copy `script.lua` vào thẻ nhớ tại `\mod\LuaEngine\script.lua`.
3. Mở ứng dụng LuaEngine → runtime đọc + chạy script.

### Ký bằng cert (chạy máy thật, appid ≠ 0)

Bản build mặc định `-tai 0` chỉ chạy được trên MREmu. Để chạy máy thật, đóng
gói lại với chứng chỉ:

```bat
set TinyMRESDK=D:\MRE\XimikBoda\TinyMRESDK-main
%TinyMRESDK%\bin\PackApp.exe -a mre\LuaEngine\LuaEngine.axf -r mre\LuaEngine\arm\LuaEngine.res -o LuaEngine_signed.vxp -tr 1000 -tn LuaEngine -tdn "VXPEngine Studio" -tb 0 -tapi File -ty vxp -tc GCC -tai 67502 -tci 100 -ti 91234567890 -crt D:\MRE\lua-engine\mre-core\signing\cert100-key.pem
```

## Lua API (có sẵn khi chạy script)

| Hàm Lua                          | MRE thật / ý nghĩa                                   |
|----------------------------------|------------------------------------------------------|
| `mre_draw_text(x,y,text,color,size)` | vẽ chữ (màu 0xRRGGBB, cỡ chữ điểm)              |
| `mre_fill_rect(x,y,w,h,color)`   | tô hình chữ nhật                                      |
| `mre_get_screen_size()`          | trả về `w, h` (240, 320)                              |
| `mre_set_interval(ms)`           | bật game loop — gọi `on_frame()` mỗi `ms`            |
| `mre_clear_interval()`           | tắt game loop                                         |
| `mre_vibrate()`                  | rung máy 1 giây                                       |
| `mre_log(msg)`                   | ghi log hệ thống MRE                                  |
| `mre_exit()`                     | thoát ứng dụng                                        |
| `mre_flush()`                    | đẩy bộ đệm vẽ ra màn hình (tự flush sau mỗi callback) |

Callback script định nghĩa: `on_init()`, `on_paint()`, `on_frame()`,
`on_key(keycode, event)` (hằng số phím `VM_KEY_*` âm: OK=-5, Left/-3, Right/-4,
Up/-1, Down/-2, LeftSoft=-6, RightSoft=-7, Clear=-8; event DOWN=2).

Ví dụ demo đầy đủ trong `mre/LuaEngine/script.lua`.

## Công cụ (máy đã cài)

- SDK MRE: `D:\MRE\XimikBoda\third_party\mre-sdk\app` (include `vm_*`, lib
  `MRE30/armgcc`, `gccmain.c`)
- TinyMRESDK: `D:\MRE\XimikBoda\TinyMRESDK-main\bin` (PackApp.exe, PackRes.exe)
- ARM GCC: `Arm GNU Toolchain arm-none-eabi 14.2 rel1`
- MREmu: `D:\MRE\lua-engine\mre-core\emulator\MREmu.exe`
- Chứng chỉ: `D:\MRE\lua-engine\mre-core\signing\cert100-key.pem`

## Kiến trúc runtime (LuaEngine.c) — đã kiểm chứng end-to-end trên MREmu

- `vm_main()` đăng ký sysevt/keyboard callback rồi `vm_res_init()`.
- `VM_MSG_CREATE` → `init_lua()`: tạo `lua_State`, mở thư viện an toàn, đăng ký
  binding, đọc `script.lua` (thử `\mod\LuaEngine\`, rồi `\mre\LuaEngine\`),
  `luaL_dostring()` — lỗi cú pháp/lỗi chạy được ghi log rõ ràng.
- `VM_MSG_PAINT` → tạo layer toàn màn hình, gọi `on_paint()` nếu script ok;
  nếu thiếu script, tự vẽ màn hình lỗi kèm đường dẫn cần đặt.
- `mre_set_interval` → `vm_create_timer` (timer MRE tự lặp) gọi `on_frame()`.
- Bộ nhớ Lua chạy trên MRE allocator (`mre_stubs.c`: malloc→vm_malloc, kể cả
  nhánh reentrant `_malloc_r` mà newlib dùng cho strtod/sprintf — nếu thiếu,
  Lua chết ngay ở hằng số hex / phép nối chuỗi vì `_sbrk` rỗng).
