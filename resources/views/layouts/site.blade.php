<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#14215A">
<meta name="description" content="@yield('descricao', 'Deu Fome: cardápio no tablet de cada mesa. O cliente pede sozinho, a cozinha recebe na hora e o caixa fecha a conta com tudo somado.')">
<meta property="og:title" content="@yield('titulo', 'Deu Fome · Cada mesa com seu próprio cardápio')">
<meta property="og:description" content="O cliente pede pelo tablet da mesa, a cozinha recebe na hora e a conta fecha sozinha.">
<meta property="og:image" content="{{ $url }}/img/icone-escuro.png">
<link rel="icon" href="/img/icone-escuro.png">
<title>@yield('titulo', 'Deu Fome · Cada mesa com seu próprio cardápio')</title>
@vite(['resources/css/app.css'])
</head>
<body class="bg-white text-marinho font-sans antialiased">
<header class="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-linha">
  <div class="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-4">
    <a href="/" aria-label="Deu Fome, início" class="shrink-0"><img src="/img/logo.png" alt="Deu Fome" class="h-9"></a>
    <nav class="ml-auto flex items-center gap-1 sm:gap-2 text-[15px] font-semibold">
      <a href="/#como-funciona" class="hidden md:inline px-3 py-2 rounded-lg text-texto-2 hover:text-marinho">Como funciona</a>
      <a href="/#recursos" class="hidden md:inline px-3 py-2 rounded-lg text-texto-2 hover:text-marinho">Recursos</a>
      <a href="/#duvidas" class="hidden md:inline px-3 py-2 rounded-lg text-texto-2 hover:text-marinho">Dúvidas</a>
      <a href="/admin" class="px-3 py-2 rounded-lg hover:bg-nevoa">Entrar</a>
      <a href="/cadastro" class="px-4 py-2.5 rounded-xl bg-brasa text-white hover:bg-brasa-escura">Criar conta grátis</a>
    </nav>
  </div>
</header>
@yield('conteudo')
<footer class="bg-marinho-profundo text-[#C7CEEB]">
  <div class="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 sm:items-center">
    <div class="flex items-center gap-3"><img src="/img/icone-escuro.png" alt="" class="h-10 w-10 rounded-xl"><span>© {{ date('Y') }} {{ $empresa }}</span></div>
    <nav class="sm:ml-auto flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
      <a href="/termos" class="hover:text-white">Termos de uso</a>
      <a href="/privacidade" class="hover:text-white">Privacidade</a>
      <a href="mailto:{{ $contato }}" class="hover:text-white">Contato</a>
      <a href="/admin" class="hover:text-white">Entrar</a>
    </nav>
  </div>
</footer>
</body>
</html>
