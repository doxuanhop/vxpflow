-- script.lua — LuaEngine MRE runtime demo
-- Copy file nay den \mod\LuaEngine\script.lua tren the nho Nokia S30+.
-- Runtime se doc va thuc thi bang luaL_dostring (xem LuaEngine.c).

local W, H = mre_get_screen_size()
local ball_x, ball_y = 60, 60
local ball_vx, ball_vy = 3, 2
local score = 0

function on_init()
    mre_log("LuaEngine script started")
    mre_set_interval(40)          -- 25 FPS
end

function on_paint()
    mre_fill_rect(0, 0, W, H, 0x0F172A)      -- nen toi
    mre_draw_text(8, 6, "LuaEngine on MRE - Nokia S30+", 12, 0x38BDF8)
    mre_draw_text(8, 22, "Score: " .. score, 12, 0x4ADE80)
    mre_fill_rect(ball_x - 5, ball_y - 5, 10, 10, 0xFBBF24)
    mre_draw_text(30, 300, "OK = coin | # = quit", 10, 0x94A3B8)
end

function on_frame()
    ball_x = ball_x + ball_vx
    ball_y = ball_y + ball_vy
    if ball_x < 5 or ball_x > W - 5 then ball_vx = -ball_vx end
    if ball_y < 30 or ball_y > H - 5 then ball_vy = -ball_vy end
    on_paint()
    mre_flush()
end

function on_key(key, event)
    if event ~= 2 then return end          -- chi xu ly khi nhan xuong (VM_KEY_EVENT_DOWN=2)
    if key == -5 then                      -- VM_KEY_OK
        score = score + 1
        mre_vibrate()
    elseif key == -8 then                  -- VM_KEY_CLEAR (#)
        mre_exit()
    end
end