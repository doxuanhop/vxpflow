import { lua, lauxlib, lualib, to_luastring, to_jsstring } from '../vendor/fengariLite';
import { soundManager } from './audioSynth';

/* ------------------------------------------------------------------ *
 * LuaRuntime — máy ảo Lua (fengari) + bảng giả lập API MRE.
 *
 * Chạy được cả mã Lua sinh tự động từ Blocks lẫn mã viết tay kiểu
 * template (MRE.app_init / create_timer / draw_* / register_key_listener).
 * Mọi thao tác vẽ được gom thành "frame" và đẩy ra ngoài qua onFrame,
 * bấm phím qua sendKey, vòng lặp game qua step() (theo timer của MRE).
 * ------------------------------------------------------------------ */

export type LuaDrawOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string }
  | { kind: 'text'; text: string; x: number; y: number; color: string; size: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { kind: 'pixel'; x: number; y: number; color: string }
  | { kind: 'circle'; x: number; y: number; r: number; color: string }
  | { kind: 'sprite'; x: number; y: number; size: number; color: string; angle: number; name: string };

export type LuaLogLevel = 'info' | 'warn' | 'error';

export interface LuaRuntimeCallbacks {
  onFrame?: (ops: LuaDrawOp[], width: number, height: number) => void;
  onLog?: (message: string, level: LuaLogLevel) => void;
  onSound?: (name: string) => void;
  onVibrate?: (ms: number) => void;
  onExit?: () => void;
}

export interface LuaRunResult {
  ok: boolean;
  error?: string;
}

/** Bàn phím điện thoại: tên phím (từ UI giả lập) -> mã số (giống MRE VKEY) */
const KEY_CODES: Record<string, number> = {
  UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4, OK: 5,
  SOFT_LEFT: 6, SOFT_RIGHT: 7, CLEAR: 8, CALL: 9, END: 10,
  STAR: 42, POUND: 35,
  NUM0: 48, NUM1: 49, NUM2: 50, NUM3: 51, NUM4: 52,
  NUM5: 53, NUM6: 54, NUM7: 55, NUM8: 56, NUM9: 57
};

export function keyCodeForKeyName(name: string): number | null {
  let n = String(name || '').trim();
  if (!n) return null;
  if (n.startsWith('KEY_')) n = n.slice(4);
  if (/^\d$/.test(n)) return 48 + Number(n);
  if (n === '*') return KEY_CODES.STAR;
  if (n === '#') return KEY_CODES.POUND;
  if (n in KEY_CODES) return KEY_CODES[n];
  return null;
}

function colorToCss(raw: any, fallback = '#FFFFFF'): string {
  if (typeof raw === 'number') {
    const v = Math.max(0, Math.min(0xFFFFFF, Math.trunc(raw)));
    return `#${v.toString(16).padStart(6, '0')}`;
  }
  const s = String(raw ?? '').trim();
  if (/^#[\da-fA-F]{6}$/.test(s)) return s;
  if (/^#[\da-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  const m = s.match(/^0x([\da-fA-F]{6})$/);
  if (m) return `#${m[1]}`;
  return fallback;
}

const n = (v: any): number => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

const SND_NAMES: Record<string, 'click' | 'jump' | 'coin' | 'hit' | 'gameover' | 'powerup'> = {
  click: 'click', jump: 'jump', coin: 'coin', hit: 'hit', gameover: 'gameover', powerup: 'powerup'
};

interface TimerRec {
  ref: number;
  period: number;
  next: number;
  enabled: boolean;
  label: string;
}

interface SpriteRec {
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  angle: number;
}

export class LuaRuntime {
  private L: any = null;
  private width = 240;
  private height = 320;
  private keyRefs: number[] = [];
  private timers: TimerRec[] = [];
  private sprites: SpriteRec[] = [];
  private ops: LuaDrawOp[] = [];
  private cb: LuaRuntimeCallbacks;
  private exited = false;
  private instrBudget = 0;
  private lastError: string | null = null;

  // Số lệnh Lua tối đa cho mỗi lần chạy (chống vòng lặp vô hạn treo webview)
  private static MAX_INSTR = 8_000_000;
  private static HOOK_COUNT = 50_000;

  constructor(callbacks: LuaRuntimeCallbacks = {}) {
    this.cb = callbacks;
  }

  get running(): boolean {
    return this.L !== null && !this.exited;
  }

  get error(): string | null {
    return this.lastError;
  }

  private log(msg: string, level: LuaLogLevel = 'info') {
    try { this.cb.onLog?.(msg, level); } catch { /* ignore */ }
  }

  private pushStr(s: string) {
    lua.lua_pushstring(this.L, to_luastring(String(s)));
  }

  private argStr(idx: number, dflt = ''): string {
    const v = lua.lua_tolstring(this.L, idx);
    if (v === null || v === undefined) return dflt;
    return to_jsstring(v);
  }

  private argNum(idx: number, dflt = 0): number {
    if (lua.lua_isnoneornil(this.L, idx)) return dflt;
    return n(lua.lua_tonumber(this.L, idx));
  }

  private argBool(idx: number, dflt = false): boolean {
    if (lua.lua_isnoneornil(this.L, idx)) return dflt;
    const v = lua.lua_toboolean(this.L, idx);
    return typeof v === 'boolean' ? v : dflt;
  }

  /** Đọc màu từ đối số: chấp nhận số 0xRRGGBB lẫn chuỗi "#RRGGBB" */
  private argColor(idx: number, fallback = '#FFFFFF'): string {
    if (lua.lua_isnoneornil(this.L, idx)) return colorToCss(fallback, fallback);
    const t = lua.lua_type(this.L, idx);
    if (t === lua.LUA_TNUMBER) return colorToCss(lua.lua_tonumber(this.L, idx), fallback);
    return colorToCss(this.argStr(idx, fallback), fallback);
  }

  /** Chuyển giá trị lỗi đang ở đỉnh stack thành chuỗi thân thiện */
  private errMsgFromTop(): string {
    try {
      const t = lua.lua_type(this.L, -1);
      if (t === lua.LUA_TSTRING) {
        const raw = lua.lua_tolstring(this.L, -1);
        return raw ? to_jsstring(raw) : 'Lỗi không xác định';
      }
      lauxlib.luaL_tolstring(this.L, -1);
      const raw = lua.lua_tolstring(this.L, -1);
      return raw ? to_jsstring(raw) : 'Lỗi không xác định';
    } catch {
      return 'Lỗi không xác định';
    }
  }

  /**
   * Gọi hàm Lua (đã luaL_ref) với nargs đối số đã được đẩy lên stack.
   * Trả về false nếu có lỗi (thông điệp đã ghi log).
   */
  private callRefSafe(ref: number, nargs: number): boolean {
    const L = this.L;
    lua.lua_rawgeti(L, lua.LUA_REGISTRYINDEX, ref); // hàm (đang ở đỉnh)
    if (nargs > 0) lua.lua_insert(L, -(nargs + 1)); // đưa hàm XUỐNG DƯỚI các đối số
    const status = lua.lua_pcall(L, nargs, 0, 0);
    if (status !== 0) {
      const msg = this.errMsgFromTop();
      lua.lua_pop(L, 1);
      this.lastError = msg;
      this.log(`Lỗi Lua: ${msg}`, 'error');
      return false;
    }
    return true;
  }

  private resetBudget() {
    this.instrBudget = 0;
  }

  /** Gom các lệnh vẽ của frame hiện tại + nhân vật sprite, rồi đẩy ra ngoài */
  private flushFrame() {
    if (this.exited) return;
    const ops: LuaDrawOp[] = [...this.ops];
    for (const sp of this.sprites) {
      ops.push({ kind: 'sprite', x: sp.x, y: sp.y, size: sp.size, color: sp.color, angle: sp.angle, name: sp.name });
    }
    this.ops = [];
    try { this.cb.onFrame?.(ops, this.width, this.height); } catch { /* ignore */ }
  }

  /** Nạp + chạy toàn bộ script Lua (chunk chạy tới cùng, bao gồm main()) */
  start(code: string): LuaRunResult {
    this.dispose(true);
    const L = lauxlib.luaL_newstate();
    this.L = L;
    this.openLuaLibs(L);
    this.exited = false;
    this.lastError = null;
    this.keyRefs = [];
    this.timers = [];
    this.sprites = [];
    this.ops = [];
    this.width = 240;
    this.height = 320;

    // Chống treo: đếm lệnh Lua, quá ngân sách thì ném lỗi
    const self = this;
    const hook = (L_: any) => {
      self.instrBudget += LuaRuntime.HOOK_COUNT;
      if (self.instrBudget > LuaRuntime.MAX_INSTR) {
        lua.lua_pushstring(L_, to_luastring('Script chạy quá lâu (có thể vòng lặp vô hạn) — đã dừng an toàn'));
        lua.lua_error(L_);
      }
    };
    lua.lua_sethook(L, hook, lua.LUA_MASKCOUNT, LuaRuntime.HOOK_COUNT);

    this.registerMreApi();

    this.log('[MRE Kernel] Khởi tạo máy ảo Lua (fengari 5.1) trong Live Testing…', 'info');

    const loadStatus = lauxlib.luaL_loadstring(L, to_luastring(code));
    if (loadStatus !== 0) {
      let msg = 'Không phân tích được mã Lua';
      try {
        const raw = lua.lua_tolstring(L, -1);
        if (raw) msg = to_jsstring(raw);
      } catch { /* ignore */ }
      lua.lua_pop(L, 1);
      this.lastError = msg;
      this.log(`Lỗi biên dịch: ${msg}`, 'error');
      this.dispose();
      return { ok: false, error: msg };
    }

    // main() được gọi cuối chunk → app tự khởi tạo màn hình + timer
    this.resetBudget();
    const status = lua.lua_pcall(L, 0, 0, 0);
    if (status !== 0) {
      const msg = this.errMsgFromTop();
      lua.lua_pop(L, 1);
      this.lastError = msg;
      this.log(`Lỗi runtime: ${msg}`, 'error');
      this.dispose();
      return { ok: false, error: msg };
    }

    this.flushFrame();
    return { ok: true };
  }

  /** Tiến một nhịp giả lập: chạy các timer MRE đã tới hạn */
  step() {
    if (!this.L || this.exited) return;
    const now = Date.now();
    let fired = false;
    for (const t of this.timers) {
      if (!t.enabled) continue;
      if (now >= t.next) {
        t.next = now + t.period;
        this.resetBudget();
        if (this.callRefSafe(t.ref, 0)) fired = true;
        if (this.exited) return;
      }
    }
    if (fired) this.flushFrame();
  }

  /** Mô phỏng bấm phím điện thoại */
  sendKey(name: string, eventType: 'DOWN' | 'UP' = 'DOWN') {
    if (!this.L || this.exited) return;
    const code = keyCodeForKeyName(name);
    if (code === null) return;
    this.resetBudget();
    for (const ref of this.keyRefs) {
      lua.lua_pushnumber(this.L, code);
      this.pushStr(eventType);
      if (!this.callRefSafe(ref, 2)) return;
      if (this.exited) return;
    }
    this.flushFrame();
  }

  /**
   * Mở các thư viện Lua CẦN THIẾT (không mở io/os — chúng đụng process/Buffer
   * không tồn tại trong browser; ứng dụng vẽ qua API MRE nên không cần io/os).
   */
  private openLuaLibs(L: any) {
    const requiref = (name: string, openFn: any) => {
      lauxlib.luaL_requiref(L, to_luastring(name), openFn, 1);
      lua.lua_pop(L, 1);
    };
    requiref('_G', lualib.luaopen_base);
    requiref('package', lualib.luaopen_package);
    requiref('coroutine', lualib.luaopen_coroutine);
    requiref('table', lualib.luaopen_table);
    requiref('string', lualib.luaopen_string);
    requiref('math', lualib.luaopen_math);
  }

  /** Dừng + giải phóng máy ảo */
  dispose(silent = false) {
    if (this.L) {
      try {
        lua.lua_close(this.L);
      } catch { /* ignore */ }
      this.L = null;
    }
    if (!silent) this.log('[MRE Kernel] Đã dừng máy ảo Lua', 'info');
  }

  private registerMreApi() {
    const L = this.L;
    const self = this;

    const setFn = (tableName: string, fn: (L: any) => number) => {
      lua.lua_pushcfunction(L, fn);
      lua.lua_setfield(L, -2, to_luastring(tableName));
    };
    const setNum = (tableName: string, v: number) => {
      lua.lua_pushnumber(L, v);
      lua.lua_setfield(L, -2, to_luastring(tableName));
    };

    lua.lua_newtable(L); // bảng MRE

    setFn('log', () => {
      const top = lua.lua_gettop(L);
      const parts: string[] = [];
      for (let i = 1; i <= top; i++) {
        const t = lua.lua_type(L, i);
        if (t === lua.LUA_TSTRING) parts.push(self.argStr(i));
        else if (t === lua.LUA_TNUMBER) parts.push(String(lua.lua_tonumber(L, i)));
        else if (t === lua.LUA_TBOOLEAN) parts.push(String(lua.lua_toboolean(L, i)));
        else if (t === lua.LUA_TNIL) parts.push('nil');
        else parts.push(`(${t === lua.LUA_TTABLE ? 'table' : 'value'})`);
      }
      self.log(parts.join('\t'), 'info');
      return 0;
    });
    setFn('app_init', () => {
      const title = self.argStr(1, 'VXP App');
      self.width = Math.round(self.argNum(2, 240)) || 240;
      self.height = Math.round(self.argNum(3, 320)) || 320;
      self.log(`[MRE Display] Màn hình ${self.width}x${self.height} QVGA — ứng dụng “${title}”`, 'info');
      return 0;
    });
    setFn('draw_rect', () => {
      self.ops.push({ kind: 'rect', x: self.argNum(1), y: self.argNum(2), w: self.argNum(3), h: self.argNum(4), color: self.argColor(5, '#22C55E') });
      return 0;
    });
    setFn('draw_text', () => {
      self.ops.push({
        kind: 'text',
        text: self.argStr(1, ''),
        x: self.argNum(2),
        y: self.argNum(3),
        color: self.argColor(4, '#FFFFFF'),
        size: Math.max(6, Math.round(self.argNum(5, 12)))
      });
      return 0;
    });
    setFn('draw_line', () => {
      self.ops.push({ kind: 'line', x1: self.argNum(1), y1: self.argNum(2), x2: self.argNum(3), y2: self.argNum(4), color: self.argColor(5, '#22D3EE') });
      return 0;
    });
    setFn('draw_pixel', () => {
      self.ops.push({ kind: 'pixel', x: self.argNum(1), y: self.argNum(2), color: self.argColor(3, '#FBBF24') });
      return 0;
    });
    setFn('draw_circle', () => {
      self.ops.push({ kind: 'circle', x: self.argNum(1), y: self.argNum(2), r: Math.max(1, Math.abs(self.argNum(3))), color: self.argColor(4, '#F472B6') });
      return 0;
    });
    setFn('sound_play', () => {
      const name = self.argStr(1, 'click');
      const mapped = SND_NAMES[name] || 'click';
      try { soundManager.playSoundEffect(mapped); } catch { /* ignore */ }
      self.cb.onSound?.(name);
      self.log(`[MRE Sound] Phát hiệu ứng “${name}”`, 'info');
      return 0;
    });
    setFn('vibrate', () => {
      const ms = Math.max(0, Math.round(self.argNum(1, 50)));
      self.cb.onVibrate?.(ms);
      self.log(`[MRE Vibrate] Rung ${ms}ms`, 'info');
      return 0;
    });
    setFn('keypad_init', () => {
      const profile = self.argStr(1, 's30plus');
      self.log(`[KeyInit] Bàn phím cứng được khởi tạo: ${profile} (S30+/Nokia 225)`, 'info');
      return 0;
    });
    setFn('exit_app', () => {
      self.exited = true;
      self.log('[MRE Kernel] Ứng dụng gọi MRE.exit_app() — đã thoát', 'warn');
      try { self.cb.onExit?.(); } catch { /* ignore */ }
      return 0;
    });
    setFn('register_key_listener', (L_: any) => {
      if (lua.lua_type(L_, -1) !== lua.LUA_TFUNCTION) {
        lua.lua_pop(L_, 1);
        return 0;
      }
      const ref = lauxlib.luaL_ref(L_, lua.LUA_REGISTRYINDEX); // hàm đang ở -1
      self.keyRefs.push(ref);
      self.log('[MRE Kernel] Đã đăng ký bộ lắng nghe bàn phím', 'info');
      return 0;
    });
    setFn('create_timer', (L_: any) => {
      if (lua.lua_type(L_, -1) !== lua.LUA_TFUNCTION) {
        lua.lua_pop(L_, 1);
        return 0;
      }
      const period = Math.max(10, Math.round(self.argNum(1, 100)));
      const ref = lauxlib.luaL_ref(L_, lua.LUA_REGISTRYINDEX);
      const label = self.timers.length === 0 ? 'GameClock' : `Timer${self.timers.length + 1}`;
      self.timers.push({ ref, period, next: Date.now() + period, enabled: true, label });
      self.log(`[MRE Timer] Tạo ${label} chu kỳ ${period}ms`, 'info');
      return 0;
    });
    setFn('set_timer_state', () => {
      const name = self.argStr(1, 'GameClock');
      const enabled = self.argBool(2, true);
      let matched = false;
      for (const t of self.timers) {
        if (t.label === name) {
          t.enabled = enabled;
          matched = true;
        }
      }
      if (!matched && self.timers.length === 1) self.timers[0].enabled = enabled;
      self.log(`[MRE Timer] ${name} → ${enabled ? 'BẬT' : 'TẮT'}`, 'info');
      return 0;
    });
    setFn('sprite_create', () => {
      const name = self.argStr(1, 'Player');
      const color = self.argColor(2, '#22C55E');
      const size = Math.max(2, Math.round(self.argNum(3, 12)));
      const idx = self.sprites.findIndex(s => s.name === name);
      const rec: SpriteRec = { name, x: 0, y: 0, size, color, angle: 0 };
      if (idx >= 0) self.sprites[idx] = rec; else self.sprites.push(rec);
      self.log(`[MRE Sprite] Tạo nhân vật “${name}” cỡ ${size}`, 'info');
      return 0;
    });
    setFn('sprite_move', () => {
      const name = self.argStr(1, 'Player');
      const sp = self.sprites.find(s => s.name === name);
      if (sp) {
        sp.x = self.argNum(2);
        sp.y = self.argNum(3);
      }
      return 0;
    });
    setFn('sprite_rotate', () => {
      const name = self.argStr(1, 'Player');
      const sp = self.sprites.find(s => s.name === name);
      if (sp) sp.angle = self.argNum(2, 0) % 360;
      return 0;
    });

    // Hằng số phím (mã VKEY nội bộ của giả lập) — cả dạng ngắn (UP) lẫn KEY_ (KEY_UP)
    // vì template Lua và code sinh từ Blocks đều dùng MRE.KEY_OK / MRE.KEY_NUM5...
    for (const [k, v] of Object.entries(KEY_CODES)) {
      setNum(k, v);
      setNum(`KEY_${k}`, v);
    }

    lua.lua_setglobal(L, to_luastring('MRE'));

    // require("mre") cũng trả về cùng bảng MRE (cho code không chạy trong môi trường đặt sẵn)
    lua.lua_getglobal(L, to_luastring('package'));
    lua.lua_getfield(L, -1, to_luastring('preload'));
    lua.lua_pushcfunction(L, () => {
      lua.lua_getglobal(L, to_luastring('MRE'));
      return 1;
    });
    lua.lua_setfield(L, -2, to_luastring('mre'));
    lua.lua_pop(L, 2);
  }
}
