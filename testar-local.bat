@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PHP=php
where php >nul 2>nul || set PHP=C:\xampp\php\php.exe
set DEMO=1
set PLATAFORMA_EMAIL=admin@deufome.local
set PLATAFORMA_SENHA=admin12345
rem E-mails (esqueci minha senha etc.) vao para data\emails.log
set EMAIL_LOG=1
echo.
echo  Deu Fome - teste local da versao online
echo  Site:    http://localhost:8000/
echo  Painel:  http://localhost:8000/admin
echo  Administrador: admin@deufome.local  senha admin12345
echo  Restaurante de exemplo: admin@cantinho.test  senha 123456
echo  E-mails de teste: pasta data\emails.log
echo.
start "" http://localhost:8000/admin
"%PHP%" -S 0.0.0.0:8000 -t public app/router.php
