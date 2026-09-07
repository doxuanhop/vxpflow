/** Stub cho module Node "os" — fengari (luaconf) gọi os.platform() lúc nạp module. */
export const platform = (): string => 'linux';
export const tmpdir = (): string => '/tmp';
export const hostname = (): string => 'vxpengine-browser';
export const type = (): string => 'Browser';
export const release = (): string => '0.0.0';
export const cpus = (): { model: string; speed: number }[] => [{ model: 'browser-vm', speed: 1 }];
export const arch = (): string => 'js';
export const EOL = '\n';
