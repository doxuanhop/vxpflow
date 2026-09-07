import React, { useState, useEffect } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, Music, Settings, 
  Trash2, Plus, Download, Upload, Eye, FileCode, Check, AlertTriangle, ImagePlus,
  FolderOpen, ExternalLink, FolderTree
} from 'lucide-react';
import { VXPProject, ProjectAsset } from '../../types';
import { dimsOf, ramKbOf, projectDirOf, projectSlugOf } from '../../utils/projectConfig';
import { useI18n } from '../../i18n';
import {
  pickImageFiles, readImageSize,
  isDesktop, workspaceEnsure, workspaceList, workspaceWriteBytes, workspaceOpen,
  workspaceWriteText, type WorkspaceNode,
  workspaceRoot,
} from '../../utils/desktop';

const WORKSPACE_ROOT = workspaceRoot();

/** Kích thước ảnh hợp lệ cho thư viện linh kiện hình ảnh S30+ (portrait + landscape) */
const VALID_IMAGE_SIZES = [
  { w: 240, h: 320, label: '240x320 (dọc QVGA)' },
  { w: 320, h: 240, label: '320x240 (ngang QVGA)' },
  { w: 240, h: 240, label: '240x240 (vuông)' },
  { w: 128, h: 160, label: '128x160 (S30 cổ điển)' },
];
const isValidImageSize = (w: number, h: number) => VALID_IMAGE_SIZES.some(s => s.w === w && s.h === h);

interface FileManagerProps {
  project: VXPProject;
  luaCode: string;
  onUpdateAssets: (assets: ProjectAsset[]) => void;
  onDownloadProjectZip: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({ 
  project, 
  luaCode, 
  onUpdateAssets, 
  onDownloadProjectZip 
}) => {

  const { t } = useI18n();
  const [selectedFile, setSelectedFile] = useState<string>('main.lua');
  const [newFileName, setNewFileName] = useState<string>('');
  const [isAddingFile, setIsAddingFile] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  /** Workspace trên đĩa: đường dẫn + cây thư mục (chỉ desktop) */
  const [wsDir, setWsDir] = useState<string | null>(null);
  const [wsTree, setWsTree] = useState<WorkspaceNode[] | null>(null);

  const desktop = isDesktop();
  /** Thư mục workspace của dự án: storagePath người dùng chọn, hoặc mặc định D:/…/workspace */
  const wsProjectDir = projectDirOf(project) || (desktop ? `${WORKSPACE_ROOT}/${projectSlugOf(project)}` : null);

  /** Đảm bảo workspace tồn tại + nạp cây thư mục */
  const refreshWorkspace = async () => {
    if (!desktop || !wsProjectDir) { setWsDir(null); setWsTree(null); return; }
    const dir = await workspaceEnsure(WORKSPACE_ROOT, project.name);
    const finalDir = dir || wsProjectDir;
    setWsDir(finalDir);
    const tree = await workspaceList(finalDir);
    setWsTree(tree);
  };

  // Nạp workspace khi mở tab / đổi project / đổi assets
  useEffect(() => {
    refreshWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.assets.length, desktop]);

  /** Ghi project.json + config vào workspace config/ */
  const syncWorkspaceConfig = async () => {
    if (!wsDir) return;
    await workspaceWriteText(`${wsDir}/config/project.json`, JSON.stringify(project, null, 2));
    const dims = dimsOf(project.resolution);
    await workspaceWriteText(`${wsDir}/config/mre.inf`, `[MRE Application]
Name=${project.name}
Package=${project.packageName}
Version=${project.version}
Vendor=${project.author}
Resolution=${project.resolution}
MainScript=main.lua
Platform=S30_PLUS_MRE_2.0
HeapSize=${ramKbOf(project) * 1024}
StackSize=65536
`);
    await workspaceWriteText(`${wsDir}/config/app.cfg`, `[CONFIG]
app_id=${project.packageName}
app_name=${project.name}
app_ver=${project.version}
app_entry=main.lua
screen_w=${dims.w}
screen_h=${dims.h}
`);
    await workspaceWriteText(`${wsDir}/src/main.lua`, luaCode);
  };

  // Đồng bộ config/src mỗi lần luaCode/project đổi (debounce nhẹ qua effect)
  useEffect(() => {
    if (wsDir) syncWorkspaceConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsDir, luaCode, project.version, project.resolution]);

  const handleOpenWorkspace = async () => {
    if (wsDir) await workspaceOpen(wsDir);
  };

  const handleDeleteAsset = (assetId: string) => {
    if (window.confirm(t('fm.deleteConfirm'))) {
      const updated = project.assets.filter(a => a.id !== assetId);
      onUpdateAssets(updated);
      setSelectedFile('main.lua');
    }
  };

  /**
   * IMPORT ASSETS — chọn ảnh (png/jpg/bmp/gif/webp) từ máy:
   * validate kích thước chuẩn S30+ (240x320 dọc, 320x240 ngang, 240x240, 128x160)
   * rồi lưu vào assets của dự án để dùng cho linh kiện Image/Sprite trong Designer.
   */
  const handleImportAssets = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const files = await pickImageFiles();
      if (!files || files.length === 0) {
        setIsImporting(false);
        return;
      }
      const rejected: string[] = [];
      const accepted: ProjectAsset[] = [];
      for (const f of files) {
        const size = await readImageSize(f.dataUrl);
        if (!size || !isValidImageSize(size.width, size.height)) {
          rejected.push(`${f.name}${size ? ` (${size.width}x${size.height})` : ''}`);
          continue;
        }
        // dataUrl = "data:<mime>;base64,<data>" — phần data chính là base64 của bytes
        accepted.push({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          type: 'image',
          size: f.bytes.length,
          width: size.width,
          height: size.height,
          data: f.dataUrl,
        });
      }
      if (accepted.length > 0) {
        // Trùng tên → ghi đè bản cũ
        const existing = [...project.assets];
        for (const a of accepted) {
          const idx = existing.findIndex(e => e.name === a.name);
          if (idx >= 0) existing[idx] = a; else existing.push(a);
        }
        onUpdateAssets(existing);
        setSelectedFile(accepted[accepted.length - 1].name);
        // Ghi ảnh ra workspace assets/ (desktop) — tài nguyên nằm cạnh dự án trên đĩa
        if (wsDir) {
          for (const a of accepted) {
            // dataUrl = "data:<mime>;base64,<data>"
            const b64 = a.data.split(',')[1];
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            await workspaceWriteBytes(`${wsDir}/assets/${a.name}`, bytes);
          }
          await refreshWorkspace();
        }
      }
      if (rejected.length > 0) {
        setImportResult({
          ok: false,
          msg: `Bỏ qua ${rejected.length} ảnh (kích thước phải 240x320, 320x240, 240x240 hoặc 128x160): ${rejected.join(', ')}`,
        });
      } else if (accepted.length > 0) {
        setImportResult({ ok: true, msg: `Đã nhập ${accepted.length} ảnh vào assets/` });
      }
    } catch (err) {
      console.error('Import assets lỗi:', err);
      setImportResult({ ok: false, msg: `Lỗi nhập ảnh: ${err}` });
    } finally {
      setIsImporting(false);
      // tự ẩn thông báo sau 6s
      setTimeout(() => setImportResult(null), 6000);
    }
  };

  const getSelectedContent = () => {
    if (selectedFile === 'main.lua') return luaCode;
    if (selectedFile === 'mre.inf') {
      return `[MRE Application]
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
`;
    }
    if (selectedFile === 'app.cfg') {
      const dims = dimsOf(project.resolution);
      return `[CONFIG]
app_id=${project.packageName}
app_name=${project.name}
app_ver=${project.version}
app_entry=main.lua
screen_w=${dims.w}
screen_h=${dims.h}
engine=VXPFlow_MRE_v1.2
`;
    }
    if (selectedFile === 'project.json') {
      return JSON.stringify(project, null, 2);
    }

    const asset = project.assets.find(a => a.name === selectedFile || a.id === selectedFile);
    if (asset) {
      if (asset.type === 'sprite') {
        return asset.data;
      }
      return asset.data;
    }

    return '-- File không có nội dung văn bản';
  };

  const activeAsset = project.assets.find(a => a.name === selectedFile || a.id === selectedFile);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#EFEAF6] text-[#221E2B]">
      {/* File Tree Sidebar */}
      <aside className="w-72 bg-[#F7F3FC] border-r border-[#E4DEF1] p-4 flex flex-col justify-between shrink-0 select-none">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4DEF1]">
            <h2 className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#6F687E]">
              <Folder className="w-4 h-4 text-[#B45309]" />
              <span>{t('fm.title')}</span>
            </h2>
            <button
              onClick={() => setIsAddingFile(!isAddingFile)}
              className="p-1 text-[#494256] hover:text-[#221E2B] hover:bg-[#F3EEFA] rounded transition-colors"
              title={t('fm.addFile')}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add file form */}
          {isAddingFile && (
            <div className="p-2 bg-[#EFEAF6] rounded border border-[#CBC3DD] space-y-2">
              <input
                type="text"
                placeholder={t('fm.addFilePlaceholder')}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full bg-[#F7F3FC] border border-[#CBC3DD] rounded px-2 py-1 text-xs text-[#221E2B] font-mono outline-none focus:border-[#6750A4]"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setIsAddingFile(false)}
                  className="px-2 py-1 text-[#494256] hover:text-[#221E2B] text-[11px]"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (!newFileName.trim()) return;
                    const newAsset: ProjectAsset = {
                      id: `file_${Date.now()}`,
                      name: newFileName.trim(),
                      type: newFileName.endsWith('.lua') ? 'lua' : 'config',
                      size: 100,
                      data: '-- Kịch bản mới tạo\n'
                    };
                    onUpdateAssets([...project.assets, newAsset]);
                    setNewFileName('');
                    setIsAddingFile(false);
                    setSelectedFile(newAsset.name);
                  }}
                  className="px-2.5 py-1 bg-[#6750A4] hover:bg-[#6750A4] text-white rounded text-[11px] font-semibold transition-colors"
                >
                  Tạo tệp
                </button>
              </div>
            </div>
          )}

          {/* Core System Files */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-[#6F687E] font-bold px-1 block">Tệp hệ thống MRE</span>
            
            <button
              onClick={() => setSelectedFile('main.lua')}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                selectedFile === 'main.lua' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#221E2B] hover:bg-[#F3EEFA]'
              }`}
            >
              <FileCode className="w-4 h-4 text-[#047857]" />
              <span>main.lua</span>
              <span className="text-[10px] ml-auto text-[#047857] font-mono">Entry</span>
            </button>

            <button
              onClick={() => setSelectedFile('mre.inf')}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                selectedFile === 'mre.inf' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#221E2B] hover:bg-[#F3EEFA]'
              }`}
            >
              <FileText className="w-4 h-4 text-[#B45309]" />
              <span>mre.inf</span>
              <span className="text-[10px] ml-auto text-[#494256] font-mono">Manifest</span>
            </button>

            <button
              onClick={() => setSelectedFile('app.cfg')}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                selectedFile === 'app.cfg' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#221E2B] hover:bg-[#F3EEFA]'
              }`}
            >
              <Settings className="w-4 h-4 text-[#0284C7]" />
              <span>app.cfg</span>
              <span className="text-[10px] ml-auto text-[#494256] font-mono">Config</span>
            </button>

            <button
              onClick={() => setSelectedFile('project.json')}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                selectedFile === 'project.json' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#221E2B] hover:bg-[#F3EEFA]'
              }`}
            >
              <Settings className="w-4 h-4 text-[#7C3AED]" />
              <span>project.json</span>
              <span className="text-[10px] ml-auto text-[#494256] font-mono">Schema</span>
            </button>
          </div>

          {/* WORKSPACE — cấu trúc thư mục dự án trên đĩa */}
          <div className="space-y-1 pt-2 border-t border-[#E4DEF1]">
            <span className="text-[10px] uppercase tracking-wider text-[#6F687E] font-bold px-1 flex items-center gap-1">
              <FolderTree className="w-3 h-3" />
              <span>{t('fm.workspace')}</span>
            </span>

            {!desktop ? (
              <p className="text-[10px] text-[#A79EBD] px-2 py-1.5 leading-snug">
                Workspace trên đĩa khả dụng trong bản desktop (Tauri).
              </p>
            ) : (
              <>
                <div className="mx-1 mt-1 p-2 bg-[#F7F3FC] border border-[#E4DEF1] rounded-lg text-[10px] font-mono text-[#6F687E] break-all leading-snug">
                  {wsDir || '…'}
                </div>
                {/* Cây thư mục */}
                <div className="mx-1 mt-1 p-2 bg-[#F7F3FC] border border-[#E4DEF1] rounded-lg text-[11px] font-mono text-[#221E2B] max-h-44 overflow-auto">
                  {(wsTree || []).map(node => (
                    <div key={node.name}>
                      <div className="flex items-center gap-1 py-px">
                        {node.dir ? <Folder className="w-3 h-3 text-[#B45309]" /> : <FileCode className="w-3 h-3 text-[#047857]" />}
                        <span className={node.dir ? 'font-semibold' : ''}>{node.name}</span>
                        {!node.dir && node.size > 0 && <span className="text-[9px] text-[#A79EBD] ml-auto">{node.size}B</span>}
                      </div>
                      {node.dir && node.children && node.children.length > 0 && (
                        <div className="pl-3 border-l border-[#E4DEF1] ml-2">
                          {node.children.map(child => (
                            <div key={child.name} className="flex items-center gap-1 py-px text-[10px] text-[#494256]">
                              {child.dir ? <Folder className="w-2.5 h-2.5 text-[#B45309]/70" /> : <FileCode className="w-2.5 h-2.5 text-[#047857]/70" />}
                              <span className="truncate">{child.name}</span>
                              {!child.dir && child.size > 0 && <span className="text-[9px] text-[#A79EBD] ml-auto">{child.size}B</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!wsTree || wsTree.length === 0) && (
                    <p className="text-[10px] text-[#A79EBD] py-1">Đang tạo cấu trúc…</p>
                  )}
                </div>
                <button
                  onClick={handleOpenWorkspace}
                  className="w-full mx-0 flex items-center justify-center gap-1.5 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] border border-[#CBC3DD] text-[#221E2B] rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  title={t('fm.openFolder')}
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('fm.openFolder')}
                </button>
              </>
            )}
          </div>

          {/* Assets Folder */}
          <div className="space-y-1 pt-2 border-t border-[#E4DEF1]">
            <span className="text-[10px] uppercase tracking-wider text-[#6F687E] font-bold px-1 flex items-center justify-between">
              <span>{t('fm.assets')}</span>
              <span className="text-[10px] font-mono text-[#6F687E]">{project.assets.length} tệp</span>
            </span>

            {/* Nút IMPORT ASSETS — chọn ảnh 240x320 / 320x240 từ máy */}
            <button
              onClick={handleImportAssets}
              disabled={isImporting}
              className="w-full py-1.5 bg-[#047857] hover:bg-[#056e4d] disabled:opacity-60 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors mt-1"
              title={t('fm.import')}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {isImporting ? t('fm.importing') : t('fm.import')}
            </button>

            {/* Kết quả import / cảnh báo kích thước */}
            {importResult && (
              <div
                className={`flex items-start gap-1.5 p-2 rounded text-[10px] leading-snug ${
                  importResult.ok
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                    : 'bg-amber-50 border border-amber-300 text-amber-800'
                }`}
                title={importResult.msg}
              >
                {importResult.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                <span className="line-clamp-3">{importResult.msg}</span>
              </div>
            )}

            {project.assets.length === 0 && (
              <p className="text-[10px] text-[#A79EBD] px-2 py-1.5">
                {t('fm.noAssets')}
              </p>
            )}

            {project.assets.map(asset => (
              <div
                key={asset.id}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                  selectedFile === asset.name ? 'bg-[#6750A4] text-white font-medium' : 'text-[#221E2B] hover:bg-[#F3EEFA]'
                }`}
              >
                <button
                  onClick={() => setSelectedFile(asset.name)}
                  className="flex items-center gap-2 flex-1 truncate text-left"
                >
                  {asset.type === 'image' || asset.type === 'sprite' ? (
                    <ImageIcon className="w-4 h-4 text-[#B45309]" />
                  ) : asset.type === 'sound' ? (
                    <Music className="w-4 h-4 text-[#DB2777]" />
                  ) : (
                    <FileCode className="w-4 h-4 text-[#047857]" />
                  )}
                  <span className="truncate">{asset.name}</span>
                  {asset.type === 'image' && asset.width && (
                    <span className="text-[9px] font-mono opacity-60 shrink-0">{asset.width}x{asset.height}</span>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteAsset(asset.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 text-[#494256] transition-opacity"
                  title={t('fm.deleteFile')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Export ZIP package */}
        <div className="pt-4 border-t border-[#E4DEF1]">
          <button
            onClick={onDownloadProjectZip}
            className="w-full py-2 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] hover:text-[#221E2B] rounded text-xs font-semibold flex items-center justify-center gap-2 border border-[#CBC3DD] hover:border-[#6750A4] transition-colors"
          >
            <Download className="w-4 h-4" /> {t('fm.zip')}
          </button>
        </div>
      </aside>

      {/* File Content Preview */}
      <section className="flex-1 flex flex-col bg-[#EFEAF6] overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#E4DEF1] bg-[#F7F3FC]">
          <div className="flex items-center gap-2 font-mono text-xs text-[#221E2B]">
            <FileCode className="w-4 h-4 text-[#6750A4]" />
            <span>{selectedFile}</span>
          </div>
          <span className="text-xs text-[#494256] font-mono">
            {activeAsset ? `${activeAsset.size} bytes` : t('fm.readonly')}
          </span>
        </div>

        {/* Content viewer */}
        <div className="flex-1 p-6 overflow-auto geometric-dot-grid">
          {activeAsset && activeAsset.type === 'image' ? (
            <div className="space-y-6">
              <div className="p-4 bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl inline-block shadow-md">
                <span className="text-xs font-semibold text-[#494256] block mb-3">
                  Xem trước ảnh ({activeAsset.width}x{activeAsset.height} — {activeAsset.width === 240 && activeAsset.height === 320 ? 'dọc S30+' : activeAsset.width === 320 && activeAsset.height === 240 ? 'ngang S30+' : 'khổ khác'}):
                </span>
                <img
                  src={activeAsset.data}
                  alt={activeAsset.name}
                  className="pixelated border-2 border-[#CBC3DD] rounded shadow-md max-w-full"
                  style={{ width: activeAsset.width ? `${Math.min(activeAsset.width, 480)}px` : 'auto' }}
                />
              </div>
              <div className="text-xs text-[#6F687E] font-mono space-y-1">
                <p>Tệp: <span className="text-[#221E2B] font-semibold">{activeAsset.name}</span></p>
                <p>Kích thước: {activeAsset.width}x{activeAsset.height} · Dung lượng: {Math.round(activeAsset.size / 1024 * 10) / 10} KB</p>
                <p className="text-[#047857]">Dùng cho linh kiện Image / Sprite trong tab Designer (chọn ở thuộc tính Picture).</p>
              </div>
            </div>
          ) : activeAsset && activeAsset.type === 'sprite' ? (
            <div className="space-y-6">
              <div className="p-4 bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl inline-block shadow-md">
                <span className="text-xs font-semibold text-[#494256] block mb-3">Xem trước Sprite Đồ họa:</span>
                {(() => {
                  try {
                    const parsed = JSON.parse(activeAsset.data);
                    return (
                      <div
                        className="pixelated border-2 border-[#CBC3DD] rounded shadow-md"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${parsed.width || 16}, 16px)`,
                          width: `${(parsed.width || 16) * 16}px`,
                          height: `${(parsed.height || 16) * 16}px`
                        }}
                      >
                        {parsed.pixels.map((pIndex: number, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: parsed.palette[pIndex] || 'transparent'
                            }}
                          />
                        ))}
                      </div>
                    );
                  } catch (e) {
                    return <span className="text-red-600 text-xs">Không thể kết xuất sprite đồ họa</span>;
                  }
                })()}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#494256]">Dữ liệu thô (JSON matrix):</span>
                <pre className="p-4 bg-[#F7F3FC] border border-[#E4DEF1] rounded-lg text-xs font-mono text-[#047857] overflow-x-auto max-h-64">
                  {getSelectedContent()}
                </pre>
              </div>
            </div>
          ) : (
            <pre className="font-mono text-xs text-[#221E2B] leading-relaxed bg-[#F7F3FC] p-4 rounded-lg border border-[#E4DEF1] overflow-x-auto shadow-md">
              {getSelectedContent()}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
};
