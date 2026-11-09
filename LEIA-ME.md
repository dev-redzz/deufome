# Deu Fome — versão online (v1.1)

Plataforma de pedidos com um tablet fixo em cada mesa. Vários estabelecimentos usam o mesmo site, cada um com seus dados separados.

## Endereços do sistema

| Tela | Endereço | Quem usa |
| --- | --- | --- |
| Site de apresentação | `https://SEU-DOMINIO/` | Quem ainda não conhece o Deu Fome |
| Criar conta | `https://SEU-DOMINIO/cadastro` | Restaurante que quer começar sozinho |
| Termos e Privacidade | `/termos` e `/privacidade` | Todos |
| Painel | `https://SEU-DOMINIO/admin` | Você (administrador), donos, gerentes e caixas |
| Cozinha | `https://SEU-DOMINIO/cozinha` | Usuário com função Cozinha (TV ou tablet na cozinha) |
| Tablet da mesa | `https://SEU-DOMINIO/tablet` | Tablets das mesas, ativados com código |

## Quem faz o quê

- **Administrador do Deu Fome (você):** estabelecimentos, **Sistema** (backup, e-mail, Google), **Sugestões** recebidas e **Erros** registrados.
- **Dono / Gerente:** salão, relatórios, fechamento de caixa, mesas, tablets, cardápio, equipe e ajustes (taxa de serviço, fuso, horário de funcionamento, PIN).
- **Caixa:** salão, fechamento de contas (com divisão e troco) e fechamento de caixa.
- **Cozinha:** só a tela da cozinha.

## Publicar no Railway (passo a passo)

### 1. Enviar para o GitHub

Crie um repositório novo (por exemplo `deu-fome`) e, dentro desta pasta:

```
git init
git add .
git commit -m "Deu Fome v1.0"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/deu-fome.git
git push -u origin main
```

### 2. Criar o projeto no Railway

1. Em railway.com, clique em **New Project → Deploy from GitHub repo** e escolha `deu-fome`.
2. O Railway encontra o `Dockerfile` sozinho. O primeiro deploy pode falhar no teste de saúde até o passo 4; isso é normal.

### 3. Adicionar o volume (obrigatório)

O volume é o "HD" onde ficam o banco de dados e as fotos. **Sem ele, tudo é apagado a cada deploy.**

1. No projeto, clique com o botão direito no serviço (ou use **+ Create**) e escolha **Volume**.
2. Ligue o volume ao serviço do Deu Fome e use o caminho de montagem **`/data`**.

Se você esquecer, o painel do administrador mostra um aviso vermelho.

### 4. Variáveis

No serviço, aba **Variables**, crie:

| Variável | Valor |
| --- | --- |
| `PLATAFORMA_EMAIL` | seu e-mail de administrador |
| `PLATAFORMA_SENHA` | uma senha forte, com pelo menos 8 caracteres |
| `PORT` | `8080` |

Variáveis opcionais (cada uma liga uma função):

| Variável | Para quê |
| --- | --- |
| `APP_URL` | Endereço do site, ex. `https://deu-fome-production.up.railway.app`. Usado nos links dos e-mails e no login com Google |
| `BREVO_API_KEY` | Chave da Brevo para enviar e-mails (boas-vindas, esqueci minha senha, backup diário, alertas de erro) |
| `EMAIL_REMETENTE` | E-mail que aparece como remetente; precisa estar validado na Brevo |
| `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` | Liga o botão **Entrar com Google** |
| `CADASTRO_ABERTO` | `0` desliga o "Criar conta grátis" (aí só você cadastra restaurantes) |
| `EMPRESA_NOME` | Seu nome ou empresa, mostrado nos Termos, na Privacidade e no rodapé |
| `EMAIL_CONTATO` | E-mail de contato e do encarregado de dados (LGPD) |
| `FORO` | Cidade do foro nos Termos (padrão: Codó/MA) |
| `DATA_TERMOS` | Data da última atualização dos Termos (padrão: 9 de novembro de 2026) |

O administrador é criado no primeiro acesso. Trocar a variável depois **não** troca a senha: use **Minha senha** dentro do painel.

**Não consegue entrar?** Abra `https://SEU-DOMINIO/saude`. Os campos mostram se o e-mail foi lido (`variavel_email`), se a senha tem 8 caracteres ou mais (`variavel_senha_ok`), se o administrador já existe (`administrador_criado`) e se o volume está ligado (`volume`). Para forçar a senha das variáveis, crie `PLATAFORMA_REDEFINIR` = `1`, publique, entre, e depois apague essa variável.

### 5. Gerar o endereço

Aba **Settings → Networking → Generate Domain**. Se pedir a porta, use `8080`. Você recebe algo como `deu-fome-production.up.railway.app`. Se quiser um domínio próprio, adicione em **Custom Domain**.

Para conferir: abra `https://SEU-DOMINIO/saude`. Deve aparecer `{"ok":true,...}`.

### 6. Primeiro uso

1. Abra `https://SEU-DOMINIO/admin` e entre com `PLATAFORMA_EMAIL` e `PLATAFORMA_SENHA`.
2. **Novo estabelecimento:** nome, responsável, e-mail, senha inicial, PIN dos tablets e quantidade de mesas.
3. Envie ao responsável o endereço `/admin`, o e-mail e a senha. Ele monta o cardápio, cadastra a equipe e os tablets.

### Configurar o e-mail (Brevo)

1. Crie uma conta grátis em brevo.com (300 e-mails por dia).
2. **Senders, Domains & Dedicated IPs → Senders:** adicione e valide o e-mail remetente.
3. **SMTP & API → API Keys:** gere uma chave e coloque em `BREVO_API_KEY`. O remetente validado vai em `EMAIL_REMETENTE`.
4. No painel, aba **Sistema**, use **Enviar por e-mail agora** (em Backup) para testar.

Sem a Brevo o sistema funciona normalmente, só não envia e-mails (o "Esqueci minha senha" fica sem efeito).

### Configurar o login com Google

1. Em console.cloud.google.com crie um projeto.
2. **APIs e serviços → Tela de permissão OAuth:** tipo **Externo**, nome "Deu Fome", seu e-mail, e os links `https://SEU-DOMINIO/privacidade` e `https://SEU-DOMINIO/termos`. Escopos: `openid`, `email` e `profile`. Clique em **Publicar app**.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.**
4. Em **URIs de redirecionamento autorizados** coloque exatamente: `https://SEU-DOMINIO/auth/google/retorno`
5. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, e preencha `APP_URL`.

Quem entra com o Google pela primeira vez completa o cadastro do restaurante. Quem já tem conta com o mesmo e-mail entra direto e a conta fica ligada ao Google.

### 7. Configurar cada tablet

1. No painel do estabelecimento: **Dispositivos → Cadastrar tablet**, escolha a mesa e anote o código.
2. No tablet, abra `https://SEU-DOMINIO/tablet` no Chrome e digite o código.
3. Se a tela aparecer pequena ou cortada: menu do Chrome (⋮), desmarque **Site para computador**.
4. Para travar no app: **Fully Kiosk Browser** (Play Store) apontando para o endereço do tablet, ou **Fixar app** do Android. Para sair do app no tablet: 5 toques rápidos no logo e o PIN.

## Atualizar o sistema

Faça as mudanças, depois `git add . && git commit -m "..." && git push`. O Railway publica sozinho. Os tablets se atualizam sozinhos quando estão na tela inicial, sem ninguém precisar mexer neles.

## Funções da versão 1.1

- **Site de apresentação** em `/`, com **Termos de uso** e **Política de privacidade** (LGPD). Revise os textos antes de divulgar.
- **Criar conta sozinho**, **Entrar com Google** e **Esqueci minha senha** (link por e-mail, vale 1 hora).
- **Abertura animada** com o logo e **tema escuro** no painel (botão no rodapé do menu).
- **Relatórios:** faturamento, ticket médio, vendas por dia, movimento por hora, mais vendidos, formas de pagamento, mesas e avaliações, por período.
- **Fechamento de caixa** do dia, por forma de pagamento, com impressão.
- **Taxa de serviço** (liga e desliga na comanda), **dividir a conta** entre pessoas e várias formas de pagamento, com **troco** no dinheiro.
- **Imprimir** a conta no caixa e a comanda na cozinha (impressora térmica 80 mm), uma a uma ou automática.
- **Avaliação do cliente** no tablet: estrelas, marcadores e comentário.
- **Horário de funcionamento:** fora do horário o tablet mostra o cardápio, mas não aceita pedidos.
- **Botão Sugestão** no painel, que chega para você por e-mail e na aba **Sugestões**.
- **Erros** do servidor e dos navegadores ficam registrados; erros novos chegam por e-mail.

## Backup

Todo dia o sistema faz sozinho uma cópia do banco e envia em `.zip` para o `PLATAFORMA_EMAIL` (precisa da Brevo). As últimas 7 cópias ficam no volume, na pasta `backups`. Na aba **Sistema** você também pode **Baixar agora** ou **Enviar por e-mail agora**. As fotos ficam na pasta `uploads` do volume.

## Testar no seu computador

```
DEMO=1 php -S localhost:8000 -t public app/router.php
```

No Windows, dê dois cliques em `testar-local.bat`. Com `DEMO=1` o sistema cria dois restaurantes de exemplo (admin@cantinho.test, cozinha@cantinho.test, caixa@cantinho.test, senha 123456, PIN 1234). Os dados ficam na pasta `data` (apague-a para recomeçar).

Testes automáticos, com o servidor rodando com `DEMO=1` e as variáveis do administrador:

```
python testes/testar_api.py http://localhost:8000 SEU_EMAIL_ADMIN SUA_SENHA_ADMIN
```

São 170 verificações: isolamento entre estabelecimentos, funções da equipe, tablets, sessões de mesa, cardápio, fotos, limites de login, bloqueio, pedidos simultâneos, cadastro, Google, recuperação de senha, relatórios, caixa, taxa, divisão da conta, avaliações, horário, sugestões, erros e backup.

Para o teste completo (Google e e-mails), rode o servidor também com `EMAIL_LOG=1`, `GOOGLE_CLIENT_ID=teste-cliente`, `GOOGLE_CLIENT_SECRET=segredo`, `GOOGLE_AUTH_URL=http://127.0.0.1:8301/auth` e `GOOGLE_TOKEN_URL=http://127.0.0.1:8301/token`, e passe mais dois argumentos: a pasta de dados e `8301`. Com `EMAIL_LOG=1`, os e-mails são gravados em `data/emails.log` em vez de enviados: útil para testar o "Esqueci minha senha" no computador.

## Como está montado

- PHP 8.3 puro, sem bibliotecas externas; banco SQLite no volume (`/data/deufome.sqlite`) e fotos em `/data/uploads`.
- Servidor embutido do PHP com 8 processos em paralelo (`PHP_CLI_SERVER_WORKERS`). Atende bem os primeiros restaurantes; quando o volume de pedidos crescer, dá para trocar por Nginx + PHP-FPM e MySQL sem mudar as telas.
- Atualização das telas a cada 2–3 segundos.
- Segurança: senhas com hash, token por tablet (só o hash fica no banco), sessão de mesa validada no servidor, preço sempre recalculado no servidor, bloqueio após várias senhas erradas, cookies seguros com HTTPS, verificação de origem e cabeçalhos de segurança.

```
app/config.php   caminhos e variáveis de ambiente
app/db.php       banco, migrações e dados de demonstração
app/api.php      API do tablet, cozinha, salão e cadastros
app/contas.php   criar conta, Google e recuperação de senha
app/relatorios.php relatórios e fechamento de caixa
app/servicos.php e-mail, backup, erros, horários e tarefas diárias
app/router.php   páginas, arquivos, fotos e /saude
public/          site, termos, privacidade, telas (admin, cozinha, tablet), CSS, JS, imagens e fontes
Dockerfile       imagem usada pelo Railway
railway.json     teste de saúde e reinício automático
```
