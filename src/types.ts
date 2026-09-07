export type ViewMode = 'projects' | 'designer' | 'blocks' | 'code' | 'pixel' | 'files';

export type EmulatorDevice = 's30plus' | 'android';

export type ScreenResolution = '240x320' | '128x160' | '240x240' | '320x480' | '320x240';

export interface ProjectFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface ComponentProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'image';
  value: any;
  options?: string[];
  description?: string;
}

export interface UIComponent {
  id: string;
  name: string;
  type: 
    | 'Button' 
    | 'Label' 
    | 'TextBox' 
    | 'Image' 
    | 'CheckBox' 
    | 'ProgressBar'
    | 'CircularProgress'
    | 'Slider'
    | 'Switch'
    | 'Canvas' 
    | 'Sprite' 
    | 'Timer' 
    | 'Sound' 
    | 'KeypadListener' 
    | 'Vibrator'
    | 'Storage'
    | 'KeyInit'
    | 'VerticalArrangement'
    | 'HorizontalArrangement'
    | 'CardView'
    | 'Space'
    | 'Notifier'
    | 'Screen';
  x: number;
  y: number;
  width: number | string; // e.g. 100 or 'fill'
  height: number | string;
  properties: Record<string, any>;
  children?: string[]; // IDs of child components for arrangements
  parentId?: string;
  /** Màn hình sở hữu thành phần này (mặc định 'Screen1' khi không có) */
  screen?: string;
}

export type BlockCategory = 'events' | 'control' | 'logic' | 'math' | 'text' | 'ui' | 'game' | 'system' | 'variables' | 'procedures' | 'extensions';

export interface BlockDef {
  id: string;
  type: string;
  category: BlockCategory;
  label: string;
  color: string;
  inputs?: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'any' | 'block' | 'property';
    default?: any;
    /** Input nhận khối giá trị cắm vào (socket) — biểu thức được ghép như Scratch/App Inventor */
    socket?: boolean;
    /** Nếu có: hiển thị dropdown các giá trị cho phép thay vì ô nhập tự do */
    options?: string[];
    /** Ô nhập này là TÊN THÀNH PHẦN (component reference) — dropdown danh sách linh kiện Designer */
    component?: boolean;
  }[];
  outputType?: 'string' | 'number' | 'boolean' | 'any';
  statement?: boolean; // is a statement block
  /** Các "hốc" thân lệnh lồng nhau (như nhánh thì / ngược lại của khối nếu…thì) */
  bodies?: { name: string; label: string }[];
}

export interface BlockInstance {
  id: string;
  defId: string;
  category: BlockCategory;
  x: number;
  y: number;
  fields: Record<string, any>;
  inputConnections: Record<string, string>; // inputName -> childBlockId
  nextBlockId?: string;
  /** Đầu chuỗi lệnh của từng hốc thân lệnh: tên hốc (then/else) -> id khối lệnh đầu tiên */
  childBlocks?: Record<string, string>;
  /** Ghi chú của khối (kiểu Comment App Inventor) */
  comment?: string;
  /** Thu gọn khối (Collapse) — ẩn thân lệnh + khối lồng */
  collapsed?: boolean;
  /** Vô hiệu hóa khối (Disable) — generator bỏ qua khi sinh Lua */
  disabled?: boolean;
  /** Hoá generic (Make Generic) — thay mọi ô nhập bằng hố trống (any) để tái sử dụng */
  generic?: boolean;
  /** Màn hình sở hữu khối (undefined = khối của màn hình chính, tương thích dự án cũ) */
  screen?: string;
}

export interface ProjectAsset {
  id: string;
  name: string;
  type: 'image' | 'sprite' | 'sound' | 'lua' | 'config';
  size: number;
  data: string; // base64 or text or pixel matrix
  width?: number;
  height?: number;
}

export interface ProjectFile {
  name: string;
  content: string;
  type: 'lua' | 'cfg' | 'inf' | 'json';
}

export interface VXPScreenProps {
  aboutScreen: string;
  backgroundColor: string;
  navBarColor: string;
  title: string;
  scrollable: boolean;
  showStatusBar: boolean;
  showOptionsMenu: boolean;
}

export interface VXPScreenMeta {
  name: string;
  properties: VXPScreenProps;
}

export interface VXPProject {
  id: string;
  name: string;
  packageName: string;
  version: string;
  author: string;
  description: string;
  targetDevice: 's30plus' | 'all_mre';
  resolution: ScreenResolution;
  /** Chiều đứng/ngang của màn hình thiết kế (portrait = dọc, landscape = ngang) */
  orientation?: 'portrait' | 'landscape';
  /** Bộ nhớ RAM cấp cho runtime khi đóng gói (KB heap) — mặc định 1024 KB */
  ramKb?: number;
  /** Vị trí lưu trữ dự án trên đĩa (workspace kiểu game engine, bản desktop):
      thư mục cha đã chọn — project được tạo ở <storagePath>/<slug>/
      gồm project.json + src/main.lua + assets/ + build/ (nơi xuất .vxp/gói MRE).
      Trống = lưu trong app (localStorage). */
  storagePath?: string;
  components: UIComponent[];
  blocks: BlockInstance[];
  customLuaCode: string;
  assets: ProjectAsset[];
  entryScreen: string;
  useVisualMode: boolean; // true = sync from designer/blocks, false = direct lua
  /** Danh sách màn hình (mỗi màn hình giữ bộ thành phần & thuộc tính riêng). Dự án cũ không có → mặc định [Screen1] */
  screens?: VXPScreenMeta[];
  /** Tiện ích .mvxp đã cài (kiểu .aix của App Inventor): thư viện Lua + khối khai báo trong manifest */
  extensions?: VXPExtension[];
  createdAt?: string;
  modifiedAt?: string;
  folderId?: string;
  iconColor?: string;
}

export type Project = VXPProject;

export interface EmulatorLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'print' | 'mre';
  message: string;
}

export interface KeypadEvent {
  key: string;
  code: number;
  type: 'down' | 'up';
}

/* ================================================================== *
 *  Tiện ích mở rộng .mvxp (kiểu .aix của App Inventor)
 *  Một .mvxp = manifest (khai báo khối mới + hook sinh mã Lua) + tệp Lua
 *  thư viện được nhúng vào mã nguồn khi dự án dùng khối của tiện ích.
 * ================================================================== */

export interface VXPBlockManifestInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'any';
  default?: any;
  /** Input nhận khối giá trị cắm vào (socket) */
  socket?: boolean;
  /** Ô nhập này là tên thành phần Designer — dropdown danh sách linh kiện */
  component?: boolean;
}

export interface VXPBlockManifest {
  id: string;
  /** Câu mô tả hiển thị trên palette — dùng <tên_ô> cho ô nhập */
  label: string;
  color?: string;
  statement?: boolean;
  /** Khối sự kiện (hat) — móc đầu chuỗi lệnh */
  event?: boolean;
  outputType?: 'string' | 'number' | 'boolean' | 'any';
  inputs?: VXPBlockManifestInput[];
  /**
   * HOOK SINH MÃ LUA: template sinh ra khi khối được dùng.
   * Placeholder: {tên_ô} literal · {num:x} số · {bool:x} đúng/sai ·
   * {any:x} biểu thức bất kỳ (có khối cắm thì dùng) · {str:x} chuỗi có nháy.
   * Ví dụ: "LedMatrix.set_pixel({num:x}, {num:y}, {any:color})"
   */
  lua: string;
}

export interface VXPExtension {
  /** id gốc (slug từ tên) — khối của tiện ích có defId = `ext_<id>_<blockId>` */
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Mã nguồn Lua thư viện — chèn vào tệp .lua khi dự án dùng khối của tiện ích */
  luaCode: string;
  /** Mã Lua khởi tạo chạy 1 lần (tùy chọn, đặt trước luaCode) */
  initCode?: string;
  /** Các khối khai báo trong manifest */
  blocks: VXPBlockManifest[];
  /** Màu mặc định cho khối khi manifest không đặt */
  color?: string;
  createdAt?: string;
}
