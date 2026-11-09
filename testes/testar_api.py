"""Testes da API do Deu Fome (versão local).

Uso: com o servidor rodando em http://localhost:8000
    python testes/testar_api.py
"""
import json
import sys
import urllib.request
import urllib.error
import http.cookiejar
import uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
PLAT_EMAIL = sys.argv[2] if len(sys.argv) > 2 else ""
PLAT_SENHA = sys.argv[3] if len(sys.argv) > 3 else ""
DADOS = sys.argv[4] if len(sys.argv) > 4 else ""
GOOGLE_MOCK = int(sys.argv[5]) if len(sys.argv) > 5 else 0
ok = falhas = 0


def cliente():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def req(op, metodo, caminho, dados=None, token=None, tipo="application/json", origem=None):
    corpo = json.dumps(dados or {}).encode() if metodo == "POST" else None
    r = urllib.request.Request(BASE + caminho, data=corpo, method=metodo)
    if corpo is not None and tipo:
        r.add_header("Content-Type", tipo)
    if token:
        r.add_header("X-Device-Token", token)
    if origem:
        r.add_header("Origin", origem)
    try:
        with op.open(r) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def checar(nome, cond, extra=""):
    global ok, falhas
    if cond:
        ok += 1
        print(f"  ok    {nome}")
    else:
        falhas += 1
        print(f"  FALHA {nome} {extra}")


A = cliente()   # gerente do restaurante 1
B = cliente()   # gerente do restaurante 2
T = cliente()   # tablet (sem cookie de funcionário)

print("Login e isolamento")
checar("sem login é recusado", req(A, "GET", "/api/salao/mesas")[0] == 401)
checar("senha errada é recusada", req(A, "POST", "/api/login", {"email": "admin@cantinho.test", "senha": "x"})[0] == 422)
checar("login restaurante 1", req(A, "POST", "/api/login", {"email": "admin@cantinho.test", "senha": "123456"})[0] == 200)
checar("login restaurante 2", req(B, "POST", "/api/login", {"email": "admin@outro.test", "senha": "123456"})[0] == 200)
checar("POST sem JSON é recusado", req(A, "POST", "/api/logout", tipo="text/plain")[0] == 415)
_, mesasA = req(A, "GET", "/api/dispositivos")
_, mesasB = req(B, "GET", "/api/dispositivos")
idsA = {m["id"] for m in mesasA["mesas"]}
idsB = {m["id"] for m in mesasB["mesas"]}
checar("cada restaurante vê só suas mesas", idsA.isdisjoint(idsB) and len(idsA) == 6 and len(idsB) == 2)
mesa1 = mesasA["mesas"][0]["id"]
mesa2 = mesasA["mesas"][1]["id"]
mesaDeB = mesasB["mesas"][0]["id"]

print("Dispositivos e ativação")
s, r = req(A, "POST", "/api/dispositivos", {"nome": "Tablet 01", "mesa_id": mesa1})
checar("cadastra tablet com código", s == 201 and len(r["ativacao"]["codigo"]) == 6, r)
disp1, codigo1 = r["id"], r["ativacao"]["codigo"]
checar("não vincula tablet a mesa de outro restaurante", req(A, "POST", "/api/dispositivos", {"nome": "X", "mesa_id": mesaDeB})[0] == 404)
checar("não deixa duas tablets na mesma mesa", req(A, "POST", "/api/dispositivos", {"nome": "Tablet dup", "mesa_id": mesa1})[0] == 409)
checar("restaurante 2 não mexe no tablet do 1", req(B, "POST", f"/api/dispositivos/{disp1}/bloquear")[0] == 404)
checar("tablet sem token é recusado", req(T, "GET", "/api/tablet/estado")[0] == 401)
checar("código errado é recusado", req(T, "POST", "/api/tablet/ativar", {"codigo": "000000" if codigo1 != "000000" else "111111"})[0] == 422)
s, r = req(T, "POST", "/api/tablet/ativar", {"codigo": codigo1})
checar("ativa com código certo", s == 200 and len(r["token"]) == 64)
token1 = r["token"]
checar("código não pode ser usado duas vezes", req(T, "POST", "/api/tablet/ativar", {"codigo": codigo1})[0] == 422)
s, e = req(T, "GET", "/api/tablet/estado", token=token1)
checar("tablet sabe sua mesa pelo servidor", s == 200 and e["mesa"]["numero"] == 1 and e["sessao"] is None, e)
checar("token falso é recusado", req(T, "GET", "/api/tablet/estado", token="a" * 64)[0] == 401)

print("Cardápio")
s, c = req(T, "GET", "/api/tablet/cardapio", token=token1)
produtos = [p for cat in c["categorias"] for p in cat["produtos"]]
checar("cardápio vem só do restaurante do tablet", s == 200 and all(p["nome"] != "Pizza Secreta" for p in produtos))
burger = next(p for p in produtos if p["nome"] == "Burger Clássico")
bacon = next(a for a in burger["adicionais"] if a["nome"] == "Bacon")
_, c2 = req(B, "GET", "/api/produtos")
pizza = c2["categorias"][0]["produtos"][0]

print("Pedidos (passos 4 a 11)")
chave = str(uuid.uuid4())
pedido = {"chave": chave, "itens": [
    {"produto_id": burger["id"], "quantidade": 2, "adicionais": [bacon["id"]], "observacao": "Sem cebola", "preco": 1},
]}
s, r = req(T, "POST", "/api/tablet/pedidos", pedido, token=token1)
esperado = (burger["preco"] + bacon["preco"]) * 2
checar("pedido criado com preço calculado no servidor", s == 201 and r["total"] == esperado, r)
s, r2 = req(T, "POST", "/api/tablet/pedidos", pedido, token=token1)
checar("mesma chave não duplica pedido", s == 200 and r2.get("repetido") and r2["pedido_id"] == r["pedido_id"])
checar("produto de outro restaurante é recusado",
       req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": pizza["id"], "quantidade": 1}]}, token=token1)[0] == 422)
checar("adicional de outro produto é recusado",
       req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": produtos[3]["id"], "quantidade": 1, "adicionais": [bacon["id"]]}]}, token=token1)[0] == 422)
checar("quantidade absurda é recusada",
       req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 500}]}, token=token1)[0] == 422)
checar("mesa_id enviado pelo tablet é ignorado",
       req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "mesa_id": mesa2, "itens": [{"produto_id": produtos[8]["id"], "quantidade": 1}]}, token=token1)[0] == 201)
_, e = req(T, "GET", "/api/tablet/estado", token=token1)
sessao1 = e["sessao"]["id"]
checar("dois pedidos na mesma sessão/comanda", len(e["pedidos"]) == 2 and e["total"] == esperado + produtos[8]["preco"])
_, mesas = req(A, "GET", "/api/salao/mesas")
checar("mesa 2 continua livre", next(m for m in mesas["mesas"] if m["id"] == mesa2)["sessao"] is None)

print("Cozinha")
_, k = req(A, "GET", "/api/cozinha/pedidos")
checar("cozinha recebe os pedidos", len(k["pedidos"]) == 2 and k["pedidos"][0]["mesa"] == 1)
_, kB = req(B, "GET", "/api/cozinha/pedidos")
checar("cozinha do outro restaurante não vê nada", kB["pedidos"] == [])
pid = k["pedidos"][0]["id"]
checar("pular de recebido para entregue é recusado", req(A, "POST", f"/api/cozinha/pedidos/{pid}/status", {"status": "entregue"})[0] == 409)
checar("cozinha inicia preparo", req(A, "POST", f"/api/cozinha/pedidos/{pid}/status", {"status": "preparo"})[0] == 200)
checar("cozinha marca pronto", req(A, "POST", f"/api/cozinha/pedidos/{pid}/status", {"status": "pronto"})[0] == 200)
checar("outro restaurante não altera pedido", req(B, "POST", f"/api/cozinha/pedidos/{pid}/status", {"status": "entregue"})[0] == 404)
_, e = req(T, "GET", "/api/tablet/estado", token=token1)
checar("tablet vê o status atualizado", e["pedidos"][0]["status"] == "pronto")

print("Conta e fechamento (passos 12 a 14)")
checar("cliente chama garçom", req(T, "POST", "/api/tablet/chamar", {"tipo": "garcom"}, token=token1)[0] == 200)
checar("cliente pede a conta", req(T, "POST", "/api/tablet/chamar", {"tipo": "conta"}, token=token1)[0] == 200)
_, e = req(T, "GET", "/api/tablet/estado", token=token1)
checar("sessão fica com conta solicitada", e["sessao"]["status"] == "conta_solicitada")
checar("novo pedido bloqueado após pedir conta",
       req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=token1)[0] == 409)
checar("outro restaurante não vê a comanda", req(B, "GET", f"/api/salao/sessoes/{sessao1}")[0] == 404)
checar("fechar sem forma de pagamento é recusado", req(A, "POST", f"/api/salao/sessoes/{sessao1}/fechar", {})[0] == 422)
s, r = req(A, "POST", f"/api/salao/sessoes/{sessao1}/fechar", {"forma": "pix"})
checar("caixa recebe e libera a mesa", s == 200 and r["total"] == esperado + produtos[8]["preco"])
_, e = req(T, "GET", "/api/tablet/estado", token=token1)
checar("tablet não vê mais nada da sessão anterior", e["sessao"] is None and e["pedidos"] == [] and e["total"] == 0 and e["chamados_abertos"] == [])
_, mesas = req(A, "GET", "/api/salao/mesas")
checar("mesa e chamados liberados", next(m for m in mesas["mesas"] if m["id"] == mesa1)["sessao"] is None and all(not m["chamados"] for m in mesas["mesas"]))
s, r = req(T, "POST", "/api/tablet/pedidos", {"chave": chave, "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=token1)
_, e = req(T, "GET", "/api/tablet/estado", token=token1)
checar("próximo cliente abre sessão nova e limpa", s == 201 and e["sessao"]["id"] != sessao1 and len(e["pedidos"]) == 1)

print("Troca de mesa, bloqueio e PIN")
checar("PIN errado é recusado", req(T, "POST", "/api/tablet/desbloquear", {"pin": "0000"}, token=token1)[0] == 422)
checar("PIN certo libera saída", req(T, "POST", "/api/tablet/desbloquear", {"pin": "1234"}, token=token1)[0] == 200)
checar("painel troca a mesa", req(A, "POST", f"/api/dispositivos/{disp1}/mesa", {"mesa_id": mesa2})[0] == 200)
_, e = req(T, "GET", "/api/tablet/estado", token=token1)
checar("tablet passa a ser da mesa 2", e["mesa"]["numero"] == 2 and e["sessao"] is None)
checar("painel bloqueia o tablet", req(A, "POST", f"/api/dispositivos/{disp1}/bloquear")[0] == 200)
checar("tablet bloqueado perde acesso", req(T, "GET", "/api/tablet/estado", token=token1)[0] in (401, 403))
s, r = req(A, "POST", f"/api/dispositivos/{disp1}/credencial")
checar("nova credencial gera novo código", s == 200 and len(r["ativacao"]["codigo"]) == 6)
s, r = req(T, "POST", "/api/tablet/ativar", {"codigo": r["ativacao"]["codigo"]})
checar("token antigo continua inválido após reativar", s == 200 and req(T, "GET", "/api/tablet/estado", token=token1)[0] == 401)


def upload(op, caminho, arquivo_bytes, nome="foto.png", tipo="image/png"):
    limite = "----deufome" + uuid.uuid4().hex
    corpo = (f"--{limite}\r\nContent-Disposition: form-data; name=\"imagem\"; filename=\"{nome}\"\r\nContent-Type: {tipo}\r\n\r\n").encode() + arquivo_bytes + f"\r\n--{limite}--\r\n".encode()
    r = urllib.request.Request(BASE + caminho, data=corpo, method="POST", headers={"Content-Type": f"multipart/form-data; boundary={limite}"})
    try:
        with op.open(r) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

print("Segurança de origem e limites de login")
checar("POST de outro site é recusado", req(A, "POST", "/api/mesas", {"numero": 50}, origem="https://site-malicioso.com")[0] == 403)
checar("POST do próprio site é aceito", req(A, "POST", "/api/mesas", {"numero": 50}, origem=BASE)[0] == 201)
X = cliente()
codigos = [req(X, "POST", "/api/login", {"email": "ninguem@teste.com", "senha": "errada"})[0] for _ in range(9)]
checar("muitas senhas erradas bloqueiam por 15 min", codigos[-1] == 429, codigos)

print("Funções da equipe")
K = cliente(); C = cliente()
checar("login da cozinha", req(K, "POST", "/api/login", {"email": "cozinha@cantinho.test", "senha": "123456"})[1].get("papel") == "cozinha")
checar("cozinha vê os pedidos", req(K, "GET", "/api/cozinha/pedidos")[0] == 200)
checar("cozinha não vê o salão", req(K, "GET", "/api/salao/mesas")[0] == 403)
checar("cozinha não mexe em tablets", req(K, "GET", "/api/dispositivos")[0] == 403)
req(C, "POST", "/api/login", {"email": "caixa@cantinho.test", "senha": "123456"})
checar("caixa vê o salão", req(C, "GET", "/api/salao/mesas")[0] == 200)
checar("caixa não mexe no cardápio", req(C, "POST", "/api/categorias", {"nome": "X"})[0] == 403)
checar("caixa não vê a equipe", req(C, "GET", "/api/equipe")[0] == 403)

print("Mesas")
checar("mesa repetida é recusada", req(A, "POST", "/api/mesas", {"numero": 50})[0] == 409)
_, lm = req(A, "GET", "/api/mesas")
m50 = next(m for m in lm["mesas"] if m["numero"] == 50)
checar("renomeia mesa", req(A, "POST", f"/api/mesas/{m50['id']}", {"nome": "Varanda 1"})[0] == 200)
checar("não troca para número já usado", req(A, "POST", f"/api/mesas/{m50['id']}", {"numero": 1})[0] == 409)
checar("outro restaurante não mexe na mesa", req(B, "POST", f"/api/mesas/{m50['id']}/remover")[0] == 404)
s, r = req(A, "POST", "/api/dispositivos", {"nome": "Tablet Varanda", "mesa_id": m50["id"]})
tv = req(T, "POST", "/api/tablet/ativar", {"codigo": r["ativacao"]["codigo"]})[1]["token"]
req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=tv)
checar("não remove mesa com conta aberta", req(A, "POST", f"/api/mesas/{m50['id']}/remover")[0] == 409)
_, est = req(T, "GET", "/api/tablet/estado", token=tv)
req(A, "POST", f"/api/salao/sessoes/{est['sessao']['id']}/fechar", {"forma": "dinheiro"})
checar("remove mesa depois de fechar a conta", req(A, "POST", f"/api/mesas/{m50['id']}/remover")[0] == 200)
_, est = req(T, "GET", "/api/tablet/estado", token=tv)
checar("tablet da mesa removida fica sem mesa", est["mesa"] is None)
checar("tablet sem mesa não faz pedido", req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=tv)[0] == 409)
checar("recriar a mesa 50 reativa a antiga", req(A, "POST", "/api/mesas", {"numero": 50})[0] == 201)

print("Cardápio completo")
s, r = req(A, "POST", "/api/categorias", {"nome": "Combos"})
cat = r["id"]
checar("cria categoria", s == 201)
s, r = req(A, "POST", "/api/produtos", {"categoria_id": cat, "nome": "Combo Casal", "descricao": "2 burgers e 1 batata", "preco": 6990, "adicionais": [{"nome": "Refri 1L", "preco": 900}, {"nome": "Sem cebola", "preco": 0}]})
novo = r.get("id")
checar("cria produto com adicionais", s == 201 and novo)
checar("produto em categoria de outro restaurante é recusado", req(B, "POST", "/api/produtos", {"categoria_id": cat, "nome": "X", "preco": 100})[0] == 404)
checar("preço inválido é recusado", req(A, "POST", "/api/produtos", {"categoria_id": cat, "nome": "Y", "preco": "abc"})[0] == 422)
_, card = req(T, "GET", "/api/tablet/cardapio", token=token1 if False else tv)
combo = next(p for c in card["categorias"] for p in c["produtos"] if p["id"] == novo)
checar("tablet já vê o produto novo", combo["preco"] == 6990 and len(combo["adicionais"]) == 2)
refri = next(a for a in combo["adicionais"] if a["nome"] == "Refri 1L")
req(A, "POST", f"/api/produtos/{novo}", {"preco": 7490, "adicionais": [{"id": refri["id"], "nome": "Refri 2L", "preco": 1200}]})
_, card = req(T, "GET", "/api/tablet/cardapio", token=tv)
combo = next(p for c in card["categorias"] for p in c["produtos"] if p["id"] == novo)
checar("edição mantém o adicional e remove o outro", combo["preco"] == 7490 and [(a["id"], a["nome"], a["preco"]) for a in combo["adicionais"]] == [(refri["id"], "Refri 2L", 1200)])
png = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")
s, r = upload(A, f"/api/produtos/{novo}/imagem", png)
checar("envia foto do produto", s == 200 and r["imagem"].startswith("/arquivos/"), r)
foto = r.get("imagem", "")
try:
    with urllib.request.urlopen(BASE + foto) as resp:
        checar("foto é servida", resp.status == 200 and resp.headers["Content-Type"] == "image/png")
except urllib.error.HTTPError:
    checar("foto é servida", False)
checar("arquivo que não é imagem é recusado", upload(A, f"/api/produtos/{novo}/imagem", b"<?php echo 1;", "x.php", "image/png")[0] == 422)
checar("não apaga categoria com produtos", req(A, "POST", f"/api/categorias/{cat}/remover")[0] == 409)
checar("move categoria", req(A, "POST", f"/api/categorias/{cat}/mover", {"direcao": -1})[0] == 200)
_, lista = req(A, "GET", "/api/produtos")
checar("categoria subiu uma posição", [c["id"] for c in lista["categorias"]].index(cat) == len(lista["categorias"]) - 2)
checar("apaga produto", req(A, "POST", f"/api/produtos/{novo}/remover")[0] == 200)
try:
    urllib.request.urlopen(BASE + foto); checar("foto do produto apagado some", False)
except urllib.error.HTTPError as e:
    checar("foto do produto apagado some", e.code == 404)
checar("apaga categoria vazia", req(A, "POST", f"/api/categorias/{cat}/remover")[0] == 200)

print("Equipe e ajustes")
checar("cadastra caixa", req(A, "POST", "/api/equipe", {"nome": "Ana", "email": "ana@cantinho.test", "papel": "caixa", "senha": "senha-da-ana"})[0] == 201)
checar("senha curta é recusada", req(A, "POST", "/api/equipe", {"nome": "Bia", "email": "bia@cantinho.test", "papel": "caixa", "senha": "123"})[0] == 422)
checar("e-mail repetido é recusado", req(A, "POST", "/api/equipe", {"nome": "Ana 2", "email": "ana@cantinho.test", "papel": "caixa", "senha": "senha-da-ana"})[0] == 409)
_, eq = req(A, "GET", "/api/equipe")
eu_id = eq["eu"]
ana = next(p for p in eq["equipe"] if p["email"] == "ana@cantinho.test")
checar("não se desativa", req(A, "POST", f"/api/equipe/{eu_id}", {"ativo": False})[0] == 409)
checar("outro restaurante não mexe na equipe", req(B, "POST", f"/api/equipe/{ana['id']}", {"ativo": False})[0] == 404)
checar("desativa a Ana", req(A, "POST", f"/api/equipe/{ana['id']}", {"ativo": False})[0] == 200)
checar("Ana desativada não entra", req(cliente(), "POST", "/api/login", {"email": "ana@cantinho.test", "senha": "senha-da-ana"})[0] == 422)
checar("troca o PIN", req(A, "POST", "/api/config", {"pin": "4321"})[0] == 200)
checar("PIN antigo não vale mais", req(T, "POST", "/api/tablet/desbloquear", {"pin": "1234"}, token=tv)[0] == 422)
checar("PIN novo funciona", req(T, "POST", "/api/tablet/desbloquear", {"pin": "4321"}, token=tv)[0] == 200)
checar("senha atual errada é recusada", req(A, "POST", "/api/minha-senha", {"atual": "x", "nova": "nova-senha-123"})[0] == 422)

if PLAT_EMAIL:
    print("Administração da plataforma")
    P = cliente()
    checar("gerente não acessa a plataforma", req(A, "GET", "/api/plataforma/estabelecimentos")[0] == 403)
    s, r = req(P, "POST", "/api/login", {"email": PLAT_EMAIL, "senha": PLAT_SENHA})
    checar("login do administrador", s == 200 and r["papel"] == "plataforma")
    checar("administrador não entra nas telas de restaurante", req(P, "GET", "/api/salao/mesas")[0] == 403)
    s, r = req(P, "POST", "/api/plataforma/estabelecimentos", {"nome": "Pizzaria Nova", "dono_nome": "Rui", "dono_email": "rui@pizzarianova.com", "dono_senha": "senha-do-rui", "pin": "2468", "mesas": 4})
    checar("cria estabelecimento", s == 201, r)
    novo_t = r.get("id")
    _, lst = req(P, "GET", "/api/plataforma/estabelecimentos")
    pn = next(t for t in lst["estabelecimentos"] if t["id"] == novo_t)
    checar("lista com dono e mesas", pn["dono_email"] == "rui@pizzarianova.com" and pn["mesas"] == 4)
    R = cliente()
    checar("dono novo entra", req(R, "POST", "/api/login", {"email": "rui@pizzarianova.com", "senha": "senha-do-rui"})[0] == 200)
    _, cardR = req(R, "GET", "/api/produtos")
    checar("estabelecimento novo começa vazio", cardR["categorias"] == [])
    s, r = req(R, "POST", "/api/dispositivos", {"nome": "T1", "mesa_id": None})
    tr = req(T, "POST", "/api/tablet/ativar", {"codigo": r["ativacao"]["codigo"]})[1]["token"]
    checar("bloqueia estabelecimento", req(P, "POST", f"/api/plataforma/estabelecimentos/{novo_t}", {"status": "bloqueado"})[0] == 200)
    checar("dono bloqueado perde acesso", req(R, "GET", "/api/produtos")[0] == 403)
    checar("tablet bloqueado perde acesso", req(T, "GET", "/api/tablet/estado", token=tr)[0] == 403)
    checar("outros restaurantes seguem normais", req(A, "GET", "/api/salao/mesas")[0] == 200)
    req(P, "POST", f"/api/plataforma/estabelecimentos/{novo_t}", {"status": "ativo"})
    checar("desbloqueio devolve o acesso", req(R, "GET", "/api/produtos")[0] == 200)

print("Vários acessos ao mesmo tempo")
import concurrent.futures
def pedir(_):
    return req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=tv if False else tokens_lote)[0]
_, lm = req(A, "GET", "/api/mesas")
livre = next(m for m in lm["mesas"] if not m["ocupada"] and not m["tablet"])
s, r = req(A, "POST", "/api/dispositivos", {"nome": "Tablet Lote", "mesa_id": livre["id"]})
tokens_lote = req(T, "POST", "/api/tablet/ativar", {"codigo": r["ativacao"]["codigo"]})[1]["token"]
with concurrent.futures.ThreadPoolExecutor(12) as ex:
    res = list(ex.map(pedir, range(24)))
_, est = req(T, "GET", "/api/tablet/estado", token=tokens_lote)
checar("24 pedidos simultâneos, todos aceitos numa só comanda", all(c == 201 for c in res) and len(est["pedidos"]) == 24, res)


import os, time, base64, threading, re as _re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, quote

class SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None

def cliente_sem_redir():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), SemRedirecionar)

def ir(op, caminho):
    try:
        with op.open(BASE + caminho) as r:
            return r.status, r.headers.get("Location", "")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Location", "")

def emails():
    if not DADOS: return []
    try:
        return [json.loads(l) for l in open(os.path.join(DADOS, "emails.log"), encoding="utf-8") if l.strip()]
    except FileNotFoundError:
        return []

print("Cadastro livre")
N = cliente()
base_cad = {"restaurante": "Lanchonete Teste", "nome": "Joana", "email": "joana@lanchonete.com", "senha": "senha-joana-1", "pin": "1111", "mesas": 3}
checar("cadastro sem aceitar termos é recusado", req(N, "POST", "/api/cadastro", base_cad)[0] == 422)
checar("PIN inválido é recusado", req(N, "POST", "/api/cadastro", {**base_cad, "pin": "12", "aceite": True})[0] == 422)
s, r = req(N, "POST", "/api/cadastro", {**base_cad, "aceite": True})
checar("restaurante se cadastra sozinho", s == 201, r)
_, eu = req(N, "GET", "/api/me")
checar("já entra logado como dono", eu.get("papel") == "dono" and eu.get("estabelecimento") == "Lanchonete Teste")
checar("cria as mesas pedidas", len(req(N, "GET", "/api/mesas")[1]["mesas"]) == 3)
checar("e-mail repetido no cadastro é recusado", req(cliente(), "POST", "/api/cadastro", {**base_cad, "aceite": True})[0] == 409)
if DADOS:
    checar("e-mail de boas-vindas enviado", any(e["para"] == "joana@lanchonete.com" and "Bem-vindo" in e["assunto"] for e in emails()))

print("Esqueci minha senha")
antes = len(emails())
checar("pedido para e-mail inexistente responde igual", req(cliente(), "POST", "/api/senha/esqueci", {"email": "naoexiste@x.com"})[0] == 200)
checar("pedido para e-mail real", req(cliente(), "POST", "/api/senha/esqueci", {"email": "joana@lanchonete.com"})[0] == 200)
if DADOS:
    novos = emails()[antes:]
    checar("só o e-mail real recebe o link", len(novos) == 1 and novos[0]["para"] == "joana@lanchonete.com")
    token = _re.search(r"#redefinir=([a-f0-9]{64})", novos[0]["html"]).group(1) if novos else ""
    checar("senha curta na redefinição é recusada", req(cliente(), "POST", "/api/senha/redefinir", {"token": token, "senha": "123"})[0] == 422)
    checar("redefine a senha com o link", req(cliente(), "POST", "/api/senha/redefinir", {"token": token, "senha": "senha-nova-joana"})[0] == 200)
    checar("link não pode ser usado de novo", req(cliente(), "POST", "/api/senha/redefinir", {"token": token, "senha": "outra-senha-123"})[0] == 422)
    checar("entra com a senha nova", req(cliente(), "POST", "/api/login", {"email": "joana@lanchonete.com", "senha": "senha-nova-joana"})[0] == 200)
    checar("senha antiga não vale mais", req(cliente(), "POST", "/api/login", {"email": "joana@lanchonete.com", "senha": "senha-joana-1"})[0] == 422)

if GOOGLE_MOCK:
    print("Login com Google")
    contas_google = {"novo": {"sub": "g-111", "email": "carlos@gmail.com", "name": "Carlos Souza"}, "existente": {"sub": "g-222", "email": "admin@cantinho.test", "name": "Gerente"}}
    proxima = {"conta": None}
    class Mock(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_POST(self):
            corpo = parse_qs(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode())
            c = contas_google[proxima["conta"]]
            claims = {"iss": "https://accounts.google.com", "aud": corpo.get("client_id", [""])[0], "exp": int(time.time()) + 3600, "email_verified": True, **c}
            b64 = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
            dados = json.dumps({"id_token": b64({"alg": "RS256"}) + "." + b64(claims) + ".assinatura", "access_token": "x"}).encode()
            self.send_response(200 if corpo.get("code", [""])[0] == "codigo-bom" else 400)
            self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(dados)
    srv = HTTPServer(("127.0.0.1", GOOGLE_MOCK), Mock); threading.Thread(target=srv.serve_forever, daemon=True).start()
    G = cliente_sem_redir()
    s, loc = ir(G, "/auth/google?modo=cadastro")
    state = parse_qs(urlparse(loc).query).get("state", [""])[0]
    checar("redireciona para o Google com state", s == 302 and "client_id=teste-cliente" in loc and len(state) == 32)
    checar("state errado é recusado", ir(G, "/auth/google/retorno?code=codigo-bom&state=errado")[1].endswith("#erro=google-sessao"))
    s, loc = ir(G, "/auth/google?modo=cadastro"); state = parse_qs(urlparse(loc).query)["state"][0]
    proxima["conta"] = "novo"
    s, loc = ir(G, f"/auth/google/retorno?code=codigo-bom&state={state}")
    checar("conta nova vai para completar o cadastro", s == 302 and loc.endswith("/cadastro#google"), loc)
    _, pend = req(G, "GET", "/api/cadastro/google")
    checar("cadastro recebe nome e e-mail do Google", pend.get("email") == "carlos@gmail.com" and pend.get("nome") == "Carlos Souza")
    s, r = req(G, "POST", "/api/cadastro/google", {"nome": "Carlos", "restaurante": "Pastelaria do Carlos", "pin": "2222", "mesas": 2, "aceite": True})
    checar("cria restaurante com Google", s == 201, r)
    checar("entra como dono pelo Google", req(G, "GET", "/api/me")[1].get("email") == "carlos@gmail.com")
    G2 = cliente_sem_redir()
    s, loc = ir(G2, "/auth/google"); state = parse_qs(urlparse(loc).query)["state"][0]
    proxima["conta"] = "existente"
    s, loc = ir(G2, f"/auth/google/retorno?code=codigo-bom&state={state}")
    checar("conta existente entra direto pelo Google", s == 302 and loc == "/admin" and req(G2, "GET", "/api/me")[1].get("email") == "admin@cantinho.test", loc)
    G3 = cliente_sem_redir()
    s, loc = ir(G3, "/auth/google"); state = parse_qs(urlparse(loc).query)["state"][0]
    checar("código inválido não entra", ir(G3, f"/auth/google/retorno?code=codigo-ruim&state={state}")[1].endswith("#erro=google-falhou") and req(G3, "GET", "/api/me")[0] == 401)
    srv.shutdown()

print("Taxa de serviço, divisão e caixa")
_, lm = req(A, "GET", "/api/mesas")
m3 = next(m for m in lm["mesas"] if not m["ocupada"] and not m["tablet"])
s, r = req(A, "POST", "/api/dispositivos", {"nome": "Tablet Conta", "mesa_id": m3["id"]})
tc = req(T, "POST", "/api/tablet/ativar", {"codigo": r["ativacao"]["codigo"]})[1]["token"]
req(A, "POST", "/api/config", {"taxa_servico": 10})
req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 3}]}, token=tc)
_, est = req(T, "GET", "/api/tablet/estado", token=tc)
sub = est["total"]; taxa = round(sub * 0.10); total = sub + taxa
checar("tablet recebe a taxa de serviço", est["taxa_servico"] == 10)
sid = est["sessao"]["id"]
checar("pagamentos que não somam o total são recusados", req(A, "POST", f"/api/salao/sessoes/{sid}/fechar", {"cobrar_taxa": True, "pessoas": 2, "pagamentos": [{"forma": "pix", "valor": 100}]})[0] == 422)
checar("forma de pagamento inválida é recusada", req(A, "POST", f"/api/salao/sessoes/{sid}/fechar", {"cobrar_taxa": True, "pagamentos": [{"forma": "cheque", "valor": total}]})[0] == 422)
print("Avaliação do cliente")
checar("nota inválida é recusada", req(T, "POST", "/api/tablet/avaliar", {"nota": 7}, token=tc)[0] == 422)
checar("cliente avalia", req(T, "POST", "/api/tablet/avaliar", {"nota": 5, "tags": ["Comida ótima", "tag inventada"], "comentario": "Muito bom!"}, token=tc)[0] == 201)
checar("só uma avaliação por atendimento", req(T, "POST", "/api/tablet/avaliar", {"nota": 1}, token=tc)[0] == 409)
checar("tablet sabe que já avaliou", req(T, "GET", "/api/tablet/estado", token=tc)[1]["avaliado"] is True)
_, com = req(A, "GET", f"/api/salao/sessoes/{sid}")
checar("comanda mostra a avaliação sem tags inventadas", com["avaliacao"]["nota"] == 5 and com["avaliacao"]["tags"] == ["Comida ótima"])
metade = total // 2
s, r = req(A, "POST", f"/api/salao/sessoes/{sid}/fechar", {"cobrar_taxa": True, "pessoas": 2, "pagamentos": [{"forma": "pix", "valor": metade}, {"forma": "dinheiro", "valor": total - metade}]})
checar("fecha conta dividida com taxa de 10%", s == 200 and r["taxa"] == taxa and r["total"] == total, r)
_, cx = req(C, "GET", "/api/caixa")
pix = next(f for f in cx["formas"] if f["forma"] == "pix")["total"]; din = next(f for f in cx["formas"] if f["forma"] == "dinheiro")["total"]
conta = next((c for c in cx["contas"] if len(c["pagamentos"]) == 2 and c["taxa"] == taxa), None)
checar("caixa (função caixa) vê a conta dividida", conta is not None and conta["pessoas"] == 2)
checar("caixa soma por forma de pagamento", pix >= metade and din >= total - metade)
checar("cozinha não vê o caixa", req(K, "GET", "/api/caixa")[0] == 403)

print("Relatórios")
_, rel = req(A, "GET", "/api/relatorios?periodo=hoje")
checar("relatório do dia tem as contas fechadas", rel["resumo"]["contas"] >= 3 and rel["resumo"]["faturado"] > 0)
checar("relatório traz a avaliação", rel["avaliacoes"]["total"] >= 1 and rel["avaliacoes"]["media"] is not None)
checar("relatório traz mais vendidos e horas", rel["produtos"] and len(rel["por_hora"]) == 24)
_, rel30 = req(A, "GET", "/api/relatorios?periodo=30d")
checar("30 dias têm 30 barras", len(rel30["por_dia"]) == 30)
checar("período personalizado inválido é recusado", req(A, "GET", "/api/relatorios?periodo=personalizado&de=xx&ate=2026-01-01")[0] == 422)
checar("caixa não vê relatórios", req(C, "GET", "/api/relatorios")[0] == 403)
checar("relatório de outro restaurante vem vazio", req(N, "GET", "/api/relatorios?periodo=30d")[1]["resumo"]["contas"] == 0)

print("Tempo de preparo")
req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=tc)
pid = max(p["id"] for p in req(K, "GET", "/api/cozinha/pedidos")[1]["pedidos"])
req(K, "POST", f"/api/cozinha/pedidos/{pid}/status", {"status": "preparo"}); req(K, "POST", f"/api/cozinha/pedidos/{pid}/status", {"status": "pronto"})
checar("tempo de preparo é calculado", req(A, "GET", "/api/relatorios?periodo=hoje")[1]["resumo"]["preparo_min"] is not None)

print("Horário de funcionamento")
from datetime import datetime, timedelta, timezone
agora_sp = datetime.now(timezone(timedelta(hours=-3)))
fora = [(agora_sp + timedelta(hours=2)).strftime("%H:00"), (agora_sp + timedelta(hours=3)).strftime("%H:00")]
dentro = [(agora_sp - timedelta(hours=1)).strftime("%H:%M"), (agora_sp + timedelta(hours=1)).strftime("%H:%M")]
checar("horário inválido é recusado", req(A, "POST", "/api/config", {"horarios": {"ativo": True, "dias": {"0": [["25:00", "26:00"]]}}})[0] == 422)
s, r = req(A, "POST", "/api/config", {"horarios": {"ativo": True, "dias": {str(d): [fora] for d in range(7)}}})
checar("salva horário e mostra fechado agora", s == 200 and r["situacao"]["aberto"] is False and r["situacao"]["proxima"], r)
_, est = req(T, "GET", "/api/tablet/estado", token=tc)
checar("tablet sabe que está fechado", est["horario"]["aberto"] is False)
s, r = req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=tc)
checar("pedido fora do horário é recusado", s == 409 and "fechados" in r["erro"])
req(A, "POST", "/api/config", {"horarios": {"ativo": True, "dias": {str(d): [dentro] for d in range(7)}}})
checar("dentro do horário volta a aceitar", req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": burger["id"], "quantidade": 1}]}, token=tc)[0] == 201)
req(A, "POST", "/api/config", {"horarios": {"ativo": False, "dias": {}}})
checar("sem controle de horário aceita sempre", req(T, "GET", "/api/tablet/estado", token=tc)[1]["horario"]["controle"] is False)
checar("taxa acima de 30% é recusada", req(A, "POST", "/api/config", {"taxa_servico": 50})[0] == 422)
checar("fuso inválido é recusado", req(A, "POST", "/api/config", {"fuso": "Marte/Base"})[0] == 422)

print("Sugestões, erros e backup")
checar("sugestão curta é recusada", req(A, "POST", "/api/sugestoes", {"tipo": "sugestao", "texto": "oi"})[0] == 422)
checar("envia sugestão", req(A, "POST", "/api/sugestoes", {"tipo": "problema", "texto": "A impressora cortou a comanda."})[0] == 201)
checar("navegador reporta erro", req(cliente(), "POST", "/api/erros", {"mensagem": "TypeError: x is undefined", "detalhe": "at tablet.js:10", "url": "/tablet"})[0] == 200)
req(cliente(), "POST", "/api/erros", {"mensagem": "TypeError: x is undefined", "detalhe": "at tablet.js:10", "url": "/tablet"})
if PLAT_EMAIL:
    P2 = cliente(); req(P2, "POST", "/api/login", {"email": PLAT_EMAIL, "senha": PLAT_SENHA})
    _, sg = req(P2, "GET", "/api/plataforma/sugestoes")
    sug = next(x for x in sg["sugestoes"] if "impressora" in x["texto"])
    checar("plataforma recebe a sugestão com o restaurante", sug["estabelecimento"] == "Cantinho Deu Fome" and sug["lida"] == 0)
    checar("marca sugestão como lida", req(P2, "POST", f"/api/plataforma/sugestoes/{sug['id']}", {"lida": True})[0] == 200)
    _, er = req(P2, "GET", "/api/plataforma/erros")
    e1 = next(x for x in er["erros"] if "x is undefined" in x["mensagem"])
    checar("erro repetido é agrupado", e1["contagem"] == 2 and e1["origem"] == "navegador")
    checar("marca erro como resolvido", req(P2, "POST", f"/api/plataforma/erros/{e1['id']}", {"resolvido": True})[0] == 200)
    _, st = req(P2, "GET", "/api/plataforma/status")
    checar("status mostra o backup automático", st["backup"] is not None and st["backups"])
    s, r = req(P2, "POST", "/api/plataforma/backup/enviar")
    checar("envia backup por e-mail", s == 200 and r["email"] is True, r)
    if DADOS:
        bk = [e for e in emails() if "Backup" in e["assunto"]]
        checar("e-mail de backup tem o arquivo .zip", bk and bk[-1]["anexos"][0]["nome"].endswith(".sqlite.zip") and bk[-1]["anexos"][0]["bytes"] > 1000)
    checar("restaurante não acessa a área da plataforma", req(A, "GET", "/api/plataforma/erros")[0] == 403)

print(f"\n{ok} ok, {falhas} falha(s)")
sys.exit(1 if falhas else 0)
