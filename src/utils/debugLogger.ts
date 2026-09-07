export type LogLevel = 'info' | 'warn' | 'error' | 'success';
export type LogCategory = 'all' | 'compiler' | 'lua' | 'emulator' | 'system';

export interface DebugLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: 'compiler' | 'lua' | 'emulator' | 'system';
  source: string;
  message: string;
  details?: string;
}

type LogListener = (logs: DebugLog[]) => void;

class DebugLoggerService {
  private logs: DebugLog[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs: number = 500;

  constructor() {
    // Initial system seed logs
    this.addLog({
      level: 'info',
      category: 'system',
      source: 'MRE Studio Core',
      message: 'Khởi chạy môi trường phát triển Nokia S30+ VXP Studio v2.0'
    });
    this.addLog({
      level: 'info',
      category: 'compiler',
      source: 'Lua Bytecode Compiler',
      message: 'Lua 5.3 MRE Cross-Compiler đã sẵn sàng (MT6260/MT6261 ARMv7 Thumb-2)'
    });
    this.addLog({
      level: 'info',
      category: 'emulator',
      source: 'VXP Display Driver',
      message: 'Màn hình ảo 240x320 16-bit RGB565 kết nối thành công'
    });
  }

  private formatTime(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  }

  public addLog(entry: Omit<DebugLog, 'id' | 'timestamp'>): DebugLog {
    const fullLog: DebugLog = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: this.formatTime()
    };

    this.logs = [fullLog, ...this.logs].slice(0, this.maxLogs);
    this.notify();
    return fullLog;
  }

  public info(source: string, message: string, details?: string) {
    return this.addLog({ level: 'info', category: 'system', source, message, details });
  }

  public warn(source: string, message: string, details?: string) {
    return this.addLog({ level: 'warn', category: 'system', source, message, details });
  }

  public error(source: string, message: string, details?: string) {
    return this.addLog({ level: 'error', category: 'system', source, message, details });
  }

  public success(source: string, message: string, details?: string) {
    return this.addLog({ level: 'success', category: 'system', source, message, details });
  }

  public compiler(message: string, level: LogLevel = 'info', details?: string) {
    return this.addLog({ level, category: 'compiler', source: 'MRE Compiler', message, details });
  }

  public lua(message: string, level: LogLevel = 'info', details?: string) {
    return this.addLog({ level, category: 'lua', source: 'Lua VM', message, details });
  }

  public emulator(message: string, level: LogLevel = 'info', details?: string) {
    return this.addLog({ level, category: 'emulator', source: 'VXP Emulator', message, details });
  }

  public getLogs(): DebugLog[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Lỗi khi thông báo log listener:', err);
      }
    });
  }
}

export const debugLogger = new DebugLoggerService();
