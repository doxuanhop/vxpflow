import { UIComponent, BlockDef, BlockInstance } from '../types';
import { genericPropertiesFor , SCREEN_PROPERTIES, screenPropertyByLabel } from './componentProperties';

/**
 * Các tên ô nhập quy ước là "tên thành phần Designer" (component reference) —
 * dropdown danh sách linh kiện + được đánh dấu khi thành phần bị xóa/đổi tên.
 * Khối tiện ích .mvxp có thể đánh dấu thêm qua `component: true` trong manifest.
 */
export const COMPONENT_REF_FIELDS = ['component', 'button', 'timer', 'canvas', 'sprite'];

export function isComponentRefInput(inp: { name: string; component?: boolean }): boolean {
  return COMPONENT_REF_FIELDS.includes(inp.name) || inp.component === true;
}

/** Đổi tên thành phần trong blocks: mọi ô nhập là component-reference đang trỏ oldName → newName */
export function renameComponentRefsInBlocks(
  blocks: BlockInstance[],
  defs: BlockDef[],
  oldName: string,
  newName: string
): BlockInstance[] {
  const refFields = new Set<string>();
  for (const def of defs) {
    for (const inp of def.inputs || []) {
      if (isComponentRefInput(inp)) refFields.add(inp.name);
    }
  }
  return blocks.map(b => {
    let changed = false;
    const fields: Record<string, any> = { ...b.fields };
    for (const f of refFields) {
      if (typeof fields[f] === 'string' && fields[f] === oldName) {
        fields[f] = newName;
        changed = true;
      }
    }
    return changed ? { ...b, fields } : b;
  });
}

/**
 * Ràng buộc "thành phần Designer → khối lệnh" (giống App Inventor).
 *
 * Mỗi thành phần người dùng kéo lên màn hình ở tab DESIGN sẽ hiện trong tab
 * BLOCKS như một "thư viện con": các khối lệnh sự kiện / thao tác dành cho
 * CHÍNH thành phần đó, đã điền sẵn tên thành phần (pre-wired) — khi sinh mã
 * Lua, luaGenerator đọc đúng tên trong `fields` nên code chạy đúng linh kiện.
 *
 * (Extensions sau này nạp định dạng .mvxp — một tệp Lua kiểu .aix — sẽ bổ sung
 * thêm các defId/entry tương tự qua cùng bảng này.)
 */

export interface ComponentBlockEntry {
  defId: string;
  /** Câu mô tả hiển thị trên ô palette (đã thay tên thành phần thật) */
  phrase: string;
  /** Giá trị điền sẵn vào block khi tạo: { tên_ô_nhập: tên_thành_phần } */
  prefill: Record<string, string>;
}

/** Màu chung đánh dấu khối "thuộc thành phần" (giống pink drawer của AI2) */
export const COMPONENT_COLOR = '#e91e63';

/** Màu chấm phân loại từng loại thành phần trong danh sách */
const TYPE_COLORS: Record<string, string> = {
  Button: '#f59e0b', Label: '#10b981', TextBox: '#06b6d4',
  Image: '#8b5cf6', Canvas: '#6366f1', Sprite: '#a855f7',
  Timer: '#f97316', Sound: '#ef4444', KeypadListener: '#64748b',
  Vibrator: '#f43f5e', Storage: '#0ea5e9', Notifier: '#3b82f6', KeyInit: '#0d9488',
  VerticalArrangement: '#94a3b8', HorizontalArrangement: '#94a3b8',
  CardView: '#94a3b8', Space: '#cbd5e1', CheckBox: '#84cc16',
  ProgressBar: '#22d3ee', CircularProgress: '#22d3ee', Slider: '#2dd4bf',
  Switch: '#a3e635'
};
export const componentTypeColor = (t: string): string => TYPE_COLORS[t] || '#94a3b8';

/** Tên viết tắt hiển thị bên cạnh tên thành phần */
const TYPE_LABELS: Record<string, string> = {
  Button: 'Nút bấm', Label: 'Nhãn', TextBox: 'Ô nhập', Image: 'Hình ảnh',
  Canvas: 'Khung vẽ', Sprite: 'Nhân vật', Timer: 'Đồng hồ', Sound: 'Âm thanh',
  KeypadListener: 'Bàn phím', Vibrator: 'Rung', Storage: 'Bộ nhớ TinyDB',
  Notifier: 'Thông báo', KeyInit: 'Khởi tạo', CheckBox: 'Hộp chọn', ProgressBar: 'Thanh tiến trình',
  CircularProgress: 'Tiến trình xoay', Slider: 'Thanh trượt', Switch: 'Công tắc',
  VerticalArrangement: 'Cột', HorizontalArrangement: 'Hàng', CardView: 'Thẻ', Space: 'Khoảng trống'
};
export const componentTypeLabel = (t: string): string => TYPE_LABELS[t] || t;

/**
 * Trả danh sách khối "sẵn dùng cho thành phần này" đã điền sẵn tên.
 * Chỉ liệt kê những thao tác mà LuaGenerator thật sự hỗ trợ để không tạo
 * mã Lua vô nghĩa.
 */
export function componentDrawerEntries(comp: UIComponent): ComponentBlockEntry[] {
  const n = comp.name;
  let entries: ComponentBlockEntry[];
  switch (comp.type) {
    case 'Button':
      entries = [
        { defId: 'event_btn_click', phrase: `khi ${n}.được bấm do`, prefill: { button: n } },
        { defId: 'set_label_text', phrase: `đặt ${n}.NộiDung = …`, prefill: { component: n } }
      ];
      break;
    case 'Label':
      entries = [
        { defId: 'set_label_text', phrase: `đặt ${n}.NộiDung = …`, prefill: { component: n } },
        { defId: 'get_label_text', phrase: `lấy ${n}.NộiDung`, prefill: { component: n } }
      ];
      break;
    case 'TextBox':
      entries = [
        { defId: 'set_label_text', phrase: `đặt ${n}.NộiDung = …`, prefill: { component: n } },
        { defId: 'get_textbox_text', phrase: `lấy ${n}.NộiDung`, prefill: { component: n } }
      ];
      break;
    case 'Timer':
      entries = [
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { component: n } },
        { defId: 'event_clock_timer', phrase: `khi ${n}.mỗi chu kỳ do`, prefill: { timer: n } },
        { defId: 'event_timer_tick', phrase: `khi ${n}.mỗi chu kỳ (chung) do`, prefill: { timer: n } },
        { defId: 'set_timer_enabled', phrase: `đặt ${n}.Bật = …`, prefill: { timer: n } }
      ];
      break;
    case 'Canvas':
      entries = [
        { defId: 'canvas_clear', phrase: `${n}.XóaMànHình()`, prefill: {} },
        { defId: 'canvas_draw_rect', phrase: `${n}.VẽHìnhChữNhật`, prefill: {} },
        { defId: 'canvas_draw_circle', phrase: `${n}.VẽHìnhTròn`, prefill: {} },
        { defId: 'canvas_draw_line', phrase: `${n}.VẽĐườngThẳng`, prefill: {} },
        { defId: 'canvas_draw_pixel', phrase: `${n}.VẽĐiểmẢnh`, prefill: {} },
        { defId: 'canvas_draw_text', phrase: `${n}.VẽChữ`, prefill: {} }
      ];
      break;
    case 'Sprite':
      entries = [
        { defId: 'sprite_move', phrase: `${n}.DiChuyển(…)`, prefill: { sprite: n } },
        { defId: 'sprite_rotate', phrase: `xoay ${n} góc …`, prefill: { sprite: n } }
      ];
      break;
    case 'Storage':
      entries = [
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { component: n } },
        { defId: 'storage_set_value', phrase: `đặt ${n} = …`, prefill: { component: n } },
        { defId: 'storage_get_value', phrase: `lấy ${n}`, prefill: { component: n } }
      ];
      break;
    case 'Sound':
      entries = [
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { component: n } },
        { defId: 'call_sound_play', phrase: `${n}.Phát âm thanh`, prefill: {} }
      ];
      break;
    case 'KeypadListener':
      entries = [
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { component: n } },
        { defId: 'keypad_init', phrase: `${n}.KhởiTạoBànPhím [thiết bị]`, prefill: {} },
        { defId: 'event_key_press', phrase: `khi ${n}.nhấn phím do`, prefill: { key: 'KEY_OK' } },
        { defId: 'event_any_key', phrase: `khi ${n}.nhấn phím bất kỳ (phím) do`, prefill: {} }
      ];
      break;
    case 'Vibrator':
      entries = [
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { component: n } },
        { defId: 'call_vibrate', phrase: `${n}.Rung(…)`, prefill: {} }
      ];
      break;
    case 'Screen':
      // Khối của SCREEN kiểu Kodular: khởi tạo + đặt/lấy thuộc tính màn hình (tiêu đề, màu nền, cuộn…)
      entries = [
        { defId: 'event_screen_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { screen: n } },
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạoNonVisible do`, prefill: { component: n } },
        ...SCREEN_PROPERTIES.map(p => ({
          defId: 'set_comp_prop', phrase: `đặt ${n}.${p.label} = …`, prefill: { component: n, property: p.label }
        } as ComponentBlockEntry))
      ];
      break;
    case 'KeyInit':
      // Thành phần non-visible khởi tạo bàn phím cứng S30+/Nokia 225
      entries = [
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { component: n } },
        { defId: 'keypad_init', phrase: `${n}.KhởiTạoBànPhím [thiết bị]`, prefill: {} },
        { defId: 'event_key_press', phrase: `khi bàn phím nhấn phím do`, prefill: { key: 'KEY_OK' } },
        { defId: 'event_any_key', phrase: `khi nhấn phím bất kỳ (phím) do`, prefill: {} }
      ];
      break;
    case 'Notifier':
      entries = [
        { defId: 'event_component_init', phrase: `khi ${n}.KhởiTạo do`, prefill: { component: n } },
        { defId: 'notifier_alert', phrase: `${n}.Hiển thịThôngBáo(…)`, prefill: { component: n } },
        { defId: 'notifier_choose', phrase: `${n}.HỏiChọn(…)`, prefill: { component: n } },
        { defId: 'notifier_close', phrase: `${n}.ĐóngThôngBáo()`, prefill: { component: n } },
        { defId: 'notifier_get_choice', phrase: `lấy ${n}.LựaChọn`, prefill: { component: n } },
        { defId: 'event_notifier_choose', phrase: `khi ${n}.ChọnSauThôngBáo do`, prefill: { component: n } }
      ];
      break;
    default:
      // Arrangement / hình / … chưa có khối logic riêng
      entries = [];
  }
  // MỌI thành phần đều nhận thêm 2 khối chung đặt/lấy thuộc tính (KhảNhìn, Rộng, Cao, Bật…)
  entries = [...entries, ...genericPropertyEntries(comp)];
  return entries;
}

/**
 * Khối CHUNG "đặt/lấy thuộc tính" — áp dụng cho mọi thành phần có thuộc tính
 * tương ứng trong Designer. Mỗi thành phần đều nhận 2 khối này (đã điền sẵn
 * tên thành phần + thuộc tính mặc định phù hợp), giống generic blocks của AI2.
 */
export function genericPropertyEntries(comp: UIComponent): ComponentBlockEntry[] {
  const n = comp.name;
  const props = genericPropertiesFor(comp);
  if (props.length === 0) return [];
  // Mặc định chọn NộiDung nếu thành phần có text, ngược lại KhảNhìn
  const defaultProp = props.find(p => p.key === 'text')?.label || props[0].label;
  return [
    {
      defId: 'set_comp_prop',
      phrase: `đặt ${n}.${defaultProp} = …`,
      prefill: { component: n, property: defaultProp }
    },
    {
      defId: 'get_comp_prop',
      phrase: `lấy ${n}.${defaultProp}`,
      prefill: { component: n, property: defaultProp }
    }
  ];
}

/** Sắp xếp danh sách thành phần theo thứ tự "nhìn thấy được" rồi non-visible */
export function sortComponents(comps: UIComponent[]): UIComponent[] {
  const visibleTypes = new Set(['Button', 'Label', 'TextBox', 'Image', 'CheckBox', 'ProgressBar', 'CircularProgress', 'Slider', 'Switch', 'Canvas', 'Sprite', 'VerticalArrangement', 'HorizontalArrangement', 'CardView', 'Space']);
  return [...comps].sort((a, b) => {
    const av = visibleTypes.has(a.type) ? 0 : 1;
    const bv = visibleTypes.has(b.type) ? 0 : 1;
    if (av !== bv) return av - bv;
    return a.name.localeCompare(b.name);
  });
}
