/*****************************************************************************
 * LuaEngine.c
 * ---------------------------------------------------------------------------
 *  VXPEngine Studio — Lua runtime cho MediaTek MRE (Nokia S30+ / MT6260-61)
 *
 *  Nguyên lý hoạt động trên MRE (theo thiết kế dự án):
 *    1. Lua Core (C code): toàn bộ mã nguồn máy ảo Lua C thuần (Lua 5.1.5)
 *       nằm trong mre/lua-5.1.5/src và được đưa vào dự án MRE này.
 *    2. MRE SDK biên dịch khối C này thành file thực thi LuaEngine.vxp
 *       (xem BuildApp.bat — ARM GCC + scat.ld + PackDigist).
 *    3. Khi khởi chạy trên điện thoại, runtime đọc script của ứng dụng:
 *       a) ƯU TIÊN: script.lub nhúng ngay trong .vxp (resource) — script
 *          được luac biên dịch + PackRes nhúng lúc build (build_project_vxp).
 *       b) FALLBACK: script.lua trên thẻ nhớ \mod\LuaEngine\script.lua.
 *
 *  Bảng MRE (MRE.draw_rect / MRE.draw_text / MRE.KEY_*) khớp 100% với
 *  luaGenerator của studio + giả lập fengari trong web.
 *
 *  Các hàm Lua mà script có thể dùng (đăng ký ở register_bindings):
 *    mre_draw_text(x, y, text, color565, size)   -- vẽ chữ (ASCII, UCS2 nội bộ)
 *    mre_fill_rect(x, y, w, h, color565)         -- tô hình chữ nhật
 *    mre_get_screen_size()                       -- trả về (w, h)
 *    mre_set_interval(ms)                        -- bật vòng lặp: gọi on_frame(ms)
 *    mre_clear_interval()                        -- tắt vòng lặp
 *    mre_vibrate()                               -- rung máy 1 giây
 *    mre_log(msg)                                -- ghi log hệ thống MRE
 *    mre_exit()                                  -- thoát ứng dụng
 *    mre_flush()                                 -- đẩy bộ đệm vẽ ra màn hình
 *
 *  Callback mà script định nghĩa:
 *    on_init()      -- chạy ngay sau khi nạp script
 *    on_paint()     -- mỗi lần màn hình yêu cầu vẽ lại
 *    on_frame()     -- mỗi nhịp của mre_set_interval (game loop)
 *    on_key(key, event) -- phím bấm (VM_KEY_* , VM_KEY_EVENT_*)
 *    on_key_event(key_code, event_type) -- điều phối phím của luaGenerator
 *      (event_type là chuỗi "DOWN"/"UP"; gọi render() sau nếu có)
 *****************************************************************************/

#include "vmsys.h"
#include "vmio.h"
#include "vmgraph.h"
#include "vmchset.h"
#include "vmstdlib.h"
#include "vm4res.h"
#include "vmres.h"
#include "vmtimer.h"
#include "vmlog.h"
#include "vmmm.h"
#include "ResID.h"

#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"

#define LOG_TAG "LuaEngine"

/* Đường dẫn script trên thẻ nhớ (fallback khi .vxp không nhúng script.lub) */
#define SCRIPT_PATH_1 "\\mod\\LuaEngine\\script.lua"
#define SCRIPT_PATH_2 "\\mre\\LuaEngine\\script.lua"

static VMINT g_layer = -1;        /* layer vẽ toàn màn hình */
static lua_State *g_L = NULL;     /* máy ảo Lua */
static VMINT g_timer = -1;        /* timer game loop */
static VMUINT g_interval = 100;   /* chu kỳ mặc định 100ms */
static VMBOOL g_script_ok = FALSE;

static void call_lua(const char *fname, VMINT nargs);
static void on_timer(VMINT tid);

/* ------------------------------------------------------------------ */
/* Tiện ích vẽ                                                         */
/* ------------------------------------------------------------------ */

/* 0xRRGGBB -> RGB565 */
static void set_color_565(VMUINT rgb)
{
    vm_graphic_color c;
    c.vm_color_565 = (VMUINT)(((((rgb >> 16) & 0xFF) >> 3) << 11) |
                              ((((rgb >> 8) & 0xFF) >> 2) << 5) |
                              (((rgb) & 0xFF) >> 3));
    vm_graphic_setcolor(&c);
}

static VMUINT ucs2_len(const VMUINT16 *s)
{
    VMUINT n = 0;
    while (s[n] != 0) n++;
    return n;
}

/* Giải mã UTF-8 -> UCS-2: script Lua sinh từ VXPFlow dùng chuỗi UTF-8
   (tiếng Việt "Bấm vào đây!" v.v.). vm_ascii_to_ucs2 coi mỗi byte là 1 ký
   tự -> hiển thị ký tự rác. Tự giải mã đúng chuẩn UTF-8 (1-3 byte). */
static VMUINT utf8_to_ucs2(const char *src, VMUINT16 *dst, VMUINT max_chars)
{
    VMUINT n = 0;
    const unsigned char *p = (const unsigned char *)src;
    while (*p && n < max_chars - 1) {
        unsigned char c = *p;
        if (c < 0x80) {
            dst[n++] = (VMUINT16)c;
            p += 1;
        } else if ((c & 0xE0) == 0xC0 && (p[1] & 0xC0) == 0x80) {
            dst[n++] = (VMUINT16)(((VMUINT16)(c & 0x1F) << 6) | (p[1] & 0x3F));
            p += 2;
        } else if ((c & 0xF0) == 0xE0 && (p[1] & 0xC0) == 0x80 && (p[2] & 0xC0) == 0x80) {
            dst[n++] = (VMUINT16)(((VMUINT16)(c & 0x0F) << 12)
                                  | ((VMUINT16)(p[1] & 0x3F) << 6)
                                  | (p[2] & 0x3F));
            p += 3;
        } else {
            /* byte không hợp lệ: bỏ qua để không in rác */
            p += 1;
        }
    }
    dst[n] = 0;
    return n;
}

static void draw_text_xy(VMINT x, VMINT y, const char *text, VMINT size, VMUINT color)
{
    VMUINT16 wbuf[128];
    VMUINT len;

    if (g_layer < 0) return;
    len = utf8_to_ucs2(text, wbuf, 128);
    if (len > 127) len = 127;
    if (size > 0) vm_font_set_font_size(size);
    set_color_565(color);
    vm_graphic_textout_to_layer(g_layer, x, y, wbuf, (VMINT)len);
}

static void fill_rect_xy(VMINT x, VMINT y, VMINT w, VMINT h, VMUINT color)
{
    if (g_layer < 0) return;
    set_color_565(color);
    vm_graphic_fill_rect_ex(g_layer, x, y, w, h);
}

static void flush_screen(void)
{
    if (g_layer >= 0) vm_graphic_flush_layer(&g_layer, 1);
}

/* ------------------------------------------------------------------ */
/* Hàm Lua bindings sang MRE                                            */
/* ------------------------------------------------------------------ */

static int l_mre_draw_text(lua_State *L)
{
    VMINT x = (VMINT)luaL_checknumber(L, 1);
    VMINT y = (VMINT)luaL_checknumber(L, 2);
    const char *text = luaL_checkstring(L, 3);
    VMUINT color = (VMUINT)luaL_optnumber(L, 4, 0xFFFFFF);
    VMINT size = (VMINT)luaL_optnumber(L, 5, 12);
    draw_text_xy(x, y, text, size, color);
    return 0;
}

static int l_mre_fill_rect(lua_State *L)
{
    VMINT x = (VMINT)luaL_checknumber(L, 1);
    VMINT y = (VMINT)luaL_checknumber(L, 2);
    VMINT w = (VMINT)luaL_checknumber(L, 3);
    VMINT h = (VMINT)luaL_checknumber(L, 4);
    VMUINT color = (VMUINT)luaL_optnumber(L, 5, 0x000000);
    fill_rect_xy(x, y, w, h, color);
    return 0;
}

static int l_mre_get_screen_size(lua_State *L)
{
    lua_pushnumber(L, (lua_Number)vm_graphic_get_screen_width());
    lua_pushnumber(L, (lua_Number)vm_graphic_get_screen_height());
    return 2;
}

static int l_mre_log(lua_State *L)
{
    const char *msg = luaL_optstring(L, 1, "");
    _vm_log_info("[%s] %s", LOG_TAG, msg);
    return 0;
}

static int l_mre_set_interval(lua_State *L)
{
    VMUINT ms = (VMUINT)luaL_checknumber(L, 1);
    g_interval = (ms > 0 && ms <= 60000) ? ms : 100;
    if (g_timer >= 0)
    {
        vm_delete_timer(g_timer);
        g_timer = -1;
    }
    g_timer = vm_create_timer(g_interval, on_timer);
    if (g_timer < 0) _vm_log_error("[%s] cannot create timer (%d)", LOG_TAG, g_timer);
    return 0;
}

static int l_mre_clear_interval(lua_State *L)
{
    (void)L;
    if (g_timer >= 0)
    {
        vm_delete_timer(g_timer);
        g_timer = -1;
    }
    return 0;
}

static int l_mre_vibrate(lua_State *L)
{
    (void)L;
    vm_vibrator_once();
    return 0;
}

static int l_mre_exit(lua_State *L)
{
    (void)L;
    vm_exit_app();
    return 0;
}

static int l_mre_flush(lua_State *L)
{
    (void)L;
    flush_screen();
    return 0;
}

/* Bẫy lỗi nghiêm trọng của Lua (unprotected error) — ghi ra log MRE thay vì abort() */
static int lua_panic_handler(lua_State *L)
{
    _vm_log_error("[%s] Lua PANIC: %s", LOG_TAG, lua_tostring(L, -1) ? lua_tostring(L, -1) : "unknown");
    return 0;
}

/* Ghi đè print() của Lua: đưa về log MRE thay vì stdout */
static int l_print(lua_State *L)
{
    const char *s = lua_tostring(L, 1);
    if (s) _vm_log_info("[Lua print] %s", s);
    return 0;
}

static void register_bindings(lua_State *L)
{
    lua_register(L, "mre_draw_text", l_mre_draw_text);
    lua_register(L, "mre_fill_rect", l_mre_fill_rect);
    lua_register(L, "mre_get_screen_size", l_mre_get_screen_size);
    lua_register(L, "mre_log", l_mre_log);
    lua_register(L, "mre_set_interval", l_mre_set_interval);
    lua_register(L, "mre_clear_interval", l_mre_clear_interval);
    lua_register(L, "mre_vibrate", l_mre_vibrate);
    lua_register(L, "mre_exit", l_mre_exit);
    lua_register(L, "mre_flush", l_mre_flush);
    lua_register(L, "print", l_print);
}

/* ------------------------------------------------------------------ */
/* Bảng MRE cho script: MRE.draw_rect / draw_text / KEY_*              */
/* (khớp 100% luaGenerator + giả lập fengari của studio)               */
/* ------------------------------------------------------------------ */

/* Các callback Lua đã đăng ký qua MRE.create_timer(ms, fn) — tối đa 8 */
#define MAX_LUA_TIMERS 8
static int g_lua_timer_refs[MAX_LUA_TIMERS];
static int g_lua_timer_count = 0;

static int lm_draw_text(lua_State *L)
{
    const char *text = luaL_checkstring(L, 1);
    VMINT x = (VMINT)luaL_checknumber(L, 2);
    VMINT y = (VMINT)luaL_checknumber(L, 3);
    VMUINT color = (VMUINT)luaL_optnumber(L, 4, 0xFFFFFF);
    VMINT size = (VMINT)luaL_optnumber(L, 5, 12);
    draw_text_xy(x, y, text, size, color);
    return 0;
}

static int lm_draw_rect(lua_State *L)
{
    VMINT x = (VMINT)luaL_checknumber(L, 1);
    VMINT y = (VMINT)luaL_checknumber(L, 2);
    VMINT w = (VMINT)luaL_checknumber(L, 3);
    VMINT h = (VMINT)luaL_checknumber(L, 4);
    VMUINT color = (VMUINT)luaL_optnumber(L, 5, 0x22C55E);
    fill_rect_xy(x, y, w, h, color);
    return 0;
}

static int lm_log(lua_State *L)
{
    const char *msg = luaL_optstring(L, 1, "");
    _vm_log_info("[%s] %s", LOG_TAG, msg);
    return 0;
}

static int lm_app_init(lua_State *L)
{
    /* app_init(title, w, h) — kích thước thực lấy từ màn hình MRE */
    (void)luaL_optstring(L, 1, "VXP App");
    _vm_log_info("[%s] app_init: %dx%d", LOG_TAG,
                 vm_graphic_get_screen_width(), vm_graphic_get_screen_height());
    return 0;
}

static int lm_create_timer(lua_State *L)
{
    /* create_timer(period_ms, callback) — lưu ref callback; chu kỳ NHỎ NHẤT
       trong các lần gọi quyết định nhịp timer MRE thật (một timer MRE duy
       nhất, mọi callback Lua chạy cùng nhịp đó — đủ cho generator). */
    VMUINT ms = (VMUINT)luaL_optnumber(L, 1, 100);
    int i;

    if (!lua_isfunction(L, 2))
    {
        lua_pop(L, 1);
        return 0;
    }
    if (g_lua_timer_count >= MAX_LUA_TIMERS)
    {
        lua_pop(L, 1);
        return 0;
    }
    if (ms < 10) ms = 10;
    if (ms > 60000) ms = 60000;

    lua_pushvalue(L, 2);                        /* fn lên đỉnh */
    g_lua_timer_refs[g_lua_timer_count++] = luaL_ref(L, LUA_REGISTRYINDEX);

    /* Timer MRE đầu tiên hoặc chu kỳ nhỏ hơn → dựng lại timer nhịp mới */
    if (g_timer < 0)
    {
        g_interval = ms;
        g_timer = vm_create_timer(ms, on_timer);
        _vm_log_info("[%s] MRE timer %dms (slot %d)", LOG_TAG, (int)ms, g_lua_timer_count - 1);
    }
    else if (ms < g_interval)
    {
        vm_delete_timer(g_timer);
        g_interval = ms;
        g_timer = vm_create_timer(ms, on_timer);
        _vm_log_info("[%s] MRE timer re-armed %dms (slot %d)", LOG_TAG, (int)ms, g_lua_timer_count - 1);
    }
    return 0;
}

static int lm_exit_app(lua_State *L)
{
    (void)L;
    vm_exit_app();
    return 0;
}

/* Chạy toàn bộ callback Lua đã đăng ký qua MRE.create_timer */
static void run_lua_timers(void)
{
    int i;
    if (!g_L) return;
    for (i = 0; i < g_lua_timer_count; i++)
    {
        lua_rawgeti(g_L, LUA_REGISTRYINDEX, g_lua_timer_refs[i]);
        if (lua_isfunction(g_L, -1))
        {
            if (lua_pcall(g_L, 0, 0, 0) != 0)
            {
                _vm_log_error("[%s] timer callback error: %s", LOG_TAG,
                              lua_tostring(g_L, -1) ? lua_tostring(g_L, -1) : "?");
                lua_pop(g_L, 1);
            }
        }
        else
        {
            lua_pop(g_L, 1);
        }
    }
}

/* Gọi hàm Lua theo tên với 2 đối số (key_code, event_type) — dùng cho phím */
static void call_lua_2args(lua_State *L, const char *fname, VMINT key_code, const char *event_type)
{
    if (!L) return;
    lua_getglobal(L, fname);
    if (lua_isfunction(L, -1))
    {
        lua_pushnumber(L, (lua_Number)key_code);
        lua_pushstring(L, event_type);
        if (lua_pcall(L, 2, 0, 0) != 0)
        {
            _vm_log_error("[%s] %s() error: %s", LOG_TAG, fname,
                          lua_tostring(L, -1) ? lua_tostring(L, -1) : "?");
            lua_pop(L, 1);
        }
    }
    else
    {
        lua_pop(L, 1);
    }
}

static void register_mre_table(lua_State *L)
{
    static const luaL_Reg mre_fns[] = {
        {"draw_text",  lm_draw_text},
        {"draw_rect",  lm_draw_rect},
        {"log",        lm_log},
        {"app_init",   lm_app_init},
        {"create_timer", lm_create_timer},
        {"exit_app",   lm_exit_app},
        {NULL, NULL}
    };
    int i;

    lua_newtable(L);
    for (i = 0; mre_fns[i].name; i++)
    {
        lua_pushcfunction(L, mre_fns[i].func);
        lua_setfield(L, -2, mre_fns[i].name);
    }

    /* Hằng số phím — mã số trùng keyCodeForKeyName() của giả lập studio */
    static const struct { const char *name; int code; } keydefs[] = {
        {"KEY_UP", -1}, {"UP", -1},
        {"KEY_DOWN", -2}, {"DOWN", -2},
        {"KEY_LEFT", -3}, {"LEFT", -3},
        {"KEY_RIGHT", -4}, {"RIGHT", -4},
        {"KEY_OK", -5}, {"OK", -5},
        {"KEY_LSOFT", -6}, {"SOFT_LEFT", -6},
        {"KEY_RSOFT", -7}, {"SOFT_RIGHT", -7},
        {"KEY_CLEAR", -8}, {"CLEAR", -8},
        {"KEY_STAR", 42}, {"STAR", 42},
        {"KEY_POUND", 35}, {"POUND", 35},
        {"KEY_NUM0", 48}, {"NUM0", 48},
        {"KEY_NUM1", 49}, {"NUM1", 49},
        {"KEY_NUM2", 50}, {"NUM2", 50},
        {"KEY_NUM3", 51}, {"NUM3", 51},
        {"KEY_NUM4", 52}, {"NUM4", 52},
        {"KEY_NUM5", 53}, {"NUM5", 53},
        {"KEY_NUM6", 54}, {"NUM6", 54},
        {"KEY_NUM7", 55}, {"NUM7", 55},
        {"KEY_NUM8", 56}, {"NUM8", 56},
        {"KEY_NUM9", 57}, {"NUM9", 57},
        {NULL, 0}
    };
    for (i = 0; keydefs[i].name; i++)
    {
        lua_pushnumber(L, (lua_Number)keydefs[i].code);
        lua_setfield(L, -2, keydefs[i].name);
    }

    lua_setglobal(L, "MRE");
}

/* Chỉ mở các thư viện an toàn — KHÔNG mở package/io/os để tránh phụ thuộc
 * dlopen/fopen hệ thống không có trên máy thật. */
static const luaL_Reg lualibs[] =
{
    {"", luaopen_base},
    {LUA_TABLIBNAME, luaopen_table},
    {LUA_STRLIBNAME, luaopen_string},
    {LUA_MATHLIBNAME, luaopen_math},
    {LUA_DBLIBNAME, luaopen_debug},
    {NULL, NULL}
};

static void open_safe_libs(lua_State *L)
{
    const luaL_Reg *lib;
    for (lib = lualibs; lib->func; lib++)
    {
        lua_pushcfunction(L, lib->func);
        lua_pushstring(L, lib->name);
        lua_call(L, 1, 0);
    }
}

/* ------------------------------------------------------------------ */
/* Nạp + chạy script.lua                                               */
/* ------------------------------------------------------------------ */

static VMINT read_script(char **out, VMUINT *out_len)
{
    const char *paths[2];
    VMUINT16 wpath[64];
    VMFILE f = VM_FILE_OPEN_ERROR;
    VMUINT size = 0;
    VMUINT nread = 0;
    char *buf = NULL;
    int pi;

    *out = NULL;
    *out_len = 0;

    paths[0] = SCRIPT_PATH_1;
    paths[1] = SCRIPT_PATH_2;

    for (pi = 0; pi < 2; pi++)
    {
        vm_ascii_to_ucs2(wpath, 64, (VMSTR)paths[pi]);
        f = vm_file_open(wpath, MODE_READ, TRUE);
        if (f >= 0) break;
    }
    if (f < 0) return -1;

    if (vm_file_getfilesize(f, &size) != 0 || size == 0 || size > 512 * 1024)
    {
        vm_file_close(f);
        return -1;
    }

    buf = (char *)malloc(size + 1);
    if (!buf)
    {
        vm_file_close(f);
        return -1;
    }
    /* MRE thật: trả 0 khi đọc OK, âm khi lỗi. MREmu (emulator) trả số byte
     * đã đọc — chấp nhận cả hai, chỉ fail khi không đọc được gì. */
    {
        VMINT rr = vm_file_read(f, buf, size, &nread);
        if (rr < 0 || nread == 0)
        {
            free(buf);
            vm_file_close(f);
            return -1;
        }
    }
    buf[nread] = '\0';
    vm_file_close(f);

    *out = buf;
    *out_len = nread;
    return 0;
}

static void init_lua(void)
{
    char *script = NULL;
    VMUINT len = 0;

    if (g_L) return;

    g_L = luaL_newstate();
    if (!g_L)
    {
        _vm_log_error("[%s] out of memory: luaL_newstate failed", LOG_TAG);
        return;
    }
    lua_atpanic(g_L, lua_panic_handler);
    open_safe_libs(g_L);
    register_bindings(g_L);
    register_mre_table(g_L);
    _vm_log_info("[%s] Lua 5.1 VM ready (MRE table + key consts)", LOG_TAG);

    /* ƯU TIÊN 1: script.lub nhúng trong .vxp (resource) — build từ studio */
    {
        VMINT res_len = 0;
        VMUINT8 *res = vm_load_resource("script.lub", &res_len);
        if (res && res_len > 0)
        {
            _vm_log_info("[%s] running EMBEDDED script.lub (%d bytes)...", LOG_TAG, (int)res_len);
            if (luaL_loadbuffer(g_L, (const char *)res, (size_t)res_len, "script.lub") == 0
                && lua_pcall(g_L, 0, 0, 0) == 0)
            {
                g_script_ok = TRUE;
                _vm_log_info("[%s] embedded script.lub loaded OK", LOG_TAG);
                call_lua("on_init", 0);
                flush_screen();
                return;
            }
            _vm_log_error("[%s] embedded script error: %s", LOG_TAG,
                          lua_tostring(g_L, -1) ? lua_tostring(g_L, -1) : "?");
            lua_pop(g_L, 1);
        }
    }

    /* ƯU TIÊN 2: script.lua trên thẻ nhớ */
    if (read_script(&script, &len) == 0 && script)
    {
        _vm_log_info("[%s] running script.lua (%d bytes)...", LOG_TAG, (int)len);
        if (luaL_dostring(g_L, script) == 0)
        {
            g_script_ok = TRUE;
            _vm_log_info("[%s] script.lua loaded OK", LOG_TAG);
            call_lua("on_init", 0);
        }
        else
        {
            _vm_log_error("[%s] script.lua error: %s", LOG_TAG, lua_tostring(g_L, -1));
            lua_pop(g_L, 1);
        }
        free(script);
    }
    else
    {
        _vm_log_error("[%s] cannot read script (no embedded script.lub, no \\mod\\LuaEngine\\script.lua)", LOG_TAG);
    }
}

/* ------------------------------------------------------------------ */
/* Callback Lua                                                         */
/* ------------------------------------------------------------------ */

static void call_lua(const char *fname, VMINT nargs)
{
    int top;
    if (!g_L) return;
    top = lua_gettop(g_L);
    lua_getglobal(g_L, fname);
    if (lua_isfunction(g_L, -1))
    {
        if (lua_pcall(g_L, nargs, 0, 0) != 0)
        {
            _vm_log_error("[%s] %s() error: %s", LOG_TAG, fname, lua_tostring(g_L, -1));
            lua_pop(g_L, 1);
        }
    }
    else
    {
        lua_pop(g_L, 1);
    }
    lua_settop(g_L, top);
}

/* Timer loop: MRE timer tự lặp tới khi bị xóa (vm_create_timer) */
static void on_timer(VMINT tid)
{
    (void)tid;
    /* 1) Callback đăng ký qua MRE.create_timer(ms, fn) — generator dùng
       cho on_timer_tick + on_clock_<Tên>_tick */
    run_lua_timers();
    /* 2) API legacy on_frame() của script.lua cũ */
    call_lua("on_frame", 0);
    flush_screen();
}

/* ------------------------------------------------------------------ */
/* Sự kiện hệ thống MRE                                                 */
/* ------------------------------------------------------------------ */

static void handle_sysevt(VMINT message, VMINT param)
{
    (void)param;
    switch (message)
    {
    case VM_MSG_CREATE:
        init_lua();
        break;

    case VM_MSG_PAINT:
    case VM_MSG_ACTIVE:
        if (g_layer < 0)
        {
            g_layer = vm_graphic_create_layer(0, 0,
                vm_graphic_get_screen_width(),
                vm_graphic_get_screen_height(),
                -1);
            vm_graphic_set_clip(0, 0,
                vm_graphic_get_screen_width(),
                vm_graphic_get_screen_height());
        }
        if (g_script_ok)
        {
            call_lua("on_paint", 0);
        }
        else
        {
            fill_rect_xy(0, 0, 240, 320, 0x0F172A);
            draw_text_xy(30, 130, "LuaEngine: script.lua not found", 14, 0xF87171);
            draw_text_xy(30, 152, "Copy script.lua to \\mod\\LuaEngine\\", 12, 0x94A3B8);
            flush_screen();
        }
        break;

    case VM_MSG_HIDE:
    case VM_MSG_INACTIVE:
        if (g_layer >= 0)
        {
            vm_graphic_delete_layer(g_layer);
            g_layer = -1;
        }
        break;

    case VM_MSG_QUIT:
        if (g_timer >= 0)
        {
            vm_delete_timer(g_timer);
            g_timer = -1;
        }
        if (g_layer >= 0)
        {
            vm_graphic_delete_layer(g_layer);
            g_layer = -1;
        }
        if (g_L)
        {
            lua_close(g_L);
            g_L = NULL;
        }
        vm_res_deinit();
        break;
    }
}

static void handle_keyevt(VMINT event, VMINT keycode)
{
    if (g_L)
    {
        int top = lua_gettop(g_L);
        /* luaGenerator: on_key_event(key_code, "DOWN"/"UP") — mọi phím */
        if (event == VM_KEY_EVENT_DOWN)
            call_lua_2args(g_L, "on_key_event", keycode, "DOWN");
        else
            call_lua_2args(g_L, "on_key_event", keycode, "UP");
        lua_settop(g_L, top);

        /* API legacy: on_key(key, event_type_number) của script.lua cũ */
        {
            lua_getglobal(g_L, "on_key");
            if (lua_isfunction(g_L, -1))
            {
                lua_pushnumber(g_L, (lua_Number)keycode);
                lua_pushnumber(g_L, (lua_Number)event);
                if (lua_pcall(g_L, 2, 0, 0) != 0)
                {
                    _vm_log_error("[%s] on_key() error: %s", LOG_TAG, lua_tostring(g_L, -1));
                    lua_pop(g_L, 1);
                }
            }
            else
            {
                lua_pop(g_L, 1);
            }
            lua_settop(g_L, top);
        }
        flush_screen();
    }
}

/* ------------------------------------------------------------------ */
/* Điểm vào ứng dụng MRE                                                */
/* ------------------------------------------------------------------ */

void vm_main(void)
{
    g_layer = -1;
    g_timer = -1;
    vm_reg_sysevt_callback(handle_sysevt);
    vm_reg_keyboard_callback(handle_keyevt);
    vm_res_init();
}