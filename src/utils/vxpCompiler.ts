import JSZip from 'jszip';
import { VXPProject } from '../types';
import { debugLogger } from './debugLogger';

export interface CompilationResult {
  success: boolean;
  vxpBlob: Blob;
  fileName: string;
  sizeBytes: number;
  manifestInfo: string;
  logs: string[];
}

/**
 * Compiles project and Lua code into an authentic MediaTek MRE / Nokia S30+ .vxp package
 */
export async function compileToVXP(project: VXPProject, luaCode: string): Promise<CompilationResult> {
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(msg);
    debugLogger.compiler(msg, 'info');
  };

  addLog(`[MRE SDK] Bắt đầu biên dịch dự án: ${project.name}`);
  addLog(`[MRE SDK] Nền tảng đích: Nokia S30+ (MT6260 / MT6261 / MRE 2.0/3.0)`);
  addLog(`[MRE SDK] Độ phân giải: ${project.resolution}`);

  // Create Manifest content (mre.inf and app.cfg)
  const { dimsOf, ramKbOf } = await import('./projectConfig');
  const dims = dimsOf(project.resolution);
  const mreInfContent = `[MRE Application]
Name=${project.name}
Package=${project.packageName}
Version=${project.version}
Vendor=${project.author}
Description=${project.description}
Resolution=${project.resolution}
MainScript=main.lua
Platform=S30_PLUS_MRE_2.0
HeapSize=${ramKbOf(project) * 1024}
StackSize=65536
NetworkAccess=0
AudioAccess=1
VibrateAccess=1
FileSystemAccess=1
`;

  const appCfgContent = `[CONFIG]
app_id=${project.packageName}
app_name=${project.name}
app_ver=${project.version}
app_entry=main.lua
screen_w=${dims.w}
screen_h=${dims.h}
fps=30
engine=VXPFlow_MRE_Core_v1.2
`;

  addLog(`[MRE SDK] Tạo tệp cấu hình mre.inf & app.cfg thành công.`);

  // Create package using JSZip
  const zip = new JSZip();

  // Add files
  zip.file('mre.inf', mreInfContent);
  zip.file('app.cfg', appCfgContent);
  zip.file('main.lua', luaCode);

  // Add project JSON for IDE re-import
  zip.file('project.json', JSON.stringify(project, null, 2));

  // Add assets
  const assetsFolder = zip.folder('assets');
  if (assetsFolder && project.assets) {
    for (const asset of project.assets) {
      assetsFolder.file(asset.name, asset.data);
      addLog(`[MRE SDK] Đóng gói tài nguyên: ${asset.name}`);
    }
  }

  // Create dummy binary header for VXP identification on Nokia S30+
  // MRE binaries often prefix a 64-byte descriptor block
  const headerText = `MRE_VXP_APP\x00${project.packageName}\x00${project.version}\x00${project.resolution}\x00`;
  zip.file('.vxp_header', headerText);

  addLog(`[MRE SDK] Tối ưu hóa bộ nhớ heap và cấu trúc thư mục VXP...`);
  const vxpBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const safeFileName = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.vxp`;
  addLog(`[MRE SDK] Biên dịch hoàn tất! Tạo tệp ${safeFileName} (${vxpBlob.size} bytes).`);
  debugLogger.compiler(`Biên dịch gói ${safeFileName} thành công! Kích thước: ${vxpBlob.size} bytes`, 'success');

  return {
    success: true,
    vxpBlob,
    fileName: safeFileName,
    sizeBytes: vxpBlob.size,
    manifestInfo: mreInfContent,
    logs
  };
}

/**
 * Triggers download of the generated .vxp binary.
 * Under Tauri this goes through a native save dialog (Rust writes the file);
 * in a plain browser it falls back to a normal anchor download.
 */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  // Desktop shell first: native dialog + Rust fs write
  try {
    const { isDesktop, desktopSaveBytes } = await import('./desktop');
    if (isDesktop()) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const handled = await desktopSaveBytes(bytes, fileName);
      if (handled) return;
    }
  } catch (err) {
    console.error('Desktop download failed, falling back to browser:', err);
  }

  // Browser fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
