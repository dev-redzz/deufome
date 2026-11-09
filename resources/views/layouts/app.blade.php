<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="@yield('viewport', 'width=device-width, initial-scale=1')">
<meta name="theme-color" content="#FF5A1F">
@yield('head')
<link rel="icon" href="/img/icone-escuro.png">
<title>@yield('titulo') · Deu Fome</title>
@vite(['resources/css/app.css', 'resources/js/'.$script.'.js'])
</head>
<body @yield('body')>
@yield('conteudo')
</body>
</html>
