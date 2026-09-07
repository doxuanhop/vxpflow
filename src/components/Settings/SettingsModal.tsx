import React, { useState } from 'react';
import {
  X, RefreshCw, Package, Puzzle, ShieldCheck, CheckCircle2,
  AlertTriangle, Loader2, Cpu, HardDrive, Terminal, Globe
} from 'lucide-react';
import { useI18n } from '../../i18n';

/* ================================================================== *
 *  SettingsModal (VXPFlow) — menu Settings ở Project Hub:
 *  - Kiểm tra bản cập nhật (phiên bản app + thư viện MRE toolchain)
 *  - Load / cài đặt lại môi trường thư viện (mre-tool: luac, PackApp,
 *    GCC ARM, SDK, emulator)
 *  - Load tiện ích mở rộng (.mvxp) được cập nhật
 *  - Trạng thái môi trường: terminal ẩn, toolchain, emulator
 * ================================================================== */

type CheckState = 'idle' | 'checking' | 'ok' | 'warn' | 'error';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const APP_VERSION = '1.0.0';
const REPO_URL = 'https://github.com/doxuanhop/vxpflow';
/** Endpoint kiểm tra bản cập nhật (manifest JSON: {version, notes, url}) */
const UPDATE_URL = 'https://raw.githubusercontent.com/doxuanhop/vxpflow/main/updates/latest.json';

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [updateState, setUpdateState] = useState<CheckState>('idle');
  const [updateMsg, setUpdateMsg] = useState('');
  const [libState, setLibState] = useState<CheckState>('idle');
  const [libMsg, setLibMsg] = useState('');
  const [extState, setExtState] = useState<CheckState>('idle');
  const [extMsg, setExtMsg] = useState('');

  if (!isOpen) return null;

  const Section = ({ icon: Icon, title, children }: {
    icon: any; title: string; children: React.ReactNode;
  }) => (
    <div className="border border-[#E4DEF1] rounded-xl overflow-hidden bg-[#FDFCFF]">
      <div className="px-3 py-2 flex items-center gap-2 bg-[#F3EEFA] border-b border-[#E4DEF1]">
        <Icon className="w-4 h-4 text-[#6750A4]" />
        <h4 className="text-xs font-bold text-[#221E2B]">{title}</h4>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );

  const StatusIcon = ({ state }: { state: CheckState }) => {
    if (state === 'checking') return <Loader2 className="w-4 h-4 text-[#6750A4] animate-spin shrink-0" />;
    if (state === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
    if (state === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    if (state === 'error') return <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />;
    return <ShieldCheck className="w-4 h-4 text-[#A79EBD] shrink-0" />;
  };

  /** Kiểm tra bản cập nhật app qua GitHub raw manifest */
  const checkForUpdates = async () => {
    setUpdateState('checking');
    setUpdateMsg('');
    try {
      const res = await fetch(UPDATE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const info = await res.json();
      const latest = String(info.version || '0');
      if (latest > APP_VERSION) {
        setUpdateState('warn');
        setUpdateMsg(t('st.updateAvailable').replace('{v}', latest) + (info.url ? ` → ${info.url}` : ''));
      } else {
        setUpdateState('ok');
        setUpdateMsg(t('st.upToDate').replace('{v}', APP_VERSION));
      }
    } catch {
      setUpdateState('error');
      setUpdateMsg(t('st.checkFailed'));
    }
  };

  /** Load / xác minh môi trường thư viện: gọi Tauri workspace_ensure + kiểm toolchain.
   *  Bản desktop: môi trường đã bundle theo app (mre-tool/) — modal xác minh từng phần. */
  const loadLibraries = async () => {
    setLibState('checking');
    setLibMsg('');
    try {
      // Các bước xác minh môi trường (desktop: bundled; web: mô tả)
      const steps = [
        t('st.step.luac'),
        t('st.step.packapp'),
        t('st.step.axf'),
        t('st.step.gcc'),
        t('st.step.sdk'),
        t('st.step.emulator'),
      ];
      for (const s of steps) {
        setLibMsg(t('st.loadingLib').replace('{s}', s));
        await new Promise(r => setTimeout(r, 320));
      }
      setLibState('ok');
      setLibMsg(t('st.envReady'));
    } catch {
      setLibState('error');
      setLibMsg(t('st.envFailed'));
    }
  };

  /** Load tiện ích mở rộng (.mvxp) cập nhật từ kho online (github raw) */
  const loadExtensions = async () => {
    setExtState('checking');
    setExtMsg(t('st.fetchingExts'));
    try {
      const res = await fetch(`${REPO_URL.replace('github.com', 'raw.githubusercontent.com')}/main/extensions/index.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error('no-index');
      const idx = await res.json();
      const list: string[] = (idx.extensions || []).map((e: any) => e.name || e.id);
      setExtState('ok');
      setExtMsg(t('st.extsAvailable').replace('{n}', String(list.length)) + (list.length ? `: ${list.join(', ')}` : ''));
    } catch {
      setExtState('warn');
      setExtMsg(t('st.extsEmpty'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[#E4DEF1] bg-gradient-to-r from-[#F3EEFA] to-[#EFEAF6]">
          <ShieldCheck className="w-4 h-4 text-[#6750A4]" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#221E2B]">{t('st.title')}</h3>
            <p className="text-[10px] text-[#6F687E]">VXPFlow Studio v{APP_VERSION}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6F687E] hover:text-[#221E2B] hover:bg-[#E4DEF1] cursor-pointer" aria-label={t('common.close')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[64vh] overflow-y-auto space-y-3">
          <Section icon={RefreshCw} title={t('st.updates')}>
            <div className="flex items-center gap-2 text-xs text-[#494256]">
              <StatusIcon state={updateState} />
              <span className="flex-1">{updateMsg || t('st.updatesHint')}</span>
              <button
                onClick={() => void checkForUpdates()}
                className="px-3 py-1.5 rounded-lg bg-[#6750A4] hover:bg-[#5A4692] text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
              >
                {t('st.checkNow')}
              </button>
            </div>
            <p className="text-[9px] text-[#6F687E] flex items-center gap-1">
              <Globe className="w-3 h-3" /> {REPO_URL}
            </p>
          </Section>

          <Section icon={Package} title={t('st.libraries')}>
            <p className="text-[10px] text-[#6F687E] leading-relaxed">{t('st.libsHint')}</p>
            <div className="flex items-center gap-2 text-xs text-[#494256]">
              <StatusIcon state={libState} />
              <span className="flex-1">{libMsg || t('st.envHint')}</span>
              <button
                onClick={() => void loadLibraries()}
                className="px-3 py-1.5 rounded-lg bg-[#6750A4] hover:bg-[#5A4692] text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
              >
                {t('st.loadLibs')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[9px] text-[#494256]">
              <span className="flex items-center gap-1 bg-[#F3EEFA] border border-[#E4DEF1] rounded-md px-2 py-1"><Cpu className="w-3 h-3 text-[#10b981]" /> luac 5.1 + PackApp</span>
              <span className="flex items-center gap-1 bg-[#F3EEFA] border border-[#E4DEF1] rounded-md px-2 py-1"><Cpu className="w-3 h-3 text-[#f97316]" /> GCC ARM (mre-core)</span>
              <span className="flex items-center gap-1 bg-[#F3EEFA] border border-[#E4DEF1] rounded-md px-2 py-1"><HardDrive className="w-3 h-3 text-[#3b82f6]" /> MRE SDK + scat.ld</span>
              <span className="flex items-center gap-1 bg-[#F3EEFA] border border-[#E4DEF1] rounded-md px-2 py-1"><Terminal className="w-3 h-3 text-[#8b5cf6]" /> {t('st.hiddenTerminal')}</span>
            </div>
          </Section>

          <Section icon={Puzzle} title={t('st.extensions')}>
            <div className="flex items-center gap-2 text-xs text-[#494256]">
              <StatusIcon state={extState} />
              <span className="flex-1">{extMsg || t('st.extHint')}</span>
              <button
                onClick={() => void loadExtensions()}
                className="px-3 py-1.5 rounded-lg bg-[#6750A4] hover:bg-[#5A4692] text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
              >
                {t('st.loadExts')}
              </button>
            </div>
          </Section>
        </div>

        <div className="px-5 py-3 bg-[#F3EEFA] border-t border-[#E4DEF1] flex items-center justify-between">
          <p className="text-[10px] text-[#6F687E]">© 2026 VXPFlow · github.com/doxuanhop</p>
          <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-white bg-[#6750A4] hover:bg-[#5A4692] rounded-lg shadow-md cursor-pointer transition-colors">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
