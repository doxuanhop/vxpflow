@echo off
setlocal enabledelayedexpansion
REM ================================================================
REM  LuaEngine.vxp — MRE SDK build script (Nokia S30+ / MRE 3.0)
REM
REM  Pipeline (theo nguyên lý MRE của dự án):
REM    1. Lua Core (C code)  : mre\lua-5.1.5\src (máy ảo Lua 5.1 thuần)
REM    2. Biên dịch .vxp     : bước này — ARM GCC + MRE SDK libs
REM                            + CmdShell pack + PackDigist -> LuaEngine.vxp
REM    3. Thực thi script    : khi chạy trên máy, runtime đọc script.lua
REM                            (thẻ nhớ) và dùng luaL_dostring thực thi.
REM
REM  Tuỳ chỉnh qua biến môi trường:
REM    MRE_SDK  : đường dẫn thư mục gốc SDK (mặc định dò trong D:\MRE)
REM    ARM_GCC  : tiền tố bộ biên dịch ARM (mặc định arm-none-eabi-*)
REM ================================================================

if "%MRE_SDK%"=="" (
    set "MRE_SDK=D:\MRE\XimikBoda\third_party\mre-sdk\app"
)
if "%ARM_GCC%"=="" set "ARM_GCC=arm-none-eabi"
if "%TinyMRESDK%"=="" set "TinyMRESDK=D:\MRE\XimikBoda\TinyMRESDK-main"

set "SDK=%MRE_SDK%"
set "GCC=%ARM_GCC%-gcc"
set "GXX=%ARM_GCC%-g++"

REM --- TinyMRESDK (PackRes + PackApp) — dùng để đóng gói + ký .vxp ---
set "PACKRES=%TinyMRESDK%\bin\PackRes.exe"
set "PACKAPP=%TinyMRESDK%\bin\PackApp.exe"
if not exist "%PACKRES%" set "PACKRES=D:\MRE\lua-engine\mre-core\packager\PackRes.exe"
if not exist "%PACKAPP%" set "PACKAPP=D:\MRE\lua-engine\mre-core\packager\PackApp.exe"
if not exist "%PACKAPP%" (
    echo [LuaEngine] ERROR: PackApp.exe khong thay. Set TinyMRESDK. 
    exit /b 1
)

if not exist "%SDK%\include\vmsys.h" (
    echo [LuaEngine] ERROR: MRE SDK not found at "%SDK%"
    echo            Set MRE_SDK to the SDK "app" directory and re-run.
    exit /b 1
)

set "OUT=arm"
if not exist "%OUT%" mkdir "%OUT%"

REM ---- chung ----
set "INCLUDES=-I "%SDK%\include" -I "%SDK%\include\service" -I "ResID" -I "." -I "..\lua-5.1.5\src""
set "DEFS=-D_MINIGUI_LIB_ -D_USE_MINIGUIENTRY -D_NOUNIX_ -D_FOR_WNC -D__MRE_SDK__ -D__MRE_VENUS_NORMAL__ -D__MMI_MAINLCD_240X320__ -D__MRE_COMPILER_GCC__"
set "CFLAGS=-c -fpic -g -mcpu=arm7tdmi-s -fvisibility=hidden -mthumb -mlittle-endian -O2 -fno-exceptions -fno-non-call-exceptions -Wno-unused-parameter"

echo [LuaEngine] 1/5 compile gccmain (MRE entry stub)
"%GCC%" %CFLAGS% %DEFS% %INCLUDES% -o "%OUT%\gccmain.o" -c "%SDK%\lib\MRE30\src\gccmain.c" || goto :err

echo [LuaEngine] 2/5 compile Lua 5.1.5 core
for %%f in (lapi lauxlib lbaselib lcode ldblib ldebug ldo ldump lfunc lgc llex lmathlib lmem lobject lopcodes lparser lstate lstring lstrlib ltable ltablib ltm lundump lvm lzio) do (
    echo   ..\lua-5.1.5\src\%%f.c
    "%GCC%" %CFLAGS% %DEFS% %INCLUDES% -o "%OUT%\%%f.o" -c "..\lua-5.1.5\src\%%f.c" || goto :err
)

echo [LuaEngine] 3/5 compile LuaEngine module + libc stubs
"%GCC%" %CFLAGS% %DEFS% %INCLUDES% -o "%OUT%\LuaEngine.o" -c "LuaEngine.c" || goto :err
"%GCC%" %CFLAGS% %DEFS% %INCLUDES% -o "%OUT%\mre_stubs.o" -c "mre_stubs.c" || goto :err

echo [LuaEngine] 4/5 link LuaEngine.axf (scat.ld + MRE30 armgcc libs)
"%GCC%" -o "LuaEngine.axf" "%OUT%\gccmain.o" "%OUT%\mre_stubs.o" "%OUT%\LuaEngine.o" "%OUT%\lapi.o" "%OUT%\lauxlib.o" "%OUT%\lbaselib.o" "%OUT%\lcode.o" "%OUT%\ldblib.o" "%OUT%\ldebug.o" "%OUT%\ldo.o" "%OUT%\ldump.o" "%OUT%\lfunc.o" "%OUT%\lgc.o" "%OUT%\llex.o" "%OUT%\lmathlib.o" "%OUT%\lmem.o" "%OUT%\lobject.o" "%OUT%\lopcodes.o" "%OUT%\lparser.o" "%OUT%\lstate.o" "%OUT%\lstring.o" "%OUT%\lstrlib.o" "%OUT%\ltable.o" "%OUT%\ltablib.o" "%OUT%\ltm.o" "%OUT%\lundump.o" "%OUT%\lvm.o" "%OUT%\lzio.o" -fpic -pie -nostartfiles -T "%SDK%\lib\MRE30\armgcc\scat.ld" -L "%SDK%\lib\MRE30\armgcc" -l:percommon.a -l:perfile.a -l:persysfile.a -lm || goto :err

echo [LuaEngine] 5/6 pack resources + package (PackRes + PackApp / TinyMRESDK)
"%PACKRES%" -o "%OUT%\LuaEngine.res" --empty-logo || goto :err
"%PACKAPP%" -a "LuaEngine.axf" -r "%OUT%\LuaEngine.res" -o "%OUT%\LuaEngine.vxp" -tr 1000 -tn "LuaEngine" -tdn "VXPEngine Studio" -tb 0 -tapi "File" -ty vxp -tc GCC -tai 0 || goto :err

echo [LuaEngine] 6/6 sync LuaEngine.vxp -^> mre\dist + public\mre (cho studio app)
if exist "..\dist" copy /Y "%OUT%\LuaEngine.vxp" "..\dist\LuaEngine.vxp" >nul
if exist "..\..\public\mre" copy /Y "%OUT%\LuaEngine.vxp" "..\..\public\mre\LuaEngine.vxp" >nul

echo.
echo [LuaEngine] DONE. File: %OUT%\LuaEngine.vxp (unsigned, appid 0 - chay duoc tren MREmu)
echo           De chay tren may that: khao README.md (ky bang cert100-key.pem).
exit /b 0

:err
echo.
echo [LuaEngine] BUILD FAILED — xem chi tiet o tren.
exit /b 1