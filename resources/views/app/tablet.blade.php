@extends('layouts.app', ['script' => 'tablet'])
@section('titulo', 'Mesa')
@section('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
@section('head')
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="manifest" href="/manifest.webmanifest">
@endsection
@section('body')class="tablet" data-versao="{{ versao_app() }}"@endsection
@section('conteudo')
<div id="raiz"></div>
@endsection
