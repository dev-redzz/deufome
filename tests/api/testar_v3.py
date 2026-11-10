"""Testes das funções da versão 3 (tamanhos, meio a meio, cupons, Pix, avaliação por prato, setores, mapa, equipe).

Uso: python tests/api/testar_v3.py http://localhost:8000   (servidor com DEMO=1 e banco novo)
"""
import sys
import uuid
import json
import urllib.request
import urllib.error
import http.cookiejar

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



A = cliente()
T = cliente()
C = cliente()
checar("login dono", req(A, "POST", "/api/login", {"email": "admin@cantinho.test", "senha": "123456"})[0] == 200)
_, cfg = req(A, "GET", "/api/config")
_, mesas = req(A, "GET", "/api/mesas")
mesa = next(m for m in mesas["mesas"] if not m["tablet"] and not m["ocupada"])["id"]
s, r = req(A, "POST", "/api/dispositivos", {"nome": "Tablet V3", "mesa_id": mesa})
_, at = req(T, "POST", "/api/tablet/ativar", {"codigo": r["ativacao"]["codigo"]})
tk = at["token"]

print("Cardápio")
_, card = req(T, "GET", "/api/tablet/cardapio", token=tk)
cats = {c["nome"]: c for c in card["categorias"]}
pizzas = cats["Pizzas"]["produtos"]
checar("pizzas têm tamanhos e meio a meio", len(pizzas[0]["tamanhos"]) == 3 and pizzas[0]["meio_a_meio"])
checar("bebidas no setor bar", cats["Bebidas"]["setor"] == "bar")
checar("combina com sugere outra categoria", str(cats["Hambúrgueres"]["produtos"][0]["id"]) in card["combina"])
burger = cats["Hambúrgueres"]["produtos"][0]
refri = cats["Bebidas"]["produtos"][0]

print("Pedido com tamanho e meio a meio")
p1, p2 = pizzas[0], pizzas[2]
checar("pizza sem tamanho é recusada", req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": p1["id"], "quantidade": 1}]}, token=tk)[0] == 422)
checar("segundo sabor de outra categoria é recusado", req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [{"produto_id": p1["id"], "quantidade": 1, "tamanho": "Grande", "sabor2_id": burger["id"]}]}, token=tk)[0] == 422)
s, r = req(T, "POST", "/api/tablet/pedidos", {"chave": str(uuid.uuid4()), "itens": [
    {"produto_id": p1["id"], "quantidade": 1, "tamanho": "Grande", "sabor2_id": p2["id"]},
    {"produto_id": refri["id"], "quantidade": 2}]}, token=tk)
g1 = next(t["preco"] for t in p1["tamanhos"] if t["nome"] == "Grande")
g2 = next(t["preco"] for t in p2["tamanhos"] if t["nome"] == "Grande")
checar("meio a meio cobra o sabor mais caro", s == 201 and r["total"] == max(g1, g2) + 2 * refri["preco"], r)
_, e = req(T, "GET", "/api/tablet/estado", token=tk)
nome = e["pedidos"][0]["itens"][0]["nome"]
checar("nome do item mostra os dois sabores e o tamanho", nome.startswith("½ ") and "(Grande)" in nome, nome)
checar("estado traz a conta", e["conta"]["subtotal"] == r["total"])

print("Cozinha: setores e esgotado")
_, coz = req(A, "GET", "/api/cozinha/pedidos")
ped = next(p for p in coz["pedidos"] if p["numero"] == r["numero"])
checar("itens chegam com setor", {i["setor"] for i in ped["itens"]} == {"cozinha", "bar"})
checar("cozinha marca esgotado", req(A, "POST", f"/api/cozinha/produtos/{burger['id']}/disponivel", {"disponivel": False})[1].get("disponivel") is False)
_, card2 = req(T, "GET", "/api/tablet/cardapio", token=tk)
checar("tablet vê o esgotado", not next(p for c in card2["categorias"] for p in c["produtos"] if p["id"] == burger["id"])["disponivel"])
checar("versão do cardápio muda", card2["versao"] != card["versao"])
req(A, "POST", f"/api/cozinha/produtos/{burger['id']}/disponivel", {"disponivel": True})

print("Cupons")
checar("cupom inexistente é recusado", req(T, "POST", "/api/tablet/cupom", {"codigo": "NAOEXISTE"}, token=tk)[0] == 422)
s, rc = req(T, "POST", "/api/tablet/cupom", {"codigo": "bemvindo10"}, token=tk)
checar("cupom de 10% aplicado", s == 200 and rc["conta"]["desconto"] == round(r["total"] * 0.10), rc)
s, nc = req(A, "POST", "/api/cupons", {"codigo": "ab", "tipo": "valor", "valor": 5})
checar("código curto é recusado", s == 422)
s, nc = req(A, "POST", "/api/cupons", {"codigo": "TESTE5", "tipo": "valor", "valor": 500, "limite": 1})
checar("cria cupom em reais", s == 201)
checar("cupom duplicado é recusado", req(A, "POST", "/api/cupons", {"codigo": "teste5", "tipo": "valor", "valor": 5})[0] == 409)

print("Pix na mesa com gorjeta")
checar("Pix desligado é recusado", req(T, "POST", "/api/tablet/pix", {"gorjeta_pct": 10}, token=tk)[0] == 409)
checar("ativar Pix sem chave é recusado", req(A, "POST", "/api/config", {"preferencias": {"pix_ativo": True}})[0] == 422)
checar("ativa Pix", req(A, "POST", "/api/config", {"preferencias": {"pix_ativo": True, "pix_chave": "contato@cantinho.test", "pix_nome": "Cantinho Deu Fome", "pix_cidade": "São Luís"}})[0] == 200)
s, px = req(T, "POST", "/api/tablet/pix", {"gorjeta_pct": 10}, token=tk)
c = px.get("conta", {})
checar("gorjeta de 10% sobre o valor com desconto", s == 200 and c["gorjeta"] == round((c["subtotal"] - c["desconto"]) * 0.10), px)
cc = px.get("copia_e_cola", "")
checar("Pix copia e cola válido", cc.startswith("000201") and "br.gov.bcb.pix" in cc and f"54{len(f'{c['total']/100:.2f}'):02d}{c['total']/100:.2f}" in cc and len(cc.split("6304")[-1]) == 4)
_, salao = req(A, "GET", "/api/salao/mesas")
m = next(x for x in salao["mesas"] if x["id"] == mesa)
checar("salão vê que a mesa vai pagar no Pix", m["sessao"]["status"] == "conta_solicitada" and m["sessao"]["pagar_com"] == "pix")
sid = m["sessao"]["id"]

print("Avaliação por prato")
s, _ = req(T, "POST", "/api/tablet/avaliar", {"nota": 5, "pratos": [{"nome": nome, "nota": 5}, {"nome": "Inventado", "nota": 1}, {"nome": refri["nome"], "nota": 3}]}, token=tk)
checar("avalia atendimento e pratos", s == 201)

print("Fechar conta com desconto e gorjeta")
_, ses = req(A, "GET", f"/api/salao/sessoes/{sid}")
tot = ses["conta"]["total"]
s, f = req(A, "POST", f"/api/salao/sessoes/{sid}/fechar", {"cobrar_taxa": True, "pagamentos": [{"forma": "pix", "valor": tot}]})
checar("fecha com o total certo", s == 200 and f["total"] == tot and tot == c["subtotal"] - c["desconto"] + c["gorjeta"] + ses["conta"]["taxa"], f)
_, cups = req(A, "GET", "/api/cupons")
checar("uso do cupom foi contado", next(x for x in cups["cupons"] if x["codigo"] == "BEMVINDO10")["usos"] == 1)
_, rel = req(A, "GET", "/api/relatorios?periodo=hoje")
checar("relatório mostra descontos e gorjetas", rel["resumo"]["descontos"] == c["desconto"] and rel["resumo"]["gorjetas"] == c["gorjeta"])
checar("relatório mostra notas dos pratos", any(p["nome"] == nome for p in rel["pratos"]["melhores"]) and not any(p["nome"] == "Inventado" for p in rel["pratos"]["melhores"]))
for per in ["mes_anterior", "ano", "mes", "7d"]:
    checar(f"período {per}", req(A, "GET", f"/api/relatorios?periodo={per}")[0] == 200)

print("Mapa do salão, equipe e conta")
checar("salva posições", req(A, "POST", "/api/mesas/mapa", {"posicoes": [{"id": mesa, "x": 500, "y": 9999}]})[0] == 200)
_, ms = req(A, "GET", "/api/mesas")
mm = next(x for x in ms["mesas"] if x["id"] == mesa)
checar("posição limitada ao mapa", mm["pos_x"] == 500 and mm["pos_y"] == 1000)
checar("muda formato e lugares", req(A, "POST", f"/api/mesas/{mesa}", {"formato": "redonda", "lugares": 6})[0] == 200)
_, eq = req(A, "GET", "/api/equipe")
checar("equipe mostra último acesso", any(p["ultimo_acesso"] for p in eq["equipe"]))
_, atv = req(A, "GET", "/api/equipe/atividade")
checar("atividade em linguagem simples", any(a["acao"] == "fechou a conta" for a in atv["atividade"]))
checar("muda o próprio nome", req(A, "POST", "/api/minha-conta", {"nome": "Ana Dona"})[0] == 200 and req(A, "GET", "/api/me")[1]["nome"] == "Ana Dona")
checar("login em outro aparelho", req(C, "POST", "/api/login", {"email": "admin@cantinho.test", "senha": "123456"})[0] == 200)
checar("sair de todos os aparelhos", req(A, "POST", "/api/sair-de-todos")[0] == 200)
checar("outro aparelho foi desconectado", req(C, "GET", "/api/me")[0] == 401)
checar("este aparelho continua conectado", req(A, "GET", "/api/me")[0] == 200)
checar("resumo semanal de teste", req(A, "POST", "/api/config/resumo-teste")[0] == 200)
s, ex = req(A, "GET", "/api/config/exportar")
checar("exporta os dados", s == 200 and ex["cardapio"] and ex["contas"])
checar("exclusão exige o nome certo", req(A, "POST", "/api/config/excluir", {"confirmacao": "x"})[0] == 422)

print(f"\n{ok} ok, {falhas} falha(s)")
sys.exit(1 if falhas else 0)
