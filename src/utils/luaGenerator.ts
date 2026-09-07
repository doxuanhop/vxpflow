import { UIComponent, BlockInstance, VXPExtension } from '../types';
import { dimsOf } from './projectConfig';
import { debugLogger } from './debugLogger';
import { findExtensionManifest, renderExtensionLua, extBlockId } from './extensionRegistry';
import { genericPropertyByLabel, screenPropertyByLabel } from '../data/componentProperties';

/** Tiện ích .mvxp đang hoạt động trong lần sinh mã này (set đầu hàm) */
let ACTIVE_EXTS: VXPExtension[] = [];

/** Chữ ký đánh dấu mã Lua do bộ sinh Design+Blocks tạo ra */
export const LUA_GEN_MARKER = 'VXPFlow (MRE S30+): Mã nguồn Lua sinh tự động từ Designer & Blocks';

/** Chuyển CSS color (#rrggbb hoặc #rgb) sang số thập phân an toàn cho Lua */
function toLuaColor(c: string | undefined, fallback: string): number {
  const hex = (c || fallback).replace('#', '');
  const full = hex.length === 3
    ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    : hex;
  const n = parseInt(full, 16);
  return isNaN(n) ? 0 : n;
}

/** Tên định danh Lua an toàn từ tên người dùng đặt (thủ tục / biến / timer) */
function sanitizeLuaIdent(raw: string, fallback: string): string {
  let s = String(raw || '').trim();
  s = s.replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(s)) s = `_${s}`;
  return s || fallback;
}

/** Mã phím (KEY_OK / KEY_NUM5…) → hằng số Lua MRE.KEY_* ; không nhận diện được thì -1 */
function keyConstantLua(name: string): string {
  const n = String(name || '').trim();
  if (n.startsWith('KEY_')) return `MRE.${n}`;
  if (n) return `MRE.KEY_${n}`;
  return '-1';
}

/** Thêm dòng "render()" cuối thân handler (đệp lùi theo depth) */
function withRender(body: string, depth: number): string {
  if (!body.trim()) return `${'  '.repeat(depth)}render()\n`;
  return body + `${'  '.repeat(depth)}render()\n`;
}


/** Map nhãn thiết bị trên khối KeyInit/keypad_init → id profile bàn phím cứng */

/** Chuỗi hex màu an toàn cho Lua string (không virgule) */
function toLuaColorStr(v: string | undefined, fallback = '#0F1115'): string {
  const s = (v || fallback).replace(/"/g, '');
  return s;
}

function keypadProfileId(label: string): string {
  const s = (label || '').toLowerCase();
  if (s.includes('225')) return 'nokia225';
  if (s.includes('ngang') || s.includes('320x240')) return 's30plus_landscape';
  return 's30plus';
}

export function generateLuaFromProject(
  components: UIComponent[],
  blocks: BlockInstance[],
  projectName: string = 'VXPFlow App',
  entryScreen: string = 'Screen1',
  extensions: VXPExtension[] = [],
  /** Khổ màn hình đích 'WxH' — mặc định 240x320 (dọc S30+) */
  resolution?: string
): string {
  ACTIVE_EXTS = extensions;
  // Kích thước thật lấy từ resolution dự án (mặc định QVGA dọc 240x320 S30+)
  const dims = dimsOf(resolution);
  const TARGET_W = dims.w;
  const TARGET_H = dims.h;

  // Chỉ màn hình chính (entry) được đóng gói vào .vxp; màn hình phụ là bản thiết kế riêng
  const screenComponents = components.filter(c => (c.screen ?? 'Screen1') === entryScreen);
  if (screenComponents.length !== components.length) {
    debugLogger.info('Compiler', `Màn hình chính "${entryScreen}": bỏ qua ${components.length - screenComponents.length} thành phần của màn hình phụ khi đóng gói .vxp`);
  }
  components = screenComponents;

  // Blocks cũng theo MÀN CHÍNH: block.screen undefined = màn chính (tương thích dự án cũ)
  const screenBlocks = blocks.filter(b => (b.screen ?? entryScreen) === entryScreen);
  if (screenBlocks.length !== blocks.length) {
    debugLogger.info('Compiler', `Màn hình chính "${entryScreen}": bỏ qua ${blocks.length - screenBlocks.length} khối của màn hình phụ khi đóng gói .vxp`);
  }
  blocks = screenBlocks;

  debugLogger.compiler(`Bắt đầu chuyển dịch AST sang mã nguồn Lua cho ứng dụng "${projectName}"...`);

  // Check component boundaries
  for (const comp of components) {
    const x = typeof comp.x === 'number' ? comp.x : 0;
    const y = typeof comp.y === 'number' ? comp.y : 0;
    const w = typeof comp.width === 'number' ? comp.width : 100;
    const h = typeof comp.height === 'number' ? comp.height : 30;

    if (x + w > TARGET_W || y + h > TARGET_H || x < 0 || y < 0) {
      debugLogger.warn(
        'Designer Linter',
        `Cảnh báo: Linh kiện "${comp.name}" (${comp.type}) vượt quá màn hình 240x320 tại (X:${x}, Y:${y}, W:${w}, H:${h})`
      );
    }
  }

  let code = `--[[
  -------------------------------------------------------------
  ${LUA_GEN_MARKER}
  Ứng dụng: ${projectName}
  Mục tiêu: MediaTek MRE SDK / Nokia S30+ (.vxp) - Độ phân giải chuẩn 240x320
  -------------------------------------------------------------
]]

-- Runtime: nếu môi trường đã đặt sẵn bảng MRE (LuaEngine thật / giả lập) thì dùng;
-- ngược lại nạp module "mre" (fengari preload / SDK)
local MRE = type(_G.MRE) == "table" and _G.MRE or nil

-- Khai báo kích thước chuẩn 240x320 Nokia S30+
local SCREEN_WIDTH = ${TARGET_W}
local SCREEN_HEIGHT = ${TARGET_H}

local variables = {
  diem_so = 0,
  mang_song = 3
}

-- Đọc biến an toàn: biến chưa gán trả 0 thay vì nil (tránh lỗi phép toán)
function varOr(name)
  local v = variables[name]
  if v == nil then return 0 end
  return v
end

-- Biến hệ thống của các khối sự kiện (phím bất kỳ / hộp thoại chọn)
local last_key = 0
local notifier_text = ""
local notifier_choice = ""
local notifier_open = false

-- Đồng bộ biến hệ thống vào bảng variables để khối "lấy biến <tên>" đọc được
-- (last_key / notifier_choice — khối var_get đọc qua varOr)
function sync_system_vars()
  variables["last_key"] = last_key
  variables["notifier_choice"] = notifier_choice
  variables["notifier_text"] = notifier_text
end

-- Khai báo danh sách thành phần giao diện (đã chuẩn hóa 240x320)
local UI = {}
-- Màn hình chính (Screen): khối "đặt Screen.<thuộc tính>" ghi vào đây
UI["${entryScreen}"] = {
  type = "Screen",
  title = ${JSON.stringify(projectName)},
  backgroundColor = "#0F1115",
  navBarColor = "#16181D",
  scrollable = true,
  showStatusBar = true
}
`;

  if (blocks.some(b => b.defId === 'storage_get_value' || b.defId === 'storage_set_value')) {
    code += `-- Bộ nhớ TinyDB: dữ liệu tồn tại trong phiên chạy (trên máy thật sẽ ánh xạ sang bộ nhớ MRE)
local TinyDBStore = {}

`;
  }

  // Helper to normalize coordinates & dimensions to 240x320 space
  const normalizeDimension = (val: number | string | undefined, max: number, defaultVal: number): number => {
    if (val === 'fill' || val === 'Fill parent' || val === 'fill_parent') return max;
    if (val === 'auto' || val === 'Automatic') return defaultVal;
    if (typeof val === 'number') {
      // Clamp to screen bounds
      return Math.min(Math.max(val, 0), max);
    }
    const parsed = parseInt(String(val), 10);
    return isNaN(parsed) ? defaultVal : Math.min(Math.max(parsed, 0), max);
  };

  // Define components in Lua — UI table stores RUNTIME state that Blocks can modify
  for (const comp of components) {
    const compW = normalizeDimension(comp.width, TARGET_W, 100);
    const compH = normalizeDimension(comp.height, TARGET_H, 30);
    const compX = Math.min(Math.max(comp.x || 0, 0), TARGET_W);
    const compY = Math.min(Math.max(comp.y || 0, 0), TARGET_H);

    const textColor = toLuaColor(comp.properties.textColor || comp.properties.TextColor, '#ffffff');
    const bgColor = toLuaColor(comp.properties.backgroundColor || comp.properties.BackgroundColor, '#2563eb');
    const fontSize = comp.properties.fontSize || comp.properties.FontSize || 13;

    code += `UI["${comp.name}"] = {
  id = "${comp.id}",
  type = "${comp.type}",
  x = ${compX},
  y = ${compY},
  width = ${compW},
  height = ${compH},
  text = "${(comp.properties.text || comp.properties.Text || comp.name || '').replace(/"/g, '\\"')}",
  text_color = ${textColor},
  bg_color = ${bgColor},
  font_size = ${fontSize},
  visible = ${comp.properties.visible !== false && comp.properties.Visible !== false},
  enabled = ${comp.properties.enabled !== false},
  checked = ${comp.properties.checked !== false},
  value = ${comp.properties.value || 50},
  picture = "${(comp.properties.picture || '').replace(/"/g, '\\"')}"
}\n`;
  }

  // Tiện ích .mvxp: chèn thư viện Lua của các tiện ích đang được dùng (khối xuất hiện trên bảng)
  const usedExtDefIds = new Set(blocks.map(b => b.defId));
  const usedExtensions = extensions.filter(ext => (ext.blocks || []).some(m => usedExtDefIds.has(extBlockId(ext.id, m.id))));
  if (usedExtensions.length > 0) {
    code += `\n--[[ ============ TIỆN ÍCH (.mvxp) ============ ]]\n`;
    for (const ext of usedExtensions) {
      code += `\n-- Tiện ích: ${ext.name} v${ext.version} (${ext.id})\n`;
      if (ext.initCode && ext.initCode.trim()) code += `${ext.initCode.trim()}\n`;
      if (ext.luaCode && ext.luaCode.trim()) code += `${ext.luaCode.trim()}\n`;
    }
    code += `\n`;
  }

  // --- Helper: escape string for Lua ---
  const luaStr = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // ----------------------------------------------------------------
  // EVENT HANDLERS — mỗi event gọi render() sau khi chạy xong
  // ----------------------------------------------------------------

  // Thủ tục do người dùng định nghĩa (khối "định nghĩa thủ tục" — đầu chuỗi như event)
  // Sinh TRƯỚC để các handler khác có thể gọi được.
  const procBlocks = blocks.filter(b => b.defId === 'proc_def');
  for (const blk of procBlocks) {
    const procName = sanitizeLuaIdent(String(blk.fields.name || 'ThuTucCuaToi'), 'proc');
    code += `-- Thủ tục: ${procName}\nfunction proc_${procName}()\n`;
    code += generateBlockChainCode(blk, blocks);
    code += `end\n\n`;
  }

  // Sự kiện Initialize của thành phần non-visible (Clock/KeypadListener/Notifier/.../KeyInit)
  const compInitBlocks = blocks.filter(b => b.defId === 'event_component_init');
  for (const blk of compInitBlocks) {
    const compName = sanitizeLuaIdent(String(blk.fields.component || 'Timer1'), 'comp');
    code += `-- Khởi tạo thành phần non-visible: ${blk.fields.component || 'Timer1'}\n`;
    code += `function on_init_${compName}()\n`;
    code += generateBlockChainCode(blk, blocks);
    code += `  render()\nend\n\n`;
  }

  // Screen init
  const initBlocks = blocks.filter(b => b.defId === 'event_screen_init');
  code += `\n-- Hàm khởi tạo màn hình chính\nfunction on_screen_init()\n`;
  code += `  MRE.log("VXP: Khởi tạo ứng dụng trên màn hình ${TARGET_W}x${TARGET_H}...")\n`;
  // Thành phần KeyInit trong Designer: khởi tạo bàn phím cứng S30+/Nokia 225 TRƯỚC mọi khối khác
  for (const c of components.filter(cc => cc.type === 'KeyInit')) {
    const profile = keypadProfileId(String(c.properties.device || 'S30+ (240x320)'));
    code += `  MRE.keypad_init("${profile}")\n`;
    code += `  MRE.log("[KeyInit ${c.name}] Bàn phím cứng: ${profile}")\n`;
  }
  // Gọi handler "khi <thành_phần>.KhởiTạo do" (non-visible) trước khối khởi tạo của Screen
  for (const blk of compInitBlocks) {
    const compName = sanitizeLuaIdent(String(blk.fields.component || 'Timer1'), 'comp');
    code += `  if on_init_${compName} then on_init_${compName}() end\n`;
  }
  for (const blk of initBlocks) {
    code += generateBlockChainCode(blk, blocks);
  }
  code += `  render()\nend\n\n`;

  // Button clicks — mỗi nút có hàm riêng, chạy xong → render()
  const btnClickBlocks = blocks.filter(b => b.defId === 'event_btn_click');
  for (const blk of btnClickBlocks) {
    const btnName = blk.fields.button || 'Button1';
    code += `function on_${btnName}_click()\n`;
    code += generateBlockChainCode(blk, blocks);
    code += `  render()\nend\n\n`;
  }

  // Timer tick (khối cũ — mọi timer dùng chung 1 handler)
  const timerBlocks = blocks.filter(b => b.defId === 'event_timer_tick');
  code += `function on_timer_tick()\n`;
  for (const blk of timerBlocks) {
    code += generateBlockChainCode(blk, blocks);
  }
  code += `  render()\nend\n\n`;

  // Timer tick theo TÊN Clock trong Designer (mỗi Clock một handler riêng)
  const clockBlocks = blocks.filter(b => b.defId === 'event_clock_timer');
  for (const blk of clockBlocks) {
    const timerName = sanitizeLuaIdent(String(blk.fields.timer || 'Timer1'), 'timer');
    code += `function on_clock_${timerName}_tick()\n`;
    code += generateBlockChainCode(blk, blocks);
    code += `  render()\nend\n\n`;
  }

  // Keypad event — điều phối cho:
  //  + event_key_press: theo phím chọn trước (KEY_OK, KEY_UP…)
  //  + event_any_key: mọi phím, giá trị phím nằm trong biến toàn cục "last_key"
  code += `function on_key_event(key_code, event_type)\n`;
  code += `  if event_type ~= "DOWN" then return end\n`;
  code += `  MRE.log("Phím nhấn: " .. tostring(key_code))\n`;
  code += `  last_key = key_code\n`;
  code += `  sync_system_vars()\n`;
  // Hộp thoại Notifier đang mở: OK/phím trái mềm = nút 1, phím phải mềm = nút 2,
  // sau đó đóng dialog + phát sự kiện on_notifier_choose. Phím khác bị chặn.
  code += `  if notifier_open then\n`;
  code += `    if key_code == MRE.KEY_OK or key_code == MRE.KEY_SOFT_LEFT then\n`;
  code += `      notifier_choice = "nút 1"\n`;
  code += `    elseif key_code == MRE.KEY_SOFT_RIGHT then\n`;
  code += `      notifier_choice = "nút 2"\n`;
  code += `    else\n`;
  code += `      return\n`;
  code += `    end\n`;
  code += `    notifier_open = false\n`;
  code += `    sync_system_vars()\n`;
  code += `    if on_notifier_choose then on_notifier_choose() end\n`;
  code += `    render()\n`;
  code += `    return\n`;
  code += `  end\n`;
  const keyBlocks = blocks.filter(b => b.defId === 'event_key_press');
  const anyKeyBlocks = blocks.filter(b => b.defId === 'event_any_key');
  if (keyBlocks.length > 0 || anyKeyBlocks.length > 0) {
    code += `  local _key_handlers = {\n`;
    for (const blk of keyBlocks) {
      const keyName = String(blk.fields.key || 'KEY_OK');
      code += `    [${keyConstantLua(keyName)}] = function()\n`;
      code += withRender(generateBlockChainCode(blk, blocks), 3);
      code += `    end,\n`;
    }
    code += `  }\n`;
    code += `  local _h = _key_handlers[key_code]\n`;
    code += `  if _h then _h() end\n`;
    // Phím bất kỳ — mọi phím nhấn đều chạy (kể cả phím đã có handler riêng)
    for (const blk of anyKeyBlocks) {
      code += `  if on_any_key_handler then on_any_key_handler() end\n`;
      break;
    }
  }
  code += `  render()\nend\n\n`;

  // Handler "phím bất kỳ" — nhận mã phím qua biến toàn cục last_key
  if (anyKeyBlocks.length > 0) {
    code += `function on_any_key_handler()\n`;
    for (const blk of anyKeyBlocks) {
      code += generateBlockChainCode(blk, blocks);
    }
    code += `end\n\n`;
  }

  // Notifier chọn — chạy khi người dùng bấm nút trong hộp thoại chọn
  const notifierChooseBlocks = blocks.filter(b => b.defId === 'event_notifier_choose');
  if (notifierChooseBlocks.length > 0) {
    code += `function on_notifier_choose()\n`;
    for (const blk of notifierChooseBlocks) {
      code += generateBlockChainCode(blk, blocks);
    }
    code += `  render()\nend\n\n`;
  }

  // ----------------------------------------------------------------
  // RENDER — đọc TOÀN BỘ từ UI table (không hardcode designer values)
  // ----------------------------------------------------------------
  code += `-- Hàm vẽ giao diện — đọc từ UI table để Blocks thay đổi có hiệu lực
function render()
  MRE.draw_rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, ${toLuaColor(undefined, '#0F1115')})
  -- Thanh tiêu đề
  MRE.draw_rect(0, 0, SCREEN_WIDTH, 20, ${toLuaColor(undefined, '#16181D')})
  MRE.draw_text("${luaStr(projectName)}", 6, 4, ${toLuaColor(undefined, '#D1D5DB')}, 11)
`;

  for (const comp of components) {
    const n = comp.name;
    const compW = normalizeDimension(comp.width, TARGET_W, 100);
    const compH = normalizeDimension(comp.height, TARGET_H, 30);
    const compX = Math.min(Math.max(comp.x || 0, 0), TARGET_W);
    const compY = Math.min(Math.max(comp.y || 0, 0), TARGET_H);

    const defBg = toLuaColor(comp.properties.backgroundColor || comp.properties.BackgroundColor, '#2563eb');
    const defText = toLuaColor(comp.properties.textColor || comp.properties.TextColor, '#ffffff');
    const defFontSize = comp.properties.fontSize || comp.properties.FontSize || 13;
    const btnTextY = compY + Math.max(4, Math.floor(compH / 4));

    code += `  -- ${comp.type}: ${n}\n`;
    code += `  if UI["${n}"] and UI["${n}"].visible then\n`;

    if (comp.type === 'Label') {
      // Vẽ nền LCD của Label (bg_color) rồi mới vẽ chữ — chữ mới đọc được trên nền tối app
      code += `    MRE.draw_rect(${compX}, ${compY}, ${compW}, ${compH}, UI["${n}"].bg_color or ${defBg})\n`;
      code += `    MRE.draw_text(UI["${n}"].text or "", ${compX}, ${compY}, UI["${n}"].text_color or UI["${n}"].color or ${defText}, UI["${n}"].font_size or ${defFontSize})\n`;
    } else if (comp.type === 'Button') {
      code += `    MRE.draw_rect(${compX}, ${compY}, ${compW}, ${compH}, UI["${n}"].bg_color or UI["${n}"].color or ${defBg})\n`;
      code += `    MRE.draw_text(UI["${n}"].text or "", ${compX + 8}, ${btnTextY}, UI["${n}"].text_color or UI["${n}"].color or ${defText}, UI["${n}"].font_size or 13)\n`;
    } else if (comp.type === 'CheckBox') {
      code += `    MRE.draw_rect(${compX}, ${compY + 4}, 14, 14, ${toLuaColor(undefined, '#374151')})\n`;
      code += `    if UI["${n}"].checked then MRE.draw_rect(${compX + 3}, ${compY + 7}, 8, 8, ${toLuaColor(undefined, '#22C55E')}) end\n`;
      code += `    MRE.draw_text(UI["${n}"].text or "", ${compX + 20}, ${compY + 3}, UI["${n}"].text_color or UI["${n}"].color or ${defText}, 12)\n`;
    } else if (comp.type === 'TextBox') {
      code += `    MRE.draw_rect(${compX}, ${compY}, ${compW}, ${compH}, UI["${n}"].bg_color or ${toLuaColor(undefined, '#1E293B')})\n`;
      code += `    local _txt = UI["${n}"].text or ""\n`;
      code += `    MRE.draw_text(_txt ~= "" and _txt or "...", ${compX + 6}, ${compY + 6}, ${toLuaColor(undefined, '#9CA3AF')}, 12)\n`;
    } else if (comp.type === 'ProgressBar') {
      code += `    MRE.draw_rect(${compX}, ${compY}, ${compW}, 8, ${toLuaColor(undefined, '#1F2937')})\n`;
      code += `    local _val = math.max(0, math.min(100, UI["${n}"].value or 50))\n`;
      code += `    MRE.draw_rect(${compX}, ${compY}, math.floor(${compW} * _val / 100), 8, ${toLuaColor(undefined, '#10B981')})\n`;
    } else if (comp.type === 'Image') {
      code += `    MRE.draw_rect(${compX}, ${compY}, ${compW}, ${compH}, ${toLuaColor(undefined, '#1F2937')})\n`;
      code += `    MRE.draw_text("[IMG: " .. (UI["${n}"].picture or "image") .. "]", ${compX + 4}, ${compY + 4}, ${toLuaColor(undefined, '#38BDF8')}, 11)\n`;
    } else if (comp.type === 'Canvas') {
      code += `    MRE.draw_rect(${compX}, ${compY}, ${compW}, ${compH}, UI["${n}"].bg_color or ${toLuaColor(undefined, '#020617')})\n`;
    } else if (comp.type === 'HorizontalArrangement' || comp.type === 'VerticalArrangement') {
      code += `    MRE.draw_rect(${compX}, ${compY}, ${compW}, ${compH}, UI["${n}"].bg_color or ${toLuaColor(undefined, '#1E293B')})\n`;
    }

    code += `  end\n`;
  }

  // Hộp thoại Notifier đang mở — vẽ đè lên giữa màn hình
  code += `  if notifier_open then
    MRE.draw_rect(20, 120, 200, 84, ${toLuaColor(undefined, '#0B1220')})
    MRE.draw_rect(20, 120, 200, 84, ${toLuaColor(undefined, '#FFFFFF')})
    MRE.draw_text(notifier_text, 30, 132, ${toLuaColor(undefined, '#F8FAFC')}, 13)
    MRE.draw_text("[OK] " .. (notifier_choice ~= "" and notifier_choice or "Đóng"), 30, 176, ${toLuaColor(undefined, '#38BDF8')}, 12)
  end
`;

  code += `end\n\n`;

  // ----------------------------------------------------------------
  // MAIN — điểm khởi chạy MRE
  // ----------------------------------------------------------------
  // Tạo timer cho từng Clock Designer có khối "khi ... MỗiChuKỳ"
  const clockTimerMainLines: string[] = [];
  for (const blk of clockBlocks) {
    const timerName = sanitizeLuaIdent(String(blk.fields.timer || 'Timer1'), 'timer');
    const comp = components.find(c => c.name === blk.fields.timer);
    const interval = Math.max(10, Number(comp?.properties?.interval) || 100);
    clockTimerMainLines.push(`  MRE.create_timer(${interval}, on_clock_${timerName}_tick)`);
  }

  code += `-- ==================================================================
--  ADAPTER RUNTIME .VXP (LuaEngine lua-engine)
--  Khi script này được đóng gói vào .vxp (build_project_vxp), nó chạy trên
--  runtime lua-engine với bảng "mre" (mre.rect/text/log + hooks load/draw/
--  update/keypressed) và KHÔNG có bảng MRE của giả lập studio. Adapter này
--  dựng bảng MRE tương thích + hook phím/timer → toàn bộ mã phía trên chạy
--  không cần sửa.
-- ==================================================================
if type(_G.MRE) ~= "table" and type(mre) == "table" then

  -- Bảng MRE map sang API mre.* của LuaEngine
  local function rgb565(n)
    local r = math.floor(n / 65536) % 256
    local g = math.floor(n / 256) % 256
    local b = n % 256
    return mre.color(r, g, b)
  end
  local pending_renders = 0
  MRE = {
    KEY_UP = -1, KEY_DOWN = -2, KEY_LEFT = -3, KEY_RIGHT = -4, KEY_OK = -5,
    KEY_LSOFT = -6, KEY_RSOFT = -7, KEY_CLEAR = -8,
    UP = -1, DOWN = -2, LEFT = -3, RIGHT = -4, OK = -5,
    SOFT_LEFT = -6, SOFT_RIGHT = -7, CLEAR = -8,
    KEY_STAR = 42, KEY_POUND = 35, STAR = 42, POUND = 35,
    KEY_NUM0 = 48, KEY_NUM1 = 49, KEY_NUM2 = 50, KEY_NUM3 = 51, KEY_NUM4 = 52,
    KEY_NUM5 = 53, KEY_NUM6 = 54, KEY_NUM7 = 55, KEY_NUM8 = 56, KEY_NUM9 = 57,
    NUM0 = 48, NUM1 = 49, NUM2 = 50, NUM3 = 51, NUM4 = 52,
    NUM5 = 53, NUM6 = 54, NUM7 = 55, NUM8 = 56, NUM9 = 57,
    log = function(msg) mre.log(tostring(msg)) end,
    app_init = function() end,
    exit_app = function() mre.exit() end,
    draw_rect = function(x, y, w, h, c) mre.rect(x, y, w, h, rgb565(c)) end,
    draw_text = function(s, x, y, c, sz) mre.text(x, y, tostring(s), rgb565(c)) end,
    draw_line = function(x1, y1, x2, y2, c) mre.line(x1, y1, x2, y2, rgb565(c)) end,
    register_key_listener = function() end,
    create_timer = function() end,   -- runtime lua-engine tự tick ~15fps gọi update+draw
    set_timer_state = function() end,
    sound_play = function() end,
    vibrate = function() end,
    sprite_create = function() end,
    sprite_move = function() end,
    sprite_rotate = function() end,
    -- Khởi tạo bàn phím cứng (KeyInit): ghi nhận profile thiết bị (S30+/Nokia 225)
    keypad_init = function(profile)
      _G.__KEYPAD_PROFILE = tostring(profile or "s30plus")
    end,
  }

  -- Phím: lua-engine gọi mre.keypressed(tên) → đổi sang mã số rồi đẩy vào
  -- on_key_event(key_code, "DOWN") đúng như giả lập studio.
  local KEYNAME_TO_CODE = {
    up = -1, down = -2, left = -3, right = -4, ok = -5,
    softleft = -6, softright = -7, clear = -8, back = -9,
    ["0"] = 48, ["1"] = 49, ["2"] = 50, ["3"] = 51, ["4"] = 52,
    ["5"] = 53, ["6"] = 54, ["7"] = 55, ["8"] = 56, ["9"] = 57,
    ["*"] = 42, ["#"] = 35,
  }
  mre.keypressed = function(k)
    local code = KEYNAME_TO_CODE[k]
    if code and on_key_event then on_key_event(code, "DOWN") end
  end

  -- Hooks runtime: init + mỗi tick vẽ lại (thay create_timer/render() của giả lập)
  mre.load = function()
    if on_screen_init then on_screen_init() end
  end
  mre.update = function(dt)
    if on_timer_tick then on_timer_tick() end
  end
  mre.draw = function()
    if render then render() end
  end
end
`;

  code += `-- Điểm khởi chạy của MRE SDK (Màn hình ${TARGET_W}x${TARGET_H})
function main()
  MRE.app_init("${luaStr(projectName)}", SCREEN_WIDTH, SCREEN_HEIGHT)
  MRE.register_key_listener(on_key_event)
  MRE.create_timer(100, on_timer_tick)
${clockTimerMainLines.join('\n')}
  on_screen_init()
end

main()
`;

  return code;
}

/* ------------------------------------------------------------------ *
 * Sinh biểu thức giá trị (số / toán / so sánh / biến / nhãn)
 * ------------------------------------------------------------------ */
const MAX_EXPR_DEPTH = 24;

const escStr = (s: string): string =>
  String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

function findBlock(allBlocks: BlockInstance[], id?: string): BlockInstance | undefined {
  return id ? allBlocks.find(b => b.id === id) : undefined;
}

/** Giá trị cắm vào input qua inputConnections (nếu có) — trả về chuỗi biểu thức Lua */
function pluggedExpr(blk: BlockInstance, allBlocks: BlockInstance[], inputName: string, depth: number): string | null {
  const providerId = blk.inputConnections && blk.inputConnections[inputName];
  if (!providerId) return null;
  const provider = findBlock(allBlocks, providerId);
  if (!provider || !provider.defId || depth > MAX_EXPR_DEPTH) return null;
  return valueExpr(provider, allBlocks, depth + 1);
}

/** Chuyển một literal từ fields sang Lua (số / bool / chuỗi có nháy) */
function literalLua(raw: any): string {
  if (typeof raw === 'number') return String(raw);
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  const s = String(raw ?? '');
  if (s === '') return '""';
  if (s === 'true') return 'true';
  if (s === 'false') return 'false';
  const n = Number(s);
  if (s.trim() !== '' && !isNaN(n)) return String(n);
  return `"${escStr(s)}"`;
}

// Đọc input theo kiểu (có khối giá trị cắm thì dùng biểu thức, không thì literal)
const numIn = (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number): string => {
  const ex = pluggedExpr(blk, allBlocks, name, depth);
  if (ex !== null) return ex;
  const n = Number(blk.fields[name]);
  return isNaN(n) ? '0' : String(n);
};

const boolIn = (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number): string => {
  const ex = pluggedExpr(blk, allBlocks, name, depth);
  if (ex !== null) return ex;
  const raw = blk.fields[name];
  if (raw === false || raw === 'false' || raw === 0) return 'false';
  return 'true';
};

const anyIn = (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number): string => {
  const ex = pluggedExpr(blk, allBlocks, name, depth);
  if (ex !== null) return ex;
  return literalLua(blk.fields[name]);
};

// Trả về chuỗi Lua cho một input chuỗi: giá trị từ socket sẽ được tostring()
const strIn = (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number): string => {
  const ex = pluggedExpr(blk, allBlocks, name, depth);
  if (ex !== null) return `tostring(${ex})`;
  return `"${escStr(blk.fields[name] ?? '')}"`;
};

/** Khối giá trị → biểu thức Lua (đệ quy qua inputConnections như Scratch) */
function valueExpr(blk: BlockInstance, allBlocks: BlockInstance[], depth: number = 0): string {
  if (depth > MAX_EXPR_DEPTH) return '0';
  switch (blk.defId) {
    case 'math_number': {
      const n = Number(blk.fields.value);
      return isNaN(n) ? '0' : String(n);
    }
    case 'math_op': {
      const op = String(blk.fields.op || '+');
      const safe = ['+', '-', '*', '/', '%', '^'].includes(op) ? op : '+';
      return `(${numIn(blk, allBlocks, 'a', depth)} ${safe} ${numIn(blk, allBlocks, 'b', depth)})`;
    }
    case 'math_random': {
      const min = numIn(blk, allBlocks, 'min', depth);
      const max = numIn(blk, allBlocks, 'max', depth);
      return `math.random(${min}, ${max})`;
    }
    case 'math_unary': {
      const map: Record<string, string> = {
        'abs': 'math.abs', 'âm': '- (', 'làm tròn': 'math.floor(x + 0.5)',
        'sàn': 'math.floor', 'trần': 'math.ceil', 'căn bậc hai': 'math.sqrt',
        'sin': 'math.sin', 'cos': 'math.cos', 'tan': 'math.tan'
      };
      const op = map[String(blk.fields.op || 'abs')] || 'math.abs';
      const v = numIn(blk, allBlocks, 'value', depth);
      // "âm" là phủ định — cần đóng ngoặc thủ công
      if (String(blk.fields.op) === 'âm') return `(- ${v})`;
      if (op === 'math.floor(x + 0.5)') return `math.floor(${v} + 0.5)`;
      return `${op}(${v})`;
    }
    case 'math_div': {
      const a = numIn(blk, allBlocks, 'a', depth);
      const b = numIn(blk, allBlocks, 'b', depth);
      const isMod = String(blk.fields.mode) === 'phần dư';
      // tránh chia 0: trả 0
      return isMod ? `(math.floor(${b}) == 0 and 0 or (${a}) % (math.floor(${b}) ~= 0 and math.floor(${b}) or 1))` : `(${b} == 0 and 0 or math.floor(${a} / ${b}))`;
    }
    case 'math_min_max': {
      const a = numIn(blk, allBlocks, 'a', depth);
      const b = numIn(blk, allBlocks, 'b', depth);
      return String(blk.fields.mode) === 'lớn nhất' ? `math.max(${a}, ${b})` : `math.min(${a}, ${b})`;
    }
    case 'math_to_number': {
      return `(tonumber(${anyIn(blk, allBlocks, 'value', depth)}) or 0)`;
    }
    case 'text_literal':
      return `"${escStr(blk.fields.literal ?? '')}"`;
    case 'text_join': {
      return `(${anyIn(blk, allBlocks, 'a', depth)} .. ${anyIn(blk, allBlocks, 'b', depth)})`;
    }
    case 'text_length': {
      const t = strIn(blk, allBlocks, 'text', depth);
      return `string.len(${t})`;
    }
    case 'text_is_empty': {
      const t = strIn(blk, allBlocks, 'text', depth);
      return `(${t} == "")`;
    }
    case 'text_is_string': {
      const v = anyIn(blk, allBlocks, 'value', depth);
      return `(type(${v}) == "string")`;
    }
    case 'text_compare': {
      const map: Record<string, string> = { '<': '<', '<=': '<=', '==': '==', '>=': '>=', '>': '>', '!=': '~=' };
      const op = map[String(blk.fields.op || '<')] || '<';
      return `(${strIn(blk, allBlocks, 'a', depth)} ${op} ${strIn(blk, allBlocks, 'b', depth)})`;
    }
    case 'text_trim': {
      const t = strIn(blk, allBlocks, 'text', depth);
      return `string.gsub(${t}, "^%s*(.-)%s*$", "%1")`;
    }
    case 'text_case': {
      const t = strIn(blk, allBlocks, 'text', depth);
      const mode = String(blk.fields.op || 'upcase');
      if (mode === 'downcase') {
        return `string.lower(${t})`;
      }
      return `string.upper(${t})`;
    }
    case 'text_starts_with': {
      const t = strIn(blk, allBlocks, 'text', depth);
      const piece = strIn(blk, allBlocks, 'piece', depth);
      return `(string.sub(${t}, 1, string.len(${piece})) == ${piece})`;
    }
    case 'text_contains': {
      const t = strIn(blk, allBlocks, 'text', depth);
      const piece = strIn(blk, allBlocks, 'piece', depth);
      return `(string.find(${t}, ${piece}, 1, true) ~= nil)`;
    }
    case 'text_split': {
      const t = strIn(blk, allBlocks, 'text', depth);
      const delim = strIn(blk, allBlocks, 'delimiter', depth);
      return `(function() local _r={} for _w in string.gmatch(${t}, "([^"..${delim}"]+)") do table.insert(_r,_w) end return _r end)()`;
    }
    case 'list_get_item': {
      const list = anyIn(blk, allBlocks, 'list', depth);
      const idx = numIn(blk, allBlocks, 'index', depth);
      // list có thể là table (từ text_split) hoặc chuỗi → trả phần tử nếu table, ký tự nếu chuỗi
      return `(function() local _l=${list} if type(_l)=="table" then return _l[(${idx})] or "" end return tostring(_l):sub(${idx}, ${idx}) end)()`;
    }
    case 'list_length': {
      const list = anyIn(blk, allBlocks, 'list', depth);
      return `(function() local _l=${list} if type(_l)=="table" then return table.maxn(_l) end return string.len(tostring(_l)) end)()`;
    }
    case 'text_substring': {
      const t = strIn(blk, allBlocks, 'text', depth);
      const start = numIn(blk, allBlocks, 'start', depth);
      const len = numIn(blk, allBlocks, 'length', depth);
      return `string.sub(${t}, ${start}, (${start}) + (${len}) - 1)`;
    }
    case 'text_repeat': {
      const t = strIn(blk, allBlocks, 'text', depth);
      const cnt = numIn(blk, allBlocks, 'count', depth);
      return `(function() local _n=math.max(0,math.floor(${cnt})) if _n==0 then return "" end return string.rep(${t}, math.min(_n, 512)) end)()`;
    }
    case 'text_replace': {
      const t = strIn(blk, allBlocks, 'text', depth);
      const find = strIn(blk, allBlocks, 'find', depth);
      const rep = strIn(blk, allBlocks, 'replace', depth);
      // plain replace (không dùng pattern — tránh ký tự đặc biệt của Lua pattern)
      return `(function() local _s=${t} local _f=${find} local _r=${rep} if _f=="" then return _s end return string.gsub(_s, _f, _r:gsub("%%","%%%%")):gsub("%%","%%%%") end)()`;
    }
    case 'text_to_string': {
      return `tostring(${anyIn(blk, allBlocks, 'value', depth)})`;
    }
    case 'logic_and_or': {
      const a = boolIn(blk, allBlocks, 'a', depth);
      const b = boolIn(blk, allBlocks, 'b', depth);
      return String(blk.fields.op) === 'hoặc' ? `((${a}) or (${b}))` : `((${a}) and (${b}))`;
    }
    case 'logic_not': {
      return `(not ${boolIn(blk, allBlocks, 'a', depth)})`;
    }
    case 'logic_boolean': {
      const raw = blk.fields.literal;
      return (raw === false || raw === 'false' || raw === 0) ? 'false' : 'true';
    }
    case 'logic_compare': {
      const map: Record<string, string> = { '==': '==', '!=': '~=', '<': '<', '>': '>', '<=': '<=', '>=': '>=' };
      const op = map[String(blk.fields.op || '==')] || '==';
      return `(${anyIn(blk, allBlocks, 'a', depth)} ${op} ${anyIn(blk, allBlocks, 'b', depth)})`;
    }
    case 'var_get': {
      // Biến chưa gán → nil gây lỗi phép toán; fallback 0 qua hàm helper varOr
      const nm = escStr(blk.fields.name || 'diem_so');
      return `varOr("${nm}")`;
    }
    case 'get_label_text':
    case 'get_textbox_text': {
      const comp = escStr(blk.fields.component || (blk.defId === 'get_textbox_text' ? 'TextBox1' : 'ScoreLabel'));
      // UI table của thành phần có thể chưa tồn tại khi app khởi động → tránh lỗi nil
      return `((UI["${comp}"] or {}).text or "")`;
    }
    case 'get_comp_prop': {
      // Khối chung "lấy <thành phần>.<thuộc tính>" — áp dụng mọi thành phần có thuộc tính trong Designer
      const comp = escStr(blk.fields.component || '');
      const prop = genericPropertyByLabel(String(blk.fields.property || 'KhảNhìn'));
      if (!prop) return 'nil';
      return `((UI["${comp}"] or {}).${prop.luaField} or ${literalLua(prop.defaultValue)})`;
    }
    case 'storage_get_value': {
      const comp = escStr(blk.fields.component || 'TinyDB1');
      const key = escStr(blk.fields.key ?? '');
      const dflt = literalLua(blk.fields.default);
      return `(TinyDBStore["${comp}:${key}"] or ${dflt})`;
    }
    case 'notifier_get_choice': {
      return `notifier_choice`;
    }
    default: {
      // Khối tiện ích .mvxp: dùng hook sinh mã Lua khai báo trong manifest
      const ext = findExtensionManifest(ACTIVE_EXTS, blk.defId);
      if (ext && ext.manifest.lua) {
        return renderExtensionLua(ext.manifest.lua, blk, allBlocks, depth, {
          numIn, boolIn, anyIn, strIn, literalLua
        });
      }
      return '0';
    }
  }
}

export function generateBlockChainCode(block: BlockInstance, allBlocks: BlockInstance[]): string {
  // Khối sự kiện / khối ĐỊNH NGHĨA THỦ TỤC (mũ): bắt đầu từ thân lệnh trong childBlocks.then
  if (block.category === 'events' || block.defId === 'proc_def') {
    const headId = (block.childBlocks || {}).then;
    const head = findBlock(allBlocks, headId);
    return chainCode(head, allBlocks, 1);
  }
  // Khối thông thường: bắt đầu từ chính nó
  return chainCode(block, allBlocks, 1);
}

/** Duyệt chuỗi lệnh từ một khối (theo nextBlockId), sinh từng khối với độ lùi dòng depth */
function chainCode(head: BlockInstance | undefined, allBlocks: BlockInstance[], depth: number): string {
  if (!head) return '';
  let res = '';
  let cur: BlockInstance | undefined = head;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id) && seen.size < 500) {
    seen.add(cur.id);
    // Khối bị "Disable" (context menu) → bỏ qua nhưng vẫn nối mạch xung quanh
    if (!cur.disabled) {
      res += statementCode(cur, allBlocks, depth) + '\n';
    }
    cur = findBlock(allBlocks, cur.nextBlockId);
  }
  return res;
}

function statementCode(blk: BlockInstance, allBlocks: BlockInstance[], depth: number): string {
  const ind = '  '.repeat(depth);
  switch (blk.defId) {
    // Nếu…thì / ngược lại: thân lệnh lồng nhau (childBlocks.then / childBlocks.else)
    case 'ctrl_if':
    case 'ctrl_if_else': {
      const hasElse = blk.defId === 'ctrl_if_else';
      const cond = anyIn(blk, allBlocks, 'condition', 0);
      const thenHead = findBlock(allBlocks, blk.childBlocks && blk.childBlocks.then);
      const elseHead = findBlock(allBlocks, blk.childBlocks && blk.childBlocks.else);
      let s = `${ind}if ${cond} then\n`;
      s += thenHead ? chainCode(thenHead, allBlocks, depth + 1) : `${ind}  -- (nhánh "thì" chưa gắn lệnh)\n`;
      if (hasElse) {
        s += `${ind}else\n`;
        s += elseHead ? chainCode(elseHead, allBlocks, depth + 1) : `${ind}  -- (nhánh "ngược lại" chưa gắn lệnh)\n`;
      }
      s += `${ind}end`;
      return s;
    }
    case 'ctrl_repeat': {
      const count = numIn(blk, allBlocks, 'count', 0);
      const bodyHead = findBlock(allBlocks, blk.childBlocks && blk.childBlocks.body);
      let s = `${ind}for _loop_i = 1, ${count} do\n`;
      s += bodyHead ? chainCode(bodyHead, allBlocks, depth + 1) : `${ind}  -- (chưa gắn lệnh lặp)\n`;
      s += `${ind}end`;
      return s;
    }
    case 'ctrl_while': {
      const cond = anyIn(blk, allBlocks, 'condition', 0);
      const bodyHead = findBlock(allBlocks, blk.childBlocks && blk.childBlocks.body);
      let s = `${ind}while ${cond} do\n`;
      s += bodyHead ? chainCode(bodyHead, allBlocks, depth + 1) : `${ind}  -- (chưa gắn lệnh lặp)\n`;
      s += `${ind}end`;
      return s;
    }
    case 'ctrl_for_range': {
      const name = sanitizeLuaIdent(blk.fields.name || 'i', 'i');
      const from = numIn(blk, allBlocks, 'from', 0);
      const to = numIn(blk, allBlocks, 'to', 0);
      const step = numIn(blk, allBlocks, 'step', 0);
      const bodyHead = findBlock(allBlocks, blk.childBlocks && blk.childBlocks.body);
      let s = `${ind}for ${name} = ${from}, ${to}, (${step} == 0 and 1 or ${step}) do\n`;
      s += bodyHead ? chainCode(bodyHead, allBlocks, depth + 1) : `${ind}  -- (chưa gắn lệnh lặp)\n`;
      s += `${ind}end`;
      return s;
    }
    case 'ctrl_for_each': {
      const name = sanitizeLuaIdent(blk.fields.name || 'item', 'item');
      const list = anyIn(blk, allBlocks, 'list', 0);
      const bodyHead = findBlock(allBlocks, blk.childBlocks && blk.childBlocks.body);
      // list: chuỗi (duyệt theo ký tự) hoặc table (duyệt phần tử)
      let s = `${ind}do
${ind}  local _fe_list = ${list}
${ind}  if type(_fe_list) == "table" then
${ind}    for _, _fe_v in ipairs(_fe_list) do
${ind}      local ${name} = _fe_v
`;
      s += bodyHead ? chainCode(bodyHead, allBlocks, depth + 3) : `${ind}      -- (chưa gắn lệnh lặp)\n`;
      s += `${ind}    end
${ind}  else
${ind}    local _fe_s = tostring(_fe_list or "")
${ind}    for _fe_i = 1, string.len(_fe_s) do
${ind}      local ${name} = string.sub(_fe_s, _fe_i, _fe_i)
`;
      s += bodyHead ? chainCode(bodyHead, allBlocks, depth + 3) : `${ind}      -- (chưa gắn lệnh lặp)\n`;
      s += `${ind}    end
${ind}  end
${ind}end`;
      return s;
    }
    case 'ctrl_break':
      return `${ind}break`;
    case 'ctrl_continue':
      // Lua 5.1 không có continue — mô phỏng bằng break (an toàn, không đổi logic vòng ngoài)
      return `${ind}break -- (bỏ qua lần lặp này)`;
    case 'set_label_text': {
      const comp = escStr(blk.fields.component || 'ScoreLabel');
      return `${ind}if UI["${comp}"] then UI["${comp}"].text = ${strIn(blk, allBlocks, 'text', 0)} end`;
    }
    case 'set_comp_prop': {
      // Khối chung "đặt <thành phần>.<thuộc tính> = <giá_trị>" — mọi thành phần có thuộc tính trong Designer
      const comp = escStr(blk.fields.component || '');
      const propLabel = String(blk.fields.property || 'KhảNhìn');
      const prop = genericPropertyByLabel(propLabel) ?? screenPropertyByLabel(propLabel);
      if (!prop) return `${ind}-- (thuộc tính "${blk.fields.property}" chưa hỗ trợ)`;
      let val: string;
      switch (prop.type) {
        case 'boolean': val = boolIn(blk, allBlocks, 'value', 0); break;
        case 'number': val = numIn(blk, allBlocks, 'value', 0); break;
        default: val = strIn(blk, allBlocks, 'value', 0); break;
      }
      return `${ind}if UI["${comp}"] then UI["${comp}"].${prop.luaField} = ${val} end`;
    }
    case 'call_sound_play':
      return `${ind}MRE.sound_play("${escStr(blk.fields.sound || 'click')}")`;
    case 'call_vibrate':
      return `${ind}MRE.vibrate(${numIn(blk, allBlocks, 'duration', 0)})`;
    case 'set_timer_enabled':
      return `${ind}MRE.set_timer_state("${escStr(blk.fields.timer || 'GameClock')}", ${boolIn(blk, allBlocks, 'enabled', 0)})`;
    case 'canvas_draw_rect': {
      const c = toLuaColor(blk.fields.color, '#22c55e');
      return `${ind}MRE.draw_rect(${numIn(blk, allBlocks, 'x', 0)}, ${numIn(blk, allBlocks, 'y', 0)}, ${numIn(blk, allBlocks, 'width', 0)}, ${numIn(blk, allBlocks, 'height', 0)}, ${c})`;
    }
    case 'canvas_draw_text': {
      const tc = toLuaColor(blk.fields.color, '#ffffff');
      return `${ind}MRE.draw_text(${strIn(blk, allBlocks, 'text', 0)}, ${numIn(blk, allBlocks, 'x', 0)}, ${numIn(blk, allBlocks, 'y', 0)}, ${tc}, 14)`;
    }
    case 'canvas_draw_line': {
      const c = toLuaColor(blk.fields.color, '#22d3ee');
      return `${ind}MRE.draw_line(${numIn(blk, allBlocks, 'x1', 0)}, ${numIn(blk, allBlocks, 'y1', 0)}, ${numIn(blk, allBlocks, 'x2', 0)}, ${numIn(blk, allBlocks, 'y2', 0)}, ${c})`;
    }
    case 'canvas_draw_pixel': {
      const c = toLuaColor(blk.fields.color, '#fbbf24');
      return `${ind}MRE.draw_pixel(${numIn(blk, allBlocks, 'x', 0)}, ${numIn(blk, allBlocks, 'y', 0)}, ${c})`;
    }
    case 'canvas_draw_circle': {
      const c = toLuaColor(blk.fields.color, '#f472b6');
      return `${ind}MRE.draw_circle(${numIn(blk, allBlocks, 'x', 0)}, ${numIn(blk, allBlocks, 'y', 0)}, ${numIn(blk, allBlocks, 'radius', 0)}, ${c})`;
    }
    case 'sprite_create': {
      const c = toLuaColor(blk.fields.color, '#22c55e');
      return `${ind}MRE.sprite_create(${strIn(blk, allBlocks, 'sprite', 0)}, ${c}, ${numIn(blk, allBlocks, 'size', 0)})`;
    }
    case 'sprite_move': {
      const s = strIn(blk, allBlocks, 'sprite', 0);
      return `${ind}MRE.sprite_move(${s}, ${numIn(blk, allBlocks, 'x', 0)}, ${numIn(blk, allBlocks, 'y', 0)})`;
    }
    case 'sprite_rotate': {
      const s = strIn(blk, allBlocks, 'sprite', 0);
      return `${ind}MRE.sprite_rotate(${s}, ${numIn(blk, allBlocks, 'angle', 0)})`;
    }
    case 'var_set':
      return `${ind}variables["${escStr(blk.fields.name || 'diem_so')}"] = ${anyIn(blk, allBlocks, 'value', 0)}`;
    case 'var_change': {
      const name = escStr(blk.fields.name || 'diem_so');
      return `${ind}variables["${name}"] = (variables["${name}"] or 0) + ${numIn(blk, allBlocks, 'delta', 0)}`;
    }
    case 'storage_set_value': {
      const comp = escStr(blk.fields.component || 'TinyDB1');
      const key = escStr(blk.fields.key ?? '');
      return `${ind}TinyDBStore["${comp}:${key}"] = ${anyIn(blk, allBlocks, 'value', 0)}`;
    }
    case 'call_exit_app':
      return `${ind}MRE.exit_app()`;
    case 'keypad_init': {
      const rawDev = String((blk.fields as any).device || blk.fields.device || 'S30+ (240x320)');
      return `${ind}MRE.keypad_init("${keypadProfileId(rawDev)}")`;
    }
    case 'proc_call': {
      const procName = sanitizeLuaIdent(String(blk.fields.name || ''), 'proc');
      return `${ind}proc_${procName}()`;
    }
    case 'proc_return': {
      // Gán biến hệ thống "ket_qua_tra_ve" — proc có thể đọc qua khối lấy biến
      return `${ind}variables["ket_qua_tra_ve"] = ${anyIn(blk, allBlocks, 'value', 0)}`;
    }
    case 'notifier_alert': {
      const comp = escStr(blk.fields.component || 'Notifier1');
      return `${ind}notifier_text = tostring(${anyIn(blk, allBlocks, 'text', 0)})\n${ind}notifier_choice = ""\n${ind}notifier_open = true\n${ind}MRE.log("[Notifier ${comp}] " .. notifier_text)`;
    }
    case 'notifier_choose': {
      const comp = escStr(blk.fields.component || 'Notifier1');
      const b1 = strIn(blk, allBlocks, 'button1', 0);
      const b2 = strIn(blk, allBlocks, 'button2', 0);
      return `${ind}notifier_text = tostring(${anyIn(blk, allBlocks, 'text', 0)}) .. "  (" .. ${b1} .. " / " .. ${b2} .. ")"\n${ind}notifier_open = true\n${ind}MRE.log("[Notifier ${comp}] " .. notifier_text)`;
    }
    case 'notifier_close': {
      return `${ind}notifier_open = false`;
    }
    default: {
      // Khối tiện ích .mvxp: hook sinh mã Lua từ manifest
      const ext = findExtensionManifest(ACTIVE_EXTS, blk.defId);
      if (ext && ext.manifest.lua) {
        const body = renderExtensionLua(ext.manifest.lua, blk, allBlocks, depth, {
          numIn, boolIn, anyIn, strIn, literalLua
        });
        return body
          .split('\n')
          .map((ln, i) => (i === 0 ? `${ind}${ln}` : `${ind}  ${ln}`))
          .join('\n');
      }
      return `${ind}-- Block: ${blk.defId}`;
    }
  }
}
