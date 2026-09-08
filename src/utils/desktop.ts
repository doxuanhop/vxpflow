import { VXPProject } from '../types';

/**
 * Tauri 2 desktop bridge.
 *
 * The same codebase runs in a plain browser (vite dev) and inside the Tauri
 * desktop shell. Every helper here returns a falsy/"not handled" value when
 * the app is NOT running under Tauri, so callers keep their browser path.
 */

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Gốc workspace ghi dữ liệu người dùng (máy khác không có D:\desktop-webapps).
 * Dev (chạy từ repo, VITE_DEV): <repo>/workspace — cố định theo repo này.
 * Bản cài .exe: gọi Rust workspace_root_cmd để lấy %APPDATA%/VXPFlow/workspace
 * (luôn ghi được kể cả khi app cài trong Program Files — tránh "Access denied").
 */
let _wsRootCache: string | null = null;
export function workspaceRoot(): string {
  return _wsRootCache ?? 'D:/desktop-webapps/vxpflow/workspace';
}

export async function initWorkspaceRoot(): Promise<void> {
  if (!isDesktop() || _wsRootCache) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const root = await invoke<string>('workspace_root_cmd');
    if (root) _wsRootCache = root.split(String.fromCharCode(92)).join('/');
  } catch (err) {
    console.error('workspace_root_cmd failed:', err);
  }
}

/** Returns { name, content } of a user-picked JSON project, or null when cancelled / not desktop. */
export async function pickDesktopProjectJson(): Promise<{ name: string; content: string } | null> {
  if (!isDesktop()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'VXP Project', extensions: ['json'] }]
    });
    if (!selected || typeof selected !== 'string') return null;
    const content: string = await invoke('read_text_file', { path: selected });
    const name = selected.split(/[\\/]/).pop() ?? 'project.json';
    return { name, content };
  } catch (err) {
    console.error('Desktop import failed:', err);
    return null;
  }
}

/** Ảnh người dùng chọn trong dialog import assets (desktop: Tauri, browser: file picker) */
export interface PickedImageFile {
  name: string;
  /** Nội dung nhị phân gốc của tệp (PNG/JPG/BMP/GIF…) */
  bytes: Uint8Array;
  /** dataURL để preview + decode kích thước */
  dataUrl: string;
}

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'];

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

function mimeOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Mở dialog chọn NHIỀU tệp ảnh (png/jpg/bmp/gif/webp) để import vào assets của dự án.
 * - Desktop (Tauri): native open dialog, đọc bytes qua Rust read_binary_file.
 * - Browser: input[type=file][multiple] + FileReader.
 * Trả danh sách { name, bytes, dataUrl } — null khi người dùng hủy.
 */
export async function pickImageFiles(): Promise<PickedImageFile[] | null> {
  if (isDesktop()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{ name: 'Hình ảnh S30+', extensions: IMAGE_EXT }]
      });
      if (!selected) return null;
      const paths = Array.isArray(selected) ? selected : [selected];
      const out: PickedImageFile[] = [];
      for (const p of paths) {
        try {
          const bytes: number[] = await invoke('read_binary_file', { path: p });
          const name = p.split(/[\\/]/).pop() ?? 'image.png';
          out.push({ name, bytes: new Uint8Array(bytes), dataUrl: bytesToDataUrl(new Uint8Array(bytes), mimeOf(name)) });
        } catch (e) {
          console.error('Đọc ảnh thất bại:', p, e);
        }
      }
      return out;
    } catch (err) {
      console.error('Desktop image pick failed:', err);
      return null;
    }
  }

  // Browser fallback qua <input type=file>
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = IMAGE_EXT.map(e => `.${e}`).join(',');
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) { resolve(null); return; }
      const out: PickedImageFile[] = [];
      for (const f of files) {
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        out.push({ name: f.name, bytes, dataUrl: bytesToDataUrl(bytes, f.type || mimeOf(f.name)) });
      }
      resolve(out);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Đọc kích thước ảnh (w, h) từ dataURL — resolve null nếu không decode được */
export function readImageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/* ================================================================== *
 *  WORKSPACE — cấu trúc thư mục dự án trên đĩa (chỉ chạy trong desktop)
 *  <root>/<ten_project>/
 *    assets/  ·  config/  ·  extensions/  ·  src/  ·  build/
 * ================================================================== */

export interface WorkspaceNode {
  name: string;
  dir: boolean;
  size: number;
  children?: WorkspaceNode[] | null;
}

/** Tạo (nếu thiếu) cấu trúc workspace tại <root>/<ten_project>/ — trả đường dẫn dự án */
export async function workspaceEnsure(root: string, projectName: string): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('workspace_ensure', { root, projectName });
  } catch (err) {
    console.error('workspace_ensure failed:', err);
    return null;
  }
}

/** Liệt kê cây workspace */
export async function workspaceList(dir: string): Promise<WorkspaceNode[] | null> {
  if (!isDesktop()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('workspace_list', { dir });
  } catch (err) {
    console.error('workspace_list failed:', err);
    return null;
  }
}

/** Ghi tệp nhị phân vào workspace (ảnh import, asset…) */
export async function workspaceWriteBytes(path: string, bytes: Uint8Array): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('workspace_write_bytes', { path, bytes: Array.from(bytes) });
    return true;
  } catch (err) {
    console.error('workspace_write_bytes failed:', err);
    return false;
  }
}

/** Mở thư mục workspace trong Windows Explorer */
export async function workspaceOpen(dir: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('workspace_open', { dir });
    return true;
  } catch (err) {
    console.error('workspace_open failed:', err);
    return false;
  }
}

/** Ghi tệp văn bản vào workspace (project.json, config…) */
export async function workspaceWriteText(path: string, contents: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('project_write_file', { path, contents });
    return true;
  } catch (err) {
    console.error('workspace_write_text failed:', err);
    return false;
  }
}

/**
 * Opens the VXP emulator in its OWN separate window, away from the studio UI.
 *
 * Under Tauri it creates a native desktop window ("emulator" label, reused &
 * focused if already open) whose URL is the same app with #/emulator — that
 * route renders only the phone emulator. In a plain browser it falls back to
 * window.open(). The emulator window reads the active project + Lua code from
 * shared localStorage, so it stays in sync with the studio window.
 */
export async function openEmulatorWindow(): Promise<'desktop' | 'browser' | 'failed'> {
  const url = window.location.origin + window.location.pathname + '#/emulator';

  if (isDesktop()) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const existing = await WebviewWindow.getByLabel('emulator');
      if (existing) {
        try {
          await existing.setFocus();
        } catch {
          /* ignore */
        }
        return 'desktop';
      }
      const win = new WebviewWindow('emulator', {
        url,
        title: 'VXPFlow — Live Testing',
        width: 560,
        height: 880,
        minWidth: 420,
        minHeight: 700,
        resizable: true,
        center: true
      });
      await new Promise<void>((resolve, reject) => {
        win.once('tauri://created', () => resolve());
        win.once('tauri://error', () => reject(new Error('emulator window creation failed')));
      });
      return 'desktop';
    } catch (err) {
      console.error('Failed to open Tauri emulator window:', err);
      return 'failed';
    }
  }

  // Browser fallback: open a real popup window
  const w = window.open(url, 'vxp_emulator', 'width=560,height=880,resizable=yes,scrollbars=no');
  if (!w) return 'failed';
  try {
    w.focus();
  } catch {
    /* ignore */
  }
  return 'browser';
}

/** Kết quả chạy pipeline build runtime MRE (BuildApp.bat → TinyMRESDK). */
export interface MreBuildResult {
  ok: boolean;
  /** Toàn bộ log build (compile Lua core → link → PackRes/PackApp). */
  output: string;
  /** Kích thước LuaEngine.vxp vừa build (bytes). */
  vxpBytes: number;
}

/**
 * Build runtime MRE `LuaEngine.vxp` ngay trong app desktop: gọi command Rust
 * `build_vxp` chạy `BuildApp.bat` (Lua C core → ARM GCC → TinyMRESDK
 * PackRes/PackApp), rồi đồng bộ ra mre/dist + public/mre.
 * Trả null khi không chạy trong Tauri (trình duyệt — dùng pnpm mre:build).
 */
export async function buildMREVxpDesktop(): Promise<MreBuildResult | null> {
  if (!isDesktop()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('build_vxp');
  } catch (err) {
    console.error('Desktop build_vxp failed:', err);
    return { ok: false, output: String(err), vxpBytes: 0 };
  }
}

/** Kết quả build project VXP */
export interface ProjectBuildResult {
  ok: boolean;
  output: string;
  vxpPath: string;
  vxpBytes: number;
}

/**
 * Build project VXP: luac compile Lua → bytecode → PackApp → project.vxp
 * Sử dụng MRE SDK từ D:\MRE\lua-engine\mre-core
 * App ID là số (MRE style), không phải package name kiểu Android.
 */
export async function buildProjectVxpDesktop(
  luaCode: string,
  projectName: string,
  buildDir: string,
  appId: number,
  ramKb: number
): Promise<ProjectBuildResult | null> {
  if (!isDesktop()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('build_project_vxp', {
      luaCode,
      projectName,
      buildDir,
      appId,
      ramKb,
    });
  } catch (err) {
    console.error('Desktop build_project_vxp failed:', err);
    return { ok: false, output: String(err), vxpPath: '', vxpBytes: 0 };
  }
}

/**
 * Saves raw bytes through a native save dialog (Rust writes the file).
 * Returns true when the desktop path handled the request (success OR user
 * cancelled the dialog); false when the caller should use the browser download.
 */
/**
 * Chọn một thư mục trống làm vị trí lưu trữ dự án (workspace kiểu game engine).
 * Trả null khi không chạy desktop / người dùng hủy.
 */
export async function pickProjectFolder(): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      directory: true
    });
    if (!selected || typeof selected !== 'string') return null;
    return selected.replace(/[\\/]+$/, '');
  } catch (err) {
    console.error('Pick folder failed:', err);
    return null;
  }
}

/**
 * Tạo bộ mã nguồn của dự án trên đĩa tại <vị trí lưu trữ>/<slug>/ giống
 * engine làm game: project.json + src/main.lua + assets/ (+ README).
 * Chỉ chạy trong Tauri; trả false khi không desktop để caller giữ hành vi cũ.
 */
export async function ensureWorkspaceProjectSource(project: VXPProject, lua?: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    const { projectDirOf } = await import('./projectConfig');
    const dir = projectDirOf(project);
    if (!dir) return false;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('ensure_project_dir', { path: dir });
    const files: Record<string, string> = {
      'project.json': JSON.stringify(project, null, 2),
      'src/main.lua': lua ?? project.customLuaCode ?? ''
    };
    for (const asset of project.assets || []) {
      files[`assets/${asset.name}`] = asset.data;
    }
    for (const [rel, contents] of Object.entries(files)) {
      await invoke('project_write_file', { path: `${dir}/${rel}`, contents });
    }
    return true;
  } catch (err) {
    console.error('ensureWorkspaceProjectSource failed:', err);
    return false;
  }
}

/**
 * Ghi bản build (.vxp / zip gói MRE / project zip) vào <thư mục dự án>/build/
 * — nơi xuất bản cố định của workspace, giống engine làm game.
 */
export async function saveBuildBytesToWorkspace(
  project: VXPProject,
  fileName: string,
  bytes: Uint8Array
): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    const { projectBuildDirOf } = await import('./projectConfig');
    const dir = projectBuildDirOf(project);
    if (!dir) return false;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('ensure_project_dir', { path: dir });
    await invoke('project_write_bytes', { path: `${dir}/${fileName}`, bytes: Array.from(bytes) });
    return true;
  } catch (err) {
    console.error('saveBuildBytesToWorkspace failed:', err);
    return false;
  }
}

export async function desktopSaveBytes(bytes: Uint8Array, suggestedName: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await save({ defaultPath: suggestedName });
    if (!path) return true; // user cancelled — handled, nothing to do
    await invoke('vxp_write_bytes', { path, bytes: Array.from(bytes) });
    return true;
  } catch (err) {
    console.error('Desktop save failed:', err);
    return false;
  }
}
