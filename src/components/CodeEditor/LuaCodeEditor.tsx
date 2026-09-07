import React, { useState } from 'react';
import { 
  Code, Play, RefreshCw, CheckCircle, AlertTriangle, 
  Copy, Sparkles, Terminal, FileCheck
} from 'lucide-react';

interface LuaCodeEditorProps {
  code: string;
  onChangeCode: (newCode: string) => void;
  onSyncFromBlocks: () => void;
  onRunInEmulator: () => void;
}

export const LuaCodeEditor: React.FC<LuaCodeEditorProps> = ({
  code,
  onChangeCode,
  onSyncFromBlocks,
  onRunInEmulator
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [syntaxStatus, setSyntaxStatus] = useState<'ok' | 'warning'>('ok');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertSnippet = (snippet: string) => {
    onChangeCode(code + '\n\n' + snippet);
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="flex-1 flex flex-col bg-[#EFEAF6] text-[#221E2B] overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#F7F3FC] border-b border-[#E4DEF1]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F3EEFA] border border-[#CBC3DD] text-[#047857] rounded text-xs font-mono">
            <FileCheck className="w-3.5 h-3.5" />
            <span>main.lua (Lua 5.2 S30+)</span>
          </div>
          <span className="text-xs text-[#494256] font-mono">{lineCount} dòng</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Snippet dropdown */}
          <div className="relative group">
            <button className="px-3 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] text-xs rounded border border-[#CBC3DD] hover:border-[#6750A4] flex items-center gap-1.5 transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Chèn Đoạn mẫu API MRE</span>
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-[#F7F3FC] border border-[#E4DEF1] rounded-lg shadow-xl w-64 py-1.5 z-20">
              <button
                onClick={() => insertSnippet('MRE.sound_play("coin")\nMRE.vibrate(50)')}
                className="w-full text-left px-3 py-2 text-xs text-[#221E2B] hover:bg-[#F3EEFA] hover:text-[#221E2B] transition-colors"
              >
                🔊 Phát âm thanh &amp; Rung máy
              </button>
              <button
                onClick={() => insertSnippet('MRE.draw_rect(x, y, 32, 32, 0x22C55E)')}
                className="w-full text-left px-3 py-2 text-xs text-[#221E2B] hover:bg-[#F3EEFA] hover:text-[#221E2B] transition-colors"
              >
                🟩 Vẽ hình chữ nhật màu
              </button>
              <button
                onClick={() => insertSnippet('local timer = MRE.create_timer(100, function()\n  -- Vòng lặp game ở đây\n  render()\nend)')}
                className="w-full text-left px-3 py-2 text-xs text-[#221E2B] hover:bg-[#F3EEFA] hover:text-[#221E2B] transition-colors"
              >
                ⏱️ Tạo đồng hồ chu kỳ game (Timer)
              </button>
              <button
                onClick={() => insertSnippet('MRE.register_key_listener(function(key, event)\n  if event == "DOWN" and key == MRE.KEY_OK then\n    MRE.log("Bấm phím OK")\n  end\nend)')}
                className="w-full text-left px-3 py-2 text-xs text-[#221E2B] hover:bg-[#F3EEFA] hover:text-[#221E2B] transition-colors"
              >
                🎮 Bắt sự kiện phím bấm Nokia
              </button>
            </div>
          </div>

          <button
            onClick={onSyncFromBlocks}
            className="px-3 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] text-xs rounded border border-[#CBC3DD] hover:border-[#6750A4] flex items-center gap-1.5 transition-colors"
            title="Tự động đồng bộ mã Lua từ các khối Blocks và màn hình Designer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#6750A4]" />
            <span>Đồng bộ từ Blocks</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] text-xs rounded border border-[#CBC3DD] hover:border-[#6750A4] flex items-center gap-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-[#494256]" />
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          <button
            onClick={onRunInEmulator}
            className="px-3.5 py-1.5 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Chạy Giả lập</span>
          </button>
        </div>
      </div>

      {/* Editor Area with Line Numbers */}
      <div className="flex-1 flex overflow-hidden font-mono text-sm relative">
        {/* Line numbers gutter */}
        <div className="w-12 bg-[#F7F3FC] border-r border-[#E4DEF1] py-3 text-right pr-3 select-none text-[#6F687E] text-xs leading-[21px] shrink-0">
          {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={code}
          onChange={(e) => onChangeCode(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-[#EFEAF6] text-[#221E2B] p-3 leading-[21px] text-xs font-mono resize-none focus:outline-none focus:ring-0 selection:bg-[#6750A4]/35"
          style={{
            tabSize: 2
          }}
        />
      </div>

      {/* Bottom status bar */}
      <div className="px-4 py-1.5 bg-[#F3EEFA] border-t border-[#E4DEF1] flex items-center justify-between text-xs text-[#494256]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#047857] animate-pulse" />
          <span className="text-[#221E2B] font-medium">MRE Runtime Engine: Sẵn sàng thực thi</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>Encoding: UTF-8</span>
          <span className="hidden sm:inline">Target: MRE 2.0 / 3.0 Nokia S30+</span>
        </div>
      </div>
    </div>
  );
};
