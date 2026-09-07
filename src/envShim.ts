/**
 * Polyfill tối thiểu cho `process` — fengari (máy ảo Lua viết bằng JS kiểu CommonJS)
 * đọc process.env/versions ngay khi module được nạp. Trong browser không có process
 * nên cần shim này chạy TRƯỚC khi bất kỳ module nào import fengari.
 */
const g = globalThis as any;
if (typeof g.global === 'undefined') {
  g.global = g; // fengari (loadlib) đọc biến global kiểu Node
}
if (typeof g.process === 'undefined') {
  g.process = {
    env: {},
    versions: { node: '99.0.0' },
    platform: 'browser',
    cwd: () => '/',
    nextTick: (fn: () => void) => Promise.resolve().then(fn),
    on: () => g.process,
    binding: () => ({}),
    stdout: { write: () => true },
    stderr: { write: () => true },
    stdin: {},
    exit: () => { /* no-op */ }
  };
}
export {};
