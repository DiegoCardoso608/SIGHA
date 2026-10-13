#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SIGHA - Simulador de grade horária, com interface gráfica (Python + tkinter)

Janela de verdade (tkinter já vem com o Python): painel, turmas, professores,
disciplinas e conflitos. Programa em estilo imperativo: estado global mutável,
funções, laços, matrizes e arquivo JSON. O algoritmo é o mesmo do sigha_sim.c.

Regras:
 - Cada DISCIPLINA é um bloco contínuo no MESMO dia, dentro do turno da turma.
   Se sobrar espaço no turno, outra disciplina pode usar o mesmo dia.
 - Disponibilidade só por DIA (SEG-SEX). Não há salas.
 - Cada disciplina tem 2 ou mais professores habilitados: o primeiro é o titular;
   se estiver ocupado ou indisponível, o próximo assume.
 - A mesma disciplina pode ir para várias turmas; o professor nunca pode estar
   em dois lugares ao mesmo tempo (a oferta é remanejada para outro dia).
Algoritmo: 1) gulosa  2) reparo (move até 2 ofertas, com rollback)  3) verificação.

Rodar:  python3 sigha_gui.py          (python sigha_gui.py no Windows)
"""
import functools
import json
import os
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# ============================================================================
# 1. DADOS PRÉ-CADASTRADOS
# ============================================================================
SEG, TER, QUA, QUI, SEX = 1, 2, 4, 8, 16
TODOS = 31
DIAS = ["SEG", "TER", "QUA", "QUI", "SEX"]
TURNOS = ["Manhã", "Tarde", "Noite"]
SLOTS = ["08:00-08:50", "08:50-09:40", "10:00-10:50", "10:50-11:40",
         "13:30-14:20", "14:20-15:10", "15:30-16:20", "16:20-17:10",
         "18:30-19:20", "19:20-20:10", "20:30-21:20", "21:20-22:10"]
M_PROF_OCUPADO, M_TURMA_OCUPADA, M_SEM_DIA, M_CARGA = 1, 2, 3, 4
MOTIVOS = ["",
           "todos os professores habilitados já estão ocupados nesse horário",
           "turma já ocupada nesse horário (o turno só tem 4 aulas por dia)",
           "nenhum professor habilitado tem dia em comum com a disciplina",
           "carga maior que o turno (máx. 4 aulas em sequência)"]
SUGESTOES = ["",
             "Habilitar mais um professor para a disciplina (aba Disciplinas) ou ampliar os dias dos professores.",
             "Tirar disciplinas da turma ou usar outro turno.",
             "Habilitar outro professor ou ampliar os dias da disciplina.",
             "Dividir a disciplina: a carga não cabe em um único turno."]

# (nome, dias disponíveis)  -- índice = id do professor
PROFS = [
    ("Rodrigo Silva", TODOS),
    ("Marcia Pantoja", SEG|QUA|SEX),
    ("Diego Abreu", QUA|QUI),
    ("Ana Lima", SEG|TER|QUA),
    ("Lucas Moreira", TER|QUI|SEX),
    ("Paulo Henrique", SEG|TER|QUA|QUI),
    ("Carla Nunes", TER|QUI|SEX),
    ("Fernanda Costa", TODOS),
    ("Julia Ramos", TER|QUA|QUI),
]
# (sigla, nome, aulas/semana, dias permitidos, professores habilitados com o titular primeiro)
DISCS = [
    ("MAT", "Matemática Aplicada", 4, TODOS, [5, 3, 0]),
    ("LOG", "Lógica de Programação", 4, TODOS, [6, 4, 3]),
    ("SCO", "Sistemas Computacionais", 2, TODOS, [6, 1, 7]),
    ("GTA", "Gestão de Times - Ágeis", 2, QUI|SEX, [5, 0, 8]),
    ("DCH", "Design Centrado no Ser Humano", 2, TODOS, [5, 8, 7]),
    ("ARQ", "Arquitetura de Software", 2, TODOS, [2, 1, 0]),
    ("RED", "Redes de Computadores", 4, TODOS, [6, 1, 4]),
    ("SOP", "Sistemas Operacionais", 4, TODOS, [1, 2, 6]),
    ("DBA", "Database Application", 4, TODOS, [4, 3, 8]),
    ("MOB", "Programação - Mobile Coding", 4, TODOS, [4, 7, 8]),
    ("COM", "Compiladores", 4, TODOS, [2, 1, 0]),
    ("TST", "Teste de Software", 4, TODOS, [1, 3, 4]),
    ("SEG", "Segurança da Informação", 2, TODOS, [1, 6, 2]),
    ("TOP", "Tópicos Integradores", 4, TODOS, [2, 0, 5]),
    ("MET", "Metodologia da Pesquisa", 2, SEG|TER, [5, 0, 8]),
    ("MLE", "Machine Learning", 2, TODOS, [7, 0, 3]),
    ("GEN", "Game Engine", 4, TODOS, [7, 4, 8]),
    ("DGA", "Desenvolvimento de Games", 4, TODOS, [7, 4, 3]),
    ("EMP", "Empreendedorismo", 4, TODOS, [0, 5, 7]),
    ("ERQ", "Engenharia de Requisitos", 2, TODOS, [0, 3, 5]),
    ("POO", "Programação Orientada a Objeto", 4, TODOS, [3, 4, 0]),
    ("ESW", "Engenharia de Software", 4, TODOS, [0, 3, 5]),
    ("BDD", "Banco de Dados", 4, TODOS, [4, 3, 8]),
    ("EDA", "Estrutura de Dados", 4, TODOS, [3, 4, 6]),
    ("UXD", "UX/UI Design", 2, TER|QUA|QUI, [8, 7, 3]),
]
HAB_PADRAO = [list(d[4]) for d in DISCS]

# estado do usuário (o que é salvo no arquivo)
ESTADO = {"turmas": [], "rel": False, "hab": [list(h) for h in HAB_PADRAO]}
ARQUIVO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sigha_dados.json")


def sigla(d):
    return DISCS[d][0]


def nome_disc(d):
    return DISCS[d][1]


def aulas_disc(d):
    return DISCS[d][2]


def dias_txt(mascara):
    return ", ".join(DIAS[i] for i in range(5) if mascara >> i & 1)


def primeiro_nome(p):
    return PROFS[p][0].split()[0]


# ============================================================================
# 2. SIMULAÇÃO (gulosa + reparo + verificação)
# ============================================================================
def simular(estado):
    turmas, rel, hab = estado["turmas"], estado["rel"], estado["hab"]

    ofs = []                                   # cada oferta = (turma, disciplina)
    for ti, t in enumerate(turmas):
        for d in t["discs"]:
            ofs.append({"t": ti, "d": d, "p": -1, "n": aulas_disc(d), "dia": -1, "slot": -1, "motivo": 0})

    prof_oc = [[[-1] * 12 for _ in range(5)] for _ in PROFS]
    turma_oc = [[[-1] * 12 for _ in range(5)] for _ in turmas]
    reparos = 0

    def dia_ok(d, p, dia):
        return rel or ((DISCS[d][3] & PROFS[p][1]) >> dia & 1) == 1

    def livre(o, p, dia, k):                   # 0 livre, 1 professor ocupado, 2 turma ocupada
        x = ofs[o]
        for i in range(x["n"]):
            if prof_oc[p][dia][k + i] >= 0:
                return 1
            if turma_oc[x["t"]][dia][k + i] >= 0:
                return 2
        return 0

    def colocar(o, p, dia, k):
        x = ofs[o]
        x["p"], x["dia"], x["slot"] = p, dia, k
        for i in range(x["n"]):
            prof_oc[p][dia][k + i] = o
            turma_oc[x["t"]][dia][k + i] = o

    def remover(o):
        x = ofs[o]
        for i in range(x["n"]):
            prof_oc[x["p"]][x["dia"]][x["slot"] + i] = -1
            turma_oc[x["t"]][x["dia"]][x["slot"] + i] = -1
        x["p"], x["dia"], x["slot"] = -1, -1, -1

    def candidatos(o):                         # (professor, dia, início, ordem do professor)
        x = ofs[o]
        lo = turmas[x["t"]]["turno"] * 4
        c = []
        if x["n"] > 4:
            return c
        for pi, p in enumerate(hab[x["d"]]):
            for dia in range(5):
                if not dia_ok(x["d"], p, dia):
                    continue
                for k in range(lo, lo + 4 - x["n"] + 1):
                    c.append((p, dia, k, pi))
        return c

    def carga(t, dia):
        return sum(1 for v in turma_oc[t][dia] if v >= 0)

    def tentar(o):                             # titular antes dos substitutos; depois espalha pelos dias
        melhor, melhor_pts = None, 0
        for p, dia, k, pi in candidatos(o):
            if livre(o, p, dia, k):
                continue
            pts = pi * 1000 + carga(ofs[o]["t"], dia) * 100 + dia * 10 + k % 4
            if melhor is None or pts < melhor_pts:
                melhor, melhor_pts = (p, dia, k), pts
        if melhor is None:
            return False
        colocar(o, *melhor)
        return True

    def reparar(o):                            # move até 2 ofertas; desfaz tudo (rollback) se não der
        nonlocal reparos
        x = ofs[o]
        for p, dia, k, _ in candidatos(o):
            bl = []
            for j in range(x["n"]):
                for v in (prof_oc[p][dia][k + j], turma_oc[x["t"]][dia][k + j]):
                    if v >= 0 and v not in bl:
                        bl.append(v)
            if len(bl) == 0 or len(bl) > 2:
                continue
            antigos = [(ofs[b]["p"], ofs[b]["dia"], ofs[b]["slot"]) for b in bl]
            for b in bl:
                remover(b)
            colocar(o, p, dia, k)
            deu = True
            for b in bl:
                if not tentar(b):
                    deu = False
                    break
            if deu:
                reparos += len(bl)
                return True
            for b in bl:                       # rollback
                if ofs[b]["dia"] >= 0:
                    remover(b)
            remover(o)
            for b, ant in zip(bl, antigos):
                colocar(b, *ant)
        return False

    # fase 1: mais restritas primeiro (menos posições viáveis por aula)
    viaveis = [len(candidatos(o)) for o in range(len(ofs))]
    ordem = sorted(range(len(ofs)), key=functools.cmp_to_key(
        lambda a, b: viaveis[a] * ofs[b]["n"] - viaveis[b] * ofs[a]["n"]))
    for o in ordem:
        tentar(o)

    # fase 2: reparo (até 4 passadas)
    progresso, passada = True, 0
    while progresso and passada < 4:
        progresso = False
        passada += 1
        for o in range(len(ofs)):
            if ofs[o]["dia"] < 0 and (tentar(o) or reparar(o)):
                progresso = True

    # motivo de cada conflito
    for o, x in enumerate(ofs):
        if x["dia"] >= 0:
            continue
        if x["n"] > 4:
            x["motivo"] = M_CARGA
            continue
        cands = candidatos(o)
        if not cands:
            x["motivo"] = M_SEM_DIA
            continue
        c1 = sum(1 for p, dia, k, _ in cands if livre(o, p, dia, k) == 1)
        x["motivo"] = M_PROF_OCUPADO if c1 >= len(cands) - c1 else M_TURMA_OCUPADA

    # fase 3: verificação independente
    viol = 0
    vistos = set()
    for x in ofs:
        if x["dia"] < 0:
            continue
        turno = turmas[x["t"]]["turno"]
        fim = x["slot"] + x["n"] - 1
        if x["slot"] // 4 != turno or fim // 4 != turno:
            viol += 1
        if x["p"] not in hab[x["d"]] or not dia_ok(x["d"], x["p"], x["dia"]):
            viol += 1
        for i in range(x["n"]):
            for chave in (("p", x["p"], x["dia"], x["slot"] + i), ("t", x["t"], x["dia"], x["slot"] + i)):
                if chave in vistos:
                    viol += 1
                vistos.add(chave)

    return {"ofs": ofs, "reparos": reparos, "viol": viol,
            "tot": sum(x["n"] for x in ofs),
            "pl": sum(x["n"] for x in ofs if x["dia"] >= 0)}


# ============================================================================
# 3. ARQUIVO (JSON, mesmo formato do simulador em C)
# ============================================================================
def dados_para_json():
    return {"versao": 3, "rel": ESTADO["rel"],
            "hab": {str(d): h for d, h in enumerate(ESTADO["hab"])},
            "turmas": ESTADO["turmas"]}


def carregar_json(caminho):
    """Lê e valida; só altera o estado se o arquivo inteiro for válido. Devolve True/False."""
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            x = json.load(f)
        turmas = []
        for t in x["turmas"]:
            discs = []
            for d in t.get("discs", []):
                if isinstance(d, int) and 0 <= d < len(DISCS) and d not in discs:
                    discs.append(d)
            cod = str(t.get("cod", "")).strip()
            if cod and t.get("turno") in (0, 1, 2) and len(turmas) < 12:
                turmas.append({"cod": cod, "nome": str(t.get("nome", "")), "turno": t["turno"], "discs": discs})
        hab = [list(h) for h in HAB_PADRAO]
        for chave, lista in (x.get("hab") or {}).items():
            d = int(chave)
            nova = []
            for p in lista:
                if isinstance(p, int) and 0 <= p < len(PROFS) and p not in nova:
                    nova.append(p)
            if 0 <= d < len(DISCS) and len(nova) >= 2:
                hab[d] = nova
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return False
    ESTADO["turmas"], ESTADO["rel"], ESTADO["hab"] = turmas, bool(x.get("rel")), hab
    return True


def salvar_json(caminho):
    try:
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(dados_para_json(), f, ensure_ascii=False, indent=2)
        return True
    except OSError:
        return False


def exemplo():
    listas = [("CC-2026.1-1A", 2, [0, 1, 2, 3, 4]), ("CC-2026.1-3A", 2, [5, 6, 7, 8, 9]),
              ("CC-2026.1-5A", 0, [15, 16, 17, 18, 19]), ("CC-2026.1-7A", 2, [10, 11, 12, 13, 14]),
              ("CC-2026.1-2B", 1, [20, 21, 22, 23, 24])]
    ESTADO["turmas"] = [{"cod": c, "nome": "", "turno": t, "discs": list(d)} for c, t, d in listas]
    ESTADO["rel"] = False
    ESTADO["hab"] = [list(h) for h in HAB_PADRAO]


def csv_grade(r):
    linhas = ["turma,disciplina,professor,dia,inicio,fim,aulas"]
    for x in r["ofs"]:
        if x["dia"] < 0:
            continue
        linhas.append('%s,"%s","%s",%s,%s,%s,%d' % (
            ESTADO["turmas"][x["t"]]["cod"], nome_disc(x["d"]), PROFS[x["p"]][0], DIAS[x["dia"]],
            SLOTS[x["slot"]][:5], SLOTS[x["slot"] + x["n"] - 1][6:], x["n"]))
    return "\n".join(linhas) + "\n"


# ============================================================================
# 4. INTERFACE (tkinter)
# ============================================================================
BG, CARD, BD, TX, MU = "#f9fafb", "#ffffff", "#e5e7eb", "#111827", "#6b7280"
PR, PB, OK, ERRO, AV = "#2563eb", "#eff6ff", "#16a34a", "#dc2626", "#d97706"
PALETA = ["#bfdbfe", "#fed7aa", "#bbf7d0", "#e9d5ff", "#fef08a", "#a5f3fc",
          "#fecaca", "#d9f99d", "#ddd6fe", "#fde68a", "#99f6e4", "#fbcfe8"]
FONTE = "Helvetica"

W = {}                       # widgets principais
view, sel, edit, R = "dash", 0, None, None
NAV = [("dash", "Dashboard"), ("turmas", "Turmas"), ("profs", "Professores"),
       ("disc", "Disciplinas"), ("conf", "Conflitos")]


def msg(texto):
    W["status"].config(text=texto)
    W["root"].after(4000, lambda: W["status"].config(text="") if W["status"].cget("text") == texto else None)


def salvar_auto():
    if not salvar_json(ARQUIVO):
        msg("Não foi possível gravar " + ARQUIVO)


def limpar(frame):
    for w in frame.winfo_children():
        w.destroy()


def cartao_frame(pai, **kw):
    return tk.Frame(pai, bg=CARD, highlightbackground=BD, highlightthickness=1, **kw)


def titulo(pai, texto, sub=""):
    tk.Label(pai, text=texto, font=(FONTE, 18, "bold"), bg=BG, fg=TX).pack(anchor="w")
    tk.Label(pai, text=sub, font=(FONTE, 10), bg=BG, fg=MU, wraplength=860, justify="left").pack(anchor="w", pady=(0, 14))


def botao(pai, texto, comando, primario=False, perigo=False):
    cor_fundo = PR if primario else CARD
    cor_texto = "white" if primario else (ERRO if perigo else TX)
    return tk.Button(pai, text=texto, command=comando, bg=cor_fundo, fg=cor_texto, activebackground=PB,
                     relief="solid", bd=1, highlightthickness=0, padx=10, pady=3, font=(FONTE, 10), cursor="hand2")


def cartao_num(pai, valor, legenda, cor=TX):
    f = cartao_frame(pai, padx=14, pady=10)
    tk.Label(f, text=valor, font=(FONTE, 22, "bold"), fg=cor, bg=CARD).pack(anchor="w")
    tk.Label(f, text=legenda, font=(FONTE, 9), fg=MU, bg=CARD).pack(anchor="w")
    return f


def vazio(pai, texto):
    f = tk.Frame(pai, bg=CARD, highlightbackground=BD, highlightthickness=1, padx=20, pady=28)
    tk.Label(f, text=texto, bg=CARD, fg=MU, font=(FONTE, 11), wraplength=700).pack()
    f.pack(fill="x", pady=6)


def desenhar_grade(pai, tipo, ident, slots):
    """Grade semanal: tipo 'turma' ou 'prof'; cada disciplina é um bloco colorido."""
    LH, LC, AL, TOPO = 104, 148, 46, 28
    cv = tk.Canvas(pai, width=LH + 5 * LC + 1, height=TOPO + len(slots) * AL + 1, bg=CARD,
                   highlightthickness=1, highlightbackground=BD)
    cv.create_rectangle(0, 0, LH + 5 * LC, TOPO, fill=BG, outline=BD)
    for d in range(5):
        cv.create_text(LH + d * LC + LC // 2, TOPO // 2, text=DIAS[d], font=(FONTE, 9, "bold"), fill=MU)
    for i, k in enumerate(slots):
        y = TOPO + i * AL
        cv.create_line(0, y, LH + 5 * LC, y, fill=BD)
        cv.create_text(8, y + 8, anchor="nw", text=SLOTS[k], font=(FONTE, 9), fill=MU)
    for d in range(6):
        cv.create_line(LH + d * LC, 0, LH + d * LC, TOPO + len(slots) * AL, fill=BD)
    for x in R["ofs"]:
        if x["dia"] < 0 or x["slot"] not in slots:
            continue
        if (tipo == "turma" and x["t"] != ident) or (tipo == "prof" and x["p"] != ident):
            continue
        r0 = slots.index(x["slot"])
        x0, y0 = LH + x["dia"] * LC, TOPO + r0 * AL
        cv.create_rectangle(x0 + 3, y0 + 3, x0 + LC - 3, y0 + x["n"] * AL - 3, fill=PALETA[x["d"] % 12], outline="")
        cv.create_text(x0 + 9, y0 + 8, anchor="nw", text=nome_disc(x["d"]), width=LC - 18,
                       font=(FONTE, 9, "bold"), fill="#111111")
        if tipo == "turma":
            sub = PROFS[x["p"]][0] + ("  · substituto" if x["p"] != ESTADO["hab"][x["d"]][0] else "")
        else:
            sub = ESTADO["turmas"][x["t"]]["cod"]
        cv.create_text(x0 + 9, y0 + x["n"] * AL - 8, anchor="sw", text=sub, width=LC - 18,
                       font=(FONTE, 8), fill="#333333")
    cv.pack(anchor="w", pady=(4, 12))


# ---------------------------------------------------------------- páginas ---
def pg_dash(p):
    titulo(p, "Dashboard", "%d turmas · %d disciplinas ofertadas" % (len(ESTADO["turmas"]), len(R["ofs"])))
    if not R["ofs"]:
        vazio(p, "Nenhuma aula para distribuir. Cadastre uma turma e escolha as disciplinas (aba Turmas), "
                 "ou clique em \"Exemplo\" no topo.")
        return
    conf = [x for x in R["ofs"] if x["dia"] < 0]
    subs = sum(1 for x in R["ofs"] if x["dia"] >= 0 and x["p"] != ESTADO["hab"][x["d"]][0])
    pct = round(R["pl"] * 100 / R["tot"])
    linha = tk.Frame(p, bg=BG)
    linha.pack(fill="x")
    dados = [("%d%%" % pct, "%d de %d aulas alocadas" % (R["pl"], R["tot"]), TX),
             (str(len(conf)), "conflitos não resolvidos", AV if conf else OK),
             (str(R["reparos"]), "reparos (disciplinas movidas)", TX),
             (str(R["viol"]), "violações na verificação", ERRO if R["viol"] else OK),
             ("%d/%d" % (len(R["ofs"]) - len(conf), len(R["ofs"])), "disciplinas alocadas", TX),
             (str(subs), "com professor substituto", TX)]
    for i, (v, l, c) in enumerate(dados):
        cartao_num(linha, v, l, c).grid(row=i // 3, column=i % 3, padx=(0, 12), pady=(0, 12), sticky="nsew")
        linha.columnconfigure(i % 3, weight=1)
    tk.Label(p, text="Uso dos professores (dias usados / dias disponíveis)", font=(FONTE, 12, "bold"),
             bg=BG, fg=TX).pack(anchor="w", pady=(8, 6))
    for i, (nome, dmask) in enumerate(PROFS):
        usados = {x["dia"] for x in R["ofs"] if x["dia"] >= 0 and x["p"] == i}
        if not usados:
            continue
        disp = 5 if ESTADO["rel"] else bin(dmask).count("1")
        lin = tk.Frame(p, bg=BG)
        lin.pack(fill="x", pady=2)
        tk.Label(lin, text=nome, width=18, anchor="w", bg=BG, fg=TX, font=(FONTE, 10)).pack(side="left")
        ttk.Progressbar(lin, style="Azul.Horizontal.TProgressbar", maximum=disp, value=len(usados),
                        length=420).pack(side="left", padx=8)
        tk.Label(lin, text="%d/%d dias" % (len(usados), disp), bg=BG, fg=MU, font=(FONTE, 9)).pack(side="left")


def rotulo_disc(d):
    hab = ESTADO["hab"][d]
    return "%-4s %s · %d aulas · %s" % (sigla(d), nome_disc(d), aulas_disc(d), ", ".join(primeiro_nome(h) for h in hab))


def pg_turmas(p):
    global edit, sel
    titulo(p, "Turmas", "Crie turmas e marque as disciplinas. Cada disciplina tem 2 ou mais professores habilitados "
                        "(aba Disciplinas): se o titular estiver ocupado, outro assume.")
    e = ESTADO["turmas"][edit] if edit is not None else None

    form = cartao_frame(p, padx=14, pady=12)
    form.pack(fill="x", pady=(0, 14))
    v_cod = tk.StringVar(value=e["cod"] if e else "")
    v_nome = tk.StringVar(value=e["nome"] if e else "")
    v_turno = tk.StringVar(value=TURNOS[e["turno"] if e else 2])
    for col, (rot, var) in enumerate((("CÓDIGO (ex: CC-2026.1-7A)", v_cod), ("NOME (opcional)", v_nome))):
        tk.Label(form, text=rot, bg=CARD, fg=MU, font=(FONTE, 8)).grid(row=0, column=col, sticky="w", padx=(0, 12))
        tk.Entry(form, textvariable=var, width=30, relief="solid", bd=1).grid(row=1, column=col, sticky="we", padx=(0, 12))
    tk.Label(form, text="TURNO", bg=CARD, fg=MU, font=(FONTE, 8)).grid(row=0, column=2, sticky="w")
    ttk.Combobox(form, textvariable=v_turno, values=TURNOS, state="readonly", width=12).grid(row=1, column=2, sticky="w")
    tk.Label(form, text="DISCIPLINAS (clique para marcar/desmarcar)", bg=CARD, fg=MU, font=(FONTE, 8)
             ).grid(row=2, column=0, columnspan=3, sticky="w", pady=(10, 2))
    moldura = tk.Frame(form, bg=CARD)
    moldura.grid(row=3, column=0, columnspan=3, sticky="we")
    lista = tk.Listbox(moldura, selectmode="multiple", height=9, exportselection=False, activestyle="none",
                       font=("Courier", 10), selectbackground=PR, selectforeground="white", relief="solid", bd=1)
    barra = ttk.Scrollbar(moldura, orient="vertical", command=lista.yview)
    lista.configure(yscrollcommand=barra.set)
    for d in range(len(DISCS)):
        lista.insert("end", rotulo_disc(d))
        if e and d in e["discs"]:
            lista.selection_set(d)
    lista.pack(side="left", fill="x", expand=True)
    barra.pack(side="left", fill="y")
    form.columnconfigure(0, weight=1)
    form.columnconfigure(1, weight=1)

    def gravar():
        global edit
        cod = v_cod.get().strip()
        if not cod:
            messagebox.showwarning("SIGHA", "Informe o código da turma.")
            return
        for i, t in enumerate(ESTADO["turmas"]):
            if t["cod"] == cod and i != edit:
                messagebox.showwarning("SIGHA", "Já existe uma turma com esse código.")
                return
        if edit is None and len(ESTADO["turmas"]) >= 12:
            messagebox.showwarning("SIGHA", "Limite de 12 turmas atingido.")
            return
        t = {"cod": cod, "nome": v_nome.get().strip(), "turno": TURNOS.index(v_turno.get()),
             "discs": list(lista.curselection())}
        if edit is None:
            ESTADO["turmas"].append(t)
        else:
            ESTADO["turmas"][edit] = t
        edit = None
        salvar_auto()
        renderizar()
        msg("Turma %s salva (%d disciplinas)." % (cod, len(t["discs"])))

    def cancelar():
        global edit
        edit = None
        renderizar()

    bt = tk.Frame(form, bg=CARD)
    bt.grid(row=4, column=0, columnspan=3, sticky="w", pady=(10, 0))
    botao(bt, "Salvar alterações" if e else "Criar turma", gravar, primario=True).pack(side="left")
    if e:
        botao(bt, "Cancelar", cancelar).pack(side="left", padx=8)

    if not ESTADO["turmas"]:
        vazio(p, "Nenhuma turma cadastrada.")
        return

    quadro = tk.Frame(p, bg=BG)
    quadro.pack(fill="x")
    tv = ttk.Treeview(quadro, columns=("cod", "turno", "disc", "aulas"), show="headings", height=min(6, len(ESTADO["turmas"])))
    for c, t, w in (("cod", "Código", 260), ("turno", "Turno", 100), ("disc", "Disciplinas", 100), ("aulas", "Aulas/sem", 100)):
        tv.heading(c, text=t)
        tv.column(c, width=w, anchor="w")
    for i, t in enumerate(ESTADO["turmas"]):
        tv.insert("", "end", iid=str(i), values=(t["cod"] + ("  —  " + t["nome"] if t["nome"] else ""), TURNOS[t["turno"]],
                                                  len(t["discs"]), sum(aulas_disc(d) for d in t["discs"])))
    tv.pack(side="left", fill="x", expand=True)

    def escolhida():
        s = tv.selection()
        return int(s[0]) if s else None

    def editar():
        global edit
        i = escolhida()
        if i is None:
            msg("Selecione uma turma na tabela.")
            return
        edit = i
        renderizar()

    def excluir():
        i = escolhida()
        if i is None:
            msg("Selecione uma turma na tabela.")
            return
        if messagebox.askyesno("SIGHA", "Excluir a turma %s?" % ESTADO["turmas"][i]["cod"]):
            del ESTADO["turmas"][i]
            salvar_auto()
            renderizar()

    lado = tk.Frame(quadro, bg=BG)
    lado.pack(side="left", padx=10, anchor="n")
    botao(lado, "Editar", editar).pack(fill="x", pady=(0, 6))
    botao(lado, "Excluir", excluir, perigo=True).pack(fill="x")

    if sel >= len(ESTADO["turmas"]):
        sel = 0
    tk.Label(p, text="Grade da turma", font=(FONTE, 12, "bold"), bg=BG, fg=TX).pack(anchor="w", pady=(16, 4))
    codigos = [t["cod"] for t in ESTADO["turmas"]]
    cb = ttk.Combobox(p, values=codigos, state="readonly", width=28)
    cb.current(sel)
    cb.pack(anchor="w")

    def trocar(_ev):
        global sel
        sel = cb.current()
        renderizar()

    cb.bind("<<ComboboxSelected>>", trocar)
    t = ESTADO["turmas"][sel]
    tk.Label(p, text="Turno %s" % TURNOS[t["turno"]].lower(), bg=BG, fg=MU, font=(FONTE, 9)).pack(anchor="w", pady=(4, 0))
    desenhar_grade(p, "turma", sel, [k + t["turno"] * 4 for k in range(4)])


def pg_profs(p):
    global sel
    titulo(p, "Professores", "Pré-cadastrados (somente leitura). Podem lecionar em qualquer lugar; a disponibilidade varia só por dia.")
    if sel >= len(PROFS):
        sel = 0
    cb = ttk.Combobox(p, values=[q[0] for q in PROFS], state="readonly", width=30)
    cb.current(sel)
    cb.pack(anchor="w")

    def trocar(_ev):
        global sel
        sel = cb.current()
        renderizar()

    cb.bind("<<ComboboxSelected>>", trocar)
    chips = tk.Frame(p, bg=BG)
    chips.pack(anchor="w", pady=10)
    tk.Label(chips, text="Disponibilidade:", bg=BG, fg=TX, font=(FONTE, 10, "bold")).pack(side="left", padx=(0, 8))
    for i, d in enumerate(DIAS):
        ativo = PROFS[sel][1] >> i & 1
        tk.Label(chips, text=d, bg=PB if ativo else BD, fg=PR if ativo else MU, padx=8, pady=2,
                 font=(FONTE, 9, "bold")).pack(side="left", padx=2)
    tit = [sigla(d) for d in range(len(DISCS)) if ESTADO["hab"][d][0] == sel]
    sub = [sigla(d) for d in range(len(DISCS)) if sel in ESTADO["hab"][d][1:]]
    tk.Label(p, text="Titular de: %s    ·    Substituto de: %s" % (", ".join(tit) or "-", ", ".join(sub) or "-"),
             bg=BG, fg=MU, font=(FONTE, 9), wraplength=860, justify="left").pack(anchor="w", pady=(0, 6))
    desenhar_grade(p, "prof", sel, list(range(12)))


def disp_disc(d):
    m = 0
    for h in ESTADO["hab"][d]:
        m |= PROFS[h][1]
    m &= DISCS[d][3]
    return dias_txt(m) if m else "sem dia em comum"


def dialogo_habilitados(d):
    janela = tk.Toplevel(W["root"])
    janela.title("Professores habilitados")
    janela.configure(bg=BG, padx=14, pady=12)
    janela.transient(W["root"])
    habil = list(ESTADO["hab"][d])
    tk.Label(janela, text=nome_disc(d), font=(FONTE, 13, "bold"), bg=BG, fg=TX).grid(row=0, column=0, columnspan=3, sticky="w")
    tk.Label(janela, text="O primeiro da lista é o titular. Mínimo de 2 professores.", bg=BG, fg=MU,
             font=(FONTE, 9)).grid(row=1, column=0, columnspan=3, sticky="w", pady=(0, 8))
    tk.Label(janela, text="Habilitados (titular primeiro)", bg=BG, fg=MU, font=(FONTE, 9)).grid(row=2, column=0, sticky="w")
    tk.Label(janela, text="Demais professores", bg=BG, fg=MU, font=(FONTE, 9)).grid(row=2, column=2, sticky="w")
    lh = tk.Listbox(janela, height=10, width=26, exportselection=False, relief="solid", bd=1)
    lo = tk.Listbox(janela, height=10, width=26, exportselection=False, relief="solid", bd=1)
    lh.grid(row=3, column=0, rowspan=4)
    lo.grid(row=3, column=2, rowspan=4)

    def preencher():
        lh.delete(0, "end")
        lo.delete(0, "end")
        for h in habil:
            lh.insert("end", ("★ " if h == habil[0] else "   ") + PROFS[h][0])
        for p in range(len(PROFS)):
            if p not in habil:
                lo.insert("end", PROFS[p][0])

    def outros():
        return [p for p in range(len(PROFS)) if p not in habil]

    def adicionar():
        s = lo.curselection()
        if s:
            habil.append(outros()[s[0]])
            preencher()

    def remover():
        s = lh.curselection()
        if s and len(habil) > 2:
            del habil[s[0]]
            preencher()
        elif s:
            messagebox.showwarning("SIGHA", "Cada disciplina precisa de pelo menos 2 professores.", parent=janela)

    def mover(delta):
        s = lh.curselection()
        if not s:
            return
        i, j = s[0], s[0] + delta
        if 0 <= j < len(habil):
            habil[i], habil[j] = habil[j], habil[i]
            preencher()
            lh.selection_set(j)

    meio = tk.Frame(janela, bg=BG)
    meio.grid(row=3, column=1, rowspan=4, padx=10)
    for texto, cmd in (("Adicionar  →", adicionar), ("←  Remover", remover), ("▲  Subir", lambda: mover(-1)), ("▼  Descer", lambda: mover(1))):
        botao(meio, texto, cmd).pack(fill="x", pady=3)

    def salvar():
        ESTADO["hab"][d] = list(habil)
        salvar_auto()
        janela.destroy()
        renderizar()

    rodape = tk.Frame(janela, bg=BG)
    rodape.grid(row=7, column=0, columnspan=3, sticky="e", pady=(12, 0))
    botao(rodape, "Cancelar", janela.destroy).pack(side="left", padx=6)
    botao(rodape, "Salvar", salvar, primario=True).pack(side="left")
    preencher()
    janela.grab_set()


def pg_disc(p):
    titulo(p, "Disciplinas", "Pré-cadastradas. Cada disciplina tem 2 ou mais professores habilitados: o primeiro é o titular e, "
                             "se ele estiver ocupado ou indisponível, outro assume.")
    quadro = tk.Frame(p, bg=BG)
    quadro.pack(fill="x")
    tv = ttk.Treeview(quadro, columns=("sig", "nome", "prof", "aulas", "disp"), show="headings", height=14)
    for c, t, w in (("sig", "Sigla", 55), ("nome", "Disciplina", 230), ("prof", "Professores habilitados (titular primeiro)", 260),
                    ("aulas", "Aulas", 50), ("disp", "Disponibilidade", 200)):
        tv.heading(c, text=t)
        tv.column(c, width=w, anchor="w")
    for d in range(len(DISCS)):
        tv.insert("", "end", iid=str(d), values=(sigla(d), nome_disc(d), ", ".join(primeiro_nome(h) for h in ESTADO["hab"][d]),
                                                 aulas_disc(d), disp_disc(d)))
    tv.pack(side="left", fill="x", expand=True)
    lado = tk.Frame(quadro, bg=BG)
    lado.pack(side="left", padx=10, anchor="n")

    def editar():
        s = tv.selection()
        if not s:
            msg("Selecione uma disciplina na tabela.")
            return
        dialogo_habilitados(int(s[0]))

    def restaurar():
        if messagebox.askyesno("SIGHA", "Restaurar os professores habilitados originais de todas as disciplinas?"):
            ESTADO["hab"] = [list(h) for h in HAB_PADRAO]
            salvar_auto()
            renderizar()

    botao(lado, "Editar professores", editar, primario=True).pack(fill="x", pady=(0, 6))
    botao(lado, "Restaurar padrão", restaurar).pack(fill="x")
    tv.bind("<Double-1>", lambda _e: editar())


def pg_conf(p):
    conf = [x for x in R["ofs"] if x["dia"] < 0]
    titulo(p, "Conflitos não resolvidos",
           "Nada para analisar ainda." if not R["ofs"] else
           ("%d disciplina(s) sem horário" % len(conf) if conf else "Nenhum conflito: todas as disciplinas foram alocadas."))
    for x in conf:
        f = tk.Frame(p, bg=CARD, highlightbackground="#fca5a5", highlightthickness=1)
        tk.Frame(f, bg=ERRO, width=5).pack(side="left", fill="y")
        corpo = tk.Frame(f, bg=CARD, padx=12, pady=8)
        corpo.pack(side="left", fill="x", expand=True)
        tk.Label(corpo, text="%s (%s) — %d aulas sem horário" % (nome_disc(x["d"]), ESTADO["turmas"][x["t"]]["cod"], x["n"]),
                 font=(FONTE, 10, "bold"), bg=CARD, fg=TX).pack(anchor="w")
        tk.Label(corpo, text="Causa: " + MOTIVOS[x["motivo"]], bg=CARD, fg=MU, font=(FONTE, 9), wraplength=780, justify="left").pack(anchor="w")
        tk.Label(corpo, text="Sugestão: " + SUGESTOES[x["motivo"]], bg=CARD, fg=MU, font=(FONTE, 9), wraplength=780, justify="left").pack(anchor="w")
        f.pack(fill="x", pady=5)
    if R["ofs"]:
        botao(p, "Exportar grade (CSV)", exportar_csv, primario=True).pack(anchor="w", pady=10)


# ----------------------------------------------------------- navegação/ações ---
PAGINAS = {"dash": pg_dash, "turmas": pg_turmas, "profs": pg_profs, "disc": pg_disc, "conf": pg_conf}


def renderizar():
    global R
    R = simular(ESTADO)
    W["rel"].set(ESTADO["rel"])
    pos = W["canvas"].yview()[0]
    for nome, rot in W["nav"].items():
        ativo = nome == view
        rot.config(bg=PB if ativo else CARD, fg=PR if ativo else TX)
    limpar(W["inner"])
    PAGINAS[view](W["inner"])
    W["root"].update_idletasks()
    W["canvas"].configure(scrollregion=W["canvas"].bbox("all"))
    W["canvas"].yview_moveto(pos)


def ir(nome):
    global view, sel, edit
    view, sel, edit = nome, 0, None
    renderizar()
    W["canvas"].yview_moveto(0)


def alternar_cenario():
    ESTADO["rel"] = bool(W["rel"].get())
    salvar_auto()
    renderizar()


def acao_exemplo():
    if ESTADO["turmas"] and not messagebox.askyesno("SIGHA", "Isto substitui as turmas atuais pelas 5 turmas de exemplo. Continuar?"):
        return
    exemplo()
    salvar_auto()
    renderizar()
    msg("Exemplo carregado.")


def acao_exportar():
    caminho = filedialog.asksaveasfilename(defaultextension=".json", initialfile="sigha_dados.json",
                                           filetypes=[("JSON", "*.json")])
    if caminho:
        msg("Dados exportados." if salvar_json(caminho) else "Não foi possível gravar o arquivo.")


def acao_importar():
    caminho = filedialog.askopenfilename(filetypes=[("JSON", "*.json"), ("Todos", "*.*")])
    if not caminho:
        return
    if carregar_json(caminho):
        salvar_auto()
        renderizar()
        msg("Dados importados (%d turma(s))." % len(ESTADO["turmas"]))
    else:
        messagebox.showerror("SIGHA", "Arquivo JSON inválido.")


def acao_zerar():
    if messagebox.askyesno("SIGHA", "Apagar todas as turmas?"):
        ESTADO["turmas"], ESTADO["rel"] = [], False
        salvar_auto()
        renderizar()


def exportar_csv():
    caminho = filedialog.asksaveasfilename(defaultextension=".csv", initialfile="grade.csv", filetypes=[("CSV", "*.csv")])
    if not caminho:
        return
    try:
        with open(caminho, "w", encoding="utf-8") as f:
            f.write(csv_grade(R))
        msg("Grade exportada.")
    except OSError:
        msg("Não foi possível gravar o arquivo.")


def montar_janela():
    root = tk.Tk()
    root.title("SIGHA")
    root.geometry("1180x780")
    root.minsize(980, 600)
    root.configure(bg=BG)
    W["root"] = root

    estilo = ttk.Style(root)
    estilo.theme_use("clam")
    estilo.configure("Treeview", rowheight=26, font=(FONTE, 10), background=CARD, fieldbackground=CARD, bordercolor=BD)
    estilo.configure("Treeview.Heading", font=(FONTE, 9, "bold"), background=BG, foreground=MU)
    estilo.map("Treeview", background=[("selected", PR)], foreground=[("selected", "white")])
    estilo.configure("Azul.Horizontal.TProgressbar", troughcolor=BD, background=PR, bordercolor=BD, lightcolor=PR, darkcolor=PR)

    topo = tk.Frame(root, bg=CARD, height=56, highlightbackground=BD, highlightthickness=1)
    topo.pack(fill="x")
    topo.pack_propagate(False)
    tk.Label(topo, text="SIGHA", font=(FONTE, 20, "bold"), fg=PR, bg=CARD).pack(side="left", padx=20)
    for texto, cmd, perigo in (("Zerar", acao_zerar, True), ("Importar JSON", acao_importar, False),
                               ("Exportar JSON", acao_exportar, False), ("Exemplo", acao_exemplo, False)):
        botao(topo, texto, cmd, perigo=perigo).pack(side="right", padx=(0, 8), pady=11)
    W["rel"] = tk.BooleanVar(value=False)
    tk.Checkbutton(topo, text="Liberar restrições de dias (cenário B)", variable=W["rel"], command=alternar_cenario,
                   bg=CARD, activebackground=CARD, font=(FONTE, 10)).pack(side="right", padx=14)

    W["status"] = tk.Label(root, text="", anchor="w", bg=BG, fg=MU, font=(FONTE, 9), padx=14)
    W["status"].pack(side="bottom", fill="x")

    corpo = tk.Frame(root, bg=BG)
    corpo.pack(fill="both", expand=True)
    lateral = tk.Frame(corpo, bg=CARD, width=200, highlightbackground=BD, highlightthickness=1)
    lateral.pack(side="left", fill="y")
    lateral.pack_propagate(False)
    W["nav"] = {}
    for nome, rotulo in NAV:
        rot = tk.Label(lateral, text=rotulo, anchor="w", padx=14, pady=8, bg=CARD, fg=TX, font=(FONTE, 11), cursor="hand2")
        rot.pack(fill="x", padx=12, pady=(10 if nome == "dash" else 2, 0))
        rot.bind("<Button-1>", lambda _e, n=nome: ir(n))
        W["nav"][nome] = rot

    area = tk.Frame(corpo, bg=BG)
    area.pack(side="left", fill="both", expand=True)
    cv = tk.Canvas(area, bg=BG, highlightthickness=0)
    sb = ttk.Scrollbar(area, orient="vertical", command=cv.yview)
    cv.configure(yscrollcommand=sb.set)
    sb.pack(side="right", fill="y")
    cv.pack(side="left", fill="both", expand=True)
    inner = tk.Frame(cv, bg=BG, padx=24, pady=20)
    janela_id = cv.create_window((0, 0), window=inner, anchor="nw")
    cv.bind("<Configure>", lambda e: cv.itemconfig(janela_id, width=e.width))
    inner.bind("<Configure>", lambda _e: cv.configure(scrollregion=cv.bbox("all")))
    W["canvas"], W["inner"] = cv, inner

    def roda(ev):
        if ev.num == 4:
            passo = -1
        elif ev.num == 5:
            passo = 1
        else:
            passo = -1 if ev.delta > 0 else 1
        cv.yview_scroll(passo, "units")

    for ev in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
        root.bind_all(ev, roda)
    return root


def main():
    root = montar_janela()
    if "--exemplo" in sys.argv:
        exemplo()
    elif carregar_json(ARQUIVO):
        pass
    renderizar()
    root.mainloop()


if __name__ == "__main__":
    main()
