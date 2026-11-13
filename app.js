import { schedule, downstream, pctEfetiva, todayISO, diffDays, addDays, duracaoDe } from "./engine.js";
import { DemoStore, CloudStore } from "./store.js";

/* ============================================================ utilidades */
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fd = (iso, ano) => {
  if (!iso) return "sem data";
  const [y, m, d] = iso.split("-");
  const showY = ano === true || (ano !== false && y !== todayISO().slice(0, 4));
  return `${+d} ${MESES[+m - 1]}${showY ? " " + y : ""}`;
};
const fdt = (isoT) => { if (!isoT) return ""; const d = new Date(isoT); return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const deltaHTML = (n, txt) => {
  if (n == null) return "";
  const cls = n > 0 ? "mau" : n < 0 ? "bom" : "zero";
  const s = n > 0 ? `+${n} d` : n < 0 ? `${n} d` : "no prazo";
  const dica = txt || (n > 0 ? `Atraso de ${n} dias: a data real de fim, ou hoje se ainda não acabou, está ${n} dias depois da previsão de fim`
    : n < 0 ? `Acabou ${-n} dias antes da previsão de fim` : "Dentro da previsão de fim");
  return `<span class="delta ${cls}" title="${esc(dica)}">${s}</span>`;
};
const ESTADO = { concluida: "Concluída", em_curso: "Em curso", bloqueada: "Bloqueada", por_iniciar: "Por iniciar" };
const PAPEL = { dono: "Dono de obra", empreiteiro: "Empreiteiro", fiscal: "Fiscal", admin: "Administrador", sem_acesso: "Sem acesso" };
const VISTAS = [["dono", "Dono de obra", "Ponto de situação, mapa dos apartamentos, sequência, equipas e acessos"], ["empreiteiro", "Empreiteiro", "A minha semana, trabalhos, iniciar e concluir, datas, equipas e sequência"], ["fiscal", "Fiscal", "Vistoria apartamento a apartamento, com percentagem, comentários e fotografias"]];
function mudarVista(p) {
  if (ui.sheet) closeSheet();
  if (ui.nova) closeNova();
  document.querySelectorAll('[data-dw]').forEach((e) => e.remove());
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  store.setVista(p);
  if (p) toast(`A ver como ${PAPEL[p]}`);
}
const vistaSelHTML = (id) => `<label class="vista-sel" title="Administrador: escolha como quer ver a aplicação"><span>Ver como</span><select class="inp" id="${id}">${VISTAS.map(([k, l]) => `<option value="${k}" ${store.user.papel === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
const CURTO = { cabelagem: "Cabelagem", telecom: "Telecom", ac_tubagem: "AC tubagem", ac_esgotos: "AC esgotos", pint_barramento: "Barramento",
  teto_falso: "Teto falso", mosaicos: "Mosaicos", azul_wc: "Azulejo WC", azul_cozinha: "Azulejo coz.", pint_primario: "Primário",
  caix_portas: "Portas/estores", caix_guarda: "Guarda-corpos", caix_ac: "Arm. AC", carp_cozinha: "Carp. cozinha", carp_roupeiros: "Roupeiros",
  carp_wc: "Carp. WC", loucas: "Louças", loucas_div: "Torneiras", piso_flut: "Piso flut.", aparelhagem: "Aparelhagem", ac_aparelhos: "AC aparelhos",
  pint_final: "Pintura final", acab_teto: "Acab. teto", acab_piso: "Acab. piso", acab_mosaicos: "Acab. mosaicos" };
const ICON = {
  mais: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  vistorias: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m8.5 12 2 2 4-4M8.5 17h7"/></svg>',
  semana: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m8.5 15 2.2 2.2 4.8-4.8"/></svg>',
  painel: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  unidades: '<svg viewBox="0 0 24 24"><path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-4h6v4M8 8h2M14 8h2M8 12h2M14 12h2"/></svg>',
  plano: '<svg viewBox="0 0 24 24"><path d="M3 6h8M3 12h12M3 18h6"/><rect x="13" y="4" width="8" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1"/><rect x="11" y="16" width="8" height="4" rx="1"/></svg>',
  regras: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  gantt: '<svg viewBox="0 0 24 24"><path d="M3 4v16h18"/><rect x="6" y="6" width="7" height="3" rx="1"/><rect x="10" y="11" width="8" height="3" rx="1"/><rect x="8" y="16" width="5" height="2.5" rx="1"/></svg>',
  previsao: '<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h12l-2.5 3.5L17 11H5"/><path d="M3 21h8"/></svg>',
  equipa: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/></svg>',
  galeria: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
  coment: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  lupa: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pendentes: '<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/></svg>',
  lig: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};

let store, S = null; // S = estado calculado
const semAcento = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const PLANO_PADRAO = () => ({ f: "todas", bloco: "", tipo: "", unidade: "", ativ: "", equipa: "", q: "", soAtr: false, semConc: true, sort: null, editar: false, atribuir: false, atrEq: "", selec: null });
const VERSAO = "2026.11.14"; // mudar também em versao.json e no CACHE de sw.js
const ui = { bloco: "todos", plano: PLANO_PADRAO(), unidadeTab: "ativ", vistoria: {}, sheet: null };
/** Há algum filtro diferente do padrão? */
function filtrosAlterados() {
  const p = ui.plano, d = PLANO_PADRAO(), g = ui.gantt;
  const planoMudou = ["bloco", "tipo", "unidade", "ativ", "equipa", "q", "soAtr", "editar", "atribuir"].some((k) => !!p[k] !== !!d[k]) || p.semConc === false || !!p.sort || (p.f || "todas") !== "todas";
  if (ui.regSort || ui.regQ) return true;
  const ganttMudou = g && (g.bloco || g.unidade || g.ativ || g.abertas === false || g.ligacoes === false || g.zoom !== "semana" || (g.abertosB && g.abertosB.size) || (g.abertos && g.abertos.size) || g.sel);
  return !!(planoMudou || ganttMudou || ui.bloco !== "todos" || ui.unitEdit || ui.uSemConc === false || !!ui.porVist || !!ui.comPend);
}
/* Os filtros de Trabalhos, A minha semana e Apartamentos ficam guardados neste dispositivo, por utilizador. */
let filtrosDe = null;
const chaveFiltros = () => "obra-filtros-" + ((store && store.user && (store.user.email || store.user.papel)) || "");
function lerFiltros() {
  const k = chaveFiltros();
  if (filtrosDe === k) return;
  const trocou = filtrosDe !== null;
  filtrosDe = k;
  if (trocou) { ui.plano = PLANO_PADRAO(); ui.semana = null; ui.bloco = "todos"; ui.porVist = false; ui.comPend = false; }
  try {
    const f = JSON.parse(localStorage.getItem(k) || "null");
    if (!f) return;
    if (f.plano) Object.assign(ui.plano, PLANO_PADRAO(), f.plano);
    if (f.semana) ui.semana = f.semana;
    if (f.bloco) ui.bloco = f.bloco;
    if (f.porVist) ui.porVist = true;
    if (f.comPend) ui.comPend = true;
  } catch (e) {}
}
function guardarFiltros() {
  if (filtrosDe !== chaveFiltros()) return;
  const { bloco, tipo, unidade, ativ, equipa, q, soAtr, semConc, sort, f } = ui.plano;
  try { localStorage.setItem(filtrosDe, JSON.stringify({ plano: { bloco, tipo, unidade, ativ, equipa, q, soAtr, semConc, sort, f }, semana: ui.semana || null, bloco: ui.bloco, porVist: !!ui.porVist, comPend: !!ui.comPend })); } catch (e) {}
}
/** Volta todos os ecrãs aos filtros com que a aplicação abre (as vistorias por guardar mantêm-se). */
function reporFiltros() {
  ui.bloco = "todos";
  ui.plano = PLANO_PADRAO();
  ui.gantt = null;
  ui.unitEdit = false;
  ui.uSemConc = true;
  ui.porVist = false;
  ui.comPend = false;
  ui.regSort = null;
  ui.regQ = "";
  if (ui.semana) ui.semana = { equipa: "", bloco: "", ver: "" };
  ui.semana = null;
  ui.delUnit = null;
  ui.lastUnit = null;
  ui.unidadeTab = store.user && store.user.papel === "fiscal" ? "vist" : "ativ";
  window.scrollTo(0, 0);
  render();
  toast("Filtros limpos");
}

/** Traduz um erro do Firebase ou do browser para português simples. */
function erroSimples(err) {
  const c = String((err && (err.code || err.message)) || "");
  const M = [
    [/permission|insufficient/i, "não tem permissão para isto"],
    [/unavailable|network|offline|failed to fetch/i, "sem ligação à internet. Tente outra vez quando houver rede"],
    [/email-already-in-use/i, "esse email já tem conta"],
    [/invalid-email/i, "o email não está bem escrito"],
    [/weak-password/i, "a palavra-passe é curta demais: use pelo menos 6 caracteres"],
    [/not-found/i, "já não existe, pode ter sido apagado por outra pessoa"],
    [/quota|resource-exhausted/i, "o limite de utilização do servidor foi atingido por hoje"],
    [/deadline|timeout/i, "o servidor demorou demasiado a responder. Tente outra vez"],
  ];
  for (const [re, txt] of M) if (re.test(c)) return txt;
  return "aconteceu um erro inesperado" + (c ? ` (${c})` : "");
}
/** O servidor recusou uma gravação: o ecrã volta ao valor anterior. Explica porquê. */
function avisoErroEscrita(er) {
  const sem = /permission/i.test(er.code + " " + er.msg);
  perguntar({
    titulo: "A alteração não foi gravada",
    texto: sem
      ? `<p>O servidor recusou a gravação por falta de permissão, por isso o ecrã voltou ao valor anterior.</p><p class="note">Conta: ${esc(er.email || "")} (${esc(er.papel || "sem perfil")}). Se acabou de mudar as regras do Firebase, confirme que publicou a versão mais recente. Se não, diga ao dono de obra.</p>`
      : `<p>Não foi possível gravar: ${esc(erroSimples({ code: er.code || er.msg }))}. O ecrã voltou ao valor anterior.</p><p class="note">Tente outra vez. Se continuar a acontecer, diga ao dono de obra e indique este código: ${esc(er.code || er.msg || "")}</p>`,
    opcoes: [{ k: "ok", l: "Percebi", estilo: "pri" }],
  });
}
/* ---- Anular: cada alteração guardada fica num "lote" que a mensagem seguinte pode desfazer */
let loteAnular = [];
let aAnular = false;
let snapDatas = null; // datas de todas as atividades antes da primeira gravação do lote, para contar o que mudou
const fotoDatas = () => (S ? new Map([...S.res].map(([id, r]) => [id, (r.inicio || "") + "|" + (r.fim || "")])) : null);
function instalarAnular(st) {
  const upd = st.updateAtividade.bind(st), add = st.addAtividades.bind(st), cfg = st.setConfig.bind(st), rem = st.removeAtividades.bind(st);
  const prevCfg = (patch) => { const c = st.data.config || {}; const o = {}; for (const k of Object.keys(patch || {})) o[k] = c[k] === undefined ? null : JSON.parse(JSON.stringify(c[k])); return o; };
  st.updateAtividade = async (id, patch, registo) => {
    if (!aAnular && !snapDatas) snapDatas = fotoDatas();
    if (!aAnular) {
      const a = st.data.atividades[id] || {};
      const prev = {};
      for (const k of Object.keys(patch || {})) prev[k] = a[k] === undefined ? null : JSON.parse(JSON.stringify(a[k]));
      if (Object.keys(prev).length) loteAnular.push({ t: "upd", id, prev });
    }
    return upd(id, patch, registo);
  };
  st.addAtividades = async (lista, cfgPatch, registo) => {
    if (!aAnular && !snapDatas) snapDatas = fotoDatas();
    if (!aAnular) { loteAnular.push({ t: "add", ids: lista.map((a) => a.id) }); if (cfgPatch) loteAnular.push({ t: "cfg", prev: prevCfg(cfgPatch) }); }
    const antes = aAnular; aAnular = true; // o setConfig interno não entra no lote
    try { return await add(lista, cfgPatch, registo); } finally { aAnular = antes; }
  };
  st.setConfig = async (patch, registo) => {
    if (!aAnular && !snapDatas) snapDatas = fotoDatas();
    if (!aAnular) loteAnular.push({ t: "cfg", prev: prevCfg(patch) });
    return cfg(patch, registo);
  };
  if (st.updateMuitas) {
    const muitas = st.updateMuitas.bind(st);
    st.updateMuitas = async (lista, registo) => {
    if (!aAnular && !snapDatas) snapDatas = fotoDatas();
      if (!aAnular) loteAnular.push({ t: "many", lista: lista.map(({ id, patch }) => {
        const a = st.data.atividades[id] || {}, prev = {};
        for (const k of Object.keys(patch || {})) prev[k] = a[k] === undefined ? null : JSON.parse(JSON.stringify(a[k]));
        return { id, patch: prev };
      }) });
      return muitas(lista, registo);
    };
  }
  st._removeOrig = rem;
}
async function anularLote(lote) {
  aAnular = true;
  try {
    let primeiro = true;
    for (const x of [...lote].reverse()) {
      const reg = primeiro ? { tipo: "anular", texto: "Anulou a última alteração" } : null;
      if (x.t === "upd") { await store.updateAtividade(x.id, x.prev, reg); primeiro = false; }
      else if (x.t === "add") { await store.removeAtividades(x.ids, reg); primeiro = false; }
      else if (x.t === "cfg") { await store.setConfig(x.prev, reg); primeiro = false; }
      else if (x.t === "many") { await store.updateMuitas(x.lista, reg); primeiro = false; }
    }
  } finally { aAnular = false; }
}
function toast(msg, opts = {}) {
  document.querySelectorAll(".toast").forEach((x) => x.remove());
  const lote = loteAnular; loteAnular = [];
  const snap = snapDatas; snapDatas = null;
  const podeAnular = opts.anular !== false && lote.length > 0;
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.innerHTML = `<span>${esc(msg)}</span>${podeAnular ? `<button class="tb" data-t="anular">Anular</button>` : ""}${opts.acao ? `<button class="tb" data-t="acao">${esc(opts.acao.label)}</button>` : ""}`;
  document.body.appendChild(t);
  const tempo = setTimeout(() => t.remove(), podeAnular || opts.acao || String(msg).length > 90 ? 8000 : 2600);
  // depois de recalcular, diz quantas atividades mudaram de data (incluindo as seguintes)
  if (snap && podeAnular) {
    const conta = () => {
      if (!t.isConnected || !S) return;
      const ids = [...S.res].filter(([id, r]) => snap.has(id) && snap.get(id) !== (r.inicio || "") + "|" + (r.fim || "")).map(([id]) => id);
      const fr = new Set(ids.map((id) => S.acts[id] && S.acts[id].unidade).filter(Boolean));
      let el = t.querySelector(".toast-d");
      if (!ids.length) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement("small"); el.className = "toast-d"; t.querySelector("span").appendChild(el); }
      el.textContent = `No total, mudaram as datas de ${ids.length} atividade${ids.length === 1 ? "" : "s"}${fr.size > 1 ? ` em ${fr.size} frações` : fr.size === 1 ? ` em ${[...fr][0]}` : ""}.`;
    };
    setTimeout(conta, 250); setTimeout(conta, 1200);
  }
  t.onclick = async (e) => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    clearTimeout(tempo); t.remove();
    if (b.dataset.t === "anular") { await anularLote(lote); loteAnular = []; toast("Alteração anulada", { anular: false }); }
    else if (opts.acao) opts.acao.fn();
  };
}
const can = (acao) => {
  const p = store.user && store.user.papel;
  if (p === "dono") return true;
  if (p === "empreiteiro") return ["executar", "dependencias", "foto", "criar"].includes(acao);
  if (p === "fiscal") return ["vistoria", "foto"].includes(acao);
  return false;
};

/* ============================================================ cálculo */
function compute() {
  const d = store.data;
  if (!d.config) { S = null; return; }
  const cfg = d.config;
  const acts = Object.values(d.atividades);
  const hoje = todayISO();
  const res = schedule(acts, cfg.regras || {}, hoje, cfg.duracoes || {});
  const espIdx = Object.fromEntries((cfg.especialidades || []).map((e) => [e.key, e]));
  const todasU = (cfg.unidades || []).map((u) => ({ ...u }));
  const uMap = Object.fromEntries(todasU.map((u) => [u.id, u]));
  // frações de teste: aparecem à parte e não contam para a obra
  const unidades = todasU.filter((u) => !u.teste);
  const unidadesTeste = todasU.filter((u) => u.teste);
  for (const u of todasU) Object.assign(u, { acts: [], dur: 0, feito: 0, fim: null, atraso: null, n: { concluida: 0, em_curso: 0, bloqueada: 0, por_iniciar: 0, atrasada: 0 } });
  const tot = { n: 0, concluida: 0, em_curso: 0, bloqueada: 0, por_iniciar: 0, atrasada: 0, semPlano: 0, fim: null, atraso: null };
  for (const a of acts) {
    const r = res.get(a.id);
    const u = uMap[a.unidade];
    if (!u) continue;
    u.acts.push(a);
    const w = Math.max(1, r.dur);
    u.dur += w; u.feito += w * pctEfetiva(a) / 100;
    u.n[r.estado]++;
    if (r.atrasada) u.n.atrasada++;
    if (r.estado !== "concluida") u.atraso = Math.max(u.atraso ?? 0, r.atraso || 0);
    if (!u.fim || r.provFim > u.fim) u.fim = r.provFim;
    if (u.teste) continue;
    tot.n++; tot[r.estado]++;
    if (r.atrasada) tot.atrasada++;
    if (r.semPlano && r.estado !== "concluida") tot.semPlano++;
    // fim previsto da obra: o fim provável (uma previsão já ultrapassada conta a partir de hoje)
    if (r.estado !== "concluida") tot.atraso = Math.max(tot.atraso ?? 0, r.atraso || 0);
    if (!tot.fim || r.provFim > tot.fim) tot.fim = r.provFim;
  }
  for (const u of todasU) {
    u.pct = u.dur ? Math.round((100 * u.feito) / u.dur) : 0;
    const ord = (a) => (a.esp && espIdx[a.esp] ? espIdx[a.esp].ordem : 99);
    u.acts.sort((a, b) => ord(a) - ord(b) || (res.get(a.id).inicio || "").localeCompare(res.get(b.id).inicio || ""));
  }
  const idsTeste = new Set(unidadesTeste.map((u) => u.id));
  S = { cfg, res, hoje, unidades, unidadesTeste, idsTeste, uMap, tot, espIdx, acts: d.atividades, equipas: [] };
  // equipas: as registadas em Definições e as que aparecem nos trabalhos (vindas do Excel)
  const registadas = (cfg.equipas || []).filter((e) => e && e.nome);
  const nomesReg = new Set(registadas.map((e) => e.nome));
  const soNosTrab = [...new Set(acts.map((a) => a.equipa).filter((n) => n && !nomesReg.has(n)))].map((nome) => ({ nome, daObra: true }));
  S.eqLista = [...registadas, ...soNosTrab].sort((a, b) => a.nome.localeCompare(b.nome, "pt", { numeric: true }));
  S.equipasTodas = S.eqLista.map((e) => e.nome);
  // as equipas que saíram da obra deixam de aparecer para atribuir, mas ficam no histórico e nos filtros
  S.equipas = S.eqLista.filter((e) => e.ativa !== false).map((e) => e.nome);
}
/** Atividades da obra (sem as das frações de teste). */
const actsObra = () => Object.values(S.acts).filter((a) => !S.idsTeste.has(a.unidade));
const nomeAtiv = (a) => (a.esp && S.espIdx[a.esp] ? S.espIdx[a.esp].nome : a.seccao);
const blocoLabel = (b) => (b === "Geral" ? "Geral" : "Bloco " + b);

/* ============================================================ arranque */
async function boot() {
  const cfg = window.OBRA_CONFIG || {};
  let seed = null;
  try { seed = await (await fetch("seed.json")).json(); } catch (e) { console.warn("seed", e); }
  const cloud = cfg.firebase && cfg.firebase.apiKey;
  store = cloud ? new CloudStore(cfg, seed) : new DemoStore(seed);
  try { await store.init(); instalarAnular(store); } catch (e) {
    $("#app").innerHTML = `<div class="login"><div class="login-box"><h2>Não foi possível abrir a obra</h2><p class="err">${esc(e.message)}</p><p class="note">Verifique a configuração (config.js) e a ligação à internet.</p></div></div>`;
    return;
  }
  let pend = null;
  store.on((ev) => {
    if (ev === "sync") { renderSync(); return; }
    if (ev === "erroEscrita") { avisoErroEscrita(store.ultimoErro || {}); return; }
    clearTimeout(pend);
    pend = setTimeout(() => { compute(); render(); }, ev === "data" ? 60 : 0);
  });
  compute();
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { const i = document.querySelector("#psqD input"); if (i && i.offsetParent) { e.preventDefault(); i.focus(); } else if (S) { e.preventDefault(); abrirPesquisaMovel(); } }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest || !e.target.closest(".fpick")) document.querySelectorAll(".fmenu").forEach((m) => (m.hidden = true)); });
  document.addEventListener("click", (e) => { if (!e.target.closest || !e.target.closest("[data-maism],[data-mais]")) document.querySelectorAll("[data-maism]").forEach((m) => (m.hidden = true)); });
  window.addEventListener("hashchange", () => {
    if (ui.sheet) closeSheet();
    if (ui.nova) closeNova();
    document.querySelectorAll('[data-dw="fracao"],[data-dw="equipa"]').forEach((e) => e.remove());
    render(); window.scrollTo(0, 0);
  });
  render();
  if ("serviceWorker" in navigator && cloud) navigator.serviceWorker.register("sw.js").catch(() => {});
  // procura versões novas ao abrir, ao voltar à aplicação e de 15 em 15 minutos
  setTimeout(verificarVersao, 4000);
  setInterval(verificarVersao, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verificarVersao(); });
}

/* ============================================================ versão da aplicação */
let versaoNova = null;
/** Lê versao.json do servidor (sem cache). Devolve a versão publicada, ou null sem rede. */
async function versaoPublicada() {
  try {
    const r = await fetch("versao.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.versao ? String(j.versao) : null;
  } catch (e) { return null; }
}
async function verificarVersao() {
  const v = await versaoPublicada();
  if (v && v !== VERSAO) { versaoNova = v; mostrarAvisoVersao(); }
  return v;
}
function mostrarAvisoVersao() {
  if (document.querySelector(".nova-versao")) return;
  const el = document.createElement("div");
  el.className = "nova-versao no-print"; el.setAttribute("role", "status");
  el.innerHTML = `<span><b>Há uma versão nova da aplicação.</b> Atualize para ter as últimas melhorias. O que já gravou não se perde.</span>
    <span class="row" style="gap:6px"><button class="btn sm pri" data-nv="sim">Atualizar agora</button><button class="btn sm ghost" data-nv="nao">Mais tarde</button></span>`;
  el.onclick = (e) => {
    const b = e.target.closest("[data-nv]"); if (!b) return;
    if (b.dataset.nv === "sim") atualizarApp(); else el.remove();
  };
  document.body.appendChild(el);
}
async function atualizarApp() {
  const pend = store && store.sync && store.sync.pendentes;
  if (pend) { toast("Ainda há alterações a enviar. Espere que fique Sincronizado e tente outra vez.", { anular: false }); return; }
  try { const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()); if (reg) await reg.update(); } catch (e) {}
  location.reload();
}
async function abrirAjuda() {
  const k = await perguntar({
    titulo: "Ajuda",
    texto: `<p>Em cada ecrã, o botão <b>?</b> ao lado do título explica para que serve esse ecrã.</p>
      <p>O guia rápido mostra, em poucos passos, o essencial para o seu perfil.</p>
      <p class="note" id="ajVer">Está a usar a versão <b>${esc(VERSAO)}</b>.${versaoNova ? ` Já existe a versão ${esc(versaoNova)}.` : ""}</p>`,
    opcoes: [{ k: "guia", l: "Ver o guia rápido", estilo: "pri" }, { k: "ver", l: versaoNova ? "Atualizar agora" : "Procurar atualização" }, { k: "nao", l: "Fechar" }],
  });
  if (k === "guia") abrirGuia(true);
  else if (k === "ver") {
    if (versaoNova) return atualizarApp();
    const v = await verificarVersao();
    if (!v) toast("Não foi possível confirmar a versão. Verifique a ligação à internet.", { anular: false });
    else if (v === VERSAO) toast(`Já tem a versão mais recente (${VERSAO}).`, { anular: false });
  }
}
async function sairConfirmar() {
  const pend = store.sync && store.sync.pendentes;
  const k = await perguntar({
    titulo: "Sair da aplicação?",
    texto: pend ? `<div class="dlg-av">Ainda há alterações por enviar. Se sair agora, podem perder-se. Espere que fique Sincronizado.</div>` : `<p>Para voltar a entrar precisa do seu email e palavra-passe.</p>`,
    opcoes: [{ k: "sim", l: "Sim, sair", estilo: "warn" }, { k: "nao", l: "Cancelar" }],
  });
  if (k === "sim") store.logout();
}

/* ============================================================ render principal */
let lastView = "";
function render() {
  const app = $("#app");
  if (!location.hash.startsWith("#relvist")) document.title = "Controlo de Obra ALTIS";
  if (store.needsLogin()) { app.innerHTML = loginHTML(); bindLogin(); lastView = "login"; return; }
  if (store.user.papel === "sem_acesso") {
    app.innerHTML = `<div class="login"><div class="login-box"><h2>Conta sem acesso</h2><p>A conta <b>${esc(store.user.email)}</b> entrou, mas ainda não tem perfil nesta obra. Peça ao dono de obra para o adicionar em Equipa.</p><button class="btn" id="sair">Sair</button></div></div>`;
    $("#sair").onclick = () => store.logout();
    return;
  }
  if (store.admin && !store.user.papel) {
    app.innerHTML = `<div class="login"><div class="login-box">
      <div class="brand"><div class="brand-mark">AL</div><div><b>Olá, ${esc(store.user.nome)}</b><span>Administrador</span></div></div>
      <p>Escolha como quer ver a aplicação. Vê exatamente os ecrãs e os botões que esse perfil vê. Pode mudar de vista a qualquer momento, em "Ver como".</p>
      <div class="roles">${VISTAS.map(([k, l, d]) => `<button data-vista="${k}"><b>${l}</b><span>${d}</span></button>`).join("")}</div>
      <button class="btn ghost sm" id="sair">Sair</button></div></div>`;
    app.querySelectorAll("[data-vista]").forEach((b) => (b.onclick = () => mudarVista(b.dataset.vista)));
    $("#sair").onclick = () => store.logout();
    lastView = "vista";
    return;
  }
  lerFiltros();
  const view = routeView();
  guardarFiltros();
  const nav = navItems();
  const scrollY = window.scrollY;
  const same = lastView === location.hash;
  app.innerHTML = `
  <div class="shell">
    <aside class="side">
      ${brandHTML()}
      ${pesquisaHTML("psqD")}
      <nav class="nav">${nav.map((n) => `<a href="#${n.id}" class="${view.nav === n.id ? "on" : ""}">${ICON[n.id]}<span>${n.label}</span></a>`).join("")}</nav>
      <div class="side-foot">
        <div id="syncA"></div>
        <div class="who"><b>${esc(store.user.nome)}</b><span class="role">${store.admin ? "Administrador" : PAPEL[store.user.papel]}</span></div>
        ${store.admin ? vistaSelHTML("vistaD") : ""}
        <button class="btn sm" data-ajuda>Ajuda e versão</button>
        <button class="btn sm ${filtrosAlterados() ? "repor-on" : ""}" data-repor title="Voltar todos os ecrãs aos filtros padrão">Limpar filtros</button>
        <button class="btn sm" data-sair>Sair</button>
        <span class="note versao" title="Versão da aplicação">Versão ${VERSAO}</span>
      </div>
    </aside>
    ${store.admin ? `<div class="vista-band">A ver como <b>${PAPEL[store.user.papel]}</b>${vistaSelHTML("vistaM")}</div>` : ""}
    <header class="topbar">${brandHTML(true)}<div class="row" style="gap:4px"><div id="syncB"></div><button class="btn sm repor-on" data-repor data-repor-top title="Há filtros ativos: limpar" ${filtrosAlterados() ? "" : "hidden"}>Limpar filtros</button><button class="btn sm ghost" data-psqm aria-label="Procurar" title="Procurar">${ICON.lupa}</button><button class="btn sm ghost" data-ajuda aria-label="Ajuda" title="Ajuda">?</button><button class="btn sm ghost" data-sair>Sair</button></div></header>
    <main class="main"><div class="main-in" id="view">${view.html}</div></main>
    <nav class="tabbar">${nav.filter((n) => !n.soLado).map((n) => `<a href="#${n.id}" class="${view.nav === n.id ? "on" : ""}">${ICON[n.id]}<span>${n.short || n.label}</span></a>`).join("")}${nav.some((n) => n.soLado) ? `<button type="button" class="tb-mais ${nav.some((n) => n.soLado && view.nav === n.id) ? "on" : ""}" data-mais aria-haspopup="menu" aria-expanded="false">${ICON.mais}<span>Mais</span></button>` : ""}</nav>
    ${nav.some((n) => n.soLado) ? `<div class="mais-m" hidden role="menu" data-maism>${nav.filter((n) => n.soLado).map((n) => `<a href="#${n.id}" role="menuitem" class="${view.nav === n.id ? "on" : ""}">${ICON[n.id]}<span>${n.label}</span></a>`).join("")}</div>` : ""}
  </div>`;
  app.querySelectorAll("[data-sair]").forEach((b) => (b.onclick = sairConfirmar));
  const bm = app.querySelector("[data-mais]"), mm = app.querySelector("[data-maism]");
  if (bm && mm) {
    bm.onclick = (e) => { e.stopPropagation(); mm.hidden = !mm.hidden; bm.setAttribute("aria-expanded", String(!mm.hidden)); };
    mm.querySelectorAll("a").forEach((a) => (a.onclick = () => { mm.hidden = true; }));
  }
  ["#vistaD", "#vistaM"].forEach((id) => { const sl = $(id); if (sl) sl.onchange = () => mudarVista(sl.value); });
  app.querySelectorAll("[data-repor]").forEach((b) => (b.onclick = reporFiltros));
  app.querySelectorAll("[data-ajuda]").forEach((b) => (b.onclick = abrirAjuda));
  const pd = $("#psqD"); if (pd && S) ligarPesquisa(pd);
  app.querySelectorAll("[data-psqm]").forEach((b) => (b.onclick = abrirPesquisaMovel));
  renderSync();
  ajudaEcra();
  view.bind && view.bind();
  if (S) abrirGuia(false);
  if (ui.sheet) {
    const ae = document.activeElement;
    const busy = ae && ae.closest && ae.closest(".sheet") && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
    if (!busy) renderSheet();
  }
  if (same) window.scrollTo(0, scrollY);
  lastView = location.hash;
}
function renderSync() {
  const s = store.sync;
  const cls = store.modo === "demo" ? "demo" : !s.online ? "off" : s.pendentes ? "pend" : "";
  const txt = store.modo === "demo" ? "Demonstração: dados só neste dispositivo" : s.texto;
  const curto = store.modo === "demo" ? "Demonstração" : !s.online ? "Sem rede" : s.pendentes ? "A enviar" : "Sincronizado";
  const a = $("#syncA"), b = $("#syncB");
  if (a) a.innerHTML = `<span class="sync ${cls}"><i></i>${esc(txt)}</span>`;
  if (b) b.innerHTML = `<span class="sync ${cls}" title="${esc(txt)}"><i></i><span class="sync-t">${esc(curto)}</span></span>`;
}
function brandHTML(compact) {
  const nome = (S && S.cfg.nome) || "Obra";
  return `<div class="brand"><div class="brand-mark">${esc(nome.slice(0, 2).toUpperCase())}</div>${compact ? `<b>${esc(nome)}</b>` : `<div><b>${esc(nome)}</b><span>Controlo de obra</span></div>`}</div>`;
}
function navItems() {
  const p = store.user.papel;
  const items = [
    { id: "painel", label: "Painel" },
    { id: "unidades", label: "Apartamentos", short: "Apartamentos" },
    { id: "plano", label: "Trabalhos", short: "Trabalhos" },
    { id: "regras", label: "Definições", short: "Definições" },
    { id: "gantt", label: "Gantt", short: "Gantt" },
  ];
  const vist = { id: "vistorias", label: "Relatórios de vistoria", short: "Relatórios" };
  const pend = { id: "pendentes", label: "Pendentes", short: "Pendentes" };
  const prev = { id: "previsao", label: "Fim da obra", short: "Fim" };
  if (p === "empreiteiro") return [{ id: "semana", label: "A minha semana", short: "Semana" }, pend, items[2], items[4], items[1], { ...items[0], soLado: true }, { ...prev, soLado: true }, { ...vist, soLado: true }, { ...items[3], soLado: true }];
  if (p === "fiscal") return [items[1], pend, vist, items[0], items[2], { ...prev, soLado: true }, { ...items[4], soLado: true }];
  return [items[0], prev, items[1], items[2], { ...pend, soLado: true }, { ...items[4], soLado: true }, { ...vist, soLado: true }, items[3]];
}
function routeView() {
  let h = location.hash.replace("#", "");
  if (!S) return { nav: "", html: semConfigHTML(), bind: bindSemConfig };
  if (!h) h = navItems()[0].id;
  if (h.startsWith("u-")) {
    const uid = h.slice(2);
    if (ui.lastUnit !== uid) { ui.lastUnit = uid; ui.unidadeTab = store.user.papel === "fiscal" ? "vist" : "ativ"; }
    return { nav: "unidades", ...unidadeView(uid) };
  }
  if (h === "equipa" && store.user.papel !== "dono") h = "painel";
  if (h === "equipas" && !can("executar")) h = "painel";
  const v = { pendentes: pendentesView, painel: painelView, unidades: unidadesView, plano: planoView, regras: regrasView, equipa: equipaView, equipas: equipasView, gantt: ganttView, semana: semanaView, relatorio: relatorioView, vistorias: vistoriasView, relvist: relVistView, previsao: previsaoView, planequipa: planEquipaView }[h] || painelView;
  if (h === "planequipa" && !can("executar")) h = "painel";
  const navDe = { equipa: "regras", equipas: "regras", planequipa: "regras", relatorio: "painel", relvist: "vistorias" };
  return { nav: navDe[h] || (h in { painel: 1, unidades: 1, plano: 1, regras: 1, gantt: 1, semana: 1, vistorias: 1, previsao: 1, pendentes: 1 } ? h : "painel"), ...v() };
}

/* ============================================================ login */
function loginHTML() {
  const nome = "ALTIS";
  if (store.modo === "demo") {
    return `<div class="login"><div class="login-box">
      <div class="brand"><div class="brand-mark">${nome.slice(0, 2)}</div><div><b>Controlo de obra ${nome}</b><span>Versão de demonstração</span></div></div>
      <p>Esta versão usa os dados reais do cronograma, mas guarda as alterações só neste dispositivo. Escolha um perfil para experimentar:</p>
      <div class="roles">
        <button data-p="admin"><b>Administrador</b><span>Escolhe a vista: dono de obra, empreiteiro ou fiscal, para ver o que cada um pode fazer</span></button>
        <button data-p="dono"><b>Dono de obra</b><span>Ponto de situação, mapa dos apartamentos, sequência e equipa</span></button>
        <button data-p="empreiteiro"><b>Empreiteiro</b><span>Trabalhos, iniciar e concluir, reportar atrasos</span></button>
        <button data-p="fiscal"><b>Fiscal</b><span>Vistoria apartamento a apartamento, com percentagem e fotografias</span></button>
      </div>
    </div></div>`;
  }
  return `<div class="login"><form class="login-box" id="lf">
    <div class="brand"><div class="brand-mark">${nome.slice(0, 2)}</div><div><b>Controlo de obra ${nome}</b><span>Entre com a sua conta</span></div></div>
    <label class="f">Email<input class="inp" id="le" type="email" autocomplete="username" required></label>
    <label class="f">Palavra-passe<input class="inp" id="lp" type="password" autocomplete="current-password" required></label>
    <div class="err" id="lerr"></div>
    <button class="btn pri" type="submit">Entrar</button>
    <button class="btn ghost sm" type="button" id="lreset">Esqueci-me da palavra-passe</button>
  </form></div>`;
}
function bindLogin() {
  if (store.modo === "demo") {
    document.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { location.hash = ""; store.loginDemo(b.dataset.p); }));
    return;
  }
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    $("#lerr").textContent = "";
    try { await store.login($("#le").value, $("#lp").value); location.hash = ""; }
    catch (err) { $("#lerr").textContent = err.code === "auth/network-request-failed" ? "Sem rede. O primeiro acesso precisa de internet." : "Email ou palavra-passe errados."; }
  };
  $("#lreset").onclick = async () => {
    const em = $("#le").value;
    if (!em) { $("#lerr").textContent = "Escreva primeiro o seu email."; return; }
    try { await store.resetSenha(em); $("#lerr").textContent = "Enviámos um email para definir nova palavra-passe."; } catch (e) { $("#lerr").textContent = "Não foi possível enviar o email."; }
  };
}
function semConfigHTML() {
  const dono = store.user.papel === "dono";
  return `<div class="card" style="max-width:640px">
    <h1>A obra ainda não tem dados</h1>
    ${dono ? `<p>Importe o cronograma (${store.seed ? store.seed.atividades.length : 0} atividades, ${store.seed ? store.seed.unidades.length : 0} frações e zonas). Só é preciso fazer isto uma vez.</p>
      <div class="row"><button class="btn pri" id="imp">Importar cronograma</button><span class="note" id="impst"></span></div>`
      : `<p>O dono de obra ainda não importou o cronograma. Volte a abrir a aplicação mais tarde.</p>`}
  </div>`;
}
function bindSemConfig() {
  const b = $("#imp");
  if (!b) return;
  b.onclick = async () => {
    b.disabled = true;
    await importarComProgresso(false, () => { b.disabled = false; });
  };
}

/** Importa (ou completa) o cronograma, com uma barra fixa que não depende do ecrã aberto. */
let importando = false;
async function importarComProgresso(soFaltam, aoFalhar) {
  if (importando) return;
  importando = true;
  document.querySelectorAll(".impbar").forEach((x) => x.remove());
  const bar = document.createElement("div");
  bar.className = "impbar"; bar.setAttribute("role", "status");
  bar.innerHTML = `<b>A importar o cronograma...</b> <span class="num">0</span><span class="note">Não feche esta página até terminar.</span>`;
  document.body.appendChild(bar);
  const num = bar.querySelector(".num");
  try {
    const n = await store.importSeed((i, t) => (num.textContent = `${i} de ${t}`), { soFaltam });
    bar.remove();
    toast(soFaltam ? `Importação completa: acrescentados ${n} trabalhos` : "Cronograma importado");
  } catch (e) {
    bar.innerHTML = `<b>A importação parou:</b> ${esc(erroSimples(e))}. O que já entrou fica guardado e pode completar depois. <button class="btn sm" id="impFecha">Fechar</button>`;
    bar.querySelector("#impFecha").onclick = () => bar.remove();
    if (aoFalhar) aoFalhar();
  } finally { importando = false; render(); }
}

/* ============================================================ pendentes
   Pontos por resolver numa fração ou numa atividade (ex.: falta silicone numa janela). Todos criam.
   O dono e o fiscal fecham qualquer um; o empreiteiro marca como resolvido e o fiscal verifica.
   Fica sempre à vista se o fiscal já confirmou. Não mexem nas datas. */
const pendTodos = () => Object.values((store.data && store.data.pendentes) || {});
const pendDe = (unidade, ativ) => pendTodos().filter((x) => x.unidade === unidade && (ativ === undefined || x.ativ === ativ));
/** Ainda precisa de alguma coisa: por resolver, à espera do fiscal, ou fechado sem o ok do fiscal. */
const pendVivo = (x) => x.estado !== "fechado" || !x.fiscalOk;
const pendAberto = (x) => x.estado !== "fechado";
function pendEstado(x) {
  if (x.estado === "aberto") return { k: "por", l: "Por resolver" };
  if (x.estado === "feito") return { k: "esp", l: "Resolvido pelo empreiteiro, por verificar" };
  return x.fiscalOk ? { k: "ok", l: "Fechado e confirmado pelo fiscal" } : { k: "semok", l: "Fechado, sem confirmação do fiscal" };
}
const QUEM = { dono: "Dono de obra", empreiteiro: "Empreiteiro", fiscal: "Fiscal", admin: "Administrador" };
function pendPode(x, acao) {
  const p = store.user.papel, eu = store.user.email;
  switch (acao) {
    case "feito": return x.estado === "aberto" && p === "empreiteiro";
    case "fechar": return x.estado !== "fechado" && (p === "dono" || p === "fiscal");
    case "confirmar": return p === "fiscal" && x.estado === "fechado" && !x.fiscalOk;
    case "reabrir": return x.estado !== "aberto" && (p === "dono" || p === "fiscal" || (x.criadoPor === eu && !x.fiscalOk));
    case "apagar": return p === "dono" || (x.criadoPor === eu && x.estado === "aberto");
    default: return false;
  }
}
/** Pede um texto curto (nota) numa caixa. Devolve o texto, "" sem texto, ou null se cancelar. */
function pedirTexto({ titulo, texto, placeholder = "", sim = "Guardar", obrigatorio = false, valor = "" }) {
  return new Promise((resolve) => {
    document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove());
    document.body.insertAdjacentHTML("beforeend", `<div class="scrim dlg-s" data-dw="dlg"></div>
      <div class="dlg" data-dw="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">${titulo}</h2><div class="dlg-t">${texto || ""}
      <textarea class="inp" id="dlgTxt" rows="3" placeholder="${esc(placeholder)}">${esc(valor)}</textarea></div>
      <div class="dlg-b"><button class="btn pri" data-dlg="sim">${sim}</button><button class="btn" data-dlg="nao">Cancelar</button></div></div>`);
    const ta = document.querySelector("#dlgTxt"), bs = document.querySelector('.dlg [data-dlg="sim"]');
    const atual = () => { bs.disabled = obrigatorio && !ta.value.trim(); };
    ta.oninput = atual; atual();
    const fim = (v) => { document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove()); resolve(v); };
    document.querySelectorAll(".dlg [data-dlg]").forEach((b) => (b.onclick = () => fim(b.dataset.dlg === "sim" ? ta.value.trim() : null)));
    document.querySelector(".dlg-s").onclick = () => fim(null);
    ta.onkeydown = (e) => { if (e.key === "Escape") fim(null); };
    ta.focus();
  });
}
const pendPasso = (acao, nota) => ({ em: new Date().toISOString(), por: store.user.email, nome: store.user.nome, papel: store.user.papel, acao, ...(nota ? { nota } : {}) });
/** O que o fiscal faz num pendente conta como vistoria: fica no registo de vistorias e aparece no relatório desse dia. */
/** Registos de pendentes de um pendente que entretanto foi apagado deixam de contar. */
const pendRegVivo = (r) => !r.pend || !r.pid || !!((store.data && store.data.pendentes) || {})[r.pid];
const pendReg = (texto) => (store.user.papel === "fiscal" ? { tipo: "vistoria", pend: true, texto } : { tipo: "pendente", texto });
const PEND_ACAO = { criado: "criou", feito: "marcou como resolvido", fechado: "fechou", confirmado: "confirmou (fiscal)", reaberto: "reabriu", editado: "editou" };
async function pendCriar(unidade, ativ, texto) {
  texto = String(texto || "").trim();
  if (!texto) { toast("Escreva o que está pendente.", { anular: false }); return false; }
  const a = ativ ? S.acts[ativ] : null;
  const doc = { unidade, ativ: ativ || null, texto, estado: "aberto", fiscalOk: false, criadoPor: store.user.email, criadoNome: store.user.nome,
    criadoPapel: store.user.papel, criadoEm: new Date().toISOString(), historico: [pendPasso("criado")] };
  await store.addPendente(doc, pendReg(`${unidade}${a ? ", " + nomeAtiv(a) : ""}: novo pendente "${texto}"`));
  toast("Pendente registado", { anular: false });
  return true;
}
async function pendAcao(id, acao) {
  const x = (store.data.pendentes || {})[id]; if (!x || !pendPode(x, acao)) return;
  const fiscal = store.user.papel === "fiscal";
  let nota = "";
  if (acao === "apagar") {
    const k = await perguntar({ titulo: "Apagar este pendente?", texto: `<p>"${esc(x.texto)}" desaparece para todos. Use só para pendentes criados por engano. Se já foi resolvido, feche-o.</p>`, opcoes: [{ k: "sim", l: "Sim, apagar", estilo: "warn" }, { k: "nao", l: "Cancelar" }] });
    if (k !== "sim") return;
    await store.removePendente(id, { tipo: "pendente", texto: `${x.unidade}: apagou o pendente "${x.texto}"` });
    toast("Pendente apagado", { anular: false });
    return;
  }
  if (acao === "reabrir") {
    nota = await pedirTexto({ titulo: "Reabrir o pendente", texto: `<p>"${esc(x.texto)}" volta a Por resolver. Diga o que ainda falta.</p>`, placeholder: "Ex.: o silicone ficou mal acabado no canto", sim: "Reabrir", obrigatorio: true });
    if (nota == null) return;
  } else if (acao === "feito" || acao === "fechar") {
    nota = await pedirTexto({ titulo: acao === "feito" ? "Já está resolvido?" : fiscal ? "Está concluído?" : "Fechar o pendente",
      texto: `<p>"${esc(x.texto)}"</p><p class="note">${acao === "feito" ? "Fica como resolvido pelo empreiteiro, à espera de o fiscal verificar. " : fiscal ? "Fica fechado e confirmado pelo fiscal. " : x.fiscalOk ? "" : "Fica fechado, e marcado como ainda sem confirmação do fiscal. "}Nota opcional:</p>`,
      placeholder: "Ex.: silicone aplicado a 8 nov", sim: acao === "feito" ? "Sim, está resolvido" : fiscal ? "Sim, está concluído" : "Fechar" });
    if (nota == null) return;
  }
  const agora = new Date().toISOString(), eu = store.user.email;
  const passo = pendPasso(acao === "feito" ? "feito" : acao === "fechar" ? (fiscal ? "confirmado" : "fechado") : acao === "confirmar" ? "confirmado" : "reaberto", nota);
  const patch = { historico: [...(x.historico || []), passo], ultimaNota: nota || x.ultimaNota || "" };
  if (acao === "feito") Object.assign(patch, { estado: "feito", feitoEm: agora, feitoPor: eu, feitoNome: store.user.nome });
  if (acao === "fechar") Object.assign(patch, { estado: "fechado", fechadoEm: agora, fechadoPor: eu, fechadoNome: store.user.nome, fechadoPapel: store.user.papel });
  if ((acao === "fechar" && fiscal) || acao === "confirmar") Object.assign(patch, { fiscalOk: true, fiscalOkEm: agora, fiscalOkPor: eu, fiscalOkNome: store.user.nome });
  if (acao === "confirmar" && x.estado !== "fechado") Object.assign(patch, { estado: "fechado", fechadoEm: agora, fechadoPor: eu, fechadoNome: store.user.nome, fechadoPapel: "fiscal" });
  if (acao === "reabrir") Object.assign(patch, { estado: "aberto", fiscalOk: false, ultimaNota: nota });
  await store.updatePendente(id, patch, pendReg(`${x.unidade}: ${PEND_ACAO[passo.acao]} o pendente "${x.texto}"${nota ? ` (${nota})` : ""}`));
  toast({ feito: "Marcado como resolvido: o fiscal vai verificar", fechar: fiscal ? "Pendente confirmado e fechado" : "Pendente fechado", confirmar: "Confirmado pelo fiscal", reabrir: "Pendente reaberto" }[acao], { anular: false });
}
function pendItemHTML(x, { mostrarAtiv = true } = {}) {
  const e = pendEstado(x), a = x.ativ ? S.acts[x.ativ] : null;
  const quem = (nome, papel) => `${esc(nome || "")}${papel && String(nome || "").toLowerCase() !== (QUEM[papel] || papel).toLowerCase() ? ` (${esc((QUEM[papel] || papel).toLowerCase())})` : ""}`;
  const linhas = [`Criado por ${quem(x.criadoNome, x.criadoPapel)} a ${fd(diaLocal(x.criadoEm))}`];
  if (x.estado !== "aberto" && x.feitoEm) linhas.push(`feito por ${esc(x.feitoNome || "")} a ${fd(diaLocal(x.feitoEm))}`);
  if (x.estado === "fechado" && x.fechadoEm) linhas.push(`fechado por ${quem(x.fechadoNome, x.fechadoPapel)} a ${fd(diaLocal(x.fechadoEm))}`);
  const fok = x.fiscalOk ? `<span class="pd-fok sim">Fiscal confirmou${x.fiscalOkEm ? " a " + fd(diaLocal(x.fiscalOkEm)) : ""}</span>` : `<span class="pd-fok nao">Ainda sem ok do fiscal</span>`;
  const bt = (k, l, cls = "") => pendPode(x, k) ? `<button class="btn sm ${cls}" data-pd="${k}|${x.id}">${l}</button>` : "";
  const fiscal = store.user.papel === "fiscal";
  const h = x.historico || [];
  return `<div class="pd-i pd-${e.k}">
    <div class="pd-t"><div class="pd-l1"><span class="pd-e">${e.l}</span>${mostrarAtiv ? (a ? `<button class="lnk-b chip-u" data-a="${a.id}">${esc(nomeAtiv(a))}</button>` : `<span class="chip-u">Fração em geral</span>`) : ""}</div>
      <b class="pd-txt">${esc(x.texto)}</b>
      ${x.ultimaNota ? `<span class="pd-nota">Última nota: ${esc(x.ultimaNota)}</span>` : ""}
      <small>${linhas.join(", ")}.${x.estado !== "aberto" ? " " + fok : ""}</small></div>
    <div class="pd-b">${bt("feito", "Já está resolvido", "ok")}${bt("fechar", fiscal ? "Concluído?" : "Fechar", "ok")}${bt("confirmar", "Dar o ok de fiscal", "ok")}${bt("reabrir", fiscal && x.estado !== "aberto" ? "Ainda não está" : "Reabrir")}${bt("apagar", "Apagar", "ghost")}</div>
    ${h.length > 1 ? `<details class="pd-h"><summary>Histórico (${h.length})</summary><ul>${h.map((p) => `<li><span class="num">${fdt(p.em)}</span> ${esc(p.nome || p.por)} ${PEND_ACAO[p.acao] || p.acao}${p.nota ? `: <i>${esc(p.nota)}</i>` : ""}</li>`).join("")}</ul></details>` : ""}
  </div>`;
}
/** Estado do pendente num dado momento (ISO), refeito a partir do histórico. Serve para os relatórios antigos não mudarem. */
function pendEstadoEm(x, limite) {
  let estado = "aberto", fiscalOk = false;
  for (const p of x.historico || []) {
    if ((p.em || "") >= limite) break;
    if (p.acao === "feito") estado = "feito";
    else if (p.acao === "fechado") estado = "fechado";
    else if (p.acao === "confirmado") { estado = "fechado"; fiscalOk = true; }
    else if (p.acao === "reaberto") { estado = "aberto"; fiscalOk = false; }
  }
  return { estado, fiscalOk };
}
/** Formulário para criar um pendente numa fração (com escolha de atividade) ou numa atividade fixa. */
function pendFormHTML(unidade, ativFixa) {
  const k = unidade + "|" + (ativFixa || "");
  ui.pdDraft = ui.pdDraft || {};
  const d = ui.pdDraft[k] || { t: "", a: "" };
  const u = S.uMap[unidade];
  const ops = !ativFixa && u ? u.acts.filter((a) => S.res.get(a.id).estado !== "concluida" || d.a === a.id).concat(u.acts.filter((a) => S.res.get(a.id).estado === "concluida" && d.a !== a.id)) : [];
  return `<div class="pd-novo" data-pdform="${esc(k)}">
    <label class="f pd-f1">Novo pendente<input class="inp" data-pdtxt value="${esc(d.t)}" placeholder="Ex.: falta silicone na janela do quarto 2" maxlength="300"></label>
    ${ativFixa ? "" : `<label class="f">Em que atividade<select class="inp" data-pdativ><option value="">Fração em geral</option>${ops.map((a) => `<option value="${a.id}" ${d.a === a.id ? "selected" : ""}>${esc(nomeAtiv(a))}${S.res.get(a.id).estado === "concluida" ? " (concluída)" : ""}</option>`).join("")}</select></label>`}
    <button class="btn pri" data-pdadd>Adicionar pendente</button></div>`;
}
function pendListaHTML(lista, opts = {}) {
  const ord = (xs) => xs.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  const por = ord(lista.filter((x) => x.estado === "aberto")), esp = ord(lista.filter((x) => x.estado === "feito"));
  const semok = ord(lista.filter((x) => x.estado === "fechado" && !x.fiscalOk)), ok = ord(lista.filter((x) => x.estado === "fechado" && x.fiscalOk));
  const g = (t, xs, vazio) => xs.length ? `<h3 class="pd-g">${t} <span class="note num">${xs.length}</span></h3>${xs.map((x) => pendItemHTML(x, opts)).join("")}` : vazio || "";
  if (!lista.length) return `<div class="empty">${opts.vazio || "Sem pendentes. Quando alguém registar um ponto por resolver, aparece aqui."}</div>`;
  const gEsp = g("Resolvidos pelo empreiteiro, por verificar", esp), gPor = g("Por resolver", por);
  return `${opts.resolvidosPrimeiro ? gEsp + gPor : gPor + gEsp}${g("Fechados sem confirmação do fiscal", semok)}
    ${ok.length && !opts.semFechados ? `<details class="pd-fech"><summary>Fechados e confirmados pelo fiscal <span class="note num">${ok.length}</span></summary>${ok.slice(0, 40).map((x) => pendItemHTML(x, opts)).join("")}</details>` : ""}`;
}
function bindPendentes(root) {
  if (!root) return;
  root.querySelectorAll("[data-pd]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [acao, id] = b.dataset.pd.split("|"); pendAcao(id, acao); }));
  root.querySelectorAll("[data-pdform]").forEach((f) => {
    const k = f.dataset.pdform, [unidade, ativFixa] = k.split("|");
    ui.pdDraft = ui.pdDraft || {};
    const d = (ui.pdDraft[k] = ui.pdDraft[k] || { t: "", a: "" });
    const t = f.querySelector("[data-pdtxt]"), sel = f.querySelector("[data-pdativ]"), add = f.querySelector("[data-pdadd]");
    t.oninput = () => (d.t = t.value);
    if (sel) sel.onchange = () => (d.a = sel.value);
    const vai = async () => { if (await pendCriar(unidade, ativFixa || (sel && sel.value) || null, t.value)) { ui.pdDraft[k] = { t: "", a: d.a }; t.value = ""; render(); } };
    add.onclick = vai;
    t.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); vai(); } };
  });
}
/* ============================================================ ecrã Pendentes (todos os pendentes da obra) */
function pendentesView() {
  const st = (ui.pendF = ui.pendF || { e: store.user.papel === "empreiteiro" ? "por" : "abertos", bloco: "", q: "" });
  const todos = pendTodos().filter((x) => S.uMap[x.unidade] && !S.idsTeste.has(x.unidade));
  const EST = [["abertos", "Por fechar", (x) => x.estado !== "fechado"], ["por", "Por resolver", (x) => x.estado === "aberto"], ["esp", "Resolvidos, por verificar", (x) => x.estado === "feito"],
    ["semok", "Fechados sem ok do fiscal", (x) => x.estado === "fechado" && !x.fiscalOk], ["fech", "Fechados", (x) => x.estado === "fechado"], ["todos", "Todos", () => true]];
  const fE = (EST.find(([k]) => k === st.e) || EST[0])[2];
  const q = st.q.trim().toLowerCase();
  const lista = todos.filter((x) => fE(x) && (!st.bloco || S.uMap[x.unidade].bloco === st.bloco)
    && (!q || [x.texto, x.unidade, x.ativ && S.acts[x.ativ] ? nomeAtiv(S.acts[x.ativ]) : ""].join(" ").toLowerCase().includes(q)));
  const porU = new Map();
  for (const x of lista) (porU.get(x.unidade) || porU.set(x.unidade, []).get(x.unidade)).push(x);
  const us = ordenaUnidades([...porU.keys()].map((id) => S.uMap[id]));
  const n = (f) => todos.filter(f).length;
  const html = `
    <div class="card-h"><h1>Pendentes</h1><span class="note num">${n((x) => x.estado === "aberto")} por resolver · ${n((x) => x.estado === "feito")} resolvidos, por verificar</span></div>
    <div class="filters">
      <div class="chips rolar" role="group" aria-label="Estado">${EST.map(([k, l, f]) => `<button class="chip ${st.e === k ? "on" : ""}" data-pe="${k}">${l} <span class="num">${n(f)}</span></button>`).join("")}</div>
      <div class="chips rolar" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${st.bloco === b ? "on" : ""}" data-pbl="${b}">${b === "" ? "Todos os blocos" : b === "Geral" ? "Geral" : "Bloco " + b}</button>`).join("")}</div>
      <label class="f" style="max-width:420px">Procurar<input class="inp" id="pdq" value="${esc(st.q)}" placeholder="Texto, fração ou atividade"></label>
    </div>
    ${us.length ? us.map((u) => `<section class="pd-fr"><div class="card-h"><h2><a href="#u-${esc(u.id)}" data-irpend="${esc(u.id)}" class="mono">${esc(u.id)}</a> <span class="note">${esc(u.tipo)}${u.bloco !== "Geral" ? " · " + blocoLabel(u.bloco) : ""}</span></h2><span class="note num">${porU.get(u.id).length}</span></div>
      <div class="pd-lista">${porU.get(u.id).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || "")).map((x) => pendItemHTML(x)).join("")}</div></section>`).join("")
      : `<div class="empty">${todos.length ? `Nenhum pendente com estes filtros. ${st.e !== "abertos" || st.bloco || q ? `<button class="btn sm" id="pdclr">Limpar filtros</button>` : ""}` : "Ainda não há pendentes. Registe-os na página de cada fração, no separador Pendentes, ou na vistoria."}</div>`}`;
  return { html, bind: () => {
    bindCommon(); bindPendentes(document.querySelector("#view"));
    document.querySelectorAll("[data-pe]").forEach((b) => (b.onclick = () => { st.e = b.dataset.pe; render(); }));
    document.querySelectorAll("[data-pbl]").forEach((b) => (b.onclick = () => { st.bloco = b.dataset.pbl; render(); }));
    const qi = $("#pdq"); let t; if (qi) qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.q = qi.value; render(); const n2 = $("#pdq"); if (n2) { n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); } }, 300); };
    const c = $("#pdclr"); if (c) c.onclick = () => { ui.pendF = null; render(); };
  } };
}
/* ============================================================ precisa de atenção (painel e semana) */
/** Quantas atividades por concluir dependem desta, direta ou indiretamente. */
function nSeguintes(id) {
  const vistos = new Set([id]), fila = [id];
  let n = 0;
  while (fila.length) {
    const r = S.res.get(fila.shift());
    for (const sid of (r && r.succ) || []) {
      if (vistos.has(sid)) continue;
      vistos.add(sid);
      const rs = S.res.get(sid);
      if (rs && rs.estado !== "concluida") { n++; fila.push(sid); }
    }
  }
  return n;
}
function atencaoDados() {
  const vivas = actsObra().map((a) => ({ a, r: S.res.get(a.id) })).filter(({ r }) => r && r.estado !== "concluida");
  const comSeg = (xs) => xs.map((x) => ({ ...x, seg: nSeguintes(x.a.id) })).sort((x, y) => y.seg - x.seg || (y.r.atraso || 0) - (x.r.atraso || 0));
  // em curso com o fim previsto já passado: muitas vezes já acabaram e ninguém as concluiu
  const esquecidas = comSeg(vivas.filter(({ r }) => r.estado === "em_curso" && r.atrasada));
  // livres para começar (as anteriores já acabaram) e com o início previsto já passado
  const paradas = comSeg(vivas.filter(({ a, r }) => r.estado === "por_iniciar" && !a.realInicio && r.prevIni && r.prevIni < S.hoje));
  const limite = new Date(Date.now() - 7 * 86400000).toISOString();
  const semVist = S.unidades.filter((u) => u.n.em_curso > 0 && (!ultimaVistoria(u) || ultimaVistoria(u) < limite));
  const pends = pendTodos().filter((x) => !S.idsTeste.has(x.unidade) && S.uMap[x.unidade]);
  const porFr = (xs) => { const m = new Map(); for (const x of xs) m.set(x.unidade, (m.get(x.unidade) || 0) + 1); return ordenaUnidades([...m.keys()].map((id) => S.uMap[id])).map((u) => [u.id, m.get(u.id)]); };
  const pendPor = pends.filter((x) => x.estado === "aberto");
  const pendFiscal = pends.filter((x) => (x.estado === "feito" || x.estado === "fechado") && !x.fiscalOk);
  return { esquecidas, paradas, semVist, pendPor, pendFiscal, porFr };
}
function atencaoHTML({ max = 3, vist = true, fechavel = false } = {}) {
  const d = atencaoDados();
  const ex = can("executar");
  const linha = ({ a, r, seg }, tipo) => `<div class="at-l">
    <button class="lnk-b at-n" data-a="${a.id}"><span><b>${esc(nomeAtiv(a))}</b> <span class="mono">${esc(a.unidade)}</span></span>
      <small>${tipo === "fim" ? `devia ter acabado a ${fd(r.prevFim)}` : `podia ter começado a ${fd(r.prevIni)}`}${seg ? ` · atrasa ${seg} atividade${seg === 1 ? "" : "s"} seguinte${seg === 1 ? "" : "s"}` : ""}</small></button>
    <span class="at-b">${ex ? (tipo === "fim" ? `<button class="btn sm ok" data-at="fim|${a.id}">Concluí hoje</button>` : `<button class="btn sm pri" data-at="ini|${a.id}">Iniciei hoje</button>`) : ""}<button class="btn sm" data-a="${a.id}">Abrir</button></span>
  </div>`;
  const grupo = (titulo, sub, xs, tipo, f) => !xs.length ? "" : `<div class="at-g">
    <h3>${titulo} <span class="note num">${xs.length}</span></h3><p class="note">${sub}</p>
    ${xs.slice(0, max).map((x) => linha(x, tipo)).join("")}
    ${xs.length > max ? `<a class="note" href="#plano" data-atver="${f}">Ver as ${xs.length} nos Trabalhos</a>` : ""}</div>`;
  const frs = (lista) => `<div class="at-fr">${d.porFr(lista).slice(0, 16).map(([id, n]) => `<a class="mono chip-u" href="#u-${esc(id)}" data-irpend="${esc(id)}">${esc(id)}${n > 1 ? ` <b>${n}</b>` : ""}</a>`).join("")}</div>`;
  const papel = store.user.papel;
  const gPend = (d.pendPor.length && papel !== "fiscal" ? `<div class="at-g"><h3>Pendentes por resolver <span class="note num">${d.pendPor.length}</span></h3><p class="note">${papel === "empreiteiro" ? "Pontos registados nas frações. Quando estiverem resolvidos, carregue em Já está resolvido, aqui ou em Pendentes." : "Pontos registados nas frações, à espera do empreiteiro."}</p>${frs(d.pendPor)}</div>` : "")
    + (d.pendFiscal.length && papel !== "empreiteiro" ? `<div class="at-g"><h3>Pendentes resolvidos ou fechados, por verificar <span class="note num">${d.pendFiscal.length}</span></h3><p class="note">${papel === "fiscal" ? "O empreiteiro diz que estão resolvidos. Na próxima vistoria destas frações, veja se ficaram bem." : "Resolvidos pelo empreiteiro ou fechados, mas o fiscal ainda não verificou."}</p>${frs(d.pendFiscal)}</div>` : "");
  const corpo = gPend + grupo("Em curso, com o fim já passado", "Se já acabaram, conclua-as: as atividades seguintes avançam logo. As que atrasam mais atividades aparecem primeiro.", d.esquecidas, "fim", "em_curso")
    + grupo("Podiam já ter começado", "As anteriores já estão concluídas e a data de início já passou. Se já começaram, registe o início.", d.paradas, "ini", "proximas")
    + (vist && d.semVist.length ? `<div class="at-g"><h3>Frações em obra sem vistoria há mais de 7 dias <span class="note num">${d.semVist.length}</span></h3>
      <div class="at-fr">${d.semVist.slice(0, 12).map((u) => `<a class="mono chip-u" href="#u-${esc(u.id)}">${esc(u.id)}</a>`).join("")}${d.semVist.length > 12 ? `<a class="note" href="#unidades" data-atvist>ver todas</a>` : ""}</div></div>` : "");
  if (fechavel) {
    // em A minha semana fica fechado por defeito, para não empurrar as listas da semana
    if (!corpo) return "";
    const resumo = [d.pendPor.length ? `${d.pendPor.length} pendente${d.pendPor.length === 1 ? "" : "s"} por resolver` : "", d.esquecidas.length ? `${d.esquecidas.length} em curso com o fim já passado` : "", d.paradas.length ? `${d.paradas.length} podiam já ter começado` : ""].filter(Boolean).join(", ");
    return `<details class="card atencao" id="atencao" ${ui.atencaoAberta ? "open" : ""}><summary><b>Precisa de atenção</b> <span class="note">${resumo}</span></summary>${corpo}</details>`;
  }
  return `<section class="card atencao" id="atencao"><div class="card-h"><h2>Precisa de atenção</h2><span class="note">o que convém tratar primeiro</span></div>
    ${corpo || `<div class="empty">Nada urgente: não há pendentes, nem atividades esquecidas ou paradas.</div>`}</section>`;
}
function bindAtencao() {
  document.querySelectorAll("#atencao [data-irpend]").forEach((b) => (b.onclick = () => { ui.lastUnit = b.dataset.irpend; ui.unidadeTab = store.user.papel === "fiscal" ? "vist" : "pend"; }));
  const dt = document.querySelector("details#atencao"); if (dt) dt.ontoggle = () => { ui.atencaoAberta = dt.open; };
  document.querySelectorAll("[data-atver]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, PLANO_PADRAO(), { f: b.dataset.atver, soAtr: b.dataset.atver === "em_curso", _fToque: true }); }));
  document.querySelectorAll("[data-atvist]").forEach((b) => (b.onclick = () => { ui.porVist = true; ui.bloco = "todos"; }));
  document.querySelectorAll("[data-at]").forEach((b) => (b.onclick = async () => {
    const [acao, id] = b.dataset.at.split("|");
    b.disabled = true;
    if (acao === "fim") await concluirHoje(id);
    else await editarData(id, "realIni", S.hoje);
  }));
}
/* ============================================================ painel */
function painelView() {
  const t = S.tot;
  const blocos = {};
  for (const u of S.unidades) {
    const k = u.tipo === "Loja" ? "Lojas" : u.bloco;
    blocos[k] = blocos[k] || { dur: 0, feito: 0, fim: null, n: 0 };
    blocos[k].dur += u.dur; blocos[k].feito += u.feito; blocos[k].n += u.acts.length;
    if (!blocos[k].fim || (u.fim && u.fim > blocos[k].fim)) blocos[k].fim = u.fim;
  }
  const ordB = ["A", "B", "C", "D", "Lojas", "Geral"];
  const grupos = {};
  for (const a of actsObra()) {
    const r = S.res.get(a.id);
    if (r.estado === "concluida" || !(r.atraso > 0)) continue;
    const k = nomeAtiv(a);
    const g = (grupos[k] = grupos[k] || { nome: k, max: 0, soma: 0, itens: [] });
    g.itens.push({ a, r }); g.max = Math.max(g.max, r.atraso); g.soma += r.atraso;
  }
  const atrG = Object.values(grupos).sort((x, y) => y.max - x.max || y.itens.length - x.itens.length).slice(0, 8);
  for (const g of atrG) g.itens.sort((x, y) => y.r.atraso - x.r.atraso);
  const rec = store.recentes(12);
  const falta = !importando && store.user.papel === "dono" && store.faltamImportar ? store.faltamImportar() : 0;
  const corr = (store.user.papel === "dono" || store.admin) && !S.cfg.correcaoExpiradas ? expiradas().length : 0;
  const html = `
    ${corr ? `<div class="banner warn no-print"><span><b>Correção única:</b> ${corr} atividades por concluir têm o fim previsto já passado. Pode pôr todas com fim previsto a ${fd(DATA_CORR, true)}.</span><button class="btn sm pri" id="corrExp">Corrigir datas</button></div>` : ""}
    ${(() => { const m = datasEstranhas(); return m.length && (can("executar") || store.user.papel === "dono") ? `<div class="banner warn no-print"><span><b>${m.length} ${m.length === 1 ? "atividade tem" : "atividades têm"} uma data impossível</b> (por exemplo, do ano ${esc(m[0].ex.slice(0, 4))}), gravada por engano enquanto se escrevia a data à mão: ${m.slice(0, 4).map((x) => `${esc(nomeAtiv(x.a))} em ${esc(x.a.unidade)}`).join(", ")}${m.length > 4 ? "..." : ""}.</span><button class="btn sm pri" id="limparDatas">Apagar essas datas</button></div>` : ""; })()}
    ${store.semPendentes && (store.user.papel === "dono" || store.admin) ? `<div class="banner warn no-print"><span><b>Os pendentes ainda não funcionam:</b> falta publicar as regras novas do Firebase (Firestore, Regras). Veja o texto em firestore.rules.</span></div>` : ""}
    ${falta ? `<div class="banner warn no-print"><span><b>A importação do cronograma ficou a meio: faltam ${falta} de ${store.seed.atividades.length} trabalhos.</b> Os que já estão na aplicação não são alterados.</span><button class="btn sm pri" id="impFalta">Completar importação</button></div>` : ""}
    <div class="card-h no-print"><h1>Painel</h1><a class="btn" href="#relatorio">Relatório para reunião</a></div>
    <div class="headline">
      <div class="fim">
        <div class="eyebrow">Fim previsto da obra</div>
        <big class="num">${fd(t.fim, true)}</big>
        <div class="sub">${t.atrasada ? `${t.atrasada} atividades atrasadas.` : ""} Recalculado hoje com o estado real e a sequência.</div>
      </div>
      <div class="kpis">
        <a class="kpi k-ok" href="#plano" data-f="concluida"><b>${t.concluida}</b><span>Concluídas de ${t.n}</span></a>
        <a class="kpi k-curso" href="#plano" data-f="em_curso"><b>${t.em_curso}</b><span>Em curso</span></a>
        <a class="kpi k-crit" href="#plano" data-f="atrasada" title="Atrasada: a previsão de fim já passou e a atividade ainda não está concluída."><b>${t.atrasada}</b><span>Atrasadas <span class="qm" aria-hidden="true">?</span></span></a>
        <a class="kpi k-bloq" href="#plano" data-f="bloqueada"><b>${t.bloqueada}</b><span>Bloqueadas por outras</span></a>
      </div>
    </div>
    ${atencaoHTML()}
    <div class="grid2">
      <section class="card">
        <div class="card-h"><h2>Avanço por bloco</h2><span class="note">média ponderada pela duração</span></div>
        <div class="bars">${ordB.filter((k) => blocos[k]).map((k) => {
          const b = blocos[k]; const p = b.dur ? Math.round((100 * b.feito) / b.dur) : 0;
          return `<div class="bar-row"><b>${k.length === 1 ? "Bloco " + k : k}</b><div class="track"><i style="width:${p}%"></i></div><span class="num mono">${p}%</span><span class="bfim note num">fim ${fd(b.fim)}</span></div>`;
        }).join("")}</div>
      </section>
      <section class="card">
        <div class="card-h"><h2>Maiores atrasos</h2><a class="note" href="#plano" data-f="atrasada">ver todos</a></div>
        <p class="note" style="margin:0">Por especialidade, com o maior atraso de cada uma. Toque para ver a lista nos Trabalhos.</p>
        <div class="list">${atrG.length ? atrG.map((g) => `
          <a class="li li-g" href="#plano" data-atrg="${esc(g.nome)}"><span class="li-t">${esc(g.nome)}</span>${deltaHTML(g.max, `Maior atraso: ${g.max} dias. Atraso médio: ${Math.round(g.soma / g.itens.length)} dias.`)}
          <span class="li-s"><b>${g.itens.length} ${g.itens.length === 1 ? "fração" : "frações"}</b>${g.itens.slice(0, 5).map((x) => `<span class="mono chip-u">${esc(x.a.unidade)}</span>`).join("")}${g.itens.length > 5 ? `<span>+${g.itens.length - 5}</span>` : ""}</span></a>`).join("")
          : `<div class="empty">Sem atividades atrasadas.</div>`}</div>
      </section>
    </div>
    ${t.semPlano && can("executar") ? `<div class="banner warn"><span><b>${t.semPlano} atividades com datas por confirmar.</b> Não tinham data e a aplicação deu-lhes a primeira data possível, o que torna o fim previsto otimista.</span><a class="btn sm" href="#plano" data-f="porconfirmar">Rever datas</a></div>` : ""}
    <section class="card" id="semanaRes"><div class="card-h"><h2>Esta semana</h2><span class="note">últimos 7 dias</span></div><div class="note">A carregar...</div></section>
    ${heatHTML()}
    <section class="card">
      <div class="card-h"><h2>Últimas atualizações</h2></div>
      <div class="list">${rec.length ? rec.map((r) => `<div class="li"><span class="li-t">${esc(r.texto)}</span><span class="note num">${fdt(r.em)}</span>
        <span class="li-s"><span>${esc(r.nomePor || r.por)}</span><span class="role">${PAPEL[r.papel] || ""}</span>${r.unidade ? `<a class="mono" href="#u-${esc(r.unidade)}">${esc(r.unidade)}</a>` : ""}</span></div>`).join("")
        : `<div class="empty">Ainda não há registos. Quando o empreiteiro ou o fiscal atualizarem atividades, aparecem aqui.</div>`}</div>
    </section>`;
  return { html, bind: () => { bindCommon(); bindAtencao(); resumoSemana();
    const ld = $("#limparDatas"); if (ld) ld.onclick = limparDatasEstranhas; guardarFotoDiaria(); const bc = $("#corrExp"); if (bc) bc.onclick = corrigirExpiradas; const bf = $("#impFalta"); if (bf) bf.onclick = () => { bf.disabled = true; importarComProgresso(true, () => { bf.disabled = false; }); }; } };
}
/* ============================================================ fim da obra (previsão por bloco e por fração) */
const NOME_BLOCO = (k) => (k.length === 1 ? "Bloco " + k : k);
function estadoFr(u) {
  const t = u.acts.length;
  if (!t) return { k: "vazio", l: "Sem trabalhos" };
  if (u.n.concluida === t) return { k: "pronto", l: "Pronto" };
  if (u.n.concluida || u.n.em_curso) return { k: "curso", l: "Em curso" };
  return { k: "porcomecar", l: "Por começar" };
}
function infoFracao(u) {
  let plano = null, ini = null, ultima = null, falta = 0, fimReal = null;
  for (const a of u.acts) {
    const r = S.res.get(a.id);
    const pf = a.planFim || r.prevFim;
    if (pf && (!plano || pf > plano)) plano = pf;
    if (r.inicio && (!ini || r.inicio < ini)) ini = r.inicio;
    if (r.estado !== "concluida") { falta++; if (!ultima || r.provFim > S.res.get(ultima.id).provFim) ultima = a; }
    else if (r.fim && (!fimReal || r.fim > fimReal)) fimReal = r.fim;
  }
  const est = estadoFr(u);
  const fim = est.k === "pronto" ? fimReal || u.fim : u.fim;
  return { u, est, fim, plano, ini, ultima, falta, atraso: est.k === "pronto" ? null : u.atraso ?? 0 };
}
function previsaoView() {
  const ordB = ["A", "B", "C", "D", "Lojas", "Geral"];
  const pv = (ui.prev = ui.prev || { ord: "fim", tipo: "todos", abertos: new Set(["A"]) });
  const infos = S.unidades.map(infoFracao);
  const grupo = (i) => (i.u.tipo === "Loja" ? "Lojas" : i.u.bloco);
  const blocos = ordB.map((k) => {
    const lst = infos.filter((i) => grupo(i) === k);
    if (!lst.length) return null;
    let dur = 0, feito = 0, fim = null, plano = null, ini = null, ultima = null, atraso = null, nAtr = 0;
    for (const i of lst) {
      dur += i.u.dur; feito += i.u.feito;
      if (i.fim && (!fim || i.fim > fim)) fim = i.fim;
      if (i.plano && (!plano || i.plano > plano)) plano = i.plano;
      if (i.ini && (!ini || i.ini < ini)) ini = i.ini;
      if (i.atraso != null) atraso = Math.max(atraso ?? 0, i.atraso);
      nAtr += i.u.n.atrasada;
      if (i.ultima && (!ultima || S.res.get(i.ultima.id).provFim > S.res.get(ultima.id).provFim)) ultima = i.ultima;
    }
    const aps = lst.filter((i) => i.u.tipo === "Apartamento" || i.u.tipo === "Loja");
    return { k, lst, pct: dur ? Math.round((100 * feito) / dur) : 0, fim, plano, ini, ultima, atraso, nAtr,
      nAp: aps.length, prontos: aps.filter((i) => i.est.k === "pronto").length, emCurso: aps.filter((i) => i.est.k === "curso").length };
  }).filter(Boolean);
  const t = S.tot;
  let dur = 0, feito = 0, plano = null;
  for (const b of blocos) { if (b.plano && (!plano || b.plano > plano)) plano = b.plano; }
  for (const u of S.unidades) { dur += u.dur; feito += u.feito; }
  const pctObra = dur ? Math.round((100 * feito) / dur) : 0;
  const faltam = t.fim ? Math.max(0, diffDays(S.hoje, t.fim)) : null;
  const h = S.cfg.historico || [];
  const ref = (dias) => [...h].reverse().find((x) => x.d <= addDays(S.hoje, -dias)) || null;
  const tend = [[7, "semana passada"], [30, "há um mês"]].map(([d, l]) => { const r = ref(d); return r && r.fim ? { l, d: diffDays(r.fim, t.fim), era: r.fim } : null; }).filter(Boolean);
  const blocoFim = blocos.filter((b) => b.k !== "Geral").reduce((m, b) => (!m || (b.fim && b.fim > m.fim) ? b : m), null);
  // o que acaba por último na obra
  const ultimasObra = actsObra().filter((a) => S.res.get(a.id).estado !== "concluida").sort((x, y) => S.res.get(y.id).provFim.localeCompare(S.res.get(x.id).provFim)).slice(0, 5);
  // linha do tempo dos blocos
  let t0 = blocos.reduce((m, b) => (b.ini && (!m || b.ini < m) ? b.ini : m), null) || S.hoje;
  let t1 = blocos.reduce((m, b) => (b.fim && (!m || b.fim > m) ? b.fim : m), null) || S.hoje;
  if (S.hoje > t1) t1 = S.hoje;
  const span = Math.max(1, diffDays(t0, t1));
  const pos = (d) => Math.max(0, Math.min(100, (100 * diffDays(t0, d)) / span));
  const meses = []; { let d = t0.slice(0, 7) + "-01"; while (d <= t1) { if (d >= t0) meses.push(d); const [y, m] = d.split("-").map(Number); d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; } }
  const passoM = Math.max(1, Math.ceil(meses.length / 10));
  const atrHTML = (n) => (n == null ? "" : deltaHTML(n, n > 0 ? `Tem atividades com até ${n} dias de atraso` : "Sem atividades atrasadas"));
  // entregas por mês (apartamentos e lojas)
  const aps = infos.filter((i) => (i.u.tipo === "Apartamento" || i.u.tipo === "Loja") && i.fim);
  const porMes = {};
  for (const i of aps) { const m = i.fim.slice(0, 7); porMes[m] = (porMes[m] || 0) + 1; }
  const mesesE = Object.keys(porMes).sort();
  const maxM = Math.max(1, ...Object.values(porMes));
  let acum = 0;
  const hojeM = S.hoje.slice(0, 7);
  const nomeMes = (m) => { const [y, mm] = m.split("-"); return `${MESES[Number(mm) - 1]} ${y.slice(2)}`; };
  // tabela por bloco
  const ordena = (lst) => [...lst].sort(pv.ord === "fim" ? (a, b) => (a.fim || "9").localeCompare(b.fim || "9") || a.u.id.localeCompare(b.u.id, "pt", { numeric: true })
    : pv.ord === "desvio" ? (a, b) => (b.atraso ?? -999) - (a.atraso ?? -999) : pv.ord === "pct" ? (a, b) => a.u.pct - b.u.pct : () => 0);
  const filtraTipo = (i) => pv.tipo === "todos" || (pv.tipo === "ap" ? i.u.tipo === "Apartamento" || i.u.tipo === "Loja" : !(i.u.tipo === "Apartamento" || i.u.tipo === "Loja"));
  const linhaFr = (i) => `<a class="pv-fr" href="#u-${esc(i.u.id)}">
      <span class="pv-id"><b class="mono">${esc(i.u.tipo === "Apartamento" || i.u.tipo === "Loja" ? i.u.id : i.u.nome || i.u.id)}</b>${i.u.tipo && i.u.tipo !== "Apartamento" ? `<small>${esc(i.u.tipo)}</small>` : ""}</span>
      <span class="pv-est e-${i.est.k}">${i.est.l}</span>
      <span class="pv-pc"><span class="track"><i style="width:${i.u.pct}%"></i></span><span class="num mono">${i.u.pct}%</span></span>
      <span class="pv-f"><b class="num">${i.est.k === "pronto" ? "pronto a " : ""}${fd(i.fim, true)}</b>${atrHTML(i.atraso)}</span>
      <span class="pv-u">${i.est.k === "pronto" ? `<span class="note">tudo concluído</span>` : `<span class="note">falta${i.falta === 1 ? "" : "m"} <b>${i.falta}</b>${i.ultima ? ` · acaba com ${esc(nomeAtiv(i.ultima))}` : ""}</span>`}</span>
    </a>`;
  const html = `
    <div class="card-h"><h1>Fim da obra</h1><div class="row no-print"><button class="btn" id="pvPrint">Imprimir</button></div></div>
    <div class="pv-top">
      <div class="pv-big">
        <div class="eyebrow">A obra acaba, se tudo seguir como agora, a</div>
        <big class="num">${fd(t.fim, true)}</big>
        <div class="sub">${faltam != null ? `Faltam <b>${faltam} dias</b>, cerca de ${Math.round(faltam / 30.4)} meses. ` : ""}</div>
        ${tend.length ? `<div class="sub">${tend.map((x) => x.d > 0 ? `Desde ${x.l}, o fim atrasou <b class="mau-t">${x.d} dias</b>.` : x.d < 0 ? `Desde ${x.l}, o fim adiantou <b class="bom-t">${-x.d} dias</b>.` : `Desde ${x.l}, o fim não mudou.`).join(" ")}</div>` : ""}
      </div>
      <div class="pv-kp">
        <div class="pv-k"><b class="num">${pctObra}%</b><span>da obra feita</span><span class="track"><i style="width:${pctObra}%"></i></span></div>
        <div class="pv-k"><b class="num">${aps.filter((i) => i.est.k === "pronto").length}<small> de ${infos.filter((i) => i.u.tipo === "Apartamento" || i.u.tipo === "Loja").length}</small></b><span>apartamentos e lojas prontos</span></div>
        <div class="pv-k"><b class="num">${t.atrasada}</b><span>atividades atrasadas</span></div>
        ${blocoFim ? `<div class="pv-k"><b>${NOME_BLOCO(blocoFim.k)}</b><span>é o último a ficar pronto, a ${fd(blocoFim.fim, true)}</span></div>` : ""}
      </div>
    </div>

    <section class="card">
      <div class="card-h"><h2>Quando fica pronto cada bloco</h2><span class="note">barra: do primeiro trabalho ao fim provável · parte escura: o que já está feito</span></div>
      <div class="pv-tl">
        <div class="pv-row pv-ax"><span></span><div class="pv-tr">${meses.filter((_, j) => j % passoM === 0).map((m, j) => `<i style="left:${pos(m)}%"><em class="${j % 2 ? "imp" : ""}" ${Math.abs(pos(m) - pos(S.hoje)) < 9 ? "hidden" : ""}>${nomeMes(m.slice(0, 7))}</em></i>`).join("")}<u class="pv-hoje" style="left:${pos(S.hoje)}%"><em>hoje</em></u></div><span></span></div>
        ${blocos.map((b) => `<div class="pv-row"><b>${NOME_BLOCO(b.k)}</b><div class="pv-tr">
            ${meses.filter((_, j) => j % passoM === 0).map((m) => `<i style="left:${pos(m)}%"></i>`).join("")}
            <span class="pv-bar ${b.atraso > 0 ? "late" : ""}" style="left:${pos(b.ini || t0)}%;width:${Math.max(1, pos(b.fim || S.hoje) - pos(b.ini || t0))}%"><span class="pv-done" style="width:${b.pct}%"></span></span>
            <u class="pv-hoje" style="left:${pos(S.hoje)}%"></u>
          </div><span class="pv-fimb num"><b>${fd(b.fim, true)}</b>${atrHTML(b.atraso)}</span></div>`).join("")}
      </div>
      <div class="pv-bl">${blocos.map((b) => `<div class="pv-bc">
          <div class="pv-bch"><b>${NOME_BLOCO(b.k)}</b><span class="num mono">${b.pct}%</span></div>
          <div class="track"><i style="width:${b.pct}%"></i></div>
          <div class="ln"><span>Fica pronto a</span><span><b class="num">${fd(b.fim, true)}</b></span></div>
          <div class="ln"><span>Atrasos</span><span class="num">${b.nAtr ? `<b>${b.nAtr}</b> ${b.nAtr === 1 ? "atividade atrasada" : "atividades atrasadas"} ${atrHTML(b.atraso)}` : "nenhum"}</span></div>
          ${b.nAp ? `<div class="ln"><span>${b.k === "Lojas" ? "Lojas" : "Apartamentos"}</span><span class="num"><b>${b.prontos}</b> prontos · ${b.emCurso} em curso · ${b.nAp - b.prontos - b.emCurso} por começar</span></div>` : ""}
          ${b.ultima ? `<div class="ln"><span>Acaba com</span><span>${esc(nomeAtiv(b.ultima))} <span class="mono">${esc(b.ultima.unidade)}</span></span></div>` : ""}
        </div>`).join("")}</div>
    </section>

    ${mesesE.length ? `<section class="card">
      <div class="card-h"><h2>Apartamentos e lojas prontos por mês</h2><span class="note">pelo fim provável de cada um · acumulado em baixo</span></div>
      <div class="pv-mes">${mesesE.map((m) => { acum += porMes[m]; return `<div class="pv-m ${m < hojeM ? "pass" : m === hojeM ? "agora" : ""}" title="${porMes[m]} ${m < hojeM ? "ficaram prontos" : "ficam prontos"} em ${nomeMes(m)}"><span class="num pv-mn">${porMes[m]}</span><span class="pv-mb" style="height:${Math.round((100 * porMes[m]) / maxM)}%"></span><span class="pv-ml">${nomeMes(m)}</span><span class="pv-ma num">${acum}</span></div>`; }).join("")}</div>
    </section>` : ""}

    <section class="card">
      <div class="card-h"><h2>O que vai acabar por último</h2><span class="note">as atividades que marcam o fim da obra</span></div>
      <div class="list">${ultimasObra.map((a) => { const r = S.res.get(a.id); return `<button class="li li-btn" data-a="${a.id}"><span class="li-t">${esc(nomeAtiv(a))} <span class="mono">${esc(a.unidade)}</span></span><span class="num"><b>${fd(r.provFim, true)}</b></span><span class="li-s"><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>${r.bloqueadaPor.length ? `<span>à espera de ${esc(nomeAtiv(S.acts[r.bloqueadaPor[0]] || a))}${r.bloqueadaPor.length > 1 ? " +" + (r.bloqueadaPor.length - 1) : ""}</span>` : ""}${a.equipa ? `<span>${esc(a.equipa)}</span>` : ""}</span></button>`; }).join("") || `<div class="empty">Está tudo concluído.</div>`}</div>
    </section>

    <section class="card">
      <div class="card-h"><h2>Por apartamento</h2>
        <div class="row no-print">
          <label class="f">Mostrar<select class="inp" id="pvTipo"><option value="todos" ${pv.tipo === "todos" ? "selected" : ""}>Tudo</option><option value="ap" ${pv.tipo === "ap" ? "selected" : ""}>Só apartamentos e lojas</option><option value="zonas" ${pv.tipo === "zonas" ? "selected" : ""}>Só zonas comuns e gerais</option></select></label>
          <label class="f">Ordenar<select class="inp" id="pvOrd"><option value="fim" ${pv.ord === "fim" ? "selected" : ""}>Pela data de fim</option><option value="desvio" ${pv.ord === "desvio" ? "selected" : ""}>Mais atrasados primeiro</option><option value="pct" ${pv.ord === "pct" ? "selected" : ""}>Menos avançados primeiro</option><option value="fracao" ${pv.ord === "fracao" ? "selected" : ""}>Pela fração</option></select></label>
          <button class="btn sm" id="pvAbrir">${pv.abertos.size >= blocos.length ? "Fechar todos" : "Abrir todos"}</button>
        </div></div>
      ${blocos.map((b) => { const l = ordena(b.lst.filter(filtraTipo)); if (!l.length) return ""; return `<details class="pv-det" data-pvb="${b.k}" ${pv.abertos.has(b.k) ? "open" : ""}>
        <summary><b>${NOME_BLOCO(b.k)}</b><span class="note num">${b.nAp ? `${b.prontos} de ${b.nAp} prontos · ` : ""}fica pronto a ${fd(b.fim, true)}</span>${atrHTML(b.atraso)}</summary>
        <div class="pv-frs"><div class="pv-fr pv-frh" aria-hidden="true"><span>Fração</span><span>Estado</span><span>Feito</span><span>Fim provável · atraso</span><span>O que falta</span></div>${l.map(linhaFr).join("")}</div>
      </details>`; }).join("")}
      <p class="note">O fim provável conta com o estado real de hoje e com a sequência dos trabalhos. O atraso é o da atividade mais atrasada de cada fração. Toque numa fração para ver as atividades.</p>
    </section>`;
  return { html, bind: () => {
    bindCommon();
    $("#pvPrint").onclick = () => { document.querySelectorAll(".pv-det").forEach((d) => (d.open = true)); window.print(); };
    $("#pvOrd").onchange = (e) => { pv.ord = e.target.value; render(); };
    $("#pvTipo").onchange = (e) => { pv.tipo = e.target.value; render(); };
    $("#pvAbrir").onclick = () => { pv.abertos = pv.abertos.size >= blocos.length ? new Set() : new Set(blocos.map((b) => b.k)); render(); };
    document.querySelectorAll(".pv-det").forEach((d) => d.addEventListener("toggle", () => { if (d.open) pv.abertos.add(d.dataset.pvb); else pv.abertos.delete(d.dataset.pvb); }));
  } };
}
/** Guarda uma vez por dia o fim previsto e os totais, para comparar semana a semana. */
async function guardarFotoDiaria() {
  if (store.user.papel !== "dono" || !S) return;
  const h = (S.cfg.historico || []);
  if (h.length && h[h.length - 1].d === S.hoje) return;
  const novo = [...h, { d: S.hoje, fim: S.tot.fim, atr: S.tot.atrasada, conc: S.tot.concluida }].slice(-120);
  aAnular = true;
  try { await store.setConfig({ historico: novo }, null); } catch (e) {} finally { aAnular = false; }
}
async function resumoSemana() {
  const el = $("#semanaRes"); if (!el) return;
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  let regs = [];
  try { regs = await store.getRegistosDesde(desde); } catch (e) { el.querySelector(".note:last-child").textContent = "Não foi possível carregar."; return; }
  const c = (t) => regs.filter((r) => r.tipo === t).length;
  const concl = regs.filter((r) => r.tipo === "conclusao");
  const h = S.cfg.historico || [];
  const alvo = addDays(S.hoje, -7);
  const ref = [...h].reverse().find((x) => x.d <= alvo) || null;
  const desvio = ref && ref.fim && S.tot.fim ? diffDays(ref.fim, S.tot.fim) : null;
  const item = (n, l, cls) => `<div class="sitem ${cls || ""}"><b class="num">${n}</b><span>${l}</span></div>`;
  el.innerHTML = `<div class="card-h"><h2>Esta semana</h2><span class="note">últimos 7 dias</span></div>
    <div class="sres">${item(concl.length, "concluídas", "k-ok")}${item(c("inicio"), "iniciadas")}${item(c("previsao"), "novas previsões ou datas")}${item(c("vistoria"), "registos de vistoria")}${item(regs.filter((r) => r.tipo === "foto").length, "registos de fotografias")}</div>
    <p class="note" style="margin:0">${desvio == null ? `Fim previsto da obra: ${fd(S.tot.fim, true)}. A comparação com a semana anterior aparece a partir de ${fd(addDays((h[0] && h[0].d) || S.hoje, 7), true)}.`
      : desvio > 0 ? `<b class="mau-t">O fim previsto da obra atrasou ${desvio} dias</b> desde ${fd(ref.d)} (era ${fd(ref.fim, true)}, agora ${fd(S.tot.fim, true)}).`
      : desvio < 0 ? `<b class="bom-t">O fim previsto da obra adiantou ${-desvio} dias</b> desde ${fd(ref.d)} (era ${fd(ref.fim, true)}, agora ${fd(S.tot.fim, true)}).`
      : `O fim previsto da obra não mudou desde ${fd(ref.d)}: ${fd(S.tot.fim, true)}.`}</p>
    ${concl.length ? `<div class="note">Últimas concluídas: ${concl.slice(0, 5).map((r) => esc(r.texto.replace(/^Concluiu /, ""))).join(" · ")}${concl.length > 5 ? " ..." : ""}</div>` : ""}`;
}
function heatHTML() {
  const esp = [...S.cfg.especialidades].sort((a, b) => a.ordem - b.ordem);
  const fil = ui.bloco;
  const us = S.unidades.filter((u) => (u.tipo === "Apartamento" || u.tipo === "Loja") && (fil === "todos" || u.bloco === fil));
  let lastB = null;
  const rows = us.map((u) => {
    let pre = "";
    const bk = u.tipo === "Loja" ? "Lojas" : u.bloco;
    if (bk !== lastB) { lastB = bk; pre = `<tr class="blk"><th colspan="${esp.length + 1}">${bk === "Lojas" ? "Lojas" : "Bloco " + bk}</th></tr>`; }
    const byE = {};
    for (const a of u.acts) if (a.esp) (byE[a.esp] = byE[a.esp] || []).push(a);
    return pre + `<tr><th><a href="#u-${esc(u.id)}">${esc(u.id)}</a></th>${esp.map((e) => {
      const l = byE[e.key];
      if (!l) return `<td><div class="cell c-none"></div></td>`;
      const a = l[0], r = S.res.get(a.id), p = Math.round(pctEfetiva(a));
      const txt = r.estado === "concluida" ? "" : r.estado === "bloqueada" ? "" : p ? p : "";
      return `<td><button class="cell c-${r.estado}${r.atrasada ? " atr" : ""}" data-a="${a.id}" title="${esc(u.id + ": " + e.nome + " · " + ESTADO[r.estado] + (p ? " " + p + "%" : "") + " · previsto " + fd(r.fim))}">${txt}</button></td>`;
    }).join("")}</tr>`;
  }).join("");
  const blocos = ["todos", "A", "B", "C", "D", "Geral"];
  return `<section class="card">
    <div class="card-h"><h2>Mapa dos apartamentos</h2>
      <div class="chips">${blocos.map((b) => `<button class="chip ${fil === b ? "on" : ""}" data-bloco="${b}">${b === "todos" ? "Todos" : b === "Geral" ? "Geral" : "Bloco " + b}</button>`).join("")}</div></div>
    ${!us.length ? `<div class="empty">O bloco Geral não tem apartamentos nem lojas, por isso não entra neste mapa. As suas atividades (estrutura, exteriores, garagens, piscina, receção...) estão em <a href="#plano" data-irgeral>Trabalhos</a> e no Gantt.</div>` : ""}
    <div class="legend"><span><i class="cell c-concluida"></i>Concluída</span><span><i class="cell c-em_curso"></i>Em curso (%)</span><span><i class="cell c-bloqueada"></i>Bloqueada</span><span><i class="cell c-por_iniciar"></i>Por iniciar</span><span><i class="cell c-por_iniciar atr"></i>Atrasada</span></div>
    <div class="heat-wrap"><table class="heat"><thead><tr><th class="corner"></th>${esp.map((e) => `<th><div title="${esc(e.nome)}">${esc((!e.editado && CURTO[e.key]) || (e.nome.length > 16 ? e.nome.slice(0, 15) + "." : e.nome))}</div></th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}
function bindCommon() {
  document.querySelectorAll("[data-atrg]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, { ativ: b.dataset.atrg, f: "atrasada", bloco: "", unidade: "", tipo: "", equipa: "", q: "", soAtr: false, sort: { col: "desvio", dir: "desc" } }); }));
  document.querySelectorAll("[data-irgeral]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, { bloco: "Geral", unidade: "", tipo: "" }); }));
  document.querySelectorAll("[data-verplano]").forEach((b) => (b.onclick = () => {
    const [uid, bl] = b.dataset.verplano.split("|");
    Object.assign(ui.plano, { bloco: bl === "Geral" ? "" : bl, tipo: "", unidade: uid, ativ: "", equipa: "", q: "", soAtr: false, f: "todas", _fToque: true });
  }));
  document.querySelectorAll("[data-vergantt]").forEach((b) => (b.onclick = () => {
    const [uid, bl] = b.dataset.vergantt.split("|");
    ui.gantt = ui.gantt || { zoom: "semana", abertos: new Set(), ligacoes: true, abertas: true };
    ui.gantt.abertosB = ui.gantt.abertosB || new Set();
    ui.gantt.abertosB.add(bl); ui.gantt.abertos.add(uid);
    Object.assign(ui.gantt, { bloco: bl, unidade: uid, ativ: "", sel: null, _chave: null });
  }));
  document.querySelectorAll("[data-nova]").forEach((b) => (b.onclick = () => openNova(b.dataset.nova)));
  document.querySelectorAll("[data-a]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); openSheet(b.dataset.a); }));
  document.querySelectorAll("#view [data-irpend]").forEach((b) => (b.onclick = () => { ui.lastUnit = b.dataset.irpend; ui.unidadeTab = store.user.papel === "fiscal" ? "vist" : "pend"; }));
  document.querySelectorAll("[data-bloco]").forEach((b) => (b.onclick = () => { ui.bloco = b.dataset.bloco; render(); }));
  document.querySelectorAll("a[data-f]").forEach((b) => (b.onclick = () => { ui.plano.f = b.dataset.f; ui.plano._fToque = true; }));
}

/* ============================================================ unidades */
function segHTML(u) {
  const t = u.acts.length || 1;
  return `<div class="seg" title="${u.n.concluida} concluídas, ${u.n.em_curso} em curso, ${u.n.bloqueada} bloqueadas">
    <i style="width:${(100 * u.n.concluida) / t}%;background:var(--ok)"></i><i style="width:${(100 * u.n.em_curso) / t}%;background:var(--curso)"></i><i style="width:${(100 * u.n.bloqueada) / t}%;background:var(--bloq);opacity:.6"></i></div>`;
}
const ultimaVistoria = (u) => u.acts.reduce((m, a) => [a.fiscalEm, a.fiscalNotaEm].reduce((mm, d) => (d && (!mm || d > mm) ? d : mm), m), null);
function vizinhas(id) {
  const lista = S.unidades.map((u) => u.id);
  const i = lista.indexOf(id);
  return { ant: i > 0 ? lista[i - 1] : null, seg: i >= 0 && i < lista.length - 1 ? lista[i + 1] : null };
}
function unidadesView() {
  const fil = ui.bloco;
  const limite = new Date(Date.now() - 7 * 86400000).toISOString();
  const precisaVist = (u) => u.n.concluida < u.acts.length && (!ultimaVistoria(u) || ultimaVistoria(u) < limite);
  const nPrecisa = S.unidades.filter((u) => (fil === "todos" || u.bloco === fil) && precisaVist(u)).length;
  const nPendU = (u) => pendDe(u.id).filter(pendAberto).length;
  const nComPend = S.unidades.filter((u) => (fil === "todos" || u.bloco === fil) && nPendU(u)).length;
  const grupos = [["A", "Bloco A"], ["B", "Bloco B"], ["C", "Bloco C"], ["D", "Bloco D"], ["Geral", "Geral"]];
  const html = `
    <div class="card-h"><h1>Apartamentos</h1>
      <div class="row"><div class="chips">${["todos", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${fil === b ? "on" : ""}" data-bloco="${b}">${b === "todos" ? "Todos" : b === "Geral" ? "Geral" : "Bloco " + b}</button>`).join("")}</div>
      ${store.user.papel === "dono" ? `<button class="btn pri" id="novaFr">+ Nova fração</button>` : ""}</div></div>
    ${store.user.papel === "fiscal" ? `<div class="banner">Escolha o apartamento onde está. Lá dentro registe a percentagem de cada especialidade e tire as fotografias.</div>` : ""}
    <div class="ubar"><label class="check"><input type="checkbox" id="porVist" ${ui.porVist ? "checked" : ""}><span>Só as por vistoriar há mais de 7 dias</span></label><span class="note num">${nPrecisa} ${nPrecisa === 1 ? "fração" : "frações"} por vistoriar</span>
      <label class="check"><input type="checkbox" id="comPend" ${ui.comPend ? "checked" : ""}><span>Só as com pendentes por fechar</span></label><span class="note num ${nComPend ? "pd-cnt" : ""}">${nComPend} ${nComPend === 1 ? "fração" : "frações"} com pendentes</span></div>
    ${grupos.filter(([g]) => fil === "todos" || fil === g).map(([g, nome]) => {
      const us = S.unidades.filter((u) => u.bloco === g && (!ui.porVist || precisaVist(u)) && (!ui.comPend || nPendU(u)));
      if (!us.length) return "";
      return `<section class="col" style="display:flex;flex-direction:column;gap:10px"><div class="grp">${nome}</div><div class="ucards">${us.map((u) => {
        const dv = u.atraso;
        const uv = ultimaVistoria(u);
        const np = nPendU(u);
        return `<a class="ucard ${np ? "tem-pend" : ""}" href="#u-${esc(u.id)}">
          <div class="ucard-h"><b>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" ? u.id : u.nome)}</b><span class="mono num">${u.pct}%</span></div>
          ${segHTML(u)}
          <div class="ln"><span>Fim previsto</span><span><b>${fd(u.fim)}</b> ${deltaHTML(dv)}</span></div>
          <div class="ln"><span>Última vistoria</span><span class="${!uv || uv < limite ? "vatr" : ""}"><b>${uv ? fdt(uv).split(" ").slice(0, 2).join(" ") : "nunca"}</b></span></div>
          ${np ? `<div class="pd-ln"><span>Pendentes por fechar</span><b class="num">${np}</b></div>` : ""}
          <div class="meta">${u.n.atrasada ? `<span class="pill late">${u.n.atrasada} atrasadas</span>` : ""}${u.n.bloqueada ? `<span class="pill st-bloqueada">${u.n.bloqueada} bloqueadas</span>` : ""}${u.n.em_curso ? `<span class="pill st-em_curso">${u.n.em_curso} em curso</span>` : ""}${!u.n.atrasada && !u.n.bloqueada && !u.n.em_curso ? `<span class="pill st-${u.n.concluida === u.acts.length ? "concluida" : "por_iniciar"}">${u.n.concluida === u.acts.length ? "Tudo concluído" : "Por iniciar"}</span>` : ""}</div>
        </a>`;
      }).join("")}</div></section>`;
    }).join("")}
    ${S.unidadesTeste.length && fil === "todos" ? `<section class="col" style="display:flex;flex-direction:column;gap:10px"><div class="grp">Frações de teste <span class="note">não contam para a obra</span></div><div class="ucards">${S.unidadesTeste.map((u) => `<a class="ucard teste" href="#u-${esc(u.id)}">
        <div class="ucard-h"><b>${esc(u.id)}</b><span class="pill teste-p">TESTE</span></div>
        ${segHTML(u)}
        <div class="ln"><span>Atividades</span><span><b>${u.acts.length}</b></span></div>
        <div class="ln"><span>Fim previsto</span><span><b>${fd(u.fim)}</b></span></div></a>`).join("")}</div></section>` : ""}`;
  return { html, bind: () => { bindCommon(); const nf = $("#novaFr"); if (nf) nf.onclick = openNovaFracao; const pv = $("#porVist"); if (pv) pv.onchange = () => { ui.porVist = pv.checked; render(); };
    const cp = $("#comPend"); if (cp) cp.onchange = () => { ui.comPend = cp.checked; render(); };
    if (ui.porVist || ui.comPend) {
      if (!document.querySelector("#view .ucard")) document.querySelector("#view .ubar").insertAdjacentHTML("afterend", `<div class="empty">Nenhuma fração com estes filtros. <button class="btn sm" data-repor>Limpar filtros</button></div>`);
      document.querySelectorAll("#view .empty [data-repor]").forEach((b) => (b.onclick = reporFiltros));
    } } };
}

function unidadeView(id) {
  const u = S.uMap[id];
  if (!u) return { html: `<div class="empty">Fração não encontrada. <a href="#unidades">Voltar</a></div>` };
  const dv = u.atraso;
  const fiscal = can("vistoria");
  const tab = ui.unidadeTab;
  if (ui.uSemConc == null) ui.uSemConc = true;
  const concl = (a) => S.res.get(a.id).estado === "concluida" || pctEfetiva(a) >= 100;
  const visiveis = ui.uSemConc ? u.acts.filter((a) => !concl(a)) : u.acts;
  const nConcl = u.acts.filter(concl).length;
  // janela temporal para as barras
  let t0 = null, t1 = null;
  for (const a of visiveis.length ? visiveis : u.acts) {
    const r = S.res.get(a.id);
    for (const d of [r.inicio, r.fim]) if (d) { if (!t0 || d < t0) t0 = d; if (!t1 || d > t1) t1 = d; }
  }
  const abertas = u.acts.filter((a) => S.res.get(a.id).estado !== "concluida").map((a) => S.res.get(a.id).inicio).sort();
  const minIni = addDays(S.hoje, -45);
  if (abertas.length && t0 < minIni) t0 = abertas[0] < minIni ? abertas[0] : minIni;
  const span = Math.max(1, diffDays(t0, t1));
  const pos = (d) => Math.max(0, Math.min(100, (100 * diffDays(t0, d)) / span));
  const edU = !!ui.unitEdit && can("executar");
  const rowsAtiv = visiveis.map((a) => {
    const r = S.res.get(a.id);
    const espera = [...new Set(r.bloqueadaPor.map((pid) => S.acts[pid]).filter(Boolean).map((p) => nomeAtiv(p) + (p.unidade !== a.unidade ? " (" + p.unidade + ")" : "")))];
    const seguintes = [...new Set(r.succ.map((sid) => S.acts[sid]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))];
    const pe = a.pctEmp ?? 0, pf = a.pctFiscal;
    const dica = [ESTADO[r.estado] + (r.atrasada ? ", atrasada" : ""), a.equipa, espera.length && r.estado === "bloqueada" ? "À espera de: " + espera.join(", ") : "", seguintes.length ? "Segue-se: " + seguintes.join(", ") : ""].filter(Boolean).join(" · ");
    return `<div class="arow linha ${edU ? "editing" : ""}" ${edU ? "" : `data-a="${a.id}"`} title="${esc(dica)}">
      <span class="dot st-${r.estado}${r.atrasada ? " atr" : ""}" aria-label="${esc(ESTADO[r.estado] + (r.atrasada ? ", atrasada" : ""))}"></span>
      <div class="nm1">${edU ? `<button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button>` : `<b>${esc(nomeAtiv(a))}</b>`}${espera.length && r.estado === "bloqueada" ? `<span class="wait1">à espera de ${esc(espera[0])}${espera.length > 1 ? " +" + (espera.length - 1) : ""}</span>` : a.equipa ? `<span class="eq1">${esc(a.equipa)}</span>` : ""}${seguintes.length ? `<span class="seg1">segue-se ${esc(seguintes[0])}${seguintes.length > 1 ? " +" + (seguintes.length - 1) : ""}</span>` : ""}</div>
      <div class="tl" aria-hidden="true">
        <div class="fc st-${r.estado}" style="left:${pos(r.inicio)}%;width:${Math.max(0.8, pos(r.fim) - pos(r.inicio))}%"></div>
        ${S.hoje >= t0 && S.hoje <= t1 ? `<div class="today" style="left:${pos(S.hoje)}%"></div>` : ""}
      </div>
      <div class="dt1">${edU ? `${dateInput(a.id, "ini", r.estado === "concluida" ? a.realInicio || r.inicio : r.inicio)}${dateInput(a.id, "fim", r.estado === "concluida" ? a.realFim || r.fim : r.fim)}` : `<span class="mono num">${fd(r.inicio)} a ${fd(r.fim)}</span>`}</div>
      <div class="dv1">${deltaHTML(r.atraso)}</div>
      ${edU ? `<div class="pcts ed">${estadoEdHTML(a, r)}${pctEdHTML(a)}</div>` : `<div class="pcts" title="Empreiteiro / Fiscal"><span class="vf-slot" data-vfotos="${a.id}"></span>E <b>${Math.round(pe)}%</b> · F <b>${pf == null ? "s/v" : Math.round(pf) + "%"}</b></div>`}
    </div>`;
  }).join("");
  const barraConc = `<div class="ubar"><label class="check"><input type="checkbox" id="uSemConc" ${ui.uSemConc ? "checked" : ""}><span>Esconder concluídas</span></label>
    <span class="note num">${ui.uSemConc ? `${visiveis.length} por concluir · ${nConcl} concluída${nConcl === 1 ? "" : "s"} escondida${nConcl === 1 ? "" : "s"}` : `${u.acts.length} atividades`}</span>
    <span class="legend" style="margin-left:auto"><span><i class="dot st-concluida"></i>Concluída</span><span><i class="dot st-em_curso"></i>Em curso</span><span><i class="dot st-bloqueada"></i>Bloqueada</span><span><i class="dot st-por_iniciar"></i>Por iniciar</span><span><i class="dot st-por_iniciar atr"></i>Atrasada</span></span></div>`;
  const temMud = (v) => v.pct != null || (v.fotos && v.fotos.length) || (v.coment && v.coment.trim());
  // vista: já mexeu nesta vistoria, ou já foi vistoriada hoje
  const vista = (a) => { const v = ui.vistoria[a.id]; return !!(v && (temMud(v) || v.confirmado)) || !!(a.fiscalEm && diaLocal(a.fiscalEm) === S.hoje); };
  const nVistas = visiveis.filter(vista).length;
  const rowsVist = visiveis.map((a) => {
    const r = S.res.get(a.id);
    const v = ui.vistoria[a.id];
    const npA = pendDe(u.id, a.id).filter(pendAberto).length;
    const cur = v && v.pct != null ? v.pct : a.pctFiscal != null ? Math.round(a.pctFiscal) : null;
    const nf = v && v.fotos ? v.fotos.length : 0;
    const comAberto = v && (v.abrirC || (v.coment && v.coment.length));
    return `<div class="vrow ${vista(a) ? "vista" : ""}" id="vr-${a.id}">
      <div class="nm" style="display:flex;flex-direction:column;gap:3px;min-width:0"><b style="overflow-wrap:anywhere">${vista(a) ? `<span class="vok" aria-label="Vista">✓</span> ` : ""}${esc(nomeAtiv(a))}</b>
        <small class="muted">Empreiteiro diz ${Math.round(a.pctEmp ?? 0)}% · <span class="pill st-${r.estado}" style="font-size:.7rem">${ESTADO[r.estado]}</span>${a.fiscalEm ? ` · última vistoria ${fdt(a.fiscalEm)}` : ""}</small>
        ${a.fiscalNota ? `<small class="vult">Último comentário: ${esc(a.fiscalNota)}</small>` : ""}</div>
      <div class="ctl">
        <button type="button" class="btn sm ${comAberto ? "on-c" : ""}" data-vc="${a.id}" title="Escrever comentário" aria-label="Comentário">${ICON.coment}</button>
        <button type="button" class="btn sm vpd ${npA ? "tem" : ""}" data-vpd="${a.id}" title="Registar um pendente nesta atividade" aria-label="Pendente">${ICON.pendentes}${npA ? `<span class="num">${npA}</span>` : ""}</button>
        <span class="vf-slot" data-vfotos="${a.id}"></span>
        ${fotoPickerHTML(a.id, nf)}
      </div>
      <div class="vpct">${pctCtlHTML(a.id, cur, v && v.pct != null)}${(() => {
        const ref = a.pctFiscal != null ? Math.round(a.pctFiscal) : Math.round(Number(a.pctEmp) || 0);
        const on = v && v.confirmado;
        return `<button type="button" class="btn sm vmant ${on ? "on" : ""}" data-vmant="${a.id}" aria-pressed="${!!on}" title="${a.pctFiscal != null ? "Vi e está igual à última vistoria" : "Vi e confirmo a percentagem do empreiteiro"}: fica registado que esta especialidade foi vistoriada">${on ? "✓ " : ""}${a.pctFiscal != null ? "Mantém" : "Confirma"} ${ref}%</button>`;
      })()}</div>
      ${comAberto || nf ? `<div class="vextra">
        ${comAberto ? `<input class="inp" data-vct="${a.id}" value="${esc((v && v.coment) || "")}" placeholder="Comentário sobre ${esc(nomeAtiv(a).toLowerCase())}: o que viu, não conformidades">` : ""}
        ${pendentesHTML(a.id, v && v.fotos)}</div>` : ""}
    </div>`;
  }).join("");
  const nChg = Object.values(ui.vistoria).filter((v) => v.unidade === id && temMud(v)).length;
  const nPend = pendDe(u.id).filter(pendAberto).length;
  const pendVist = pendDe(u.id).filter(pendVivo);
  const html = `
    <div class="row" style="justify-content:space-between"><div class="row" style="gap:6px"><a class="back" href="#unidades">Apartamentos</a>
      ${(() => { const vz = vizinhas(u.id); return `<span class="unav">${vz.ant ? `<a class="btn sm" href="#u-${esc(vz.ant)}" title="Fração anterior">‹ ${esc(vz.ant)}</a>` : ""}${vz.seg ? `<a class="btn sm" href="#u-${esc(vz.seg)}" title="Fração seguinte">${esc(vz.seg)} ›</a>` : ""}</span>`; })()}</div><div class="row" style="gap:6px"><a class="btn sm" href="#plano" data-verplano="${esc(u.id)}|${esc(u.bloco)}">Ver nos trabalhos</a><a class="btn sm" href="#gantt" data-vergantt="${esc(u.id)}|${esc(u.bloco)}">Ver no Gantt</a>${can("criar") ? `<button class="btn sm" data-nova="unit:${esc(u.id)}">+ Nova atividade nesta fração</button>` : ""}</div></div>
    ${u.teste ? `<div class="banner teste-b"><span><b>Fração de teste.</b> Pode mexer à vontade: não conta para o painel, para o fim da obra nem para as estatísticas, e não mexe nas datas das outras frações. Quando acabar os testes, elimine-a.</span></div>` : ""}
    <div class="uhead">
      <div><div class="eyebrow">${esc(u.tipo)}${u.bloco !== "Geral" ? " · " + blocoLabel(u.bloco) : ""}${u.tipo === "Apartamento" ? " · piso " + u.piso : ""}</div><h1>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" ? u.id : u.nome)}</h1></div>
      <div class="stats">
        <div class="stat"><b class="num">${u.pct}%</b><span>avanço</span></div>
        <div class="stat"><b>${fd(u.fim)}</b><span>fim previsto ${deltaHTML(dv)}</span></div>
        <div class="stat"><b class="num">${u.n.concluida}/${u.acts.length}</b><span>concluídas</span></div>
      </div>
    </div>
    ${segHTML(u)}
    <div class="tabs">
      ${fiscal ? `<button data-tab="vist" class="${tab === "vist" ? "on" : ""}">Vistoria</button>` : ""}
      <button data-tab="ativ" class="${tab === "ativ" || (tab === "vist" && !fiscal) ? "on" : ""}">Atividades</button>
      <button data-tab="pend" class="${tab === "pend" ? "on" : ""}">Pendentes${nPend ? ` <span class="tab-n">${nPend}</span>` : ""}</button>
      <button data-tab="fotos" class="${tab === "fotos" ? "on" : ""}">Fotografias</button>
      ${can("executar") && tab !== "vist" && tab !== "fotos" && tab !== "pend" ? `<button id="uEdit" class="tab-act ${edU ? "on" : ""}">${edU ? "Terminar edição" : "Editar datas"}</button>` : ""}
    </div>
    ${edU && tab === "ativ" ? `<div class="banner">Altere as datas e a percentagem de cada atividade, ou toque no estado para a iniciar ou concluir hoje. Cada alteração fica guardada logo e as atividades seguintes acertam-se sozinhas.</div>` : ""}
    ${tab === "vist" && fiscal ? `<section class="pd-vist ${pendVist.length ? "" : "vazio"}"><div class="card-h"><h2>Pendentes deste apartamento <span class="note num">${pendVist.length}</span></h2>
          <button class="btn sm" data-pdabrir>${(ui.pdFormAberto || {})[u.id] ? "Fechar" : "+ Novo pendente"}</button></div>
        ${pendVist.length ? `<p class="note" style="margin:0">Se já está bem, carregue em «Concluído?»; se não, em «Ainda não está».</p><div class="pd-lista">${pendListaHTML(pendVist, { semFechados: true, resolvidosPrimeiro: true })}</div>` : ""}
        ${(ui.pdFormAberto || {})[u.id] ? pendFormHTML(u.id) : ""}</section>
      <label class="f">Nota da vistoria (opcional)<input class="inp" id="vnota" value="${esc(ui.vnota || "")}" placeholder="Ex.: humidade no teto do WC, falta silicone na base de duche"></label>
      ${barraConc}
      <div class="arows">${rowsVist || `<div class="empty">Tudo concluído nesta fração.</div>`}</div>
      <h3 style="margin-top:6px">Fotografias desta fração</h3>
      <p class="note" style="margin:0">Toque no × para apagar uma fotografia já guardada (só as suas, ou todas se for o dono de obra).</p>
      <div id="vfotos" class="photos"><div class="note">A carregar fotografias...</div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn sm" data-relhoje>Ver o relatório de hoje</button></div>
      <div class="vbar"><span class="vb-l"><b class="num" id="vvis">Vistas ${nVistas} de ${visiveis.length}</b>${nVistas < visiveis.length ? `<button class="btn sm ghost vb-seg" id="vseg" title="Ir para a próxima especialidade por ver">Seguinte ›</button>` : ""}</span>
        <button class="btn pri" id="vsave" ${nChg ? "" : "disabled"}>${nChg ? `Guardar (${nChg})` : "Nada por guardar"}</button></div>`
      : tab === "pend" ? `<p class="note" style="margin:0">Pontos por resolver nesta fração, à vista de todos. O empreiteiro marca como resolvido e o fiscal verifica na vistoria seguinte.</p>
        ${pendFormHTML(u.id)}
        <div class="pd-lista">${pendListaHTML(pendDe(u.id))}</div>`
      : tab === "fotos" ? `<div id="fotos" class="photos"><div class="note">A carregar fotografias...</div></div>`
      : `${barraConc}<div class="arows">${rowsAtiv || `<div class="empty">${u.acts.length ? "Tudo concluído nesta fração. Desligue \"Esconder concluídas\" para ver o histórico." : can("criar") ? "Esta fração ainda não tem atividades. Crie a primeira com + Nova atividade nesta fração, lá em cima." : "Esta fração ainda não tem atividades."}</div>`}</div>
         <p class="note">Barra: previsão. Traço vermelho: hoje. E e F: percentagem declarada pelo empreiteiro e verificada pelo fiscal. Passe o rato por cima de uma linha para ver o detalhe.</p>`}
    ${store.user.papel === "dono" && tab !== "vist" ? `<div class="perigo">${ui.delUnit && ui.delUnit.id === u.id ? delUnidadeHTML(u) : `<button class="btn sm ghost perigo-b" id="delU">Eliminar esta fração</button><span class="note">Apaga a fração e todas as suas atividades. ${u.teste ? "Pede o código para confirmar." : "Pede confirmação três vezes."}</span>`}</div>` : ""}`;
  if (tab === "vist" && !fiscal) ui.unidadeTab = "ativ";
  return { html, bind: () => bindUnidade(u) };
}
function bindUnidade(u) {
  bindCommon();
  bindPendentes(document.querySelector("#view"));
  bindDelUnidade(u);
  const ue = $("#uEdit"); if (ue) ue.onclick = () => { ui.unitEdit = !ui.unitEdit; render(); };
  const usc = $("#uSemConc"); if (usc) usc.onchange = () => { ui.uSemConc = usc.checked; render(); };
  bindDateInputs(document.querySelector("#view") || document);
  bindEstadoPct(document.querySelector("#view") || document);
  document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { ui.unidadeTab = b.dataset.tab; render(); }));
  bindPctCtl(document.querySelector("#view") || document,
    (id) => { const v = ui.vistoria[id], a = S.acts[id]; return v && v.pct != null ? v.pct : a.pctFiscal != null ? Math.round(a.pctFiscal) : Math.round(a.pctEmp ?? 0); },
    (id, val) => { ui.vistoria[id] = { ...(ui.vistoria[id] || { unidade: u.id }), unidade: u.id, pct: val, confirmado: false }; render(); });
  const vist = (id) => (ui.vistoria[id] = { ...(ui.vistoria[id] || { unidade: u.id }), unidade: u.id });
  const view = document.querySelector("#view");
  if (ui.unidadeTab === "vist" && view) {
    bindFotoPickers(view, (id, fotos) => { const v = vist(id); v.fotos = (v.fotos || []).concat(fotos); render(); });
    view.querySelectorAll("[data-vmant]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.vmant, a = S.acts[id], v = vist(id);
      const ref = a.pctFiscal != null ? Math.round(a.pctFiscal) : Math.round(Number(a.pctEmp) || 0);
      if (v.confirmado) { v.confirmado = false; v.pct = null; } else { v.confirmado = true; v.pct = ref; }
      render();
    }));
    view.querySelectorAll("[data-prm]").forEach((b) => (b.onclick = () => { const [id, i] = b.dataset.prm.split("|"); ui.vistoria[id].fotos.splice(+i, 1); render(); }));
    view.querySelectorAll("[data-vc]").forEach((b) => (b.onclick = () => { const v = vist(b.dataset.vc); v.abrirC = !v.abrirC || !!(v.coment && v.coment.length); render(); const i = view.querySelector(`[data-vct="${b.dataset.vc}"]`); if (i) i.focus(); }));
    const contar = () => {
      const n = Object.values(ui.vistoria).filter((v) => v.unidade === u.id && (v.pct != null || (v.fotos && v.fotos.length) || (v.coment && v.coment.trim()))).length;
      const sb = $("#vsave");
      if (sb) { sb.disabled = !n; sb.textContent = n ? `Guardar (${n})` : "Nada por guardar"; }
    };
    view.querySelectorAll("[data-vct]").forEach((i) => (i.oninput = () => { vist(i.dataset.vct).coment = i.value; contar(); }));
    loadFotos(u.id, $("#vfotos"));
    view.querySelectorAll("[data-vpd]").forEach((b) => (b.onclick = async () => {
      const a = S.acts[b.dataset.vpd];
      const t = await pedirTexto({ titulo: "Novo pendente", texto: `<p><b>${esc(nomeAtiv(a))}</b>, ${esc(u.id)}</p>`, placeholder: "Ex.: falta silicone na janela do quarto 2", sim: "Registar pendente", obrigatorio: true });
      if (t) await pendCriar(u.id, a.id, t);
    }));
    const pa = view.querySelector("[data-pdabrir]");
    if (pa) pa.onclick = () => { ui.pdFormAberto = ui.pdFormAberto || {}; ui.pdFormAberto[u.id] = !ui.pdFormAberto[u.id]; render(); const t = view.querySelector(".pd-vist [data-pdtxt]"); if (t) t.focus(); };
    const vs = $("#vseg");
    if (vs) vs.onclick = () => {
      const rows = [...view.querySelectorAll(".arows .vrow")];
      const meio = window.scrollY + window.innerHeight * 0.35;
      const prox = rows.find((r) => !r.classList.contains("vista") && r.getBoundingClientRect().top + window.scrollY > meio - 40) || rows.find((r) => !r.classList.contains("vista"));
      if (!prox) return;
      prox.scrollIntoView({ behavior: "smooth", block: "center" });
      prox.classList.remove("piscar"); void prox.offsetWidth; prox.classList.add("piscar");
    };
  }
  const vn = $("#vnota"); if (vn) vn.oninput = () => (ui.vnota = vn.value);
  const sv = $("#vsave");
  if (sv) sv.onclick = async () => {
    const nota = $("#vnota").value.trim();
    const agora = new Date().toISOString();
    let n = 0;
    for (const [id, v] of Object.entries(ui.vistoria)) {
      if (v.unidade !== u.id) continue;
      const coment = (v.coment || "").trim();
      if (v.pct == null && !(v.fotos && v.fotos.length) && !coment) { delete ui.vistoria[id]; continue; }
      const a = S.acts[id];
      const texto = [coment, nota].filter(Boolean).join(". ");
      const nf = (v.fotos || []).length;
      for (const f of v.fotos || []) await store.addFoto(id, u.id, f, texto);
      const patch = {};
      if (v.pct != null) Object.assign(patch, { pctFiscal: v.pct, fiscalEm: agora, fiscalPor: store.user.email });
      if (texto) Object.assign(patch, { fiscalNota: texto, fiscalNotaEm: agora });
      const partes = [v.pct != null ? `${v.pct}% (empreiteiro dizia ${Math.round(a.pctEmp ?? 0)}%)${v.confirmado ? ", confirmado sem alteração" : ""}` : "", nf ? `${nf} fotografia${nf > 1 ? "s" : ""}` : "", texto ? "comentário: " + texto : ""].filter(Boolean);
      const antes = a.pctFiscal != null ? Math.round(a.pctFiscal) : null;
      const confirmado = !!v.confirmado && v.pct != null && v.pct === (antes != null ? antes : Math.round(Number(a.pctEmp) || 0));
      const dados = { esp: nomeAtiv(a), antes, depois: v.pct ?? null, emp: Math.round(Number(a.pctEmp) || 0), nota: texto || null, nfotos: nf, confirmado };
      await store.updateAtividade(id, patch, { tipo: "vistoria", texto: `Vistoria ${nomeAtiv(a)} em ${a.unidade}: ${partes.join(", ")}`, dados });
      delete ui.vistoria[id]; n++;
    }
    ui.vnota = "";
    const seg = vizinhas(u.id).seg;
    toast(`Vistoria guardada (${n} especialidade${n > 1 ? "s" : ""})`, seg ? { acao: { label: `Seguinte: ${seg}`, fn: () => (location.hash = "#u-" + seg) } } : {});
    render();
  };
  const rh = document.querySelector("[data-relhoje]");
  if (rh) rh.onclick = () => { ui.relVist = { dias: [diaLocal(new Date().toISOString())], por: store.user.email }; location.hash = "#relvist"; };
  if (ui.unidadeTab === "fotos") loadFotos(u.id, $("#fotos"));
  botoesFotosLinhas(u.id, document.querySelector("#view") || document);
}
/* ============================================================ percentagem com botões grandes */
function pctCtlHTML(key, val, mudou) {
  return `<div class="pctc ${mudou ? "mudou" : ""}" role="group" aria-label="Percentagem verificada">
    ${[0, 25, 50, 75, 100].map((p) => `<button type="button" class="pb ${val === p ? "on" : ""}" data-pv="${key}|${p}">${p}</button>`).join("")}
    <span class="psep"></span>
    <button type="button" class="pb pm" data-pv="${key}|-5" aria-label="Menos 5 por cento">−</button>
    <span class="pval num">${val == null ? "Não vi" : val + "%"}</span>
    <button type="button" class="pb pm" data-pv="${key}|+5" aria-label="Mais 5 por cento">+</button>
  </div>`;
}
/** Liga os botões de percentagem: onSet(key, novoValor), base(key) dá o valor atual para os −/+. */
function bindPctCtl(root, base, onSet) {
  root.querySelectorAll("[data-pv]").forEach((b) => (b.onclick = () => {
    const [key, v] = b.dataset.pv.split("|");
    let val;
    if (v === "+5" || v === "-5") val = Math.max(0, Math.min(100, (base(key) ?? 0) + Number(v)));
    else val = Number(v);
    onSet(key, val);
  }));
}
/* ============================================================ fotografias: escolher origem, pré-visualizar, apagar */
function fotoPickerHTML(key, n, texto) {
  return `<div class="fpick"><button type="button" class="btn sm" data-fp="${key}" aria-haspopup="menu" title="Juntar fotografia">${ICON.camera}${texto ? `<span>${texto}</span>` : ""}${n ? `<span class="num fcnt">${n}</span>` : ""}</button>
    <div class="fmenu" role="menu" hidden data-fm="${key}">
      <label class="fopt" role="menuitem">${ICON.camera}<span><b>Tirar fotografia</b><small>Abre a câmara</small></span><input type="file" accept="image/*" capture="environment" data-fin="${key}" hidden></label>
      <label class="fopt" role="menuitem">${ICON.galeria}<span><b>Escolher fotografias</b><small>Da galeria do telemóvel ou do computador</small></span><input type="file" accept="image/*" multiple data-fin="${key}" hidden></label>
    </div></div>`;
}
function bindFotoPickers(root, onFiles) {
  root.querySelectorAll("[data-fp]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const m = root.querySelector(`[data-fm="${CSS.escape(b.dataset.fp)}"]`);
    const fechado = m.hidden;
    document.querySelectorAll(".fmenu").forEach((x) => (x.hidden = true));
    m.hidden = !fechado;
  }));
  root.querySelectorAll("[data-fin]").forEach((inp) => (inp.onchange = async () => {
    const key = inp.dataset.fin;
    inp.closest(".fmenu").hidden = true;
    const out = [];
    for (const f of inp.files) { try { out.push(await compress(f)); } catch (e) { toast("Não consegui ler a fotografia"); } }
    inp.value = "";
    if (out.length) onFiles(key, out);
  }));
}
/** Miniaturas das fotografias ainda por guardar, cada uma com × para retirar. */
function pendentesHTML(key, fotos) {
  if (!fotos || !fotos.length) return "";
  return `<div class="pend">${fotos.map((f, i) => `<div class="pth"><img src="${f}" alt="Fotografia por guardar"><button type="button" data-prm="${key}|${i}" aria-label="Retirar fotografia" title="Retirar">×</button></div>`).join("")}<span class="note">${fotos.length} por guardar</span></div>`;
}
const podeApagarFoto = (f) => store.user && (store.user.papel === "dono" || f.por === store.user.email);

async function loadFotos(unidade, el, ativ) {
  if (!el) return;
  let fotos = [];
  try { fotos = await store.getFotos(unidade); } catch (e) { el.innerHTML = `<div class="err">Não foi possível carregar as fotografias.</div>`; return; }
  if (ativ) fotos = fotos.filter((f) => f.ativ === ativ);
  fotos.sort((a, b) => b.em.localeCompare(a.em));
  if (!fotos.length) { el.innerHTML = `<div class="empty" style="grid-column:1/-1">Ainda sem fotografias${ativ ? " desta atividade" : " nesta fração"}. Junte-as na vistoria ou na ficha de cada atividade.</div>`; return; }
  el.innerHTML = fotos.map((f, i) => `<div class="phw" data-phw="${i}"><button class="ph" data-ph="${i}"><img src="${f.data}" alt="Fotografia de obra" loading="lazy"><b>${esc(f.ativ && S.acts[f.ativ] ? nomeAtiv(S.acts[f.ativ]) : "")}</b><span>${fdt(f.em)} · ${esc(f.nomePor || "")}</span>${f.nota ? `<span class="phn">${esc(f.nota)}</span>` : ""}</button>
    ${podeApagarFoto(f) ? `<button class="phx" data-phx="${i}" aria-label="Apagar fotografia" title="Apagar fotografia">×</button>` : ""}
    <div class="phc" data-phc="${i}" hidden><b>Apagar esta fotografia?</b><div class="row" style="gap:6px"><button class="btn sm delfinal" data-phs="${i}">Apagar</button><button class="btn sm" data-phn="${i}">Não</button></div></div></div>`).join("");
  el.querySelectorAll("[data-phx]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); el.querySelector(`[data-phc="${b.dataset.phx}"]`).hidden = false; }));
  el.querySelectorAll("[data-phn]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); el.querySelector(`[data-phc="${b.dataset.phn}"]`).hidden = true; }));
  el.querySelectorAll("[data-phs]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const f = fotos[+b.dataset.phs];
    b.disabled = true;
    try {
      const x = f.ativ && S.acts[f.ativ];
      await store.removeFoto(f, { tipo: "foto", texto: `Apagou uma fotografia${x ? " de " + nomeAtiv(x) : ""} em ${f.unidade}` });
      toast("Fotografia apagada");
      loadFotos(unidade, el, ativ);
    } catch (err) { toast("Não foi possível apagar: " + erroSimples(err) + ".", { anular: false }); b.disabled = false; }
  }));
  el.querySelectorAll("[data-ph]").forEach((b) => (b.onclick = () => abrirGaleria(fotos, +b.dataset.ph, () => loadFotos(unidade, el, ativ))));
}
/** Visualizador em ecrã inteiro: setas para navegar, apagar (com confirmação), fechar. */
function abrirGaleria(fotos, i0, depoisApagar) {
  document.querySelectorAll(".lb").forEach((x) => x.remove());
  let i = i0, conf = false;
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-label", "Fotografias");
  const fechar = () => { lb.remove(); document.removeEventListener("keydown", tecla); };
  const desenha = () => {
    const f = fotos[i];
    const x = f.ativ && S.acts[f.ativ];
    lb.innerHTML = `<div class="lb-top"><span class="num">${i + 1} de ${fotos.length}</span><button class="lb-x" data-lb="fechar" aria-label="Fechar">×</button></div>
      <div class="lb-mid">${fotos.length > 1 ? `<button class="lb-nav" data-lb="ant" aria-label="Anterior">‹</button>` : ""}<img src="${f.data}" alt="Fotografia de obra">${fotos.length > 1 ? `<button class="lb-nav" data-lb="seg" aria-label="Seguinte">›</button>` : ""}</div>
      <div class="lb-cap"><b>${esc(x ? nomeAtiv(x) : "")}</b> · <span class="mono">${esc(f.unidade)}</span> · ${fdt(f.em)} · ${esc(f.nomePor || "")}${f.nota ? `<div>${esc(f.nota)}</div>` : ""}</div>
      ${podeApagarFoto(f) ? (conf ? `<div class="row lb-del"><span>Apagar esta fotografia?</span><button class="btn sm delfinal" data-lb="apagar">Apagar</button><button class="btn sm" data-lb="nao">Não</button></div>`
        : `<div class="row lb-del"><button class="btn sm" data-lb="pedir">Apagar fotografia</button></div>`) : ""}`;
  };
  const tecla = (e) => { if (e.key === "Escape") fechar(); if (e.key === "ArrowLeft") mover(-1); if (e.key === "ArrowRight") mover(1); };
  const mover = (d) => { if (fotos.length < 2) return; i = (i + d + fotos.length) % fotos.length; conf = false; desenha(); };
  lb.onclick = async (e) => {
    const a = e.target.closest("[data-lb]");
    if (!a) { if (e.target === lb) fechar(); return; }
    const v = a.dataset.lb;
    if (v === "fechar") fechar();
    else if (v === "ant") mover(-1);
    else if (v === "seg") mover(1);
    else if (v === "pedir") { conf = true; desenha(); }
    else if (v === "nao") { conf = false; desenha(); }
    else if (v === "apagar") {
      const f = fotos[i], x = f.ativ && S.acts[f.ativ];
      try {
        await store.removeFoto(f, { tipo: "foto", texto: `Apagou uma fotografia${x ? " de " + nomeAtiv(x) : ""} em ${f.unidade}` });
        toast("Fotografia apagada");
        fotos.splice(i, 1);
        if (depoisApagar) depoisApagar();
        if (!fotos.length) { fechar(); return; }
        i = Math.min(i, fotos.length - 1); conf = false; desenha();
      } catch (err) { toast("Não foi possível apagar: " + erroSimples(err) + ".", { anular: false }); }
    }
  };
  let x0 = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1); x0 = null; });
  document.addEventListener("keydown", tecla);
  desenha();
  document.body.appendChild(lb);
}
/** Preenche, em cada linha, o botão que abre as fotografias já guardadas dessa atividade. */
async function botoesFotosLinhas(unidade, root) {
  const slots = root.querySelectorAll("[data-vfotos]");
  if (!slots.length) return;
  let fotos = [];
  try { fotos = await store.getFotos(unidade); } catch (e) { return; }
  const porAtiv = {};
  for (const f of fotos.sort((a, b) => b.em.localeCompare(a.em))) (porAtiv[f.ativ] = porAtiv[f.ativ] || []).push(f);
  slots.forEach((sl) => {
    const lista = porAtiv[sl.dataset.vfotos];
    if (!lista || !lista.length) { sl.innerHTML = ""; return; }
    sl.innerHTML = `<button type="button" class="btn sm vfbtn" title="Ver ${lista.length} fotografia${lista.length > 1 ? "s" : ""} desta atividade" aria-label="Ver fotografias">${ICON.galeria}<span class="num">${lista.length}</span></button>`;
    sl.querySelector("button").onclick = (e) => { e.stopPropagation(); abrirGaleria(lista.slice(), 0, () => render()); };
  });
}
function compress(file, max = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = 0.72, out = c.toDataURL("image/jpeg", q);
      while (out.length > 680000 && q > 0.3) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ============================================================ plano */
function planoView() {
  const p = ui.plano;
  const papel = store.user.papel;
  if (p.f == null) p.f = "todas";
  p.tipo = p.tipo || ""; p.ativ = p.ativ || ""; p.unidade = p.unidade || "";
  if (p.unidade) { const uu = S.uMap[p.unidade]; if (!uu || (p.bloco && uu.bloco !== p.bloco) || (p.tipo && uu.tipo !== p.tipo)) p.unidade = ""; }
  const unidadesFil = S.unidades.filter((u) => (!p.bloco || u.bloco === p.bloco) && (!p.tipo || u.tipo === p.tipo)); p.soAtr = !!p.soAtr; p.editar = !!p.editar && can("executar");
  if (p.semConc == null) p.semConc = true; // por defeito, não mostrar o que já está 100% concluído
  const concluida = (a, r) => r.estado === "concluida" || pctEfetiva(a) >= 100;
  const esconde = p.semConc && p.f !== "concluida";
  const hoje = S.hoje, lim = addDays(hoje, 14);
  const ESTADOS = [["todas", "Todas"], ["proximas", "Próximas 2 semanas"], ["nao_iniciada", "Não iniciadas"], ["em_curso", "Em curso"], ["bloqueada", "Bloqueadas"],
    ["atrasada", "Atrasadas"], ["concluida", "Concluídas"], ["porconfirmar", "Datas por confirmar"]];
  const TIPOS = [["", "Todas as frações"], ["Apartamento", "Apartamentos"], ["Loja", "Lojas"], ["Zona comum", "Zonas comuns"], ["Geral", "Geral"]];
  const testa = (k, r) => {
    switch (k) {
      case "proximas": return r.estado !== "concluida" && (r.estado === "em_curso" || r.inicio <= lim);
      case "nao_iniciada": return r.estado === "por_iniciar" || r.estado === "bloqueada";
      case "em_curso": return r.estado === "em_curso";
      case "atrasada": return r.atrasada;
      case "bloqueada": return r.estado === "bloqueada";
      case "semplano": case "porconfirmar": return r.semPlano && r.estado !== "concluida";
      case "concluida": return r.estado === "concluida";
      default: return true;
    }
  };
  const semAc = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const qt = semAc(p.q.trim()).split(/\s+/).filter(Boolean); // várias palavras: todas têm de aparecer, sem ligar a acentos
  // filtros de "onde" e "o quê" (os estados contam-se sobre este conjunto)
  const base = Object.values(S.acts).map((a) => ({ a, r: S.res.get(a.id) })).filter(({ a, r }) => {
    const u = S.uMap[a.unidade];
    if (!u) return false;
    if (u.teste && p.unidade !== u.id) return false; // as de teste só aparecem quando se escolhe essa fração
    if (p.bloco && u.bloco !== p.bloco) return false;
    if (p.tipo && u.tipo !== p.tipo) return false;
    if (p.unidade && a.unidade !== p.unidade) return false;
    if (p.ativ && nomeAtiv(a) !== p.ativ) return false;
    if (p.equipa === "_sem" ? !!a.equipa : p.equipa && a.equipa !== p.equipa) return false;
    if (p.soAtr && !r.atrasada) return false;
    if (esconde && concluida(a, r)) return false;
    if (qt.length) { const txt = semAc(nomeAtiv(a) + " " + a.unidade + " " + a.ref + " " + (a.equipa || "") + " " + (u.nome || "")); if (!qt.every((t) => txt.includes(t))) return false; }
    return true;
  });
  const conta = Object.fromEntries(ESTADOS.map(([k]) => [k, base.filter(({ r }) => testa(k, r)).length]));
  if (esconde) conta.concluida = Object.values(S.acts).filter((a) => {
    const u = S.uMap[a.unidade], r = S.res.get(a.id);
    return u && (!p.bloco || u.bloco === p.bloco) && (!p.tipo || u.tipo === p.tipo) && (!p.unidade || a.unidade === p.unidade) && (!p.ativ || nomeAtiv(a) === p.ativ) && (!p.equipa || a.equipa === p.equipa) && concluida(a, r);
  }).length;
  const list = base.filter(({ r }) => testa(p.f, r));
  // ordenação: por coluna escolhida (clique no título) ou a ordem natural do filtro
  const ORDEM_EST = { em_curso: 0, bloqueada: 1, por_iniciar: 2, concluida: 3 };
  const natU = (u) => { const x = S.uMap[u]; return x ? [x.bloco, String(x.piso).padStart(2, "0"), u].join("|") : u; };
  const CHAVE = {
    unidade: (x) => natU(x.a.unidade),
    atividade: (x) => nomeAtiv(x.a).toLocaleLowerCase("pt"),
    estado: (x) => ORDEM_EST[x.r.estado] * 10 + (x.r.atrasada ? 0 : 1),
    inicio: (x) => x.r.inicio || "",
    fim: (x) => x.r.fim || "",
    desvio: (x) => (x.r.atraso == null ? -99999 : x.r.atraso),
    pct: (x) => pctEfetiva(x.a),
  };
  const cmp = (va, vb) => (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt"));
  const natural = (x, y) => (p.f === "atrasada" ? (y.r.atraso || 0) - (x.r.atraso || 0) : 0) || (x.r.inicio || "").localeCompare(y.r.inicio || "") || x.a.unidade.localeCompare(y.a.unidade);
  if (p.sort && CHAVE[p.sort.col]) {
    const f = CHAVE[p.sort.col], dir = p.sort.dir === "desc" ? -1 : 1;
    list.sort((x, y) => dir * cmp(f(x), f(y)) || natural(x, y));
  } else list.sort(natural);
  const MAX = 300;
  const shown = list.slice(0, MAX);
  const nomes = [...new Set(Object.values(S.acts).map((a) => nomeAtiv(a)))].sort((a, b) => a.localeCompare(b, "pt"));
  const ed = p.editar, dono = papel === "dono";
  const atr = !!p.atribuir && can("executar");
  if (atr) p.selec = p.selec || new Set();
  const dIn = (id, campo, v, min) => `<input class="inp dt-in" type="date" data-ed="${id}|${campo}" value="${v || ""}" ${min ? `min="${min}"` : ""} aria-label="${campo}">`;
  ui.ligAberta = ui.ligAberta || new Set();
  const nCols = 7 + (atr ? 1 : 0);
  // ligações: o que esta atividade espera e o que espera por ela
  const ligItem = (id, de, comoSeg) => {
    const x = S.acts[id], rx = S.res.get(id); if (!x || !rx) return "";
    const pr = comoSeg ? ((rx.preds || []).find((q) => q.id === de) || {}) : ((S.res.get(de).preds || []).find((q) => q.id === id) || {});
    const porque = pr.fonte === "equipa" ? "mesma equipa, trabalho anterior" : pr.tipo === "SS" ? "começam juntas" : "";
    return `<li><button class="lnk-b" data-a="${id}"><span class="mono">${esc(x.unidade)}</span> <b>${esc(nomeAtiv(x))}</b></button>
      <span class="pill st-${rx.estado}">${ESTADO[rx.estado]}</span><span class="note num">${rx.estado === "concluida" ? "acabou a " + fd(rx.fim) : `${fd(rx.inicio)} a ${fd(rx.fim)}`}</span>${porque ? `<span class="note">(${porque})</span>` : ""}${rx.estado === "concluida" ? "" : deltaHTML(rx.atraso)}</li>`;
  };
  const ligHTML = (a, r) => {
    const ant = (r.preds || []).map((q) => q.id), seg = r.succ || [];
    const ord = (ids) => ids.slice().sort((x, y) => (S.res.get(x).inicio || "").localeCompare(S.res.get(y).inicio || ""));
    return `<tr class="lig-row"><td colspan="${nCols}"><div class="lig">
      <div><h4>Só começa depois de <span class="note num">${ant.length}</span></h4>${ant.length ? `<ul>${ord(ant).map((id) => ligItem(id, a.id, false)).join("")}</ul>` : `<p class="note">Nada: pode começar quando quiser.</p>`}</div>
      <div><h4>Dependem desta <span class="note num">${seg.length}</span></h4>${seg.length ? `<ul>${ord(seg).map((id) => ligItem(id, a.id, true)).join("")}</ul>` : `<p class="note">Nenhuma atividade espera por esta.</p>`}</div>
    </div></td></tr>`;
  };
  const linha = ({ a, r }) => {
    const nLig = (r.preds || []).length + (r.succ || []).length, aberta = ui.ligAberta.has(a.id);
    const bLig = `<button type="button" class="lig-b ${aberta ? "on" : ""}" data-lig="${a.id}" aria-expanded="${aberta}" title="Ver as atividades de que esta depende e as que dependem desta">${ICON.lig}<span class="num">${(r.preds || []).length} · ${(r.succ || []).length}</span></button>`;
    const espera = r.estado === "bloqueada" ? [...new Set(r.bloqueadaPor.map((id) => S.acts[id]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))] : [];
    const ini = r.inicio, fim = r.fim;
    const cIni = ed ? dIn(a.id, "ini", ini) : `<span class="mono num">${fd(ini)}</span>`;
    const cFim = ed ? dIn(a.id, "fim", fim) : `<span class="mono num">${fd(fim)}</span>`;
    const ck = atr ? `<td class="ck"><input type="checkbox" data-ck="${a.id}" ${p.selec.has(a.id) ? "checked" : ""} aria-label="Escolher ${esc(nomeAtiv(a) + " " + a.unidade)}"></td>` : "";
    return `<tr ${ed ? "" : atr ? `data-tck="${a.id}" class="${p.selec.has(a.id) ? "sel" : ""}"` : `data-a="${a.id}"`}>${ck}<td class="mono">${esc(a.unidade)}</td>
      <td><div class="lig-nm">${ed ? `<button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button>` : `<b>${esc(nomeAtiv(a))}</b>`}${nLig && !atr ? bLig : ""}</div>${a.equipa ? `<div class="note">${esc(a.equipa)}</div>` : atr ? `<div class="note semeq">sem equipa</div>` : ""}${espera.length ? `<div class="wait">À espera de: ${esc(espera.slice(0, 2).join(", "))}${espera.length > 2 ? "..." : ""}</div>` : ""}</td>
      <td>${ed || can("executar") ? estadoEdHTML(a, r) : `<span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>`}</td><td>${cIni}</td><td>${cFim}</td><td>${p.f === "porconfirmar" && can("executar") ? `<button class="btn sm" data-conf="${a.id}" title="A data mostrada está certa">Confirmar</button>` : deltaHTML(r.atraso)}</td><td class="mono num pctc2">${ed ? pctEdHTML(a) + pctFiscalHTML(a, true) : pctDuasHTML(a)}</td></tr>${aberta && !atr ? ligHTML(a, r) : ""}`;
  };
  const html = `
    <div class="card-h"><h1>Trabalhos</h1><div class="row">
      ${can("executar") ? `<button class="btn ${atr ? "warn" : ""}" id="pAtr" title="Escolher várias atividades para atribuir equipa, iniciar ou concluir de uma vez">${atr ? "Terminar escolha" : "Concluir ou atribuir várias"}</button>` : ""}
      ${can("executar") ? `<button class="btn ${ed ? "warn" : ""}" id="pEdit">${ed ? "Terminar edição" : "Editar datas"}</button>` : ""}
      ${can("criar") ? `<button class="btn pri" data-nova="">+ Nova atividade</button>` : ""}</div></div>
    ${ed ? `<div class="banner">Altere as datas e a percentagem diretamente na tabela, ou toque no estado para iniciar ou concluir hoje. Cada alteração fica guardada logo e as atividades que dependem desta acertam-se sozinhas.
      Nas atividades por iniciar muda a previsão; nas iniciadas ou concluídas, corrige a data real.</div>`
      : papel === "empreiteiro" && !atr ? `<div class="banner">Toque numa atividade para a iniciar, atualizar a percentagem ou concluir. Para mudar várias datas, use Editar datas.</div>` : ""}
    ${(() => {
      const r = [];
      if (p.bloco) r.push(blocoLabel(p.bloco));
      if (p.tipo) r.push((TIPOS.find(([k]) => k === p.tipo) || [, p.tipo])[1]);
      if (p.unidade) r.push(p.unidade);
      if (p.ativ) r.push(p.ativ);
      if (p.equipa) r.push(p.equipa === "_sem" ? "Sem equipa" : "Equipa " + p.equipa);
      if (p.f && p.f !== "todas") r.push((ESTADOS.find(([k]) => k === p.f) || [, p.f])[1]);
      if (p.soAtr) r.push("Só atrasadas");
      if (p.q.trim()) r.push(`procura "${p.q.trim()}"`);
      if (!p.semConc && p.f !== "concluida") r.push("com as concluídas");
      return r.length ? `<div class="fres" role="status"><span>Filtros ativos: <b>${r.map(esc).join(" · ")}</b></span><button class="btn sm repor-on" data-repor>Limpar filtros</button></div>` : "";
    })()}
    <div class="chips" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${p.bloco === b ? "on" : ""}" data-pb="${b}">${b === "Geral" ? "Geral" : b ? "Bloco " + b : "Todos os blocos"}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Estado">${ESTADOS.map(([k, l]) => `<button class="chip ${p.f === k ? "on" : ""}" data-pf="${k}">${l} <span class="num" style="opacity:.65">${conta[k]}</span></button>`).join("")}</div>
    <div class="filters">
      <label class="f">Frações<select class="inp" id="pt">${TIPOS.map(([k, l]) => `<option value="${k}" ${p.tipo === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Apartamento ou fração<select class="inp" id="pu"><option value="">Todas${p.bloco === "Geral" ? " do geral" : p.bloco ? " do bloco " + p.bloco : ""}</option>${["A", "B", "C", "D", "Geral"].map((g) => {
        const us = unidadesFil.filter((u) => u.bloco === g);
        return us.length ? `<optgroup label="${g === "Geral" ? "Geral" : "Bloco " + g}">${us.map((u) => `<option value="${esc(u.id)}" ${p.unidade === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</optgroup>` : "";
      }).join("")}${S.unidadesTeste.length ? `<optgroup label="Teste">${S.unidadesTeste.map((u) => `<option value="${esc(u.id)}" ${p.unidade === u.id ? "selected" : ""}>${esc(u.id)}</option>`).join("")}</optgroup>` : ""}</select></label>
      <label class="f">Atividade<select class="inp" id="pa"><option value="">Todas</option>${nomes.map((n) => `<option ${p.ativ === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="f">Equipa<select class="inp" id="pe"><option value="">Todas</option><option value="_sem" ${p.equipa === "_sem" ? "selected" : ""}>Sem equipa</option>${S.equipasTodas.map((e) => `<option ${p.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></label>
      <label class="f" style="flex:1;min-width:180px">Procurar<input class="inp" id="pq" value="${esc(p.q)}" placeholder="Ex.: B-F503, louças, 2#10"></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="psa" ${p.soAtr ? "checked" : ""}><span>Só atrasadas</span></label>
      <label class="check" style="align-self:center" title="${p.f === "concluida" ? "Não se aplica ao ver as concluídas" : "Esconde as atividades 100% concluídas"}"><input type="checkbox" id="psc" ${p.semConc ? "checked" : ""} ${p.f === "concluida" ? "disabled" : ""}><span>Esconder concluídas</span></label>
      ${filtrosAlterados() ? `<button class="btn sm repor-on" id="pclr" style="align-self:center">Limpar filtros</button>` : ""}
    </div>
    ${p.f === "porconfirmar" ? `<div class="banner warn"><span>Estas atividades nunca tiveram data. A aplicação deu-lhes a primeira data possível: hoje, ou logo a seguir às anteriores. Corra a lista e, em cada uma, corrija a data (com Editar datas) ou confirme que está certa. Ao mudar uma data, a atividade sai desta lista.</span>${can("executar") && shown.length ? `<button class="btn sm" id="confTodas">Confirmar as ${shown.length} mostradas</button>` : ""}</div>` : ""}
    ${atr ? `<div class="atrbar" id="atrbar">
      <label class="f atr-q">Procurar para escolher<input class="inp" id="atrQ" type="search" value="${esc(p.q)}" placeholder="Ex.: louças B-F503"></label>
      <span class="num"><b>${p.selec.size}</b> escolhida${p.selec.size === 1 ? "" : "s"}</span>
      <button class="btn sm" id="atrTodas">Escolher as ${shown.length} da lista</button>${p.selec.size ? `<button class="btn sm ghost" id="atrLimpa">Limpar escolha</button>` : ""}
      <span class="atr-g"><label class="f">Equipa<select class="inp" id="atrEq"><option value="">Escolha...</option>${S.equipas.map((e) => `<option ${p.atrEq === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_sem">Retirar a equipa</option><option value="_nova">+ Nova equipa...</option></select></label>
      <button class="btn pri" id="atrOk" ${p.selec.size ? "" : "disabled"}>Atribuir</button></span>
      <span class="atr-g"><label class="f">Data<input class="inp" type="date" id="atrData" value="${p.atrData || S.hoje}" max="${S.hoje}"></label>
      <button class="btn" id="atrIni" ${p.selec.size ? "" : "disabled"}>Iniciar</button>
      <button class="btn ok" id="atrConc" ${p.selec.size ? "" : "disabled"}>Concluir</button>
      <button class="btn" id="atrAnIni" ${p.selec.size ? "" : "disabled"} title="Apaga o início real das escolhidas que estão em curso: voltam a estar por iniciar">Anular início</button></span>
      <span class="atr-g"><label class="f">Previsão de início<input class="inp" type="date" id="prvIni" value="${p.prvIni || ""}"></label>
      <label class="f">Previsão de fim<input class="inp" type="date" id="prvFim" value="${p.prvFim || ""}"></label>
      <button class="btn" id="prvOk" ${p.selec.size ? "" : "disabled"} title="Muda a previsão das escolhidas. Se só indicar o início, o fim recalcula-se com a duração normal. Se só indicar o fim, o início fica como está.">Mudar previsão</button></span>
      <span class="note">Use os filtros (por exemplo Apartamento, Atividade ou Equipa) para chegar aos trabalhos certos e escolha-os. Depois atribua uma equipa, mude a previsão, inicie ou conclua todos na data indicada, ou anule o início.</span></div>` : ""}
    <div class="note num">${list.length} atividade${list.length === 1 ? "" : "s"}${esconde ? ` · concluídas escondidas <button class="btn sm ghost" id="pmostra" style="min-height:24px;padding:0 6px;text-decoration:underline">mostrar</button>` : ""}</div>
    ${shown.length ? `<div class="tbl-wrap"><table class="tbl ${ed ? "editing" : ""}"><thead><tr>${atr ? `<th class="ck"><input type="checkbox" id="atrCkAll" ${shown.length && shown.every(({ a }) => p.selec.has(a.id)) ? "checked" : ""} aria-label="Escolher todas"></th>` : ""}${[["unidade", "Fração"], ["atividade", "Atividade"], ["estado", "Estado"], ["inicio", ed ? "Início" : "Início previsto"], ["fim", ed ? "Fim" : "Fim previsto"], ["desvio", "Atraso"], ["pct", "% · F"]].map(([k, l]) => {
      const on = p.sort && p.sort.col === k;
      return `<th aria-sort="${on ? (p.sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button class="th-sort ${on ? "on" : ""}" data-sort="${k}" title="Ordenar por ${l.toLowerCase()}">${l}<span class="arr">${on ? (p.sort.dir === "desc" ? "▼" : "▲") : "↕"}</span></button></th>`;
    }).join("")}</tr></thead><tbody>
    ${shown.map(linha).join("")}</tbody></table></div>${list.length > MAX ? `<p class="note">A mostrar ${MAX} de ${list.length}. Use os filtros para afinar.</p>` : ""}`
    : `<div class="empty">${atr && p.equipa === "_sem" ? "Não há trabalhos sem equipa com estes filtros. Para mudar a equipa de trabalhos que já têm uma, ponha o filtro Equipa em Todas." : `Nenhuma atividade com estes filtros.${filtrosAlterados() ? ` <button class="btn sm" data-repor>Limpar filtros</button>` : ""}`}</div>`}`;
  return {
    html, bind: () => {
      bindCommon();
      document.querySelectorAll("[data-lig]").forEach((b) => (b.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = b.dataset.lig;
        if (ui.ligAberta.has(id)) ui.ligAberta.delete(id); else ui.ligAberta.add(id);
        render();
      }));
      document.querySelectorAll("[data-pf]").forEach((b) => (b.onclick = () => { p.f = b.dataset.pf; p._fToque = true; render(); }));
      document.querySelectorAll("[data-pb]").forEach((b) => (b.onclick = () => { p.bloco = b.dataset.pb; render(); }));
      $("#pt").onchange = (e) => { p.tipo = e.target.value; render(); };
      $("#pu").onchange = (e) => { p.unidade = e.target.value; render(); };
      $("#pa").onchange = (e) => { p.ativ = e.target.value; render(); };
      $("#pe").onchange = (e) => { p.equipa = e.target.value; render(); };
      $("#psa").onchange = (e) => { p.soAtr = e.target.checked; render(); };
      $("#psc").onchange = (e) => { p.semConc = e.target.checked; render(); };
      const pm = $("#pmostra"); if (pm) pm.onclick = () => { p.semConc = false; render(); };
      document.querySelectorAll("[data-conf]").forEach((b) => (b.onclick = async (e) => {
        e.stopPropagation();
        const a = S.acts[b.dataset.conf];
        await store.updateAtividade(a.id, { dataOk: true, inicioPrevisto: a.inicioPrevisto || a.planInicio ? a.inicioPrevisto || null : S.res.get(a.id).prevIni }, { tipo: "previsao", texto: `Confirmou as datas de ${nomeAtiv(a)} em ${a.unidade}` });
        toast("Datas confirmadas");
      }));
      const ct = $("#confTodas");
      if (ct) ct.onclick = async () => {
        ct.disabled = true;
        for (const { a, r } of shown) await store.updateAtividade(a.id, { dataOk: true, inicioPrevisto: a.inicioPrevisto || a.planInicio ? a.inicioPrevisto || null : r.prevIni }, null);
        await store.updateAtividade(shown[0].a.id, {}, { tipo: "previsao", texto: `Confirmou as datas de ${shown.length} atividades` });
        toast(`${shown.length} atividades confirmadas`);
      };
      document.querySelectorAll("[data-sort]").forEach((b) => (b.onclick = () => {
        const col = b.dataset.sort;
        const desc0 = col === "desvio" || col === "pct"; // maiores primeiro no primeiro clique
        if (!p.sort || p.sort.col !== col) p.sort = { col, dir: desc0 ? "desc" : "asc" };
        else if (p.sort.dir === (desc0 ? "desc" : "asc")) p.sort.dir = desc0 ? "asc" : "desc";
        else p.sort = null; // terceiro clique: volta à ordem normal
        render();
      }));
      const clr = $("#pclr"); if (clr) clr.onclick = reporFiltros;
      const pe = $("#pEdit"); if (pe) pe.onclick = () => { p.editar = !p.editar; if (p.editar) p.atribuir = false; render(); };
      const pat = $("#pAtr"); if (pat) pat.onclick = () => { p.atribuir = !p.atribuir; if (p.atribuir) p.editar = false; else p.selec = new Set(); render(); };
      if (atr) {
        const marca = (id, on) => { on ? p.selec.add(id) : p.selec.delete(id); };
        document.querySelectorAll("[data-ck]").forEach((c) => (c.onclick = (e) => { e.stopPropagation(); marca(c.dataset.ck, c.checked); render(); }));
        document.querySelectorAll("[data-tck]").forEach((tr) => (tr.onclick = () => { const id = tr.dataset.tck; marca(id, !p.selec.has(id)); render(); }));
        const all = $("#atrCkAll"); if (all) all.onclick = () => { const on = all.checked; shown.forEach(({ a }) => marca(a.id, on)); render(); };
        $("#atrTodas").onclick = () => { shown.forEach(({ a }) => p.selec.add(a.id)); render(); };
        const lp = $("#atrLimpa"); if (lp) lp.onclick = () => { p.selec = new Set(); render(); };
        const sel = $("#atrEq");
        sel.onchange = () => {
          if (sel.value === "_nova") { sel.value = p.atrEq || ""; openEquipa(null, { aoGravar: (nome) => { p.atrEq = nome; render(); } }); return; }
          p.atrEq = sel.value;
          $("#atrOk").disabled = !p.selec.size || !sel.value;
        };
        $("#atrOk").disabled = !p.selec.size || !sel.value;
        $("#atrOk").onclick = async () => {
          const v = sel.value; if (!v || !p.selec.size) return;
          if (v === "_sem" && !(await confirmar("Retirar a equipa?", `<p>Os ${p.selec.size} trabalhos escolhidos ficam sem equipa.</p>`))) return;
          const ids = [...p.selec].filter((id) => S.acts[id]);
          if ((await atribuirEquipa(ids, v === "_sem" ? null : v)) === false) return;
          p.selec = new Set();
        };
        const dt = $("#atrData");
        dt.onchange = () => { p.atrData = dt.value; };
        $("#atrConc").onclick = async () => { if (await concluirVarias([...p.selec], dt.value || S.hoje)) p.selec = new Set(), render(); };
        $("#atrIni").onclick = async () => { if (await iniciarVarias([...p.selec], dt.value || S.hoje)) p.selec = new Set(), render(); };
        $("#atrAnIni").onclick = async () => { if (await anularInicioVarias([...p.selec])) p.selec = new Set(), render(); };
        const pi = $("#prvIni"), pf = $("#prvFim");
        pi.onchange = () => { p.prvIni = pi.value; };
        pf.onchange = () => { p.prvFim = pf.value; };
        $("#prvOk").onclick = async () => { if (await previsaoVarias([...p.selec], pi.value, pf.value)) { p.selec = new Set(); p.prvIni = ""; p.prvFim = ""; render(); } };
      }
      let tm; const procura = (sel) => { const el = $(sel); if (el) el.oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { p.q = e.target.value; render(); const i = $(sel); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch {} } }, 300); }; };
      procura("#pq"); procura("#atrQ");
      bindDateInputs(document);
      bindEstadoPct(document);
    },
  };
}

/** Seletor de uma atividade de qualquer fração (para ligações entre apartamentos). */
function depPickerHTML(px, unidade, botao) {
  const grupos = ["A", "B", "C", "D", "Geral"];
  return `<div class="dpick">
    <div class="grid2" style="gap:8px">
      <label class="f">Fração<select class="inp" id="${px}U">${grupos.map((g) => {
        const us = S.unidades.filter((u) => u.bloco === g);
        return us.length ? `<optgroup label="${g === "Geral" ? "Geral" : "Bloco " + g}">${us.map((u) => `<option value="${esc(u.id)}" ${u.id === unidade ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</optgroup>` : "";
      }).join("")}</select></label>
      <label class="f">Atividade<select class="inp" id="${px}A"></select></label>
    </div>
    <label class="f">Tipo de ligação<select class="inp" id="${px}T"><option value="FS">Só começa quando a outra acabar</option><option value="SS">Pode começar quando a outra começar</option></select></label>
    <div class="row"><button type="button" class="btn" id="${px}B" disabled>${botao}</button><span class="note" id="${px}N"></span></div>
  </div>`;
}
function bindDepPicker(root, px, { excluir = new Set(), esp = null, self = null, onPick }) {
  const selU = root.querySelector("#" + px + "U"), selA = root.querySelector("#" + px + "A"), bt = root.querySelector("#" + px + "B"), nt = root.querySelector("#" + px + "N");
  const fill = (preferEsp) => {
    const u = S.uMap[selU.value];
    const lista = (u ? u.acts : []).filter((x) => !excluir.has(x.id));
    const escondidas = (u ? u.acts.length : 0) - lista.length - (u && self && u.acts.some((x) => x.id === self) ? 1 : 0);
    selA.innerHTML = `<option value="">Escolha...</option>` + lista.map((x) => {
      const r = S.res.get(x.id);
      return `<option value="${x.id}" ${preferEsp && x.esp === preferEsp ? "selected" : ""}>${esc(nomeAtiv(x))} (${ESTADO[r.estado].toLowerCase()}, fim ${fd(r.fim)})</option>`;
    }).join("");
    nt.textContent = escondidas ? `${escondidas} não aparece${escondidas > 1 ? "m" : ""}: já ligada${escondidas > 1 ? "s" : ""} ou dependente${escondidas > 1 ? "s" : ""} desta (evita ciclos).` : "";
    bt.disabled = !selA.value;
  };
  selU.onchange = () => fill(esp);
  selA.onchange = () => (bt.disabled = !selA.value);
  bt.onclick = () => { if (selA.value) onPick(selA.value, root.querySelector("#" + px + "T").value); };
  fill(null);
}

/** Campo de data que grava logo (usa editarData). */
const dateInput = (id, campo, v, extra = "") => `<input class="inp dt-in" type="date" data-ed="${id}|${campo}" value="${v || ""}" ${extra} aria-label="${{ ini: "Início", fim: "Fim", prevIni: "Previsão de início", prevFim: "Previsão de fim", realIni: "Início real", realFim: "Fim real" }[campo] || "Data"}">`;
/** Em modo de edição: o estado vira um menu (iniciar hoje, concluir hoje...) e a percentagem um campo. */
function estadoEdHTML(a, r) {
  const conc = r.estado === "concluida";
  const op = [];
  if (!a.realInicio && !conc) op.push(["ini", "Iniciar hoje"]);
  if (!conc) op.push(["fim", "Concluir hoje"]);
  if (conc) op.push(["reabrir", "Reabrir"]);
  if (a.realInicio && !conc) op.push(["anular", "Anular o início"]);
  return `<div class="fpick estpick"><button type="button" class="pill st-${r.estado} estb" data-estm="${a.id}" aria-haspopup="menu" title="Mudar o estado">${ESTADO[r.estado]} ▾</button>
    <div class="fmenu" hidden data-estmenu="${a.id}" role="menu">${op.map(([k, l]) => `<button type="button" class="fopt" role="menuitem" data-esta="${a.id}|${k}"><span><b>${l}</b>${k === "ini" || k === "fim" ? `<small>${fd(S.hoje, true)}</small>` : ""}</span></button>`).join("")}</div></div>`;
}
/** As duas percentagens (empreiteiro e fiscal), com a que conta destacada; avisa quando não estão de acordo. */
function pctDuasHTML(a) {
  const e = Math.round(Number(a.pctEmp) || 0), f = a.pctFiscal == null ? null : Math.round(Number(a.pctFiscal));
  if (a.concluido) return `<span class="p2 conta" title="Concluída">100%</span>`;
  if (f == null) return `<span class="p2 conta" title="Empreiteiro: ${e}%. Ainda sem vistoria do fiscal.">${e}%</span> <span class="p2 sv" title="Sem vistoria">· F s/v</span>`;
  const contaF = !!(a.fiscalEm && (!a.empEm || a.fiscalEm >= a.empEm));
  const dif = Math.abs(e - f) >= 15;
  const dica = `Empreiteiro ${e}%, fiscal ${f}%. Conta a ${contaF ? "do fiscal" : "do empreiteiro"}, por ser a mais recente.${dif ? " Diferença de " + Math.abs(e - f) + " pontos." : ""}`;
  return `<span class="p2wrap ${dif ? "dif" : ""}" title="${esc(dica)}"><span class="p2 ${contaF ? "" : "conta"}">${e}%</span> · <span class="p2 ${contaF ? "conta" : ""}">F ${f}%</span></span>`;
}
const pctFiscalHTML = (a) => `<span class="p2 sv"> F ${a.pctFiscal == null ? "s/v" : Math.round(Number(a.pctFiscal)) + "%"}</span>`;
const pctEdHTML = (a) => `<label class="pct-ed" title="Percentagem feita (empreiteiro)"><input class="inp num" type="number" min="0" max="100" step="5" inputmode="numeric" data-pcted="${a.id}" value="${Math.round(Number(a.pctEmp) || 0)}" aria-label="Percentagem feita de ${esc(nomeAtiv(a))} em ${esc(a.unidade)}"><span>%</span></label>`;
/** Pede confirmação e conclui a atividade hoje (com os avisos das seguintes). */
/* ---- Várias de uma vez (Trabalhos, Concluir ou atribuir várias). As seguintes acertam-se sozinhas pela sequência. */
const listaNomes = (xs, max = 6) => `<ul class="dlg-l">${xs.slice(0, max).map((a) => `<li>${esc(nomeAtiv(a))} em ${esc(a.unidade)}</li>`).join("")}${xs.length > max ? `<li class="note">e mais ${xs.length - max}</li>` : ""}</ul>`;
async function concluirVarias(ids, v) {
  if (!dataCompleta(v)) { toast("Escolha uma data completa.", { anular: false }); return false; }
  if (v > S.hoje) { toast("A data de conclusão não pode ser no futuro.", { anular: false }); return false; }
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const ja = todas.filter((a) => S.res.get(a.id).estado === "concluida");
  const depois = todas.filter((a) => S.res.get(a.id).estado !== "concluida" && a.realInicio && a.realInicio > v);
  const alvo = todas.filter((a) => !ja.includes(a) && !depois.includes(a));
  if (!alvo.length) { toast(ja.length ? "As atividades escolhidas já estão concluídas." : "Nenhuma pode ser concluída nessa data: começaram depois dela.", { anular: false }); return false; }
  const baixas = alvo.filter((a) => Math.round(pctEfetiva(a)) < 90);
  const k = await perguntar({
    titulo: `Concluir ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>Ficam concluídas a <b>${fd(v, true)}</b>, com 100%:</p>${listaNomes(alvo)}
      ${baixas.length ? `<div class="dlg-av">Atenção: ${baixas.length} ${baixas.length === 1 ? "está registada" : "estão registadas"} com menos de 90%.</div>` : ""}
      ${(() => { const n = alvo.filter((a) => pendDe(a.unidade, a.id).some(pendAberto)).length; return n ? `<div class="dlg-av">${n} ${n === 1 ? "tem" : "têm"} pendentes por resolver. Os pendentes continuam abertos.</div>` : ""; })()}
      ${ja.length ? `<p class="note">${ja.length} já ${ja.length === 1 ? "estava concluída e fica" : "estavam concluídas e ficam"} como ${ja.length === 1 ? "estava" : "estavam"}.</p>` : ""}
      ${depois.length ? `<p class="note">${depois.length} ${depois.length === 1 ? "começou" : "começaram"} depois de ${fd(v)} e não ${depois.length === 1 ? "é concluída" : "são concluídas"}.</p>` : ""}
      <p class="note">As atividades seguintes acertam-se sozinhas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: `Sim, concluir ${alvo.length}`, estilo: "ok" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  const em = new Date().toISOString();
  const lista = alvo.map((a) => { const r = S.res.get(a.id); return { id: a.id, patch: { realInicio: a.realInicio || (r.prevIni && r.prevIni <= v ? r.prevIni : v), realFim: v, concluido: true, pctEmp: 100, empEm: em } }; });
  await store.updateMuitas(lista, { tipo: "conclusao", texto: `${alvo.length} atividades concluídas a ${fd(v)}: ${alvo.slice(0, 3).map((a) => nomeAtiv(a) + " em " + a.unidade).join(", ")}${alvo.length > 3 ? "..." : ""}` });
  toast(`${alvo.length} atividade${alvo.length === 1 ? "" : "s"} concluída${alvo.length === 1 ? "" : "s"} a ${fd(v)}`);
  return true;
}
async function iniciarVarias(ids, v) {
  if (!dataCompleta(v)) { toast("Escolha uma data completa.", { anular: false }); return false; }
  if (v > S.hoje) { toast("A data de início real não pode ser no futuro.", { anular: false }); return false; }
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const alvo = todas.filter((a) => { const e = S.res.get(a.id).estado; return e === "por_iniciar" || e === "bloqueada"; });
  if (!alvo.length) { toast("As atividades escolhidas já estão iniciadas ou concluídas.", { anular: false }); return false; }
  const bloq = alvo.filter((a) => S.res.get(a.id).estado === "bloqueada");
  const k = await perguntar({
    titulo: `Iniciar ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>Ficam iniciadas a <b>${fd(v, true)}</b>:</p>${listaNomes(alvo)}
      ${bloq.length ? `<div class="dlg-av">Atenção: ${bloq.length} ainda ${bloq.length === 1 ? "está" : "estão"} à espera de outras atividades por concluir.</div>` : ""}
      ${todas.length > alvo.length ? `<p class="note">${todas.length - alvo.length} já ${todas.length - alvo.length === 1 ? "estava iniciada ou concluída e fica" : "estavam iniciadas ou concluídas e ficam"} como ${todas.length - alvo.length === 1 ? "estava" : "estavam"}.</p>` : ""}`,
    opcoes: [{ k: "sim", l: `Sim, iniciar ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  const em = new Date().toISOString();
  await store.updateMuitas(alvo.map((a) => ({ id: a.id, patch: { realInicio: v, pctEmp: Math.max(Number(a.pctEmp) || 0, 5), empEm: em } })), { tipo: "inicio", texto: `${alvo.length} atividades iniciadas a ${fd(v)}` });
  toast(`${alvo.length} atividade${alvo.length === 1 ? "" : "s"} iniciada${alvo.length === 1 ? "" : "s"} a ${fd(v)}`);
  return true;
}
async function anularInicioVarias(ids) {
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const conc = todas.filter((a) => S.res.get(a.id).estado === "concluida");
  const alvo = todas.filter((a) => a.realInicio && !conc.includes(a));
  if (!alvo.length) { toast(conc.length ? "As escolhidas estão concluídas. Para anular o início, apague primeiro o fim real." : "Nenhuma das escolhidas tem início real.", { anular: false }); return false; }
  const outras = todas.length - alvo.length - conc.length;
  const k = await perguntar({
    titulo: `Anular o início de ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>${alvo.length === 1 ? "Perde" : "Perdem"} o início real e ${alvo.length === 1 ? "volta" : "voltam"} a estar por iniciar:</p>${listaNomes(alvo)}
      ${conc.length ? `<p class="note">${conc.length} ${conc.length === 1 ? "está concluída e fica" : "estão concluídas e ficam"} como ${conc.length === 1 ? "estava" : "estavam"}. Para essas, apague primeiro o fim real.</p>` : ""}
      ${outras ? `<p class="note">${outras} ainda não ${outras === 1 ? "tinha" : "tinham"} começado.</p>` : ""}
      <p class="note">As datas previstas e as atividades seguintes acertam-se sozinhas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: `Sim, anular ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  await store.updateMuitas(alvo.map((a) => ({ id: a.id, patch: { realInicio: null } })), { tipo: "correcao", texto: `Anulou o início de ${alvo.length} atividades: ${alvo.slice(0, 3).map((a) => nomeAtiv(a) + " em " + a.unidade).join(", ")}${alvo.length > 3 ? "..." : ""}` });
  toast(`Início anulado em ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}`);
  return true;
}
async function previsaoVarias(ids, ini, fim) {
  if (!ini && !fim) { toast("Indique a previsão de início, a de fim, ou as duas.", { anular: false }); return false; }
  if ((ini && !dataCompleta(ini)) || (fim && !dataCompleta(fim))) { toast("Escolha datas completas.", { anular: false }); return false; }
  if (ini && fim && fim < ini) { toast("A previsão de fim não pode ser antes da de início.", { anular: false }); return false; }
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const alvo = [], fora = [], cedo = [];
  for (const a of todas) {
    const r = S.res.get(a.id);
    if (!r || r.estado === "concluida") { fora.push(a); continue; }
    const arrancou = !!a.realInicio;
    const novoIni = ini && !arrancou ? ini : null;
    const iniEf = novoIni || r.prevIni;
    if (fim && iniEf && fim < iniEf) { fora.push(a); continue; }
    if (novoIni) { const { es } = primeiraPossivel(r); if (es && novoIni < es) cedo.push(a); }
    alvo.push({ a, r, arrancou, novoIni });
  }
  if (!alvo.length) { toast("Nenhuma das escolhidas pode ficar com essa previsão.", { anular: false }); return false; }
  const quero = [ini ? `início a <b>${fd(ini, true)}</b>` : "", fim ? `fim a <b>${fd(fim, true)}</b>` : ""].filter(Boolean).join(" e ");
  const k = await perguntar({
    titulo: `Mudar a previsão de ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>Ficam com ${quero}:</p>${listaNomes(alvo.map((x) => x.a))}
      ${ini && !fim ? `<p class="note">O fim recalcula-se com a duração normal de cada uma.</p>` : ""}
      ${fim && !ini ? `<p class="note">O início previsto fica como está.</p>` : ""}
      ${cedo.length ? `<div class="dlg-av">Atenção: ${cedo.length} ${cedo.length === 1 ? "só pode" : "só podem"} começar mais tarde, porque ${cedo.length === 1 ? "espera" : "esperam"} por outras atividades. Nestas, a aplicação não deixa começar antes da primeira data possível.</div>` : ""}
      ${fora.length ? `<p class="note">${fora.length} ${fora.length === 1 ? "não é alterada" : "não são alteradas"} (já concluídas, ou o fim ficaria antes do início).</p>` : ""}
      <p class="note">As atividades seguintes acertam-se sozinhas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: `Sim, mudar ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  const em = new Date().toISOString();
  const lista = alvo.map(({ a, r, arrancou, novoIni }) => {
    const patch = { dataOk: true };
    if (arrancou) {
      if (ini) patch.inicioPrevisto = ini;
      if (fim) patch.fimPrevisto = fim;
    } else {
      if (novoIni) { patch.inicioPrevisto = novoIni; patch.fimPrevisto = null; patch.duracaoManual = null; }
      if (fim) { patch.duracaoManual = diffDays(novoIni || r.prevIni, fim); patch.fimPrevisto = null; }
    }
    return { id: a.id, patch };
  });
  await store.updateMuitas(lista, { tipo: "previsao", texto: `Previsão de ${alvo.length} atividades mudada${ini ? ": início " + fd(ini) : ""}${fim ? (ini ? "," : ":") + " fim " + fd(fim) : ""}` });
  toast(`Previsão mudada em ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}`);
  return true;
}
async function concluirHoje(id) {
  const a = S.acts[id], r = S.res.get(id);
  if (!a || !r || r.estado === "concluida") return;
  const pct = Math.round(pctEfetiva(a));
  const k = await perguntar({
    titulo: "Concluir esta atividade?",
    texto: `<p>${rotuloAt(a)} fica concluída hoje, <b>${fd(S.hoje, true)}</b>, com 100%.</p>${pct < 90 ? `<p class="note">Atenção: está registada com ${pct}%.</p>` : ""}${(() => { const n = pendDe(a.unidade, a.id).filter(pendAberto).length; return n ? `<div class="dlg-av">Esta atividade tem ${n} pendente${n === 1 ? "" : "s"} por resolver. Pode concluir na mesma; os pendentes continuam abertos.</div>` : ""; })()}<p class="note">Se se enganar, pode reabri-la depois.</p>`,
    opcoes: [{ k: "sim", l: "Sim, concluir hoje", estilo: "ok" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return render();
  return editarData(id, "realFim", S.hoje);
}
function bindEstadoPct(root) {
  root.querySelectorAll("[data-estm]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const m = root.querySelector(`[data-estmenu="${b.dataset.estm}"]`);
    const abrir = m.hidden;
    document.querySelectorAll(".fmenu").forEach((x) => (x.hidden = true));
    m.hidden = !abrir;
  }));
  root.querySelectorAll("[data-esta]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const [id, k] = b.dataset.esta.split("|"), a = S.acts[id];
    if (!a) return;
    const N = nomeAtiv(a) + " em " + a.unidade;
    b.closest(".fmenu").hidden = true;
    if (k === "ini") return editarData(id, "realIni", S.hoje);
    if (k === "fim") return concluirHoje(id);
    if ((k === "reabrir" || k === "anular") && !(await confirmar(k === "reabrir" ? "Reabrir esta atividade?" : "Anular o início?", k === "reabrir" ? `<p>${rotuloAt(a)} deixa de estar concluída e volta a estar em curso. A data real de fim é apagada.</p>` : `<p>${rotuloAt(a)} volta a estar por iniciar. A data real de início é apagada.</p>`, k === "reabrir" ? "Sim, reabrir" : "Sim, anular o início"))) return;
    if (k === "reabrir") { await store.updateAtividade(id, { concluido: false, realFim: null, pctEmp: Math.min(Number(a.pctEmp) || 0, 90), empEm: new Date().toISOString() }, { tipo: "reabrir", texto: `Reabriu ${N}` }); return toast(`Reaberta: ${N}`); }
    if (k === "anular") { await store.updateAtividade(id, { realInicio: null }, { tipo: "correcao", texto: `Anulou o início de ${N}` }); return toast("Início anulado: volta a estar por iniciar"); }
  }));
  root.querySelectorAll("[data-pcted]").forEach((inp) => (inp.onchange = async () => {
    const id = inp.dataset.pcted, a = S.acts[id], r = S.res.get(id);
    if (!a || !r) return;
    let v = Math.round(Number(inp.value));
    if (!isFinite(v)) return render();
    v = Math.max(0, Math.min(100, v));
    const N = nomeAtiv(a) + " em " + a.unidade;
    if (v >= 100 && r.estado !== "concluida") return concluirHoje(id); // 100% = concluída hoje, depois de confirmar
    if (v > 0 && !a.realInicio && r.estado !== "concluida") {
      await editarData(id, "realIni", S.hoje); // pode perguntar se a anterior ainda não acabou
      if (!S.acts[id].realInicio) return render(); // cancelou
    }
    await store.updateAtividade(id, { pctEmp: v, empEm: new Date().toISOString() }, { tipo: "progresso", texto: `${N}: ${v}% feito (empreiteiro)` });
    toast(`${N}: ${v}%`);
  }));
}
/** Atividades com datas impossíveis (ano antes de 1900, ex.: 0002-11-16), gravadas por engano ao escrever. */
const CAMPOS_DATA = ["realInicio", "realFim", "inicioPrevisto", "fimPrevisto"];
function datasEstranhas() {
  const out = [];
  for (const a of Object.values(S.acts)) {
    const maus = CAMPOS_DATA.filter((k) => a[k] && !dataCompleta(a[k]));
    if (maus.length) out.push({ a, maus, ex: a[maus[0]] });
  }
  return out;
}
async function limparDatasEstranhas() {
  const m = datasEstranhas(); if (!m.length) return;
  const k = await perguntar({ titulo: "Apagar as datas impossíveis?", texto: `<p>Estas datas foram gravadas por engano e não fazem sentido. Ficam em branco; as atividades voltam ao estado em que estavam antes.</p>${listaNomes(m.map((x) => x.a))}`,
    opcoes: [{ k: "sim", l: "Sim, apagar", estilo: "pri" }, { k: "nao", l: "Cancelar" }] });
  if (k !== "sim") return;
  const lista = m.map(({ a, maus }) => { const patch = {}; for (const c of maus) patch[c] = null; if (maus.includes("realFim")) patch.concluido = false; return { id: a.id, patch }; });
  await store.updateMuitas(lista, { tipo: "correcao", texto: `Apagou ${lista.length} datas impossíveis (gravadas por engano ao escrever)` });
  toast(`Datas impossíveis apagadas em ${lista.length} atividade${lista.length === 1 ? "" : "s"}`);
}
/** Data completa e plausível (o navegador dá datas como 0002-11-16 enquanto se escreve o ano). */
const dataCompleta = (v) => /^(19|20|21)\d\d-\d\d-\d\d$/.test(String(v || ""));
function bindDateInputs(root) {
  root.querySelectorAll("[data-ed]").forEach((inp) => {
    let espera = null, aEscrever = false;
    const gravar = () => {
      clearTimeout(espera); espera = null;
      const [id, campo] = inp.dataset.ed.split("|");
      const v = inp.value;
      if (v && !dataCompleta(v)) { if (!aEscrever) toast("Data incompleta: escreva o dia, o mês e o ano com 4 algarismos.", { anular: false }); return; }
      if (inp.dataset.gravado === v) return; // o mesmo valor não é gravado duas vezes
      inp.dataset.gravado = v;
      aEscrever = false;
      inp.blur();
      editarData(id, campo, v);
    };
    // escrito à mão: só grava quando a data estiver completa e a pessoa parar de escrever (ou sair do campo)
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); aEscrever = false; gravar(); } else if (e.key.length === 1 || e.key === "Backspace" || e.key.startsWith("Arrow")) aEscrever = true; };
    inp.onchange = () => {
      clearTimeout(espera);
      if (inp.value && !dataCompleta(inp.value)) return; // ainda a escrever o ano
      if (aEscrever) espera = setTimeout(() => { aEscrever = false; gravar(); }, 1500);
      else gravar(); // escolhida no calendário
    };
    inp.onblur = () => { if (aEscrever || espera) { aEscrever = false; gravar(); } };
  });
}

/** Grava uma data editada no plano. Traduz a data escolhida no campo certo conforme o estado da atividade. */
/** Caixa de diálogo própria (não bloqueia o navegador). Devolve a chave da opção escolhida, ou null. */
function perguntar({ titulo, texto, opcoes }) {
  return new Promise((resolve) => {
    document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove());
    document.body.insertAdjacentHTML("beforeend", `<div class="scrim dlg-s" data-dw="dlg"></div>
      <div class="dlg" data-dw="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">${titulo}</h2><div class="dlg-t">${texto}</div>
      <div class="dlg-b">${opcoes.map((o) => `<button class="btn ${o.estilo || ""}" data-dlg="${o.k}">${o.l}</button>`).join("")}</div></div>`);
    const fim = (k) => { document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove()); document.removeEventListener("keydown", esc_); resolve(k); };
    const esc_ = (e) => { if (e.key === "Escape") { e.stopPropagation(); fim(null); } };
    document.addEventListener("keydown", esc_);
    document.querySelectorAll("[data-dlg]").forEach((b) => (b.onclick = () => fim(b.dataset.dlg)));
    document.querySelector(".dlg-s").onclick = () => fim(null);
    const p = document.querySelector('.dlg [data-dlg]'); if (p) p.focus();
  });
}
/* ---- Correção única: atividades por concluir com o fim previsto já passado ficam com fim a DATA_CORR */
const DATA_CORR = "2026-11-01";
function expiradas() {
  return actsObra().filter((a) => { const r = S.res.get(a.id); return r && r.estado !== "concluida" && r.prevFim < S.hoje; });
}
function patchCorr(a) {
  const r = S.res.get(a.id);
  const p = { fimPrevisto: DATA_CORR, dataOk: true };
  // se o início previsto ficava depois do novo fim, recua mantendo a duração que tinha
  if (r.prevIni > DATA_CORR) p.inicioPrevisto = addDays(DATA_CORR, -Math.max(0, diffDays(r.prevIni, r.prevFim)));
  // por iniciar e já empurrada pelas antecessoras: fixa o início onde está, senão o fim andava outra vez
  else if (r.estado !== "em_curso" && r.prevIni !== (a.inicioPrevisto || a.planInicio)) p.inicioPrevisto = r.prevIni;
  return p;
}
async function corrigirExpiradas() {
  const lista = expiradas();
  if (!lista.length) return;
  const ids = new Set(lista.map((a) => a.id));
  const seg = new Set();
  for (const a of lista) for (const x of downstream(a.id, S.res)) if (!ids.has(x) && S.res.get(x).estado !== "concluida") seg.add(x);
  const k = await perguntar({
    titulo: "Corrigir datas expiradas",
    texto: `<p>${lista.length} atividades ainda não concluídas têm o fim previsto antes de hoje. Todas passam a ter fim previsto a <b>${fd(DATA_CORR, true)}</b>.</p><p>As ${seg.size} atividades seguintes a estas são recalculadas a partir das novas datas. É uma correção feita uma só vez; depois disto este aviso desaparece.</p>`,
    opcoes: [{ k: "sim", l: `Corrigir ${lista.length} atividades`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return;
  const antes = new Map([...seg].map((x) => [x, S.res.get(x).prevIni + "|" + S.res.get(x).prevFim]));
  await store.updateMuitas(lista.map((a) => ({ id: a.id, patch: patchCorr(a) })), { tipo: "previsao", texto: `Correção única: ${lista.length} atividades com o fim previsto já passado passaram a ter fim a ${fd(DATA_CORR, true)}` });
  await store.setConfig({ correcaoExpiradas: S.hoje });
  compute();
  let mexeram = 0; for (const [x, v] of antes) if (S.res.get(x).prevIni + "|" + S.res.get(x).prevFim !== v) mexeram++;
  toast(`${lista.length} atividades com fim previsto a ${fd(DATA_CORR, true)}. ${mexeram} atividades seguintes mudaram de data.`);
  render();
}
/** Confirmação para tudo o que anula ou retira alguma coisa. */
async function confirmar(titulo, texto, sim = "Sim, retirar") {
  const k = await perguntar({ titulo, texto, opcoes: [{ k: "sim", l: sim, estilo: "warn" }, { k: "nao", l: "Cancelar" }] });
  if (k !== "sim") { render(); return false; }
  return true;
}
const rotuloAt = (x, ref) => `<b>${esc(nomeAtiv(x))}</b>${!ref || x.unidade !== ref.unidade ? " em " + esc(x.unidade) : ""}`;
/** A primeira data em que a atividade pode começar e a antecessora que a impõe. */
function primeiraPossivel(r) {
  let es = null, quem = null;
  for (const d of r.preds) {
    const pr = S.res.get(d.id); if (!pr) continue;
    const c = d.tipo === "SS" ? pr.provIni : addDays(pr.provFim, 1);
    if (!es || c > es) { es = c; quem = S.acts[d.id]; }
  }
  return { es, quem };
}
/**
 * Depois de mudar o fim de uma atividade, pergunta o que fazer às seguintes ainda por iniciar.
 * patch: o que vai ser gravado nesta atividade (para simular o efeito antes de gravar).
 */
/** Ao mudar a data de início de uma atividade, mantém o prazo dela sem fixar o fim:
 *  se o prazo é o da especialidade, continua a acompanhar os dias por fração; senão fica como duração própria. */
function prazoDe(sid) {
  const x = S.acts[sid], xr = S.res.get(sid);
  const span = Math.max(0, diffDays(xr.prevIni, xr.prevFim));
  const padrao = duracaoDe({ ...x, duracaoManual: null }, S.cfg.duracoes || {});
  return { fimPrevisto: null, duracaoManual: span === padrao ? null : span };
}
async function decidirSeguintes(id, patch) {
  const a = S.acts[id];
  const naFracao = location.hash.startsWith("#u-"); // a editar no ecrã de um apartamento: só esse apartamento
  const porIniciar = (sid) => { const x = S.acts[sid], xr = S.res.get(sid); return x && xr && xr.estado !== "concluida" && !x.realInicio; };
  const abertas = [...downstream(id, S.res)].filter(porIniciar);
  if (!abertas.length) return null;
  const todasAct = () => Object.values(S.acts);
  const simul = schedule(todasAct().map((x) => (x.id === id ? { ...x, ...patch } : x)), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {});
  // o que conta para as seguintes é o fim provável (uma previsão já ultrapassada conta a partir de hoje)
  const delta = diffDays(S.res.get(id).provFim, simul.get(id).provFim);
  if (!delta) return null;
  const mesmas = abertas.filter((sid) => S.acts[sid].unidade === a.unidade);
  const outras = abertas.filter((sid) => S.acts[sid].unidade !== a.unidade);
  const alvo = naFracao ? mesmas : abertas;
  const desloca = (lista) => lista.map((sid) => { const xr = S.res.get(sid); return { id: sid, patch: { inicioPrevisto: addDays(xr.prevIni, delta), ...prazoDe(sid), dataOk: true } }; });
  // efeito noutras frações se as deste apartamento andarem
  const pAlvo = new Map(desloca(alvo).map((x) => [x.id, x.patch]));
  const simul2 = schedule(todasAct().map((x) => (x.id === id ? { ...x, ...patch } : pAlvo.has(x.id) ? { ...x, ...pAlvo.get(x.id) } : x)), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {});
  const outrasMexem = outras.filter((sid) => simul2.get(sid).prevIni !== S.res.get(sid).prevIni);
  // ligações que saem deste apartamento para outras frações (desta atividade ou das seguintes deste apartamento)
  const cortes = [];
  for (const pid of [id, ...mesmas]) for (const sid of S.res.get(pid).succ || []) { if (S.acts[sid] && S.acts[sid].unidade !== a.unidade && porIniciar(sid) && !(S.res.get(sid).preds || []).some((d) => d.id === pid && d.fonte === "equipa")) cortes.push({ sid, pid }); }
  const mexem = (naFracao ? mesmas : abertas).filter((sid) => simul.get(sid).prevIni !== S.res.get(sid).prevIni).length;
  const lst = naFracao ? mesmas : abertas;
  const n = lst.length, dias = Math.abs(delta), um = n === 1, frente = delta > 0;
  const D = `${dias} dia${dias === 1 ? "" : "s"}`;
  const lista = lst.slice(0, 4).map((sid) => `<li>${rotuloAt(S.acts[sid], a)} <span class="note">começa ${fd(S.res.get(sid).prevIni)}</span></li>`).join("") + (n > 4 ? `<li class="note">e mais ${n - 4}</li>` : "");
  const exO = outrasMexem.slice(0, 3).map((sid) => rotuloAt(S.acts[sid], a)).join(", ");
  const opcoes = [];
  if (n) opcoes.push({ k: "todas", l: naFracao ? (frente ? `Andar as deste apartamento ${D} para a frente` : `Puxar as deste apartamento ${D} para trás`) : (frente ? `Andar todas ${D} para a frente` : `Puxar todas ${D} para trás`), estilo: "pri" });
  if (naFracao && outrasMexem.length && cortes.length) opcoes.push({ k: "isolar", l: n ? "Só este apartamento: desligar das outras frações" : "Não mexer nas outras frações: desligá-las desta", estilo: n ? "" : "pri" });
  opcoes.push({ k: "so", l: frente ? "Só as que ficam em conflito" : "Deixar as seguintes onde estão" });
  const k = await perguntar({
    titulo: frente ? `O fim passa ${D} para a frente` : `O fim passa ${D} para trás`,
    texto: `${n ? `<p>Há ${um ? "1 atividade seguinte" : n + " atividades seguintes"} por iniciar${naFracao ? " neste apartamento" : ""} que ${um ? "depende" : "dependem"} desta:</p><ul class="dlg-l">${lista}</ul>` : `<p>Neste apartamento não há atividades por iniciar a seguir a esta.</p>`}
      ${n ? `<p class="note">${frente ? (mexem === n ? "Se não escolher andar todas, cada uma anda só o necessário para não começar antes de esta acabar." : mexem ? `Se não escolher andar todas, só ${mexem === 1 ? "1 anda" : mexem + " andam"} para a frente (as que ficariam a começar antes de esta acabar); as outras ficam nas datas que têm.` : "Nenhuma fica em conflito: se não escolher andar todas, ficam nas datas que têm.") : "Se não as puxar, ficam nas datas que têm e passa a haver folga entre esta e as seguintes."}</p>` : ""}
      ${naFracao && outrasMexem.length ? `<p class="dlg-av"><b>Atenção:</b> ${outrasMexem.length === 1 ? "1 atividade de outra fração também mexe" : outrasMexem.length + " atividades de outras frações também mexem"} (${exO}${outrasMexem.length > 3 ? "..." : ""}), porque ${outrasMexem.length === 1 ? "está ligada" : "estão ligadas"} a este apartamento (por exemplo, a mesma equipa passa daqui para a fração seguinte). Para mexer só neste apartamento, escolha desligar das outras frações: ${cortes.length === 1 ? "essa ligação deixa" : "essas " + cortes.length + " ligações deixam"} de existir.</p>` : ""}`,
    opcoes,
  });
  if (k === "todas") return { delta, lista: desloca(alvo), cortes: [] };
  if (k === "isolar") {
    // retira as ligações deste apartamento para outras frações (junta várias na mesma atividade)
    const porSid = new Map();
    for (const { sid, pid } of cortes) {
      const x = { ...S.acts[sid], ...(porSid.get(sid) || {}) };
      const d = (S.res.get(sid).preds || []).find((q) => q.id === pid); if (!d) continue;
      const pt = d.fonte === "manual" ? { depsExtra: (x.depsExtra || []).filter((e) => e.id !== pid) } : { depsIgnorar: [...new Set([...(x.depsIgnorar || []), pid])] };
      // fica nas datas que tem agora (sem a ligação voltaria às datas antigas do Excel)
      const xr = S.res.get(sid);
      porSid.set(sid, { ...(porSid.get(sid) || {}), ...pt, inicioPrevisto: xr.prevIni, ...prazoDe(sid), dataOk: true });
    }
    return { delta, lista: desloca(alvo), cortes: [...porSid.entries()].map(([sid, pt]) => ({ id: sid, patch: pt })) };
  }
  return null;
}
async function gravarComSeguintes(id, patch, registo, _delta, msg) {
  const dec = await decidirSeguintes(id, patch);
  const a = S.acts[id];
  if (dec && dec.cortes && dec.cortes.length) await store.updateMuitas(dec.cortes, { tipo: "dependencia", texto: `${dec.cortes.length} atividades de outras frações deixaram de esperar por ${a.unidade} (ao mudar ${nomeAtiv(a)})` });
  await store.updateAtividade(id, patch, registo);
  const seg = dec && dec.lista, delta = dec && dec.delta;
  const extra = dec && dec.cortes && dec.cortes.length ? `, ${dec.cortes.length} ligação${dec.cortes.length > 1 ? "ões" : ""} a outras frações retirada${dec.cortes.length > 1 ? "s" : ""}` : "";
  if (seg && seg.length) {
    await store.updateMuitas(seg, { tipo: "previsao", texto: `${seg.length} atividades seguintes de ${nomeAtiv(a)} em ${a.unidade} movidas ${delta > 0 ? "+" : ""}${delta} dias` });
    const ad = Math.abs(delta);
    return toast(`${msg}. ${seg.length > 1 ? "As seguintes foram" : "A seguinte foi"} ${delta > 0 ? "para a frente" : "para trás"} ${ad} dia${ad === 1 ? "" : "s"}${extra}`);
  }
  toast(msg + extra);
}

/** Grava uma data editada em qualquer ecrã, com avisos quando há conflito com as anteriores ou efeito nas seguintes. */
async function editarData(id, campo, v, { manterPrazo = false } = {}) {
  const a = S.acts[id], r = S.res.get(id);
  if (!a || !r) return;
  if (v && !dataCompleta(v)) return; // nunca grava datas a meio de escrever
  const N = nomeAtiv(a) + " em " + a.unidade;
  const reg = (texto) => ({ tipo: "previsao", texto });
  const falha = (msg) => { toast(msg); render(); };
  const conc = r.estado === "concluida";
  // campos genéricos (Trabalhos, Gantt): conforme o estado, é a previsão ou o real
  if (campo === "ini") campo = conc || a.realInicio ? "realIni" : "prevIni";
  if (campo === "fim") campo = conc ? "realFim" : "prevFim";
  if (campo === "planIni" || campo === "planFim") {
    if (store.user.papel !== "dono") return;
    const ini = campo === "planIni" ? v || null : a.planInicio || null;
    const fim = campo === "planFim" ? v || null : a.planFim || null;
    if (ini && fim && fim < ini) return falha("O fim do plano não pode ser antes do início.");
    await store.updateAtividade(id, { planInicio: ini, planFim: fim }, reg(`Plano original de ${N}: ${ini ? fd(ini) : "sem data"} a ${fim ? fd(fim) : "sem data"}`));
    return toast("Plano atualizado");
  }
  if (campo === "realIni") {
    if (!v) {
      if (conc) return falha("Para tirar o início real, apague primeiro o fim real.");
      if (!a.realInicio) return;
      if (!(await confirmar("Apagar o início real?", `<p>${rotuloAt(a)} volta a estar por iniciar.</p>`, "Sim, apagar"))) return;
      await store.updateAtividade(id, { realInicio: null }, { tipo: "correcao", texto: `Anulou o início de ${N}` });
      return toast("Início real apagado: volta a estar por iniciar");
    }
    if (v > S.hoje) return falha(`O início real é o dia em que a atividade começou de facto, por isso não pode ser no futuro. Se vai começar a ${fd(v)}, mude a Previsão de início; no dia, registe o início real.`);
    if (a.realFim && conc && v > a.realFim) return falha("O início não pode ser depois do fim real.");
    if (!a.realInicio) {
      // arrancar com antecessoras por acabar
      const pend = r.preds.filter((d) => d.tipo !== "SS" && S.res.get(d.id) && S.res.get(d.id).estado !== "concluida").map((d) => S.acts[d.id]).filter(Boolean);
      if (pend.length) {
        const q = pend[0], qr = S.res.get(q.id);
        const k = await perguntar({
          titulo: "A atividade anterior ainda não acabou",
          texto: `<p>${rotuloAt(a)} só devia começar depois de ${rotuloAt(q, a)}, que está ${ESTADO[qr.estado].toLowerCase()} (${Math.round(pctEfetiva(q))}%) e tem fim previsto a ${fd(qr.provFim)}.${pend.length > 1 ? ` Há mais ${pend.length - 1} por acabar.` : ""}</p>`,
          opcoes: [{ k: "ver", l: `Ver ${esc(nomeAtiv(q))}`, estilo: "pri" }, { k: "sim", l: "Iniciar mesmo assim" }, { k: "nao", l: "Cancelar" }],
        });
        if (k === "ver") { render(); return openSheet(q.id, { empilhar: !!ui.sheet && ui.sheet.id === id }); }
        if (k !== "sim") return render();
      }
    }
    const ja = !!a.realInicio;
    await store.updateAtividade(id, { realInicio: v, pctEmp: Math.max(Number(a.pctEmp) || 0, 5), empEm: new Date().toISOString() }, { tipo: ja ? "correcao" : "inicio", texto: ja ? `Corrigiu o início real de ${N} para ${fd(v)}` : `${N} iniciada a ${fd(v)}` });
    return toast(ja ? "Início real corrigido" : `Iniciada a ${fd(v)}: ${N}`);
  }
  if (campo === "realFim") {
    if (!v) {
      if (!conc) return;
      if (!(await confirmar("Apagar o fim real?", `<p>${rotuloAt(a)} deixa de estar concluída e volta a estar em curso.</p>`, "Sim, apagar e reabrir"))) return;
      await store.updateAtividade(id, { realFim: null, concluido: false, pctEmp: Math.min(Number(a.pctEmp) || 0, 90), empEm: new Date().toISOString() }, { tipo: "reabrir", texto: `Reabriu ${N}` });
      return toast("Fim real apagado: a atividade volta a estar em curso");
    }
    if (v > S.hoje) return falha(`O fim real é o dia em que a atividade acabou de facto, por isso não pode ser no futuro. Se vai acabar a ${fd(v)}, mude a Previsão de fim.`);
    const ini = a.realInicio || (r.prevIni && r.prevIni <= v ? r.prevIni : v);
    if (v < ini) return falha("O fim real não pode ser antes do início real.");
    const patch = { realInicio: ini, realFim: v, concluido: true, pctEmp: 100, empEm: new Date().toISOString() };
    return gravarComSeguintes(id, patch, { tipo: "conclusao", texto: conc ? `Corrigiu o fim real de ${N} para ${fd(v)}` : `${N} concluída a ${fd(v)}` },
      diffDays(r.provFim, v), conc ? "Fim real corrigido" : `Concluída a ${fd(v)}`);
  }
  if (campo === "prevIni") {
    if (!v) return falha("Escolha uma data.");
    if (a.realInicio || conc) {
      // já arrancou: só muda a referência para o atraso de início
      await store.updateAtividade(id, { inicioPrevisto: v, dataOk: true }, reg(`Previsão de início de ${N} corrigida para ${fd(v)}`));
      return toast("Previsão guardada");
    }
    const { es, quem } = primeiraPossivel(r);
    let dia = v;
    if (es && v < es && quem) {
      const qr = S.res.get(quem.id);
      const podeLig = can("executar");
      const k = await perguntar({
        titulo: `Não pode começar a ${fd(v)}`,
        texto: `<p>${rotuloAt(a)} só pode começar quando ${rotuloAt(quem, a)} ${qr.estado === "concluida" ? "acabar, e acabou" : "acabar, e o fim previsto é"} a <b>${fd(qr.provFim)}</b>.</p><p>A primeira data possível é <b>${fd(es)}</b>.</p>`,
        opcoes: [
          { k: "es", l: `Começar a ${fd(es)}`, estilo: "pri" },
          { k: "ver", l: `Rever ${esc(nomeAtiv(quem))}` },
          ...(podeLig ? [{ k: "tirar", l: "Deixar de depender dela" }] : []),
          { k: "nao", l: "Cancelar" },
        ],
      });
      if (k === "ver") { render(); return openSheet(quem.id, { empilhar: !!ui.sheet && ui.sheet.id === id }); }
      if (k === "tirar") {
        const pt = patchTirarLigacao(id, quem.id);
        if (pt) await store.updateAtividade(id, pt, { tipo: "dependencia", texto: `${N} deixou de esperar por ${nomeAtiv(quem)} em ${quem.unidade}` });
        const r2 = schedule(Object.values(S.acts), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}).get(id);
        const out = primeiraPossivel({ preds: r2.preds });
        if (out.es && v < out.es) dia = out.es; // ainda há outra a impor uma data
      } else if (k === "es") dia = es;
      else return render();
    }
    const delta = diffDays(r.prevIni, dia);
    // nova previsão de início: o fim volta a contar com a duração normal desta atividade (a do Gantt, ao arrastar a barra, mantém o prazo)
    const patch = { inicioPrevisto: dia, dataOk: true, ...(manterPrazo ? prazoDe(id) : { fimPrevisto: null, duracaoManual: null }) };
    return gravarComSeguintes(id, patch, reg(`Nova previsão de início para ${N}: ${fd(dia)}`), delta,
      dia !== v ? `Fica a ${fd(dia)}` : delta ? "Previsão guardada" : "Sem alteração");
  }
  if (campo === "prevFim") {
    if (!v) return falha("Escolha uma data.");
    if (v < (r.prevIni || v)) return falha("A previsão de fim não pode ser antes da previsão de início.");
    const patch = !a.realInicio && !conc ? { duracaoManual: diffDays(r.prevIni, v), fimPrevisto: null, dataOk: true } : { fimPrevisto: v, dataOk: true };
    return gravarComSeguintes(id, patch, reg(`Nova previsão de fim para ${N}: ${fd(v)}`), conc ? 0 : diffDays(r.prevFim, v),
      !a.realInicio && !conc ? `Previsão guardada: ${patch.duracaoManual} dias` : "Previsão guardada");
  }
}

/* ============================================================ a minha semana (empreiteiro) */
function semanaView() {
  const w = (ui.semana = ui.semana || { equipa: "", bloco: "", ver: "" });
  const hoje = S.hoje, lim = addDays(hoje, 7);
  const base = Object.values(S.acts).map((a) => ({ a, r: S.res.get(a.id) })).filter(({ a }) => {
    const u = S.uMap[a.unidade];
    if (!u || u.teste) return false;
    if (w.bloco && u.bloco !== w.bloco) return false;
    if (w.equipa === "_sem" ? a.equipa : w.equipa && a.equipa !== w.equipa) return false;
    return true;
  });
  const emCurso = base.filter(({ r }) => r.estado === "em_curso").sort((x, y) => x.r.fim.localeCompare(y.r.fim));
  const comecar = base.filter(({ r }) => r.estado === "por_iniciar" && r.inicio <= lim).sort((x, y) => x.r.inicio.localeCompare(y.r.inicio) || x.a.unidade.localeCompare(y.a.unidade));
  const espera = base.filter(({ r }) => r.estado === "bloqueada" && r.inicio <= addDays(lim, 7)).sort((x, y) => x.r.inicio.localeCompare(y.r.inicio));
  const acabar = emCurso.filter(({ r }) => r.provFim <= lim).length; // pelo fim provável (as já atrasadas contam a partir de hoje)
  const VER = [["", "Tudo"], ["curso", "Em curso"], ["comecar", "Para começar"], ["espera", "À espera de outras"]];
  const MAX = 60;
  const linha = ({ a, r }, tipo) => {
    const pct = Math.round(a.pctEmp ?? 0);
    const esperaPor = tipo === "espera" ? [...new Set(r.bloqueadaPor.map((id) => S.acts[id]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))] : [];
    return `<div class="srow ${r.atrasada ? "atr" : ""}">
      <span class="mono su">${esc(a.unidade)}</span>
      <button class="lnk-b sn" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b>${a.equipa ? `<small>${esc(a.equipa)}</small>` : ""}${esperaPor.length ? `<small class="wait1">à espera de ${esc(esperaPor.slice(0, 2).join(", "))}${esperaPor.length > 2 ? "..." : ""}</small>` : ""}</button>
      <div class="si">${tipo === "curso" ? `<div class="sbar"><i style="width:${pct}%"></i></div><span class="num mono">${pct}%</span><span class="note">até ${fd(r.fim)}</span>`
        : `<span class="note">${r.inicio < hoje ? `devia ter começado a ${fd(r.inicio)}` : `${tipo === "espera" ? "pode começar" : "começa"} ${r.inicio === hoje ? "hoje" : fd(r.inicio)}`}</span>`}${deltaHTML(r.atraso)}</div>
      <div class="sa">${tipo === "curso" ? `<button class="btn sm" data-q="mais|${a.id}" ${pct >= 95 ? "disabled" : ""}>+10%</button><button class="btn sm ok" data-q="fim|${a.id}">Concluir</button>`
        : tipo === "comecar" ? `<button class="btn sm pri" data-q="ini|${a.id}">Iniciar</button>` : `<button class="btn sm" data-a="${a.id}">Ver ficha</button>`}</div>
    </div>`;
  };
  const secao = (titulo, sub, lista, tipo, filtro) => `<section class="card">
    <div class="card-h"><h2>${titulo} <span class="note num">${lista.length}</span></h2>${sub ? `<span class="note">${sub}</span>` : ""}</div>
    ${lista.length ? `<div class="srows">${lista.slice(0, MAX).map((x) => linha(x, tipo)).join("")}</div>${lista.length > MAX ? `<a class="note" href="#plano" data-semver="${filtro}">Ver as ${lista.length} nos Trabalhos</a>` : ""}`
      : `<div class="empty">${w.equipa || w.bloco ? `Nada nesta lista com estes filtros. <button class="btn sm" data-repor>Limpar filtros</button>` : "Nada nesta lista."}</div>`}
  </section>`;
  const html = `
    <div class="card-h"><h1>A minha semana</h1><span class="note">De hoje, ${fd(hoje)}, a ${fd(lim)}</span></div>
    <div class="kpis kpis3">
      <button class="kpi k-curso ${w.ver === "curso" ? "sel" : ""}" data-sver="curso" aria-pressed="${w.ver === "curso"}" title="Mostrar só as em curso"><b>${emCurso.length}</b><span>Em curso, ${acabar} acabam esta semana</span></button>
      <button class="kpi k-ok ${w.ver === "comecar" ? "sel" : ""}" data-sver="comecar" aria-pressed="${w.ver === "comecar"}" title="Mostrar só as para começar"><b>${comecar.length}</b><span>Para começar até ${fd(lim)}</span></button>
      <button class="kpi k-bloq ${w.ver === "espera" ? "sel" : ""}" data-sver="espera" aria-pressed="${w.ver === "espera"}" title="Mostrar só as à espera"><b>${espera.length}</b><span>À espera de outras atividades</span></button>
    </div>
    ${atencaoHTML({ max: 3, vist: false, fechavel: true })}
    <div class="chips" role="group" aria-label="Mostrar">${VER.map(([k, l]) => `<button class="chip ${w.ver === k ? "on" : ""}" data-sver2="${k}">${l}${k ? ` <span class="num" style="opacity:.65">${{ curso: emCurso, comecar, espera }[k].length}</span>` : ""}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${w.bloco === b ? "on" : ""}" data-sb="${b}">${b === "Geral" ? "Geral" : b ? "Bloco " + b : "Todos os blocos"}</button>`).join("")}</div>
    <div class="filters"><label class="f">Equipa<select class="inp" id="sEq"><option value="">Todas as equipas</option>${S.equipasTodas.map((e) => `<option ${w.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_sem" ${w.equipa === "_sem" ? "selected" : ""}>Sem equipa atribuída</option></select></label></div>
    ${!w.ver || w.ver === "curso" ? secao("Em curso", "Atualize a percentagem ou conclua", emCurso, "curso", "em_curso") : ""}
    ${!w.ver || w.ver === "comecar" ? secao("Para começar", `Até ${fd(lim)}, já com as anteriores concluídas`, comecar, "comecar", "proximas") : ""}
    ${!w.ver || w.ver === "espera" ? secao("À espera de outras", "Ainda não podem começar: falta acabar o que está indicado", espera, "espera", "bloqueada") : ""}`;
  return {
    html, bind: () => {
      bindCommon(); bindAtencao();
      document.querySelectorAll("[data-sb]").forEach((b) => (b.onclick = () => { w.bloco = b.dataset.sb; render(); }));
      document.querySelectorAll("[data-sver]").forEach((b) => (b.onclick = () => { w.ver = w.ver === b.dataset.sver ? "" : b.dataset.sver; render(); }));
      document.querySelectorAll("[data-sver2]").forEach((b) => (b.onclick = () => { w.ver = b.dataset.sver2; render(); }));
      $("#sEq").onchange = (e) => { w.equipa = e.target.value; render(); };
      document.querySelectorAll("[data-semver]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, PLANO_PADRAO(), { f: b.dataset.semver, bloco: w.bloco, equipa: w.equipa === "_sem" ? "" : w.equipa }); }));
      document.querySelectorAll("[data-q]").forEach((b) => (b.onclick = async () => {
        const [acao, id] = b.dataset.q.split("|");
        const a = S.acts[id]; const N = nomeAtiv(a) + " em " + a.unidade;
        const agora = new Date().toISOString(), pct = Math.round(a.pctEmp ?? 0);
        b.disabled = true;
        if (acao === "ini") await editarData(id, "realIni", S.hoje);
        else if (acao === "mais") { const v = Math.min(95, pct + 10); await store.updateAtividade(id, { pctEmp: v, empEm: agora, ...(a.realInicio ? {} : { realInicio: S.hoje }) }, { tipo: "progresso", texto: `${N}: ${v}% feito (empreiteiro)` }); toast(`${N}: ${v}%`); }
        else if (acao === "fim") await concluirHoje(id);
      }));
    },
  };
}

/* ============================================================ relatório para reuniões */
const fdc = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
function relatorioView() {
  const t = S.tot;
  const blocos = {};
  for (const u of S.unidades) {
    const k = u.tipo === "Loja" ? "Lojas" : u.bloco;
    const b = (blocos[k] = blocos[k] || { dur: 0, feito: 0, fim: null, n: 0, atr: 0, conc: 0 });
    b.dur += u.dur; b.feito += u.feito; b.n += u.acts.length; b.atr += u.n.atrasada; b.conc += u.n.concluida;
    if (!b.fim || (u.fim && u.fim > b.fim)) b.fim = u.fim;
  }
  const grupos = {};
  for (const a of actsObra()) {
    const r = S.res.get(a.id);
    if (r.estado === "concluida" || !(r.atraso > 0)) continue;
    const g = (grupos[nomeAtiv(a)] = grupos[nomeAtiv(a)] || { nome: nomeAtiv(a), max: 0, n: 0, us: [] });
    g.max = Math.max(g.max, r.atraso); g.n++; g.us.push(a.unidade);
  }
  const atrG = Object.values(grupos).sort((x, y) => y.max - x.max).slice(0, 12);
  const comentarios = actsObra().filter((a) => a.fiscalNota && a.fiscalNotaEm).sort((x, y) => y.fiscalNotaEm.localeCompare(x.fiscalNotaEm)).slice(0, 15);
  const fr = S.unidades.filter((u) => u.acts.length);
  const html = `
    <div class="rel-acoes no-print"><a class="back" href="#painel">Painel</a>
      <div class="row"><button class="btn pri" id="rPrint">Imprimir ou guardar em PDF</button><button class="btn" id="rCsv">Descarregar tabela</button></div></div>
    <article class="rel">
      <header class="rel-h"><div><div class="eyebrow">Ponto de situação</div><h1>Obra ${esc(S.cfg.nome || "")}</h1></div><div class="rel-d">${fd(S.hoje, true)}</div></header>
      <section class="rel-kpis">
        <div><b>${fd(t.fim, true)}</b><span>fim previsto da obra</span></div>
        <div><b class="num">${t.concluida}/${t.n}</b><span>atividades concluídas</span></div>
        <div><b class="num">${t.em_curso}</b><span>em curso</span></div>
        <div><b class="num">${t.atrasada}</b><span>atrasadas</span></div>
        <div><b class="num">${t.bloqueada}</b><span>à espera de outras</span></div>
      </section>
      <h2>Avanço por bloco</h2>
      <table class="rel-t"><thead><tr><th>Bloco</th><th>Avanço</th><th>Concluídas</th><th>Atrasadas</th><th>Fim previsto</th></tr></thead><tbody>
      ${["A", "B", "C", "D", "Lojas", "Geral"].filter((k) => blocos[k]).map((k) => { const b = blocos[k]; const p = b.dur ? Math.round((100 * b.feito) / b.dur) : 0;
        return `<tr><td>${k.length === 1 ? "Bloco " + k : k}</td><td><span class="rel-bar"><i style="width:${p}%"></i></span> ${p}%</td><td class="num">${b.conc}/${b.n}</td><td class="num">${b.atr}</td><td>${fd(b.fim, true)}</td></tr>`; }).join("")}
      </tbody></table>
      <h2>Maiores atrasos por especialidade</h2>
      ${atrG.length ? `<table class="rel-t"><thead><tr><th>Especialidade</th><th>Frações</th><th>Maior atraso</th><th>Onde</th></tr></thead><tbody>
      ${atrG.map((g) => `<tr><td>${esc(g.nome)}</td><td class="num">${g.n}</td><td class="num">${g.max} dias</td><td class="mono small rel-onde">${g.us.slice(0, 8).map((x) => `<span>${esc(x)}</span>`).join(", ")}${g.us.length > 8 ? " ..." : ""}</td></tr>`).join("")}</tbody></table>` : `<p>Sem atividades atrasadas.</p>`}
      <h2>Situação por fração</h2>
      <table class="rel-t"><thead><tr><th>Fração</th><th>Avanço</th><th>Concluídas</th><th>Em curso</th><th>Atrasadas</th><th>Fim previsto</th><th>Última vistoria</th></tr></thead><tbody>
      ${fr.map((u) => { const uv = ultimaVistoria(u); return `<tr><td class="mono">${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</td><td class="num">${u.pct}%</td><td class="num">${u.n.concluida}/${u.acts.length}</td><td class="num">${u.n.em_curso}</td><td class="num">${u.n.atrasada}</td><td>${fd(u.fim, true)}</td><td>${uv ? fdc(uv.slice(0, 10)) : "nunca"}</td></tr>`; }).join("")}
      </tbody></table>
      ${comentarios.length ? `<h2>Últimos comentários da fiscalização</h2><ul class="rel-c">${comentarios.map((a) => `<li><b>${esc(a.unidade)} · ${esc(nomeAtiv(a))}</b> (${fdc(a.fiscalNotaEm.slice(0, 10))}): ${esc(a.fiscalNota)}</li>`).join("")}</ul>` : ""}
      <p class="note">Gerado pela aplicação de controlo de obra a ${fd(S.hoje, true)}. As datas são previsões, recalculadas com o estado real e a sequência dos trabalhos.</p>
    </article>`;
  return {
    html, bind: () => {
      $("#rPrint").onclick = () => { try { window.print(); } catch (e) { toast("Este navegador não deixa imprimir daqui."); } };
      $("#rCsv").onclick = () => descarregarCSV();
    },
  };
}
function descarregarCSV() {
  const cab = ["Fração", "Bloco", "Tipo", "Atividade", "Equipa", "Estado", "Atrasada", "Início previsto", "Fim previsto", "Atraso (dias)", "% empreiteiro", "% fiscal", "Início real", "Fim real", "Último comentário"];
  const q = (v) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const linhas = [cab.join(";")];
  for (const u of S.unidades) for (const a of u.acts) {
    const r = S.res.get(a.id);
    linhas.push([u.id, u.bloco, u.tipo, nomeAtiv(a), a.equipa || "", ESTADO[r.estado], r.atrasada ? "sim" : "não", fdc(r.inicio), fdc(r.fim), r.atraso ?? "", Math.round(a.pctEmp ?? 0), a.pctFiscal == null ? "" : Math.round(a.pctFiscal), fdc(a.realInicio), r.estado === "concluida" ? fdc(a.realFim) : "", a.fiscalNota || ""].map(q).join(";"));
  }
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `obra-${(S.cfg.nome || "obra").toLowerCase()}-${S.hoje}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Tabela descarregada", { anular: false });
}

/* ============================================================ pesquisa rápida */
function pesquisaHTML(id) {
  return `<div class="psq" id="${id}"><input class="inp" type="search" placeholder="Procurar apartamento ou atividade" aria-label="Procurar" autocomplete="off"><div class="psq-r" hidden></div></div>`;
}
function ligarPesquisa(root) {
  const inp = root.querySelector("input"), out = root.querySelector(".psq-r");
  let res = [];
  const norm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const procurar = () => {
    const q = norm(inp.value.trim());
    if (q.length < 2) { out.hidden = true; res = []; return; }
    const fr = S.unidades.filter((u) => norm(u.id + " " + u.nome).includes(q) || norm(u.id).replace(/-/g, "").includes(q.replace(/[-\s]/g, ""))).slice(0, 6).map((u) => ({ t: "u", u }));
    const termos = q.split(/\s+/);
    const nomes = [...new Set(Object.values(S.acts).map((a) => nomeAtiv(a)))].filter((n) => termos.every((t) => norm(n).includes(t))).slice(0, 4).map((n) => ({ t: "n", n }));
    const at = Object.values(S.acts).filter((a) => { const s = norm(nomeAtiv(a) + " " + a.unidade + " " + a.ref + " " + (a.equipa || "")); return termos.every((t) => s.includes(t)); })
      .slice(0, 8).map((a) => ({ t: "a", a }));
    res = [...fr, ...nomes, ...at];
    out.innerHTML = res.length ? res.map((x, i) => x.t === "u" ? `<button data-pr="${i}"><span class="psq-k">Fração</span><b class="mono">${esc(x.u.id)}</b><span class="note">${esc(x.u.tipo)} · ${x.u.pct}%</span></button>`
      : x.t === "n" ? `<button data-pr="${i}"><span class="psq-k">Todas</span><b>${esc(x.n)}</b><span class="note">ver nos Trabalhos</span></button>`
      : `<button data-pr="${i}"><span class="psq-k">Atividade</span><b>${esc(nomeAtiv(x.a))}</b><span class="note mono">${esc(x.a.unidade)} · ${ESTADO[S.res.get(x.a.id).estado]}</span></button>`).join("")
      : `<div class="note" style="padding:10px">Sem resultados para "${esc(inp.value)}".</div>`;
    out.hidden = false;
    out.querySelectorAll("[data-pr]").forEach((b) => (b.onclick = () => abrir(res[+b.dataset.pr])));
  };
  const abrir = (x) => {
    if (!x) return;
    inp.value = ""; out.hidden = true;
    document.querySelectorAll(".psq-ov").forEach((e) => e.remove());
    if (x.t === "u") location.hash = "#u-" + x.u.id;
    else if (x.t === "n") { Object.assign(ui.plano, PLANO_PADRAO(), { ativ: x.n }); location.hash = "#plano"; render(); }
    else openSheet(x.a.id);
  };
  let tm; inp.oninput = () => { clearTimeout(tm); tm = setTimeout(procurar, 150); };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); abrir(res[0]); } if (e.key === "Escape") { inp.value = ""; out.hidden = true; inp.blur(); document.querySelectorAll(".psq-ov").forEach((x) => x.remove()); } };
  inp.onblur = () => setTimeout(() => (out.hidden = true), 200);
}
function abrirPesquisaMovel() {
  if (document.querySelector(".psq-ov")) return;
  const ov = document.createElement("div");
  ov.className = "psq-ov";
  ov.innerHTML = `<div class="psq-ov-in">${pesquisaHTML("psqM")}<button class="btn" data-fecha>Fechar</button></div>`;
  document.body.appendChild(ov);
  ov.querySelector("[data-fecha]").onclick = () => ov.remove();
  ligarPesquisa(ov.querySelector(".psq"));
  ov.querySelector("input").focus();
}

/* ============================================================ gantt */
function ganttView() {
  const g = (ui.gantt = ui.gantt || { bloco: "", unidade: "", ativ: "", abertas: true, zoom: "semana", abertos: new Set(), sel: null, ligacoes: true });
  g.abertosB = g.abertosB || new Set();
  const blocos = ["A", "B", "C", "D", "Geral"];
  const us = S.unidades.filter((u) => !g.bloco || u.bloco === g.bloco);
  const nomes = [...new Set(Object.values(S.acts).filter((a) => !g.bloco || (S.uMap[a.unidade] || {}).bloco === g.bloco).map((a) => nomeAtiv(a)))].sort((a, b) => a.localeCompare(b, "pt"));
  const html = `
    <div class="card-h"><h1>Gantt</h1></div>
    <div class="chips" role="group" aria-label="Bloco">${["", ...blocos].map((b) => `<button class="chip ${g.bloco === b ? "on" : ""}" data-gb="${b}">${b ? (b === "Geral" ? "Geral" : "Bloco " + b) : "Todos os blocos"}</button>`).join("")}</div>
    <div class="filters">
      <label class="f">Apartamento ou fração<select class="inp" id="gu"><option value="">Todas${g.bloco ? " do " + (g.bloco === "Geral" ? "geral" : "bloco " + g.bloco) : ""}</option>${us.map((u) => `<option value="${esc(u.id)}" ${g.unidade === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</select></label>
      <label class="f">Atividade<select class="inp" id="ga"><option value="">Todas</option>${nomes.map((n) => `<option ${g.ativ === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="gc" ${g.abertas ? "checked" : ""}><span>Esconder concluídas</span></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="gl" ${g.ligacoes ? "checked" : ""}><span>Mostrar ligações</span></label>
      <div class="row" style="align-self:center;gap:6px" role="group" aria-label="Nível de detalhe"><span class="note">Mostrar:</span><button class="btn sm" id="gnB">Blocos</button><button class="btn sm" id="gnU">Frações</button><button class="btn sm" id="gnA">Tudo</button></div>
      ${filtrosAlterados() ? `<button class="btn sm repor-on" id="grep" style="align-self:center">Limpar filtros</button>` : ""}
    </div>
    <section class="gzona ${g.full ? "full" : ""}" id="gzona">
    <div class="gtop no-print-g">
      <div class="row" style="gap:6px"><button class="btn sm" id="gHoje" title="Mostrar o dia de hoje">Hoje</button>
        <div class="chips" role="group" aria-label="Escala">${[["dia", "Dias"], ["semana", "Semanas"], ["mes", "Meses"]].map(([k, l]) => `<button class="chip ${g.zoom === k ? "on" : ""}" data-gz="${k}">${l}</button>`).join("")}</div></div>
      <div class="row" style="gap:6px">
        <button class="btn sm ${g.crit ? "pri" : ""}" id="gCrit" aria-pressed="${!!g.crit}" title="Mostrar só a cadeia de atividades que decide a data de fim">${g.crit ? "A ver o caminho crítico" : "Caminho crítico"}</button>
        <button class="btn sm" id="gPrint" title="Imprimir só o gráfico">Imprimir</button>
        <button class="btn sm" id="gFull" title="${g.full ? "Voltar ao ecrã normal (Esc)" : "Ver o gráfico em ecrã inteiro"}">${g.full ? "Sair do ecrã inteiro" : "Ecrã inteiro"}</button>
      </div>
    </div>
    <div class="gprint-h">Gantt · ALTIS · ${g.crit ? "Caminho crítico" + (g.bloco ? " do " + (g.bloco === "Geral" ? "geral" : "bloco " + g.bloco) : " da obra") : (g.bloco ? (g.bloco === "Geral" ? "Geral" : "Bloco " + g.bloco) : "Todos os blocos") + (g.unidade ? " · " + g.unidade : "") + (g.ativ ? " · " + g.ativ : "")} · impresso a ${fd(S.hoje, true)}</div>
    <div class="gcrit-info" id="gcrit" hidden></div>
    <div class="gsel" id="gsel" hidden></div>
    <div class="legend"><span><i class="gl-bar st-concluida"></i>Concluída</span><span><i class="gl-bar st-em_curso"></i>Em curso</span><span><i class="gl-bar st-bloqueada"></i>Bloqueada</span><span><i class="gl-bar st-por_iniciar"></i>Por iniciar</span><span><i class="gl-bar st-por_iniciar atr"></i>Atrasada</span><span title="Dias desde a previsão de fim até hoje, ou até ao fim provável"><i class="gl-bar gl-tail"></i>Atraso</span><span><i class="gl-today"></i>Hoje</span><span class="note">Toque numa barra para ver a cadeia de dependências.${can("executar") ? " Com o rato, arraste a barra para mudar a data ou puxe a ponta direita para mudar o fim." : ""}</span></div>
    <div class="gantt" id="gantt"></div>
    </section>`;
  return { html, bind: bindGantt };
}
function bindGantt() {
  const g = ui.gantt;
  bindCommon();
  document.querySelectorAll("[data-gb]").forEach((b) => (b.onclick = () => { g.bloco = b.dataset.gb; if (g.bloco) g.abertosB.add(g.bloco); g.unidade = ""; g.ativ = ""; g.sel = null; render(); }));
  document.querySelectorAll("[data-gz]").forEach((b) => (b.onclick = () => { g.zoom = b.dataset.gz; render(); }));
  $("#gu").onchange = (e) => { g.unidade = e.target.value; if (g.unidade) { g.abertos.add(g.unidade); g.abertosB.add(S.uMap[g.unidade].bloco); } render(); };
  $("#ga").onchange = (e) => { g.ativ = e.target.value; render(); };
  $("#gc").onchange = (e) => { g.abertas = e.target.checked; render(); };
  $("#gl").onchange = (e) => { g.ligacoes = e.target.checked; drawGantt(); };
  const todosB = () => [...new Set(S.unidades.map((u) => u.bloco))];
  const gr = $("#grep"); if (gr) gr.onclick = reporFiltros;
  $("#gHoje").onclick = () => { const bx = $("#gantt"); if (bx && g._tx != null) { bx.scrollTo({ left: Math.max(0, g._tx - 160), behavior: "smooth" }); g._sl = Math.max(0, g._tx - 160); } };
  $("#gCrit").onclick = () => { g.crit = !g.crit; g.sel = null; g._chave = null; render(); };
  $("#gPrint").onclick = imprimirGantt;
  $("#gFull").onclick = () => mudarEcraInteiro(!g.full);
  document.body.classList.toggle("gfull", !!g.full);
  $("#gnB").onclick = () => { g.abertosB.clear(); g.abertos.clear(); g.unidade = ""; render(); };
  $("#gnU").onclick = () => { todosB().forEach((b) => g.abertosB.add(b)); g.abertos.clear(); render(); };
  $("#gnA").onclick = () => { todosB().forEach((b) => g.abertosB.add(b)); S.unidades.forEach((u) => g.abertos.add(u.id)); render(); };
  drawGantt();
}
/* ============================================================ caminho crítico
   A cadeia de atividades que decide a data de fim (da obra, ou do bloco): começa na(s) atividade(s) que acabam
   em último lugar e anda para trás pelas antecessoras que a estão a prender (sem folga). Atravessa frações
   quando a ligação é da fila da equipa ou entre frações. As "raízes" são onde a cadeia começa hoje:
   qualquer dia que lá se ganhe ou perca, ganha-se ou perde-se no fim. */
const maxD = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
function cadeiaCritica(bloco) {
  const vivo = (id) => { const r = S.res.get(id), a = S.acts[id]; return r && a && r.estado !== "concluida" && !S.idsTeste.has(a.unidade); };
  const alvo = Object.values(S.acts).filter((a) => vivo(a.id) && (!bloco || (S.uMap[a.unidade] || {}).bloco === bloco));
  if (!alvo.length) return null;
  const fimEf = (r) => maxD(r.fim, r.provFim);
  let E = null;
  for (const a of alvo) E = maxD(E, fimEf(S.res.get(a.id)));
  const set = new Set(), raizes = new Set(), arestas = new Set();
  const pilha = alvo.filter((a) => fimEf(S.res.get(a.id)) === E).map((a) => a.id);
  const fins = [...pilha];
  while (pilha.length) {
    const id = pilha.pop();
    if (set.has(id)) continue;
    set.add(id);
    const r = S.res.get(id);
    let presa = false;
    for (const q of r.preds || []) {
      if (!vivo(q.id)) continue;
      const p = S.res.get(q.id);
      let aperta;
      if (r.estado === "em_curso") aperta = q.fonte === "equipa" && addDays(fimEf(p), 1) > S.hoje; // já começou: só a equipa ocupada noutro trabalho a pode atrasar
      else aperta = q.tipo === "SS" ? p.provIni >= r.provIni : addDays(fimEf(p), 1) >= r.provIni;
      if (aperta) { presa = true; arestas.add(q.id + ">" + id); pilha.push(q.id); }
    }
    if (!presa) raizes.add(id);
  }
  const fr = new Set([...set].map((id) => S.acts[id].unidade));
  return { set, raizes, arestas, fim: E, fins, nFr: fr.size };
}
function critInfoHTML(cc, bloco) {
  const onde = bloco ? (bloco === "Geral" ? "das zonas gerais" : "do bloco " + bloco) : "da obra";
  if (!cc) return `<span>Não há atividades por concluir ${onde}.</span>`;
  const rz = [...cc.raizes].map((id) => ({ a: S.acts[id], r: S.res.get(id) })).sort((x, y) => (y.r.atraso || 0) - (x.r.atraso || 0) || (x.r.provIni || "").localeCompare(y.r.provIni || ""));
  const porque = ({ r }) => r.estado === "em_curso" ? (r.atrasada ? `em curso, ${r.atraso} dias atrasada` : "em curso") : r.estado === "bloqueada" ? "à espera" : r.provIni <= S.hoje ? "pode começar já" : `começa a ${fd(r.provIni)}`;
  const aberto = !(ui.gantt && ui.gantt.full && window.innerWidth < 700);
  return `<details ${aberto ? "open" : ""}><summary><b>Fim ${onde}: ${fd(cc.fim, true)}</b> · cadeia de ${cc.set.size} atividade${cc.set.size === 1 ? "" : "s"} em ${cc.nFr} fraç${cc.nFr === 1 ? "ão" : "ões"}</summary>
    <div>Estas atividades decidem essa data: cada dia de atraso numa delas atrasa o fim, e cada dia ganho adianta-o. As setas vermelhas mostram quem espera por quem; ▶ marca onde a cadeia começa.</div>
    <div class="gc-rz"><span class="note">Onde a cadeia começa hoje (o que mais convém acelerar):</span>${rz.slice(0, 6).map((x) => `<button class="lnk-b gc-r" data-a="${x.a.id}"><span class="mono">${esc(x.a.unidade)}</span> <b>${esc(nomeAtiv(x.a))}</b> <span class="note">${porque(x)}</span></button>`).join("")}${rz.length > 6 ? `<span class="note">e mais ${rz.length - 6}</span>` : ""}</div></details>`;
}
function mudarEcraInteiro(on) {
  const g = ui.gantt; if (!g) return;
  g.full = !!on;
  try {
    if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  } catch (e) {}
  render();
}
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && ui.gantt && ui.gantt.full && location.hash.startsWith("#gantt")) { ui.gantt.full = false; render(); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.gantt && ui.gantt.full && !document.querySelector(".dlg, aside.sheet:not([hidden])")) mudarEcraInteiro(false); });
/** Imprime só o gráfico, deitado e ajustado à largura da folha. Se ficar pequeno demais, imprime na escala de meses. */
function imprimirGantt() {
  const g = ui.gantt; if (!g) return;
  const zoomAntes = g.zoom;
  const ajusta = () => {
    const gin = document.querySelector("#gantt .gin"); if (!gin) return 1;
    const larg = gin.scrollWidth || parseFloat(gin.style.width) || 1000;
    return Math.min(1, 1060 / larg);
  };
  let esc0 = ajusta();
  if (esc0 < 0.55 && g.zoom !== "mes") { g.zoom = g.zoom === "dia" ? "semana" : "mes"; drawGantt(); esc0 = ajusta(); if (esc0 < 0.55 && g.zoom !== "mes") { g.zoom = "mes"; drawGantt(); esc0 = ajusta(); } }
  const gin = document.querySelector("#gantt .gin");
  if (gin) gin.style.zoom = String(esc0);
  document.body.classList.add("imprimir-gantt");
  const fim = () => {
    document.body.classList.remove("imprimir-gantt");
    const gi = document.querySelector("#gantt .gin"); if (gi) gi.style.zoom = "";
    if (g.zoom !== zoomAntes) { g.zoom = zoomAntes; drawGantt(); }
    window.removeEventListener("afterprint", fim);
  };
  window.addEventListener("afterprint", fim);
  setTimeout(() => window.print(), 60);
}
function drawGantt() {
  const g = ui.gantt, box = $("#gantt");
  if (!box) return;
  const H = 30, LW = window.innerWidth < 640 ? 150 : g.crit ? 330 : 250, HEAD = 46;
  const k = { dia: 26, semana: 7, mes: 2.2 }[g.zoom];
  // linhas
  const us = S.unidades.filter((u) => (!g.bloco || u.bloco === g.bloco) && (!g.unidade || u.id === g.unidade));
  const sozinha = us.length === 1;
  const rows = [];
  const ordemB = ["A", "B", "C", "D", "Geral"];
  for (const bl of ordemB) {
    const grupo = [];
    let bIni = null, bFim = null, bDur = 0, bFeito = 0, bN = 0, bAtr = 0;
    for (const u of us.filter((x) => x.bloco === bl)) {
      // por data de início: a real se já arrancou, senão a prevista; depois pelo fim
      const acts = u.acts.filter((a) => (!g.ativ || nomeAtiv(a) === g.ativ) && (!g.abertas || S.res.get(a.id).estado !== "concluida"))
        .sort((x, y) => { const rx = S.res.get(x.id), ry = S.res.get(y.id); return (rx.inicio || "9").localeCompare(ry.inicio || "9") || (rx.fim || "9").localeCompare(ry.fim || "9") || nomeAtiv(x).localeCompare(nomeAtiv(y), "pt"); });
      if (!acts.length) continue;
      let ini = null, fim = null, atr = 0;
      for (const a of acts) { const r = S.res.get(a.id); if (!ini || r.inicio < ini) ini = r.inicio; if (!fim || r.fim > fim) fim = r.fim; if (r.atrasada) atr++; }
      grupo.push({ u, acts, ini, fim, atr });
      if (!bIni || ini < bIni) bIni = ini; if (!bFim || fim > bFim) bFim = fim;
      bDur += u.dur; bFeito += u.feito; bN += acts.length; bAtr += atr;
    }
    if (!grupo.length) continue;
    const bAberto = sozinha || g.bloco === bl || g.abertosB.has(bl);
    rows.push({ t: "b", bl, ini: bIni, fim: bFim, n: bN, nu: grupo.length, pct: bDur ? Math.round((100 * bFeito) / bDur) : 0, atr: bAtr, aberto: bAberto });
    if (!bAberto) continue;
    for (const x of grupo) {
      const aberto = sozinha || g.abertos.has(x.u.id);
      rows.push({ t: "u", u: x.u, ini: x.ini, fim: x.fim, n: x.acts.length, atr: x.atr, aberto });
      if (aberto) for (const a of x.acts) rows.push({ t: "a", a, r: S.res.get(a.id) });
    }
  }
  // caminho crítico: só a cadeia que decide o fim (da obra ou do bloco escolhido), por ordem de início, sem agrupar
  let cc = null;
  const ci = $("#gcrit");
  if (g.crit) {
    cc = cadeiaCritica(g.bloco);
    rows.length = 0;
    if (cc) for (const id of [...cc.set].sort((x, y) => (S.res.get(x).provIni || "").localeCompare(S.res.get(y).provIni || "") || (S.res.get(x).provFim || "").localeCompare(S.res.get(y).provFim || ""))) rows.push({ t: "a", a: S.acts[id], r: S.res.get(id), crit: true, raiz: cc.raizes.has(id) });
    if (ci) { ci.hidden = false; ci.innerHTML = critInfoHTML(cc, g.bloco); ci.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => openSheet(b.dataset.a))); }
  } else if (ci) ci.hidden = true;
  if (!rows.length) { box.innerHTML = `<div class="empty">Nenhuma atividade com estes filtros. <button class="btn sm" data-repor>Limpar filtros</button></div>`; box.querySelectorAll("[data-repor]").forEach((b) => (b.onclick = reporFiltros)); $("#gsel").hidden = true; return; }
  // escala
  let t0 = null, t1 = null;
  for (const x of rows) {
    const ds = x.t !== "a" ? [x.ini, x.fim] : [x.r.inicio, x.r.fim, x.r.provFim];
    for (const d of ds) if (d) { if (!t0 || d < t0) t0 = d; if (!t1 || d > t1) t1 = d; }
  }
  if (S.hoje < t0) t0 = S.hoje;
  if (S.hoje > t1) t1 = S.hoje;
  t0 = addDays(t0, -4); t1 = addDays(t1, 10);
  const W = Math.max(400, Math.round(diffDays(t0, t1) * k));
  const X = (d) => Math.round(diffDays(t0, d) * k);
  // cabeçalho: meses + marcas
  let head = "";
  const [y0, m0] = t0.split("-").map(Number);
  for (let y = y0, m = m0; ; m++) {
    if (m > 12) { m = 1; y++; }
    const ini = `${y}-${String(m).padStart(2, "0")}-01`;
    if (ini > t1) break;
    const prox = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const a = Math.max(0, X(ini)), b = Math.min(W, X(prox));
    if (b - a > 14) head += `<div class="gm" style="left:${a}px;width:${b - a}px">${MESES[m - 1]}${g.zoom === "mes" && m !== 1 ? "" : " " + y}</div>`;
  }
  let ticks = "";
  if (g.zoom !== "mes") {
    const passo = g.zoom === "dia" ? 1 : 7;
    let d = t0;
    if (g.zoom === "semana") { const wd = new Date(d + "T12:00:00Z").getUTCDay(); d = addDays(d, (8 - wd) % 7); }
    for (; d <= t1; d = addDays(d, passo)) {
      const x = X(d);
      ticks += `<div class="gt" style="left:${x}px">${+d.slice(8)}</div>`;
    }
  }
  const tx = X(S.hoje);
  g._tx = tx;
  // posições
  const pos = new Map();
  rows.forEach((x, i) => { if (x.t === "a") pos.set(x.a.id, i); });
  // seleção: cadeia a montante e a jusante
  let up = new Set(), down = new Set();
  if (g.sel && S.res.get(g.sel)) {
    const st = [g.sel];
    while (st.length) { const id = st.pop(); for (const p of S.res.get(id)?.preds || []) if (!up.has(p.id)) { up.add(p.id); st.push(p.id); } }
    down = downstream(g.sel, S.res);
  }
  const temSel = !!g.sel;
  const cls = (id) => !temSel ? "" : id === g.sel ? " gsel-on" : up.has(id) ? " gup" : down.has(id) ? " gdown" : " gdim";
  const body = rows.map((x, i) => {
    const y = i * H;
    if (x.t === "b") {
      const nome = x.bl === "Geral" ? "Geral" : "Bloco " + x.bl;
      return `<div class="grow gb ${x.aberto ? "open" : ""}" style="top:${y}px">
        <button class="glab" data-gtogb="${esc(x.bl)}" title="${x.aberto ? "Fechar" : "Abrir as frações"}"><span class="car">${sozinha ? "" : x.aberto ? "▾" : "▸"}</span><b>${esc(nome)}</b><span class="note num">${x.pct}% · ${x.nu} fraç${x.nu === 1 ? "ão" : "ões"}</span></button>
        <div class="gbar gsum gsumB" style="left:${LW + X(x.ini)}px;width:${Math.max(3, X(x.fim) - X(x.ini))}px" title="${esc(nome)}: ${fd(x.ini)} a ${fd(x.fim)}, ${x.pct}% feito, ${x.n} atividades${x.atr ? ", " + x.atr + " atrasadas" : ""}"><i style="width:${x.pct}%"></i></div>
        ${g.zoom !== "mes" ? `<span class="gsum-l mono" style="left:${LW + X(x.fim) + 6}px">${fd(x.fim)}${x.atr ? ` · <span class="gatr">${x.atr} atrasadas</span>` : ""}</span>` : ""}</div>`;
    }
    if (x.t === "u") {
      const u = x.u;
      return `<div class="grow gu ${x.aberto ? "open" : ""}" style="top:${y}px">
        <button class="glab" data-gtog="${esc(u.id)}" title="${x.aberto ? "Fechar" : "Abrir"}"><span class="car">${sozinha ? "" : x.aberto ? "▾" : "▸"}</span><b class="mono">${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</b><span class="note num">${u.pct}% · ${x.n}</span></button>
        <div class="gbar gsum" style="left:${LW + X(x.ini)}px;width:${Math.max(3, X(x.fim) - X(x.ini))}px" title="${esc(u.id)}: ${fd(x.ini)} a ${fd(x.fim)}, ${u.pct}% feito"><i style="width:${u.pct}%"></i></div>
        ${g.zoom !== "mes" ? `<span class="gsum-l mono" style="left:${LW + X(x.fim) + 6}px">${fd(x.fim)}${x.atr ? ` · <span class="gatr">${x.atr} atr.</span>` : ""}</span>` : ""}</div>`;
    }
    const a = x.a, r = x.r;
    const fimBarra = r.fim > r.inicio ? r.fim : r.inicio;
    const left = LW + X(r.inicio), w = Math.max(4, X(fimBarra) - X(r.inicio));
    // atraso: a previsão de fim já passou e as seguintes contam com o fim provável
    const plan = r.estado !== "concluida" && r.provFim > fimBarra ? `<div class="gtail" style="left:${LW + X(fimBarra)}px;width:${Math.max(2, X(r.provFim) - X(fimBarra))}px" title="${esc("Atraso de " + r.atraso + " dias: previsto acabar a " + fd(r.fim) + ", as seguintes contam com " + fd(r.provFim))}"></div>` : "";
    const pct = Math.round(pctEfetiva(a));
    return `<div class="grow ga${cls(a.id)}${x.crit ? " gcrow" : ""}" style="top:${y}px">
      <button class="glab" data-gopen="${a.id}" title="Abrir ficha">${x.crit ? `<span class="mono gcu">${esc(a.unidade)}</span>` : ""}<span class="gname">${x.raiz ? "▶ " : ""}${esc(nomeAtiv(a))}</span></button>
      ${plan}<button class="gbar st-${r.estado}${r.atrasada ? " atr" : ""}${x.crit ? " gcrit" : ""}${x.raiz ? " graiz" : ""}" data-gs="${a.id}" style="left:${left}px;width:${w}px" title="${esc(nomeAtiv(a) + " · " + a.unidade + " · " + fd(r.inicio) + " a " + fd(r.fim) + (pct ? " · " + pct + "%" : ""))}">${r.estado === "em_curso" && pct ? `<i style="width:${pct}%"></i>` : ""}${g.zoom !== "mes" && w > 46 ? `<span>${fd(r.fim)}</span>` : ""}</button></div>`;
  }).join("");
  // ligações
  let arrows = "";
  const muitas = rows.length > 260;
  if (g.ligacoes) {
    for (const x of rows) {
      if (x.t !== "a") continue;
      const i2 = pos.get(x.a.id);
      for (const d of x.r.preds) {
        const i1 = pos.get(d.id);
        if (i1 == null) continue;
        if (cc && !cc.arestas.has(d.id + ">" + x.a.id)) continue;
        const naCadeia = temSel && (d.id === g.sel || up.has(d.id)) && (x.a.id === g.sel || up.has(x.a.id) || down.has(x.a.id)) || (temSel && (d.id === g.sel || down.has(d.id)) && down.has(x.a.id));
        if (muitas && !naCadeia) continue;
        const pr = S.res.get(d.id);
        const xa = (d.tipo === "SS" ? X(pr.inicio) : X(cc ? maxD(pr.fim, pr.provFim) : pr.fim)), ya = i1 * H + H / 2;
        const xb = X(x.r.inicio), yb = i2 * H + H / 2;
        let path;
        if (xb - xa >= 12) path = `M${xa} ${ya}H${xa + 6}V${yb}H${xb - 2}`;
        else path = `M${xa} ${ya}H${xa + 6}V${yb - H / 2 * Math.sign(yb - ya || 1)}H${xb - 8}V${yb}H${xb - 2}`;
        arrows += `<path d="${path}" class="${cc ? "crit" : naCadeia ? "on" : temSel ? "dim" : ""}" marker-end="url(#${cc ? "ahCrit" : naCadeia ? "ahOn" : "ah"})"/>`;
      }
    }
  }
  box.style.setProperty("--lw", LW + "px");
  box.innerHTML = `<div class="gin" style="width:${LW + W}px;height:${HEAD + rows.length * H}px">
    <div class="ghead" style="width:${LW + W}px"><div class="gcorner">${cc ? `Caminho crítico · ${rows.length} atividade${rows.length === 1 ? "" : "s"}` : `${rows.filter((x) => x.t === "b").length} bloco${rows.filter((x) => x.t === "b").length === 1 ? "" : "s"} · ${rows.filter((x) => x.t === "b").reduce((s, x) => s + x.n, 0)} atividades`}</div><div class="gscale" style="left:${LW}px;width:${W}px">${head}${ticks}</div></div>
    <div class="gbody" style="top:${HEAD}px;height:${rows.length * H}px">
      <div class="gtoday" style="left:${LW + tx}px"></div>
      ${body}
      <svg class="garrows" style="left:${LW}px" width="${W}" height="${rows.length * H}" viewBox="0 0 ${W} ${rows.length * H}" aria-hidden="true">
        <defs><marker id="ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" class="ahf"/></marker>
        <marker id="ahOn" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" class="ahf on"/></marker>
        <marker id="ahCrit" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" class="ahf crit"/></marker></defs>
        ${arrows}</svg>
    </div></div>`;
  if (muitas && g.ligacoes && !temSel) $("#gsel").hidden = false, ($("#gsel").innerHTML = `<span class="note">Com tantas linhas abertas, as ligações só aparecem para a tarefa que tocar.</span>`);
  // painel da seleção
  const gs = $("#gsel");
  if (temSel && S.acts[g.sel]) {
    const a = S.acts[g.sel], r = S.res.get(g.sel);
    const fora = [...up, ...down].filter((id) => !pos.has(id)).length;
    const espera = r.bloqueadaPor.map((id) => S.acts[id]).filter(Boolean);
    gs.hidden = false;
    gs.innerHTML = `<div style="display:flex;flex-direction:column;gap:3px;min-width:0"><b>${esc(nomeAtiv(a))} · <span class="mono">${esc(a.unidade)}</span></b>
      <span class="note">${fd(r.inicio)} a ${fd(r.fim)} · <span class="pill st-${r.estado}">${ESTADO[r.estado]}</span> ${deltaHTML(r.atraso)}</span>
      <span class="note"><span class="gk gk-up"></span>Depende de ${up.size} atividade${up.size === 1 ? "" : "s"} no total${espera.length ? ` (à espera de ${esc([...new Set(espera.map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " " + x.unidade : "")))].slice(0, 3).join(", "))})` : ""} · <span class="gk gk-down"></span>${down.size} ${down.size === 1 ? "depende" : "dependem"} desta${fora ? ` · ${fora} fora dos filtros atuais` : ""}</span></div>
      <div class="row">${can("executar") ? `<label class="f" style="flex-direction:row;align-items:center;gap:6px">Início ${dateInput(a.id, "ini", r.estado === "concluida" ? a.realInicio || r.inicio : r.inicio)}</label><label class="f" style="flex-direction:row;align-items:center;gap:6px">Fim ${dateInput(a.id, "fim", r.estado === "concluida" ? a.realFim || r.fim : r.fim)}</label>` : ""}
        <button class="btn sm pri" data-a="${a.id}">Abrir ficha</button><button class="btn sm" id="gunsel">Limpar escolha</button></div>`;
    bindDateInputs(gs);
    gs.querySelector("[data-a]").onclick = () => openSheet(a.id);
    $("#gunsel").onclick = () => { g.sel = null; drawGantt(); };
  } else if (!(muitas && g.ligacoes)) gs.hidden = true;
  const podeArrastar = can("executar");
  box.querySelectorAll("[data-gs]").forEach((b) => {
    const id = b.dataset.gs;
    let drag = null;
    b.onpointerdown = (e) => {
      if (!podeArrastar || e.pointerType === "touch" || e.button !== 0) return;
      const rect = b.getBoundingClientRect();
      drag = { x: e.clientX, modo: e.clientX > rect.right - 9 ? "fim" : "mover", left: parseFloat(b.style.left), w: parseFloat(b.style.width), moveu: false, dd: 0 };
      b.setPointerCapture(e.pointerId);
    };
    b.onpointermove = (e) => {
      if (!podeArrastar) return;
      if (!drag) { const rect = b.getBoundingClientRect(); b.style.cursor = e.clientX > rect.right - 9 ? "ew-resize" : "grab"; return; }
      const dx = e.clientX - drag.x;
      if (!drag.moveu && Math.abs(dx) < 4) return;
      drag.moveu = true;
      drag.dd = Math.round(dx / k);
      const r = S.res.get(id);
      if (drag.modo === "mover") b.style.left = drag.left + drag.dd * k + "px";
      else b.style.width = Math.max(4, drag.w + drag.dd * k) + "px";
      b.classList.add("dragging");
      gTip(e, drag.modo === "mover" ? `Início ${fd(addDays(r.inicio, drag.dd))}` : `Fim ${fd(addDays(r.fim, drag.dd))}`);
    };
    b.onpointerup = (e) => {
      gTip(null);
      const d = drag; drag = null;
      if (d && d.moveu) {
        const r = S.res.get(id);
        if (!d.dd) { drawGantt(); return; }
        if (d.modo === "mover") editarData(id, "ini", addDays(r.estado === "concluida" ? S.acts[id].realInicio || r.inicio : r.inicio, d.dd), { manterPrazo: true });
        else editarData(id, "fim", addDays(r.fim, d.dd));
        return;
      }
      g.sel = g.sel === id ? null : id; drawGantt();
    };
    b.onclick = (e) => { if (e.detail === 0) { g.sel = g.sel === id ? null : id; drawGantt(); } }; // teclado
  });
  box.querySelectorAll("[data-gopen]").forEach((b) => (b.onclick = () => openSheet(b.dataset.gopen)));
  box.querySelectorAll("[data-gtogb]").forEach((b) => (b.onclick = () => {
    const bl = b.dataset.gtogb;
    if (sozinha) return;
    if (g.abertosB.has(bl) || g.bloco === bl) {
      g.abertosB.delete(bl);
      if (g.bloco === bl) { g.bloco = ""; g.unidade = ""; render(); return; } // fechar o bloco filtrado volta à vista de todos
    } else g.abertosB.add(bl);
    drawGantt();
  }));
  box.querySelectorAll("[data-gtog]").forEach((b) => (b.onclick = () => {
    const id = b.dataset.gtog;
    if (sozinha) return;
    g.abertos.has(id) ? g.abertos.delete(id) : g.abertos.add(id);
    drawGantt();
  }));
  // ao mudar filtros ou escala, pôr hoje à vista; nos restantes redesenhos manter a posição
  const chave = [g.bloco, g.unidade, g.ativ, g.zoom, g.abertas, g.crit].join("|");
  if (g._chave !== chave) { g._chave = chave; box.scrollLeft = Math.max(0, tx - 160); g._sl = box.scrollLeft; g._st = 0; }
  else { box.scrollLeft = (g._sl || 0) + (g._t0 ? diffDays(t0, g._t0) * k : 0); box.scrollTop = g._st || 0; }
  g._t0 = t0; g._sl = box.scrollLeft;
  box.onscroll = () => { g._sl = box.scrollLeft; g._st = box.scrollTop; };
}

function gTip(e, txt) {
  let t = document.getElementById("gtip");
  if (!e) { if (t) t.remove(); return; }
  if (!t) { t = document.createElement("div"); t.id = "gtip"; t.className = "gtip"; document.body.appendChild(t); }
  t.textContent = txt;
  t.style.left = e.clientX + 12 + "px"; t.style.top = e.clientY - 34 + "px";
}

/* ============================================================ ajuda de cada ecrã (o "?" ao lado do título) */
const AJUDA_ECRA = {
  painel: "O ponto de situação da obra: o fim previsto, o que está atrasado e o avanço de cada bloco. Em Precisa de atenção estão as atividades que convém tratar primeiro, com atalhos para as resolver logo.",
  previsao: "Quando cada bloco e cada apartamento ficam prontos. As datas recalculam-se todos os dias com o estado real das atividades. Toque num apartamento para ver o que ainda falta.",
  unidades: "Todos os apartamentos, lojas e zonas comuns, com o avanço de cada um. Toque num para ver as atividades, fazer a vistoria ou ver as fotografias.",
  fracao: "As atividades desta fração, pela ordem da obra. Toque numa atividade para abrir a ficha. Com Editar datas muda as datas e a percentagem na lista. Em Pendentes estão os pontos por resolver: o empreiteiro marca como resolvido e o fiscal verifica.",
  plano: "Todas as atividades da obra, com filtros por bloco, fração, atividade e estado. Os filtros ficam guardados até carregar em Limpar filtros. Com Concluir ou atribuir várias trata várias atividades de uma vez.",
  gantt: "As atividades no tempo, em barras. Arraste uma barra para mudar as datas: as atividades seguintes acertam-se sozinhas. O botão Hoje leva-o ao dia de hoje.",
  semana: "O que está em curso, o que deve começar nos próximos 7 dias e o que está à espera de outras atividades. Os botões Iniciar, +10% e Concluir gravam logo.",
  regras: "A sequência entre especialidades e os dias que cada uma leva por fração. Uma mudança aqui acerta as datas de todas as atividades que ainda não começaram.",
  equipas: "As equipas de trabalho da obra, com o que cada uma pode fazer. Abra uma equipa para ver os seus trabalhos, editar os dados ou tirá-la da obra.",
  planequipa: "A ordem em que cada equipa vai fazer os seus trabalhos. Uma equipa só faz um trabalho de cada vez, por isso a ordem mexe nas datas.",
  equipa: "As contas de quem usa a aplicação e o perfil de cada uma. O perfil define o que cada pessoa pode ver e fazer.",
  vistorias: "As vistorias guardadas pelo fiscal, dia a dia. Escolha os dias para ver o relatório, imprimi-lo ou guardá-lo em PDF.",
  relatorio: "Um resumo da obra para levar à reunião. Pode imprimir ou guardar em PDF.",
  pendentes: "Todos os pendentes da obra, por fração. O empreiteiro marca aqui o que já resolveu; o fiscal verifica na vistoria e carrega em Concluído?. Para registar um pendente novo, abra a fração.",
};
function ajudaEcra() {
  let h = location.hash.replace("#", "").split("?")[0];
  if (!h && S) h = navItems()[0].id;
  const k = h.startsWith("u-") ? "fracao" : h;
  const txt = AJUDA_ECRA[k];
  const h1 = document.querySelector("#view h1");
  if (!txt || !h1) return;
  ui.ajudaAberta = ui.ajudaAberta || new Set();
  const aberta = ui.ajudaAberta.has(k);
  h1.insertAdjacentHTML("beforeend", ` <button type="button" class="qh no-print" aria-expanded="${aberta}" aria-label="Para que serve este ecrã" title="Para que serve este ecrã">?</button>`);
  const caixa = document.createElement("div");
  caixa.className = "ajuda-ecra no-print"; caixa.hidden = !aberta;
  caixa.innerHTML = `<p>${esc(txt)}</p><button type="button" class="btn sm ghost">Percebi</button>`;
  const ref = h1.closest(".card-h, .uhead") || h1;
  ref.insertAdjacentElement("afterend", caixa);
  const bt = h1.querySelector(".qh");
  const muda = (abrir) => { caixa.hidden = !abrir; bt.setAttribute("aria-expanded", String(abrir)); if (abrir) ui.ajudaAberta.add(k); else ui.ajudaAberta.delete(k); };
  bt.onclick = (e) => { e.preventDefault(); e.stopPropagation(); muda(caixa.hidden); };
  caixa.querySelector("button").onclick = () => muda(false);
}
/* ============================================================ guia de primeira utilização */
const AJUDA_PASSO = ["Ajuda sempre à mão", "Em cada ecrã, o ? ao lado do título explica para que serve. Em Ajuda (o ? lá em cima) volta a ver este guia e confirma a versão da aplicação. Quando houver uma versão nova, aparece um aviso com o botão Atualizar agora."];
const GUIA = {
  dono: [
    ["O ponto de situação", "No Painel vê o fim previsto da obra, o avanço de cada bloco e, em Precisa de atenção, as atividades esquecidas ou paradas que estão a atrasar outras. Toque num número para ver a lista correspondente."],
    ["Fim da obra", "Em Fim vê quando cada bloco e cada apartamento ficam prontos, recalculado todos os dias com o estado real."],
    ["Trabalhos e Gantt", "Em Trabalhos estão todas as atividades, com filtros que ficam guardados até carregar em Limpar filtros. Mude datas com Editar datas, ou arrastando as barras no Gantt. As atividades que dependem dessa acertam-se sozinhas."],
    ["Definições", "Em Definições escolhe a sequência entre especialidades e os dias de cada uma, gere as equipas e, em Acessos, cria as contas do empreiteiro e do fiscal. Depois de cada alteração aparece Anular em baixo, com o número de datas que mudaram."],
    AJUDA_PASSO,
  ],
  empreiteiro: [
    ["A minha semana", "Ao entrar vê o que está em curso, o que deve começar nos próximos 7 dias e o que está à espera de outras atividades. Os botões Iniciar, +10% e Concluir gravam logo."],
    ["Precisa de atenção", "No topo aparecem os pendentes por resolver, as atividades em curso com o fim já passado e as que podiam já ter começado. Quando resolver um pendente, carregue em Já está resolvido: o fiscal verifica depois."],
    ["Mais detalhe", "Toque no nome de uma atividade para abrir a ficha: datas, equipa, motivo de atraso, ligações, fotografias e histórico. Em Trabalhos, com Concluir ou atribuir várias, trata várias atividades de uma vez."],
    ["Enganou-se? Sem rede?", "Depois de guardar aparece Anular em baixo, durante alguns segundos. A aplicação funciona sem rede: guarda tudo no telemóvel e envia quando houver ligação."],
    AJUDA_PASSO,
  ],
  fiscal: [
    ["Escolha o apartamento", "Em Apartamentos escolha onde está. Os que não vê há mais de 7 dias aparecem marcados e pode filtrá-los."],
    ["Faça a vistoria", "Em cada especialidade toque na percentagem que verificou, escreva um comentário e junte fotografias, da câmara ou da galeria. O botão com o número mostra as fotografias já guardadas."],
    ["Pendentes", "No topo da vistoria estão os pendentes do apartamento. Em cada um, carregue em «Concluído?» se já está bem, ou em «Ainda não está». Para registar um ponto novo (por exemplo, falta silicone numa janela), escreva-o em Novo pendente."],
    ["Guarde e siga", "Guarde a vistoria de uma vez e passe ao apartamento seguinte. Funciona sem rede e envia quando houver ligação. Se se enganar, toque em Anular."],
    AJUDA_PASSO,
  ],
};
function abrirGuia(forcar) {
  const papel = store.user && store.user.papel;
  const passos = GUIA[papel];
  if (!passos || document.querySelector(".guia")) return;
  const chave = "obra-guia-v3-" + papel; // v2: guia revisto a 8 nov 2026, volta a aparecer uma vez
  if (!forcar) { try { if (localStorage.getItem(chave)) return; } catch (e) { return; } }
  let i = 0;
  const el = document.createElement("div");
  el.className = "guia";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Guia rápido");
  const fim = () => { try { localStorage.setItem(chave, "1"); } catch (e) {} el.remove(); };
  const desenha = () => {
    const [t, txt] = passos[i];
    el.innerHTML = `<div class="guia-box">
      <div class="eyebrow">Guia rápido · ${PAPEL[papel]} · ${i + 1} de ${passos.length}</div>
      <h2>${esc(t)}</h2><p>${esc(txt)}</p>
      <div class="guia-dots">${passos.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="row" style="justify-content:space-between"><button class="btn ghost" data-g="sair">Saltar</button>
        <div class="row">${i > 0 ? `<button class="btn" data-g="ant">Anterior</button>` : ""}<button class="btn pri" data-g="seg">${i < passos.length - 1 ? "Seguinte" : "Começar"}</button></div></div>
    </div>`;
  };
  el.onclick = (e) => {
    const b = e.target.closest("[data-g]"); if (!b) return;
    if (b.dataset.g === "sair") fim();
    else if (b.dataset.g === "ant") { i--; desenha(); }
    else if (i < passos.length - 1) { i++; desenha(); } else fim();
  };
  desenha();
  document.body.appendChild(el);
}
/* ============================================================ definições: sequência + equipa */
function defTabs(atual) {
  const t = [["regras", "Sequência e durações"]];
  if (can("executar")) t.push(["equipas", "Equipas de trabalho"], ["planequipa", "Plano das equipas"]);
  if (store.user.papel === "dono") t.push(["equipa", "Acessos"]);
  return `<div class="eyebrow">Definições</div><div class="tabs">${t.map(([h, l]) => `<a href="#${h}" class="deftab ${atual === h ? "on" : ""}">${l}</a>`).join("")}</div>`;
}
/* ============================================================ simulação do tempo mínimo
   Só com a sequência e os dias por fração desta página: cada especialidade arranca num apartamento
   logo que as suas condições acabam nesse apartamento. Com equipas limitadas, cada equipa faz os
   apartamentos um a seguir ao outro. Não conta com o que já está feito nem com as outras ligações entre trabalhos. */
function simular(esp, regras, dur, nAp, eq) {
  const keys = esp.map((e) => e.key), ks = new Set(keys);
  const pre = Object.fromEntries(keys.map((k) => [k, (regras[k] || []).filter((p) => ks.has(p) && p !== k)]));
  // ordem topológica
  const ordem = [], feito = new Set(), emCurso = new Set();
  let ciclo = false;
  const visita = (k) => { if (feito.has(k)) return; if (emCurso.has(k)) { ciclo = true; return; } emCurso.add(k); for (const p of pre[k]) visita(p); emCurso.delete(k); feito.add(k); ordem.push(k); };
  for (const k of keys) visita(k);
  const d = (k) => Math.max(0, Number(dur[k]) || 0);
  const n = Math.max(1, nAp);
  const ini = {}, fim = {}, porQuem = {};
  for (const k of ordem) {
    ini[k] = []; fim[k] = []; porQuem[k] = [];
    const livre = []; // fim da última fração de cada equipa
    for (let i = 0; i < n; i++) {
      let s = 0, q = null;
      for (const p of pre[k]) if (fim[p] && fim[p][i] > s) { s = fim[p][i]; q = { k: p, i }; }
      if (eq) { const t = i % eq; if ((livre[t] || 0) > s) { s = livre[t]; q = { k, i: i - eq }; } }
      ini[k][i] = s; fim[k][i] = s + d(k); porQuem[k][i] = q;
      if (eq) livre[i % eq] = fim[k][i];
    }
  }
  let total = 0, ult = null;
  for (const k of ordem) for (let i = 0; i < n; i++) if (fim[k][i] > total || (fim[k][i] === total && !ult)) { total = fim[k][i]; ult = { k, i }; }
  // caminho crítico: volta atrás pela condição que impôs cada arranque
  const critico = new Set();
  for (let c = ult; c && c.i >= 0; c = porQuem[c.k][c.i]) critico.add(c.k);
  const linhas = ordem.map((k) => ({ k, ini: Math.min(...ini[k]), fim: Math.max(...fim[k]), dur: d(k), um: [ini[k][0], fim[k][0]] }));
  return { linhas, total, critico, ciclo, n };
}
function simGanttHTML(esp, regras, dur, nAp) {
  if (!esp.length) return "";
  const op = ui.simEq || "0", eq = Number(op);
  const r = simular(esp, regras, dur, nAp, eq);
  const so = ui.simOrd || "ini";
  const pos = Object.fromEntries(esp.map((e, i) => [e.key, i]));
  const nm = (k) => (S.espIdx[k] ? S.espIdx[k].nome : k);
  const crit = (l) => (r.critico.has(l.k) ? 0 : 1);
  const cmp = {
    ini: (a, b) => a.ini - b.ini || a.fim - b.fim,
    fim: (a, b) => a.fim - b.fim || a.ini - b.ini,
    dur: (a, b) => (b.fim - b.ini) - (a.fim - a.ini) || a.ini - b.ini,
    crit: (a, b) => crit(a) - crit(b) || a.ini - b.ini || a.fim - b.fim,
    nome: (a, b) => nm(a.k).localeCompare(nm(b.k), "pt", { sensitivity: "base", numeric: true }),
    lista: (a, b) => pos[a.k] - pos[b.k],
  }[so] || ((a, b) => a.ini - b.ini);
  r.linhas.sort(cmp);
  const ords = [["ini", "Início"], ["fim", "Fim"], ["dur", "Mais longas"], ["crit", "Críticas primeiro"], ["nome", "Nome"], ["lista", "Ordem da lista"]];
  const T = Math.max(1, r.total);
  const pc = (x) => ((x / T) * 100).toFixed(3) + "%";
  const passo = [7, 14, 28, 56, 91, 182].find((x) => T / x <= 6) || 365;
  const marcas = []; for (let x = passo; x < T; x += passo) marcas.push(x);
  const fimData = addDays(S.hoje, r.total);
  const semDias = esp.filter((e) => dur[e.key] == null || dur[e.key] === "").length;
  const nomeDe = (k) => (S.espIdx[k] ? S.espIdx[k].nome : k);
  const ops = [["0", "Sem limite"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]];
  return `<section class="sim">
    <div class="card-h"><h2>Simulação do tempo mínimo da obra</h2></div>
    <p style="max-width:75ch">Calculado só com a sequência e os dias por fração desta página, para ${r.n} apartamentos, como se a obra começasse hoje do zero. Cada especialidade arranca num apartamento logo que as condições acabam nesse apartamento.${eq ? ` Cada especialidade tem ${eq === 1 ? "uma equipa, que faz" : eq + " equipas, que fazem"} os apartamentos um a seguir ao outro.` : " Com equipas sem limite, todos os apartamentos andam ao mesmo tempo."} Não conta com o que já está feito nem com as outras ligações entre trabalhos.</p>
    <div class="sim-op"><span class="note">Equipas por especialidade</span><div class="sim-seg">${ops.map(([v, l]) => `<button class="${op === v ? "on" : ""}" data-simeq="${v}">${l}</button>`).join("")}</div></div>
    <div class="sim-op"><span class="note">Ordenar por</span><div class="sim-seg">${ords.map(([v, l]) => `<button class="${so === v ? "on" : ""}" data-simord="${v}">${l}</button>`).join("")}</div></div>
    ${r.ciclo ? `<div class="banner warn">Há condições em círculo (uma especialidade espera por outra que espera por ela). A simulação ignora esse círculo.</div>` : ""}
    <div class="sim-tot"><div><div class="eyebrow">Tempo mínimo</div><big class="num">${r.total} dias</big><span class="note"> cerca de ${Math.round(r.total / 7)} semanas</span></div><div><div class="eyebrow">Começando hoje, acabava a</div><big class="num">${fd(fimData, true)}</big></div></div>
    <div class="sim-g">
      <div class="sim-row sim-ax"><span></span><div class="sim-tr">${marcas.map((x, j) => `<i style="left:${pc(x)}"><em class="${j % 2 ? "imp" : ""}">${x} d</em></i>`).join("")}</div><span></span></div>
      ${r.linhas.map((l) => `<div class="sim-row ${r.critico.has(l.k) ? "crit" : ""}"><span class="sim-n" title="${esc(nomeDe(l.k))}">${esc(nomeDe(l.k))}</span><div class="sim-tr">${marcas.map((x) => `<i style="left:${pc(x)}"></i>`).join("")}<b style="left:${pc(l.ini)};width:${pc(Math.max(l.fim - l.ini, 0))}" title="${esc(nomeDe(l.k))}: dia ${l.ini} a ${l.fim}"></b>${eq ? `<s style="left:${pc(l.um[0])};width:${pc(l.um[1] - l.um[0])}"></s>` : ""}</div><span class="sim-d num">${l.ini} a ${l.fim}</span></div>`).join("")}
    </div>
    <p class="note"><span class="sim-lg crit"></span> Caminho crítico: se uma destas especialidades demorar mais, a obra acaba mais tarde.${eq ? ` <span class="sim-lg um"></span> Primeiro apartamento; a barra clara vai até ao último.` : ""}${semDias ? ` ${semDias} especialidades sem dias por fração contam como 0 dias.` : ""}</p>
  </section>`;
}
/* ============================================================ regras (sequência) */
function regrasView() {
  const dono = store.user.papel === "dono";
  const seq = dono || store.user.papel === "empreiteiro"; // dono e empreiteiro podem mudar tudo neste ecrã
  const esp = [...S.cfg.especialidades].sort((a, b) => a.ordem - b.ordem);
  const regras = S.cfg.regras || {}, dur = S.cfg.duracoes || {};
  // ordenação só de visualização (clicar no título da coluna); a ordem guardada não muda
  const vs = ui.regSort || null;
  // seguintes: as especialidades que esperam por esta (o inverso de «Só começa depois de»)
  const seguintes = (k) => esp.filter((x) => (regras[x.key] || []).includes(k));
  const chave = { nome: (e) => e.nome, dias: (e) => Number(dur[e.key] ?? -1), cond: (e) => (regras[e.key] || []).length, seg: (e) => seguintes(e.key).length };
  const vista = vs ? [...esp].sort((a, b) => {
    const x = chave[vs.col](a), y = chave[vs.col](b);
    const c = typeof x === "string" ? x.localeCompare(y, "pt", { sensitivity: "base", numeric: true }) : x - y;
    return (vs.dir === "desc" ? -c : c) || a.ordem - b.ordem;
  }) : esp;
  const mexe = seq && !vs; // setas e arrastar só na ordem guardada
  const NOMES_COL = { nome: "ordem alfabética", dias: "dias por fração", cond: "número de condições", seg: "número de atividades que dependem desta" };
  const th = (col, l) => { const on = vs && vs.col === col; return `<button class="th-sort ${on ? "on" : ""}" data-rsort="${col}" title="Ordenar por ${l.toLowerCase()}">${l}<span class="arr">${on ? (vs.dir === "desc" ? "▼" : "▲") : "↕"}</span></button>`; };
  const nAp = S.unidades.filter((u) => u.tipo === "Apartamento").length;
  const html = `
    ${defTabs("regras")}
    <div class="card-h"><h1>Sequência dos trabalhos</h1>${seq ? `<div class="row"><button class="btn" id="ordSeq" title="Põe cada especialidade depois das de que depende">Ordenar pela sequência</button><button class="btn pri" data-nova="esp">+ Nova especialidade</button></div>` : ""}</div>
    <p style="max-width:70ch">Cada especialidade só pode arrancar num apartamento quando as especialidades da coluna «Só começa depois de» estiverem concluídas <b>nesse mesmo apartamento</b>. Uma regra aqui aplica-se de uma vez aos ${nAp} apartamentos. Se uma atividade se atrasar, todas as que dependem dela andam para a frente sozinhas.</p>
    ${seq ? "" : `<div class="banner">Só o dono de obra e o empreiteiro podem alterar esta sequência.</div>`}
    ${vs ? `<div class="banner"><span>A ver por <b>${NOMES_COL[vs.col]}</b>${vs.dir === "desc" ? " (decrescente)" : ""}. A ordem guardada da lista não mudou.</span><span class="row" style="gap:6px">${seq ? `<button class="btn sm" id="rsGuardar">Guardar como ordem da lista</button>` : ""}<button class="btn sm" id="rsVoltar">Voltar à ordem da lista</button></span></div>` : ""}
    <div class="reg-q"><input class="inp" type="search" id="regQ" placeholder="Procurar especialidade" aria-label="Procurar especialidade" autocomplete="off" value="${esc(ui.regQ || "")}"><span class="note" id="regQn"></span></div>
    <div class="rules">
      <div class="rule rule-h ${mexe ? "ordenavel" : ""}">${mexe ? "<span></span>" : ""}<span>${th("nome", "Especialidade")}</span><span>${th("dias", "Dias por fração")}</span><span>${th("cond", "Só começa depois de")}</span><span>${th("seg", "Dependem desta")}</span></div>
      ${vista.map((e) => {
        const pre = regras[e.key] || [];
        // não deixa escolher uma especialidade que já espera (direta ou indiretamente) por esta: seria um círculo
        const espera = (k, alvo, vis = new Set()) => { if (vis.has(k)) return false; vis.add(k); return (regras[k] || []).some((q) => q === alvo || espera(q, alvo, vis)); };
        const disp = esp.filter((x) => x.key !== e.key && !pre.includes(x.key) && !espera(x.key, e.key)).sort((x, y) => x.nome.localeCompare(y.nome, "pt", { sensitivity: "base", numeric: true }));
        const i = esp.indexOf(e);
        return `<div class="rule ${mexe ? "ordenavel" : ""}" data-rk="${e.key}" data-rq="${esc(semAcento([e.nome, ...pre.map((k) => (S.espIdx[k] ? S.espIdx[k].nome : k))].join(" ")))}" ${mexe ? 'draggable="true"' : ""}>${mexe ? `<div class="ordb"><button class="ord-b" data-ord="${e.key}|-1" ${i === 0 ? "disabled" : ""} title="Subir" aria-label="Subir ${esc(e.nome)}">▲</button><button class="ord-b" data-ord="${e.key}|1" ${i === esp.length - 1 ? "disabled" : ""} title="Descer" aria-label="Descer ${esc(e.nome)}">▼</button></div>` : ""}<div class="rnome" data-rnome="${e.key}"><b>${esc(e.nome)}</b>${seq ? `<button class="ren-b" data-ren="${e.key}" title="Mudar o nome" aria-label="Mudar o nome de ${esc(e.nome)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14 8l3 3"/></svg></button>` : ""}</div>
          <input class="inp num" type="number" min="0" max="365" value="${dur[e.key] ?? ""}" data-dur="${e.key}" ${seq ? "" : "disabled"} aria-label="Dias por fração de ${esc(e.nome)}">
          <div class="tags">${pre.map((k) => `<span class="tag ${seq ? "" : "ro"}">${esc(S.espIdx[k] ? S.espIdx[k].nome : k)}${seq ? `<button data-rm="${e.key}|${k}" aria-label="Retirar">×</button>` : ""}</span>`).join("") || `<span class="note">Sem condições</span>`}
          ${seq ? `<select class="inp" data-add="${e.key}"><option value="">+ acrescentar</option>${disp.map((x) => `<option value="${x.key}">${esc(x.nome)}</option>`).join("")}</select>` : ""}</div>
          <div class="tags segs" title="Especialidades que só começam depois de esta estar concluída">${seguintes(e.key).sort((x, y) => x.ordem - y.ordem).map((x) => `<button type="button" class="tag seg" data-rgo="${x.key}" title="Ir para ${esc(x.nome)}">${esc(x.nome)}</button>`).join("") || `<span class="note">Nenhuma</span>`}</div></div>`;
      }).join("")}
    </div>
    <p class="note">As outras ligações entre trabalhos (por exemplo a sequência da Equipa 4 de apartamento em apartamento) continuam ativas além destas regras.</p>
    ${simGanttHTML(esp, regras, dur, nAp)}`;
  return {
    html, bind: () => {
      document.querySelectorAll("[data-rsort]").forEach((b) => (b.onclick = () => {
        const col = b.dataset.rsort, d0 = col === "nome" ? "asc" : "desc";
        if (!vs || vs.col !== col) ui.regSort = { col, dir: d0 };
        else if (vs.dir === d0) ui.regSort = { col, dir: d0 === "asc" ? "desc" : "asc" };
        else ui.regSort = null; // terceiro clique: volta à ordem da lista
        render();
      }));
      const rv = $("#rsVoltar"); if (rv) rv.onclick = () => { ui.regSort = null; render(); };
      document.querySelectorAll("[data-rgo]").forEach((b) => (b.onclick = (ev) => {
        ev.stopPropagation();
        const r = document.querySelector(`.rule[data-rk="${b.dataset.rgo}"]`); if (!r) return;
        if (r.hidden) { const q = $("#regQ"); q.value = ""; q.dispatchEvent(new Event("input")); }
        r.scrollIntoView({ behavior: "smooth", block: "center" });
        r.classList.remove("piscar"); void r.offsetWidth; r.classList.add("piscar");
      }));
      document.querySelectorAll("[data-simeq]").forEach((b) => (b.onclick = () => { ui.simEq = b.dataset.simeq; render(); }));
      document.querySelectorAll("[data-simord]").forEach((b) => (b.onclick = () => { ui.simOrd = b.dataset.simord; render(); }));
      const rq = $("#regQ");
      const filtra = () => {
        ui.regQ = rq.value;
        const t = semAcento(rq.value.trim()).split(/\s+/).filter(Boolean);
        let n = 0;
        document.querySelectorAll(".rule[data-rq]").forEach((r) => { const ok = t.every((w) => r.dataset.rq.includes(w)); r.hidden = !ok; if (ok) n++; });
        const fa = filtrosAlterados();
        document.querySelectorAll("aside [data-repor]").forEach((x) => x.classList.toggle("repor-on", fa));
        document.querySelectorAll("[data-repor-top]").forEach((x) => (x.hidden = !fa));
        $("#regQn").textContent = t.length ? (n ? `${n} de ${esp.length}` : "Nenhuma especialidade encontrada") : "";
      };
      rq.oninput = filtra; filtra();
      if (!seq) return;
      const rg = $("#rsGuardar");
      if (rg) rg.onclick = async () => {
        const pos = Object.fromEntries(vista.map((e, i) => [e.key, i + 1]));
        await store.setConfig({ especialidades: S.cfg.especialidades.map((x) => ({ ...x, ordem: pos[x.key] ?? x.ordem })) }, { tipo: "regras", texto: `Especialidades ordenadas por ${NOMES_COL[vs.col]}` });
        ui.regSort = null;
        toast("Ordem da lista guardada");
      };
      document.querySelectorAll("[data-nova]").forEach((b) => (b.onclick = () => openNova(b.dataset.nova)));
      const save = (patch, texto) => store.setConfig(patch, { tipo: "regras", texto }).then(() => toast("Sequência atualizada"));
      document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => {
        const [k, p] = b.dataset.rm.split("|");
        if (!(await confirmar("Retirar esta condição?", `<p><b>${esc(S.espIdx[k].nome)}</b> deixa de esperar por <b>${esc(S.espIdx[p].nome)}</b> em todas as frações.</p>`))) return;
        const r = { ...regras, [k]: (regras[k] || []).filter((x) => x !== p) };
        save({ regras: r }, `Sequência: ${S.espIdx[k].nome} deixou de esperar por ${S.espIdx[p].nome}`);
      }));
      document.querySelectorAll("[data-add]").forEach((s) => (s.onchange = () => {
        const k = s.dataset.add, p = s.value;
        if (!p) return;
        const r = { ...regras, [k]: [...(regras[k] || []), p] };
        // confirma que a regra nova não cria um círculo com as ligações que já existem nos apartamentos
        const r2 = schedule(Object.values(S.acts), r, S.hoje, S.cfg.duracoes || {});
        const novos = [...r2.values()].filter((x) => x.ciclo && !S.res.get(x.id).ciclo);
        if (novos.length) {
          const a0 = S.acts[novos[0].id];
          s.value = "";
          perguntar({ titulo: "Esta regra cria um círculo", texto: `<p>Em ${novos.length} atividades, ${esc(S.espIdx[p].nome)} já espera (direta ou indiretamente) por ${esc(S.espIdx[k].nome)}. Por exemplo: ${esc(nomeAtiv(a0))} em ${esc(a0.unidade)}.</p><p class="note">Com esta regra, uma esperaria pela outra e a aplicação não conseguiria calcular as datas. A regra não foi gravada.</p>`, opcoes: [{ k: "ok", l: "Percebi", estilo: "pri" }] });
          return;
        }
        save({ regras: r }, `Sequência: ${S.espIdx[k].nome} passa a esperar por ${S.espIdx[p].nome}`);
      }));
      // ordem das especialidades: setas, arrastar (rato) e ordenar pela sequência
      const gravaOrdem = async (keys, texto) => {
        const pos = Object.fromEntries(keys.map((k, i) => [k, i + 1]));
        const lista = S.cfg.especialidades.map((x) => ({ ...x, ordem: pos[x.key] ?? x.ordem }));
        await store.setConfig({ especialidades: lista }, { tipo: "regras", texto });
        toast("Ordem guardada");
      };
      const keys = esp.map((e) => e.key);
      document.querySelectorAll("[data-ord]").forEach((bt) => (bt.onclick = () => {
        const [k, d] = bt.dataset.ord.split("|"), i = keys.indexOf(k), j = i + Number(d);
        if (j < 0 || j >= keys.length) return;
        const nk = [...keys]; [nk[i], nk[j]] = [nk[j], nk[i]];
        ui.focoOrd = k + "|" + d;
        gravaOrdem(nk, `Sequência: ${S.espIdx[k].nome} ${Number(d) < 0 ? "subiu" : "desceu"} na lista`);
      }));
      if (ui.focoOrd) { const f = document.querySelector(`[data-ord="${ui.focoOrd}"]`); if (f && !f.disabled) f.focus(); ui.focoOrd = null; }
      let arrasta = null;
      document.querySelectorAll(".rule[data-rk]").forEach((row) => {
        row.ondragstart = (ev) => { if (/INPUT|SELECT|BUTTON/.test(ev.target.tagName)) return; arrasta = row.dataset.rk; row.classList.add("arr"); ev.dataTransfer.effectAllowed = "move"; };
        row.ondragend = () => { row.classList.remove("arr"); document.querySelectorAll(".rule.sobre").forEach((x) => x.classList.remove("sobre")); };
        row.ondragover = (ev) => { if (!arrasta) return; ev.preventDefault(); document.querySelectorAll(".rule.sobre").forEach((x) => x.classList.remove("sobre")); row.classList.add("sobre"); };
        row.ondrop = (ev) => {
          ev.preventDefault();
          const de = arrasta, para = row.dataset.rk; arrasta = null;
          if (!de || de === para) return;
          const nk = keys.filter((k) => k !== de); nk.splice(nk.indexOf(para) + (keys.indexOf(de) < keys.indexOf(para) ? 1 : 0), 0, de);
          gravaOrdem(nk, `Sequência: ${S.espIdx[de].nome} mudou de posição na lista`);
        };
      });
      const os = $("#ordSeq");
      if (os) os.onclick = () => {
        // ordenação topológica estável: mantém a ordem atual sempre que as regras o permitem
        const feito = new Set(), out = [];
        while (out.length < keys.length) {
          const k = keys.find((x) => !feito.has(x) && (regras[x] || []).every((p) => feito.has(p) || !keys.includes(p)))
            || keys.find((x) => !feito.has(x)); // ciclo: segue a ordem atual
          feito.add(k); out.push(k);
        }
        if (out.join() === keys.join()) return toast("A ordem já segue a sequência");
        gravaOrdem(out, "Sequência: especialidades ordenadas pela sequência dos trabalhos");
      };
      document.querySelectorAll("[data-ren]").forEach((bt) => (bt.onclick = () => {
        const k = bt.dataset.ren, e = S.espIdx[k], box = document.querySelector(`[data-rnome="${k}"]`);
        box.classList.add("ed");
        box.innerHTML = `<input class="inp" value="${esc(e.nome)}" maxlength="80" aria-label="Novo nome"><button class="btn sm pri" data-rok>Guardar</button><button class="btn sm ghost" data-rno>Cancelar</button>`;
        const inp = box.querySelector("input");
        inp.focus(); inp.select();
        const grava = async () => {
          const nome = inp.value.trim().replace(/\s+/g, " ");
          if (!nome || nome === e.nome) return render();
          if (S.cfg.especialidades.some((x) => x.key !== k && x.nome.toLowerCase() === nome.toLowerCase())) { toast("Já existe uma especialidade com esse nome."); inp.focus(); return; }
          const lista = S.cfg.especialidades.map((x) => (x.key === k ? { ...x, nome, editado: true } : x));
          await store.setConfig({ especialidades: lista }, { tipo: "regras", texto: `Especialidade "${e.nome}" passou a chamar-se "${nome}"` });
          toast(`Passou a chamar-se ${nome}`);
        };
        box.querySelector("[data-rok]").onclick = grava;
        box.querySelector("[data-rno]").onclick = () => render();
        inp.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); grava(); } else if (ev.key === "Escape") render(); };
      }));
      document.querySelectorAll("[data-dur]").forEach((i) => (i.onchange = () => {
        const k = i.dataset.dur, v = i.value === "" ? null : Math.max(0, Number(i.value));
        save({ duracoes: { ...dur, [k]: v } }, `Duração de ${S.espIdx[k].nome}: ${v} dias por fração`);
      }));
    },
  };
}

/* ============================================================ equipa */
function equipaView() {
  const demo = store.modo === "demo";
  const html = `
    ${defTabs("equipa")}
    <h1>Acessos</h1>
    <p style="max-width:70ch">Cada pessoa entra com o seu email e palavra-passe. O perfil define o que pode fazer: o <b>empreiteiro</b> inicia, conclui e reporta atrasos; o <b>fiscal</b> regista vistorias e fotografias; o <b>dono de obra</b> vê tudo e define a sequência; o <b>administrador</b> tem os mesmos direitos do dono de obra e escolhe como quer ver a aplicação (como dono, empreiteiro ou fiscal), para confirmar o que cada um vê.</p>
    <section class="card"><h2>Pessoas com acesso</h2><div class="list" id="ulist"><div class="note">A carregar...</div></div></section>
    <section class="card"><h2>Adicionar pessoa</h2>
      ${demo ? `<div class="banner warn">Na demonstração não se criam contas reais. Na versão instalada, isto cria a conta e o perfil de uma vez.</div>` : ""}
      <form id="uf" class="grid2" style="gap:12px">
        <label class="f">Nome<input class="inp" id="un" required></label>
        <label class="f">Email<input class="inp" id="ue" type="email" required></label>
        <label class="f">Palavra-passe inicial<input class="inp" id="us" type="text" minlength="6" placeholder="mínimo 6 caracteres" ${demo ? "" : "required"}></label>
        <label class="f">Perfil<select class="inp" id="up"><option value="empreiteiro">Empreiteiro</option><option value="fiscal">Fiscal</option><option value="dono">Dono de obra</option><option value="admin">Administrador (vê como qualquer perfil)</option></select></label>
        <div class="row"><button class="btn pri" type="submit">Adicionar</button><span class="note" id="ust"></span></div>
      </form>
    </section>
    ${demo ? `<section class="card"><h2>Demonstração</h2><p class="note">Para ver a aplicação com outro perfil, saia e escolha outro. Pode também apagar as alterações feitas neste dispositivo.</p><div class="row"><button class="btn" id="dreset">Repor dados originais</button></div></section>` : ""}`;
  return {
    html, bind: async () => {
      const el = $("#ulist");
      const draw = async () => {
        const us = await store.listUsers();
        el.innerHTML = us.length ? us.map((u) => `<div class="li"><span class="li-t">${esc(u.nome)}</span><span class="role">${PAPEL[u.papel] || u.papel}</span><span class="li-s mono">${esc(u.email)}</span></div>`).join("") : `<div class="empty">Ainda ninguém. Adicione o empreiteiro e o fiscal.</div>`;
      };
      draw().catch(() => (el.innerHTML = `<div class="err">Não foi possível carregar.</div>`));
      $("#uf").onsubmit = async (e) => {
        e.preventDefault();
        $("#ust").textContent = "A criar...";
        try {
          await store.addUser({ nome: $("#un").value.trim(), email: $("#ue").value.trim(), senha: $("#us").value, papel: $("#up").value });
          $("#ust").textContent = "Adicionado. Envie-lhe o endereço da aplicação, o email e a palavra-passe.";
          e.target.reset(); draw();
        } catch (err) { $("#ust").textContent = "Não foi possível: " + erroSimples(err) + "."; }
      };
      const dr = $("#dreset");
      if (dr) dr.onclick = () => { store.reset(); toast("Dados de demonstração repostos"); };
    },
  };
}

/* ============================================================ relatórios de vistoria */
const diaLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaNome = (dia) => { const d = new Date(dia + "T12:00:00"); return `${DIAS_SEM[d.getDay()]}, ${fd(dia, true)}`; };
const hora = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
/** Agrupa os registos de vistoria por dia e por fiscal. */
function resumoVistorias(regs) {
  const dias = new Map();
  for (const r of regs) {
    const dia = diaLocal(r.em);
    const k = dia + "|" + r.por;
    const x = dias.get(k) || { dia, por: r.por, nome: r.nomePor || r.por, regs: [], us: new Set(), ativs: new Set(), fotos: 0, coments: 0 };
    x.regs.push(r); if (r.unidade) x.us.add(r.unidade); if (r.ativ && !r.pend) x.ativs.add(r.ativ);
    if (r.pend) x.pends = (x.pends || 0) + 1;
    x.fotos += (r.dados && r.dados.nfotos) || (/(\d+) fotografia/.exec(r.texto || "") || [0, 0])[1] * 1;
    if ((r.dados && r.dados.nota) || /comentário:/.test(r.texto || "")) x.coments++;
    dias.set(k, x);
  }
  return [...dias.values()].sort((a, b) => b.dia.localeCompare(a.dia) || a.nome.localeCompare(b.nome));
}
function vistoriasView() {
  const st = (ui.vistLista = ui.vistLista || { por: store.user.papel === "fiscal" ? store.user.email : "", sel: null });
  const html = `
    <div class="card-h"><h1>Relatórios de vistoria</h1></div>
    <p style="max-width:70ch">Cada vez que o fiscal guarda uma vistoria, fica registado o que mudou: a percentagem antes e depois, o comentário e as fotografias. Escolha um ou mais dias e veja o relatório, que pode imprimir ou guardar em PDF.</p>
    <div id="vlista"><div class="note">A carregar as vistorias...</div></div>`;
  return {
    html, bind: async () => {
      const box = $("#vlista");
      let regs = [];
      try { regs = await store.getRegistosTipo("vistoria"); } catch (e) { box.innerHTML = `<div class="err">Não foi possível carregar as vistorias: ${esc(erroSimples(e))}.</div>`; return; }
      regs = regs.filter(pendRegVivo); // um pendente apagado sai dos relatórios
      const todos = resumoVistorias(regs);
      const fiscais = [...new Map(todos.map((x) => [x.por, x.nome])).entries()];
      const desenha = () => {
        const lista = todos.filter((x) => !st.por || x.por === st.por);
        if (st.sel == null) st.sel = new Set(lista.length ? [lista[0].dia + "|" + lista[0].por] : []);
        const n = [...st.sel].filter((k) => lista.some((x) => x.dia + "|" + x.por === k)).length;
        box.innerHTML = `
          ${fiscais.length > 1 || (st.por && !fiscais.some(([e]) => e === st.por)) ? `<div class="filters"><label class="f">Fiscal<select class="inp" id="vfPor"><option value="">Todos</option>${fiscais.map(([e, nome]) => `<option value="${esc(e)}" ${st.por === e ? "selected" : ""}>${esc(nome)}</option>`).join("")}</select></label></div>` : ""}
          ${lista.length ? `<div class="vdias">${lista.map((x) => { const k = x.dia + "|" + x.por; return `<label class="vdia ${st.sel.has(k) ? "on" : ""}">
              <input type="checkbox" data-vd="${esc(k)}" ${st.sel.has(k) ? "checked" : ""}>
              <span class="vd-t"><b>${diaNome(x.dia)}</b><small>${esc(x.nome)} · ${hora(x.regs[x.regs.length - 1].em)} a ${hora(x.regs[0].em)}</small></span>
              <span class="vd-n num"><span><b>${x.us.size}</b> ${x.us.size === 1 ? "fração" : "frações"}</span><span><b>${x.ativs.size}</b> ${x.ativs.size === 1 ? "especialidade" : "especialidades"}</span><span><b>${x.fotos}</b> ${x.fotos === 1 ? "fotografia" : "fotografias"}</span><span><b>${x.coments}</b> ${x.coments === 1 ? "comentário" : "comentários"}</span>${x.pends ? `<span><b>${x.pends}</b> ${x.pends === 1 ? "pendente" : "pendentes"}</span>` : ""}</span>
              <button class="btn sm" data-vd1="${esc(k)}">Ver só este dia</button></label>`; }).join("")}</div>
            <div class="vdbar"><span class="num"><b>${n}</b> ${n === 1 ? "dia escolhido" : "dias escolhidos"}</span><button class="btn pri" id="vdVer" ${n ? "" : "disabled"}>Ver relatório</button></div>`
          : `<div class="empty">Ainda não há vistorias guardadas${st.por ? " deste fiscal" : ""}. Quando o fiscal guardar uma vistoria num apartamento, aparece aqui.</div>`}`;
        const fp = $("#vfPor"); if (fp) fp.onchange = () => { st.por = fp.value; st.sel = null; desenha(); };
        box.querySelectorAll("[data-vd]").forEach((c) => (c.onchange = () => { c.checked ? st.sel.add(c.dataset.vd) : st.sel.delete(c.dataset.vd); desenha(); }));
        const abrir = (ks) => { ui.relVist = { chaves: ks }; location.hash = "#relvist"; };
        box.querySelectorAll("[data-vd1]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abrir([b.dataset.vd1]); }));
        const vv = $("#vdVer"); if (vv) vv.onclick = () => abrir([...st.sel].filter((k) => lista.some((x) => x.dia + "|" + x.por === k)));
      };
      desenha();
    },
  };
}
function relVistView() {
  const rv = ui.relVist;
  if (!rv) return { html: `<div class="empty">Escolha primeiro os dias. <a href="#vistorias">Relatórios de vistoria</a></div>` };
  const html = `<div class="no-print row" style="justify-content:space-between"><a class="btn sm" href="#vistorias">‹ Relatórios de vistoria</a><button class="btn pri" id="rvPrint">Imprimir ou guardar em PDF</button></div>
    <div id="rvBox"><div class="note">A preparar o relatório...</div></div>`;
  return {
    html, bind: async () => {
      $("#rvPrint").onclick = () => window.print();
      const box = $("#rvBox");
      let regs;
      try { regs = await store.getRegistosTipo("vistoria"); } catch (e) { box.innerHTML = `<div class="err">Não foi possível carregar as vistorias: ${esc(erroSimples(e))}.</div>`; return; }
      regs = regs.filter(pendRegVivo); // um pendente apagado sai dos relatórios
      // chaves "dia|fiscal"; o atalho "Relatório de hoje" usa dias + por
      const chaves = new Set(rv.chaves || (rv.dias || []).map((d) => d + "|" + rv.por));
      const sel = regs.filter((r) => chaves.has(diaLocal(r.em) + "|" + r.por)).sort((a, b) => a.em.localeCompare(b.em));
      if (!sel.length) { box.innerHTML = `<div class="empty">Não há vistorias guardadas ${rv.dias ? "hoje" : "nos dias escolhidos"}.</div>`; return; }
      const dias = [...new Set(sel.map((r) => diaLocal(r.em)))].sort();
      const fiscais = [...new Set(sel.map((r) => r.nomePor || r.por))];
      // por atividade: primeiro "antes", último "depois"
      const porAt = new Map();
      for (const r of sel.filter((r) => !r.pend)) {
        const k = r.ativ || r.id;
        const x = porAt.get(k) || { ativ: r.ativ, unidade: r.unidade, regs: [] };
        x.regs.push(r); porAt.set(k, x);
      }
      const linhas = [...porAt.values()].map((x) => {
        const a = S.acts[x.ativ];
        const prim = x.regs[0], ult = x.regs[x.regs.length - 1];
        const d0 = prim.dados || {}, d1 = ult.dados || {};
        const depois = [...x.regs].reverse().map((r) => r.dados && r.dados.depois).find((v) => v != null);
        const notas = [...new Set(x.regs.map((r) => r.dados ? r.dados.nota : (/comentário: (.*)$/.exec(r.texto || "") || [])[1]).filter(Boolean))];
        // vistoria anterior ao período (de qualquer fiscal), para ver se a obra andou
        const ini0 = new Date(dias[0] + "T00:00:00").toISOString();
        const ant = x.ativ ? regs.filter((r) => !r.pend && r.ativ === x.ativ && r.em < ini0).sort((p, q) => q.em.localeCompare(p.em))[0] : null;
        const valDe = (r) => (r.dados && r.dados.depois != null ? r.dados.depois : (() => { const m = /: (\d+)% \(empreiteiro/.exec(r.texto || ""); return m ? Number(m[1]) : null; })());
        const prev = ant ? { pct: valDe(ant), em: ant.em } : null;
        const confirmado = x.regs.some((r) => r.dados && r.dados.confirmado);
        return { ...x, a, nome: (a && nomeAtiv(a)) || d1.esp || "Atividade", antes: d0.antes ?? null, depois: depois ?? null, emp: d1.emp ?? (a ? Math.round(Number(a.pctEmp) || 0) : null), notas, semDados: !prim.dados, texto: ult.texto, prev, confirmado };
      });
      const atencao = linhas.filter((l) => l.depois != null && l.emp != null && Math.abs(l.depois - l.emp) >= 15);
      const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
      const parado = linhas.filter((l) => l.prev && l.prev.pct != null && l.depois != null && l.depois < 100 && l.depois <= l.prev.pct && diasEntre(l.prev.em, (l.regs[l.regs.length - 1] || {}).em || new Date().toISOString()) >= 7);
      const porU = new Map();
      for (const l of linhas) { const k = l.unidade || "?"; (porU.get(k) || porU.set(k, []).get(k)).push(l); }
      const visitadas = new Set([...porU.keys(), ...sel.filter((r) => r.pend && r.unidade).map((r) => r.unidade)]);
      const ordemU = ordenaUnidades([...porU.keys()].map((id) => S.uMap[id] || { id, bloco: "?", piso: 99 })).map((u) => u.id);
      const pctTxt = (v) => (v == null ? "s/v" : v + "%");
      const nomeU = (id) => { const u = S.uMap[id]; return u ? (u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome) : id; };
      const descU = (id) => { const u = S.uMap[id]; if (!u) return ""; return [u.tipo, u.bloco && u.bloco !== "Geral" ? "Bloco " + u.bloco : "", u.tipo === "Apartamento" ? "Piso " + u.piso : ""].filter(Boolean).join(" · "); };
      const iniciais = (t) => String(t).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("");
      const ref = `RV-${dias[0].replace(/-/g, "")}${dias.length > 1 ? "-" + dias[dias.length - 1].replace(/-/g, "") : ""}-${iniciais(fiscais[0] || "F")}`;
      const horario = dias.map((d) => { const rs = sel.filter((r) => diaLocal(r.em) === d); return `${fd(d, true)}, das ${hora(rs[0].em)} às ${hora(rs[rs.length - 1].em)}`; });
      const nCom = linhas.filter((l) => l.notas.length).length;
      // fotografias dos dias escolhidos, do(s) fiscal(is) do relatório
      const pors = new Set(sel.map((r) => r.por));
      box.innerHTML = `<div class="note">A carregar as fotografias...</div>`;
      let fotos = [];
      for (const d of dias) {
        const ini = new Date(d + "T00:00:00").toISOString(), fim = new Date(new Date(d + "T00:00:00").getTime() + 86400000).toISOString();
        try { fotos = fotos.concat(await store.getFotosEntre(ini, fim)); } catch (e) { /* sem fotografias */ }
      }
      const ativsSel = new Set(linhas.map((l) => l.ativ));
      fotos = fotos.filter((f) => pors.has(f.por) && ativsSel.has(f.ativ));
      // numeração pela ordem do relatório (fração, especialidade, hora)
      const ordemL = ordemU.flatMap((uid) => porU.get(uid));
      fotos.sort((a, b) => ordemL.findIndex((l) => l.ativ === a.ativ) - ordemL.findIndex((l) => l.ativ === b.ativ) || (a.em || "").localeCompare(b.em || ""));
      fotos.forEach((f, i) => (f.num = i + 1));
      const refsDe = (ativ) => fotos.filter((f) => f.ativ === ativ).map((f) => `<a href="#rvf${f.num}" class="rv-fr">F${f.num}</a>`).join(" ");
      // pendentes: todos os que já existiam no fim do período e ainda não estavam fechados nessa altura,
      // mais os que foram fechados durante o período. O estado é o desse dia (um relatório antigo não muda).
      const iniP = new Date(dias[0] + "T00:00:00").toISOString(), fimP = new Date(new Date(dias[dias.length - 1] + "T00:00:00").getTime() + 86400000).toISOString();
      const noPer = (p) => p.em >= iniP && p.em < fimP && dias.includes(diaLocal(p.em));
      const pendRel = pendTodos().filter((x) => (x.criadoEm || "") < fimP && S.uMap[x.unidade] && (!S.idsTeste.has(x.unidade) || porU.has(x.unidade)))
        .map((x) => ({ x, e: pendEstadoEm(x, fimP), ev: (x.historico || []).filter(noPer) }))
        .filter(({ e, ev }) => e.estado !== "fechado" || ev.some((p) => p.acao === "fechado" || p.acao === "confirmado"))
        .sort((a, b) => (b.x.criadoEm || "").localeCompare(a.x.criadoEm || ""));
      const nPendAb = pendRel.filter(({ e }) => e.estado !== "fechado").length;
      let sec = 0;
      box.innerHTML = `<article class="rv">
        <header class="rv-cab">
          <div class="rv-marca"><div class="brand-mark">AL</div><div><b>${esc(S.cfg.nome || "Obra ALTIS")}</b><span>Controlo de obra</span></div></div>
          <div class="rv-tit"><h1>Relatório de vistoria</h1><span class="mono">${esc(ref)}</span></div>
        </header>
        <table class="rv-id"><tbody>
          <tr><th>${dias.length === 1 ? "Data" : "Datas"}</th><td>${dias.length === 1 ? diaNome(dias[0]) : dias.map((d) => diaNome(d)).join("; ")}</td><th>Fiscal</th><td>${esc(fiscais.join(", "))}</td></tr>
          <tr><th>Horário</th><td>${horario.join("<br>")}</td><th>Emitido</th><td>${fdt(new Date().toISOString())}, por ${esc(store.user.nome)}</td></tr>
        </tbody></table>
        <div class="rv-res num">
          <div><b>${visitadas.size}</b><span>${visitadas.size === 1 ? "fração visitada" : "frações visitadas"}</span></div>
          <div><b>${linhas.length}</b><span>${linhas.length === 1 ? "especialidade vistoriada" : "especialidades vistoriadas"}</span></div>
          <div><b>${fotos.length}</b><span>${fotos.length === 1 ? "fotografia" : "fotografias"}</span></div>
          <div class="${atencao.length ? "mau" : ""}"><b>${atencao.length}</b><span>${atencao.length === 1 ? "diferença com o empreiteiro" : "diferenças com o empreiteiro"}</span></div>
          <div class="${parado.length ? "aviso" : ""}"><b>${parado.length}</b><span>sem avanço desde a vistoria anterior</span></div>
          <div class="${nPendAb ? "aviso" : ""}"><b>${nPendAb}</b><span>${nPendAb === 1 ? "pendente por resolver" : "pendentes por resolver"}</span></div>
        </div>

        <section class="rv-sec"><h2>${++sec}. Pontos de atenção</h2>
          <h3 class="rv-sub">Diferenças entre o fiscal e o empreiteiro</h3>
          ${atencao.length ? `<p class="rv-nota">Especialidades em que a percentagem verificada pelo fiscal difere 15 pontos ou mais da indicada pelo empreiteiro.</p>
          <table class="rv-t"><thead><tr><th>Fração</th><th>Especialidade</th><th class="n">Fiscal</th><th class="n">Empreiteiro</th><th class="n">Diferença</th></tr></thead><tbody>
          ${atencao.map((l) => `<tr><td class="mono">${esc(nomeU(l.unidade))}</td><td>${esc(l.nome)}</td><td class="n"><b>${pctTxt(l.depois)}</b></td><td class="n">${pctTxt(l.emp)}</td><td class="n mau">${l.depois - l.emp > 0 ? "+" : ""}${l.depois - l.emp} pp</td></tr>`).join("")}
          </tbody></table>` : `<p class="rv-nota">Sem diferenças relevantes entre o fiscal e o empreiteiro.</p>`}
          <h3 class="rv-sub">Sem avanço desde a vistoria anterior</h3>
          ${parado.length ? `<p class="rv-nota">Especialidades por concluir que estão com a mesma percentagem (ou menos) do que na vistoria anterior, feita há 7 dias ou mais.</p>
          <table class="rv-t"><thead><tr><th>Fração</th><th>Especialidade</th><th class="n">Vistoria anterior</th><th class="n">Agora</th><th class="n">Parado há</th></tr></thead><tbody>
          ${parado.map((l) => `<tr><td class="mono">${esc(nomeU(l.unidade))}</td><td>${esc(l.nome)}${l.confirmado ? ` <span class="rv-conf">confirmado</span>` : ""}</td><td class="n">${pctTxt(l.prev.pct)} · ${fd(diaLocal(l.prev.em))}</td><td class="n"><b>${pctTxt(l.depois)}</b></td><td class="n aviso">${diasEntre(l.prev.em, l.regs[l.regs.length - 1].em)} dias</td></tr>`).join("")}
          </tbody></table>` : `<p class="rv-nota">Todas as especialidades com vistoria anterior avançaram (ou não tinham vistoria anterior).</p>`}
        </section>

        <section class="rv-sec"><h2>${++sec}. Assuntos pendentes</h2>
          ${pendRel.length ? `<p class="rv-nota">Todos os pontos por resolver em ${fd(dias[dias.length - 1], true)}, os mais recentes primeiro, com a data em que foram registados. Aparecem em todos os relatórios até serem fechados. O estado é o desse dia.</p>
            <table class="rv-t"><thead><tr><th>Registado</th><th>Fração</th><th>Pendente</th><th>Atividade</th><th>Estado</th><th>Ok do fiscal</th><th>Nestes dias</th></tr></thead><tbody>
            ${pendRel.map(({ x, e, ev }) => { const a = x.ativ ? S.acts[x.ativ] : null; const novo = noPer({ em: x.criadoEm || "" });
              return `<tr class="${e.estado === "aberto" ? "at" : ""}"><td class="num">${fd(diaLocal(x.criadoEm))}${novo ? `<small class="rv-novo">novo</small>` : ""}</td><td class="mono">${esc(nomeU(x.unidade))}</td>
                <td><b>${esc(x.texto)}</b><small>por ${esc(x.criadoNome || "")}</small></td><td>${a ? esc(nomeAtiv(a)) : `<span class="rv-vazio">fração em geral</span>`}</td>
                <td>${{ aberto: "Por resolver", feito: "Resolvido pelo empreiteiro, por verificar", fechado: "Fechado" }[e.estado]}</td><td>${e.fiscalOk ? `<span class="rv-conf">Confirmado</span>` : `<span class="aviso">Por confirmar</span>`}</td>
                <td>${ev.length ? ev.map((p) => `${fd(diaLocal(p.em))}: ${esc(p.nome || p.por)} ${PEND_ACAO[p.acao] || p.acao}${p.nota ? `: <i>${esc(p.nota)}</i>` : ""}`).join("<br>") : `<span class="rv-vazio">sem alterações</span>`}</td></tr>`; }).join("")}
            </tbody></table>` : `<p class="rv-nota">Não havia pendentes por resolver em ${fd(dias[dias.length - 1], true)}.</p>`}
        </section>

        <section class="rv-sec"><h2>${++sec}. Registo por fração</h2>
          <p class="rv-nota">"Vistoria anterior" é a última vistoria antes deste período; "Agora" é a percentagem verificada no fim do período; "Evolução" é a diferença entre as duas, em pontos percentuais (pp). Fn remete para o registo fotográfico.</p>
          ${ordemU.map((uid) => `<div class="rv-u"><h3><span class="mono">${esc(nomeU(uid))}</span><small>${esc(descU(uid))}</small></h3>
            <table class="rv-t"><thead><tr><th>Especialidade</th><th class="n">Vistoria anterior</th><th class="n">Agora</th><th class="n">Evolução</th><th class="n">Empreiteiro</th><th>Observações</th><th>Fotos</th></tr></thead><tbody>
            ${porU.get(uid).map((l) => `<tr class="${atencao.includes(l) ? "at" : ""}"><td><b>${esc(l.nome)}</b>${l.a ? ` <button class="lnk-b no-print rv-fic" data-a="${l.a.id}">ficha</button>` : ""}</td>
              ${l.semDados && l.depois == null ? `<td colspan="4" class="rv-ant">${esc(l.texto || "")}</td>` : (() => {
                const base = l.prev && l.prev.pct != null ? l.prev.pct : null;
                const ev = base != null && l.depois != null ? l.depois - base : null;
                const evTxt = ev == null ? `<span class="rv-vazio">primeira</span>` : ev > 0 ? `<span class="bom">+${ev} pp</span><small>em ${diasEntre(l.prev.em, l.regs[l.regs.length - 1].em)} d</small>` : parado.includes(l) ? `<span class="aviso">sem avanço</span><small>${diasEntre(l.prev.em, l.regs[l.regs.length - 1].em)} d</small>` : ev < 0 ? `<span class="mau">${ev} pp</span>` : `<span>0 pp</span>`;
                return `<td class="n">${l.prev ? `${pctTxt(l.prev.pct)}<small>${fd(diaLocal(l.prev.em))}</small>` : `<span class="rv-vazio">sem vistoria</span>`}</td><td class="n"><b>${pctTxt(l.depois)}</b></td><td class="n rv-ev">${evTxt}</td><td class="n">${pctTxt(l.emp)}</td>`;
              })()}
              <td>${l.confirmado ? `<span class="rv-conf">Confirmado sem alteração</span>${l.notas.length ? "<br>" : ""}` : ""}${l.notas.map((t) => esc(t)).join("<br>") || (l.confirmado ? "" : `<span class="rv-vazio">sem observações</span>`)}</td><td class="rv-refs">${refsDe(l.ativ)}</td></tr>`).join("")}
            </tbody></table></div>`).join("")}
        </section>

        ${fotos.length ? `<section class="rv-sec rv-fotos"><h2>${++sec}. Registo fotográfico</h2>
          <div class="rv-fg">${fotos.map((f, i) => { const l = linhas.find((x) => x.ativ === f.ativ); return `<figure id="rvf${f.num}"><button class="rv-img" data-rvi="${i}" aria-label="Ver a fotografia F${f.num} em grande"><img src="${f.data}" alt="F${f.num}: ${esc((l && l.nome) || "")} em ${esc(nomeU(f.unidade))}"></button>
            <figcaption><b>F${f.num}</b> · <span class="mono">${esc(nomeU(f.unidade))}</span> · ${esc((l && l.nome) || "")} · ${fd(diaLocal(f.em))} ${hora(f.em)}${f.nota ? `<br><span>${esc(f.nota)}</span>` : ""}</figcaption></figure>`; }).join("")}</div>
        </section>` : ""}

        <section class="rv-sec rv-ass"><h2>${++sec}. Validação</h2>
          <div class="rv-assg">
            <div><span>O fiscal</span><b>${esc(fiscais.join(", "))}</b><i></i><small>Assinatura e data</small></div>
            <div><span>Tomei conhecimento: o empreiteiro</span><b>&nbsp;</b><i></i><small>Assinatura e data</small></div>
          </div>
        </section>
        <footer class="rv-pe">${esc(ref)} · ${esc(S.cfg.nome || "Obra ALTIS")} · Relatório gerado pela aplicação de controlo de obra</footer>
      </article>`;
      bindCommon();
      box.querySelectorAll("[data-rvi]").forEach((b) => (b.onclick = () => abrirGaleria(fotos, +b.dataset.rvi)));
      document.title = ref + " · Relatório de vistoria";
    },
  };
}

/* ============================================================ equipas de trabalho */
const telLink = (t) => `<a href="tel:${esc(String(t).replace(/[^\d+]/g, ""))}">${esc(t)}</a>`;
/** Atribui (ou retira, com nome null) uma equipa a vários trabalhos de uma vez. */
const temOrdem = (a) => a.eqOrdem != null && a.eqOrdem !== "" && a.eqOrdem !== false;
/** Põe os trabalhos na fila da equipa, cada um na posição da data em que pode começar. Devolve a nova ordem (ids). */
function ordemComNovos(nome, novos, base = null) {
  const ini = (id) => (S.res.get(id) && S.res.get(id).provIni) || "9";
  const ord = (base || filaEquipa(nome).map((a) => a.id)).filter((id) => !novos.includes(id));
  for (const id of [...novos].sort((x, y) => ini(x).localeCompare(ini(y)))) {
    let k = ord.findIndex((o) => S.res.get(o) && S.res.get(o).estado !== "concluida" && ini(o) > ini(id));
    if (k < 0) k = ord.length;
    ord.splice(k, 0, id);
  }
  return ord;
}
/** Simula patches e diz o efeito. */
function efeitoDe(lista) {
  const pm = new Map(lista.map((l) => [l.id, l.patch]));
  const novo = Object.values(S.acts).map((a) => (pm.has(a.id) ? { ...a, ...pm.get(a.id) } : a));
  const r2 = schedule(novo, S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {});
  let mudam = 0, fim = "";
  for (const a of novo) { const x = S.res.get(a.id), y = r2.get(a.id); if (x && y && (x.provIni !== y.provIni || x.provFim !== y.provFim)) mudam++; if (y && y.estado !== "concluida" && y.provFim > fim) fim = y.provFim; }
  return { r2, mudam, fim };
}
/** Atribuir (ou tirar) equipa: a disponibilidade da equipa passa logo a contar nas datas. */
async function atribuirEquipa(ids, nome) {
  const muda = ids.filter((id) => S.acts[id] && (S.acts[id].equipa || null) !== (nome || null));
  if (!muda.length) { toast(nome ? `Já estava${ids.length > 1 ? "m" : ""} com ${nome}` : "Já estava sem equipa"); return; }
  const lista = [];
  if (nome) {
    const ord = ordemComNovos(nome, muda.filter((id) => S.res.get(id).estado !== "concluida"));
    ord.forEach((id, i) => { const v = (i + 1) * 10; const a = S.acts[id]; const p = {}; if (a.eqOrdem !== v) p.eqOrdem = v; if (a.equipa !== nome) p.equipa = nome; if (Object.keys(p).length) lista.push({ id, patch: p }); });
    for (const id of muda) if (!ord.includes(id)) lista.push({ id, patch: { equipa: nome, eqOrdem: null } }); // concluídas: só o nome
  } else for (const id of muda) lista.push({ id, patch: { equipa: null, eqOrdem: null } });
  const ef = efeitoDe(lista);
  const um = muda.length === 1 ? S.acts[muda[0]] : null;
  const alvo = um ? `${nomeAtiv(um)} em ${um.unidade}` : `${muda.length} trabalhos`;
  // trabalhos que passam para mais tarde por a equipa estar ocupada
  const tarde = nome ? muda.map((id) => ({ a: S.acts[id], de: S.res.get(id).provIni, para: ef.r2.get(id).provIni })).filter((x) => x.para > x.de) : [];
  const ciclo = muda.filter((id) => ef.r2.get(id).ciclo && !S.res.get(id).ciclo);
  if (tarde.length || ciclo.length) {
    const k = await perguntar({
      titulo: ciclo.length ? "Esta atribuição contradiz a sequência" : `A ${esc(nome)} está ocupada`,
      texto: `${tarde.length ? `<p>A equipa não pode fazer dois trabalhos ao mesmo tempo. ${tarde.length === 1 ? "Este trabalho passa" : "Estes trabalhos passam"} para mais tarde:</p>
        <ul class="dlg-l">${tarde.slice(0, 6).map((x) => { const pos = ef.r2.get(x.a.id).preds.find((d) => d.fonte === "equipa"); const ant = pos && S.acts[pos.id]; return `<li><b>${esc(nomeAtiv(x.a))}</b> em ${esc(x.a.unidade)}: começava a ${fd(x.de)}, passa a ${fd(x.para)}${ant ? `<br><small class="note">a equipa só fica livre depois de ${esc(nomeAtiv(ant))} em ${esc(ant.unidade)}</small>` : ""}</li>`; }).join("")}${tarde.length > 6 ? `<li class="note">e mais ${tarde.length - 6}</li>` : ""}</ul>` : ""}
        ${ciclo.length ? `<div class="dlg-av">Com a ordem da fila, a equipa teria de fazer um trabalho antes de outro de que ele depende. As datas destes trabalhos não se conseguem calcular.</div>` : ""}
        <p>${ef.mudam} ${ef.mudam === 1 ? "atividade muda" : "atividades mudam"} de datas. A obra ${ef.fim !== S.tot.fim ? `passa a acabar a <b>${fd(ef.fim, true)}</b> (era ${fd(S.tot.fim, true)})` : "continua a acabar a " + fd(ef.fim, true)}.</p>
        <p class="note">Pode mudar a ordem depois, no Plano das equipas.</p>`,
      opcoes: [{ k: "sim", l: `Atribuir à ${esc(nome)}`, estilo: ciclo.length ? "" : "pri" }, { k: "nao", l: "Cancelar", estilo: ciclo.length ? "pri" : "" }],
    });
    if (k !== "sim") return false;
  }
  await store.updateMuitas(lista, { tipo: "equipa", texto: nome ? `${alvo} atribuído${um ? "" : "s"} a ${nome}` : `${alvo} ficou sem equipa` });
  toast(`${nome ? `${muda.length === 1 ? "Atribuído" : muda.length + " trabalhos atribuídos"} a ${nome} e na fila dela` : `Equipa retirada de ${muda.length === 1 ? "1 trabalho" : muda.length + " trabalhos"}`}. ${ef.mudam ? `${ef.mudam} ${ef.mudam === 1 ? "atividade mudou" : "atividades mudaram"} de datas` : "Nenhuma data mudou"}.`);
  return true;
}
/** Põe na fila da sua equipa trabalhos acabados de criar (sem perguntar). */
async function filarSemPerguntar(ids) {
  const porEq = {};
  for (const id of ids) { const a = S.acts[id]; if (a && a.equipa && S.equipas.includes(a.equipa) && !temOrdem(a) && S.res.get(id) && S.res.get(id).estado !== "concluida") (porEq[a.equipa] = porEq[a.equipa] || []).push(id); }
  const lista = [];
  for (const [nome, novos] of Object.entries(porEq)) ordemComNovos(nome, novos).forEach((id, i) => { const v = (i + 1) * 10; if (S.acts[id].eqOrdem !== v) lista.push({ id, patch: { eqOrdem: v } }); });
  if (lista.length) await store.updateMuitas(lista, null);
}
/** Uma vez: pôr nas filas os trabalhos com equipa que nunca lá estiveram (por exemplo os que vieram da importação). */
function planoFilasTodas() {
  const lista = [];
  const porEq = [];
  for (const nome of S.equipas) {
    const novos = Object.values(S.acts).filter((a) => a.equipa === nome && (a.eqOrdem == null || a.eqOrdem === "") && S.res.get(a.id).estado !== "concluida").map((a) => a.id);
    if (!novos.length) continue;
    const ord = ordemComNovos(nome, novos);
    ord.forEach((id, i) => { const v = (i + 1) * 10; if (S.acts[id].eqOrdem !== v) lista.push({ id, patch: { eqOrdem: v } }); });
    porEq.push({ nome, n: novos.length, ids: ord });
  }
  let ef = efeitoDe(lista);
  // o que ficar em conflito com a sequência fica de fora da fila
  const fora = lista.filter((l) => ef.r2.get(l.id).ciclo && !S.res.get(l.id).ciclo).map((l) => l.id);
  if (fora.length) { for (const l of lista) if (fora.includes(l.id)) l.patch = { eqOrdem: false }; ef = efeitoDe(lista); }
  const fimEq = (nome, res) => Object.values(S.acts).filter((a) => a.equipa === nome && res.get(a.id).estado !== "concluida").reduce((m, a) => (res.get(a.id).provFim > m ? res.get(a.id).provFim : m), "");
  for (const e of porEq) { e.antes = fimEq(e.nome, S.res); e.depois = fimEq(e.nome, ef.r2); }
  return { lista, porEq, fora: fora.length, ...ef, total: porEq.reduce((t, e) => t + e.n, 0) };
}
async function filasTodas() {
  const pl = planoFilasTodas();
  if (!pl.total) return;
  const k = await perguntar({
    titulo: `Pôr ${pl.total} trabalhos nas filas das equipas?`,
    texto: `<p>Cada trabalho entra na fila da sua equipa pela data em que pode começar. A partir daí, cada equipa só faz um trabalho de cada vez.</p>
      <ul class="dlg-l">${pl.porEq.map((e) => `<li><b>${esc(e.nome)}</b>: ${e.n} trabalhos; acabava a ${fd(e.antes)}, passa a acabar a <b>${fd(e.depois, true)}</b></li>`).join("")}</ul>
      <p>${pl.mudam} atividades mudam de datas. A obra ${pl.fim !== S.tot.fim ? `passa a acabar a <b>${fd(pl.fim, true)}</b> (era ${fd(S.tot.fim, true)})` : `continua a acabar a ${fd(pl.fim, true)}`}.</p>
      ${pl.fora ? `<div class="dlg-av">${pl.fora} ${pl.fora === 1 ? "trabalho fica" : "trabalhos ficam"} fora da fila, porque a ordem das datas contradiz a sequência. Ficam na lista "sem lugar na fila" para os pôr à mão.</div>` : ""}
      <p class="note">Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: "Sim, pôr nas filas", estilo: "pri" }, { k: "nao", l: "Agora não" }],
  });
  if (k !== "sim") return;
  await store.updateMuitas(pl.lista, { tipo: "equipa", texto: `${pl.total} trabalhos postos nas filas das equipas` });
  toast(`${pl.total} trabalhos nas filas das equipas. ${pl.mudam} atividades mudaram de datas.`);
}
function statsEquipa(nome) {
  const t = { total: 0, fazer: 0, curso: 0, atr: 0, conc: 0, prox: null };
  for (const a of Object.values(S.acts)) {
    if ((a.equipa || "") !== nome) continue;
    const r = S.res.get(a.id); if (!r) continue;
    t.total++;
    if (r.estado === "concluida") { t.conc++; continue; }
    t.fazer++;
    if (r.estado === "em_curso") t.curso++;
    if (r.atrasada) t.atr++;
    if (r.estado !== "em_curso" && (!t.prox || r.inicio < t.prox.r.inicio)) t.prox = { a, r };
  }
  return t;
}
function equipasView() {
  const lista = S.eqLista;
  const semEq = Object.values(S.acts).filter((a) => !a.equipa && S.res.get(a.id).estado !== "concluida").length;
  const html = `
    ${defTabs("equipas")}
    <div class="card-h"><h1>Equipas de trabalho</h1><button class="btn pri" id="eqNova">+ Nova equipa</button></div>
    <p style="max-width:70ch">As equipas que fazem os trabalhos na obra (mosaicos, pintura, carpintaria...). Na ficha de cada equipa diga o que ela pode fazer e onde trabalha: a aplicação mostra-lhe os trabalhos possíveis para planear. Se uma equipa sair da obra, abra a ficha dela e use <b>A equipa sai da obra</b>: os trabalhos que faltam passam para outras equipas.</p>
    ${semEq ? `<div class="banner"><span><b>${semEq} trabalhos por fazer ainda não têm equipa.</b></span><button class="btn sm" data-eqatr="_sem">Atribuir equipas</button></div>` : ""}
    ${lista.length ? `<div class="eqcards">${lista.filter((e) => e.ativa !== false).map((e) => {
      const t = statsEquipa(e.nome);
      const esps = (e.esp || []).map((k) => S.espIdx[k]).filter(Boolean);
      return `<section class="eqcard">
        <div class="eqcard-h"><b>${esc(e.nome)}</b>${e.daObra ? `<span class="pill" title="Já aparecia nos trabalhos. Ao editar fica registada aqui.">dos trabalhos</span>` : ""}</div>
        ${e.responsavel || e.telefone ? `<div class="note">${e.responsavel ? esc(e.responsavel) : ""}${e.responsavel && e.telefone ? " · " : ""}${e.telefone ? telLink(e.telefone) : ""}</div>` : ""}
        ${esps.length ? `<div class="tags">${esps.map((x) => `<span class="tag ro">${esc(x.nome)}</span>`).join("")}</div>` : ""}
        ${e.blocos && e.blocos.length ? `<div class="note">Trabalha em: ${e.blocos.map((k) => (k.length === 1 ? "Bloco " + k : k)).join(", ")}</div>` : ""}
        <div class="eqstats num"><span><b>${t.fazer}</b> por fazer</span><span><b>${t.curso}</b> em curso</span>${t.atr ? `<span class="mau-t"><b>${t.atr}</b> atrasados</span>` : ""}<span><b>${t.conc}</b> concluídos</span></div>
        ${t.prox ? `<div class="note">Próximo: ${esc(nomeAtiv(t.prox.a))} em ${esc(t.prox.a.unidade)}, ${t.prox.r.inicio <= S.hoje ? "já pode começar" : fd(t.prox.r.inicio)}</div>` : ""}
        ${e.notas ? `<div class="note">${esc(e.notas)}</div>` : ""}
        <div class="row" style="gap:6px;margin-top:auto"><button class="btn sm pri" data-eqplan="${esc(e.nome)}" title="Pôr os trabalhos desta equipa pela ordem em que os vai fazer">Planear</button><button class="btn sm" data-eqver="${esc(e.nome)}">Ver trabalhos</button><button class="btn sm" data-eqatr="${esc(e.nome)}">Atribuir trabalhos</button><button class="btn sm" data-eqed="${esc(e.nome)}">Editar</button></div>
      </section>`;
    }).join("")}</div>` : `<div class="empty">Ainda não há equipas. Crie a primeira com <b>+ Nova equipa</b>.</div>`}
    ${lista.some((e) => e.ativa === false) ? `<h2 style="margin-top:18px">Equipas que saíram da obra</h2><div class="eqcards">${lista.filter((e) => e.ativa === false).map((e) => { const t = statsEquipa(e.nome); return `<section class="eqcard inativa">
        <div class="eqcard-h"><b>${esc(e.nome)}</b><span class="pill">saiu${e.saiuEm ? " a " + fd(e.saiuEm) : ""}</span></div>
        <div class="eqstats num"><span><b>${t.conc}</b> concluídos</span>${t.fazer ? `<span class="mau-t"><b>${t.fazer}</b> ainda por fazer</span>` : ""}</div>
        <div class="row" style="gap:6px;margin-top:auto"><button class="btn sm" data-eqver="${esc(e.nome)}">Ver trabalhos</button><button class="btn sm" data-eqed="${esc(e.nome)}">Abrir</button></div></section>`; }).join("")}</div>` : ""}`;
  return {
    html, bind: () => {
      $("#eqNova").onclick = () => openEquipa(null);
      document.querySelectorAll("[data-eqed]").forEach((b) => (b.onclick = () => openEquipa(b.dataset.eqed)));
      document.querySelectorAll("[data-eqplan]").forEach((b) => (b.onclick = () => { ui.eqPlan = b.dataset.eqplan; location.hash = "#planequipa"; }));
      document.querySelectorAll("[data-eqver]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, PLANO_PADRAO(), { equipa: b.dataset.eqver }); location.hash = "#plano"; }));
      document.querySelectorAll("[data-eqatr]").forEach((b) => (b.onclick = () => {
        const nome = b.dataset.eqatr, e = S.eqLista.find((x) => x.nome === nome);
        const esps = e && e.esp && e.esp.length === 1 ? S.espIdx[e.esp[0]] : null;
        Object.assign(ui.plano, PLANO_PADRAO(), { equipa: "_sem", atribuir: true, selec: new Set(), atrEq: nome === "_sem" ? "" : nome, ativ: esps ? esps.nome : "" });
        location.hash = "#plano";
      }));
    },
  };
}
/** A equipa pode fazer este trabalho? (especialidade e zona escolhidas na ficha da equipa) */
function podeFazer(e, a) {
  if (!e || !e.esp || !e.esp.length || !e.esp.includes(a.esp)) return false;
  if (!e.blocos || !e.blocos.length) return true;
  const u = S.uMap[a.unidade];
  return !!u && e.blocos.includes(u.tipo === "Loja" ? "Lojas" : u.bloco);
}
/* ============================================================ plano das equipas
   Cada equipa tem uma fila: a ordem em que vai fazer os trabalhos. O motor liga cada trabalho ao
   anterior da fila (só começa quando a equipa acaba o anterior), e tudo o que vem depois acerta-se. */
function filaEquipa(nome) {
  return Object.values(S.acts).filter((a) => a.equipa === nome && temOrdem(a))
    .sort((x, y) => Number(x.eqOrdem) - Number(y.eqOrdem) || String(x.id).localeCompare(String(y.id)));
}
/** Grava uma nova ordem da fila (ids pela ordem) e diz o que mudou. */
async function gravarFila(nome, ids, texto, extra = {}, semEquipa = []) {
  const antes = filaEquipa(nome);
  const fimAntes = antes.filter((a) => S.res.get(a.id).estado !== "concluida").reduce((m, a) => (S.res.get(a.id).provFim > m ? S.res.get(a.id).provFim : m), "");
  const lista = [];
  ids.forEach((id, i) => { const v = (i + 1) * 10; const a = S.acts[id]; const p = { ...(extra[id] || {}) }; if (a.eqOrdem !== v) p.eqOrdem = v; if (a.equipa !== nome) p.equipa = nome; if (Object.keys(p).length) lista.push({ id, patch: p }); });
  for (const a of antes) if (!ids.includes(a.id)) lista.push({ id: a.id, patch: semEquipa.includes(a.id) ? { eqOrdem: null, equipa: null } : { eqOrdem: false } });
  for (const id of semEquipa) if (!antes.some((a) => a.id === id)) lista.push({ id, patch: { eqOrdem: null, equipa: null } });
  if (!lista.length) return;
  // simula antes de gravar para dizer quantas datas mudam
  const pm = new Map(lista.map((l) => [l.id, l.patch]));
  const novo = Object.values(S.acts).map((a) => (pm.has(a.id) ? { ...a, ...pm.get(a.id) } : a));
  const r2 = schedule(novo, S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {});
  let mudam = 0; for (const a of novo) { const x = S.res.get(a.id), y = r2.get(a.id); if (x && y && (x.provIni !== y.provIni || x.provFim !== y.provFim)) mudam++; }
  const fimDepois = ids.filter((id) => r2.get(id).estado !== "concluida").reduce((m, id) => (r2.get(id).provFim > m ? r2.get(id).provFim : m), "");
  const ciclo = ids.filter((id) => r2.get(id).ciclo).length;
  const novos = ids.filter((id) => r2.get(id).ciclo && !S.res.get(id).ciclo);
  if (novos.length) {
    const k = await perguntar({
      titulo: "Esta ordem contradiz a sequência",
      texto: `<p>Com esta ordem, a equipa faria um trabalho antes de outro de que ele depende. Por exemplo: ${esc(nomeAtiv(S.acts[novos[0]]))} em ${esc(S.acts[novos[0]].unidade)}.</p><p class="note">Assim a aplicação não consegue calcular as datas destes trabalhos. O melhor é escolher outra ordem.</p>`,
      opcoes: [{ k: "nao", l: "Não gravar", estilo: "pri" }, { k: "sim", l: "Gravar mesmo assim" }],
    });
    if (k !== "sim") return;
  }
  await store.updateMuitas(lista, { tipo: "equipa", texto: `${nome}: ${texto}` });
  toast(`${texto}. ${mudam ? `${mudam} ${mudam === 1 ? "atividade mudou" : "atividades mudaram"} de datas` : "Nenhuma data mudou"}${fimDepois && fimDepois !== fimAntes ? `; a equipa acaba a ${fd(fimDepois)}${fimAntes ? ` (era ${fd(fimAntes)})` : ""}` : ""}.${ciclo ? " Atenção: há trabalhos em conflito com a sequência." : ""}`);
}
function planEquipaView() {
  const eqs = S.eqLista.filter((e) => e.ativa !== false);
  if (!eqs.length) return { html: `${defTabs("planequipa")}<div class="card-h"><h1>Plano das equipas</h1></div><div class="empty">Ainda não há equipas. Crie-as em <a href="#equipas">Equipas de trabalho</a>.</div>`, bind: () => {} };
  if (!ui.eqPlan || !eqs.some((e) => e.nome === ui.eqPlan)) ui.eqPlan = eqs[0].nome;
  const nome = ui.eqPlan;
  const ep = (ui.eqP = ui.eqP || { conc: false, fr: "", at: "" });
  const fila = filaEquipa(nome);
  const naFila = new Set(fila.map((a) => a.id));
  const vis = ep.conc ? fila : fila.filter((a) => S.res.get(a.id).estado !== "concluida");
  const nConc = fila.length - fila.filter((a) => S.res.get(a.id).estado !== "concluida").length;
  const porOrdenar = Object.values(S.acts).filter((a) => a.equipa === nome && !naFila.has(a.id) && S.res.get(a.id).estado !== "concluida")
    .sort((x, y) => (S.res.get(x.id).inicio || "").localeCompare(S.res.get(y.id).inicio || ""));
  // janela das barras
  let t0 = null, t1 = null;
  for (const a of vis) { const r = S.res.get(a.id); for (const d of [r.provIni, r.provFim]) if (d) { if (!t0 || d < t0) t0 = d; if (!t1 || d > t1) t1 = d; } }
  const span = Math.max(1, t0 ? diffDays(t0, t1) : 1);
  const pos = (d) => Math.max(0, Math.min(100, (100 * diffDays(t0, d)) / span));
  let parada = 0, fimEq = null, iniEq = null;
  let ant = null;
  const linhas = vis.map((a, i) => {
    const r = S.res.get(a.id);
    const ini = r.provIni, fim = r.provFim;
    if (r.estado !== "concluida") { if (!iniEq || ini < iniEq) iniEq = ini; if (!fimEq || fim > fimEq) fimEq = fim; }
    let gap = 0, motivo = "";
    if (ant && r.estado !== "concluida") {
      gap = Math.max(0, diffDays(S.res.get(ant.id).provFim, ini) - 1);
      if (gap > 0) {
        parada += gap;
        const outra = (r.preds || []).filter((d) => d.fonte !== "equipa").map((d) => ({ d, p: S.res.get(d.id) })).filter((x) => x.p).sort((x, y) => y.p.provFim.localeCompare(x.p.provFim))[0];
        motivo = outra && addDays(outra.p.provFim, 1) >= ini ? `à espera de ${nomeAtiv(S.acts[outra.d.id])}${S.acts[outra.d.id].unidade !== a.unidade ? " em " + S.acts[outra.d.id].unidade : ""}` : "data prevista mais tarde";
      }
    }
    ant = a;
    const pi = fila.indexOf(a);
    return `<div class="fq-row ${r.estado === "concluida" ? "conc" : ""} ${r.ciclo ? "ciclo" : ""}" data-fq="${a.id}" draggable="true">
      <div class="ordb"><button class="ord-b" data-fqm="${a.id}|-1" ${pi === 0 ? "disabled" : ""} title="Fazer antes" aria-label="Fazer antes">▲</button><button class="ord-b" data-fqm="${a.id}|1" ${pi === fila.length - 1 ? "disabled" : ""} title="Fazer depois" aria-label="Fazer depois">▼</button></div>
      <span class="fq-n num">${pi + 1}</span>
      <div class="fq-t"><button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button><span class="mono">${esc(a.unidade)}</span>
        ${gap > 0 ? `<span class="fq-gap">equipa parada ${gap} ${gap === 1 ? "dia" : "dias"} antes: ${esc(motivo)}</span>` : ""}${r.ciclo ? `<span class="fq-gap mau-t">esta ordem contradiz a sequência dos trabalhos</span>` : ""}</div>
      <span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>
      <div class="tl fq-tl" aria-hidden="true"><div class="fc st-${r.estado}" style="left:${pos(ini)}%;width:${Math.max(1, pos(fim) - pos(ini))}%"></div>${S.hoje >= t0 && S.hoje <= t1 ? `<div class="today" style="left:${pos(S.hoje)}%"></div>` : ""}</div>
      <span class="fq-d mono num">${fd(ini)} a ${fd(fim)}</span>
      <span class="fq-dv">${deltaHTML(r.atraso)}</span>
      <span class="fq-ac"><button class="btn sm" data-fqx="${a.id}" title="Sai da fila, mas continua atribuído à equipa">Tirar da fila</button><button class="btn sm tira-b" data-fqrem="${a.id}" title="Deixa de ser desta equipa e sai da fila">× Tirar da equipa</button></span>
    </div>`;
  }).join("");
  const eq = eqs.find((e) => e.nome === nome);
  const pot = Object.values(S.acts).filter((a) => !naFila.has(a.id) && a.equipa !== nome && podeFazer(eq, a) && S.res.get(a.id).estado !== "concluida" && (!ep.potFr || a.unidade === ep.potFr))
    .sort((x, y) => (!x.equipa || !S.equipas.includes(x.equipa) ? 0 : 1) - (!y.equipa || !S.equipas.includes(y.equipa) ? 0 : 1) || (S.res.get(x.id).inicio || "").localeCompare(S.res.get(y.id).inicio || ""));
  const potFrs = [...new Set(Object.values(S.acts).filter((a) => !naFila.has(a.id) && a.equipa !== nome && podeFazer(eq, a) && S.res.get(a.id).estado !== "concluida").map((a) => a.unidade))].sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  const frs = S.unidades.filter((u) => u.acts.some((a) => !naFila.has(a.id) && S.res.get(a.id).estado !== "concluida"));
  const ativsFr = ep.fr ? (S.uMap[ep.fr] ? S.uMap[ep.fr].acts : []).filter((a) => !naFila.has(a.id) && S.res.get(a.id).estado !== "concluida") : [];
  const html = `
    ${defTabs("planequipa")}
    <div class="card-h"><h1>Plano das equipas</h1>
      <label class="f" ${ep.vista === "todas" ? "hidden" : ""}>Equipa<select class="inp" id="fqEq">${eqs.map((e) => `<option ${e.nome === nome ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select></label></div>
    <p style="max-width:75ch">Ponha os trabalhos da equipa pela ordem em que os vai fazer: por exemplo, primeiro os azulejos do A-F101, depois os do A-F102. Cada trabalho só começa quando a equipa acaba o anterior, e as datas de tudo o que vem a seguir acertam-se sozinhas. Quando atribui uma equipa a um trabalho, ele entra logo na fila dela, pela data em que pode começar.</p>
    ${(() => { const n = Object.values(S.acts).filter((a) => a.equipa && S.equipas.includes(a.equipa) && (a.eqOrdem == null || a.eqOrdem === "") && S.res.get(a.id).estado !== "concluida").length; return n ? `<div class="banner warn no-print"><span><b>${n} trabalhos com equipa ainda não estão em fila nenhuma.</b> Enquanto não estiverem, a app não sabe que a equipa não pode fazê-los ao mesmo tempo.</span><button class="btn sm pri" id="fqTodasEq">Pôr nas filas</button></div>` : ""; })()}
    <div class="seg-v no-print">${[["lista", "Fila"], ["gantt", "Gantt da equipa"], ["todas", "Gantt de todas as equipas"]].map(([k, l]) => `<button class="${(ep.vista || "lista") === k ? "on" : ""}" data-fqv="${k}">${l}</button>`).join("")}</div>
    ${ep.vista === "todas" ? ganttEquipasHTML(null) : `
    <div class="fq-res">
      <div><span class="eyebrow">Na fila</span><b class="num">${fila.length - nConc}</b><span class="note">por fazer${nConc ? ` · ${nConc} feitos` : ""}</span></div>
      <div><span class="eyebrow">Começa</span><b class="num">${iniEq ? fd(iniEq, true) : "sem trabalhos"}</b></div>
      <div><span class="eyebrow">Acaba a fila</span><b class="num">${fimEq ? fd(fimEq, true) : "sem trabalhos"}</b></div>
      <div><span class="eyebrow">Dias parada</span><b class="num ${parada ? "mau-t" : ""}">${parada}</b><span class="note">à espera de outros trabalhos</span></div>
    </div>
    ${ep.vista === "gantt" ? ganttEquipasHTML(nome) : `<section class="card">
      <div class="card-h"><h2>Fila da ${esc(nome)}</h2><div class="row">${nConc ? `<label class="check"><input type="checkbox" id="fqConc" ${ep.conc ? "checked" : ""}><span>Mostrar os já feitos</span></label>` : ""}</div></div>
      ${vis.length ? `<p class="note" style="margin:0">Arraste as linhas ou use as setas para mudar a ordem.</p><div class="fq">${linhas}</div>` : `<div class="empty">A fila está vazia. Junte trabalhos em baixo.</div>`}
    </section>`}
    <section class="card">
      <div class="card-h"><h2>Trabalhos da equipa ainda sem lugar na fila</h2>${porOrdenar.length > 1 ? `<button class="btn sm pri" id="fqTodas">Pôr todos na fila</button>` : ""}</div>
      ${porOrdenar.length ? `<p class="note" style="margin:0">Enquanto aqui estiverem, a app não conta com a disponibilidade da equipa para eles: as datas são as de cada trabalho, como se a equipa os pudesse fazer todos ao mesmo tempo. Ponha-os na fila para isso deixar de acontecer.</p><div class="fq">${porOrdenar.map((a) => { const r = S.res.get(a.id); return `<div class="fq-row fq-po"><span></span><span></span><div class="fq-t"><button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button><span class="mono">${esc(a.unidade)}</span></div><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span><span></span><span class="fq-d mono num">${fd(r.provIni)} a ${fd(r.provFim)}</span><span></span><span class="fq-ac"><button class="btn sm" data-fqadd="${a.id}">+ Pôr na fila</button><button class="btn sm tira-b" data-fqrem="${a.id}" title="Deixa de ser desta equipa">× Tirar da equipa</button></span></div>`; }).join("")}</div>`
        : `<div class="note">Todos os trabalhos atribuídos a esta equipa já estão na fila.</div>`}
    </section>
    <section class="card">
      <div class="card-h"><h2>Trabalhos que a equipa pode fazer</h2>${eq && eq.esp && eq.esp.length && potFrs.length ? `<label class="f">Apartamento<select class="inp" id="fqPotFr"><option value="">Todos</option>${potFrs.map((u) => `<option ${ep.potFr === u ? "selected" : ""}>${esc(u)}</option>`).join("")}</select></label>` : ""}</div>
      ${!eq || !eq.esp || !eq.esp.length ? `<div class="note">Diga na ficha da equipa que especialidades ela faz e a aplicação mostra aqui os trabalhos possíveis. <button class="btn sm" data-eqed2="${esc(nome)}">Abrir a ficha da equipa</button></div>`
        : pot.length ? `<p class="note" style="margin:0">Pelas especialidades${eq.blocos && eq.blocos.length ? " e zonas" : ""} da equipa. Primeiro os que não têm equipa.</p><div class="fq">${pot.slice(0, 40).map((a) => { const r = S.res.get(a.id); const outra = a.equipa && S.equipas.includes(a.equipa); return `<div class="fq-row fq-po"><span></span><span></span><div class="fq-t"><button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button><span class="mono">${esc(a.unidade)}${outra ? ` · com ${esc(a.equipa)}` : a.equipa ? ` · era de ${esc(a.equipa)}, que saiu` : " · sem equipa"}</span></div><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span><span></span><span class="fq-d mono num">${fd(r.provIni)} a ${fd(r.provFim)}</span><span></span><button class="btn sm" data-fqpot="${a.id}">+ Pôr na fila</button></div>`; }).join("")}</div>${pot.length > 40 ? `<p class="note">E mais ${pot.length - 40}. Escolha um apartamento para ver menos.</p>` : ""}`
        : `<div class="note">Não há mais trabalhos por fazer que esta equipa possa fazer.</div>`}
    </section>
    <section class="card">
      <div class="card-h"><h2>Juntar outro trabalho à fila</h2></div>
      <p class="note" style="margin:0">Escolha o apartamento e o trabalho. Se for de outra equipa, passa para a ${esc(nome)}.</p>
      <div class="row" style="align-items:flex-end;flex-wrap:wrap">
        <label class="f">Apartamento ou zona<select class="inp" id="fqFr"><option value="">Escolha...</option>${frs.map((u) => `<option value="${esc(u.id)}" ${ep.fr === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" ? u.id : u.nome || u.id)}</option>`).join("")}</select></label>
        <label class="f">Trabalho<select class="inp" id="fqAt" ${ep.fr ? "" : "disabled"}><option value="">Escolha...</option>${ativsFr.map((a) => `<option value="${a.id}">${esc(nomeAtiv(a))}${a.equipa ? " (" + esc(a.equipa) + ")" : ""}</option>`).join("")}</select></label>
        <button class="btn pri" id="fqJunta" disabled>Juntar à fila</button>
      </div>
    </section>`}`;
  return { html, bind: () => {
    bindCommon();
    $("#fqEq").onchange = (e) => { ui.eqPlan = e.target.value; ep.fr = ""; render(); };
    const fte = $("#fqTodasEq"); if (fte) fte.onclick = filasTodas;
    document.querySelectorAll("[data-fqv]").forEach((b) => (b.onclick = () => { ep.vista = b.dataset.fqv; render(); }));
    document.querySelectorAll("[data-gez]").forEach((b) => (b.onclick = () => { ep.zoom = b.dataset.gez; render(); }));
    document.querySelectorAll("[data-geq]").forEach((b) => (b.onclick = () => { ui.eqPlan = b.dataset.geq; ep.vista = "gantt"; render(); }));
    const gs = $(".ge-scroll"); if (gs && !gs.dataset.posto) { const h = gs.querySelector(".ge-hoje"); if (h) gs.scrollLeft = Math.max(0, h.offsetLeft - 160); gs.dataset.posto = 1; }
    if (ep.vista === "todas") return;
    const fc = $("#fqConc"); if (fc) fc.onchange = () => { ep.conc = fc.checked; render(); };
    const ids = fila.map((a) => a.id);
    const mover = (id, para) => { const l = ids.filter((x) => x !== id); l.splice(Math.max(0, Math.min(l.length, para)), 0, id); return l; };
    document.querySelectorAll("[data-fqm]").forEach((b) => (b.onclick = () => {
      const [id, d] = b.dataset.fqm.split("|"); const i = ids.indexOf(id);
      gravarFila(nome, mover(id, i + Number(d)), `${nomeAtiv(S.acts[id])} em ${S.acts[id].unidade} passou para ${i + Number(d) + 1}.º`);
    }));
    // arrastar
    let arr = null;
    document.querySelectorAll(".fq-row[data-fq]").forEach((row) => {
      row.ondragstart = (e) => { arr = row.dataset.fq; row.classList.add("arr"); e.dataTransfer.effectAllowed = "move"; };
      row.ondragend = () => { row.classList.remove("arr"); document.querySelectorAll(".fq-row.alvo").forEach((x) => x.classList.remove("alvo")); };
      row.ondragover = (e) => { if (!arr) return; e.preventDefault(); document.querySelectorAll(".fq-row.alvo").forEach((x) => x.classList.remove("alvo")); row.classList.add("alvo"); };
      row.ondrop = (e) => { e.preventDefault(); const alvo = row.dataset.fq; if (!arr || arr === alvo) return; const id = arr; arr = null;
        const l = ids.filter((x) => x !== id); l.splice(l.indexOf(alvo) + (ids.indexOf(id) < ids.indexOf(alvo) ? 1 : 0), 0, id);
        gravarFila(nome, l, `${nomeAtiv(S.acts[id])} em ${S.acts[id].unidade} passou para ${l.indexOf(id) + 1}.º`); };
    });
    document.querySelectorAll("[data-fqx]").forEach((b) => (b.onclick = async () => {
      const a = S.acts[b.dataset.fqx];
      if (!(await confirmar("Tirar da fila?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} sai da fila da ${esc(nome)}. Continua atribuído à equipa, mas a app deixa de contar com a disponibilidade dela para este trabalho: deixa de esperar pelo anterior da fila, e o seguinte deixa de esperar por ele.</p>`, "Sim, tirar da fila"))) return;
      gravarFila(nome, ids.filter((x) => x !== a.id), `${nomeAtiv(a)} em ${a.unidade} saiu da fila`);
    }));
    document.querySelectorAll("[data-fqrem]").forEach((b) => (b.onclick = async () => {
      const a = S.acts[b.dataset.fqrem];
      if (!(await confirmar("Tirar da equipa?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} deixa de ser da ${esc(nome)}${ids.includes(a.id) ? " e sai da fila dela. O trabalho seguinte da fila deixa de esperar por este" : ""}.</p><p class="note">Fica sem equipa. Pode atribuí-lo a outra equipa depois, aqui no plano dela ou em Trabalhos.</p>`, "Sim, tirar da equipa"))) return;
      gravarFila(nome, ids.filter((x) => x !== a.id), `${nomeAtiv(a)} em ${a.unidade} deixou de ser da ${nome}`, {}, [a.id]);
    }));
    document.querySelectorAll("[data-fqadd]").forEach((b) => (b.onclick = () => { const a = S.acts[b.dataset.fqadd]; gravarFila(nome, ordemComNovos(nome, [a.id], ids), `${nomeAtiv(a)} em ${a.unidade} entrou na fila`); }));
    const ft = $("#fqTodas"); if (ft) ft.onclick = async () => {
      if (!(await confirmar(`Pôr ${porOrdenar.length} trabalhos na fila?`, `<p>Entram na fila da ${esc(nome)}, cada um na posição da data em que pode começar. Depois pode mudar a ordem.</p>`, "Sim, pôr na fila"))) return;
      gravarFila(nome, ordemComNovos(nome, porOrdenar.map((a) => a.id), ids), `${porOrdenar.length} trabalhos entraram na fila`);
    };
    const pf = $("#fqPotFr"); if (pf) pf.onchange = () => { ep.potFr = pf.value; render(); };
    document.querySelectorAll("[data-eqed2]").forEach((b) => (b.onclick = () => openEquipa(b.dataset.eqed2)));
    document.querySelectorAll("[data-fqpot]").forEach((b) => (b.onclick = async () => {
      const a = S.acts[b.dataset.fqpot];
      if (a.equipa && S.equipas.includes(a.equipa) && !(await confirmar("Mudar de equipa?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} está com a ${esc(a.equipa)}. Passa para a ${esc(nome)} e entra na fila dela, pela data em que pode começar.</p>`, "Sim, passar"))) return;
      gravarFila(nome, ordemComNovos(nome, [a.id], ids), `${nomeAtiv(a)} em ${a.unidade} entrou na fila`);
    }));
    const sf = $("#fqFr"), sa = $("#fqAt"), bj = $("#fqJunta");
    sf.onchange = () => { ep.fr = sf.value; render(); };
    sa.onchange = () => { bj.disabled = !sa.value; };
    bj.onclick = async () => {
      const a = S.acts[sa.value]; if (!a) return;
      if (a.equipa && a.equipa !== nome && !(await confirmar("Mudar de equipa?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} está com a ${esc(a.equipa)}. Passa para a ${esc(nome)} e entra na fila dela, pela data em que pode começar.</p>`, "Sim, passar"))) return;
      ep.fr = "";
      gravarFila(nome, ordemComNovos(nome, [a.id], ids), `${nomeAtiv(a)} em ${a.unidade} entrou na fila`);
    };
  } };
}
/** Gantt das equipas. nome = uma equipa (uma linha por trabalho, pela ordem da fila); null = todas (uma linha por equipa). */
function ganttEquipasHTML(nome) {
  const ep = ui.eqP;
  const pxd = { semana: 14, mes: 5, trimestre: 2 }[ep.zoom || "mes"];
  const eqs = S.eqLista.filter((e) => e.ativa !== false);
  const deEq = (n) => {
    const f = filaEquipa(n);
    const naFila = new Set(f.map((a) => a.id));
    const resto = Object.values(S.acts).filter((a) => a.equipa === n && !naFila.has(a.id)).sort((x, y) => (S.res.get(x.id).provIni || "").localeCompare(S.res.get(y.id).provIni || ""));
    return [...f.map((a) => ({ a, fila: true })), ...resto.map((a) => ({ a, fila: false }))].filter((x) => S.res.get(x.a.id).estado !== "concluida" || (S.res.get(x.a.id).provFim || "") >= addDays(S.hoje, -30));
  };
  const grupos = nome ? [{ n: nome, itens: deEq(nome) }] : eqs.map((e) => ({ n: e.nome, itens: deEq(e.nome) })).filter((g) => g.itens.length);
  const todos = grupos.flatMap((g) => g.itens);
  if (!todos.length) return `<section class="card"><div class="empty">${nome ? "Esta equipa não tem trabalhos por fazer." : "As equipas não têm trabalhos por fazer."}</div></section>`;
  let t0 = addDays(S.hoje, -21), t1 = addDays(S.hoje, 30);
  for (const { a } of todos) { const r = S.res.get(a.id); if (r.provIni && r.provIni < t0 && r.estado !== "concluida") t0 = r.provIni; if (r.provFim > t1) t1 = r.provFim; }
  if (diffDays(addDays(S.hoje, -120), t0) < 0) t0 = addDays(S.hoje, -120); // não recuar demasiado
  t0 = addDays(t0, -3); t1 = addDays(t1, 7);
  const dias = diffDays(t0, t1) + 1, W = dias * pxd;
  const x = (d) => diffDays(t0, d) * pxd;
  // eixo: meses (e semanas se houver espaço)
  const marcas = [];
  for (let d = t0.slice(0, 8) + "01"; d <= t1; ) { if (d >= t0) marcas.push({ d, l: `${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`, m: true }); const [y, m] = d.split("-").map(Number); d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; }
  if (pxd >= 10) for (let d = t0; d <= t1; d = addDays(d, 1)) if (new Date(d + "T12:00:00Z").getUTCDay() === 1) marcas.push({ d, l: String(Number(d.slice(8))), m: false });
  const barra = ({ a, fila }, comNome) => {
    const r = S.res.get(a.id);
    const l = x(r.provIni), w = Math.max(pxd, x(addDays(r.provFim, 1)) - l);
    const txt = comNome ? `${a.unidade} ${nomeAtiv(a)}` : a.unidade;
    return `<button class="ge-b st-${r.estado}${r.atrasada ? " atr" : ""}${fila ? "" : " solto"}${r.ciclo ? " ciclo" : ""}" style="left:${l}px;width:${w}px" data-a="${a.id}" title="${esc(`${nomeAtiv(a)} em ${a.unidade} · ${fd(r.provIni)} a ${fd(r.provFim)} · ${ESTADO[r.estado]}${r.atrasada ? " · atrasada " + r.atraso + " d" : ""}${fila ? "" : " · ainda sem lugar na fila"}`)}"><span>${esc(w > 46 ? txt : "")}</span></button>`;
  };
  // todas: cada equipa numa faixa; trabalhos sobrepostos vão para sub-linhas
  const linhas = [];
  if (nome) {
    for (const it of grupos[0].itens) linhas.push({ rot: `<b>${esc(nomeAtiv(it.a))}</b><span class="mono">${esc(it.a.unidade)}${it.fila ? "" : " · sem lugar na fila"}</span>`, bars: [barra(it, false)], fila: it.fila });
  } else {
    for (const g of grupos) {
      const subs = [];
      for (const it of g.itens) {
        const r = S.res.get(it.a.id);
        let k = subs.findIndex((fim) => fim < r.provIni);
        if (k < 0) { subs.push(""); k = subs.length - 1; }
        subs[k] = r.provFim;
        (g.sub = g.sub || [])[k] = (g.sub[k] || []).concat(barra(it, false));
      }
      const parada = (() => { let p = 0, ant = null; for (const it of g.itens.filter((z) => z.fila && S.res.get(z.a.id).estado !== "concluida")) { const r = S.res.get(it.a.id); if (ant) p += Math.max(0, diffDays(ant, r.provIni) - 1); ant = r.provFim; } return p; })();
      const fimG = g.itens.reduce((m, it) => (S.res.get(it.a.id).provFim > m ? S.res.get(it.a.id).provFim : m), "");
      g.sub.forEach((bs, k) => linhas.push({ rot: k === 0 ? `<button class="lnk-b" data-geq="${esc(g.n)}"><b>${esc(g.n)}</b></button><span class="note">${g.itens.length} trabalhos · acaba ${fd(fimG)}${parada ? ` · <span class="mau-t">${parada} d parada</span>` : ""}</span>` : "", bars: bs, cont: k > 0 }));
    }
  }
  return `<section class="card ge">
    <div class="card-h"><h2>${nome ? `Gantt da ${esc(nome)}` : "Todas as equipas"}</h2>
      <div class="seg-v sm">${[["semana", "Semanas"], ["mes", "Meses"], ["trimestre", "Trimestres"]].map(([k, l]) => `<button class="${(ep.zoom || "mes") === k ? "on" : ""}" data-gez="${k}">${l}</button>`).join("")}</div></div>
    <p class="note" style="margin:0">${nome ? "Um trabalho por linha, pela ordem da fila. Os que ainda não têm lugar na fila aparecem no fim, tracejados." : "Uma faixa por equipa. Os espaços entre barras são dias em que a equipa está parada; barras umas por cima das outras são trabalhos ao mesmo tempo. Toque no nome da equipa para ver só essa."} Toque numa barra para abrir o trabalho.</p>
    <div class="ge-wrap">
      <div class="ge-rot">${`<div class="ge-ax"></div>`}${linhas.map((l) => `<div class="ge-l ${l.cont ? "cont" : ""} ${l.fila === false ? "solto" : ""}">${l.rot}</div>`).join("")}</div>
      <div class="ge-scroll"><div class="ge-in" style="width:${W}px">
        <div class="ge-ax">${marcas.map((m) => `<i class="${m.m ? "m" : "s"}" style="left:${x(m.d)}px"><em>${m.l}</em></i>`).join("")}</div>
        ${marcas.filter((m) => m.m).map((m) => `<i class="ge-grid" style="left:${x(m.d)}px"></i>`).join("")}
        <i class="ge-hoje" style="left:${x(S.hoje)}px"></i>
        ${linhas.map((l) => `<div class="ge-l ${l.cont ? "cont" : ""}">${l.bars.join("")}</div>`).join("")}
      </div></div>
    </div>
    <div class="legend"><span><i class="dot st-em_curso"></i>Em curso</span><span><i class="dot st-por_iniciar"></i>Por iniciar</span><span><i class="dot st-bloqueada"></i>À espera de outras</span><span><i class="dot st-concluida"></i>Concluída</span><span><i class="dot st-por_iniciar atr"></i>Atrasada</span><span><i class="ge-lg-hoje"></i>Hoje</span></div>
  </section>`;
}
/** Criar ou editar uma equipa. nome = null para nova. opts.aoGravar(nome) corre depois de gravar. */
function openEquipa(nome, opts = {}) {
  document.querySelectorAll('[data-dw="equipa"]').forEach((e) => e.remove());
  const orig = nome ? S.eqLista.find((e) => e.nome === nome) : null;
  const e0 = orig ? { ...orig, esp: [...(orig.esp || [])], blocos: [...(orig.blocos || [])] } : { nome: "", responsavel: "", telefone: "", esp: [], blocos: [], notas: "" };
  const zonas = ["A", "B", "C", "D", "Lojas", "Geral"].filter((k) => S.unidades.some((u) => (u.tipo === "Loja" ? "Lojas" : u.bloco) === k));
  const nTrab = orig ? statsEquipa(orig.nome).total : 0;
  const esp = [...S.cfg.especialidades].sort((a, b) => a.ordem - b.ordem);
  const html = `
  <div class="scrim" data-dw="equipa"></div>
  <aside class="sheet" data-dw="equipa" role="dialog" aria-label="${orig ? "Editar equipa" : "Nova equipa"}">
    <div class="sheet-h"><div style="display:flex;flex-direction:column;gap:4px"><div class="eyebrow">Equipas de trabalho</div><h2>${orig ? esc(orig.nome) : "Nova equipa"}</h2></div><button class="x" aria-label="Fechar">×</button></div>
    <form class="sheet-b" id="eqf">
      <div class="formbox">
        <label class="f">Nome<input class="inp" id="eqN" required value="${esc(e0.nome)}" placeholder="Ex.: Equipa 4 - Mosaicos"></label>
        ${orig && nTrab ? `<p class="note" style="margin:0">Se mudar o nome, os ${nTrab} trabalhos desta equipa passam a ter o nome novo.</p>` : ""}
        <div class="grid2" style="gap:10px">
          <label class="f">Responsável<input class="inp" id="eqR" value="${esc(e0.responsavel || "")}" placeholder="Nome do encarregado"></label>
          <label class="f">Telefone<input class="inp" id="eqT" type="tel" value="${esc(e0.telefone || "")}"></label>
        </div>
      </div>
      <div class="formbox">
        <h3>O que esta equipa pode fazer <span class="note">(ajuda a planear)</span></h3>
        <p class="note" style="margin:0">Especialidades</p>
        <div class="chips" id="eqEsp">${esp.map((x) => `<button type="button" class="chip ${e0.esp.includes(x.key) ? "on" : ""}" data-eqe="${x.key}">${esc(x.nome)}</button>`).join("")}</div>
        <p class="note" style="margin:0">Onde trabalha <span class="muted">(nenhum escolhido: em toda a obra)</span></p>
        <div class="chips" id="eqZon">${zonas.map((k) => `<button type="button" class="chip ${e0.blocos.includes(k) ? "on" : ""}" data-eqz="${k}">${k.length === 1 ? "Bloco " + k : k}</button>`).join("")}</div>
        <div class="note" id="eqPot"></div>
        <label class="check" id="eqAutoW" hidden><input type="checkbox" id="eqAuto"><span id="eqAutoT"></span></label>
      </div>
      <label class="f">Notas<textarea class="inp" id="eqNo" rows="2" placeholder="Ex.: trabalha só no bloco C, de manhã">${esc(e0.notas || "")}</textarea></label>
      <div class="err" id="eqErr"></div>
      <div class="row"><button class="btn pri" type="submit">${orig ? "Guardar" : "Criar equipa"}</button><button class="btn" type="button" id="eqCancel">Cancelar</button></div>
      ${orig && orig.ativa !== false ? `<details class="formbox saibox" id="eqSai"><summary><b>A equipa sai da obra</b></summary>
        <p class="note">Desistência, fim de contrato ou troca de empreiteiro. A equipa deixa de aparecer para atribuir trabalho, mas fica no histórico com os trabalhos que já fez.</p>
        ${statsEquipa(orig.nome).fazer ? `<p style="margin:6px 0">Tem <b>${statsEquipa(orig.nome).fazer}</b> trabalhos por fazer${statsEquipa(orig.nome).curso ? `, ${statsEquipa(orig.nome).curso} já em curso` : ""}. O que lhes acontece?</p>
        <label class="check"><input type="radio" name="saiDest" value="dist" checked><span><b>Distribuir pelas equipas que fazem o mesmo</b><br><small class="note">Cada trabalho vai para a equipa com as mesmas especialidades que fica livre mais cedo. Os que nenhuma equipa faz ficam sem equipa.</small></span></label>
        ${S.equipas.filter((n) => n !== orig.nome).length ? `<label class="check"><input type="radio" name="saiDest" value="outra"><span><b>Passar todos para uma equipa</b></span></label>
        <select class="inp" id="saiSel" style="margin-left:24px;width:calc(100% - 24px)">${S.equipas.filter((n) => n !== orig.nome).map((n) => `<option>${esc(n)}</option>`).join("")}</select>` : ""}
        <label class="check"><input type="radio" name="saiDest" value="sem"><span><b>Ficam sem equipa</b>, para atribuir depois</span></label>
        ${statsEquipa(orig.nome).curso ? `<label class="check"><input type="checkbox" id="saiCurso"><span>Os que já estão em curso ficam com esta equipa até acabarem</span></label>` : ""}
        <p class="note">Os trabalhos que passam para outra equipa entram no fim da fila dela, pela data de início. As datas dos trabalhos seguintes acertam-se sozinhas.</p>
        <button class="btn" type="button" id="saiVer">Ver o efeito nas datas</button>
        <div id="saiRes"></div>` : `<p class="note">Não tem trabalhos por fazer.</p><button class="btn warn" type="button" id="saiOk">Confirmar a saída de ${esc(orig.nome)}</button>`}
        </details>` : ""}
      ${orig && orig.ativa === false ? `<div class="formbox"><p style="margin:0">Esta equipa saiu da obra${orig.saiuEm ? " a " + fd(orig.saiuEm, true) : ""}.</p><button class="btn" type="button" id="eqReat">Voltar a pôr a equipa na obra</button></div>` : ""}
      ${orig ? `<details class="formbox delbox" id="eqDel"><summary><b>Eliminar equipa de vez</b></summary>
        ${nTrab ? `<p class="note">Esta equipa tem ${nTrab} trabalhos. O que lhes acontece?</p>
        <label class="check"><input type="radio" name="eqDest" value="" checked><span>Ficam sem equipa</span></label>
        ${S.equipas.filter((n) => n !== orig.nome).length ? `<label class="check"><input type="radio" name="eqDest" value="_outra"><span>Passam para</span></label>
        <select class="inp" id="eqDestSel" style="margin-left:24px;width:calc(100% - 24px)">${S.equipas.filter((n) => n !== orig.nome).map((n) => `<option>${esc(n)}</option>`).join("")}</select>` : ""}` : `<p class="note">Não tem trabalhos atribuídos.</p>`}
        <button class="btn warn" type="button" id="eqDelOk">Eliminar ${esc(orig.nome)}</button></details>` : ""}
    </form>
  </aside>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const sh = document.querySelector('aside[data-dw="equipa"]');
  const q = (x) => sh.querySelector(x);
  const fechar = () => document.querySelectorAll('[data-dw="equipa"]').forEach((e) => e.remove());
  q(".x").onclick = fechar; q("#eqCancel").onclick = fechar;
  document.querySelector('.scrim[data-dw="equipa"]').onclick = fechar;
  const potenciais = () => Object.values(S.acts).filter((a) => podeFazer(e0, a) && S.res.get(a.id).estado !== "concluida");
  const semEqDe = () => potenciais().filter((a) => !a.equipa || !S.equipas.includes(a.equipa));
  const auto = () => {
    const pot = e0.esp.length ? potenciais() : [];
    const n = e0.esp.length ? semEqDe().length : 0;
    q("#eqPot").innerHTML = e0.esp.length ? `Pode fazer <b>${pot.length}</b> trabalhos por fazer${pot.length ? `: <b>${n}</b> sem equipa e ${pot.length - n} com outras equipas` : ""}.` : "";
    q("#eqAutoW").hidden = !n;
    q("#eqAutoT").textContent = `Atribuir já esta equipa aos ${n} trabalhos sem equipa e pô-los na fila dela, pela data de início`;
  };
  sh.querySelectorAll("[data-eqe]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.eqe;
    e0.esp = e0.esp.includes(k) ? e0.esp.filter((x) => x !== k) : [...e0.esp, k];
    b.classList.toggle("on"); auto();
  }));
  sh.querySelectorAll("[data-eqz]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.eqz;
    e0.blocos = e0.blocos.includes(k) ? e0.blocos.filter((x) => x !== k) : [...e0.blocos, k];
    b.classList.toggle("on"); auto();
  }));
  auto();
  setTimeout(() => q("#eqN").focus(), 50);
  const registadas = () => (S.cfg.equipas || []).filter((e) => e && e.nome);
  q("#eqf").onsubmit = async (ev) => {
    ev.preventDefault();
    const novo = q("#eqN").value.trim().replace(/\s+/g, " ");
    if (!novo) return;
    if (S.equipasTodas.some((n) => n.toLowerCase() === novo.toLowerCase() && (!orig || n !== orig.nome))) { q("#eqErr").textContent = "Já existe uma equipa com esse nome."; return; }
    const dados = { id: (orig && orig.id) || "eq" + Date.now().toString(36), nome: novo, responsavel: q("#eqR").value.trim() || null, telefone: q("#eqT").value.trim() || null, esp: e0.esp, blocos: e0.blocos, notas: q("#eqNo").value.trim() || null, ...(orig && orig.ativa === false ? { ativa: false, saiuEm: orig.saiuEm || null } : {}) };
    const reg = registadas();
    const i = orig ? reg.findIndex((e) => e.nome === orig.nome) : -1;
    const lista = i >= 0 ? reg.map((e, j) => (j === i ? dados : e)) : [...reg, dados];
    const paraAuto = q("#eqAuto").checked && !q("#eqAutoW").hidden ? semEqDe().map((a) => a.id) : [];
    fechar();
    await store.setConfig({ equipas: lista }, { tipo: "equipa", texto: orig ? (orig.nome !== novo ? `Equipa ${orig.nome} passou a chamar-se ${novo}` : `Editou a equipa ${novo}`) : `Criou a equipa ${novo}` });
    if (orig && orig.nome !== novo) {
      const ids = Object.values(S.acts).filter((a) => a.equipa === orig.nome).map((a) => ({ id: a.id, patch: { equipa: novo } }));
      if (ids.length) await store.updateMuitas(ids, null);
    }
    if (paraAuto.length) await atribuirEquipa(paraAuto, novo);
    toast(orig ? "Equipa guardada" : `«${novo}» criada${paraAuto.length ? ` e atribuída a ${paraAuto.length} trabalhos` : ""}`);
    if (opts.aoGravar) await opts.aoGravar(novo);
  };
  // ---- saída da equipa
  const planoSaida = () => {
    const dest = (sh.querySelector('input[name="saiDest"]:checked') || {}).value || "sem";
    const ficaCurso = !!(q("#saiCurso") && q("#saiCurso").checked);
    const mover = Object.values(S.acts).filter((a) => a.equipa === orig.nome && S.res.get(a.id).estado !== "concluida" && !(ficaCurso && S.res.get(a.id).estado === "em_curso"))
      .sort((x, y) => (S.res.get(x.id).provIni || "").localeCompare(S.res.get(y.id).provIni || ""));
    const lista = [];
    const ordem = {}; // proxima posição livre em cada fila
    const livre = {}; // dia em que cada equipa fica livre (estimativa para distribuir)
    const fila = (n) => { if (ordem[n] == null) { const f = filaEquipa(n); ordem[n] = (f.length ? Number(f[f.length - 1].eqOrdem) : 0) + 10; livre[n] = f.reduce((m, a) => (S.res.get(a.id).provFim > m ? S.res.get(a.id).provFim : m), S.hoje); } };
    const vai = {};
    for (const a of mover) {
      let n = null;
      if (dest === "outra") n = q("#saiSel").value;
      else if (dest === "dist") {
        const cand = S.eqLista.filter((e) => e.ativa !== false && e.nome !== orig.nome && podeFazer(e, a));
        for (const e of cand) fila(e.nome);
        cand.sort((x, y) => livre[x.nome].localeCompare(livre[y.nome]));
        n = cand.length ? cand[0].nome : null;
      }
      if (n) { fila(n); lista.push({ id: a.id, patch: { equipa: n, eqOrdem: ordem[n] } }); ordem[n] += 10; const r = S.res.get(a.id); livre[n] = addDays(livre[n] > r.provIni ? livre[n] : r.provIni, r.dur + 1); vai[n] = (vai[n] || 0) + 1; }
      else { lista.push({ id: a.id, patch: { equipa: null, eqOrdem: null } }); vai["_sem"] = (vai["_sem"] || 0) + 1; }
    }
    // as que ficam (em curso) saem da fila, para não prenderem ninguém depois de a equipa sair
    if (ficaCurso) for (const a of Object.values(S.acts)) if (a.equipa === orig.nome && S.res.get(a.id).estado === "em_curso" && temOrdem(a)) lista.push({ id: a.id, patch: { eqOrdem: false } });
    const pm = new Map(lista.map((l) => [l.id, l.patch]));
    const novo = Object.values(S.acts).map((a) => (pm.has(a.id) ? { ...a, ...pm.get(a.id) } : a));
    const novoMap = new Map(novo.map((a) => [a.id, a]));
    const r2 = schedule(novo, S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {});
    let mudam = 0, fimObra = "";
    for (const a of novo) { const x = S.res.get(a.id), y = r2.get(a.id); if (x && y && (x.provIni !== y.provIni || x.provFim !== y.provFim)) mudam++; if (y && y.estado !== "concluida" && y.provFim > fimObra) fimObra = y.provFim; }
    const fimEq = (n, res) => Object.values(S.acts).filter((a) => novoMap.get(a.id).equipa === n && res.get(a.id).estado !== "concluida").reduce((m, a) => (res.get(a.id).provFim > m ? res.get(a.id).provFim : m), "");
    const porEq = Object.entries(vai).filter(([n]) => n !== "_sem").map(([n, k]) => ({ n, k, antes: Object.values(S.acts).filter((a) => a.equipa === n && S.res.get(a.id).estado !== "concluida").reduce((m, a) => (S.res.get(a.id).provFim > m ? S.res.get(a.id).provFim : m), ""), depois: fimEq(n, r2) }));
    return { lista, mudam, fimObra, porEq, sem: vai["_sem"] || 0, n: mover.length, ficam: ficaCurso ? statsEquipa(orig.nome).curso : 0 };
  };
  const saiConfirmar = async (pl) => {
    const reg = registadas();
    const i = reg.findIndex((e) => e.nome === orig.nome);
    const dados = { ...(i >= 0 ? reg[i] : { id: "eq" + Date.now().toString(36), nome: orig.nome, esp: orig.esp || [] }), ativa: false, saiuEm: S.hoje };
    const lista = i >= 0 ? reg.map((e, j) => (j === i ? dados : e)) : [...reg, dados];
    fechar();
    await store.setConfig({ equipas: lista }, { tipo: "equipa", texto: `${orig.nome} saiu da obra${pl && pl.n ? `; ${pl.n} trabalhos por fazer ${pl.porEq.length ? "passaram para " + pl.porEq.map((x) => `${x.n} (${x.k})`).join(", ") : ""}${pl.sem ? `${pl.porEq.length ? " e " : ""}${pl.sem} ficaram sem equipa` : ""}` : ""}` });
    if (pl && pl.lista.length) await store.updateMuitas(pl.lista, null);
    toast(`${orig.nome} saiu da obra${pl && pl.mudam ? `. ${pl.mudam} atividades mudaram de datas` : ""}`);
  };
  const sv = q("#saiVer");
  if (sv) {
    const limpa = () => { q("#saiRes").innerHTML = ""; };
    sh.querySelectorAll('input[name="saiDest"], #saiSel, #saiCurso').forEach((x) => (x.onchange = limpa));
    sv.onclick = () => {
      const pl = planoSaida();
      q("#saiRes").innerHTML = `<div class="sai-res">
        <p style="margin:0"><b>${pl.n}</b> trabalhos mudam de equipa${pl.ficam ? `; ${pl.ficam} em curso ficam com ${esc(orig.nome)} até acabarem` : ""}.</p>
        ${pl.porEq.length ? `<ul class="dlg-l">${pl.porEq.map((x) => `<li><b>${esc(x.n)}</b> recebe ${x.k}: ${x.antes ? `acabava a ${fd(x.antes, true)}, ` : ""}passa a acabar a <b>${fd(x.depois, true)}</b></li>`).join("")}</ul>` : ""}
        ${pl.sem ? `<div class="dlg-av">${pl.sem} ${pl.sem === 1 ? "fica" : "ficam"} sem equipa. Atribua-os depois no Plano das equipas ou em Trabalhos.${(sh.querySelector('input[name="saiDest"]:checked') || {}).value === "dist" ? " Para a aplicação os poder distribuir, diga na ficha de cada equipa que especialidades ela faz." : ""}</div>` : ""}
        <p style="margin:0">${pl.mudam} atividades mudam de datas. A obra passa a acabar a <b>${fd(pl.fimObra, true)}</b>${S.tot.fim && pl.fimObra !== S.tot.fim ? ` (era ${fd(S.tot.fim, true)})` : " (não muda)"}.</p>
        <button class="btn warn" type="button" id="saiOk2">Confirmar a saída de ${esc(orig.nome)}</button></div>`;
      q("#saiOk2").onclick = async () => { if (await confirmar(`${esc(orig.nome)} sai da obra?`, `<p>Os trabalhos por fazer mudam como mostrado. Se se enganar, pode voltar a pôr a equipa na obra, mas os trabalhos não voltam sozinhos para ela.</p>`, "Sim, confirmar a saída")) saiConfirmar(pl); };
    };
  }
  const so = q("#saiOk"); if (so) so.onclick = async () => { if (await confirmar(`${esc(orig.nome)} sai da obra?`, "<p>Deixa de aparecer para atribuir trabalho. Fica no histórico.</p>", "Sim, confirmar a saída")) saiConfirmar(null); };
  const rt = q("#eqReat"); if (rt) rt.onclick = async () => {
    const lista = registadas().map((e) => (e.nome === orig.nome ? { ...e, ativa: true, saiuEm: null } : e));
    fechar();
    await store.setConfig({ equipas: lista }, { tipo: "equipa", texto: `${orig.nome} voltou à obra` });
    toast(`${orig.nome} voltou à obra`);
  };
  const del = q("#eqDelOk");
  if (del) del.onclick = async () => {
    if (!(await confirmar(`Eliminar a equipa ${esc(orig.nome)}?`, `<p>A equipa deixa de existir.${nTrab ? ` Os ${nTrab} trabalhos dela ${sh.querySelector('input[name="eqDest"]:checked') && sh.querySelector('input[name="eqDest"]:checked').value === "_outra" ? "passam para a equipa escolhida" : "ficam sem equipa"}.` : ""}</p>`, "Sim, eliminar"))) return;
    const r = sh.querySelector('input[name="eqDest"]:checked');
    const dest = r && r.value === "_outra" ? q("#eqDestSel").value : null;
    const ids = Object.values(S.acts).filter((a) => a.equipa === orig.nome).map((a) => ({ id: a.id, patch: { equipa: dest, eqOrdem: null } }));
    fechar();
    await store.setConfig({ equipas: registadas().filter((e) => e.nome !== orig.nome) }, { tipo: "equipa", texto: `Eliminou a equipa ${orig.nome}${ids.length ? (dest ? `; os ${ids.length} trabalhos passaram para ${dest}` : `; ${ids.length} trabalhos ficaram sem equipa`) : ""}` });
    if (ids.length) await store.updateMuitas(ids, null);
    toast(`«${orig.nome}» eliminada`);
  };
}

/* ============================================================ frações: criar e eliminar */
const ORD_B = { A: 0, B: 1, C: 2, D: 3, Geral: 9 };
const ordenaUnidades = (lista) => [...lista].sort((a, b) => (ORD_B[a.bloco] ?? 5) - (ORD_B[b.bloco] ?? 5) || (a.piso ?? 99) - (b.piso ?? 99) || a.id.localeCompare(b.id));
function proximoLote() {
  const lotes = Object.values(S.acts).map((a) => (/^N(\d+)$/.exec(a.lote || "") || [])[1]).filter(Boolean).map(Number);
  return "N" + ((lotes.length ? Math.max(...lotes) : 0) + 1);
}
function sugerirCodigo(tipo, bloco, piso) {
  const ids = new Set(S.unidades.map((u) => u.id));
  if (tipo === "Zona comum") { let c = `${bloco}-ZC`, i = 2; while (ids.has(c)) c = `${bloco}-ZC${i++}`; return c; }
  if (tipo === "Loja") { let n = 1; while (ids.has(`${bloco}-L${String(n).padStart(3, "0")}`)) n++; return `${bloco}-L${String(n).padStart(3, "0")}`; }
  const p = Math.max(0, Number(piso) || 0);
  const nums = S.unidades.filter((u) => u.id.startsWith(`${bloco}-F${p}`)).map((u) => Number(u.id.slice(-2))).filter((x) => !isNaN(x));
  let n = nums.length ? Math.max(...nums) + 1 : 1;
  while (ids.has(`${bloco}-F${p}${String(n).padStart(2, "0")}`)) n++;
  return `${bloco}-F${p}${String(n).padStart(2, "0")}`;
}
function openNovaFracao() {
  document.querySelectorAll('[data-dw="fracao"]').forEach((e) => e.remove());
  const esp = [...S.cfg.especialidades].sort((a, b) => a.ordem - b.ordem);
  const st = { tipo: "Apartamento", bloco: ui.bloco && ui.bloco !== "todos" ? ui.bloco : "A", piso: 1, codigoManual: false, ativ: "padrao" };
  const html = `
  <div class="scrim" data-dw="fracao"></div>
  <aside class="sheet" data-dw="fracao" role="dialog" aria-label="Nova fração">
    <div class="sheet-h"><div style="display:flex;flex-direction:column;gap:4px"><div class="eyebrow">Apartamentos</div><h2>Nova fração</h2></div><button class="x" aria-label="Fechar">×</button></div>
    <form class="sheet-b" id="ff">
      <div class="formbox">
        <h3>Fração</h3>
        <div class="grid2" style="gap:10px">
          <label class="f">Tipo<select class="inp" id="fTipo"><option>Apartamento</option><option>Loja</option><option>Zona comum</option></select></label>
          <label class="f">Bloco<select class="inp" id="fBloco">${["A", "B", "C", "D", "Geral"].map((b) => `<option value="${b}" ${b === st.bloco ? "selected" : ""}>${b === "Geral" ? "Geral" : "Bloco " + b}</option>`).join("")}</select></label>
          <label class="f" id="fPisoW">Piso<input class="inp num" type="number" min="0" max="40" id="fPiso" value="1"></label>
          <label class="f">Código<input class="inp mono" id="fCod" required pattern="[A-Za-z0-9-]+" title="Letras, números e hífen"></label>
        </div>
        <label class="f">Nome (opcional)<input class="inp" id="fNome" placeholder="Ex.: Apartamento modelo, Loja 3"></label>
        <label class="check"><input type="checkbox" id="fTeste"><span><b>Fração de teste</b>, só para experimentar: não conta para o painel, para o fim da obra nem para as estatísticas, e não mexe nas outras frações</span></label>
      </div>
      <div class="formbox">
        <h3>Atividades</h3>
        <label class="check"><input type="radio" name="fAt" value="padrao" checked><span>Criar com as especialidades padrão (a sequência e as durações do ecrã Sequência aplicam-se sozinhas)</span></label>
        <div id="fEspW" class="chips" style="padding-left:24px">${esp.map((e) => `<label class="chip on" style="cursor:pointer"><input type="checkbox" data-fe="${e.key}" checked hidden>${esc(e.nome)}</label>`).join("")}</div>
        <label class="check"><input type="radio" name="fAt" value="copiar"><span>Copiar as atividades de outra fração</span></label>
        <div id="fCopW" hidden style="padding-left:24px"><select class="inp" id="fCop">${S.unidades.map((u) => `<option value="${esc(u.id)}">${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)} (${u.acts.length} atividades)</option>`).join("")}</select></div>
        <label class="check"><input type="radio" name="fAt" value="nenhuma"><span>Sem atividades (acrescento depois)</span></label>
        <label class="f" id="fIniW">Início previsto (opcional)<input class="inp" type="date" id="fIni"></label>
      </div>
      <div class="banner" id="fRes" style="display:block"></div>
      <div class="err" id="fErr"></div>
      <div class="row"><button class="btn pri" type="submit">Criar fração</button><button class="btn" type="button" id="fCancel">Cancelar</button></div>
    </form>
  </aside>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const sh = document.querySelector('aside[data-dw="fracao"]');
  const q = (x) => sh.querySelector(x);
  const fechar = () => document.querySelectorAll('[data-dw="fracao"]').forEach((e) => e.remove());
  q(".x").onclick = fechar; q("#fCancel").onclick = fechar;
  document.querySelector('.scrim[data-dw="fracao"]').onclick = fechar;
  const nAtiv = () => st.ativ === "padrao" ? sh.querySelectorAll("[data-fe]:checked").length : st.ativ === "copiar" ? (S.uMap[q("#fCop").value] || { acts: [] }).acts.length : 0;
  const atualiza = () => {
    st.tipo = q("#fTipo").value; st.bloco = q("#fBloco").value; st.piso = q("#fPiso").value;
    q("#fPisoW").hidden = st.tipo === "Zona comum";
    st.teste = q("#fTeste").checked;
    if (!st.codigoManual) { if (st.teste) { let i = 1; while (S.uMap["TESTE-" + i]) i++; q("#fCod").value = "TESTE-" + i; } else q("#fCod").value = sugerirCodigo(st.tipo, st.bloco, st.piso); }
    q("#fEspW").hidden = st.ativ !== "padrao";
    q("#fCopW").hidden = st.ativ !== "copiar";
    q("#fIniW").hidden = st.ativ === "nenhuma";
    const n = nAtiv();
    q("#fRes").innerHTML = `${st.teste ? "<b>Teste:</b> " : ""}Vai criar <b class="mono">${esc(q("#fCod").value.trim().toUpperCase() || "?")}</b> (${esc(st.tipo.toLowerCase())}${st.bloco !== "Geral" ? ", bloco " + st.bloco : ""}${st.tipo !== "Zona comum" ? ", piso " + (Number(st.piso) || 0) : ""})${n ? ` com <b>${n} atividades</b>` : " sem atividades"}.`;
  };
  ["#fTipo", "#fBloco", "#fPiso", "#fCop", "#fTeste"].forEach((x) => (q(x).oninput = q(x).onchange = atualiza));
  q("#fCod").oninput = () => {
    st.codigoManual = true;
    const m = /^([A-D])-F(\d)\d\d$/i.exec(q("#fCod").value.trim());
    if (m) { q("#fBloco").value = m[1].toUpperCase(); q("#fPiso").value = m[2]; q("#fTipo").value = "Apartamento"; }
    const l = /^([A-D])-L\d+$/i.exec(q("#fCod").value.trim());
    if (l) { q("#fBloco").value = l[1].toUpperCase(); q("#fTipo").value = "Loja"; }
    atualiza();
  };
  sh.querySelectorAll('input[name="fAt"]').forEach((r) => (r.onchange = () => { st.ativ = r.value; atualiza(); }));
  sh.querySelectorAll("[data-fe]").forEach((c) => (c.onchange = () => { c.closest("label").classList.toggle("on", c.checked); atualiza(); }));
  atualiza();
  q("#ff").onsubmit = async (ev) => {
    ev.preventDefault();
    const err = q("#fErr"); err.textContent = "";
    const id = q("#fCod").value.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(id)) { err.textContent = "O código só pode ter letras, números e hífen."; return; }
    if (S.uMap[id]) { err.textContent = `Já existe a fração ${id}.`; return; }
    const piso = st.tipo === "Zona comum" ? 99 : Math.max(0, Number(st.piso) || 0);
    const nome = q("#fNome").value.trim() || (st.tipo === "Zona comum" ? `Zonas comuns ${st.bloco === "Geral" ? "gerais" : "Bloco " + st.bloco}` : id);
    const nova = { id, bloco: st.bloco, tipo: st.tipo, nome, piso, ...(st.teste ? { teste: true } : {}) };
    const ini = q("#fIni").value || null;
    const lote = proximoLote(), base = Date.now().toString(36);
    let lista = [];
    if (st.ativ === "padrao") {
      const keys = [...sh.querySelectorAll("[data-fe]:checked")].map((c) => c.dataset.fe);
      lista = keys.map((k, i) => {
        const dur = (S.cfg.duracoes || {})[k] ?? 5;
        const a = { id: `n${base}-${i}`, ref: `${lote}#${i + 1}`, lote, unidade: id, esp: k, seccao: S.espIdx[k].nome, duracao: dur, pctEmp: 0 };
        if (ini) { a.planInicio = ini; a.planFim = addDays(ini, dur); }
        return a;
      });
    } else if (st.ativ === "copiar") {
      const src = S.uMap[q("#fCop").value];
      const inis = src.acts.map((a) => a.planInicio).filter(Boolean).sort();
      const desloc = ini && inis.length ? diffDays(inis[0], ini) : 0;
      lista = src.acts.map((x, i) => {
        const a = { id: `n${base}-${i}`, ref: `${lote}#${i + 1}`, lote, unidade: id, seccao: x.seccao, duracao: x.duracao, pctEmp: 0 };
        if (x.esp) a.esp = x.esp;
        if (x.duracaoManual != null) a.duracaoManual = x.duracaoManual;
        if (x.equipa && !st.teste) a.equipa = x.equipa;
        if (ini && x.planInicio) { a.planInicio = addDays(x.planInicio, desloc); a.planFim = x.planFim ? addDays(x.planFim, desloc) : null; }
        else if (ini) { a.planInicio = ini; a.planFim = addDays(ini, x.duracao || 0); }
        return a;
      });
    }
    if (st.teste) lista.forEach((a) => (a.teste = true));
    const unidades = ordenaUnidades([...(S.cfg.unidades || []), nova]);
    const texto = `${st.teste ? "Fração de teste" : "Nova fração"} ${id} (${st.tipo.toLowerCase()}${st.bloco !== "Geral" ? ", bloco " + st.bloco : ""})${lista.length ? ` com ${lista.length} atividades` : ""}`;
    if (lista.length) await store.addAtividades(lista, { unidades }, { tipo: "fracao", texto });
    else await store.setConfig({ unidades }, { tipo: "fracao", texto });
    fechar();
    toast(`Fração ${id} criada`);
    location.hash = "#u-" + id;
  };
}
function delUnidadeHTML(u) {
  const d = ui.delUnit;
  if (!d || d.id !== u.id) return "";
  const nAt = u.acts.length, nConc = u.n.concluida;
  const ids = new Set(u.acts.map((a) => a.id));
  const fora = Object.values(S.acts).filter((a) => a.unidade !== u.id && (S.res.get(a.id)?.preds || []).some((p) => ids.has(p.id))).length;
  const codigo = u.id;
  const cancelar = `<button class="btn sm" data-delu="cancelar">Cancelar</button>`;
  if (d.passo === 1) return `<div class="delbox"><b>Eliminar a fração ${esc(codigo)}?</b>
    <p>Vai eliminar a fração e as suas <b>${nAt} atividades</b>${nConc ? `, das quais ${nConc} já concluídas` : ""}.${fora ? ` Há ${fora} atividade${fora > 1 ? "s" : ""} de outras frações ligada${fora > 1 ? "s" : ""} a esta, que deixa${fora > 1 ? "m" : ""} de esperar por ela.` : ""} As fotografias e o histórico ficam guardados.</p>
    <div class="row"><button class="btn sm warn" data-delu="2">Sim, quero eliminar</button>${cancelar}</div></div>`;
  if (d.passo === 2) return `<div class="delbox"><b>Tem mesmo a certeza?</b>
    <p>Esta ação não se pode desfazer. A fração ${esc(codigo)} e as ${nAt} atividades desaparecem dos trabalhos, do Gantt e do painel para todos os utilizadores.</p>
    <div class="row"><button class="btn sm warn" data-delu="3">Sim, tenho a certeza</button>${cancelar}</div></div>`;
  return `<div class="delbox"><b>Última confirmação</b>
    <p>Para eliminar, escreva o código da fração: <b class="mono">${esc(codigo)}</b></p>
    <div class="row"><input class="inp mono" id="delCod" autocomplete="off" style="max-width:180px" aria-label="Código da fração"><button class="btn sm delfinal" id="delSim" disabled>Eliminar definitivamente</button>${cancelar}</div></div>`;
}
function bindDelUnidade(u) {
  const b0 = $("#delU"); if (b0) b0.onclick = () => { ui.delUnit = { id: u.id, passo: u.teste ? 3 : 1 }; render(); };
  document.querySelectorAll("[data-delu]").forEach((b) => (b.onclick = () => {
    const v = b.dataset.delu;
    if (v === "cancelar") ui.delUnit = null; else ui.delUnit = { id: u.id, passo: Number(v) };
    render();
    const i = $("#delCod"); if (i) i.focus();
  }));
  const inp = $("#delCod"), sim = $("#delSim");
  if (inp) inp.oninput = () => (sim.disabled = inp.value.trim().toUpperCase() !== u.id.toUpperCase());
  if (sim) sim.onclick = async () => {
    if (inp.value.trim().toUpperCase() !== u.id.toUpperCase()) return;
    const ids = u.acts.map((a) => a.id);
    const unidades = (S.cfg.unidades || []).filter((x) => x.id !== u.id);
    ui.delUnit = null;
    const texto = `Eliminou a fração ${u.id} e ${ids.length} atividades`;
    if (ids.length) await store.removeAtividades(ids, { tipo: "fracao", texto });
    await store.setConfig({ unidades }, ids.length ? null : { tipo: "fracao", texto });
    location.hash = "#unidades";
    toast(`Fração ${u.id} eliminada`);
  };
}

/* ============================================================ nova atividade */
function slugKey(s) {
  return "x_" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
}
/** Atividades com nome próprio (fora das especialidades), para poder reutilizá-las noutras frações. */
function atividadesJaCriadas() {
  const m = new Map();
  for (const a of Object.values(S.acts)) {
    if (a.esp && S.espIdx[a.esp]) continue;
    const nome = nomeAtiv(a); if (!nome) continue;
    const x = m.get(nome) || { nome, n: 0, us: new Set(), dias: null, equipa: null };
    x.us.add(a.unidade); x.n = x.us.size;
    if (x.dias == null) { const r = S.res.get(a.id); x.dias = r ? r.dur : a.duracao; }
    if (!x.equipa && a.equipa) x.equipa = a.equipa;
    m.set(nome, x);
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}
function openNova(preset, opts = {}) {
  const p = preset || "";
  ui.nova = {
    esp: p === "esp" ? "__outra" : "",
    novaEsp: p === "esp",
    onde: p.startsWith("unit:") ? "escolher" : "apart",
    blocos: ["A", "B", "C", "D"],
    sel: new Set(p.startsWith("unit:") && p.slice(5) ? [p.slice(5)] : []),
    saltar: true,
    depois: [],
    especificas: opts.especificas ? opts.especificas.map((d) => ({ ...d })) : [],
    modelo: opts.modelo || null,
  };
  if (opts.modelo) { ui.nova.saltar = true; ui.nova.titulo = "Copiar atividade"; }
  renderNova();
}
function closeNova() { ui.nova = null; document.querySelectorAll('[data-dw="nova"]').forEach((e) => e.remove()); }
function novaAlvos() {
  const n = ui.nova;
  const us = S.unidades;
  if (n.onde === "apart") return us.filter((u) => u.tipo === "Apartamento" && n.blocos.includes(u.bloco));
  if (n.onde === "lojas") return us.filter((u) => u.tipo === "Loja" && /-L\d+$/.test(u.id));
  if (n.onde === "zonas") return us.filter((u) => u.tipo === "Zona comum" && n.blocos.includes(u.bloco));
  if (n.onde === "geral") return us.filter((u) => u.tipo === "Geral");
  return us.filter((u) => n.sel.has(u.id));
}
function renderNova() {
  document.querySelectorAll('[data-dw="nova"]').forEach((e) => e.remove());
  const n = ui.nova;
  const dono = store.user.papel === "dono" || store.user.papel === "empreiteiro"; // podem criar especialidades
  const esp = [...S.cfg.especialidades].sort((a, b) => a.ordem - b.ordem);
  const ONDE = [["apart", "Todos os apartamentos"], ["lojas", "Todas as lojas"], ["zonas", "Zonas comuns"], ["geral", "Geral"], ["escolher", "Escolher frações"]];
  const grupos = ["A", "B", "C", "D", "Geral"];
  const html = `
  <div class="scrim" data-dw="nova"></div>
  <aside class="sheet" data-dw="nova" role="dialog" aria-label="Nova atividade">
    <div class="sheet-h"><div style="display:flex;flex-direction:column;gap:4px"><div class="eyebrow">Trabalhos</div><h2>${n.titulo || "Nova atividade"}</h2></div><button class="x" aria-label="Fechar">×</button></div>
    <form class="sheet-b" id="nf">
      <div class="formbox">
        <h3>O que é</h3>
        <label class="f">Atividade<select class="inp" id="nEsp">
          <option value="">Escolha...</option>
          <option value="__outra" ${n.esp === "__outra" ? "selected" : ""}>Outra atividade (escrever o nome)</option>
          <optgroup label="Especialidades existentes">${esp.map((e) => `<option value="${e.key}" ${n.esp === e.key ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</optgroup>
          ${(() => { const ja = atividadesJaCriadas(); return ja.length ? `<optgroup label="Outras atividades já criadas">${ja.map((x) => `<option value="__ja:${esc(x.nome)}">${esc(x.nome)} (${x.n} ${x.n === 1 ? "fração" : "frações"})</option>`).join("")}</optgroup>` : ""; })()}
        </select></label>
        <div id="nOutra" ${n.esp === "__outra" ? "" : "hidden"} style="display:flex;flex-direction:column;gap:10px">
          <label class="f">Nome<input class="inp" id="nNome" placeholder="Ex.: Impermeabilização das varandas"></label>
          ${dono ? `<label class="check"><input type="checkbox" id="nNovaEsp" ${n.novaEsp ? "checked" : ""}><span>Guardar como nova especialidade (passa a aparecer na Sequência e no mapa dos apartamentos)</span></label>` : ""}
        </div>
      </div>

      <div class="formbox">
        <h3>Onde</h3>
        <div class="chips">${ONDE.map(([k, l]) => `<button type="button" class="chip ${n.onde === k ? "on" : ""}" data-onde="${k}">${l}</button>`).join("")}</div>
        <div id="nBlocos" ${n.onde === "apart" || n.onde === "zonas" ? "" : "hidden"} class="row">
          <span class="note">Blocos:</span>${["A", "B", "C", "D"].map((b) => `<label class="row" style="gap:5px"><input type="checkbox" data-nb="${b}" ${n.blocos.includes(b) ? "checked" : ""}> ${b}</label>`).join("")}
        </div>
        <div id="nEscolher" ${n.onde === "escolher" ? "" : "hidden"} style="display:flex;flex-direction:column;gap:10px;max-height:320px;overflow-y:auto">
          ${grupos.map((g) => {
            const us = S.unidades.filter((u) => u.bloco === g);
            if (!us.length) return "";
            return `<div style="display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between"><span class="grp">${g === "Geral" ? "Geral" : "Bloco " + g}</span><button type="button" class="btn sm ghost" data-nall="${g}">Todos do bloco</button></div>
              <div class="chips">${us.map((u) => `<label class="chip ${n.sel.has(u.id) ? "on" : ""}" style="cursor:pointer"><input type="checkbox" data-nu="${esc(u.id)}" ${n.sel.has(u.id) ? "checked" : ""} hidden>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</label>`).join("")}</div></div>`;
          }).join("")}
        </div>
        <label class="check" id="nSaltarW" ${n.esp && n.esp !== "__outra" ? "" : "hidden"}><input type="checkbox" id="nSaltar" ${n.saltar ? "checked" : ""}><span>Saltar as frações que já têm esta especialidade</span></label>
      </div>

      <div class="formbox">
        <h3>Quando</h3>
        <div class="grid2" style="gap:10px">
          <label class="f">Dias por fração<input class="inp num" type="number" min="0" max="365" id="nDur" value="${n.esp && S.cfg.duracoes && S.cfg.duracoes[n.esp] != null ? S.cfg.duracoes[n.esp] : 5}"></label>
          <label class="f">Início previsto (opcional)<input class="inp" type="date" id="nIni"></label>
        </div>
        <label class="check"><input type="checkbox" id="nCadeia"><span>Uma equipa faz uma fração de cada vez: cada fração só começa quando a anterior acabar</span></label>
        <label class="f">Equipa (opcional)<input class="inp" id="nEq" list="nEqL" placeholder="Ex.: Equipa 2 - Impermeabilização"><datalist id="nEqL">${S.equipas.map((e) => `<option value="${esc(e)}">`).join("")}</datalist></label>
      </div>

      <div class="formbox" id="nDepW">
        <h3>Só começa depois de</h3>
        <p class="note" id="nDepNota" ${n.esp && n.esp !== "__outra" ? "" : "hidden"}>Esta especialidade já segue a sequência definida no ecrã Sequência. Pode acrescentar condições aqui.</p>
        <div class="chips">${esp.filter((e) => e.key !== n.esp).map((e) => `<button type="button" class="chip ${n.depois.includes(e.key) ? "on" : ""}" data-nd="${e.key}">${esc(e.nome)}</button>`).join("")}</div>
        <p class="note">Aplica-se dentro de cada fração: a nova atividade num apartamento espera pelas especialidades escolhidas nesse mesmo apartamento.</p>
        <details ${n.especificas && n.especificas.length ? "open" : ""}><summary><b>Ligar também a uma atividade específica</b> <span class="note">de qualquer fração</span></summary>
          <p class="note" style="margin:8px 0">Todas as atividades criadas ficam à espera desta. Ex.: só começar depois da pintura final do B-F503, ou dos testes dos elevadores.</p>
          <div class="tags" id="nEspec" style="margin-bottom:8px"></div>
          ${depPickerHTML("nd", n.onde === "escolher" && n.sel.size ? [...n.sel][0] : (S.unidades.find((u) => u.tipo === "Apartamento") || S.unidades[0]).id, "Acrescentar")}
        </details>
      </div>

      <div class="banner" id="nResumo"></div>
      <div class="err" id="nErr"></div>
      <div class="row"><button class="btn pri" type="submit" id="nOk">Criar</button><button class="btn" type="button" id="nCancel">Cancelar</button></div>
    </form>
  </aside>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const sh = document.querySelector('aside[data-dw="nova"]');
  const q = (s) => sh.querySelector(s);
  const resumo = () => {
    const alvos = novaAlvos();
    const e = n.esp && n.esp !== "__outra" ? n.esp : null;
    const ja = e ? alvos.filter((u) => u.acts.some((a) => a.esp === e)).length : 0;
    const total = alvos.length - (e && n.saltar ? ja : 0);
    const nome = e ? S.espIdx[e].nome : (q("#nNome").value.trim() || "nova atividade");
    q("#nResumo").innerHTML = total
      ? `Vai criar <b>${total} atividade${total > 1 ? "s" : ""}</b> de <b>${esc(nome)}</b>${alvos.length <= 6 ? ": " + esc(alvos.map((u) => u.id).join(", ")) : ""}.${ja ? ` ${ja} fração${ja > 1 ? "ões já têm" : " já tem"} esta especialidade${n.saltar ? " e fica" + (ja > 1 ? "m" : "") + " de fora" : ""}.` : ""}`
      : alvos.length ? `As ${alvos.length} frações escolhidas já têm ${esc(nome)}. Desmarque "Saltar" para criar na mesma.` : "Escolha onde criar a atividade.";
    q("#nOk").disabled = !total;
  };
  q(".x").onclick = closeNova;
  q("#nCancel").onclick = closeNova;
  document.querySelector('.scrim[data-dw="nova"]').onclick = closeNova;
  const preencher = (modelo) => {
    // copiar uma atividade que já existe: nome, dias e equipa
    if (!modelo) return;
    if (modelo.esp && S.espIdx[modelo.esp]) { n.esp = modelo.esp; q("#nEsp").value = modelo.esp; }
    else { n.esp = "__outra"; q("#nEsp").value = "__outra"; q("#nNome").value = modelo.nome; n.novaEsp = false; const cb = q("#nNovaEsp"); if (cb) cb.checked = false; }
    if (modelo.dias != null) q("#nDur").value = modelo.dias;
    if (modelo.equipa) q("#nEq").value = modelo.equipa;
  };
  q("#nEsp").onchange = (ev) => {
    if (ev.target.value.startsWith("__ja:")) {
      const ja = atividadesJaCriadas().find((x) => "__ja:" + x.nome === ev.target.value);
      preencher(ja);
      q("#nOutra").hidden = false; q("#nSaltarW").hidden = true; q("#nDepNota").hidden = true;
      return resumo();
    }
    n.esp = ev.target.value;
    q("#nOutra").hidden = n.esp !== "__outra";
    const cb = q("#nNovaEsp");
    if (cb && n.esp === "__outra" && n.onde !== "escolher") { cb.checked = true; n.novaEsp = true; }
    q("#nSaltarW").hidden = !(n.esp && n.esp !== "__outra");
    q("#nDepNota").hidden = !(n.esp && n.esp !== "__outra");
    if (n.esp && n.esp !== "__outra" && S.cfg.duracoes && S.cfg.duracoes[n.esp] != null) q("#nDur").value = S.cfg.duracoes[n.esp];
    resumo();
  };
  q("#nNome").oninput = resumo;
  if (n.modelo) { preencher(n.modelo); q("#nOutra").hidden = n.esp !== "__outra"; q("#nSaltarW").hidden = !(n.esp && n.esp !== "__outra"); q("#nDepNota").hidden = !(n.esp && n.esp !== "__outra"); n.modelo = null; }
  const ne = q("#nNovaEsp"); if (ne) ne.onchange = () => (n.novaEsp = ne.checked);
  sh.querySelectorAll("[data-onde]").forEach((b) => (b.onclick = () => {
    n.onde = b.dataset.onde;
    sh.querySelectorAll("[data-onde]").forEach((x) => x.classList.toggle("on", x === b));
    q("#nBlocos").hidden = !(n.onde === "apart" || n.onde === "zonas");
    q("#nEscolher").hidden = n.onde !== "escolher";
    resumo();
  }));
  sh.querySelectorAll("[data-nb]").forEach((c) => (c.onchange = () => {
    n.blocos = [...sh.querySelectorAll("[data-nb]:checked")].map((x) => x.dataset.nb);
    resumo();
  }));
  const syncChip = (c) => c.closest("label").classList.toggle("on", c.checked);
  sh.querySelectorAll("[data-nu]").forEach((c) => (c.onchange = () => {
    c.checked ? n.sel.add(c.dataset.nu) : n.sel.delete(c.dataset.nu);
    syncChip(c); resumo();
  }));
  sh.querySelectorAll("[data-nall]").forEach((b) => (b.onclick = () => {
    const cs = S.unidades.filter((u) => u.bloco === b.dataset.nall).map((u) => sh.querySelector(`[data-nu="${CSS.escape(u.id)}"]`)).filter(Boolean);
    const todos = cs.every((c) => c.checked);
    cs.forEach((c) => { c.checked = !todos; c.checked ? n.sel.add(c.dataset.nu) : n.sel.delete(c.dataset.nu); syncChip(c); });
    resumo();
  }));
  q("#nSaltar").onchange = (ev) => { n.saltar = ev.target.checked; resumo(); };
  sh.querySelectorAll("[data-nd]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.nd;
    n.depois = n.depois.includes(k) ? n.depois.filter((x) => x !== k) : [...n.depois, k];
    b.classList.toggle("on");
  }));
  n.especificas = n.especificas || [];
  const drawEspec = () => {
    const el = q("#nEspec");
    el.innerHTML = n.especificas.map((d, i) => { const x = S.acts[d.id]; return x ? `<span class="tag">${esc(nomeAtiv(x))} · ${esc(x.unidade)}${d.tipo === "SS" ? " (início)" : ""}<button type="button" data-rmesp="${i}" aria-label="Retirar">×</button></span>` : ""; }).join("");
    el.querySelectorAll("[data-rmesp]").forEach((b) => (b.onclick = () => { n.especificas.splice(+b.dataset.rmesp, 1); drawEspec(); }));
  };
  drawEspec();
  bindDepPicker(sh, "nd", { onPick: (pid, tipo) => { if (!n.especificas.some((d) => d.id === pid)) n.especificas.push({ id: pid, tipo }); drawEspec(); } });
  q("#nf").onsubmit = async (ev) => {
    ev.preventDefault();
    const err = q("#nErr");
    err.textContent = "";
    if (!n.esp) { err.textContent = "Escolha a atividade ou escreva o nome de uma nova."; return; }
    const nome = n.esp === "__outra" ? q("#nNome").value.trim() : S.espIdx[n.esp].nome;
    if (!nome) { err.textContent = "Escreva o nome da atividade."; return; }
    const dias = Math.max(0, Math.round(Number(q("#nDur").value) || 0));
    const ini = q("#nIni").value || null;
    const cadeia = q("#nCadeia").checked;
    const equipa = q("#nEq").value.trim() || null;
    let alvos = novaAlvos();
    const cfgPatch = {};
    if (equipa && !S.equipasTodas.some((x) => x.toLowerCase() === equipa.toLowerCase())) cfgPatch.equipas = [...(S.cfg.equipas || []).filter((e) => e && e.nome), { id: "eq" + Date.now().toString(36), nome: equipa, esp: [] }];
    let espKey = n.esp === "__outra" ? null : n.esp;
    if (n.esp === "__outra" && n.novaEsp && dono) {
      let k = slugKey(nome), i = 2;
      while (S.espIdx[k]) k = slugKey(nome) + "_" + i++;
      espKey = k;
      const ordem = Math.max(...S.cfg.especialidades.map((e) => e.ordem)) + 1;
      cfgPatch.especialidades = [...S.cfg.especialidades, { key: k, nome, ordem }];
      cfgPatch.duracoes = { ...(S.cfg.duracoes || {}), [k]: dias };
      cfgPatch.regras = { ...(S.cfg.regras || {}), [k]: n.depois };
    }
    if (espKey && n.esp !== "__outra" && n.saltar) alvos = alvos.filter((u) => !u.acts.some((a) => a.esp === espKey));
    if (!alvos.length) { err.textContent = "Não há frações para criar."; return; }
    const lotes = Object.values(S.acts).map((a) => (/^N(\d+)$/.exec(a.lote || "") || [])[1]).filter(Boolean).map(Number);
    const lote = "N" + ((lotes.length ? Math.max(...lotes) : 0) + 1);
    const base = Date.now().toString(36);
    const padrao = espKey && S.cfg.duracoes ? S.cfg.duracoes[espKey] : null;
    const usaRegras = !!cfgPatch.regras; // nova especialidade: as condições ficam na sequência
    let cur = ini, prev = null;
    const lista = alvos.map((u, i) => {
      const a = { id: `n${base}-${i}`, ref: `${lote}#${i + 1}`, lote, unidade: u.id, seccao: nome, duracao: dias, pctEmp: 0 };
      if (u.teste) a.teste = true;
      if (espKey) a.esp = espKey;
      if (espKey && !cfgPatch.duracoes && padrao != null && padrao !== dias) a.duracaoManual = dias;
      if (equipa) a.equipa = equipa;
      if (cur) { a.planInicio = cur; a.planFim = addDays(cur, dias); if (cadeia) cur = addDays(a.planFim, 1); }
      const extra = [];
      if (cadeia && prev) extra.push({ id: prev, tipo: "FS" });
      if (!usaRegras) for (const k of n.depois) for (const x of u.acts) if (x.esp === k) extra.push({ id: x.id, tipo: "FS" });
      for (const d of n.especificas) if (!extra.some((e) => e.id === d.id)) extra.push({ ...d });
      if (extra.length) a.depsExtra = extra;
      prev = a.id;
      return a;
    });
    const onde = { apart: "apartamentos", lojas: "lojas", zonas: "zonas comuns", geral: "geral", escolher: "frações escolhidas" }[n.onde];
    await store.addAtividades(lista, Object.keys(cfgPatch).length ? cfgPatch : null,
      { tipo: "nova", texto: `Nova atividade "${nome}" criada em ${lista.length} ${lista.length === 1 ? "fração (" + lista[0].unidade + ")" : onde} (lote ${lote})` });
    closeNova();
    toast(`${lista.length} atividade${lista.length > 1 ? "s" : ""} criada${lista.length > 1 ? "s" : ""}`);
    // com equipa: entram logo na fila dela, pela data em que podem começar
    const comEq = lista.filter((a) => a.equipa);
    if (comEq.length) setTimeout(() => filarSemPerguntar(comEq.map((a) => a.id)), 500);
  };
  resumo();
}

/* ============================================================ ficha de atividade */
function openSheet(id, opts = {}) {
  const hist = opts.empilhar && ui.sheet ? [...(ui.sheet.hist || []), ui.sheet.id].slice(-30) : opts.hist || [];
  ui.sheet = { id, form: null, hist };
  ui.sheetTab = opts.tab || "estado";
  renderSheet();
}
/** Antecessoras de uma atividade, diretas e indiretas (para evitar ciclos). */
function aMontante(id) {
  const up = new Set(), st = [id];
  while (st.length) { const x = st.pop(); for (const p of S.res.get(x)?.preds || []) if (!up.has(p.id)) { up.add(p.id); st.push(p.id); } }
  return up;
}
/** Tira a ligação "sid espera por id" (da sequência, do Excel ou manual). */
function patchTirarLigacao(sid, id) {
  const x = S.acts[sid];
  const d = (S.res.get(sid)?.preds || []).find((p) => p.id === id);
  if (!d) return null;
  return d.fonte === "manual" ? { depsExtra: (x.depsExtra || []).filter((e) => e.id !== id) } : { depsIgnorar: [...new Set([...(x.depsIgnorar || []), id])] };
}
function patchPorLigacao(sid, id, tipo) {
  const y = S.acts[sid];
  return { depsExtra: [...(y.depsExtra || []).filter((e) => e.id !== id), { id, tipo: tipo || "FS" }], depsIgnorar: (y.depsIgnorar || []).filter((e) => e !== id) };
}
const rotulo = (x) => `${nomeAtiv(x)}${x.unidade ? " · " + x.unidade : ""}`;
function closeSheet() { ui.sheet = null; document.querySelectorAll('[data-dw="ativ"]').forEach((e) => e.remove()); }
function renderSheet() {
  document.querySelectorAll('[data-dw="ativ"]').forEach((e) => e.remove());
  const id = ui.sheet.id, a = S.acts[id], r = S.res.get(id);
  if (!a) { closeSheet(); return; }
  const down = downstream(id, S.res);
  const fonteTxt = { excel: "Original", regra: "Sequência", manual: "Manual", equipa: "Fila da equipa" };
  const depRow = (pid, fonte, rem, tipo) => {
    const p = S.acts[pid]; if (!p) return "";
    const pr = S.res.get(pid);
    return `<div class="dep"><div><button class="lnk" data-go="${pid}">${esc(nomeAtiv(p))}</button> <span class="mono muted">${esc(p.unidade)}</span>${p.unidade !== a.unidade ? ` <span class="src outra">outra fração</span>` : ""}${fonte ? ` <span class="src">${fonteTxt[fonte] || ""}</span>` : ""}${tipo === "SS" ? ` <span class="src">em paralelo</span>` : ""}</div>
      <div class="row" style="gap:6px"><span class="pill st-${pr.estado}">${ESTADO[pr.estado]}</span><span class="mono note">${fd(pr.fim)}</span>${fonte === "equipa" ? `<button class="btn sm" data-gofila="${esc(a.equipa || "")}" title="A ordem dos trabalhos da equipa muda-se no plano da equipa">Plano da equipa</button>` : rem ? `<button class="btn sm tira-b" data-rmdep="${pid}|${fonte}" title="Esta atividade deixa de esperar por aquela">× Tirar ligação</button>` : ""}</div></div>`;
  };
  const exec = can("executar") && r.estado !== "concluida";
  // percentagem mexida e ainda por guardar: mantém-se se o ecrã se redesenhar (alterações de outros utilizadores)
  const pt = ui.sheet.pctTmp;
  const pct = pt && pt.id === id ? pt.v : Math.round(a.pctEmp ?? 0);
  const podeDeps = can("dependencias");
  const mesmos = Object.values(S.acts).filter((x) => x.unidade === a.unidade && x.id !== id && !r.preds.some((p) => p.id === x.id));
  const idsLote = a.lote ? Object.values(S.acts).filter((x) => x.lote === a.lote).map((x) => x.id) : [id];
  const nLote = idsLote.length;
  const html = `
  <div class="scrim" data-dw="ativ"></div>
  <aside class="sheet" data-dw="ativ" role="dialog" aria-label="Ficha da atividade">
    <div class="sheet-h"><div style="display:flex;flex-direction:column;gap:6px;min-width:0">
      <div class="eyebrow"><a href="#u-${esc(a.unidade)}" data-close>${esc(a.unidade)}</a> · ref. ${esc(a.ref)}${a.equipa ? " · " + esc(a.equipa) : ""}</div>
      <h2>${esc(nomeAtiv(a))}</h2>
      <div class="snav">
        ${(ui.sheet.hist || []).length ? `<button class="btn sm" data-snav="voltar" title="Voltar a ${esc(rotulo(S.acts[ui.sheet.hist[ui.sheet.hist.length - 1]] || {}))}">↩ Voltar</button>` : ""}
        <div class="fpick"><button class="btn sm" data-snav="ant" ${r.preds.length ? "" : "disabled"} title="${r.preds.length ? "Atividade de que esta depende" : "Não depende de nenhuma"}">‹ Anterior${r.preds.length > 1 ? ` <span class="num">${r.preds.length}</span>` : ""}</button>
          <div class="fmenu navmenu" hidden data-snm="ant">${r.preds.map((d) => { const x = S.acts[d.id], xr = S.res.get(d.id); return x ? `<button class="fopt" data-snavgo="${d.id}"><span><b>${esc(nomeAtiv(x))}</b><small>${esc(x.unidade)} · ${ESTADO[xr.estado]} · fim ${fd(xr.fim)}</small></span></button>` : ""; }).join("")}</div></div>
        <div class="fpick"><button class="btn sm" data-snav="seg" ${r.succ.length ? "" : "disabled"} title="${r.succ.length ? "Atividade que espera por esta" : "Nenhuma atividade espera por esta"}">Seguinte ›${r.succ.length > 1 ? ` <span class="num">${r.succ.length}</span>` : ""}</button>
          <div class="fmenu navmenu" hidden data-snm="seg">${r.succ.map((sid) => { const x = S.acts[sid], xr = S.res.get(sid); return x ? `<button class="fopt" data-snavgo="${sid}"><span><b>${esc(nomeAtiv(x))}</b><small>${esc(x.unidade)} · ${ESTADO[xr.estado]} · começa ${fd(xr.inicio)}</small></span></button>` : ""; }).join("")}</div></div>
      </div>
      <div class="row" style="gap:6px"><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>${r.atrasada ? '<span class="pill late">Atrasada</span>' : ""}${deltaHTML(r.atraso)}</div></div>
      <button class="x" aria-label="Fechar">×</button></div>
    <div class="stabs" role="tablist">${[["estado", "Estado"], ["lig", `Ligações <span class="num">${r.preds.length + r.succ.length}</span>`], ["pend", `Pendentes${pendDe(a.unidade, a.id).filter(pendAberto).length ? ` <span class="num">${pendDe(a.unidade, a.id).filter(pendAberto).length}</span>` : ""}`], ["fotos", "Fotografias"], ["hist", "Histórico"]].map(([k, l]) => `<button role="tab" data-stab="${k}" class="${(ui.sheetTab || "estado") === k ? "on" : ""}" aria-selected="${(ui.sheetTab || "estado") === k}">${l}</button>`).join("")}</div>
    <div class="sheet-b papel-${store.user.papel}">
      <div class="spane" data-pane="estado" ${(ui.sheetTab || "estado") === "estado" ? "" : "hidden"}>
      ${(() => {
        const ed = can("executar"), dono = store.user.papel === "dono", conc = r.estado === "concluida";
        const v = (txt, b) => `<span class="v">${b ? "<b>" + txt + "</b>" : txt}</span>`;
        const prev = ed ? `<span class="v">${dateInput(id, "prevIni", r.prevIni)}</span><span class="v">${dateInput(id, "prevFim", r.prevFim)}</span>` : v(fd(r.prevIni, true), true) + v(fd(r.prevFim, true), true);
        const real = ed ? `<span class="v">${dateInput(id, "realIni", a.realInicio, `max="${S.hoje}"`)}</span><span class="v">${dateInput(id, "realFim", conc ? a.realFim || r.fim : "", `max="${S.hoje}"`)}</span>`
          : v(a.realInicio ? fd(a.realInicio, true) : "-") + v(conc ? fd(r.fim, true) : "-");
        const atrI = r.atrasoInicio > 0 ? `<span class="v note">${a.realInicio ? "começou" : "devia ter começado há"} ${a.realInicio ? r.atrasoInicio + " dias depois do previsto" : r.atrasoInicio + " dias"}</span>` : `<span class="v"></span>`;
        const atrF = r.atraso > 0 ? `<span class="v note mau-t">${conc ? `acabou ${r.atraso} dias depois do previsto` : `${r.atraso} dias depois do previsto`}</span>` : r.atraso < 0 && conc ? `<span class="v note bom-t">acabou ${-r.atraso} dias antes</span>` : `<span class="v"></span>`;
        return `<div class="dates ${ed ? "editavel" : ""}">
          <span></span><span class="h">Início</span><span class="h">Fim</span>
          <span class="k">Previsão</span>${prev}
          <span class="k">Real</span>${real}
          ${r.atrasoInicio > 0 || r.atraso ? `<span class="k">Atraso</span>${atrI}${atrF}` : ""}
        </div>${ed ? `<p class="note" style="margin:0">${conc ? "Pode corrigir as datas reais. Apagar o fim real reabre a atividade." : "Mude a previsão e as atividades seguintes acertam-se sozinhas. Escreva o início real quando arrancar e o fim real para a dar como concluída."}</p>` : ""}`;
      })()}
      ${can("executar") ? `<label class="f eqsel">Equipa<select class="inp" id="sEquipa"><option value="">Sem equipa</option>${S.equipas.map((e) => `<option ${a.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_nova">+ Nova equipa...</option></select></label>`
        : `<div class="note">Equipa: <b>${a.equipa ? esc(a.equipa) : "sem equipa"}</b></div>`}
      <div class="row note"><span>Duração considerada: <b class="num">${r.dur} dias</b></span><span>Empreiteiro <b>${pct}%</b></span><span>Fiscal <b>${a.pctFiscal == null ? "sem vistoria" : Math.round(a.pctFiscal) + "%"}</b></span></div>
      ${r.atrasada ? `<div class="banner warn">A previsão de fim (${fd(r.prevFim)}) já passou há ${r.atraso} dias sem a atividade estar concluída.${can("executar") ? " Se já acabou, escreva o fim real; se não, indique uma nova previsão." : ""}${r.provFim > r.prevFim ? ` As seguintes já contam com o fim a ${fd(r.provFim)}.` : ""}</div>` : ""}
      ${a.motivo ? `<div class="note"><b>Motivo do atraso:</b> ${esc(a.motivo)}</div>` : ""}
      ${a.obs ? `<div class="note"><b>Observações:</b> ${esc(a.obs)}</div>` : ""}
      ${can("criar") ? `<div class="row" style="gap:6px"><button class="btn sm" id="bNovaU" title="Criar uma atividade nova em ${esc(a.unidade)}">+ Nova atividade nesta fração</button><button class="btn sm" id="bNovaSeg" title="Criar uma atividade nova que só começa quando esta acabar">+ Nova atividade a seguir a esta</button><button class="btn sm" id="bCopiar" title="Criar esta mesma atividade noutros apartamentos, lojas, zonas comuns ou no geral">Copiar para outras frações</button></div>
        ${can("executar") ? `<details class="formbox" id="mudaBox"><summary><b>Mudar para outra fração</b> <span class="note">apartamento, loja, zona comum ou geral</span></summary>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
            <p class="note" style="margin:0">A atividade sai de ${esc(a.unidade)} e passa para a fração escolhida, com as mesmas datas, percentagens, ligações e histórico. As fotografias já tiradas continuam na galeria de ${esc(a.unidade)}.</p>
            <select class="inp" id="mudaSel"><option value="">Escolha a fração...</option>${["A", "B", "C", "D", "Geral"].map((g) => { const us = ordenaUnidades(S.unidades.filter((u) => u.bloco === g && u.id !== a.unidade)); return us.length ? `<optgroup label="${g === "Geral" ? "Geral e exteriores" : "Bloco " + g}">${us.map((u) => `<option value="${esc(u.id)}">${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}${u.tipo !== "Apartamento" ? " (" + u.tipo.toLowerCase() + ")" : ""}</option>`).join("")}</optgroup>` : ""; }).join("")}</select>
            <div class="note" id="mudaAviso"></div>
            <button class="btn warn" id="mudaOk" disabled>Mudar de fração</button>
          </div></details>` : ""}` : ""}
      ${down.size ? `<div class="impact">Se esta atividade se atrasar, <b>${down.size} atividade${down.size > 1 ? "s" : ""}</b> andam para a frente com ela.</div>` : ""}

      ${exec ? `<div class="formbox" id="fexec">
        <h3>Atualizar execução</h3>
        <div class="acts">
          ${a.realInicio ? `<button class="btn" disabled>Iniciada a ${fd(a.realInicio)}</button>` : `<button class="btn pri" id="bIni">Iniciar hoje</button>`}
          <button class="btn ok" id="bFim">Concluir hoje</button>
        </div>
        <label class="f">Percentagem feita<div class="range"><input type="range" id="rPct" min="0" max="100" step="5" value="${pct}"><output id="oPct">${pct}%</output></div></label>
        <button class="btn" id="bPct">Guardar percentagem</button>
        <details ${r.atrasada && !a.motivo ? "open" : ""}><summary><b>Motivo do atraso e duração</b></summary>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
            <p class="note" style="margin:0">As datas mudam-se em cima, na previsão e no real.</p>
            <label class="f">Motivo<input class="inp" id="dMot" value="${esc(a.motivo || "")}" placeholder="Ex.: falta de material, equipa noutra frente"></label>
            <label class="f">Duração própria desta atividade (dias)<input class="inp" type="number" min="0" id="dDur" value="${a.duracaoManual ?? ""}" placeholder="padrão: ${r.dur}"></label>
            <button class="btn warn" id="bPrev">Guardar</button>
          </div></details>
        ${a.realInicio || a.realFim ? `<button class="btn sm ghost" id="bUndo">Corrigir: anular início</button>` : ""}
      </div>` : ""}
      ${can("executar") && r.estado === "concluida" ? `<button class="btn sm" id="bReabrir">Reabrir atividade</button>` : ""}

      ${can("vistoria") ? `<div class="formbox vbox"><h3>Vistoria</h3>
        <div class="f"><span>Percentagem verificada</span><div id="fPctW">${pctCtlHTML("sheet", Math.round(a.pctFiscal ?? a.pctEmp ?? 0), false)}</div></div>
        ${a.fiscalNota ? `<p class="note" style="margin:0"><b>Último comentário:</b> ${esc(a.fiscalNota)}</p>` : ""}
        <label class="f">Comentário<textarea class="inp" id="fNota" rows="2" placeholder="O que viu, não conformidades, o que falta"></textarea></label>
        <div class="row">${fotoPickerHTML("sv", 0, "Juntar fotografias")}</div>
        <div id="fPend"></div>
        <button class="btn pri" id="bVist">Guardar vistoria</button></div>` : ""}
      ${!can("vistoria") && can("foto") ? `<div class="row">${fotoPickerHTML("se", 0, "Juntar fotografia")}</div>` : ""}

      </div>
      <div class="spane" data-pane="lig" ${ui.sheetTab === "lig" ? "" : "hidden"}>
      <h3>Depende de</h3>
      <div class="dlist">${r.preds.length ? r.preds.map((p) => depRow(p.id, p.fonte, podeDeps, p.tipo)).join("") : `<div class="note">Não depende de nenhuma outra atividade.</div>`}</div>
      ${podeDeps ? `<details class="formbox" id="depBox"><summary><b>+ Ligar a outra atividade</b> <span class="note">desta ou de outra fração</span></summary>
        <p class="note" style="margin:8px 0">Esta atividade fica à espera da que escolher. Pode ser de outro apartamento, por exemplo a pintura final deste só depois da pintura final do apartamento ao lado.</p>
        ${depPickerHTML("dp", a.unidade, "Ligar")}</details>` : ""}
      <h3>Atividades que esperam por esta</h3>
      <div class="dlist">${r.succ.length ? r.succ.map((sid) => {
        const x = S.acts[sid]; if (!x) return "";
        const xr = S.res.get(sid);
        const fonte = (xr.preds.find((p) => p.id === id) || {}).fonte;
        return `<div class="dep"><div><button class="lnk" data-go="${sid}">${esc(nomeAtiv(x))}</button> <span class="mono muted">${esc(x.unidade)}</span>${x.unidade !== a.unidade ? ` <span class="src outra">outra fração</span>` : ""}${fonte ? ` <span class="src">${fonteTxt[fonte] || ""}</span>` : ""}</div>
          <div class="row" style="gap:6px"><span class="pill st-${xr.estado}">${ESTADO[xr.estado]}</span><span class="mono note">${fd(xr.inicio)}</span>${podeDeps ? `<button class="btn sm" data-troca="${sid}">Trocar</button><button class="btn sm tira-b" data-tirasuc="${sid}" title="Aquela atividade deixa de esperar por esta">× Tirar ligação</button>` : ""}</div></div>
          ${podeDeps && ui.sheet.troca === sid ? `<div class="formbox trocabox"><b>Trocar ${esc(nomeAtiv(x))} (${esc(x.unidade)}) por:</b>${depPickerHTML("tp", x.unidade, "Trocar por esta")}<button class="btn sm ghost" data-trocacancel>Cancelar</button></div>` : ""}`;
      }).join("") : `<div class="note">Nenhuma.</div>`}</div>
      ${can("criar") ? `<div class="row" style="gap:6px;margin:8px 0"><button class="btn sm" id="bNovaSeg2" title="Criar uma atividade nova que só começa quando esta acabar">+ Nova atividade a seguir a esta</button></div>` : ""}
      ${podeDeps ? `<details class="formbox" id="sucBox"><summary><b>+ Ligar uma atividade que já existe</b> <span class="note">como seguinte, desta ou de outra fração</span></summary>
        <p class="note" style="margin:8px 0">A atividade que escolher passa a esperar por esta.</p>${depPickerHTML("sp", a.unidade, "Acrescentar")}</details>` : ""}
      </div>
      <div class="spane" data-pane="pend" ${ui.sheetTab === "pend" ? "" : "hidden"}>
      <h3>Pendentes desta atividade</h3>
      ${pendFormHTML(a.unidade, a.id)}
      <div class="pd-lista">${pendListaHTML(pendDe(a.unidade, a.id), { mostrarAtiv: false, vazio: "Sem pendentes nesta atividade." })}</div>
      ${pendDe(a.unidade).filter((x) => x.ativ !== a.id && pendAberto(x)).length ? `<p class="note"><a href="#u-${esc(a.unidade)}" data-irpend="${esc(a.unidade)}">Ver todos os pendentes de ${esc(a.unidade)}</a></p>` : ""}
      </div>
      <div class="spane" data-pane="fotos" ${ui.sheetTab === "fotos" ? "" : "hidden"}>
      <h3>Fotografias</h3>
      <div class="photos" id="sfotos"><div class="note">A carregar...</div></div>
      </div>
      <div class="spane" data-pane="hist" ${ui.sheetTab === "hist" ? "" : "hidden"}>
      <h3>Histórico</h3>
      <div class="hist" id="shist"><div class="note">A carregar...</div></div>
      ${store.user.papel === "dono" ? `<div class="formbox" id="delBox"><h3>Eliminar</h3>
        <p class="note">Para corrigir atividades criadas por engano. As fotografias e o histórico ficam guardados.</p>
        <div class="row"><button class="btn sm warn" id="bDel">Eliminar esta atividade</button>${a.lote && nLote > 1 ? `<button class="btn sm warn" id="bDelLote">Eliminar o lote ${esc(a.lote)} (${nLote} atividades)</button>` : ""}</div>
        <div class="row" id="delConf" hidden><span id="delTxt"></span><button class="btn sm" id="bDelSim" style="border-color:var(--crit);color:var(--crit)">Sim, eliminar</button><button class="btn sm ghost" id="bDelNao">Não</button></div>
      </div>` : ""}
      </div>
    </div>
  </aside>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const sh = $('aside[data-dw="ativ"]');
  sh.querySelectorAll("[data-stab]").forEach((b) => (b.onclick = () => {
    ui.sheetTab = b.dataset.stab;
    sh.querySelectorAll("[data-stab]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
    sh.querySelectorAll("[data-pane]").forEach((x) => (x.hidden = x.dataset.pane !== ui.sheetTab));
    sh.querySelector(".sheet-b").scrollTop = 0;
  }));
  bindPendentes(sh);
  sh.querySelectorAll("[data-irpend]").forEach((b) => (b.onclick = () => { ui.lastUnit = b.dataset.irpend; ui.unidadeTab = store.user.papel === "fiscal" ? "vist" : "pend"; closeSheet(); }));
  $('.scrim[data-dw="ativ"]').onclick = closeSheet;
  $(".x", sh).onclick = closeSheet;
  sh.querySelectorAll("[data-close]").forEach((x) => (x.onclick = closeSheet));
  sh.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => openSheet(b.dataset.go, { empilhar: true, tab: ui.sheetTab })));
  sh.querySelectorAll("[data-snav]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const v = b.dataset.snav;
    if (v === "voltar") { const h = [...(ui.sheet.hist || [])]; const prev = h.pop(); if (prev) openSheet(prev, { hist: h, tab: ui.sheetTab }); return; }
    const lista = v === "ant" ? r.preds.map((d) => d.id) : r.succ;
    if (lista.length === 1) { openSheet(lista[0], { empilhar: true }); return; }
    const m = sh.querySelector(`[data-snm="${v}"]`);
    const fechado = m.hidden;
    document.querySelectorAll(".fmenu").forEach((x) => (x.hidden = true));
    m.hidden = !fechado;
  }));
  sh.querySelectorAll("[data-snavgo]").forEach((b) => (b.onclick = () => openSheet(b.dataset.snavgo, { empilhar: true })));
  sh.querySelectorAll("[data-troca]").forEach((b) => (b.onclick = () => { ui.sheet.troca = ui.sheet.troca === b.dataset.troca ? null : b.dataset.troca; renderSheet(); }));
  const tc = $("[data-trocacancel]", sh); if (tc) tc.onclick = () => { ui.sheet.troca = null; renderSheet(); };
  const N0 = nomeAtiv(a) + " em " + a.unidade;
  sh.querySelectorAll("[data-tirasuc]").forEach((b) => (b.onclick = async () => {
    const sid = b.dataset.tirasuc, x = S.acts[sid];
    const pt = patchTirarLigacao(sid, id); if (!pt) return;
    if (!(await confirmar("Tirar esta ligação?", `<p>${rotuloAt(x, a)} deixa de esperar por ${rotuloAt(a)}.</p><p class="note">As datas dessa atividade passam a ser calculadas sem esta condição.</p>`, "Sim, tirar a ligação"))) return;
    await store.updateAtividade(sid, pt, { tipo: "dependencia", texto: `${nomeAtiv(x)} em ${x.unidade} deixou de esperar por ${N0}` });
    toast("Ligação retirada");
  }));
  const acima = aMontante(id);
  if (ui.sheet.troca && $(".trocabox", sh)) {
    const xid = ui.sheet.troca, x = S.acts[xid];
    const tipoAntigo = ((S.res.get(xid)?.preds || []).find((p) => p.id === id) || {}).tipo || "FS";
    bindDepPicker(sh.querySelector(".trocabox"), "tp", { excluir: new Set([id, ...acima, ...r.succ]), esp: x.esp, onPick: async (yid, tipo) => {
      const y = S.acts[yid];
      const pt = patchTirarLigacao(xid, id);
      if (pt) await store.updateAtividade(xid, pt, null);
      await store.updateAtividade(yid, patchPorLigacao(yid, id, tipo || tipoAntigo), { tipo: "dependencia", texto: `A atividade seguinte de ${N0} passou de ${nomeAtiv(x)} (${x.unidade}) para ${nomeAtiv(y)} (${y.unidade})` });
      ui.sheet.troca = null;
      toast(`Seguinte trocada: agora ${nomeAtiv(y)} em ${y.unidade}`);
    } });
  }
  if ($("#sucBox", sh)) bindDepPicker(sh.querySelector("#sucBox"), "sp", { excluir: new Set([id, ...acima, ...r.succ]), esp: null, onPick: async (yid, tipo) => {
    const y = S.acts[yid];
    await store.updateAtividade(yid, patchPorLigacao(yid, id, tipo), { tipo: "dependencia", texto: `${nomeAtiv(y)} em ${y.unidade} passa a esperar por ${N0}` });
    toast(`Acrescentada: ${nomeAtiv(y)} em ${y.unidade}`);
  } });
  bindDateInputs(sh);
  document.onkeydown = (e) => { if (e.key === "Escape") { if (ui.nova) closeNova(); else if (ui.sheet) closeSheet(); } };
  const N = nomeAtiv(a) + " em " + a.unidade;
  const upd = async (patch, texto, tipo) => { await store.updateAtividade(id, patch, { tipo, texto }); toast("Guardado"); };
  const on = (sel, fn) => { const el = $(sel, sh); if (el) el.onclick = fn; };
  const se = $("#sEquipa", sh);
  if (se) se.onchange = async () => {
    if (se.value === "_nova") { se.value = a.equipa || ""; openEquipa(null, { aoGravar: (nome) => atribuirEquipa([id], nome) }); return; }
    if (!se.value && a.equipa && !(await confirmar("Retirar a equipa?", `<p>${rotuloAt(a)} deixa de ter a equipa <b>${esc(a.equipa)}</b>.</p>`))) return;
    if ((await atribuirEquipa([id], se.value || null)) === false) se.value = a.equipa || "";
  };
  on("#bNovaU", () => { const u = a.unidade; closeSheet(); openNova("unit:" + u); });
  on("#bCopiar", () => { const r0 = S.res.get(id); closeSheet(); openNova("unit:", { modelo: { esp: a.esp, nome: nomeAtiv(a), dias: r0 ? r0.dur : a.duracao, equipa: a.equipa } }); });
  const ms = $("#mudaSel", sh);
  if (ms) {
    ms.onchange = () => {
      const u = S.uMap[ms.value];
      $("#mudaOk", sh).disabled = !u;
      const dup = u && a.esp && u.acts.some((x) => x.esp === a.esp);
      $("#mudaAviso", sh).innerHTML = dup ? `<span class="mau-t">Atenção: ${esc(ms.value)} já tem ${esc(nomeAtiv(a))}. Ficará com duas.</span>` : u && a.esp ? "Passa a seguir a sequência das especialidades dessa fração." : "";
    };
    $("#mudaOk", sh).onclick = async () => {
      const dest = ms.value; if (!dest) return;
      const de = a.unidade;
      await store.updateAtividade(id, { unidade: dest }, { tipo: "correcao", texto: `${nomeAtiv(a)} passou de ${de} para ${dest}` });
      toast(`${nomeAtiv(a)} passou para ${dest}`);
    };
  }
  on("#bNovaSeg2", () => { const u = a.unidade; closeSheet(); openNova("unit:" + u, { especificas: [{ id, tipo: "FS" }] }); });
  on("#bNovaSeg", () => { const u = a.unidade; closeSheet(); openNova("unit:" + u, { especificas: [{ id, tipo: "FS" }] }); });
  on("#bIni", () => editarData(id, "realIni", S.hoje));
  on("#bFim", () => concluirHoje(id));
  on("#bReabrir", () => upd({ concluido: false, realFim: null, pctEmp: 90 }, `Reabriu ${N}`, "reabrir"));
  on("#bUndo", () => upd({ realInicio: null, realFim: null, concluido: false }, `Anulou início de ${N}`, "correcao"));
  const rp = $("#rPct", sh); if (rp) rp.oninput = () => { $("#oPct", sh).textContent = rp.value + "%"; ui.sheet.pctTmp = { id, v: Number(rp.value) }; };
  on("#bPct", () => {
    const pt = ui.sheet.pctTmp;
    const v = pt && pt.id === id ? pt.v : Number(rp.value);
    ui.sheet.pctTmp = null;
    const patch = { pctEmp: v, empEm: new Date().toISOString() };
    if (v > 0 && !a.realInicio) patch.realInicio = S.hoje;
    upd(patch, `${N}: ${v}% feito (empreiteiro)`, "progresso");
  });
  on("#bPrev", () => {
    const mot = $("#dMot", sh).value.trim(), dur = $("#dDur", sh).value;
    const patch = { motivo: mot || null, duracaoManual: dur === "" ? null : Math.max(0, Number(dur)) };
    // uma duração escrita passa a mandar no fim (um fim escrito antes deixaria a duração sem efeito)
    if (dur !== "" && S.res.get(id).estado !== "concluida") patch.fimPrevisto = null;
    const partes = [];
    if (dur !== "") partes.push("duração de " + dur + " dias");
    if (mot) partes.push("motivo: " + mot);
    upd(patch, `${N}: ${partes.join(", ") || "motivo e duração limpos"}`, "previsao");
  });
  let pctVist = Math.round(a.pctFiscal ?? a.pctEmp ?? 0);
  const fpw = $("#fPctW", sh);
  const ligaPct = () => bindPctCtl(fpw, () => pctVist, (k, val) => { pctVist = val; fpw.innerHTML = pctCtlHTML("sheet", val, true); ligaPct(); });
  if (fpw) ligaPct();
  let fotos = [];
  const desenhaPend = () => {
    const el = $("#fPend", sh); if (!el) return;
    el.innerHTML = pendentesHTML("sv", fotos);
    el.querySelectorAll("[data-prm]").forEach((b) => (b.onclick = () => { fotos.splice(+b.dataset.prm.split("|")[1], 1); desenhaPend(); }));
  };
  bindFotoPickers(sh, async (key, novas) => {
    if (key === "se") { // empreiteiro: guarda logo
      for (const f of novas) await store.addFoto(id, a.unidade, f, "");
      await store.updateAtividade(id, {}, { tipo: "foto", texto: `${novas.length} fotografia(s) de ${N}` });
      toast(novas.length > 1 ? "Fotografias guardadas" : "Fotografia guardada");
      return;
    }
    fotos = fotos.concat(novas); desenhaPend();
  });
  on("#bVist", async () => {
    const v = pctVist, nota = $("#fNota", sh).value.trim();
    const agora = new Date().toISOString();
    for (const f of fotos) await store.addFoto(id, a.unidade, f, nota);
    const patch = { pctFiscal: v, fiscalEm: agora, fiscalPor: store.user.email };
    if (nota) Object.assign(patch, { fiscalNota: nota, fiscalNotaEm: agora });
    const dados = { esp: nomeAtiv(a), antes: a.pctFiscal ?? null, depois: v, emp: pct, nota: nota || null, nfotos: fotos.length };
    await store.updateAtividade(id, patch,
      { tipo: "vistoria", texto: `Vistoria ${N}: ${v}% (empreiteiro dizia ${pct}%)${fotos.length ? `, ${fotos.length} fotografia(s)` : ""}${nota ? ", comentário: " + nota : ""}`, dados });
    fotos = []; toast("Vistoria guardada");
  });
  if ($("#depBox", sh)) {
    const excl = new Set([id, ...down, ...r.preds.map((x) => x.id)]);
    bindDepPicker(sh, "dp", { excluir: excl, esp: a.esp, self: id, onPick: (pid, tipo) => {
      const p = S.acts[pid];
      const ign = (a.depsIgnorar || []).filter((x) => x !== pid);
      upd({ depsExtra: [...(a.depsExtra || []).filter((d) => d.id !== pid), { id: pid, tipo }], depsIgnorar: ign },
        `${N} passa a esperar ${tipo === "SS" ? "pelo início" : "pelo fim"} de ${nomeAtiv(p)}${p.unidade !== a.unidade ? " em " + p.unidade : ""}`, "dependencia");
    } });
  }
  sh.querySelectorAll("[data-gofila]").forEach((b) => (b.onclick = () => { ui.eqPlan = b.dataset.gofila; closeSheet(); location.hash = "#planequipa"; }));
  sh.querySelectorAll("[data-rmdep]").forEach((b) => (b.onclick = async () => {
    const [pid, fonte] = b.dataset.rmdep.split("|");
    const p = S.acts[pid];
    if (!(await confirmar("Tirar esta ligação?", `<p>${rotuloAt(a)} deixa de esperar por ${rotuloAt(p, a)}.</p><p class="note">As datas desta atividade passam a ser calculadas sem essa condição.${fonte === "regra" ? " A regra da sequência continua a valer para as outras frações." : ""}</p>`, "Sim, tirar a ligação"))) return;
    const patch = fonte === "manual" ? { depsExtra: (a.depsExtra || []).filter((d) => d.id !== pid) } : { depsIgnorar: [...new Set([...(a.depsIgnorar || []), pid])] };
    upd(patch, `${N} deixou de esperar por ${nomeAtiv(p)}`, "dependencia");
  }));
  let delIds = null;
  const pedir = (ids, txt) => { delIds = ids; $("#delTxt", sh).textContent = txt; $("#delConf", sh).hidden = false; };
  on("#bDel", () => pedir([id], `Eliminar ${N}?`));
  on("#bDelLote", () => pedir(idsLote, `Eliminar as ${nLote} atividades do lote ${a.lote}?`));
  on("#bDelNao", () => { delIds = null; $("#delConf", sh).hidden = true; });
  on("#bDelSim", async () => {
    const ids = delIds; if (!ids) return;
    closeSheet();
    await store.removeAtividades(ids, { tipo: "eliminar", texto: ids.length > 1 ? `Eliminou o lote ${a.lote} de ${nomeAtiv(a)} (${ids.length} atividades)` : `Eliminou ${N}` });
    toast(ids.length > 1 ? `${ids.length} atividades eliminadas` : "Atividade eliminada");
  });
  loadFotos(a.unidade, $("#sfotos", sh), id);
  store.getRegistos(id).then((rs) => {
    const el = $("#shist", sh); if (!el) return;
    el.innerHTML = rs.length ? rs.map((x) => `<div>${esc(x.texto)}<small>${fdt(x.em)} · ${esc(x.nomePor || x.por)}${x.papel ? " (" + (PAPEL[x.papel] || x.papel) + ")" : ""}</small></div>`).join("") : `<div class="note" style="border:0;padding:0">Sem alterações registadas.</div>`;
  }).catch(() => {});
}

boot();
