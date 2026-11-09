@extends('layouts.site')
@section('titulo', 'Política de privacidade · Deu Fome')
@section('conteudo')
<main class="mx-auto max-w-3xl px-4 sm:px-6 py-14 text-[16.5px] leading-relaxed [&_h1]:font-display [&_h1]:font-extrabold [&_h1]:text-4xl sm:[&_h1]:text-5xl [&_h1]:tracking-tight [&_.atualizado]:text-texto-2 [&_.atualizado]:font-semibold [&_.atualizado]:mt-2 [&_h2]:font-display [&_h2]:font-extrabold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_a]:text-brasa-escura [&_a]:font-bold [&_table]:w-full [&_table]:mt-4 [&_table]:text-[15px] [&_th]:text-left [&_th]:bg-nevoa [&_th]:p-3 [&_td]:p-3 [&_td]:align-top [&_td]:border-t [&_td]:border-linha">
  <h1>Política de privacidade</h1>
  <p class="atualizado">Última atualização: {{ $dataTermos }}</p>

  <p>Esta Política explica como <b>{{ $empresa }}</b> trata dados pessoais no Deu Fome, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).</p>

  <h2>1. Quem é responsável</h2>
  <p>Somos o <b>controlador</b> dos dados das contas de acesso (donos, gerentes e equipe dos restaurantes). Sobre os dados de pedidos e atendimento gerados em cada restaurante, atuamos como <b>operador</b>, seguindo as instruções do restaurante, que é o controlador.</p>
  <p>Encarregado pelo tratamento de dados: {{ $contato }}.</p>

  <h2>2. Quais dados tratamos</h2>
  <table>
    <tr><th>Dado</th><th>Para quê</th><th>Base legal (LGPD)</th></tr>
    <tr><td>Nome, e-mail e senha (guardada de forma criptografada) de quem tem acesso ao painel</td><td>Criar e proteger a conta, permitir o acesso, enviar avisos do serviço</td><td>Execução de contrato (art. 7º, V)</td></tr>
    <tr><td>Identificador da conta Google, nome e e-mail do Google, quando você escolhe entrar com o Google</td><td>Permitir o login com Google</td><td>Execução de contrato (art. 7º, V)</td></tr>
    <tr><td>Endereço IP, data e hora de acessos e tentativas de login</td><td>Segurança, prevenção de fraudes e bloqueio de tentativas repetidas</td><td>Legítimo interesse (art. 7º, IX) e Marco Civil da Internet</td></tr>
    <tr><td>Pedidos, itens, valores, formas de pagamento e avaliações das mesas</td><td>Funcionamento do serviço para o restaurante e seus relatórios</td><td>Execução de contrato com o restaurante (art. 7º, V)</td></tr>
    <tr><td>Mensagens enviadas pelo botão de sugestões e registros de erros técnicos</td><td>Suporte e melhoria do serviço</td><td>Legítimo interesse (art. 7º, IX)</td></tr>
  </table>
  <p>Os clientes que pedem pelo tablet da mesa <b>não precisam se identificar</b>. Não pedimos nome, CPF ou telefone de quem está na mesa. A avaliação ao final do atendimento é anônima.</p>

  <h2>3. Cookies e armazenamento no navegador</h2>
  <p>Usamos apenas o necessário para o funcionamento: um cookie de sessão para manter você conectado ao painel e, nos tablets, uma credencial do dispositivo guardada no navegador. Guardamos também preferências simples, como o tema claro ou escuro. Não usamos cookies de publicidade nem de rastreamento.</p>

  <h2>4. Com quem compartilhamos</h2>
  <ul>
    <li><b>Hospedagem (Railway):</b> o sistema e o banco de dados ficam em servidores da Railway, que podem estar fora do Brasil. A transferência internacional segue o art. 33 da LGPD.</li>
    <li><b>Envio de e-mails (Brevo):</b> e-mails de boas-vindas, recuperação de senha e avisos são enviados por meio da Brevo.</li>
    <li><b>Google:</b> somente quando você escolhe entrar com a conta Google.</li>
    <li><b>Autoridades:</b> quando houver obrigação legal ou ordem judicial.</li>
  </ul>
  <p>Não vendemos dados pessoais.</p>

  <h2>5. Por quanto tempo guardamos</h2>
  <p>Os dados da conta ficam guardados enquanto ela estiver ativa. Registros de acesso são guardados por 6 meses, como exige o Marco Civil da Internet. Os dados de pedidos ficam disponíveis para o restaurante enquanto a conta existir. Ao encerrar a conta, os dados são apagados em até 90 dias, exceto o que a lei mandar guardar. Cópias de backup são substituídas em até 7 dias.</p>

  <h2>6. Segurança</h2>
  <p>Usamos conexão segura (HTTPS), senhas criptografadas, separação dos dados de cada restaurante, credencial própria para cada tablet, bloqueio após tentativas repetidas de login e backups diários.</p>

  <h2>7. Seus direitos</h2>
  <p>Você pode pedir, a qualquer momento: confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, exclusão, informação sobre compartilhamento e revisão de consentimento (art. 18 da LGPD). Envie o pedido para {{ $contato }}. Responderemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

  <h2>8. Mudanças nesta Política</h2>
  <p>Se esta Política mudar de forma relevante, avisaremos pelo e-mail cadastrado ou pelo painel.</p>
</main>
@endsection
