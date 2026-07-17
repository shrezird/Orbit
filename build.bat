@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Building Orbit.exe
echo ============================================
echo.

python --version >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python was not found on PATH.
    echo Install it from https://www.python.org/ and check "Add to PATH".
    goto :fail
)

python -c "import PyInstaller" >nul 2>nul
if errorlevel 1 (
    echo Installing build requirements...
    python -m pip install -r requirements.txt
    if errorlevel 1 goto :fail
    echo.
)

python -m PyInstaller --noconfirm --clean --onefile --windowed ^
    --name Orbit --icon icon.ico ^
    --add-data "static;static" --add-data "font;font" ^
    --add-data "plugin_system;plugin_system" main.pyw
if errorlevel 1 goto :fail

echo.
echo ============================================
echo  Done! Your exe is at:  dist\Orbit.exe
echo.
echo  Note: Orbit keeps each board (and its
echo  attachments) in its own folder under the
echo  data\ folder created NEXT TO the exe.
echo  The font is bundled inside the exe.
echo ============================================
echo.
pause
exit /b 0

:fail
echo.
echo ============================================
echo  Build FAILED - see the messages above.
echo ============================================
echo.
pause
exit /b 1
