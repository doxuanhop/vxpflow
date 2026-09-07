import { VXPProject, ProjectFolder, ScreenResolution } from '../types';
import { TEMPLATES } from '../data/templates';
import { defaultPackageOf, DEFAULT_RAM_KB, orientationOf } from './projectConfig';
import { debugLogger } from './debugLogger';

const STORAGE_KEY = 'vxp_creator_projects';
const FOLDERS_KEY = 'vxp_creator_folders';
const BACKUPS_KEY = 'vxp_creator_auto_backups';
const MAX_BACKUPS = 15;

export interface ProjectBackupSnapshot {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  timestampMs: number;
  reason: 'interval' | 'structural_change' | 'manual';
  reasonLabel: string;
  componentCount: number;
  blockCount: number;
  /** Số tiện ích mở rộng .mvxp trong bản backup (data.extensions) */
  extensionCount: number;
  data: VXPProject;
}

export function formatDateTime(date: Date = new Date()): string {
  // Format VXP image: "Jun 16, 2024, 7:06:58 AM"
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

export function getStoredProjects(): VXPProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return []; // Default is empty as requested!
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.error('Error loading stored projects:', e);
    return [];
  }
}

export function saveStoredProjects(projects: VXPProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Error saving stored projects:', e);
  }
}

export function saveSingleProject(project: VXPProject): VXPProject[] {
  const all = getStoredProjects();
  const now = formatDateTime();
  const updatedProject = {
    ...project,
    modifiedAt: now,
    createdAt: project.createdAt || now
  };

  const index = all.findIndex(p => p.id === project.id);
  let updatedList: VXPProject[];
  if (index >= 0) {
    updatedList = [...all];
    updatedList[index] = updatedProject;
  } else {
    updatedList = [updatedProject, ...all];
  }

  saveStoredProjects(updatedList);
  return updatedList;
}

export function deleteStoredProject(id: string): VXPProject[] {
  const all = getStoredProjects();
  const filtered = all.filter(p => p.id !== id);
  saveStoredProjects(filtered);
  return filtered;
}

export function duplicateStoredProject(id: string, newName?: string): { list: VXPProject[]; newProject: VXPProject | null } {
  const all = getStoredProjects();
  const target = all.find(p => p.id === id);
  if (!target) return { list: all, newProject: null };

  const now = formatDateTime();
  const copyName = newName || `${target.name}_Copy`;
  const newProject: VXPProject = {
    ...target,
    id: `project_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: copyName,
    packageName: `com.vxp.${copyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    storagePath: undefined, // bản sao không dùng chung thư mục đĩa với bản gốc
    createdAt: now,
    modifiedAt: now
  };

  const updated = [newProject, ...all];
  saveStoredProjects(updated);
  return { list: updated, newProject };
}

export function getStoredFolders(): ProjectFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredFolders(folders: ProjectFolder[]): void {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch (e) {
    console.error('Error saving folders:', e);
  }
}

export interface CreateProjectOptions {
  resolution?: ScreenResolution;
  templateKey?: string;
  /** App ID / packageName — mặc định com.vxp.<slug tên> */
  packageName?: string;
  orientation?: 'portrait' | 'landscape';
  /** RAM heap KB — mặc định 4096 KB (4 MB, tối ưu S30+) */
  ramKb?: number;
  /** Thư mục cha trên đĩa (workspace desktop) — project được tạo ở <path>/<slug>/ */
  storagePath?: string;
}

/**
 * Tạo dự án mới (trống hoặc từ template). Các tùy chọn App ID / RAM / hướng
 * màn hình / vị trí lưu trữ được ghi thẳng vào project từ hộp thoại tạo dự án.
 */
export function createBlankProject(
  name: string,
  opts: CreateProjectOptions = {}
): VXPProject {
  const now = formatDateTime();
  const cleanId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const resolution = opts.resolution ?? '240x320';
  const packageName = (opts.packageName || '').trim() || defaultPackageOf(name);
  const ramKb = opts.ramKb ?? DEFAULT_RAM_KB;
  const orientation = opts.orientation ?? orientationOf(resolution);
  const baseMeta = {
    packageName,
    resolution,
    orientation,
    ramKb,
    storagePath: opts.storagePath || undefined
  };

  if (opts.templateKey && TEMPLATES[opts.templateKey]) {
    const base = TEMPLATES[opts.templateKey];
    return {
      ...base,
      id: cleanId,
      name,
      ...baseMeta,
      createdAt: now,
      modifiedAt: now
    };
  }

  // Pure blank project
  return {
    id: cleanId,
    name,
    ...baseMeta,
    version: '1.0.0',
    author: 'VXPFlow User',
    description: `Ứng dụng ${name} cho Nokia S30+`,
    targetDevice: 's30plus',
    components: [
      {
        id: 'comp_title',
        name: 'Label_Title',
        type: 'Label',
        x: 20,
        y: 40,
        width: 200,
        height: 30,
        properties: {
          Text: name,
          FontSize: 16,
          TextColor: '#FFFFFF',
          Visible: true
        }
      },
      {
        id: 'comp_btn',
        name: 'Button_Click',
        type: 'Button',
        x: 40,
        y: 120,
        width: 160,
        height: 40,
        properties: {
          Text: 'Bấm vào đây!',
          FontSize: 14,
          TextColor: '#FFFFFF',
          BackgroundColor: '#4F46E5',
          Visible: true
        }
      }
    ],
    blocks: [
      {
        id: 'blk_init',
        defId: 'event_screen_init',
        category: 'events',
        x: 40,
        y: 40,
        fields: {},
        inputConnections: {},
        nextBlockId: 'blk_toast'
      },
      {
        id: 'blk_toast',
        defId: 'system_toast',
        category: 'system',
        x: 40,
        y: 100,
        fields: {
          message: `Chào mừng bạn đến với ${name}!`
        },
        inputConnections: {}
      }
    ],
    customLuaCode: '',
    assets: [],
    entryScreen: 'Screen1',
    useVisualMode: true,
    createdAt: now,
    modifiedAt: now
  };
}

export function loadDefaultSampleProjects(): VXPProject[] {
  const now = formatDateTime();
  const snakeProj: VXPProject = {
    ...TEMPLATES.snake,
    id: 'proj_sample_snake',
    createdAt: 'Jun 16, 2024, 7:06:58 AM',
    modifiedAt: 'Aug 22, 2026, 11:38:31 AM'
  };

  const shooterProj: VXPProject = {
    ...TEMPLATES.space_shooter,
    id: 'proj_sample_shooter',
    createdAt: 'Nov 30, 2021, 3:41:35 PM',
    modifiedAt: 'Mar 28, 2026, 3:10:24 PM'
  };

  const calcProj: VXPProject = {
    ...TEMPLATES.calculator,
    id: 'proj_sample_calc',
    createdAt: 'Mar 25, 2026, 10:34:56 PM',
    modifiedAt: 'Mar 25, 2026, 11:07:14 PM'
  };

  const runnerProj: VXPProject = {
    ...TEMPLATES.sample2d,
    id: 'proj_sample_2d',
    createdAt: now,
    modifiedAt: now
  };
  const list = [snakeProj, shooterProj, calcProj, runnerProj];
  saveStoredProjects(list);
  return list;
}

/**
 * Lấy danh sách các bản sao lưu dự án từ LocalStorage
 */
export function getStoredBackups(projectId?: string): ProjectBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (projectId) {
      return parsed.filter((b: ProjectBackupSnapshot) => b.projectId === projectId);
    }
    return parsed;
  } catch (e) {
    console.error('Error loading backups:', e);
    return [];
  }
}

/**
 * Tự động tạo bản sao lưu dự phòng vào LocalStorage
 */
export function createAutoBackup(
  project: VXPProject,
  reason: 'interval' | 'structural_change' | 'manual',
  reasonDetail?: string
): ProjectBackupSnapshot | null {
  try {
    if (!project || !project.id) return null;
    const now = formatDateTime();
    const reasonLabel = 
      reason === 'interval' ? (reasonDetail || 'Tự động định kỳ (5 phút)') :
      reason === 'structural_change' ? (reasonDetail || 'Thay đổi cấu trúc quan trọng') :
      (reasonDetail || 'Sao lưu thủ công');

    const snapshot: ProjectBackupSnapshot = {
      id: `backup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId: project.id,
      projectName: project.name,
      timestamp: now,
      timestampMs: Date.now(),
      reason,
      reasonLabel,
      componentCount: project.components ? project.components.length : 0,
      blockCount: project.blocks ? project.blocks.length : 0,
      extensionCount: project.extensions ? project.extensions.length : 0,
      data: JSON.parse(JSON.stringify(project))
    };

    const existingBackups = getStoredBackups();
    // Giới hạn số lượng bản sao lưu để tránh đầy LocalStorage
    const updated = [snapshot, ...existingBackups].slice(0, MAX_BACKUPS);
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(updated));

    debugLogger.info(
      'AutoBackup',
      `Đã tạo bản sao lưu dự phòng cho "${project.name}" (${reasonLabel})`,
      `${project.components?.length || 0} linh kiện, ${project.blocks?.length || 0} khối lệnh`
    );

    return snapshot;
  } catch (e) {
    console.error('Error creating auto backup:', e);
    debugLogger.error('AutoBackup', 'Không thể tạo bản sao lưu vào LocalStorage', String(e));
    return null;
  }
}

/**
 * Khôi phục dự án từ một bản sao lưu cụ thể
 */
export function restoreFromBackup(backupId: string): VXPProject | null {
  try {
    const backups = getStoredBackups();
    const target = backups.find(b => b.id === backupId);
    if (!target) return null;

    // Lưu lại vào danh sách dự án
    saveSingleProject(target.data);
    debugLogger.success('AutoBackup', `Đã khôi phục thành công dự án "${target.projectName}" từ bản sao lưu ${target.timestamp}`);
    return target.data;
  } catch (e) {
    console.error('Error restoring backup:', e);
    debugLogger.error('AutoBackup', 'Khôi phục bản sao lưu thất bại', String(e));
    return null;
  }
}

/**
 * Xóa một bản sao lưu
 */
export function deleteStoredBackup(backupId: string): void {
  try {
    const backups = getStoredBackups();
    const filtered = backups.filter(b => b.id !== backupId);
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting backup:', e);
  }
}

/**
 * Xóa toàn bộ bản sao lưu của một dự án hoặc tất cả
 */
export function clearStoredBackups(projectId?: string): void {
  try {
    if (projectId) {
      const backups = getStoredBackups();
      const remaining = backups.filter(b => b.projectId !== projectId);
      localStorage.setItem(BACKUPS_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(BACKUPS_KEY);
    }
    debugLogger.info('AutoBackup', 'Đã xóa lịch sử bản sao lưu LocalStorage');
  } catch (e) {
    console.error('Error clearing backups:', e);
  }
}

