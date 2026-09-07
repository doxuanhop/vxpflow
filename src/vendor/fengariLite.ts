/**
 * Nạp fengari qua từng module con thay vì gói "fengari" đầy đủ.
 *
 * Gói gốc (src/fengari.js) kéo theo lualib → loslib (`require('tmp')`) và
 * liolib (`require('fs')`) — những module Node không tồn tại trong browser.
 * Máy ảo chỉ cần lõi + các thư viện base/table/string/math/coroutine/package,
 * nên import thẳng file con để tránh toàn bộ chuỗi phụ thuộc Node.
 */
// @ts-ignore — module không có typings; xem src/fengari.d.ts
import * as luaCore from 'fengari/src/lua.js';
// @ts-ignore
import * as lauxCore from 'fengari/src/lauxlib.js';
// @ts-ignore
import * as coreBase from 'fengari/src/lbaselib.js';
// @ts-ignore
import * as coreCoroutine from 'fengari/src/lcorolib.js';
// @ts-ignore
import * as coreTable from 'fengari/src/ltablib.js';
// @ts-ignore
import * as coreString from 'fengari/src/lstrlib.js';
// @ts-ignore
import * as coreMath from 'fengari/src/lmathlib.js';
// @ts-ignore
import * as corePackage from 'fengari/src/loadlib.js';

export const lua: any = luaCore;
export const lauxlib: any = lauxCore;
export const lualib: any = {
  luaopen_base: (coreBase as any).luaopen_base,
  luaopen_package: (corePackage as any).luaopen_package,
  luaopen_coroutine: (coreCoroutine as any).luaopen_coroutine,
  luaopen_table: (coreTable as any).luaopen_table,
  luaopen_string: (coreString as any).luaopen_string,
  luaopen_math: (coreMath as any).luaopen_math
};

export function to_luastring(s: string): Uint8Array {
  return (coreBase as any).to_luastring ? (coreBase as any).to_luastring(s) : new TextEncoder().encode(s);
}
export function to_jsstring(u: Uint8Array | null | undefined): string {
  if (!u) return '';
  try {
    return new TextDecoder().decode(u);
  } catch {
    return '';
  }
}
