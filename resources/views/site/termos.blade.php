@extends('layouts.site')
@section('titulo', 'Termos de uso · Deu Fome')
@section('conteudo')
<main class="mx-auto max-w-3xl px-4 sm:px-6 py-14 text-[16.5px] leading-relaxed [&_h1]:font-display [&_h1]:font-extrabold [&_h1]:text-4xl sm:[&_h1]:text-5xl [&_h1]:tracking-tight [&_.atualizado]:text-texto-2 [&_.atualizado]:font-semibold [&_.atualizado]:mt-2 [&_h2]:font-display [&_h2]:font-extrabold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_a]:text-brasa-escura [&_a]:font-bold [&_table]:w-full [&_table]:mt-4 [&_table]:text-[15px] [&_th]:text-left [&_th]:bg-nevoa [&_th]:p-3 [&_td]:p-3 [&_td]:align-top [&_td]:border-t [&_td]:border-linha">
  <h1>Termos de uso</h1>
  <p class="atualizado">Última atualização: {{ $dataTermos }}</p>

  <p>Estes Termos regulam o uso do Deu Fome, plataforma de cardápio digital e pedidos em tablets para restaurantes, oferecida por <b>{{ $empresa }}</b> ("nós"). Ao criar uma conta ou usar o serviço, você ("Restaurante" ou "Usuário") concorda com estes Termos e com a <a href="/privacidade">Política de privacidade</a>.</p>

  <h2>1. O serviço</h2>
  <p>O Deu Fome permite que o Restaurante cadastre cardápio, mesas, tablets e equipe; que seus clientes façam pedidos pelo tablet da mesa; que a cozinha acompanhe os pedidos; e que o caixa feche as contas e consulte relatórios. O serviço é acessado pelo navegador em {{ $url }}.</p>

  <h2>2. Fase beta e preço</h2>
  <p>O Deu Fome está em fase beta e é oferecido gratuitamente nesse período. Funções podem mudar, ser incluídas ou retiradas. Se passarmos a cobrar pelo serviço, avisaremos com pelo menos 30 dias de antecedência, e nenhuma cobrança será feita sem a sua concordância.</p>

  <h2>3. Conta e acesso</h2>
  <ul>
    <li>Você deve informar dados verdadeiros e manter seu e-mail atualizado.</li>
    <li>Você é responsável por guardar sua senha, o PIN dos tablets e os códigos de ativação, e por tudo o que for feito com seu acesso.</li>
    <li>O dono do Restaurante é responsável pelas pessoas que cadastra na equipe e pelas permissões que dá a cada uma.</li>
    <li>Ao entrar com a conta Google, você autoriza o uso do seu nome e e-mail do Google para identificar seu acesso.</li>
  </ul>

  <h2>4. Responsabilidades do Restaurante</h2>
  <ul>
    <li>As informações do cardápio (nomes, descrições, fotos, preços e disponibilidade) são de responsabilidade do Restaurante, que deve mantê-las corretas e de acordo com o Código de Defesa do Consumidor.</li>
    <li>O Restaurante deve ter direito de uso das fotos e textos que publicar.</li>
    <li>O preparo, a entrega dos pedidos, o atendimento e o recebimento dos pagamentos são feitos pelo Restaurante. O Deu Fome não processa pagamentos nem intermedeia a relação de consumo entre o Restaurante e seus clientes.</li>
    <li>Os tablets, a internet e as impressoras do estabelecimento são providenciados e mantidos pelo Restaurante.</li>
  </ul>

  <h2>5. Uso proibido</h2>
  <p>Não é permitido usar o Deu Fome para atividades ilegais, publicar conteúdo ofensivo ou que viole direitos de terceiros, tentar acessar dados de outros restaurantes, sobrecarregar ou atacar o sistema, ou copiar e revender o serviço.</p>

  <h2>6. Disponibilidade</h2>
  <p>Trabalhamos para manter o serviço disponível, mas podem ocorrer interrupções por manutenção, falhas de terceiros (como hospedagem ou internet) ou situações fora do nosso controle. Recomendamos ter um plano alternativo para anotar pedidos em caso de falha.</p>

  <h2>7. Dados e backup</h2>
  <p>Fazemos cópias de segurança diárias do banco de dados. O tratamento de dados pessoais está descrito na <a href="/privacidade">Política de privacidade</a>. Os dados do Restaurante (cardápio, pedidos, relatórios) pertencem ao Restaurante.</p>

  <h2>8. Suspensão e encerramento</h2>
  <p>Você pode deixar de usar o serviço e pedir a exclusão da conta a qualquer momento pelo e-mail {{ $contato }}. Podemos suspender ou encerrar contas que violem estes Termos, avisando o responsável sempre que possível.</p>

  <h2>9. Limitação de responsabilidade</h2>
  <p>Na medida permitida pela lei, não respondemos por prejuízos indiretos, lucros cessantes ou perdas causadas por informações incorretas no cardápio, falhas de equipamentos ou internet do Restaurante, ou uso indevido do acesso por pessoas da equipe.</p>

  <h2>10. Mudanças nestes Termos</h2>
  <p>Podemos atualizar estes Termos. Quando a mudança for relevante, avisaremos pelo e-mail cadastrado ou dentro do painel antes de ela entrar em vigor.</p>

  <h2>11. Contato e foro</h2>
  <p>Dúvidas: {{ $contato }}. Fica eleito o foro de {{ $foro }} para resolver questões sobre estes Termos, ressalvado o direito do consumidor de escolher o foro do seu domicílio.</p>
</main>
@endsection
