@echo off
setlocal

cd /d "%~dp0"

echo === Eski kilit dosyasi temizleniyor (varsa) ===
if exist ".git\index.lock" del /f /q ".git\index.lock"

echo === Degisiklikler ekleniyor ===
git add -A

set /p MSG="Commit mesaji (bos birakirsan otomatik tarih yazilir): "
if "%MSG%"=="" set MSG=Guncelleme %date% %time%

git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo Commit edilecek yeni bir degisiklik yok, push'a geciliyor...
)

echo === GitHub'a gonderiliyor ===
git push

echo.
echo === Bitti ===
pause
