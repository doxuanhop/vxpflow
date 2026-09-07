import React, { useRef, useState } from 'react';
import { Package, Plus, Trash2, X, Upload, FileCode2, FileJson2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useSysDialogs } from '../SystemDialogs/SystemDialogs';
import { VXPExtension, VXPBlockManifest } from '../../types';

/**
 * Quản lý tiện ích .mvxp (kiểu .aix của App Inventor):
 * - Màn hình NHẬP TỆP LUA + MANIFEST để khai báo khối mới vào palette Blocks
 *   và hook sinh mã Lua.
 * - Một .mvxp = JSON: { name, version, description, color, blocks[], luaCode, initCode }
 * - Khối khai báo trong manifest.blocks có hook `lua` (template) — xem types.ts.
 */

interface ExtensionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  extensions: VXPExtension[];
  onAddExtension: (ext: VXPExtension) => void;
  onRemoveExtension: (id: string) => void;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `ext_${Date.now()}`;
}

const MANIFEST_EXAMPLE: VXPBlockManifest = {
  id: 'set_pixel',
  label: 'đặt điểm ảnh LED (x, y, màu)',
  color: '#0ea5e9',
  statement: true,
  inputs: [
    { name: 'x', type: 'number', default: 0, socket: true },
    { name: 'y', type: 'number', default: 0, socket: true },
    { name: 'color', type: 'any', default: '#ff0000' }
  ],
  lua: 'LedMatrix.set_pixel({num:x}, {num:y}, {any:color})'
};

export const ExtensionManagerModal: React.FC<ExtensionManagerModalProps> = ({
  isOpen, onClose, extensions, onAddExtension, onRemoveExtension
}) => {
  const { confirmDialog } = useSysDialogs();
  const [tab, setTab] = useState<'installed' | 'new'>('installed');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [manifestJson, setManifestJson] = useState('');
  const [luaCode, setLuaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const mvxpFileRef = useRef<HTMLInputElement | null>(null);
  const luaFileRef = useRef<HTMLInputElement | null>(null);
  const manifestFileRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName(''); setVersion('1.0.0'); setDescription('');
    setManifestJson(''); setLuaCode(''); setError(null); setOkMsg(null);
  };

  const flashOk = (msg: string) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 4000);
  };

  const parseMvxp = (raw: string, source: string): void => {
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') throw new Error('Tệp phải là một đối tượng JSON');
      if (!Array.isArray(data.blocks)) throw new Error('Thiếu mảng "blocks" trong manifest');
      setName(data.name || data.id || 'Tiện ích mới');
      setVersion(String(data.version || '1.0.0'));
      setDescription(data.description || '');
      setManifestJson(JSON.stringify({ ...data, luaCode: undefined, initCode: data.initCode }, null, 2));
      setLuaCode(data.luaCode || '');
      setError(null);
      flashOk(`Đã nạp tiện ích từ ${source}: ${data.blocks.length} khối khai báo`);
    } catch (e: any) {
      setError(`Không đọc được ${source}: ${e?.message || 'JSON không hợp lệ'}`);
    }
  };

  const handleMvxpFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseMvxp(String(reader.result || ''), file.name);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLuaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLuaCode(String(reader.result || ''));
      setError(null);
      flashOk(`Đã nạp mã Lua thư viện từ ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleManifestFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data.blocks)) throw new Error('Thiếu mảng "blocks"');
        setManifestJson(JSON.stringify(data, null, 2));
        if (data.name) setName(data.name);
        if (data.version) setVersion(String(data.version));
        if (data.description) setDescription(data.description);
        setError(null);
        flashOk(`Đã nạp manifest từ ${file.name}`);
      } catch (err: any) {
        setError(`Manifest không hợp lệ: ${err?.message || 'JSON lỗi'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = () => {
    setError(null);
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Bạn cần đặt tên cho tiện ích.');
      return;
    }
    let manifest: any = {};
    if (manifestJson.trim()) {
      try {
        manifest = JSON.parse(manifestJson);
      } catch {
        setError('Manifest JSON không hợp lệ — kiểm tra dấu ngoặc, dấu phẩy.');
        return;
      }
    }
    const blocks: VXPBlockManifest[] = Array.isArray(manifest.blocks) ? manifest.blocks : [];
    if (blocks.length === 0) {
      setError('Manifest phải khai báo ít nhất 1 khối trong mảng "blocks".');
      return;
    }
    for (const b of blocks) {
      if (!b.id || !b.lua) {
        setError(`Khối "${b.id || '(thiếu id)'}" cần có "id" và hook sinh mã "lua".`);
        return;
      }
    }
    const ext: VXPExtension = {
      id: slugify(cleanName),
      name: cleanName,
      version: version.trim() || '1.0.0',
      description: description.trim(),
      color: typeof manifest.color === 'string' ? manifest.color : undefined,
      blocks,
      luaCode: luaCode || manifest.luaCode || '',
      initCode: typeof manifest.initCode === 'string' ? manifest.initCode : undefined,
      createdAt: new Date().toISOString()
    };
    onAddExtension(ext);
    flashOk(`Đã cài tiện ích "${cleanName}" — ${blocks.length} khối mới vào palette Blocks`);
    setTab('installed');
    resetForm();
  };

  const fillExample = () => {
    setName('LED Ma Trận');
    setVersion('1.0.0');
    setDescription('Điều khiển LED ma trận qua thư viện LedMatrix.lua');
    setManifestJson(JSON.stringify({ blocks: [MANIFEST_EXAMPLE] }, null, 2));
    setLuaCode('-- LedMatrix.lua — thư viện điều khiển LED ma trận\nLedMatrix = {}\n\nfunction LedMatrix.set_pixel(x, y, color)\n  MRE.log("LED(" .. x .. "," .. y .. ") = " .. tostring(color))\nend\n\nfunction LedMatrix.clear()\n  MRE.log("LED: xóa màn hình")\nend');
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E4DEF1] bg-[#F3EEFA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-[#7C3AED]" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#221E2B]">Tiện ích mở rộng .mvxp</h3>
              <p className="text-[10px] text-[#494256] mt-0.5">
                Nhập tệp Lua + manifest — khai báo khối mới vào palette và hook sinh mã Lua (tiện ích mở rộng VXP MRE)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#E4DEF1] text-[#494256] cursor-pointer" title="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-5 pt-3 pb-1 shrink-0">
          <button
            onClick={() => { setTab('installed'); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              tab === 'installed'
                ? 'bg-[#6750A4] text-white border-[#6750A4] shadow-md'
                : 'bg-[#FDFCFF] border-[#CBC3DD] text-[#494256] hover:bg-[#F3EEFA]'
            }`}
          >
            Đã cài ({extensions.length})
          </button>
          <button
            onClick={() => { setTab('new'); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
              tab === 'new'
                ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-md'
                : 'bg-[#FDFCFF] border-[#CBC3DD] text-[#494256] hover:bg-[#F3EEFA]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm tiện ích mới</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 pt-3 min-h-0">
          {/* Error / OK toast */}
          {(error || okMsg) && (
            <div className={`mb-3 px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
              error ? 'bg-red-50 text-red-700 border-red-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
            }`}>
              {error ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              <span>{error || okMsg}</span>
            </div>
          )}

          {tab === 'installed' && (
            <div className="space-y-2">
              {extensions.length === 0 ? (
                <div className="text-center py-10 text-[#6F687E]">
                  <Package className="w-10 h-10 mx-auto mb-3 text-[#C7BFD9]" />
                  <p className="text-sm font-semibold text-[#494256]">Chưa cài tiện ích nào</p>
                  <p className="text-xs mt-1 max-w-md mx-auto">
                    Chuyển sang tab <strong>Thêm tiện ích mới</strong> để nhập tệp Lua + manifest (.mvxp) —
                    khối mới sẽ xuất hiện trong danh mục <strong>Tiện ích (.mvxp)</strong> ở Blocks.
                  </p>
                </div>
              ) : (
                extensions.map(ext => (
                  <div key={ext.id} className="rounded-lg border border-[#E4DEF1] bg-[#FDFCFF] p-3 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                      style={{ backgroundColor: ext.color || '#7C3AED' }}>
                      {ext.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#221E2B] truncate">{ext.name}</span>
                        <span className="text-[9px] font-mono text-[#6F687E] bg-[#EFEAF6] border border-[#E4DEF1] rounded-full px-1.5 py-px">
                          v{ext.version}
                        </span>
                        <span className="text-[9px] font-mono text-[#6D28D9] bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-full px-1.5 py-px">
                          {ext.blocks.length} khối
                        </span>
                      </div>
                      {ext.description && <p className="text-[11px] text-[#494256] mt-0.5 truncate">{ext.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {ext.blocks.slice(0, 5).map(b => (
                          <span key={b.id} className="text-[9px] font-mono text-[#6F687E] bg-[#F3EEFA] border border-[#E4DEF1] rounded px-1.5 py-px truncate max-w-[200px]">
                            {b.label}
                          </span>
                        ))}
                        {ext.blocks.length > 5 && <span className="text-[9px] text-[#A79EBD]">+{ext.blocks.length - 5} khối nữa</span>}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (await confirmDialog({ title: 'Gỡ tiện ích', message: `Gỡ tiện ích "${ext.name}"? Các khối của tiện ích trên bảng sẽ bị xóa.`, danger: true })) {
                          onRemoveExtension(ext.id);
                        }
                      }}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 cursor-pointer shrink-0"
                      title="Gỡ tiện ích"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'new' && (
            <div className="space-y-3.5">
              {/* File loaders */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => mvxpFileRef.current?.click()}
                  className="px-2 py-2.5 rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10 text-[#6D28D9] text-[11px] font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer"
                  title="Tải tệp .mvxp (JSON gồm manifest + luaCode) để điền sẵn toàn bộ"
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải tệp .mvxp</span>
                </button>
                <button
                  onClick={() => luaFileRef.current?.click()}
                  className="px-2 py-2.5 rounded-lg border border-[#047857]/40 bg-[#047857]/5 hover:bg-[#047857]/10 text-[#047857] text-[11px] font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer"
                  title="Tải tệp Lua (.lua) — mã nguồn thư viện của tiện ích"
                >
                  <FileCode2 className="w-4 h-4" />
                  <span>Tải tệp Lua</span>
                </button>
                <button
                  onClick={() => manifestFileRef.current?.click()}
                  className="px-2 py-2.5 rounded-lg border border-[#0284C7]/40 bg-[#0284C7]/5 hover:bg-[#0284C7]/10 text-[#0284C7] text-[11px] font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer"
                  title="Tải tệp manifest (.json) — khai báo các khối mới"
                >
                  <FileJson2 className="w-4 h-4" />
                  <span>Tải manifest</span>
                </button>
                <input ref={mvxpFileRef} type="file" accept=".mvxp,.json" className="hidden" onChange={handleMvxpFile} />
                <input ref={luaFileRef} type="file" accept=".lua,.txt" className="hidden" onChange={handleLuaFile} />
                <input ref={manifestFileRef} type="file" accept=".json,.mvxp" className="hidden" onChange={handleManifestFile} />
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#494256] mb-1">Tên tiện ích *</label>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="VD: LED Ma Trận"
                    className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2.5 py-1.5 outline-none focus:border-[#7C3AED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#494256] mb-1">Phiên bản</label>
                  <input
                    type="text" value={version} onChange={(e) => setVersion(e.target.value)}
                    className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2.5 py-1.5 outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#494256] mb-1">Mô tả</label>
                <input
                  type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả ngắn về tiện ích"
                  className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2.5 py-1.5 outline-none focus:border-[#7C3AED]"
                />
              </div>

              {/* Manifest JSON */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-[#494256]">
                    Manifest JSON — khai báo khối mới + hook sinh mã Lua *
                  </label>
                  <button
                    onClick={fillExample}
                    className="text-[10px] text-[#7C3AED] hover:underline font-semibold cursor-pointer"
                    title="Điền sẵn ví dụ tiện ích LED Ma Trận"
                  >
                    Dùng ví dụ mẫu
                  </button>
                </div>
                <textarea
                  value={manifestJson}
                  onChange={(e) => setManifestJson(e.target.value)}
                  rows={9}
                  spellCheck={false}
                  placeholder={JSON.stringify({ blocks: [MANIFEST_EXAMPLE] }, null, 2)}
                  className="w-full bg-[#221E2B] text-[#7DD3FC] text-[10.5px] font-mono leading-relaxed rounded-lg p-3 outline-none border border-[#CBC3DD] focus:border-[#7C3AED] resize-y"
                />
                <p className="text-[9.5px] text-[#6F687E] mt-1 leading-relaxed">
                  Mỗi khối cần <code className="font-mono bg-[#EFEAF6] px-1 rounded">id</code>,{' '}
                  <code className="font-mono bg-[#EFEAF6] px-1 rounded">label</code> (dùng &lt;tên_ô&gt; cho ô nhập) và hook{' '}
                  <code className="font-mono bg-[#EFEAF6] px-1 rounded">lua</code>. Placeholder:{' '}
                  <code className="font-mono bg-[#EFEAF6] px-1 rounded">{"{tên}"}</code> literal ·{' '}
                  <code className="font-mono bg-[#EFEAF6] px-1 rounded">{"{num:x}"}</code> ·{' '}
                  <code className="font-mono bg-[#EFEAF6] px-1 rounded">{"{bool:x}"}</code> ·{' '}
                  <code className="font-mono bg-[#EFEAF6] px-1 rounded">{"{any:x}"}</code> ·{' '}
                  <code className="font-mono bg-[#EFEAF6] px-1 rounded">{"{str:x}"}</code>.
                  Đánh dấu ô nhập tên thành phần bằng <code className="font-mono bg-[#EFEAF6] px-1 rounded">"component": true</code>.
                </p>
              </div>

              {/* Lua code */}
              <div>
                <label className="block text-[10px] font-bold text-[#494256] mb-1">
                  Mã Lua thư viện (được nhúng vào tệp .lua khi dự án dùng khối của tiện ích)
                </label>
                <textarea
                  value={luaCode}
                  onChange={(e) => setLuaCode(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder="-- Mã nguồn Lua thư viện (VD: LedMatrix = {} …)"
                  className="w-full bg-[#221E2B] text-[#4ADE80] text-[10.5px] font-mono leading-relaxed rounded-lg p-3 outline-none border border-[#CBC3DD] focus:border-[#7C3AED] resize-y"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'new' && (
          <div className="px-5 py-3 border-t border-[#E4DEF1] bg-[#F3EEFA] flex items-center justify-end gap-2 shrink-0">
            <button
              onClick={() => { resetForm(); setTab('installed'); }}
              className="px-3 py-1.5 text-xs text-[#494256] bg-[#FDFCFF] border border-[#CBC3DD] rounded-lg hover:bg-[#E4DEF1] cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg shadow-lg shadow-[#7C3AED]/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Lưu tiện ích (.mvxp)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};