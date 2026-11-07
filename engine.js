// Motor de planeamento: calcula previsões com base no estado real e nas dependências.
// Datas em texto ISO (AAAA-MM-DD), dias corridos (como no Excel).

export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.round(n));
  return d.toISOString().slice(0, 10);
}
export function diffDays(a, b) {
  // b - a em dias
  return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
}
const maxD = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const minD = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

export function todayISO() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Lista de antecessoras de cada atividade.
 * Fontes: "equipa" (fila da equipa), "excel" (importadas), "manual" (acrescentadas na app), "regra" (regra por especialidade).
 */
export function buildDeps(acts, regras) {
  const byUnitEsp = new Map();
  for (const a of acts) {
    if (!a.esp) continue;
    const k = a.unidade + "|" + a.esp;
    if (!byUnitEsp.has(k)) byUnitEsp.set(k, []);
    byUnitEsp.get(k).push(a.id);
  }
  const ids = new Set(acts.map((a) => a.id));
  // fila de cada equipa: cada trabalho só começa quando a equipa acaba o anterior da fila
  const antNaFila = new Map();
  const filas = new Map();
  for (const a of acts) {
    if (!a.equipa || a.eqOrdem == null || a.eqOrdem === "" || a.eqOrdem === false) continue; // false: tirado da fila de propósito
    const k = a.equipa + (a.teste ? "|teste" : ""); // as frações de teste têm filas à parte
    if (!filas.has(k)) filas.set(k, []);
    filas.get(k).push(a);
  }
  for (const f of filas.values()) {
    f.sort((x, y) => Number(x.eqOrdem) - Number(y.eqOrdem) || String(x.id).localeCompare(String(y.id)));
    for (let i = 1; i < f.length; i++) antNaFila.set(f[i].id, f[i - 1].id);
  }
  const preds = new Map();
  for (const a of acts) {
    const list = [];
    const seen = new Set();
    const ignorar = new Set(a.depsIgnorar || []);
    const push = (id, tipo, fonte) => {
      if (!ids.has(id) || id === a.id || seen.has(id) || (ignorar.has(id) && fonte !== "equipa")) return;
      seen.add(id);
      list.push({ id, tipo: tipo || "FS", fonte });
    };
    if (antNaFila.has(a.id)) push(antNaFila.get(a.id), "FS", "equipa");
    for (const d of a.deps || []) push(d.id, d.tipo, "excel");
    for (const d of a.depsExtra || []) push(d.id, d.tipo, "manual");
    if (a.esp && regras && regras[a.esp]) {
      for (const pe of regras[a.esp]) {
        for (const pid of byUnitEsp.get(a.unidade + "|" + pe) || []) push(pid, "FS", "regra");
      }
    }
    preds.set(a.id, list);
  }
  return preds;
}

/**
 * Calcula a previsão de todas as atividades.
 * Devolve Map id -> resultado {inicio, fim, estado, atraso, bloqueadaPor[], semPlano, ciclo, prevIni, prevFim, provIni, provFim, atrasoInicio}
 */
export function duracaoDe(a, duracoes) {
  if (a.duracaoManual != null && a.duracaoManual !== "") return Math.max(0, Number(a.duracaoManual));
  if (a.esp && duracoes && duracoes[a.esp] != null) return Math.max(0, Number(duracoes[a.esp]));
  return Math.max(0, Number(a.duracao) || 0);
}

export function schedule(acts, regras, hoje = todayISO(), duracoes = null) {
  const byId = new Map(acts.map((a) => [a.id, a]));
  const preds = buildDeps(acts, regras);
  const succ = new Map(acts.map((a) => [a.id, []]));
  const indeg = new Map();
  for (const a of acts) {
    const p = preds.get(a.id);
    indeg.set(a.id, p.length);
    for (const d of p) succ.get(d.id).push(a.id);
  }
  // ordenação topológica (Kahn)
  const order = [];
  const q = [];
  for (const a of acts) if (indeg.get(a.id) === 0) q.push(a.id);
  while (q.length) {
    const id = q.shift();
    order.push(id);
    for (const s of succ.get(id)) {
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) q.push(s);
    }
  }
  const emCiclo = new Set();
  if (order.length < acts.length) {
    for (const a of acts) if (indeg.get(a.id) > 0) { emCiclo.add(a.id); order.push(a.id); }
  }

  // Previsão: fica na data prevista (do Excel, da criação ou a que alguém escreveu) e só anda
  // quando as antecessoras a empurram. Atraso = data real (ou hoje) menos a previsão.
  const res = new Map();
  for (const id of order) {
    const a = byId.get(id);
    const dur = duracaoDe(a, duracoes);
    const pct = pctEfetiva(a);
    const r = { id, dur, preds: preds.get(id), succ: succ.get(id), bloqueadaPor: [], ciclo: emCiclo.has(id), atraso: null, atrasoInicio: null };
    const concluida = !!a.concluido || (pct >= 100 && !!a.realFim);
    // primeira data possível dada pelas antecessoras (usa o fim provável delas, para empurrar)
    let es = null, eqFim = null;
    for (const d of r.preds) {
      const pr = res.get(d.id);
      if (!pr) continue; // ciclo: ignora
      if (d.fonte === "equipa" && pr.estado !== "concluida") eqFim = maxD(eqFim, pr.provFim);
      const cand = d.tipo === "SS" ? pr.provIni : addDays(pr.provFim, 1);
      es = maxD(es, cand);
      if (pr.estado !== "concluida" && d.tipo !== "SS") r.bloqueadaPor.push(d.id);
    }
    const propria = a.inicioPrevisto || a.planInicio || null;
    r.semPlano = !propria && !a.realInicio && !a.dataOk; // data nunca dada nem confirmada
    const arrancou = !!a.realInicio || concluida;
    // previsão de início: a própria, empurrada pelas antecessoras enquanto não arrancou
    // (se arrancou sem nunca ter tido previsão, a referência é o próprio início real)
    let prevIni = arrancou ? propria || a.realInicio || maxD(es, null) || a.realFim || hoje : maxD(propria, es);
    if (!prevIni) prevIni = maxD(es, hoje); // sem data nenhuma: a primeira possível
    r.prevIni = prevIni;
    // previsão de fim: a escrita à mão; senão a duração própria; senão a do Excel (se couber); senão a padrão
    const temDurManual = a.duracaoManual != null && a.duracaoManual !== "";
    let prevFim;
    if (a.fimPrevisto) {
      // um fim prometido antes de arrancar acompanha o início se as antecessoras o empurrarem
      if (!arrancou && propria && a.fimPrevisto >= propria) prevFim = addDays(prevIni, diffDays(propria, a.fimPrevisto));
      else prevFim = maxD(a.fimPrevisto, prevIni);
    } else if (temDurManual || !a.planFim || a.inicioPrevisto) prevFim = addDays(prevIni, dur); // início mudado à mão: o fim do plano original já não conta
    else prevFim = maxD(a.planFim, addDays(prevIni, dur));
    r.prevFim = prevFim;
    if (concluida) {
      r.estado = "concluida";
      r.fim = a.realFim || prevFim;
      r.inicio = a.realInicio || (a.realFim ? minD(prevIni, a.realFim) : prevIni);
      r.atraso = diffDays(prevFim, r.fim);
      if (a.realInicio) r.atrasoInicio = diffDays(prevIni, a.realInicio);
      r.bloqueadaPor = [];
      r.provIni = r.inicio; r.provFim = r.fim;
    } else {
      r.inicio = a.realInicio || prevIni;
      r.fim = prevFim;
      if (a.realInicio) {
        r.estado = "em_curso";
        r.bloqueadaPor = []; // já arrancou
        r.atrasoInicio = diffDays(prevIni, a.realInicio);
        const restante = Math.ceil(dur * (1 - pct / 100));
        r.provIni = a.realInicio;
        r.provFim = maxD(prevFim, addDays(hoje, restante));
        // já começou, mas a equipa está noutro trabalho da fila: o que falta só se faz quando ela acabar esse
        if (eqFim && restante > 0) r.provFim = maxD(r.provFim, addDays(eqFim, 1 + restante));
      } else {
        r.estado = r.bloqueadaPor.length ? "bloqueada" : "por_iniciar";
        if (prevIni < hoje) r.atrasoInicio = diffDays(prevIni, hoje);
        r.provIni = maxD(prevIni, hoje);
        // conta o prazo previsto (pode ser um fim escrito à mão, mais curto ou mais longo do que a duração)
        r.provFim = maxD(prevFim, addDays(r.provIni, Math.max(0, diffDays(prevIni, prevFim))));
      }
      r.atraso = prevFim < hoje ? diffDays(prevFim, hoje) : 0;
    }
    r.atrasada = r.estado !== "concluida" && r.atraso > 0;
    res.set(id, r);
  }
  return res;
}

export function pctEfetiva(a) {
  if (a.concluido) return 100;
  const f = a.pctFiscal, e = a.pctEmp;
  if (f != null && a.fiscalEm && (!a.empEm || a.fiscalEm >= a.empEm)) return Number(f);
  return Number(e ?? f ?? 0);
}

/** Todas as atividades a jusante (que andam se esta atrasar). */
export function downstream(id, res) {
  const out = new Set();
  const st = [...(res.get(id)?.succ || [])];
  while (st.length) {
    const s = st.pop();
    if (out.has(s)) continue;
    out.add(s);
    for (const x of res.get(s)?.succ || []) st.push(x);
  }
  return out;
}
