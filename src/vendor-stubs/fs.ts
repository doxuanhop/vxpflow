/** Stub cho module Node "fs" — chỉ để các thư viện Node (tmp…) nạp được trong browser. */
const notImpl = (): never => {
  throw new Error('fs không khả dụng trong browser (stub fengari)');
};

export const constants = {
  O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2,
  O_CREAT: 64, O_EXCL: 128, O_NOCTTY: 256, O_TRUNC: 512, O_APPEND: 1024,
  O_DIRECTORY: 65536, O_NOFOLLOW: 131072, O_SYNC: 1052672, O_DIRECT: 16384,
  S_IFMT: 61440, S_IFREG: 32768, S_IFDIR: 16384, S_IFCHR: 8192, S_IFBLK: 24576,
  S_IFIFO: 4096, S_IFLNK: 40960, S_IFSOCK: 49152,
  S_IRUSR: 256, S_IWUSR: 128, S_IXUSR: 64,
  S_IRGRP: 32, S_IWGRP: 16, S_IXGRP: 8,
  S_IROTH: 4, S_IWOTH: 2, S_IXOTH: 1,
  F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
  UV_FS_SYMLINK_DIR: 1, UV_FS_SYMLINK_JUNCTION: 2,
  COPYFILE_EXCL: 1, COPYFILE_FICLONE: 2, COPYFILE_FICLONE_FORCE: 4
};

export const existsSync = (): boolean => false;
export const statSync = notImpl;
export const lstatSync = notImpl;
export const readFileSync = notImpl;
export const writeFileSync = notImpl;
export const mkdirSync = notImpl;
export const mkdtempSync = notImpl;
export const rmSync = notImpl;
export const unlinkSync = notImpl;
export const realpathSync = notImpl;
export const openSync = notImpl;
export const closeSync = notImpl;
export const readSync = notImpl;
export const writeSync = notImpl;
export const createReadStream = notImpl;
export const createWriteStream = notImpl;
export const readdirSync = notImpl;
