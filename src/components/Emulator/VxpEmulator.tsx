import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2, VolumeX, Play, Pause,
  FastForward, Terminal, ShieldCheck, Gamepad2, Info, Bug
} from 'lucide-react';
import { VXPProject, EmulatorDevice, EmulatorLog } from '../../types';
import { soundManager } from '../../utils/audioSynth';
import { debugLogger } from '../../utils/debugLogger';
import { LuaRuntime, LuaDrawOp } from '../../utils/luaRuntime';
import { generateLuaFromProject, LUA_GEN_MARKER } from '../../utils/luaGenerator';

interface VxpEmulatorProps {
  project: VXPProject;
  luaCode: string;
  device: EmulatorDevice;
  onChangeDevice: (device: EmulatorDevice) => void;
}

/** Vẽ một frame (danh sách lệnh vẽ) do mã Lua đẩy ra lên canvas QVGA */
function paintFrame(ctx: CanvasRenderingContext2D, ops: LuaDrawOp[], w: number, h: number) {
  ctx.fillStyle = '#0B0D12';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (const op of ops) {
    switch (op.kind) {
      case 'rect': {
        ctx.fillStyle = op.color;
        ctx.fillRect(op.x, op.y, Math.max(0, op.w), Math.max(0, op.h));
        break;
      }
      case 'text': {
        ctx.fillStyle = op.color;
        ctx.font = `${op.size}px "Segoe UI", ui-sans-serif, sans-serif`;
        ctx.fillText(op.text, op.x, op.y);
        break;
      }
      case 'line': {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
        break;
      }
      case 'pixel': {
        ctx.fillStyle = op.color;
        ctx.fillRect(Math.round(op.x), Math.round(op.y), 1, 1);
        break;
      }
      case 'circle': {
        ctx.fillStyle = op.color;
        ctx.beginPath();
        ctx.arc(op.x, op.y, Math.max(1, op.r), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sprite': {
        // Nhân vật dạng ô vuông màu + mũi chỉ hướng xoay theo angle (độ)
        const s = Math.max(4, op.size);
        const rad = (op.angle * Math.PI) / 180;
        ctx.save();
        ctx.translate(op.x, op.y);
        ctx.rotate(rad);
        ctx.fillStyle = op.color;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath();
        ctx.moveTo(s * 0.55, 0);
        ctx.lineTo(0, -s * 0.3);
        ctx.lineTo(0, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }
}

export const VxpEmulator: React.FC<VxpEmulatorProps> = ({
  project,
  luaCode,
  device,
  onChangeDevice
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [showLogcat, setShowLogcat] = useState<boolean>(true);
  const [logs, setLogs] = useState<EmulatorLog[]>([
    { id: '1', timestamp: new Date().toTimeString().split(' ')[0], type: 'mre', message: '[MRE Kernel] Live Testing — khởi tạo môi trường MT6260/MT6261 VXP Runtime' },
    { id: '2', timestamp: new Date().toTimeString().split(' ')[0], type: 'mre', message: '[MRE Display] Màn hình 240x320 QVGA 16-bit RGB565 sẵn sàng' },
    { id: '3', timestamp: new Date().toTimeString().split(' ')[0], type: 'info', message: `[MRE Loader] Tải tệp thực thi: ${project.packageName}` }
  ]);
  const [vibrating, setVibrating] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [hasExited, setHasExited] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<LuaRuntime | null>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const vibTimer = useRef<number | null>(null);

  const addLog = (message: string, type: EmulatorLog['type'] = 'print') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLogs(prev => [...prev.slice(-60), { id: `log_${Date.now()}_${Math.random()}`, timestamp: timeStr, type, message }]);
    const level = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'info';
    debugLogger.emulator(message, level);
  };

  const triggerVibrate = (ms: number) => {
    setVibrating(true);
    if (vibTimer.current) window.clearTimeout(vibTimer.current);
    vibTimer.current = window.setTimeout(() => setVibrating(false), ms);
  };

  /** Bấm phím điện thoại → đẩy thẳng vào máy ảo Lua đang chạy */
  const handleMREKey = (keyCodeName: string) => {
    if (keyCodeName === 'CALL' || keyCodeName === 'END') {
      addLog(`Phím hệ thống "${keyCodeName}" — ứng dụng không nhận`, 'info');
      return;
    }
    addLog(`Phím bấm MRE: ${keyCodeName}`, 'info');
    const rt = runtimeRef.current;
    if (!rt || !rt.running) {
      addLog(`Chưa có máy ảo đang chạy — không chuyển phím ${keyCodeName}`, 'warn');
      return;
    }
    rt.sendKey(keyCodeName, 'DOWN');
  };

  // Khởi tạo máy ảo Lua + chạy đúng mã Lua (Blocks sinh ra / viết tay)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0B0D12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    const runtime = new LuaRuntime({
      onFrame: (ops, w, h) => {
        const cv = canvasRef.current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        paintFrame(ctx, ops, w, h);
      },
      onLog: (message, level) => {
        addLog(message, level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'mre');
      },
      onSound: () => { /* soundManager đã được runtime gọi trực tiếp */ },
      onVibrate: (ms) => triggerVibrate(ms),
      onExit: () => setHasExited(true)
    });
    runtimeRef.current = runtime;
    pausedRef.current = false;
    setHasExited(false);
    setRunError(null);

    // Ưu tiên: mã từ props (studio đồng bộ qua localStorage) → sinh từ Design/Blocks
    // Nếu customLuaCode trong localStorage đã cũ hoặc rỗng → tự sinh để đảm bảo
    // Giả lập hiển thị đúng nội dung Designer/Blocks.
    const code = (luaCode || '').trim()
      ? luaCode
      : generateLuaFromProject(
          project.components || [],
          project.blocks || [],
          project.name || 'VXP App',
          project.entryScreen || 'Screen1',
          project.extensions || [],
          project.resolution
        );

    const res = runtime.start(code);
    if (!res.ok) {
      setRunError(res.error || 'Không thể khởi chạy mã Lua');
      addLog(`Lỗi: ${res.error || 'không rõ'}`, 'error');
    }

    const iv = window.setInterval(() => {
      const rt = runtimeRef.current;
      if (!rt) return;
      if (pausedRef.current) return;
      const n = Math.max(1, Math.round(speedRef.current));
      for (let i = 0; i < n; i++) {
        if (!rt.running) break;
        rt.step();
      }
    }, 80);

    return () => {
      window.clearInterval(iv);
      runtime.dispose(true);
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, luaCode]);

  const togglePause = () => {
    const next = !isRunning;
    setIsRunning(next);
    pausedRef.current = !next;
    addLog(next ? 'Đã tiếp tục thực thi Lua' : 'Tạm dừng máy ảo', 'info');
  };

  const toggleSpeed = () => {
    const next = speedMultiplier === 1 ? 2 : 1;
    setSpeedMultiplier(next);
    speedRef.current = next;
    addLog(`Tốc độ giả lập: ${next}x`, 'info');
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#EFEAF6] text-[#221E2B]">
      {/* Emulator Header Control Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#F7F3FC] border-b border-[#E4DEF1] text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-[#221E2B] flex items-center gap-1.5">
            <Gamepad2 className="w-4 h-4 text-[#047857]" />
            Live Testing:
          </span>
          <div className="flex bg-[#EFEAF6] p-0.5 rounded-lg border border-[#E4DEF1]">
            <button
              onClick={() => onChangeDevice('s30plus')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                device === 's30plus' ? 'bg-[#6750A4] text-white' : 'text-[#494256] hover:text-[#221E2B]'
              }`}
            >
              Nokia S30+ (Bàn phím)
            </button>
            <button
              onClick={() => onChangeDevice('android')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                device === 'android' ? 'bg-[#6750A4] text-white' : 'text-[#494256] hover:text-[#221E2B]'
              }`}
            >
              Android (MREmu)
            </button>
          </div>
          <span
            className={`hidden xl:flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
              runError
                ? 'text-red-700 bg-red-50 border-red-200'
                : hasExited
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-[#047857] bg-emerald-50 border-emerald-200'
            }`}
            title={runError || (hasExited ? 'Ứng dụng đã gọi MRE.exit_app()' : 'Máy ảo Lua fengari đang chạy mã thật')}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${runError ? 'bg-red-500' : hasExited ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
            {runError ? 'Lỗi Lua' : hasExited ? 'Đã thoát' : 'Đang chạy Lua thật'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className="p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded border border-[#CBC3DD] transition-colors cursor-pointer"
            title={isRunning ? 'Tạm dừng' : 'Tiếp tục'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={toggleSpeed}
            className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
              speedMultiplier > 1 ? 'bg-[#B45309] border-[#D97706] text-white font-bold' : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#494256]'
            }`}
            title="Tua nhanh tốc độ"
          >
            <FastForward className="w-3 h-3 inline -mt-0.5 mr-0.5" />
            {speedMultiplier}x
          </button>

          <button
            onClick={toggleMute}
            className="p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded border border-[#CBC3DD] transition-colors cursor-pointer"
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-600" /> : <Volume2 className="w-3.5 h-3.5 text-[#047857]" />}
          </button>

          <button
            onClick={() => setShowLogcat(!showLogcat)}
            className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 border transition-colors cursor-pointer ${
              showLogcat ? 'bg-[#6750A4] text-white border-[#6750A4]' : 'bg-[#F3EEFA] text-[#494256] border-[#CBC3DD]'
            }`}
            title="Bảng ghi log của máy ảo Lua"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logcat</span>
          </button>
        </div>
      </div>

      {/* Main Emulator Stage */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Device Casing Viewport */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto geometric-dot-grid bg-[#EFEAF6]">
          {device === 's30plus' ? (
            /* NOKIA S30+ FEATURE PHONE CASING */
            <div
              className={`w-[290px] bg-gradient-to-b from-[#1F2937] to-[#16181D] border-4 border-[#2D2F36] rounded-[36px] p-4 shadow-2xl flex flex-col items-center select-none transition-transform duration-75 ${
                vibrating ? 'translate-x-1 -translate-y-1' : ''
              }`}
            >
              {/* Earpiece speaker */}
              <div className="w-12 h-1.5 bg-[#0F1115] rounded-full mb-3 border border-[#2D2F36] shadow-inner" />

              {/* Nokia Logo */}
              <div className="text-[11px] tracking-[3px] font-black text-[#9CA3AF] font-sans mb-2">
                NOKIA
              </div>

              {/* Screen Bezel & QVGA Canvas */}
              <div className="w-[246px] bg-[#05070A] p-0.5 rounded-lg border-2 border-[#2D2F36] shadow-inner mb-4 overflow-hidden">
                {/* Phone status header */}
                <div className="h-4 bg-[#0F1115] px-2 flex items-center justify-between text-[9px] text-[#9CA3AF] font-mono border-b border-[#2D2F36]">
                  <span className="text-[#38BDF8] font-bold">▲▲▲ Viettel</span>
                  <span>12:00</span>
                  <span className="text-[#10B981] font-bold">■■■ 98%</span>
                </div>

                <canvas
                  ref={canvasRef}
                  width={240}
                  height={320}
                  className="pixelated w-[240px] h-[320px] block bg-black"
                />

                {/* Lua status / error strip */}
                {runError ? (
                  <div className="bg-[#B91C1C] text-white text-[9px] font-mono px-1.5 py-0.5 leading-tight max-h-10 overflow-auto border-t border-[#2D2F36]" title={runError}>
                    <Bug className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                    {runError}
                  </div>
                ) : hasExited ? (
                  <div className="bg-[#78350F] text-white text-[9px] font-mono px-1.5 py-0.5 border-t border-[#2D2F36]">
                    ⏹ Ứng dụng đã thoát (MRE.exit_app)
                  </div>
                ) : null}
              </div>

              {/* Functional Keypad Area */}
              <div className="w-full space-y-2 px-1">
                {/* Soft keys and D-Pad */}
                <div className="grid grid-cols-3 gap-2 items-center">
                  {/* Left soft key & Call button */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleMREKey('SOFT_LEFT')}
                      className="h-8 bg-[#1F2937] active:bg-[#2D2F36] rounded-lg text-[10px] font-bold text-[#D1D5DB] shadow border border-[#374151] flex items-center justify-center transition-colors cursor-pointer"
                      title="Phím mềm trái"
                    >
                      --- L ---
                    </button>
                    <button
                      onClick={() => handleMREKey('CALL')}
                      className="h-8 bg-emerald-800 active:bg-emerald-700 rounded-lg text-[11px] font-bold text-white shadow border border-emerald-700 flex items-center justify-center transition-colors cursor-pointer"
                      title="Phím Gọi (hệ thống)"
                    >
                      📞 Gọi
                    </button>
                  </div>

                  {/* 4-way D-Pad with OK Center */}
                  <div className="relative w-24 h-24 bg-[#0F1115] rounded-full border-2 border-[#2D2F36] shadow-inner mx-auto flex items-center justify-center">
                    <button
                      onClick={() => handleMREKey('UP')}
                      className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-6 text-[10px] text-[#9CA3AF] active:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-t transition-colors cursor-pointer"
                      title="Lên (KEY_UP)"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMREKey('DOWN')}
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-6 text-[10px] text-[#9CA3AF] active:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-b transition-colors cursor-pointer"
                      title="Xuống (KEY_DOWN)"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => handleMREKey('LEFT')}
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-8 text-[10px] text-[#9CA3AF] active:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-l transition-colors cursor-pointer"
                      title="Trái (KEY_LEFT)"
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => handleMREKey('RIGHT')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-8 text-[10px] text-[#9CA3AF] active:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-r transition-colors cursor-pointer"
                      title="Phải (KEY_RIGHT)"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => handleMREKey('OK')}
                      className="w-10 h-10 rounded-full bg-[#1F2937] active:bg-[#4F46E5] border border-[#374151] text-xs font-bold text-white shadow flex items-center justify-center transition-colors cursor-pointer"
                      title="OK (KEY_OK)"
                    >
                      OK
                    </button>
                  </div>

                  {/* Right soft key & End button */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleMREKey('SOFT_RIGHT')}
                      className="h-8 bg-[#1F2937] active:bg-[#2D2F36] rounded-lg text-[10px] font-bold text-[#D1D5DB] shadow border border-[#374151] flex items-center justify-center transition-colors cursor-pointer"
                      title="Phím mềm phải"
                    >
                      --- R ---
                    </button>
                    <button
                      onClick={() => handleMREKey('END')}
                      className="h-8 bg-red-800 active:bg-red-700 rounded-lg text-[11px] font-bold text-white shadow border border-red-700 flex items-center justify-center transition-colors cursor-pointer"
                      title="Phím Kết thúc (hệ thống)"
                    >
                      ⏹ Kết thúc
                    </button>
                  </div>
                </div>

                {/* 3x4 T9 Numeric Keypad */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[
                    { key: '1', sub: '.,-' },
                    { key: '2', sub: 'abc' },
                    { key: '3', sub: 'def' },
                    { key: '4', sub: 'ghi' },
                    { key: '5', sub: 'jkl' },
                    { key: '6', sub: 'mno' },
                    { key: '7', sub: 'pqrs' },
                    { key: '8', sub: 'tuv' },
                    { key: '9', sub: 'wxyz' },
                    { key: '*', sub: '+' },
                    { key: '0', sub: '␣' },
                    { key: '#', sub: '⇧' }
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => {
                        if (btn.key === '*') handleMREKey('KEY_STAR');
                        else if (btn.key === '#') handleMREKey('KEY_POUND');
                        else handleMREKey(`KEY_${btn.key}`);
                      }}
                      className="h-8 bg-[#1F2937] active:bg-[#2D2F36] hover:bg-[#2D2F36] border border-[#374151] rounded-lg flex flex-col items-center justify-center shadow-sm text-[#D1D5DB] transition-colors cursor-pointer"
                      title={`Phím số ${btn.key}`}
                    >
                      <span className="text-xs font-bold leading-none">{btn.key}</span>
                      <span className="text-[8px] text-[#9CA3AF] leading-none">{btn.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ANDROID MRE RUNNER (MREmu) CASING */
            <div
              className={`w-[340px] bg-[#16181D] border-4 border-[#2D2F36] rounded-[36px] p-3 shadow-2xl flex flex-col items-center select-none relative transition-transform duration-75 ${
                vibrating ? 'translate-x-1 -translate-y-1' : ''
              }`}
            >
              {/* Camera punch hole */}
              <div className="w-3.5 h-3.5 bg-[#0F1115] rounded-full border border-[#2D2F36] mb-2 shadow-inner" />

              {/* Android top status bar */}
              <div className="w-full px-4 flex items-center justify-between text-[10px] text-[#9CA3AF] font-mono pb-2 border-b border-[#2D2F36] mb-2">
                <span>12:00</span>
                <div className="flex items-center gap-1.5">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* MREmu Top Action Bar */}
              <div className="w-full bg-[#0F1115] px-3 py-1.5 rounded-t-lg border border-[#2D2F36] flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#10B981] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  MREmu Runner (Lua thật)
                </span>
                <span className="text-[10px] text-[#9CA3AF] font-mono">240x320 @ ~10fps</span>
              </div>

              {/* Screen Area */}
              <div className="w-[246px] bg-[#05070A] p-0.5 rounded border-2 border-[#2D2F36] shadow-inner mb-4">
                <canvas
                  ref={canvasRef}
                  width={240}
                  height={320}
                  className="pixelated w-[240px] h-[320px] block bg-black"
                />
                {runError && (
                  <div className="bg-[#B91C1C] text-white text-[9px] font-mono px-1.5 py-0.5 leading-tight max-h-10 overflow-auto" title={runError}>
                    {runError}
                  </div>
                )}
              </div>

              {/* Android Virtual Gamepad Overlay */}
              <div className="w-full bg-[#0F1115]/90 border border-[#2D2F36] rounded-2xl p-3 flex items-center justify-between gap-4">
                {/* Virtual D-pad */}
                <div className="relative w-24 h-24 bg-[#16181D] rounded-full border border-[#2D2F36] flex items-center justify-center">
                  <button
                    onClick={() => handleMREKey('UP')}
                    className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-7 text-xs text-[#9CA3AF] active:bg-[#4F46E5] active:text-white rounded flex items-center justify-center transition-colors cursor-pointer"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => handleMREKey('DOWN')}
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-7 text-xs text-[#9CA3AF] active:bg-[#4F46E5] active:text-white rounded flex items-center justify-center transition-colors cursor-pointer"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => handleMREKey('LEFT')}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-8 text-xs text-[#9CA3AF] active:bg-[#4F46E5] active:text-white rounded flex items-center justify-center transition-colors cursor-pointer"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => handleMREKey('RIGHT')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-8 text-xs text-[#9CA3AF] active:bg-[#4F46E5] active:text-white rounded flex items-center justify-center transition-colors cursor-pointer"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => handleMREKey('OK')}
                    className="w-8 h-8 rounded-full bg-[#1F2937] active:bg-[#10B981] border border-[#374151] text-[10px] font-bold text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    OK
                  </button>
                </div>

                {/* Soft buttons & Action Buttons */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMREKey('SOFT_LEFT')}
                      className="px-2.5 py-1 bg-[#1F2937] active:bg-[#2D2F36] rounded text-[10px] text-[#D1D5DB] border border-[#374151] transition-colors cursor-pointer"
                    >
                      Soft L
                    </button>
                    <button
                      onClick={() => handleMREKey('SOFT_RIGHT')}
                      className="px-2.5 py-1 bg-[#1F2937] active:bg-[#2D2F36] rounded text-[10px] text-[#D1D5DB] border border-[#374151] transition-colors cursor-pointer"
                    >
                      Soft R
                    </button>
                  </div>

                  {/* A B Buttons */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleMREKey('KEY_5')}
                      className="w-10 h-10 rounded-full bg-[#4F46E5] active:bg-[#4338CA] text-white font-bold text-xs shadow-lg flex items-center justify-center transition-colors cursor-pointer"
                      title="Phím số 5 (B)"
                    >
                      B
                    </button>
                    <button
                      onClick={() => handleMREKey('OK')}
                      className="w-10 h-10 rounded-full bg-[#10B981] active:bg-[#059669] text-white font-bold text-xs shadow-lg flex items-center justify-center transition-colors cursor-pointer"
                      title="OK (A)"
                    >
                      A
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logcat Console Drawer — nhật ký của máy ảo Lua thật */}
        {showLogcat && (
          <div className="w-80 bg-[#EFEAF6] border-l border-[#E4DEF1] flex flex-col font-mono text-xs overflow-hidden min-w-0 shrink-0">
            <div className="flex items-center justify-between px-3 py-2 bg-[#F7F3FC] border-b border-[#E4DEF1]">
              <span className="font-bold text-[#221E2B] flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#0284C7]" />
                MRE Logcat (Lua thật)
              </span>
              <div className="flex items-center gap-2">
                <span className="hidden lg:flex items-center gap-1 text-[9px] text-[#6F687E] bg-[#F3EEFA] border border-[#E4DEF1] rounded-full px-1.5 py-0.5" title="Máy ảo fengari thực thi mã Lua sinh từ Blocks/template">
                  <Info className="w-2.5 h-2.5" />
                  fengari Lua 5.1
                </span>
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] text-[#494256] hover:text-[#221E2B] transition-colors cursor-pointer"
                >
                  Xóa log
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-1.5">
              {logs.map((log) => (
                <div key={log.id} className="text-[11px] leading-relaxed break-all">
                  <span className="text-[#6F687E] font-mono mr-1.5">[{log.timestamp}]</span>
                  <span
                    className={
                      log.type === 'error' ? 'text-red-600' :
                      log.type === 'warn' ? 'text-amber-600' :
                      log.type === 'mre' ? 'text-cyan-700' : 'text-[#221E2B]'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              {!runtimeRef.current && (
                <div className="text-[#6F687E] text-[10px] text-center py-4">
                  <span className="block mx-auto mb-1 animate-pulse text-base">●</span>
                  Đang khởi động máy ảo Lua…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
