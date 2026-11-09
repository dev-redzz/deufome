# Deu Fome — versão 2.1 (Laravel)

Plataforma de pedidos com um tablet fixo em cada mesa. Vários restaurantes usam o mesmo site, cada um com seus dados separados.

Feito em **Laravel 13** (PHP 8.3+), banco **SQLite** e visual com **Tailwind CSS 4** (compilado pelo Vite).

## Endereços

| Tela | Endereço | Quem usa |
| --- | --- | --- |
| Site de apresentação | `/` | Quem ainda não conhece o Deu Fome |
| Criar conta | `/cadastro` | Restaurante que quer começar sozinho |
| Painel | `/admin` | Você (administrador), donos, gerentes e caixas |
| Cozinha | `/cozinha` | Usuário com função Cozinha (TV ou tablet na cozinha) |
| Tablet da mesa | `/tablet` | Tablets das mesas, ativados com código |
| Termos e Privacidade | `/termos` e `/privacidade` | Todos |

## Organização das pastas

```
app/
  Http/Controllers/
    Auth/          login, Google, criar conta, esqueci minha senha
    Tablet/        tudo que o tablet da mesa usa
    Painel/        salão, caixa, relatórios, cardápio, mesas, tablets, equipe, configurações, cozinha
    Plataforma/    área do administrador do Deu Fome
    PaginaController.php, ArquivoController.php
  Http/Middleware/ papel (quem pode o quê), tablet (credencial), proteção da API, tarefas diárias
  Models/          Estabelecimento, Usuario, Mesa, Dispositivo, Produto, Pedido...
  Services/        e-mail (Brevo), backup, horário, personalização, monitor de erros...
  Database/        conexão SQLite que não trava com vários tablets ao mesmo tempo
database/
  migrations/      tabelas
  seeders/         DemoSeeder: restaurantes de exemplo (só com DEMO=1)
resources/
  views/           páginas Blade (site, termos, painel, tablet, cozinha, e-mail)
  css/app.css      visual inteiro (Tailwind)
  js/              admin.js, tablet.js, cozinha.js, comum.js
routes/
  web.php          páginas
  api.php          API usada pelas telas
  console.php      comandos: deufome:preparar, deufome:backup
public/build/      CSS e JS já compilados (vão junto no Git)
tests/api/         teste automático da API (Python)
```

## Testar no seu computador (Windows)

Precisa do **PHP 8.3 ou mais novo** e do **Composer** (os mesmos do Meu Cash). Confira com `php -v`.

1. Dê dois cliques em `testar-local.bat`. Na primeira vez ele roda o `composer install`.
2. Abra `http://localhost:8000/admin`.
   - Administrador: `admin@deufome.local`, senha `admin12345`
   - Restaurante de exemplo: `admin@cantinho.test`, senha `123456`, PIN do tablet `1234`
   - Cozinha: `cozinha@cantinho.test` · Caixa: `caixa@cantinho.test` (senha `123456`)
3. Os dados ficam em `storage/dados`. Apague essa pasta para recomeçar do zero.

Ou pelo terminal:

```
composer install
copy .env.example .env
php artisan deufome:preparar
php artisan serve
```

## Mudar o visual

O visual fica em `resources/css/app.css` e nas páginas de `resources/views`. Depois de mudar, compile:

```
npm install
npm run build
```

Isso atualiza a pasta `public/build`, que vai junto para o GitHub. Os tablets se atualizam sozinhos quando estão na tela inicial.

## Publicar no Railway

### 1. Enviar para o GitHub

No repositório do Deu Fome, **apague os arquivos da versão antiga** e coloque os desta pasta. Depois:

```
git add -A
git commit -m "Deu Fome 2.0 em Laravel"
git push
```

### 2. Serviço e volume

O Railway encontra o `Dockerfile` sozinho. O volume continua o mesmo, montado em **`/data`**. Sem volume, tudo é apagado a cada deploy.

O banco da versão 1 (PHP puro) **não é aproveitado**: no primeiro início, ele é guardado no volume como `deufome-versao-1-DATA.sqlite` e um banco novo é criado.

### 3. Variáveis (aba Variables)

Obrigatórias:

| Variável | Valor |
| --- | --- |
| `PLATAFORMA_EMAIL` | seu e-mail de administrador |
| `PLATAFORMA_SENHA` | uma senha forte, com pelo menos 8 caracteres |
| `PORT` | `8080` |
| `APP_URL` | o endereço do site, ex. `https://deu-fome-production.up.railway.app` |

Opcionais (cada uma liga uma função):

| Variável | Para quê |
| --- | --- |
| `BREVO_API_KEY` e `EMAIL_REMETENTE` | Envio de e-mails: boas-vindas, esqueci minha senha, backup diário, alertas de erro |
| `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` | Botão **Entrar com Google** |
| `CADASTRO_ABERTO` | `0` desliga o "Criar conta grátis" |
| `EMPRESA_NOME` | Seu nome ou empresa, nos Termos, na Privacidade e nos e-mails |
| `EMAIL_CONTATO` | E-mail de contato e do encarregado de dados (LGPD) |
| `FORO` | Cidade do foro nos Termos (padrão: Codó/MA) |
| `DATA_TERMOS` | Data da última atualização dos Termos |
| `APP_KEY` | Não precisa: o sistema cria uma chave e guarda no volume |
| `DEMO` | `1` cria os restaurantes de exemplo (só para teste; deixe sem em produção) |

O administrador é criado no primeiro início. Trocar a variável depois **não** troca a senha: use **Minha senha** no painel. Para forçar a senha das variáveis, crie `PLATAFORMA_REDEFINIR` = `1`, publique, entre, e depois apague essa variável.

**Não consegue entrar?** Abra `https://SEU-DOMINIO/saude`. Os campos mostram se o e-mail foi lido (`variavel_email`), se a senha tem 8 caracteres (`variavel_senha_ok`), se o administrador existe (`administrador_criado`) e se o volume está ligado (`volume`).

### 4. E-mail (Brevo)

1. Crie uma conta grátis em brevo.com (300 e-mails por dia).
2. **Senders, Domains & Dedicated IPs → Senders:** adicione e valide o e-mail remetente.
3. **SMTP & API → API Keys:** gere uma chave e coloque em `BREVO_API_KEY`. O remetente validado vai em `EMAIL_REMETENTE`.
4. No painel, aba **Sistema**, use **Enviar por e-mail agora** para testar.

### 5. Login com Google

1. Em console.cloud.google.com crie um projeto.
2. **APIs e serviços → Tela de permissão OAuth:** tipo **Externo**, nome "Deu Fome", seu e-mail, e os links `https://SEU-DOMINIO/privacidade` e `https://SEU-DOMINIO/termos`. Escopos: `openid`, `email`, `profile`. Clique em **Publicar app**.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.**
4. Em **URIs de redirecionamento autorizados** coloque exatamente `https://SEU-DOMINIO/auth/google/retorno`.
5. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

## Primeiro uso de um restaurante

1. O dono cria a conta em `/cadastro` (só nome do restaurante, nome, e-mail e senha) ou você cadastra em **Estabelecimentos**.
2. No **Salão**, os **Primeiros passos** mostram o que falta: mesas, cardápio, PIN e primeiro tablet.
3. Em **Personalizar**, o dono escolhe logo, cor, foto da tela inicial, tema claro ou escuro, Wi-Fi, Instagram, o que aparece no cardápio e o rodapé da conta impressa.
4. Em **Dispositivos**, cadastra o tablet e digita o código em `https://SEU-DOMINIO/tablet`.
5. No tablet: menu do Chrome (⋮), desmarque **Site para computador**. Para travar no app, use o **Fully Kiosk Browser** ou **Fixar app** do Android. Para sair: 5 toques no logo e o PIN.

## Backup

Todo dia o sistema faz uma cópia do banco e envia em `.zip` para o `PLATAFORMA_EMAIL` (precisa da Brevo). As últimas 7 cópias ficam no volume, em `backups`. Na aba **Sistema** dá para **Baixar agora** ou **Enviar por e-mail agora**. Pelo terminal: `php artisan deufome:backup`.

## Testes automáticos

Com o servidor rodando com `DEMO=1`, `EMAIL_LOG=1` e as variáveis de teste do Google:

```
python tests/api/testar_api.py http://localhost:8000 SEU_EMAIL_ADMIN SUA_SENHA_ADMIN PASTA_DE_DADOS 8301
```

São 181 verificações: isolamento entre restaurantes, funções da equipe, tablets, pedidos (inclusive 24 ao mesmo tempo), cozinha, conta com taxa e divisão, cadastro, personalização, Google, recuperação de senha, relatórios, caixa, avaliações, horário, sugestões, erros e backup. Para o teste do Google, rode o servidor com `GOOGLE_CLIENT_ID=teste-cliente`, `GOOGLE_CLIENT_SECRET=segredo`, `GOOGLE_AUTH_URL=http://127.0.0.1:8301/auth` e `GOOGLE_TOKEN_URL=http://127.0.0.1:8301/token`.
