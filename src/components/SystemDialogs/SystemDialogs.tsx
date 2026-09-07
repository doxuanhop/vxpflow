import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AlertTriangle, HelpCircle, Info, Check, X, MessageSquare } from 'lucide-react';
import { useI18n } from '../../i18n';

/* ================================================================== *
 *  SystemDialogs — bộ hộp thoại TÙY CHỈNH thay window.prompt/confirm/alert
 *  - UI đẹp: backdrop mờ, card bo góc, icon màu, cuộn được, focus tự động
 *  - API promise: const { confirmDialog, promptDialog, infoDialog } = useSysDialogs()
 *      ok = await confirmDialog({ title, message, danger })
 *      text = await promptDialog({ title, label, placeholder, initial })
 *      await infoDialog({ title, message })
 * ================================================================== */

interface ConfirmOpts { title: string; message?: React.ReactNode; danger?: boolean; okLabel?: string; cancelLabel?: string; }
interface PromptOpts { title: string; label?: string; placeholder?: string; initial?: string; multiline?: boolean; okLabel?: string; cancelLabel?: string; }
interface InfoOpts { title: string; message?: React.ReactNode; icon?: 'info' | 'help' | 'warn'; okLabel?: string; }

type Dialog =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void }
  | { kind: 'info'; opts: InfoOpts; resolve: () => void };

interface SysDialogsCtx {
  confirmDialog: (o: ConfirmOpts) => Promise<boolean>;
  promptDialog: (o: PromptOpts) => Promise<string | null>;
  infoDialog: (o: InfoOpts) => Promise<void>;
}

const Ctx = createContext<SysDialogsCtx>({
  confirmDialog: async () => false,
  promptDialog: async () => null,
  infoDialog: async () => {},
});

export const useSysDialogs = (): SysDialogsCtx => useContext(Ctx);

export const SystemDialogsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      setInput(dialog.opts.initial ?? '');
      // focus sau khi DOM render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [dialog]);

  // Enter để xác nhận prompt (1 dòng); Escape hủy
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (dialog?.kind === 'confirm') dialog.resolve(false);
      else if (dialog?.kind === 'prompt') dialog.resolve(null);
      else if (dialog) dialog.resolve();
      setDialog(null);
    } else if (e.key === 'Enter' && dialog?.kind === 'prompt' && !dialog.opts.multiline) {
      e.stopPropagation();
      dialog.resolve(input);
      setDialog(null);
    }
  };

  const confirmDialog = useCallback((opts: ConfirmOpts) =>
    new Promise<boolean>(resolve => setDialog({ kind: 'confirm', opts, resolve })), []);
  const promptDialog = useCallback((opts: PromptOpts) =>
    new Promise<string | null>(resolve => setDialog({ kind: 'prompt', opts, resolve })), []);
  const infoDialog = useCallback((opts: InfoOpts) =>
    new Promise<void>(resolve => setDialog({ kind: 'info', opts, resolve })), []);

  const value = { confirmDialog, promptDialog, infoDialog };

  if (!dialog) return <Ctx.Provider value={value}>{children}</Ctx.Provider>;

  const { resolve, kind } = dialog;
  const opts: ConfirmOpts & PromptOpts & InfoOpts = dialog.opts as any;
  const { message } = opts;
  const danger = kind === 'confirm' && opts.danger;
  const icon =
    danger ? <AlertTriangle className="w-6 h-6 text-red-600" /> :
    kind === 'info' ? (opts.icon === 'help' ? <HelpCircle className="w-6 h-6 text-[#6750A4]" /> : opts.icon === 'warn' ? <AlertTriangle className="w-6 h-6 text-amber-500" /> : <Info className="w-6 h-6 text-[#0284C7]" />) :
    kind === 'prompt' ? <MessageSquare className="w-6 h-6 text-[#6750A4]" /> :
    <Check className="w-6 h-6 text-emerald-600" />;

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onKeyDown={onKeyDown}
        onClick={() => { if (kind === 'confirm') resolve(false); else if (kind === 'prompt') resolve(null); else resolve(); setDialog(null); }}
      >
        <div
          className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeIn_.15s_ease-out]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`px-5 py-4 flex items-start gap-3 border-b border-[#E4DEF1] ${danger ? 'bg-red-50' : 'bg-[#F3EEFA]'}`}>
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#221E2B] leading-snug">{opts.title}</h3>
            </div>
            <button
              onClick={() => { if (kind === 'confirm') resolve(false); else if (kind === 'prompt') resolve(null); else resolve(); setDialog(null); }}
              className="p-1 rounded-lg text-[#6F687E] hover:text-[#221E2B] hover:bg-[#E4DEF1] transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto text-xs text-[#494256] leading-relaxed">
            {typeof message === 'string' ? (
              <p className="whitespace-pre-wrap break-words">{message}</p>
            ) : message}
            {kind === 'prompt' && (
              <div className="mt-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  placeholder={opts.placeholder}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full mt-2 bg-white border border-[#CBC3DD] focus:border-[#6750A4] rounded-lg px-3 py-2 text-[#221E2B] text-sm focus:outline-none transition-colors"
                />
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-[#F3EEFA] border-t border-[#E4DEF1] flex items-center justify-end gap-2">
            {kind !== 'info' && (
              <button
                onClick={() => { if (kind === 'confirm') resolve(false); else if (kind === 'prompt') resolve(null); setDialog(null); }}
                className="px-4 py-2 text-xs font-semibold text-[#494256] bg-[#FDFCFF] border border-[#CBC3DD] hover:bg-[#E4DEF1] rounded-lg transition-colors cursor-pointer"
              >
                {kind === 'prompt' ? (opts as PromptOpts).cancelLabel ?? 'Hủy' : (opts as ConfirmOpts).cancelLabel ?? 'Hủy'}
              </button>
            )}
            <button
              onClick={() => {
                if (kind === 'confirm') resolve(true);
                else if (kind === 'prompt') resolve(input);
                else resolve();
                setDialog(null);
              }}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-md transition-colors cursor-pointer ${
                danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#6750A4] hover:bg-[#5A4692]'
              }`}
            >
              {kind === 'prompt' || kind === 'confirm'
                ? (opts as PromptOpts).okLabel ?? 'OK'
                : (opts as InfoOpts).okLabel ?? 'Đã hiểu'}
            </button>
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
};
