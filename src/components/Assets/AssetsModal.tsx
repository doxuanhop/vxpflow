import React, { useEffect, useState } from 'react';
import {
  X, ImagePlus, AlertTriangle, Check, Image as ImageIcon
} from 'lucide-react';
import { ProjectAsset, UIComponent } from '../../types';
import {
  pickImageFiles, readImageSize, isDesktop,
  workspaceEnsure, workspaceWriteBytes,
  workspaceRoot,
} from '../../utils/desktop';
import { useI18n } from '../../i18n';

/** Kích thước ảnh hợp lệ cho thư viện hình ảnh S30+ */
const VALID_IMAGE_SIZES = [
  { w: 240, h: 320 },
  { w: 320, h: 240 },
  { w: 240, h: 240 },
  { w: 128, h: 160 },
];
const isValidImageSize = (w: number, h: number) => VALID_IMAGE_SIZES.some(s => s.w === w && s.h === h);

const WORKSPACE_ROOT = workspaceRoot();

interface AssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectAsset[];
  /** Ảnh đã nhập mới (đã validate + dataURL) — gọi onUpdateAssets của caller */
  onAddAssets: (assets: ProjectAsset[]) => void;
  /** Nhấn vào một tài nguyên → dùng ngay trong canvas (App xử lý) */
  onUseAsset: (asset: ProjectAsset) => void;
  /** Đường dẫn workspace assets/ để ghi ảnh (desktop) — null nếu không khả dụng */
  workspaceAssetsDir: string | null;
  /** Tên linh kiện đang chọn (để hint "nhấn = gán cho linh kiện này") */
  selectedKind?: 'image' | 'sprite' | null;
}

/**
 * AssetsModal — hộp thoại tài nguyên mở từ nút "Assets" trong Navbar (tab Design).
 * Chỉ gồm: nút Import + lưới tài nguyên. Nhấn vào một ảnh → dùng NGAY trong canvas
 * (gán cho linh kiện Image/Sprite đang chọn, hoặc tạo linh kiện Image mới).
 */
export const AssetsModal: React.FC<AssetsModalProps> = ({
  isOpen,
  onClose,
  project,
  onAddAssets,
  onUseAsset,
  workspaceAssetsDir,
  selectedKind,
}) => {
  const { t } = useI18n();
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // tự ẩn thông báo
  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(null), 6000);
    return () => clearTimeout(id);
  }, [result]);

  if (!isOpen) return null;

  const images = project.filter(a => a.type === 'image');

  const handleImport = async () => {
    setIsImporting(true);
    setResult(null);
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
        onAddAssets(accepted);
        // Ghi ảnh ra workspace assets/ (desktop)
        if (isDesktop() && workspaceAssetsDir) {
          await workspaceEnsure(WORKSPACE_ROOT, '');
          for (const a of accepted) {
            const b64 = a.data.split(',')[1];
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            await workspaceWriteBytes(`${workspaceAssetsDir}/${a.name}`, bytes);
          }
        }
      }
      if (rejected.length > 0) {
        setResult({
          ok: false,
          msg: `Bỏ qua ${rejected.length} ảnh (kích thước phải 240x320, 320x240, 240x240 hoặc 128x160): ${rejected.join(', ')}`,
        });
      } else if (accepted.length > 0) {
        setResult({ ok: true, msg: `Đã nhập ${accepted.length} ảnh — nhấn vào ảnh để dùng trong canvas` });
      }
    } catch (err) {
      console.error('Import assets lỗi:', err);
      setResult({ ok: false, msg: `Lỗi nhập ảnh: ${err}` });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#F7F3FC] border border-[#CBC3DD] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 bg-[#EFEAF6] border-b border-[#E4DEF1] flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-[#221E2B] flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#B45309]" />
            {t('fm.assets')}
            <span className="text-[10px] font-mono text-[#6F687E]">({images.length})</span>
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#F3EEFA] flex items-center justify-center text-[#494256] hover:text-[#221E2B] transition-colors cursor-pointer"
            title={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Import bar */}
        <div className="px-5 py-3 border-b border-[#E4DEF1] flex items-center gap-3 shrink-0">
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex-1 py-2 bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            title="Nhập ảnh (PNG/JPG/BMP/GIF/WEBP) — 240x320 dọc, 320x240 ngang, 240x240, 128x160"
          >
            <ImagePlus className="w-4 h-4" />
            {isImporting ? t('fm.importing') : t('fm.import')}
          </button>
          <span className="text-[10px] text-[#A79EBD] leading-snug max-w-[220px]">
            {selectedKind === 'image' || selectedKind === 'sprite'
              ? (selectedKind === 'image'
                ? 'Nhấn vào ảnh để gán cho linh kiện Image đang chọn'
                : 'Nhấn vào ảnh để gán cho Sprite đang chọn')
              : 'Nhấn vào ảnh để thả linh kiện Image mới vào canvas'}
          </span>
        </div>

        {/* Thông báo import */}
        {result && (
          <div className={`mx-5 mt-3 flex items-start gap-2 p-2.5 rounded-lg text-[11px] leading-snug ${
            result.ok
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
              : 'bg-amber-50 border border-amber-300 text-amber-800'
          }`}>
            {result.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{result.msg}</span>
          </div>
        )}

        {/* Asset grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {images.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center text-[#A79EBD]">
              <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs font-medium">{t('fm.noAssets')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => { onUseAsset(asset); onClose(); }}
                  className="group bg-white border-2 border-[#E4DEF1] hover:border-[#7C3AED] rounded-xl p-2 flex flex-col items-center gap-2 transition-all hover:shadow-lg cursor-pointer"
                  title={`Dùng "${asset.name}" trong canvas`}
                >
                  <img
                    src={asset.data}
                    alt={asset.name}
                    className="pixelated rounded border border-[#E4DEF1] object-cover"
                    style={{ width: 120, height: asset.width && asset.height && asset.width > asset.height ? 90 : 120 }}
                  />
                  <div className="w-full text-center min-w-0">
                    <p className="text-[11px] font-semibold text-[#221E2B] truncate">{asset.name}</p>
                    <p className="text-[9px] font-mono text-[#6F687E]">
                      {asset.width}x{asset.height} · {Math.round(asset.size / 1024 * 10) / 10} KB
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Helper gom chung: chuyển UIComponent[] sang dạng gán picture cho linh kiện Image/Sprite */
export function useAssetApplyHelper(
  components: UIComponent[],
  onUpdate: (comps: UIComponent[]) => void,
) {
  return (asset: ProjectAsset, selectedId: string | null) => {
    const target = components.find(c => c.id === selectedId && (c.type === 'Image' || c.type === 'Sprite'));
    if (target) {
      // gán ảnh cho linh kiện đang chọn
      onUpdate(components.map(c => c.id === target.id
        ? { ...c, properties: { ...c.properties, picture: asset.name } }
        : c));
      return 'assigned';
    }
    // tạo linh kiện Image mới giữa canvas
    const n = components.filter(c => c.type === 'Image').length + 1;
    const isLandscape = asset.width && asset.height && asset.width > asset.height;
    const newComp: UIComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Image${n}`,
      type: 'Image',
      x: 20,
      y: 80,
      width: Math.min(asset.width || 120, 240),
      height: Math.min(asset.height || 120, 160),
      properties: { picture: asset.name },
    };
    onUpdate([...components, newComp]);
    return 'created';
  };
}
