import { workspaceRoot } from '../utils/desktop';
import { create } from 'zustand';
import {
  ViewMode,
  VXPProject,
  UIComponent,
  BlockInstance,
  ProjectAsset,
  ProjectFolder,
  VXPScreenProps,
  VXPExtension
} from '../types';
import { BLOCK_DEFINITIONS } from '../data/blockDefinitions';
import { renameComponentRefsInBlocks } from '../data/componentBlocks';
import { extensionBlockDefs } from '../utils/extensionRegistry';
import {
  DEFAULT_SCREEN_PROPS,
  DEFAULT_SCREEN_NAME,
  compScreen,
  getScreenList,
  nextScreenName
} from '../utils/screens';
import { TEMPLATES } from '../data/templates';
import { generateLuaFromProject, LUA_GEN_MARKER } from '../utils/luaGenerator';
import { compileToVXP, downloadBlob } from '../utils/vxpCompiler';
import {
  getStoredProjects,
  saveStoredProjects,
  saveSingleProject,
  getStoredFolders,
  createAutoBackup,
  getStoredBackups
} from '../utils/projectStorage';
import { debugLogger } from '../utils/debugLogger';
import JSZip from 'jszip';

type TemplateKey = keyof typeof TEMPLATES;

export interface AppStore {
  // document / session state
  view: ViewMode;
  projects: VXPProject[];
  folders: ProjectFolder[];
  project: VXPProject;
  luaCode: string;
  /** true khi luaCode là bản TỰ ĐỘNG sinh từ Design+Blocks → mỗi lần sửa
      Design/Blocks sẽ tự đồng bộ mã. false khi người dùng viết tay Lua (giữ nguyên). */
  luaAuto: boolean;
  /** Màn hình đang thiết kế trong Designer (Screen1, Screen2…) */
  activeScreen: string;
  selectedComponentId: string | null;
  isCompiling: boolean;
  /** Đang build runtime LuaEngine.vxp qua TinyMRESDK (nút Build VXP / trước khi xuất gói MRE) */
  isBuildingMre: boolean;
  toast: string | null;
  lastBackupTime: string | null;

  // actions
  notify: (msg: string, ms?: number) => void;
  autoBackupTick: () => void;
  setView: (view: ViewMode) => void;
  selectProject: (p: VXPProject) => void;
  createProject: (p: VXPProject) => void;
  updateProjectsList: (list: VXPProject[]) => void;
  selectTemplate: (key: TemplateKey) => void;
  persistActiveProject: (updated: VXPProject, code?: string) => void;
  /** Ghi mã Lua từ bàn phím (Mã Lua): phân biệt bản viết tay với bản tự động sinh */
  persistLuaCode: (code: string) => void;
  selectComponent: (id: string | null) => void;
  setActiveScreen: (screen: string) => void;
  addScreen: (name: string) => void;
  /** Sao chép màn hình kèm toàn bộ thành phần — nút "Copy Screen" kiểu Kodular */
  copyScreen: (name: string) => void;
  renameScreen: (oldName: string, newName: string) => void;
  deleteScreen: (name: string) => void;
  setEntryScreen: (screen: string) => void;
  updateScreenProps: (screen: string, patch: Partial<VXPScreenProps>) => void;
  /** Thay bộ thành phần của đúng một màn hình (màn hình khác giữ nguyên) */
  updateScreenComponents: (screen: string, components: UIComponent[]) => void;
  updateBlocks: (blocks: BlockInstance[]) => void;
  updateAssets: (assets: ProjectAsset[]) => void;
  saveSprite: (asset: ProjectAsset) => void;
  /** Đổi tên thành phần ở Designer → tự cập nhật mọi khối đang trỏ tên cũ */
  renameComponent: (oldName: string, newName: string) => void;
  /** Cài tiện ích .mvxp vào dự án hiện tại (khối mới xuất hiện trong palette Blocks) */
  addExtension: (ext: VXPExtension) => void;
  /** Gỡ tiện ích + xóa các khối của nó trên bảng Blocks */
  removeExtension: (id: string) => void;
  syncFromBlocks: () => void;
  /** Build .VXP: tổng hợp Design + Blocks → Lua → gói .VXP (như Kodular) */
  buildVXP: () => Promise<void>;
  /** Xuất gói MRE thật: script.lua + LuaEngine.vxp (runtime nhúng Lua 5.1) + README */
  exportMREBundle: () => Promise<void>;
  /** Build LuaEngine.vxp ngay trong app desktop bằng TinyMRESDK. Trả true nếu build thành công. */
  buildMREVxp: (silent?: boolean) => Promise<boolean>;
  downloadProjectZip: () => Promise<void>;
  restoreFromBackup: (restored: VXPProject) => void;
  /** Mở giả lập trong CỬA SỔ RIÊNG (Tauri native window / popup trong trình duyệt) */
  openEmulatorWindow: () => Promise<void>;
  setIsCompiling: (value: boolean) => void;
}

/** Nội dung README đi kèm gói MRE — hướng dẫn cài lên MREmu / Nokia S30+ */
function mreBundleReadme(projectName: string, runtimeAttached: boolean): string {
  return `LuaEngine MRE bundle — ${projectName}
==============================================

Gói này chứa:
- script.lua            Mã Lua của dự án (runtime đọc + thực thi bằng luaL_dostring)
- LuaEngine.vxp         Runtime MRE nhúng Lua 5.1${runtimeAttached ? '' : '  (CHƯA CÓ — chạy "pnpm mre:build" để tạo)'}
- project.json          Dự án gốc để mở lại trong studio

NGUYÊN LÝ HOẠT ĐỘNG TRÊN MRE
1. Lua Core (C code): toàn bộ mã nguồn máy ảo Lua C thuần (Lua 5.1.5) được
   đưa vào dự án MRE (mre/lua-5.1.5).
2. MRE SDK biên dịch ra LuaEngine.vxp — đây là "Runtime Environment".
3. Khi khởi chạy trên điện thoại, runtime đọc script.lua (thẻ nhớ) và dùng
   luaL_dostring() để thực thi logic.

CHẠY TRÊN MREmu (giả lập PC)
  mkdir "%LOCALAPPDATA%\MREmu\fs\e\mod\LuaEngine"
  copy script.lua "%LOCALAPPDATA%\MREmu\fs\e\mod\LuaEngine\script.lua"
  D:\MRE\lua-engine\mre-core\emulator\MREmu.exe LuaEngine.vxp -l

CHẠY TRÊN MÁY THẬT (Nokia S30+)
1. Cài LuaEngine.vxp (bản đã ký cert — xem mre/README.md) lên máy.
2. Copy script.lua vào thẻ nhớ: \\mod\\LuaEngine\\script.lua
3. Mở LuaEngine trên máy — game chạy. Muốn đổi game: ghi đè script.lua.

LUA API (xem mre/README.md để biết đầy đủ)
  mre_draw_text / mre_fill_rect / mre_get_screen_size / mre_set_interval
  mre_vibrate / mre_log / mre_exit
  on_init() on_paint() on_frame() on_key(key, event)
`;
}

/** Khóa localStorage đánh dấu dự án đang mở — giả lập (cửa sổ riêng) đọc theo id này */
export const ACTIVE_PROJECT_KEY = 'vxp_creator_active_project';

function writeActiveProjectId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    /* ignore */
  }
}

export function readActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

/** Sinh mã Lua tự động từ Design + Blocks của dự án */
export function genLuaFor(project: VXPProject): string {
  return generateLuaFromProject(
    project.components || [],
    project.blocks || [],
    project.name || 'VXP App',
    project.entryScreen || DEFAULT_SCREEN_NAME,
    project.extensions || [],
    project.resolution
  );
}

/** Mã hiện có có phải là bản TỰ ĐỘNG sinh (do bộ sinh Design+Blocks tạo ra)?
    - rỗng hoặc khớp chính xác → tự động
    - có chữ ký bộ sinh trong header → tự động (kể cả bản sinh từ phiên bản cũ)
    - ngược lại → người dùng viết tay (giữ nguyên, không tự ghi đè) */
function isAutoGeneratedCode(project: VXPProject, code: string): boolean {
  if (code === '') return true;
  if (code === genLuaFor(project)) return true;
  return code.includes(LUA_GEN_MARKER);
}

/** Cờ "người dùng đã viết tay mã này" — lưu riêng vì chữ ký bộ sinh trong header
    vẫn còn nguyên khi họ chỉ sửa phần thân. */
function handwrittenFlagKey(projectId: string): string {
  return `vxp_lua_handwritten_${projectId}`;
}

function writeHandwrittenFlag(projectId: string, handwritten: boolean): void {
  try {
    if (handwritten) localStorage.setItem(handwrittenFlagKey(projectId), '1');
    else localStorage.removeItem(handwrittenFlagKey(projectId));
  } catch {
    /* ignore */
  }
}

function readHandwrittenFlag(projectId: string): boolean {
  try {
    return localStorage.getItem(handwrittenFlagKey(projectId)) === '1';
  } catch {
    return false;
  }
}

/** Kiểm tra desktop sync (không cần import động) — giống isDesktop() */
function isDesktopSafe(): boolean {
  try { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; } catch { return false; }
}

/** Quyết định chế độ đồng bộ: mã có thuộc bộ sinh Design+Blocks không?
    (rỗng → chưa có mã → tự sinh; người từng viết tay → giữ nguyên) */
function resolveLuaAuto(project: VXPProject, code: string): boolean {
  if (code === '') return true;
  if (readHandwrittenFlag(project.id)) return false;
  return isAutoGeneratedCode(project, code);
}

function initialBackupLabel(): string | null {
  const existing = getStoredBackups();
  if (existing.length > 0) {
    return new Date(existing[0].timestamp).toLocaleTimeString('vi-VN');
  }
  return null;
}

function initial(): { projects: VXPProject[]; folders: ProjectFolder[]; project: VXPProject; luaCode: string; luaAuto: boolean; view: ViewMode; activeScreen: string } {
  const stored = getStoredProjects();
  const folders = getStoredFolders();
  const activeId = readActiveProjectId();
  const project = (stored.length > 0
    ? stored.find(p => p.id === activeId) || stored[0]
    : TEMPLATES.snake);
  const storedCode = project.customLuaCode || '';
  // Dự án visual chưa từng lưu mã → tự sinh ngay để giả lập/mã Lua nhất quán
  const luaCode = storedCode !== '' ? storedCode : genLuaFor(project);
  return {
    projects: stored,
    folders,
    view: 'projects' as ViewMode,
    project,
    luaCode,
    // Bản trống hoặc đang thuộc bộ sinh → tự đồng bộ; người dùng viết tay → giữ nguyên
    luaAuto: resolveLuaAuto(project, storedCode),
    activeScreen: readStoredActiveScreen(project)
  };
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function activeScreenKey(projectId: string): string {
  return `vxp_active_screen_${projectId}`;
}

function readStoredActiveScreen(project: VXPProject): string {
  try {
    const v = sessionStorage.getItem(activeScreenKey(project.id));
    if (v && getScreenList(project).some(s => s.name === v)) return v;
  } catch {
    /* ignore */
  }
  return project.entryScreen || DEFAULT_SCREEN_NAME;
}

function writeStoredActiveScreen(projectId: string, screen: string): void {
  try {
    sessionStorage.setItem(activeScreenKey(projectId), screen);
  } catch {
    /* ignore */
  }
}

/** Tạo numeric app ID từ string (MRE dùng số, không phải package name) */
function hashToAppId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Đảm bảo số dương trong khoảng MRE (0 - 65535)
  return Math.abs(hash) % 65536 || 67502;
}


export const useAppStore = create<AppStore>((set, get) => {
  const init = initial();

  const persistActive = (updated: VXPProject, code: string = get().luaCode) => {
    set({ project: updated });
    const updatedList = saveSingleProject({ ...updated, customLuaCode: code });
    set({ projects: updatedList });
  };

  const recordBackup = (backup: ReturnType<typeof createAutoBackup>) => {
    if (!backup) return;
    const label = new Date(backup.timestampMs || Date.now()).toLocaleTimeString('vi-VN');
    set({ lastBackupTime: label });
  };

  /* ---- TỰ ĐỒNG BỘ mã Lua theo Design/Blocks (chỉ khi luaAuto = đang xài bản sinh).
     Gộp nhiều thao tác (kéo thả, gõ thuộc tính) trong ~0.6s rồi mới sinh lại + ghi
     localStorage → cửa sổ Giả lập bắt sự kiện storage và chạy mã mới ngay. ---- */
  let visualSyncTimer: ReturnType<typeof setTimeout> | null = null;
  const syncVisualNow = () => {
    const { project, luaAuto } = get();
    if (!luaAuto) return false;
    const generated = genLuaFor(project);
    set({ luaCode: generated });
    persistActive(project, generated);
    return true;
  };
  const scheduleVisualSync = () => {
    if (visualSyncTimer) clearTimeout(visualSyncTimer);
    visualSyncTimer = setTimeout(() => {
      visualSyncTimer = null;
      if (syncVisualNow()) {
        debugLogger.info('Sync', 'Tự đồng bộ mã Lua theo Design/Blocks (chạy trong Giả lập)');
      }
    }, 600);
  };

  // Chuyển màn hình thiết kế + ghi nhớ lựa chọn để lần mở sau giữ nguyên
  const goToScreen = (screen: string) => {
    writeStoredActiveScreen(get().project.id, screen);
    set({ activeScreen: screen, selectedComponentId: null });
  };

  return {
    ...init,
    selectedComponentId: null,
    isCompiling: false,
    isBuildingMre: false,
    toast: null,
    lastBackupTime: initialBackupLabel(),

    notify: (msg, ms = 3000) => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: msg });
      toastTimer = setTimeout(() => set({ toast: null }), ms);
    },

    autoBackupTick: () => {
      const project = get().project;
      if (!project || !project.id) return;
      const backup = createAutoBackup(project, 'interval', 'Định kỳ 5 phút');
      if (backup) {
        recordBackup(backup);
        debugLogger.info('AutoBackup', `Tự động lưu bản sao lưu định kỳ 5 phút (${get().lastBackupTime})`);
      }
    },

    setView: (view) => {
      const { project, luaCode } = get();
      if (view === 'projects') {
        const updatedList = saveSingleProject({ ...project, customLuaCode: luaCode });
        set({ projects: updatedList });
      }
      set({ view });
    },

    selectProject: (p) => {
      writeActiveProjectId(p.id);
      const code = p.customLuaCode || '';
      set({
        project: p,
        luaCode: code !== '' ? code : genLuaFor(p),
        luaAuto: resolveLuaAuto(p, code),
        view: 'designer',
        activeScreen: readStoredActiveScreen(p),
        selectedComponentId: null
      });
    },

    createProject: (newProj) => {
      const updated = [newProj, ...get().projects];
      saveStoredProjects(updated);
      writeActiveProjectId(newProj.id);
      const code = newProj.customLuaCode || '';
      set({
        projects: updated,
        project: newProj,
        luaCode: code !== '' ? code : genLuaFor(newProj),
        luaAuto: resolveLuaAuto(newProj, code),
        view: 'designer',
        activeScreen: newProj.entryScreen || DEFAULT_SCREEN_NAME,
        selectedComponentId: null
      });
      // Workspace trên đĩa (desktop): tạo <root>/<slug>/ với assets/ config/
      // extensions/ src/ build/ + project.json + src/main.lua + ảnh assets
      if (isDesktopSafe()) {
        (async () => {
          try {
            const { workspaceEnsure, workspaceWriteText, workspaceWriteBytes } = await import('../utils/desktop');
            const { projectDirOf } = await import('../utils/projectConfig');
            const dir = await workspaceEnsure(newProj.storagePath || workspaceRoot(), newProj.name)
              || projectDirOf(newProj);
            if (dir) {
              debugLogger.info('Workspace', `Đã tạo cấu trúc workspace: ${dir} (assets/ config/ extensions/ src/ build/)`);
              await workspaceWriteText(`${dir}/config/project.json`, JSON.stringify(newProj, null, 2));
              await workspaceWriteText(`${dir}/src/main.lua`, code);
              await workspaceWriteText(`${dir}/src/README.md`, `# ${newProj.name}

Mã nguồn Lua sinh từ Designer & Blocks trong studio.
`);
              for (const asset of newProj.assets || []) {
                if (asset.type === 'image' && asset.data.startsWith('data:')) {
                  const b64 = asset.data.split(',')[1];
                  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                  await workspaceWriteBytes(`${dir}/assets/${asset.name}`, bytes);
                }
              }
            }
          } catch (e) {
            console.error('Workspace create failed:', e);
          }
        })();
      }
    },

    updateProjectsList: (list) => {
      set({ projects: list });
      saveStoredProjects(list);
    },

    selectTemplate: (key) => {
      const tmpl = TEMPLATES[key];
      if (!tmpl) return;
      const current = get().project;
      const updated: VXPProject = {
        ...current,
        components: [...tmpl.components],
        blocks: [...tmpl.blocks],
        assets: [...tmpl.assets],
        customLuaCode: tmpl.customLuaCode,
        resolution: tmpl.resolution
      };
      writeHandwrittenFlag(current.id, false);
      set({ project: updated, luaCode: tmpl.customLuaCode, luaAuto: resolveLuaAuto(updated, tmpl.customLuaCode), selectedComponentId: null });
      persistActive(updated, tmpl.customLuaCode);
    },

    persistActiveProject: persistActive,

    /** Ghi mã Lua từ bàn phím (Mã Lua). Nội dung khác bản bộ sinh → đánh dấu
        VIẾT TAY để Designer/Blocks không tự ghi đè (kể cả khi giữ chữ ký header). */
    persistLuaCode: (code) => {
      const { project } = get();
      const auto = code === '' || code === genLuaFor(project);
      set({ luaCode: code, luaAuto: auto });
      writeHandwrittenFlag(project.id, !auto);
      persistActive(project, code);
    },

    selectComponent: (id) => set({ selectedComponentId: id }),

    setActiveScreen: (screen) => goToScreen(screen),

    addScreen: (rawName) => {
      const name = (rawName || '').trim().replace(/\s+/g, '');
      const project = get().project;
      if (!name) {
        get().notify('Tên màn hình không hợp lệ');
        return;
      }
      const list = getScreenList(project);
      if (list.some(s => s.name === name)) {
        get().notify(`Màn hình "${name}" đã tồn tại`);
        return;
      }
      // Màn hình mới LUÔN TRỐNG: chỉ có bộ thuộc tính mặc định, không copy thành phần nào
      const screens: typeof list = [
        ...list.map(s => ({ ...s, properties: { ...s.properties } })),
        { name, properties: { ...DEFAULT_SCREEN_PROPS, title: name, aboutScreen: '' } }
      ];
      const updated = { ...project, screens };
      persistActive(updated);
      goToScreen(name);
      scheduleVisualSync();
      const backup = createAutoBackup(updated, 'structural_change', `Tạo màn hình mới "${name}"`);
      recordBackup(backup);
      debugLogger.info('Designer', `Đã tạo màn hình mới (trống): ${name}`);
    },

    copyScreen: (source) => {
      const project = get().project;
      const list = getScreenList(project);
      const srcMeta = list.find(s => s.name === source);
      if (!srcMeta) return;

      // Tên bản sao không trùng: Ten_copy, Ten_copy2, …
      let newName = `${source}_copy`;
      let n = 2;
      while (list.some(s => s.name === newName)) newName = `${source}_copy${n++}`;

      // Sao chép thành phần của màn hình nguồn — cấp id MỚI để không trùng khối/Designer
      const srcComps = project.components.filter(c => compScreen(c) === source);
      const idMap = new Map<string, string>();
      const stamp = Date.now().toString(36);
      const cloned = srcComps.map((c, i) => {
        const newId = `${c.id}_c${stamp}${i}`;
        idMap.set(c.id, newId);
        return { ...c, id: newId, screen: newName, properties: { ...c.properties } };
      });
      // Nối lại quan hệ cha/con theo id mới
      for (const c of cloned) {
        if (c.children?.length) c.children = c.children.map(old => idMap.get(old) ?? old);
        if (c.parentId) c.parentId = idMap.get(c.parentId) ?? c.parentId;
      }

      // Sao chép BLOCKS của màn nguồn — cấp id mới + mapping mọi mối nối
      const srcBlocks = project.blocks.filter(b => (b.screen ?? project.entryScreen ?? 'Screen1') === source);
      const blkIdMap = new Map<string, string>();
      const clonedBlocks = srcBlocks.map(b => {
        const nb = `${b.id}_c${stamp}`;
        blkIdMap.set(b.id, nb);
        return { ...b, id: nb, screen: newName };
      });
      for (const b of clonedBlocks) {
        if (b.nextBlockId) b.nextBlockId = blkIdMap.get(b.nextBlockId) ?? undefined;
        if (b.inputConnections) for (const k of Object.keys(b.inputConnections)) b.inputConnections[k] = blkIdMap.get(b.inputConnections[k]) ?? undefined;
        if (b.childBlocks) for (const k of Object.keys(b.childBlocks)) b.childBlocks[k] = blkIdMap.get(b.childBlocks[k]) ?? undefined;
      }

      const screens: typeof list = [
        ...list.map(s => ({ ...s, properties: { ...s.properties } })),
        { name: newName, properties: { ...srcMeta.properties, title: newName } }
      ];
      const updated = { ...project, screens, components: [...project.components, ...cloned], blocks: [...project.blocks, ...clonedBlocks] };
      persistActive(updated);
      goToScreen(newName);
      scheduleVisualSync();
      const backup = createAutoBackup(updated, 'structural_change', `Sao chép màn hình ${source} → ${newName}`);
      recordBackup(backup);
      get().notify(`Đã sao chép "${source}" → "${newName}" (${cloned.length} thành phần)`);
      debugLogger.info('Designer', `Đã sao chép màn hình: ${source} → ${newName} (${cloned.length} thành phần)`);
    },

    renameScreen: (oldName, rawNew) => {
      const newName = (rawNew || '').trim().replace(/\s+/g, '');
      const project = get().project;
      const list = getScreenList(project);
      if (!newName || newName === oldName || !list.some(s => s.name === oldName) || list.some(s => s.name === newName)) {
        if (list.some(s => s.name === newName)) get().notify(`Màn hình "${newName}" đã tồn tại`);
        return;
      }
      const screens = list.map(s => (s.name === oldName ? { ...s, name: newName, properties: { ...s.properties, title: s.properties.title === oldName ? newName : s.properties.title } } : s));
      const components = project.components.map(c => (compScreen(c) === oldName ? { ...c, screen: newName } : c));
      const entryScreen = project.entryScreen === oldName ? newName : project.entryScreen;
      const updated = { ...project, screens, components, entryScreen };
      persistActive(updated);
      set(state => {
        if (state.activeScreen === oldName) goToScreen(newName);
        return { project: updated };
      });
      scheduleVisualSync();
      const backup = createAutoBackup(updated, 'structural_change', `Đổi tên màn hình ${oldName} → ${newName}`);
      recordBackup(backup);
      debugLogger.info('Designer', `Đổi tên màn hình: ${oldName} → ${newName}`);
    },

    deleteScreen: (name) => {
      const project = get().project;
      const list = getScreenList(project);
      if (list.length <= 1) {
        get().notify('Không thể xóa màn hình duy nhất của dự án');
        return;
      }
      if (!list.some(s => s.name === name)) return;
      const screens = list.filter(s => s.name !== name);
      const components = project.components.filter(c => compScreen(c) !== name);
      // Xóa cả blocks thuộc màn hình bị xóa
      const blocks = project.blocks.filter(b => (b.screen ?? project.entryScreen ?? 'Screen1') !== name);
      const entryScreen = project.entryScreen === name ? screens[0].name : project.entryScreen;
      const updated = { ...project, screens, components, blocks, entryScreen };
      persistActive(updated);
      set(state => {
        if (state.activeScreen === name) goToScreen(screens[0]?.name || DEFAULT_SCREEN_NAME);
        return {
          project: updated,
          selectedComponentId: state.activeScreen === name ? null : state.selectedComponentId
        };
      });
      scheduleVisualSync();
      const backup = createAutoBackup(updated, 'structural_change', `Xóa màn hình "${name}"`);
      recordBackup(backup);
      debugLogger.info('Designer', `Đã xóa màn hình: ${name}`);
    },

    setEntryScreen: (name) => {
      const project = get().project;
      const list = getScreenList(project);
      if (!list.some(s => s.name === name)) return;
      const updated = { ...project, entryScreen: name };
      persistActive(updated);
      set({ project: updated });
      scheduleVisualSync();
      get().notify(`Màn hình chính giờ là "${name}" — màn hình này sẽ được đóng gói vào .vxp`);
    },

    updateScreenProps: (screen, patch) => {
      const project = get().project;
      const list = getScreenList(project);
      const screens = list.map(s => (s.name === screen ? { ...s, properties: { ...s.properties, ...patch } } : s));
      const updated = { ...project, screens };
      persistActive(updated);
      set({ project: updated });
      scheduleVisualSync();
    },

    updateScreenComponents: (screen, components) => {
      const prev = get().project;
      const prevScreenCount = prev.components.filter(c => compScreen(c) === screen).length;
      const isStructuralChange = components.length !== prevScreenCount;
      // Thay thế thành phần của đúng màn hình này, giữ nguyên thứ tự & các màn hình khác
      const merged: UIComponent[] = [];
      let replaced = false;
      for (const c of prev.components) {
        if (compScreen(c) === screen) {
          if (!replaced) {
            merged.push(...components.map(cc => ({ ...cc, screen })));
            replaced = true;
          }
        } else {
          merged.push(c);
        }
      }
      if (!replaced) merged.push(...components.map(cc => ({ ...cc, screen })));
      const updated = { ...prev, components: merged };
      persistActive(updated);
      scheduleVisualSync();
      if (isStructuralChange) {
        const backup = createAutoBackup(updated, 'structural_change', `Thay đổi số lượng thành phần màn hình ${screen} (${components.length})`);
        recordBackup(backup);
        debugLogger.info('AutoBackup', `Màn hình ${screen}: thay đổi linh kiện → ${components.length}`);
      }
    },

    updateBlocks: (blocks) => {
      // blocks truyền vào là các khối CỦA MÀN ĐANG CHỌN — ghép lại với khối các màn khác
      const prev = get().project;
      const cur = get().activeScreen || prev.entryScreen || 'Screen1';
      const merged = [
        ...prev.blocks.filter(b => (b.screen ?? prev.entryScreen ?? 'Screen1') !== cur),
        ...blocks.map(b => ({ ...b, screen: cur })),
      ];
      const isStructuralChange = merged.length !== prev.blocks.length;
      const updated = { ...prev, blocks: merged };
      persistActive(updated);
      scheduleVisualSync();
      if (isStructuralChange) {
        const backup = createAutoBackup(updated, 'structural_change', `Thay đổi cấu trúc khối lệnh (${merged.length})`);
        recordBackup(backup);
        debugLogger.info('AutoBackup', `Tự động lưu do thay đổi khối lệnh: ${merged.length}`);
      }
    },

    updateAssets: (assets) => {
      const updated = { ...get().project, assets };
      persistActive(updated);
      scheduleVisualSync();
    },

    renameComponent: (oldName, newName) => {
      if (!oldName || !newName || oldName === newName) return;
      const project = get().project;
      const defs = [...BLOCK_DEFINITIONS, ...extensionBlockDefs(project.extensions || [])];
      const blocks = renameComponentRefsInBlocks(project.blocks, defs, oldName, newName);
      if (blocks === project.blocks) return;
      const updated = { ...project, blocks };
      persistActive(updated);
      set({ project: updated });
      scheduleVisualSync();
      get().notify(`Đã cập nhật khối lệnh: "${oldName}" → "${newName}"`);
      debugLogger.info('Blocks', `Đổi tên thành phần: ${oldName} → ${newName} — đã đồng bộ các khối đang trỏ tới`);
    },

    addExtension: (ext) => {
      const project = get().project;
      const existing = project.extensions || [];
      if (existing.some(e => e.id === ext.id)) {
        get().notify(`Tiện ích "${ext.name}" đã được cài rồi`);
        return;
      }
      const updated = { ...project, extensions: [...existing, ext] };
      persistActive(updated);
      set({ project: updated });
      scheduleVisualSync();
      get().notify(`Đã cài tiện ích "${ext.name}" — ${ext.blocks.length} khối mới trong palette Blocks`, 4000);
      debugLogger.info('Extensions', `Cài tiện ích .mvxp: ${ext.name} v${ext.version} (${ext.blocks.length} khối)`);
      const backup = createAutoBackup(updated, 'structural_change', `Cài tiện ích ${ext.name}`);
      recordBackup(backup);
    },

    removeExtension: (id) => {
      const project = get().project;
      const ext = (project.extensions || []).find(e => e.id === id);
      if (!ext) return;
      const prefix = `ext_${id}_`;
      const removedBlocks = project.blocks.filter(b => b.defId.startsWith(prefix));
      const blocks = project.blocks.filter(b => !b.defId.startsWith(prefix));
      const updated = { ...project, extensions: (project.extensions || []).filter(e => e.id !== id), blocks };
      persistActive(updated);
      set({ project: updated });
      scheduleVisualSync();
      get().notify(
        removedBlocks.length
          ? `Đã gỡ tiện ích "${ext.name}" và ${removedBlocks.length} khối của nó trên bảng`
          : `Đã gỡ tiện ích "${ext.name}"`
      );
      debugLogger.info('Extensions', `Gỡ tiện ích .mvxp: ${ext.name} (xóa ${removedBlocks.length} khối)`);
    },

    saveSprite: (newAsset) => {
      const existing = get().project.assets.filter(a => a.name !== newAsset.name);
      const updated = { ...get().project, assets: [...existing, newAsset] };
      persistActive(updated);
      scheduleVisualSync();
    },

    syncFromBlocks: () => {
      const { project } = get();
      const generated = generateLuaFromProject(
        project.components,
        project.blocks,
        project.name,
        project.entryScreen || DEFAULT_SCREEN_NAME,
        project.extensions || [],
        project.resolution
      );
      set({ luaCode: generated, luaAuto: true });
      writeHandwrittenFlag(project.id, false);
      persistActive(project, generated);
      get().notify('Đã đồng bộ mã Lua từ các khối lệnh và màn hình Designer!');
      const backup = createAutoBackup(project, 'structural_change', 'Đồng bộ mã Lua từ Blocks');
      recordBackup(backup);
      debugLogger.info('AutoBackup', 'Đồng bộ mã Lua từ Blocks');
    },

    buildVXP: async () => {
      const { project, luaCode, luaAuto } = get();
      try {
        set({ isCompiling: true });
        debugLogger.compiler('Bắt đầu build .VXP — biên dịch Lua (luac) + đóng gói script vào .vxp (PackApp)');

        // 1. Mã Lua cho build: nếu luaAuto → sinh từ Design+Blocks; nếu viết tay → giữ nguyên
        const buildCode = luaAuto ? genLuaFor(project) : luaCode;
        if (luaAuto) {
          set({ luaCode: buildCode });
        }

        const { isDesktop, buildProjectVxpDesktop } = await import('../utils/desktop');
        const { ramKbOf, projectDirOf } = await import('../utils/projectConfig');

        if (isDesktop()) {
          // 2. Desktop — build .vxp THẬT (không xuất/tải file):
          //    Lua → script.lub → nhúng resource → PackApp → <build>/<slug>.vxp
          const buildDir = `${projectDirOf(project) || project.id}/build`;
          const appIdHash = hashToAppId(project.packageName || project.name);
          const res = await buildProjectVxpDesktop(
            buildCode,
            project.name,
            buildDir,
            appIdHash,
            ramKbOf(project)
          );

          if (res && res.ok) {
            debugLogger.compiler(`Build .VXP thành công: ${res.vxpPath} (${res.vxpBytes} bytes)`, 'success');
            get().notify(`Đã đóng gói ${project.name}.vxp (${Math.round(res.vxpBytes / 1024)} KB) vào build/ — copy vào MREmu để chạy`, 5000);
          } else {
            const why = res ? res.output.slice(-300) : 'MRE toolchain không khả dụng';
            console.error('[build_vxp] log:\n' + why);
            debugLogger.error('Build', `Build .vxp thất bại: ${why}`);
            get().notify('Build .vxp thất bại — bấm F12 xem log (thiếu LuaEngineTemplate.axf / luac / PackApp?)', 6000);
          }
        } else {
          // 3. Trình duyệt không có luac/PackApp — hướng dẫn chạy bản desktop
          get().notify('Build .vxp cần bản desktop (Tauri) để chạy luac + PackApp — dùng "pnpm desktop:dev"', 5000);
          debugLogger.warn('Build', 'Build .vxp chỉ khả dụng trong app desktop (cần luac.exe + PackApp.exe)');
        }
      } catch (err) {
        console.error('Lỗi build .VXP:', err);
        debugLogger.error('Build', `Lỗi build .VXP: ${err}`);
        get().notify('Build .VXP thất bại — vui lòng thử lại', 5000);
      } finally {
        set({ isCompiling: false });
      }
    },

    exportMREBundle: async () => {
      const { project, luaCode } = get();
      try {
        set({ isCompiling: true });
        const zip = new JSZip();
        const safe = project.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Desktop: build runtime MỚI bằng TinyMRESDK trước khi đóng gói —
        // gói MRE luôn kèm LuaEngine.vxp vừa build, không dùng file tĩnh cũ.
        let freshlyBuilt = false;
        const { isDesktop } = await import('../utils/desktop');
        if (isDesktop()) {
          freshlyBuilt = await get().buildMREVxp(true);
        }

        // script.lua — runtime LuaEngine đọc file này từ thẻ nhớ khi chạy
        zip.file('script.lua', luaCode);
        zip.file('project.json', JSON.stringify(project, null, 2));

        // Đính kèm LuaEngine.vxp (runtime nhúng Lua 5.1 — bản mới build hoặc bản tĩnh sẵn có)
        let runtimeAttached = false;
        try {
          const res = await fetch(`/mre/LuaEngine.vxp?t=${Date.now()}`);
          if (res.ok) {
            zip.file('LuaEngine.vxp', await res.arrayBuffer());
            runtimeAttached = true;
          }
        } catch {
          /* chưa build runtime — vẫn xuất script */
        }

        zip.file('README_MRE.txt', mreBundleReadme(project.name, runtimeAttached));
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const fileName = `${safe}_mre_bundle.zip`;
        // Workspace trên đĩa (desktop): ghi thẳng vào <thư mục dự án>/build/ như engine làm game
        const { saveBuildBytesToWorkspace } = await import('../utils/desktop');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const saved = isDesktop() ? await saveBuildBytesToWorkspace(project, fileName, bytes) : false;
        if (!saved) await downloadBlob(blob, fileName);
        get().notify(
          saved
            ? runtimeAttached
              ? `Đã build LuaEngine.vxp và xuất gói MRE vào build/ — chạy được trên MREmu/máy S30+`
              : `Đã xuất gói MRE vào build/ (LuaEngine.vxp + script.lua)`
            : runtimeAttached
              ? freshlyBuilt
                ? `Đã build LuaEngine.vxp (TinyMRESDK) và tải xuống gói MRE — chạy được trên MREmu/máy S30+`
                : `Đã tải xuống gói MRE: LuaEngine.vxp + script.lua (chạy được trên MREmu/máy S30+)`
              : 'Đã tải xuống gói MRE (script.lua). Chưa có LuaEngine.vxp — chạy pnpm mre:build trước',
          4500
        );
      } catch (err) {
        console.error('Lỗi khi xuất gói MRE:', err);
        alert('Không thể xuất gói MRE. Vui lòng thử lại.');
      } finally {
        set({ isCompiling: false });
      }
    },

    buildMREVxp: async (silent = false) => {
      const { buildMREVxpDesktop } = await import('../utils/desktop');
      set({ isBuildingMre: true });
      try {
        const res = await buildMREVxpDesktop();
        if (!res) {
          if (!silent) get().notify('Build VXP chạy trong app desktop (Tauri). Trên web: dùng pnpm mre:build', 4500);
          return false;
        }
        if (res.ok) {
          debugLogger.info('MRE', `Build LuaEngine.vxp thành công (${Math.round(res.vxpBytes / 1024)} KB) — TinyMRESDK, đã đồng bộ dist + public/mre`);
          if (!silent) {
            get().notify(`Đã build LuaEngine.vxp bằng TinyMRESDK (${Math.round(res.vxpBytes / 1024)} KB) — sẵn sàng cho Xuất gói MRE`, 4500);
          }
          return true;
        }
        console.error('[build_vxp] log:\n' + res.output);
        debugLogger.error('MRE', 'Build LuaEngine.vxp thất bại — xem console');
        if (!silent) get().notify('Build VXP thất bại — bấm F12 xem log chi tiết (console)', 6000);
        return false;
      } catch (err) {
        console.error('Lỗi build VXP:', err);
        if (!silent) get().notify('Build VXP lỗi — xem console', 4000);
        return false;
      } finally {
        set({ isBuildingMre: false });
      }
    },

    downloadProjectZip: async () => {
      const { project, luaCode } = get();
      try {
        const zip = new JSZip();
        const { dimsOf, ramKbOf } = await import('../utils/projectConfig');
        const dims = dimsOf(project.resolution);
        zip.file('main.lua', luaCode);
        zip.file('project.json', JSON.stringify(project, null, 2));
        zip.file('mre.inf', `[MRE Application]\nName=${project.name}\nVersion=${project.version}\nPackage=${project.packageName}\nResolution=${project.resolution}\nHeapSize=${ramKbOf(project) * 1024}\n`);
        zip.file('app.cfg', `[CONFIG]\napp_id=${project.packageName}\napp_name=${project.name}\napp_entry=main.lua\nscreen_w=${dims.w}\nscreen_h=${dims.h}\n`);
        const assetsFolder = zip.folder('assets');
        if (assetsFolder) {
          for (const asset of project.assets) {
            assetsFolder.file(asset.name, asset.data);
          }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const fileName = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_project.zip`;
        // Workspace trên đĩa (desktop): ghi thẳng vào <thư mục dự án>/ như engine làm game
        const { isDesktop, saveBuildBytesToWorkspace } = await import('../utils/desktop');
        const bytes = new Uint8Array(await zipBlob.arrayBuffer());
        const saved = isDesktop() ? await saveBuildBytesToWorkspace(project, fileName, bytes) : false;
        if (!saved) await downloadBlob(zipBlob, fileName);
      } catch (e) {
        console.error('Lỗi khi tải project zip:', e);
      }
    },

    restoreFromBackup: (restored) => {
      const code = restored.customLuaCode || '';
      set({
        project: restored,
        luaCode: code,
        luaAuto: resolveLuaAuto(restored, code),
        activeScreen: restored.entryScreen || DEFAULT_SCREEN_NAME,
        selectedComponentId: null
      });
      persistActive(restored, code);
      get().notify(`Đã khôi phục thành công dự án "${restored.name}"!`, 3500);
    },

    openEmulatorWindow: async () => {
      // Đẩy nốt thay đổi Design/Blocks đang chờ (debounce) trước khi mở cửa sổ giả lập
      if (visualSyncTimer) {
        clearTimeout(visualSyncTimer);
        visualSyncTimer = null;
        syncVisualNow();
      }
      const { openEmulatorWindow: openWindow } = await import('../utils/desktop');
      const result = await openWindow();
      if (result === 'failed') {
        get().notify('Không mở được cửa sổ Live Testing — hãy cho phép cửa sổ bật lên (popup)', 4500);
      } else {
        debugLogger.info('LiveTesting', 'Đã mở cửa sổ Live Testing riêng (không chiếm giao diện studio)');
      }
    },

    setIsCompiling: (value) => set({ isCompiling: value })
  };
});
