import { ScreenResolution, VXPProject } from '../types';

/** Chiều dọc — mặc định cho S30+ */
export type ProjectOrientation = 'portrait' | 'landscape';

/** Slug an toàn cho tên dự án (dùng cho app id, tên thư mục, tên file) */
export function slugOf(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'app';
}

/** App ID mặc định (packageName) — chuẩn S30+: com.vxp.<tên> */
export function defaultPackageOf(name: string): string {
  return `com.vxp.${slugOf(name)}`;
}

/** Khổ màn hình khả dụng theo chiều */
export const RESOLUTIONS: Record<ProjectOrientation, { value: ScreenResolution; label: string; recommended?: boolean }[]> = {
  portrait: [
    { value: '240x320', label: '240×320 QVGA — Nokia S30+ standard (220, 225, 230, 3310 3G)', recommended: true },
    { value: '128x160', label: '128×160 — Classic/entry-level Nokia S30' },
    { value: '240x240', label: '240×240 — MRE square screen' },
    { value: '320x480', label: '320×480 HVGA — High-end/touch MRE devices' }
  ],
  landscape: [
    { value: '320x240', label: '320×240 Landscape — MRE widescreen', recommended: true }
  ]
};

export function resolutionLabel(res: ScreenResolution | undefined): string {
  if (!res) return '240x320';
  return `${res.slice(0, res.indexOf('x'))}×${res.slice(res.indexOf('x') + 1)}`;
}

/** Kích thước pixel thật từ chuỗi resolution 'WxH' */
export function dimsOf(resolution?: string): { w: number; h: number } {
  if (resolution) {
    const m = /^(\d+)x(\d+)$/.exec(resolution);
    if (m) return { w: Number(m[1]), h: Number(m[2]) };
  }
  return { w: 240, h: 320 };
}

/** Chiều mặc định: resolution 'WxH' với W < H là dọc, ngược lại là ngang */
export function orientationOf(resolution?: string): ProjectOrientation {
  const { w, h } = dimsOf(resolution);
  return w > h ? 'landscape' : 'portrait';
}

/** Tùy chọn RAM (heap) cho runtime — mặc định tối ưu S30+ là 4 MB */
export interface RamOption {
  kb: number;
  label: string;
  recommended?: boolean;
}

export const RAM_OPTIONS: RamOption[] = [
  { kb: 1024, label: '1 MB — Minimum heap' },
  { kb: 2048, label: '2 MB — Low RAM' },
  { kb: 4096, label: '4 MB — S30+ optimized', recommended: true },
  { kb: 8192, label: '8 MB — Graphics-heavy games' },
  { kb: 16384, label: '16 MB — High-RAM devices (320x480)' }
];

export const DEFAULT_RAM_KB = 4096;

/** Heap cũ (dự án tạo trước khi có tùy chọn RAM) — giữ nguyên 1 MB */
export const LEGACY_RAM_KB = 1024;

export function ramLabel(kb: number | undefined): string {
  return `${(kb ?? LEGACY_RAM_KB) / 1024} MB`;
}

export function ramKbOf(project: Pick<VXPProject, 'ramKb'>): number {
  return project.ramKb ?? LEGACY_RAM_KB;
}

/** Tên thư mục dự án trên đĩa (workspace): slug từ app id */
export function projectSlugOf(project: Pick<VXPProject, 'packageName'>): string {
  const last = (project.packageName || '').split('.').pop();
  return (last && /^[a-z0-9_]+$/i.test(last) ? last : slugOf(project.packageName || 'vxp_app'));
}

/** Thư mục gốc đầy đủ của project trên đĩa — null khi không có storagePath */
export function projectDirOf(project: VXPProject): string | null {
  if (!project.storagePath) return null;
  return `${project.storagePath.replace(/[\\/]+$/, '')}/${projectSlugOf(project)}`;
}

/** Đường dẫn thư mục xuất bản phẩm (build) */
export function projectBuildDirOf(project: VXPProject): string | null {
  const dir = projectDirOf(project);
  return dir ? `${dir}/build` : null;
}
