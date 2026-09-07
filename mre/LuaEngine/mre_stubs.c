/*****************************************************************************
 * mre_stubs.c
 * ---------------------------------------------------------------------------
 *  Cầu nối libc (newlib) sang runtime MRE cho LuaEngine.
 *
 *  - malloc/free/calloc/realloc chạy trên bộ cấp phát MRE (vm_malloc & co.)
 *    thay vì heap _sbrk của newlib — bắt buộc trên máy thật.
 *  - Các syscall POSIX (_open/_read/_write/_close/...) là stub trả lỗi vì
 *    MRE không cung cấp chúng; ứng dụng dùng vm_file_* thay thế.
 *****************************************************************************/

#include <stddef.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <reent.h>
#include "vmsys.h"
#include "vmlog.h"

/* ------------------- Bộ nhớ: MRE allocator ------------------- */

void *malloc(size_t size)
{
    return vm_malloc((int)size);
}

void free(void *ptr)
{
    vm_free(ptr);
}

void *calloc(size_t n, size_t size)
{
    return vm_calloc((int)(n * size));
}

void *realloc(void *ptr, size_t size)
{
    return vm_realloc(ptr, (int)size);
}

/* ------------------- Syscall stubs (POSIX) ------------------- */

int _close(int fd)
{
    (void)fd;
    errno = EBADF;
    return -1;
}

int _fstat(int fd, struct stat *st)
{
    (void)fd;
    (void)st;
    errno = EBADF;
    return -1;
}

int _isatty(int fd)
{
    (void)fd;
    return 0;
}

int _lseek(int fd, off_t offset, int whence)
{
    (void)fd;
    (void)offset;
    (void)whence;
    errno = EBADF;
    return -1;
}

int _open(const char *path, int flags, ...)
{
    (void)path;
    (void)flags;
    errno = ENOENT;
    return -1;
}

int _read(int fd, void *buf, size_t nbytes)
{
    (void)fd;
    (void)buf;
    (void)nbytes;
    errno = EBADF;
    return -1;
}

int _write(int fd, const void *buf, size_t nbytes)
{
    /* stdout/stderr của printf bị nuốt — log qua _vm_log_info nếu cần */
    (void)fd;
    (void)buf;
    return (int)nbytes;
}

void _exit(int code)
{
    _vm_log_error("[LuaEngine] _exit(%d) called", code);
    vm_exit_app();
    for (;;) { }
}

int _kill(int pid, int sig)
{
    (void)pid;
    (void)sig;
    errno = EINVAL;
    return -1;
}

int _getpid(void)
{
    return 1;
}

void abort(void)
{
    void *ra = __builtin_return_address(0);
    _vm_log_error("[LuaEngine] abort() called from %p", ra);
    vm_exit_app();
    for (;;) { }
}

/* Bắt assertion của newlib/Lua — log ra đúng vị trí vi phạm thay vì chết im */
void __assert_func(const char *file, int line, const char *func, const char *failedexpr)
{
    void *ra = __builtin_return_address(0);
    _vm_log_error("[LuaEngine] ASSERT %s:%d in %s: %s (caller %p)",
                  file ? file : "?", line, func ? func : "?",
                  failedexpr ? failedexpr : "?", ra);
    vm_exit_app();
    for (;;) { }
}

/* Init/fini của CRT — gccmain không dùng, chỉ cần tồn tại để newlib liên kết */
void _init(void)
{
}

void _fini(void)
{
}

/* newlib vẫn kéo _sbrk qua malloc nội bộ của stdio — nhưng mọi cấp phát
 * thật đều qua vm_malloc ở trên, nên _sbrk chỉ cần trả lỗi an toàn. */
/* ----------------------------------------------------------------
 * Reentrant allocators — newlib nội bộ (gdtoa/strtod/sprintf %f/stdio)
 * cấp phát qua _malloc_r/_realloc_r/_free_r/_calloc_r thay vì malloc()
 * công khai. Phải route chúng sang MRE allocator, nếu không chúng rơi
 * vào _sbrk (stub bên dưới) và chết vì hết bộ nhớ.
 * ---------------------------------------------------------------- */
void *_malloc_r(struct _reent *r, size_t nbytes)
{
    (void)r;
    return vm_malloc((int)nbytes);
}

void *_calloc_r(struct _reent *r, size_t n, size_t size)
{
    (void)r;
    return vm_calloc((int)(n * size));
}

void *_realloc_r(struct _reent *r, void *ptr, size_t nbytes)
{
    (void)r;
    return vm_realloc(ptr, (int)nbytes);
}

void _free_r(struct _reent *r, void *ptr)
{
    (void)r;
    vm_free(ptr);
}

void *_sbrk(ptrdiff_t incr)
{
    (void)incr;
    errno = ENOMEM;
    return (void *)-1;
}