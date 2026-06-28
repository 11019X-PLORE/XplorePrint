@echo off
chcp 65001 >nul
title XplorePrint 服务器管理工具

set "PORT=5000"
set "APP_DIR=%~dp0"

:check_admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 需要管理员权限以确保端口释放正常。
    echo 正在请求管理员权限...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:menu
cls
echo ============================================
echo    XplorePrint 服务器管理工具
echo    FRC Team 11019 Xplore
echo ============================================
echo.

call :check_status

echo.
echo   [1] 启动服务器
echo   [2] 停止服务器
echo   [3] 重启服务器
echo   [4] 打开浏览器访问
echo   [0] 退出
echo.
set /p "choice=请输入选项: "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto open_browser
if "%choice%"=="0" exit /b
goto menu

:check_status
set "PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING" 2^>nul') do set "PID=%%a"
if defined PID (
    echo   状态: [运行中]  (PID: %PID%, 端口: %PORT%)
) else (
    echo   状态: [已停止]
)
goto :eof

:start
call :check_status
if defined PID (
    echo.
    echo 服务器已在运行中 (PID: %PID%)
    echo.
    pause
    goto menu
)

echo.
echo 正在启动 XplorePrint 服务器...
cd /d "%APP_DIR%"
start "XplorePrint Server" cmd /c "python app.py & pause"
echo 服务器正在启动，请稍候...
timeout /t 3 /nobreak >nul
goto menu

:stop
call :check_status
if not defined PID (
    echo.
    echo 服务器未在运行。
    echo.
    pause
    goto menu
)

echo.
echo 正在停止服务器 (PID: %PID%)...
taskkill /PID %PID% /F >nul 2>&1
if %errorlevel%==0 (
    echo 服务器已停止。
) else (
    echo 停止失败，请尝试手动关闭。
)
echo.
timeout /t 2 /nobreak >nul
goto menu

:restart
echo.
echo 正在重启服务器...
call :stop
timeout /t 2 /nobreak >nul
goto start

:open_browser
echo.
echo 正在打开浏览器...
start http://localhost:%PORT%
timeout /t 1 /nobreak >nul
goto menu