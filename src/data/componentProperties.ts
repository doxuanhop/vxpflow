import { UIComponent } from '../types';

/**
 * Bảng thuộc tính CHUNG áp dụng cho mọi thành phần có thuộc tính tương ứng
 * trong Designer (như khối generic "set Visible" / "get Visible" của App Inventor).
 *
 * Mỗi mục ánh xạ một thuộc tính Designer → trường trong bảng UI của mã Lua sinh ra.
 */
export interface GenericProperty {
  /** Khóa trong comp.properties (Designer) — dùng để lọc "thành phần này có thuộc tính không" */
  key: string;
  /** Trường trong bảng UI (Lua) khi sinh mã */
  luaField: string;
  /** Nhãn tiếng Việt hiển thị trên khối */
  label: string;
  type: 'boolean' | 'number' | 'string';
  /** Giá trị mặc định khi đọc thuộc tính chưa được đặt */
  defaultValue: any;
}

export const GENERIC_PROPERTIES: GenericProperty[] = [
  { key: 'visible', luaField: 'visible', label: 'KhảNhìn', type: 'boolean', defaultValue: true },
  { key: 'enabled', luaField: 'enabled', label: 'Bật', type: 'boolean', defaultValue: true },
  { key: 'text', luaField: 'text', label: 'NộiDung', type: 'string', defaultValue: '' },
  { key: 'width', luaField: 'width', label: 'Rộng', type: 'number', defaultValue: 100 },
  { key: 'height', luaField: 'height', label: 'Cao', type: 'number', defaultValue: 30 },
  { key: 'x', luaField: 'x', label: 'X', type: 'number', defaultValue: 0 },
  { key: 'y', luaField: 'y', label: 'Y', type: 'number', defaultValue: 0 },
  { key: 'color', luaField: 'color', label: 'Màu', type: 'string', defaultValue: '#ffffff' }
];

/** Thuộc tính chung hợp lệ cho một thành phần (dựa theo panel Thuộc tính Designer) */
export function genericPropertiesFor(comp?: UIComponent): GenericProperty[] {
  const out: GenericProperty[] = [];
  for (const p of GENERIC_PROPERTIES) {
    if (!comp) {
      out.push(p);
      continue;
    }
    // NộiDung chỉ áp dụng cho thành phần có thuộc tính text trong Designer
    if (p.key === 'text' && !('text' in comp.properties)) continue;
    // Màu chỉ áp dụng khi Designer cho đổi màu nền/chữ
    if (p.key === 'color' && !('backgroundColor' in comp.properties) && !('textColor' in comp.properties)) continue;
    out.push(p);
  }
  return out;
}

/** Tra thuộc tính chung theo nhãn tiếng Việt hiển thị trên khối */
export function genericPropertyByLabel(label: string): GenericProperty | undefined {
  return GENERIC_PROPERTIES.find(p => p.label === label);
}

/** Thuộc tính của thành phần SCREEN (màn hình) — cho khối "khi Screen.X" kiểu Kodular */
export const SCREEN_PROPERTIES: GenericProperty[] = [
  { key: 'title', luaField: 'title', label: 'TiêuĐề', type: 'string', defaultValue: '' },
  { key: 'backgroundColor', luaField: 'backgroundColor', label: 'MàuNền', type: 'string', defaultValue: '#0F1115' },
  { key: 'navBarColor', luaField: 'navBarColor', label: 'MàuThanhĐiềuHướng', type: 'string', defaultValue: '#16181D' },
  { key: 'scrollable', luaField: 'scrollable', label: 'CuộnĐược', type: 'boolean', defaultValue: true },
  { key: 'showStatusBar', luaField: 'showStatusBar', label: 'ThanhTrạngThái', type: 'boolean', defaultValue: true },
];

/** Tra thuộc tính Screen theo nhãn hiển thị */
export function screenPropertyByLabel(label: string): GenericProperty | undefined {
  return SCREEN_PROPERTIES.find(p => p.label === label);
}
