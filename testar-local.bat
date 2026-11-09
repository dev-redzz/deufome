@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PHP=php
where php >nul 2>nul || set PHP=C:\xampp\php\php.exe

"%PHP%" -r "exit(version_compare(PHP_VERSION, '8.3.0', '>=') ? 0 : 1);"
if errorlevel 1 (
  echo.
  echo  O Deu Fome usa Laravel 13 e precisa do PHP 8.3 ou mais novo.
  "%PHP%" -v
  echo  Atualize o XAMPP ou instale o PHP 8.3+ e tente de novo.
  pause
  exit /b 1
)

if not exist vendor (
  echo  Instalando as bibliotecas do Laravel, so na primeira vez...
  call composer install
)
if not exist .env copy .env.example .env >nul

"%PHP%" artisan deufome:preparar

echo.
echo  Deu Fome - teste local
echo  Site:    http://localhost:8000/
echo  Painel:  http://localhost:8000/admin
echo  Administrador: admin@deufome.local  senha admin12345
echo  Restaurante de exemplo: admin@cantinho.test  senha 123456  PIN 1234
echo  E-mails de teste: storage\dados\emails.log
echo  Para o tablet na mesma rede, use o IP deste computador com :8000/tablet
echo.
start "" http://localhost:8000/admin
"%PHP%" artisan serve --host=0.0.0.0 --port=8000
