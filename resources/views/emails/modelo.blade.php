<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#F6F1EA;font-family:Arial,Helvetica,sans-serif;color:#14215A">
<div style="max-width:560px;margin:0 auto;padding:28px 18px">
  <div style="background:#14215A;color:#fff;border-radius:18px 18px 0 0;padding:18px 24px;font-size:20px;font-weight:800">
    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#FF5A1F;margin-right:8px"></span>Deu Fome
  </div>
  <div style="background:#fff;border-radius:0 0 18px 18px;padding:24px;line-height:1.55">
    <h1 style="font-size:22px;margin:0 0 12px">{{ $titulo }}</h1>
    {!! $corpo !!}
    @if ($botaoTexto)
      <p style="margin:28px 0"><a href="{{ $botaoUrl }}" style="background:#FF5A1F;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:12px;display:inline-block">{{ $botaoTexto }}</a></p>
    @endif
  </div>
  <p style="color:#6B6478;font-size:12px;text-align:center;margin-top:16px">{{ $empresa }}</p>
</div>
</body>
</html>
