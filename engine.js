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
 * Fila da equipa: um trabalho com ordem decimal (ex.: 20.5) faz-se ao mesmo tempo que o anterior (um grupo). Com N frentes, cada grupo
 * começa quando acaba o grupo N lugares acima (as frentes vão pegando nos grupos à vez). frentes: { equipa: N }.
 */
export function buildDeps(acts, regras, frentes = null) {
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
  const comPrimeiro = new Map();
  const filas = new Map();
  for (const a of acts) {
    if (!a.equipa || a.eqOrdem == null || a.eqOrdem === "" || a.eqOrdem === false) continue; // false: tirado da fila de propósito
    const k = a.equipa + (a.teste ? "|teste" : ""); // as frações de teste têm filas à parte
    if (!filas.has(k)) filas.set(k, []);
    filas.get(k).push(a);
  }
  for (const f of filas.values()) {
    f.sort((x, y) => Number(x.eqOrdem) - Number(y.eqOrdem) || String(x.id).localeCompare(String(y.id)));
    const grupos = [];
    for (const a of f) {
      const g = grupos[grupos.length - 1];
      // ordem com parte decimal (ex.: 20.5): "ao mesmo tempo que o anterior"; as ordens inteiras começam um grupo novo
      if (g && !Number.isInteger(Number(a.eqOrdem))) g.ids.push(a.id);
      else grupos.push({ ids: [a.id] });
    }
    const n = Math.max(1, Math.floor(Number(frentes && frentes[f[0].equipa]) || 1));
    for (let i = n; i < grupos.length; i++) for (const id of grupos[i].ids) antNaFila.set(id, grupos[i - n].ids);
    // num grupo, os outros começam com o primeiro (ligação início com início); a data prevista deles deixa de contar
    for (const g of grupos) for (const id of g.ids.slice(1)) comPrimeiro.set(id, g.ids[0]);
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
    for (const pid of antNaFila.get(a.id) || []) push(pid, "FS", "equipa");
    if (comPrimeiro.has(a.id)) push(comPrimeiro.get(a.id), "SS", "grupo");
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

export function schedule(acts, regras, hoje = todayISO(), duracoes = null, opts = null) {
  const byId = new Map(acts.map((a) => [a.id, a]));
  const preds = buildDeps(acts, regras, opts && opts.frentes);
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
  for (const id of order) res.set(id, calcAtiv(byId.get(id), preds.get(id), succ.get(id), emCiclo.has(id), res, hoje, duracoes, !!(opts && opts.emDia && opts.emDia.has(id))));
  // para as simulações: ordem de cálculo e atividades
  res.order = order;
  res.byId = byId;
  return res;
}

/** Calcula uma atividade a partir das antecessoras já calculadas (get). emDia: simula que não tem atraso próprio. */
function calcAtiv(a, predsA, succA, ciclo, get, hoje, duracoes, emDia) {
  const id = a.id;
  const dur = duracaoDe(a, duracoes);
  const pct = pctEfetiva(a);
  const r = { id, dur, preds: predsA, succ: succA, bloqueadaPor: [], ciclo, atraso: null, atrasoInicio: null };
  const concluida = !!a.concluido || (pct >= 100 && !!a.realFim);
  const arrancou = !!a.realInicio || concluida;
  // num grupo da equipa ("ao mesmo tempo que o de cima"), enquanto não arranca segue o primeiro do grupo: a data prevista própria não conta
  const segueGrupo = !arrancou && r.preds.some((d) => d.fonte === "grupo");
  const propriaOrig = a.inicioPrevisto || a.planInicio || null;
  const propria = segueGrupo ? null : propriaOrig;
  // primeira data possível dada pelas antecessoras (usa o fim provável delas, para empurrar)
  let es = null, eqFim = null;
  for (const d of r.preds) {
    const pr = get.get(d.id);
    if (!pr) continue; // ciclo: ignora
    // uma antecessora já concluída não empurra uma data escrita para esta (só sugere a primeira data a quem não tem nenhuma)
    if (pr.estado === "concluida" && propria) continue;
    if (d.fonte === "equipa" && pr.estado !== "concluida") eqFim = maxD(eqFim, pr.provFim);
    const cand = d.tipo === "SS" ? pr.provIni : addDays(pr.provFim, 1);
    es = maxD(es, cand);
    if (pr.estado !== "concluida" && d.tipo !== "SS") r.bloqueadaPor.push(d.id);
  }
  r.segueGrupo = segueGrupo;
  r.semPlano = !propria && !segueGrupo && !a.realInicio && !a.dataOk; // data nunca dada nem confirmada
  // previsão de início: a própria, empurrada pelas antecessoras enquanto não arrancou
  // (se arrancou sem nunca ter tido previsão, a referência é o próprio início real)
  let prevIni = arrancou ? propria || a.realInicio || maxD(es, null) || a.realFim || hoje : maxD(propria, es);
  if (!prevIni) prevIni = maxD(es, hoje); // sem data nenhuma: a primeira possível
  r.prevIni = prevIni;
  // previsão de fim: a escrita à mão; senão a duração própria; senão a do Excel (se couber); senão a padrão
  const temDurManual = a.duracaoManual != null && a.duracaoManual !== "";
  let prevFim;
  if (segueGrupo) {
    // mantém o prazo que tinha (do fim escrito à mão, se houver), contado a partir do início do grupo
    prevFim = a.fimPrevisto && propriaOrig && a.fimPrevisto >= propriaOrig ? addDays(prevIni, diffDays(propriaOrig, a.fimPrevisto)) : addDays(prevIni, dur);
  } else if (a.fimPrevisto) {
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
      r.eqOcupada = !!(eqFim && restante > 0 && addDays(eqFim, 1 + restante) > maxD(prevFim, addDays(hoje, restante)));
      if (emDia) r.provFim = prevFim; // simulação: acaba no previsto
    } else {
      r.estado = r.bloqueadaPor.length ? "bloqueada" : "por_iniciar";
      if (prevIni < hoje) r.atrasoInicio = diffDays(prevIni, hoje);
      r.provIni = maxD(prevIni, hoje);
      // conta o prazo previsto (pode ser um fim escrito à mão, mais curto ou mais longo do que a duração)
      r.provFim = maxD(prevFim, addDays(r.provIni, Math.max(0, diffDays(prevIni, prevFim))));
      if (emDia) { r.provIni = prevIni; r.provFim = prevFim; } // simulação: começou na data prevista
    }
    r.atraso = prevFim < hoje ? diffDays(prevFim, hoje) : 0;
  }
  r.atrasada = r.estado !== "concluida" && r.atraso > 0;
  return r;
}

/**
 * Simula que as atividades em `ids` estão em dia (sem atraso próprio) e recalcula só o que delas depende.
 * Devolve um Map id -> resultado novo, apenas com as atividades cujas datas prováveis mudaram.
 */
export function simularEmDia(res, ids, hoje, duracoes) {
  const order = res.order, byId = res.byId;
  const pos = res._pos || (res._pos = new Map(order.map((id, i) => [id, i])));
  const sujo = new Set(ids);
  let i0 = Infinity;
  for (const id of ids) if (pos.has(id)) i0 = Math.min(i0, pos.get(id));
  const nov = new Map();
  let iAt = 0;
  // como no cálculo completo, só contam as antecessoras já calculadas (nos ciclos, as que vêm depois ficam de fora)
  const get = { get: (id) => (pos.get(id) < iAt ? nov.get(id) || res.get(id) : undefined) };
  for (let i = i0; i < order.length && sujo.size; i++) {
    const id = order[i];
    if (!sujo.has(id)) continue;
    sujo.delete(id);
    const r0 = res.get(id);
    iAt = i;
    const r = calcAtiv(byId.get(id), r0.preds, r0.succ, r0.ciclo, get, hoje, duracoes, ids.has(id));
    if (r.provIni === r0.provIni && r.provFim === r0.provFim) continue;
    nov.set(id, r);
    for (const s of r0.succ) sujo.add(s);
  }
  return nov;
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
