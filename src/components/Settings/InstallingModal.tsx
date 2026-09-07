import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Cpu, HardDrive, Terminal, ShieldCheck, Boxes } from 'lucide-react';
import { useI18n } from '../../i18n';

/* ================================================================== *
 *  InstallingModal — chạy LẦN ĐẦU mở VXPFlow (flag localStorage):
 *  hiển thị tiến độ cài môi trường phát triển đầy đủ (toolchain bundled).
 *  Sau khi hoàn tất (bấm nút hoặc tự ghi flag) KHÔNG hiện lại nữa —
 *  kể cả khi quay về Hub từ Designer.
 * ================================================================== */

const KEY = 'vxpflow_env_installed';

export const InstallingModal: React.FC = () => {
  const { t } = useI18n();
  const [step, setStep] = useState(0); // 0..5
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // đã từng cài môi trường → KHÔNG bao giờ hiện lại
    let already: boolean;
    try { already = localStorage.getItem(KEY) === '1'; } catch { already = true; }
    if (already) return;

    setVisible(true);
    const timers: number[] = [];
    let acc = 400;
    [1, 2, 3, 4, 5].forEach(s => {
      acc += 620;
      timers.push(window.setTimeout(() => setStep(s), acc));
    });
    timers.push(window.setTimeout(() => setDone(true), acc + 600));
    return () => timers.forEach(id => window.clearTimeout(id));
  }, []);

  if (!visible) return null;

  const ROWS = [
    { k: 'in.step1', icon: ShieldCheck },
    { k: 'in.step2', icon: Cpu },
    { k: 'in.step3', icon: HardDrive },
    { k: 'in.step4', icon: Boxes },
    { k: 'in.step5', icon: Terminal },
  ];

  const finish = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[#0F1115]/90 backdrop-blur-md p-4">
      <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 flex items-center gap-3 bg-gradient-to-r from-[#F3EEFA] to-[#EFEAF6] border-b border-[#E4DEF1]">
          <img src="/app-icon.png" alt="VXPFlow" className="w-11 h-11 rounded-lg object-cover shadow-md" />
          <div>
            <h3 className="text-sm font-bold text-[#221E2B]">{t('in.title')}</h3>
            <p className="text-[10px] text-[#6F687E]">{t('in.sub')}</p>
          </div>
        </div>
        <div className="px-6 py-4 space-y-2.5">
          {ROWS.map((r, i) => {
            const n = i + 1;
            const active = step === n && !done;
            const ok = step > n || done;
            return (
              <div key={r.k} className={`flex items-center gap-2.5 text-xs transition-opacity ${step >= n || done ? 'opacity-100' : 'opacity-40'}`}>
                {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    : active ? <Loader2 className="w-4 h-4 text-[#6750A4] animate-spin shrink-0" />
                    : <r.icon className="w-4 h-4 text-[#A79EBD] shrink-0" />}
                <span className={`font-medium ${ok ? 'text-[#221E2B]' : 'text-[#494256]'}`}>{t(r.k)}</span>
              </div>
            );
          })}
          {done && (
            <p className="pt-2 text-[11px] text-emerald-700 font-semibold border-t border-[#E4DEF1]">{t('in.done')}</p>
          )}
        </div>
        <div className="px-6 py-3.5 bg-[#F3EEFA] border-t border-[#E4DEF1] flex justify-end">
          <button
            disabled={!done}
            onClick={finish}
            className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-md transition-colors ${done ? 'bg-[#6750A4] hover:bg-[#5A4692] cursor-pointer' : 'bg-[#A79EBD] cursor-wait'}`}
          >
            {t('in.go')}
          </button>
        </div>
      </div>
    </div>
  );
};
