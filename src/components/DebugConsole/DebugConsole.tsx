import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, ChevronUp, ChevronDown, Trash2, Copy, Search, 
  AlertTriangle, XCircle, CheckCircle2, Info, ArrowDown, 
  Cpu, Smartphone, ShieldCheck, PlayCircle, Filter
} from 'lucide-react';
import { debugLogger, DebugLog, LogCategory } from '../../utils/debugLogger';
import { useI18n } from '../../i18n';

interface DebugConsoleProps {
  isOpen: boolean;
  onToggle: () => void;
  onRunLuaCode?: () => void;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({
  isOpen,
  onToggle,
  onRunLuaCode
}) => {

  const { t } = useI18n();
  const [logs, setLogs] = useState<DebugLog[]>(() => debugLogger.getLogs());
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | 'errors'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to real-time logs
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && isOpen && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = 0; // Logs are unshifted (newest first) or reversed
    }
  }, [logs, autoScroll, isOpen]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Category filter
    if (selectedCategory === 'errors') {
      if (log.level !== 'error' && log.level !== 'warn') return false;
    } else if (selectedCategory !== 'all') {
      if (log.category !== selectedCategory) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const text = `${log.source} ${log.message} ${log.details || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  });

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  const handleClear = () => {
    debugLogger.clear();
  };

  const handleCopyLogs = () => {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}]: ${l.message} ${l.details ? `\nDetails: ${l.details}` : ''}`)
      .reverse()
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleSendTestLog = () => {
    debugLogger.info('Designer', 'Kiểm tra tín hiệu Debug Console thời gian thực');
    debugLogger.compiler('Biên dịch AST và phân giải địa chỉ MediaTek MRE thành công', 'success');
    debugLogger.emulator('Khởi tạo Framebuffer 240x320 RGB565 thành công (30fps)', 'info');
    debugLogger.warn('VXP Memory', 'Vùng nhớ Heap đạt 48% (504KB / 1024KB)');
  };

  return (
    <div 
      className={`border-t border-[#E4DEF1] bg-[#0E1015] flex flex-col shrink-0 select-none transition-all duration-200 z-30 ${
        isOpen ? 'h-56 md:h-64' : 'h-8'
      }`}
    >
      {/* Console Header Bar */}
      <div className="h-8 bg-[#F7F3FC] px-3 flex items-center justify-between border-b border-[#E8E1F3] text-xs">
        {/* Left: Title and Status Indicators */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 font-bold text-[#221E2B] hover:text-[#0284C7] transition-colors"
            title={isOpen ? 'Thu gọn bảng gỡ lỗi' : 'Mở rộng bảng gỡ lỗi'}
          >
            <Terminal className="w-3.5 h-3.5 text-[#0284C7]" />
            <span className="text-[11px]">Bảng điều khiển gỡ lỗi (Debug Console)</span>
            {isOpen ? (
              <ChevronDown className="w-3 h-3 text-[#494256]" />
            ) : (
              <ChevronUp className="w-3 h-3 text-[#494256]" />
            )}
          </button>

          {/* Error & Warning Badges */}
          <div className="flex items-center gap-1.5 text-[10px]">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-900/40 border border-red-700/60 text-red-600 font-mono font-semibold">
                <XCircle className="w-3 h-3 text-red-600" />
                {errorCount} lỗi
              </span>
            )}
            {warnCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-700/60 text-amber-600 font-mono font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                {warnCount} cảnh báo
              </span>
            )}
            {errorCount === 0 && warnCount === 0 && (
              <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-700 text-[9px] font-mono">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Không có lỗi
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2">
          {isOpen && (
            <>
              <button
                onClick={handleSendTestLog}
                className="hidden md:flex items-center gap-1 text-[10px] text-[#494256] hover:text-[#0284C7] px-2 py-0.5 rounded bg-[#1F242E] border border-[#2D3342] transition-colors"
                title="Gửi sự kiện log mẫu để kiểm tra thời gian thực"
              >
                <PlayCircle className="w-3 h-3" />
                <span>Gửi log mẫu</span>
              </button>

              <button
                onClick={handleCopyLogs}
                className="flex items-center gap-1 text-[10px] text-[#494256] hover:text-[#221E2B] px-2 py-0.5 rounded bg-[#1F242E] border border-[#2D3342] transition-colors"
                title="Sao chép toàn bộ log vào bộ nhớ tạm"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedNotification ? 'Đã sao chép!' : 'Sao chép'}</span>
              </button>

              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-[10px] text-[#494256] hover:text-red-600 px-2 py-0.5 rounded bg-[#1F242E] border border-[#2D3342] transition-colors"
                title="Xóa toàn bộ log"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa log</span>
              </button>
            </>
          )}

          <button
            onClick={onToggle}
            className="text-[10px] text-[#494256] hover:text-[#221E2B] p-1 rounded hover:bg-[#E8E1F3]"
          >
            {isOpen ? 'Thu nhỏ' : 'Mở rộng'}
          </button>
        </div>
      </div>

      {/* Console Body (Shown only when opened) */}
      {isOpen && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0C10] font-mono text-xs">
          {/* Subheader: Category filters & Search input */}
          <div className="px-3 py-1.5 bg-[#EFEAF6] border-b border-[#E8E1F3] flex flex-wrap items-center justify-between gap-2 text-[10px]">
            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'compiler', label: 'Biên dịch Lua' },
                { id: 'emulator', label: 'VXP Emulator' },
                { id: 'lua', label: 'Lua Runtime' },
                { id: 'errors', label: 'Lỗi & Cảnh báo' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id as any)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                    selectedCategory === tab.id
                      ? 'bg-[#7C3AED] text-white font-semibold shadow-sm'
                      : 'text-[#494256] hover:text-[#221E2B] hover:bg-[#F3EEFA]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search & Auto-scroll control */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3 h-3 text-[#6F687E] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm kiếm log..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#EFEAF6] border border-[#CBC3DD] rounded pl-6 pr-2 py-0.5 text-[10px] text-[#221E2B] placeholder-[#6F687E] outline-none focus:border-[#7C3AED] w-32 sm:w-44"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#494256] hover:text-[#221E2B]"
                  >
                    ×
                  </button>
                )}
              </div>

              <label className="flex items-center gap-1 cursor-pointer text-[#494256] hover:text-[#221E2B]">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="accent-[#7C3AED] w-3 h-3"
                />
                <span>{t('console.autoscroll')}</span>
              </label>
            </div>
          </div>

          {/* Logs List Window */}
          <div 
            ref={logsContainerRef}
            className="flex-1 overflow-y-auto p-2 space-y-1 text-[11px] leading-relaxed select-text"
          >
            {filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#6B7280] text-center p-4">
                <p>{t('console.empty')}</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isError = log.level === 'error';
                const isWarn = log.level === 'warn';
                const isSuccess = log.level === 'success';

                // Nền vùng log là TỐI (#0A0C10) → dùng chữ SÁNG tương phản
                const levelColor = 
                  isError ? 'text-red-400 bg-red-500/10 border-l-2 border-red-500' :
                  isWarn ? 'text-amber-300 bg-amber-500/10 border-l-2 border-amber-500' :
                  isSuccess ? 'text-emerald-400 bg-emerald-500/10' :
                  'text-[#D1D5DB]';

                const categoryBadge = 
                  log.category === 'compiler' ? 'bg-[#3B82F6]/25 text-[#93C5FD] border-[#3B82F6]/50' :
                  log.category === 'emulator' ? 'bg-[#047857]/25 text-[#6EE7B7] border-[#047857]/50' :
                  log.category === 'lua' ? 'bg-[#8B5CF6]/25 text-[#C4B5FD] border-[#8B5CF6]/50' :
                  'bg-[#374151]/60 text-[#D1D5DB] border-[#6B7280]/60';

                return (
                  <div 
                    key={log.id} 
                    className={`px-2 py-1 rounded hover:bg-[#1A1D24] transition-colors flex items-start gap-2 break-all ${levelColor}`}
                  >
                    {/* Timestamp */}
                    <span className="text-[#9CA3AF] shrink-0 font-mono text-[10px]">
                      [{log.timestamp}]
                    </span>

                    {/* Source / Category Badge */}
                    <span className={`px-1.5 py-0.2 rounded text-[9px] border shrink-0 font-semibold ${categoryBadge}`}>
                      {log.source}
                    </span>

                    {/* Message Body */}
                    <div className="flex-1 min-w-0">
                      <span>{log.message}</span>
                      {log.details && (
                        <pre className="mt-0.5 text-[10px] text-[#9CA3AF] bg-[#0A0C10] p-1.5 rounded border border-[#2D3342] overflow-x-auto whitespace-pre-wrap font-mono">
                          {log.details}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
