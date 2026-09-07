/** Stub cho gói "tmp" — fengari (loslib) require gói này lúc nạp nhưng không dùng. */
export const tmpNameSync = (): string => `/tmp/${Date.now()}.tmp`;
export const tmpdir = (): string => '/tmp';
export const dirSync = () => ({ name: '/tmp', fd: -1, removeCallback: () => undefined });
export const fileSync = () => ({ name: '/tmp/t', fd: -1, removeCallback: () => undefined });
export const setGracefulCleanup = (): void => undefined;
export default { tmpNameSync, tmpdir, dirSync, fileSync, setGracefulCleanup };
