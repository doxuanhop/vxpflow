declare module 'fengari' {
  const lua: any;
  const lauxlib: any;
  const lualib: any;
  function to_luastring(s: string): Uint8Array;
  function to_jsstring(u: Uint8Array | null | undefined): string;
  export { lua, lauxlib, lualib, to_luastring, to_jsstring };
}

declare module 'fengari/src/*.js' {
  const mod: any;
  export = mod;
}
