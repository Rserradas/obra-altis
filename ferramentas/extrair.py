"""Extrai o cronograma do Excel para seed.json (dados iniciais da aplicação)."""
import openpyxl, re, json, datetime, sys, collections, statistics

SRC = sys.argv[1]
OUT = sys.argv[2]

wf = openpyxl.load_workbook(SRC, read_only=True)["Cronograma Final"]
wv = openpyxl.load_workbook(SRC, read_only=True, data_only=True)["Cronograma Final"]
F = list(wf.iter_rows(min_row=1, max_col=20, values_only=True))
V = list(wv.iter_rows(min_row=1, max_col=20, values_only=True))
N = len(V)

# Especialidades canónicas (chave, nome, ordem)
ESP = [
    ("cabelagem", "Cabelagem elétrica e comunicações"),
    ("telecom", "Telecomunicações"),
    ("ac_tubagem", "A/C: tubagem cobre e eletrificação"),
    ("ac_esgotos", "A/C: esgotos"),
    ("pint_barramento", "Pintura: barramento"),
    ("teto_falso", "Teto falso"),
    ("mosaicos", "Mosaicos (pavimento)"),
    ("azul_wc", "Azulejos WC"),
    ("azul_cozinha", "Azulejos cozinha"),
    ("pint_primario", "Pintura: primário"),
    ("caix_portas", "Caixilharia: portas e estores"),
    ("caix_guarda", "Caixilharia: guarda-corpos"),
    ("caix_ac", "Caixilharia: arm. AC e brise lavandaria"),
    ("carp_cozinha", "Carpintaria: cozinha"),
    ("carp_roupeiros", "Carpintaria: roupeiros"),
    ("carp_wc", "Carpintaria: WC e varanda"),
    ("loucas", "Louças sanitárias"),
    ("loucas_div", "Louças: torneiras, duches e espelhos"),
    ("piso_flut", "Piso flutuante quartos"),
    ("aparelhagem", "Aparelhagem elétrica"),
    ("ac_aparelhos", "A/C: montagem aparelhos"),
    ("pint_final", "Pintura: final"),
    ("acab_teto", "Acabamentos: teto falso"),
    ("acab_piso", "Acabamentos: piso flutuante"),
    ("acab_mosaicos", "Acabamentos: mosaicos e azulejos"),
]

def esp_key(nome):
    s = nome.strip().lower()
    if s.startswith("cabelagem"): return "cabelagem"
    if s.startswith("telecomunic"): return "telecom"
    if s.startswith("a/c - tubagem"): return "ac_tubagem"
    if s.startswith("a/c - esgotos"): return "ac_esgotos"
    if s.startswith("a/c - montagem"): return "ac_aparelhos"
    if "barra" in s and s.startswith("pintura"): return "pint_barramento"
    if s.startswith("pintura - prim"): return "pint_primario"
    if s.startswith("pintura - final"): return "pint_final"
    if s.startswith("acabamentos - teto"): return "acab_teto"
    if s.startswith("acabamentos - piso"): return "acab_piso"
    if s.startswith("acab.finais") or s.startswith("acabamentos finais"): return "acab_mosaicos"
    if s.startswith("teto falso"): return "teto_falso"
    if s.startswith("mosaicos"): return "mosaicos"
    if s.startswith("azulejos - wc"): return "azul_wc"
    if s.startswith("azulejos - cozinha"): return "azul_cozinha"
    if s.startswith("caixilharia - portas"): return "caix_portas"
    if s.startswith("caixilharia - guarda"): return "caix_guarda"
    if s.startswith("caixilharia - arm"): return "caix_ac"
    if s.startswith("carpintaria -cozinha") or s.startswith("carpintaria - cozinha"): return "carp_cozinha"
    if s.startswith("carpintaria - roupeiros"): return "carp_roupeiros"
    if s.startswith("carpintaria - casa"): return "carp_wc"
    if s == "louças sanitarios": return "loucas"
    if s.startswith("louças sanitárias/"): return "loucas_div"
    if s.startswith("piso flutuante"): return "piso_flut"
    if s.startswith("aparelhagem"): return "aparelhagem"
    return None

def iso(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    return None

def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

def clean_team(v):
    if not isinstance(v, str): return None
    v = v.strip()
    if v in ("", "-", "Done", "x"): return None
    return v

def slug(ref):
    return "a" + str(ref).replace("#", "-").replace("/", "_").replace(".", "_")

def rid(row):
    return "r%d" % row

unidades = {}
def unit_for(c):
    c = str(c).strip()
    m = re.match(r"^([A-D])-F(\d{3})$", c)
    if m:
        bl, num_ = m.group(1), m.group(2)
        return c, {"id": c, "bloco": bl, "tipo": "Apartamento", "nome": c, "piso": int(num_[0])}
    m = re.match(r"^([A-D])-L(\d{3})$", c)
    if m:
        return c, {"id": c, "bloco": m.group(1), "tipo": "Loja", "nome": c, "piso": 0}
    m = re.match(r"^([A-D])- ?Lojas$", c)
    if m:
        return m.group(1) + "-LOJAS", {"id": m.group(1) + "-LOJAS", "bloco": m.group(1), "tipo": "Loja", "nome": "Lojas Bloco " + m.group(1) + " (geral)", "piso": 0}
    if c in ("A", "B", "C", "D"):
        return c + "-ZC", {"id": c + "-ZC", "bloco": c, "tipo": "Zona comum", "nome": "Zonas comuns Bloco " + c, "piso": 99}
    if c == "E":
        return "GERAL", {"id": "GERAL", "bloco": "Geral", "tipo": "Geral", "nome": "Geral e exteriores", "piso": 99}
    return c, {"id": c, "bloco": "?", "tipo": "Outro", "nome": c, "piso": 99}

row_to_ref = {}
acts = []
for i in range(1, N):
    r = V[i]
    if r[1] not in ("T", "D"):
        continue
    if r[1] == "T" and i + 1 < N and V[i + 1][1] == "D":
        continue  # cabeçalho de grupo
    ref = str(r[0]).strip()
    row_to_ref[i + 1] = ref
    uid, u = unit_for(r[2])
    unidades.setdefault(uid, u)
    sec = str(r[3]).strip()
    k = esp_key(sec) if u["tipo"] in ("Apartamento", "Loja") else None
    acts.append({"_row": i + 1, "ref": ref, "unidade": uid, "seccao": sec, "esp": k,
                 "equipa": clean_team(r[4]),
                 "planInicio": iso(r[5]), "planFim": iso(r[6]),
                 "dias": num(r[10]),
                 "realInicio": iso(r[13]), "realFim": iso(r[14]),
                 "pct": num(r[15]), "concluido": str(r[16]).strip().lower() == "sim",
                 "obs": (str(r[19]).strip() if r[19] not in (None, "-", "x") else None),
                 "_ant": r[8]})

ref_to_id = {}
for a in acts:
    ref_to_id.setdefault(a["ref"], rid(a["_row"]))

# Dependências existentes no Excel
for a in acts:
    deps = []
    fF = F[a["_row"] - 1][5]
    if isinstance(fF, str) and fF.startswith("=") and "XLOOKUP" not in fF:
        for col, rown in re.findall(r"\b([FG])(\d+)\b", fF):
            rr = int(rown)
            if rr in row_to_ref and rr != a["_row"]:
                deps.append({"id": rid(rr), "tipo": "FS" if col == "G" else "SS"})
    ant = a["_ant"]
    if isinstance(ant, str) and re.match(r"^\d+#\d+$", ant.strip()) and ant.strip() in ref_to_id:
        did = ref_to_id[ant.strip()]
        if not any(d["id"] == did for d in deps):
            deps.append({"id": did, "tipo": "FS"})
    a["deps"] = deps

# Duração: plano, senão coluna Dias, senão mediana da especialidade
dur_by = collections.defaultdict(list)
def dd(a, b):
    return (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days
for a in acts:
    d = None
    if a["planInicio"] and a["planFim"]:
        d = dd(a["planInicio"], a["planFim"])
    elif a["dias"] and a["dias"] > 0:
        d = int(a["dias"])
    a["duracao"] = d if d is not None and d >= 0 else None
    if a["duracao"] and a["esp"]:
        dur_by[a["esp"]].append(a["duracao"])
med = {k: int(statistics.median(v)) for k, v in dur_by.items() if v}
for a in acts:
    if not a["duracao"]:
        a["duracao"] = max(1, med.get(a["esp"], 5))
        a["duracaoEstimada"] = True

out_acts = []
for a in acts:
    pct = a["pct"] if a["pct"] is not None else 0
    if a["concluido"]:
        pct = 1
    o = {"id": rid(a["_row"]), "ref": a["ref"], "unidade": a["unidade"], "seccao": a["seccao"],
         "esp": a["esp"], "equipa": a["equipa"], "planInicio": a["planInicio"], "planFim": a["planFim"],
         "duracao": a["duracao"], "realInicio": a["realInicio"], "realFim": a["realFim"],
         "pctEmp": round(pct * 100), "concluido": a["concluido"], "obs": a["obs"], "deps": a["deps"]}
    if a.get("duracaoEstimada"): o["duracaoEstimada"] = True
    if o["concluido"] and not o["realFim"]:
        o["realFim"] = o["planFim"]
    out_acts.append({k: v for k, v in o.items() if v not in (None, [], False) or k in ("pctEmp",)})

# Regras padrão por especialidade (a validar pelo dono de obra)
REGRAS = {
    "pint_barramento": ["cabelagem", "ac_tubagem", "ac_esgotos"],
    "teto_falso": ["cabelagem", "ac_tubagem", "ac_esgotos"],
    "azul_wc": ["ac_esgotos"],
    "pint_primario": ["pint_barramento", "teto_falso"],
    "loucas": ["azul_wc", "teto_falso"],
    "loucas_div": ["loucas"],
    "carp_cozinha": ["azul_cozinha", "mosaicos"],
    "carp_wc": ["azul_wc"],
    "piso_flut": ["pint_primario"],
    "carp_roupeiros": ["pint_primario"],
    "aparelhagem": ["pint_primario"],
    "ac_aparelhos": ["ac_tubagem", "pint_primario"],
    "pint_final": ["carp_cozinha", "carp_roupeiros", "aparelhagem", "piso_flut", "loucas"],
    "acab_teto": ["teto_falso"],
    "acab_piso": ["piso_flut"],
    "acab_mosaicos": ["mosaicos", "azul_wc", "azul_cozinha"],
}

DURACOES = {"cabelagem": 10, "telecom": 3, "ac_tubagem": 5, "ac_esgotos": 3, "pint_barramento": 8,
    "teto_falso": 8, "mosaicos": 8, "azul_wc": 12, "azul_cozinha": 5, "pint_primario": 4, "caix_portas": 10,
    "caix_guarda": 10, "caix_ac": 15, "carp_cozinha": 6, "carp_roupeiros": 6, "carp_wc": 6, "loucas": 3,
    "loucas_div": 3, "piso_flut": 4, "aparelhagem": 3, "ac_aparelhos": 15, "pint_final": 3, "acab_teto": 15,
    "acab_piso": 3, "acab_mosaicos": 2}

seed = {
    "obra": {"nome": "ALTIS", "fonte": SRC.split("/")[-1], "extraidoEm": datetime.date.today().isoformat()},
    "especialidades": [{"key": k, "nome": n, "ordem": i} for i, (k, n) in enumerate(ESP)],
    "regras": REGRAS,
    "duracoes": DURACOES,
    "unidades": sorted(unidades.values(), key=lambda u: (u["bloco"], u["piso"], u["id"])),
    "atividades": out_acts,
}
json.dump(seed, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

c = collections.Counter()
for a in out_acts:
    c["total"] += 1
    if a.get("planInicio"): c["com_plano"] += 1
    if a.get("concluido"): c["concluidas"] += 1
    if a.get("deps"): c["com_deps_excel"] += 1
    if a.get("duracaoEstimada"): c["dur_estimada"] += 1
    if not a.get("esp") and a["unidade"] not in ("GERAL",) and not a["unidade"].endswith("-ZC"): c["sem_esp"] += 1
print(dict(c), "unidades", collections.Counter(u["tipo"] for u in unidades.values()))
