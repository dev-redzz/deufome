# Deu Fome — versão online (v1.0)

Plataforma de pedidos com um tablet fixo em cada mesa. Vários estabelecimentos usam o mesmo site, cada um com seus dados separados.

## Endereços do sistema

| Tela | Endereço | Quem usa |
| --- | --- | --- |
| Painel | `https://SEU-DOMINIO/admin` | Você (administrador), donos, gerentes e caixas |
| Cozinha | `https://SEU-DOMINIO/cozinha` | Usuário com função Cozinha (TV ou tablet na cozinha) |
| Tablet da mesa | `https://SEU-DOMINIO/tablet` | Tablets das mesas, ativados com código |

## Quem faz o quê

- **Administrador do Deu Fome (você):** cadastra estabelecimentos, bloqueia e desbloqueia, baixa o backup.
- **Dono / Gerente:** salão, mesas, tablets, cardápio completo (com fotos e adicionais), equipe e ajustes (nome e PIN).
- **Caixa:** salão, chamados e fechamento de contas.
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

O administrador é criado no primeiro acesso. Trocar a variável depois **não** troca a senha: use **Minha senha** dentro do painel.

### 5. Gerar o endereço

Aba **Settings → Networking → Generate Domain**. Se pedir a porta, use `8080`. Você recebe algo como `deu-fome-production.up.railway.app`. Se quiser um domínio próprio, adicione em **Custom Domain**.

Para conferir: abra `https://SEU-DOMINIO/saude`. Deve aparecer `{"ok":true,...}`.

### 6. Primeiro uso

1. Abra `https://SEU-DOMINIO/admin` e entre com `PLATAFORMA_EMAIL` e `PLATAFORMA_SENHA`.
2. **Novo estabelecimento:** nome, responsável, e-mail, senha inicial, PIN dos tablets e quantidade de mesas.
3. Envie ao responsável o endereço `/admin`, o e-mail e a senha. Ele monta o cardápio, cadastra a equipe e os tablets.

### 7. Configurar cada tablet

1. No painel do estabelecimento: **Dispositivos → Cadastrar tablet**, escolha a mesa e anote o código.
2. No tablet, abra `https://SEU-DOMINIO/tablet` no Chrome e digite o código.
3. Se a tela aparecer pequena ou cortada: menu do Chrome (⋮), desmarque **Site para computador**.
4. Para travar no app: **Fully Kiosk Browser** (Play Store) apontando para o endereço do tablet, ou **Fixar app** do Android. Para sair do app no tablet: 5 toques rápidos no logo e o PIN.

## Atualizar o sistema

Faça as mudanças, depois `git add . && git commit -m "..." && git push`. O Railway publica sozinho. Os tablets se atualizam sozinhos quando estão na tela inicial, sem ninguém precisar mexer neles.

## Backup

No painel do administrador, **Baixar backup** gera uma cópia completa do banco (arquivo `.sqlite`). Faça isso com frequência e guarde fora do Railway. As fotos ficam na pasta `uploads` do volume.

## Testar no seu computador

```
DEMO=1 php -S localhost:8000 -t public app/router.php
```

No Windows, dê dois cliques em `testar-local.bat`. Com `DEMO=1` o sistema cria dois restaurantes de exemplo (admin@cantinho.test, cozinha@cantinho.test, caixa@cantinho.test, senha 123456, PIN 1234). Os dados ficam na pasta `data` (apague-a para recomeçar).

Testes automáticos, com o servidor rodando com `DEMO=1` e as variáveis do administrador:

```
python testes/testar_api.py http://localhost:8000 SEU_EMAIL_ADMIN SUA_SENHA_ADMIN
```

São 108 verificações: isolamento entre estabelecimentos, funções da equipe, tablets, sessões de mesa, cardápio, fotos, limites de login, bloqueio e pedidos simultâneos.

## Como está montado

- PHP 8.3 puro, sem bibliotecas externas; banco SQLite no volume (`/data/deufome.sqlite`) e fotos em `/data/uploads`.
- Servidor embutido do PHP com 8 processos em paralelo (`PHP_CLI_SERVER_WORKERS`). Atende bem os primeiros restaurantes; quando o volume de pedidos crescer, dá para trocar por Nginx + PHP-FPM e MySQL sem mudar as telas.
- Atualização das telas a cada 2–3 segundos.
- Segurança: senhas com hash, token por tablet (só o hash fica no banco), sessão de mesa validada no servidor, preço sempre recalculado no servidor, bloqueio após várias senhas erradas, cookies seguros com HTTPS, verificação de origem e cabeçalhos de segurança.

```
app/config.php   caminhos e variáveis de ambiente
app/db.php       banco, migrações e dados de demonstração
app/api.php      toda a API
app/router.php   páginas, arquivos, fotos e /saude
public/          telas (admin, cozinha, tablet), CSS, JS, imagens e fontes
Dockerfile       imagem usada pelo Railway
railway.json     teste de saúde e reinício automático
```
