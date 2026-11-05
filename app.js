import { schedule, downstream, pctEfetiva, todayISO, diffDays, addDays } from "./engine.js";
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
const PAPEL = { dono: "Dono de obra", empreiteiro: "Empreiteiro", fiscal: "Fiscal", sem_acesso: "Sem acesso" };
const CURTO = { cabelagem: "Cabelagem", telecom: "Telecom", ac_tubagem: "AC tubagem", ac_esgotos: "AC esgotos", pint_barramento: "Barramento",
  teto_falso: "Teto falso", mosaicos: "Mosaicos", azul_wc: "Azulejo WC", azul_cozinha: "Azulejo coz.", pint_primario: "Primário",
  caix_portas: "Portas/estores", caix_guarda: "Guarda-corpos", caix_ac: "Arm. AC", carp_cozinha: "Carp. cozinha", carp_roupeiros: "Roupeiros",
  carp_wc: "Carp. WC", loucas: "Louças", loucas_div: "Torneiras", piso_flut: "Piso flut.", aparelhagem: "Aparelhagem", ac_aparelhos: "AC aparelhos",
  pint_final: "Pintura final", acab_teto: "Acab. teto", acab_piso: "Acab. piso", acab_mosaicos: "Acab. mosaicos" };
const ICON = {
  semana: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m8.5 15 2.2 2.2 4.8-4.8"/></svg>',
  painel: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  unidades: '<svg viewBox="0 0 24 24"><path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-4h6v4M8 8h2M14 8h2M8 12h2M14 12h2"/></svg>',
  plano: '<svg viewBox="0 0 24 24"><path d="M3 6h8M3 12h12M3 18h6"/><rect x="13" y="4" width="8" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1"/><rect x="11" y="16" width="8" height="4" rx="1"/></svg>',
  regras: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  gantt: '<svg viewBox="0 0 24 24"><path d="M3 4v16h18"/><rect x="6" y="6" width="7" height="3" rx="1"/><rect x="10" y="11" width="8" height="3" rx="1"/><rect x="8" y="16" width="5" height="2.5" rx="1"/></svg>',
  equipa: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/></svg>',
  galeria: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
  coment: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  lupa: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

let store, S = null; // S = estado calculado
const PLANO_PADRAO = () => ({ f: "todas", bloco: "", tipo: "", unidade: "", ativ: "", equipa: "", q: "", soAtr: false, semConc: true, sort: null, editar: false, atribuir: false, atrEq: "", selec: null });
const ui = { bloco: "todos", plano: PLANO_PADRAO(), unidadeTab: "ativ", vistoria: {}, sheet: null };
/** Há algum filtro diferente do padrão? */
function filtrosAlterados() {
  const p = ui.plano, d = PLANO_PADRAO(), g = ui.gantt;
  const planoMudou = ["bloco", "tipo", "unidade", "ativ", "equipa", "q", "soAtr", "editar", "atribuir"].some((k) => !!p[k] !== !!d[k]) || p.semConc === false || !!p.sort || (p.f || "todas") !== "todas";
  const ganttMudou = g && (g.bloco || g.unidade || g.ativ || g.abertas === false || g.ligacoes === false || g.zoom !== "semana" || (g.abertosB && g.abertosB.size) || (g.abertos && g.abertos.size) || g.sel);
  return !!(planoMudou || ganttMudou || ui.bloco !== "todos" || ui.unitEdit || ui.uSemConc === false || !!ui.porVist);
}
/** Volta todos os ecrãs aos filtros com que a aplicação abre (as vistorias por guardar mantêm-se). */
function reporFiltros() {
  ui.bloco = "todos";
  ui.plano = PLANO_PADRAO();
  ui.gantt = null;
  ui.unitEdit = false;
  ui.uSemConc = true;
  ui.porVist = false;
  ui.semana = null;
  ui.delUnit = null;
  ui.lastUnit = null;
  ui.unidadeTab = store.user && store.user.papel === "fiscal" ? "vist" : "ativ";
  window.scrollTo(0, 0);
  render();
  toast("Filtros repostos");
}

/* ---- Anular: cada alteração guardada fica num "lote" que a mensagem seguinte pode desfazer */
let loteAnular = [];
let aAnular = false;
function instalarAnular(st) {
  const upd = st.updateAtividade.bind(st), add = st.addAtividades.bind(st), cfg = st.setConfig.bind(st), rem = st.removeAtividades.bind(st);
  const prevCfg = (patch) => { const c = st.data.config || {}; const o = {}; for (const k of Object.keys(patch || {})) o[k] = c[k] === undefined ? null : JSON.parse(JSON.stringify(c[k])); return o; };
  st.updateAtividade = async (id, patch, registo) => {
    if (!aAnular) {
      const a = st.data.atividades[id] || {};
      const prev = {};
      for (const k of Object.keys(patch || {})) prev[k] = a[k] === undefined ? null : JSON.parse(JSON.stringify(a[k]));
      if (Object.keys(prev).length) loteAnular.push({ t: "upd", id, prev });
    }
    return upd(id, patch, registo);
  };
  st.addAtividades = async (lista, cfgPatch, registo) => {
    if (!aAnular) { loteAnular.push({ t: "add", ids: lista.map((a) => a.id) }); if (cfgPatch) loteAnular.push({ t: "cfg", prev: prevCfg(cfgPatch) }); }
    const antes = aAnular; aAnular = true; // o setConfig interno não entra no lote
    try { return await add(lista, cfgPatch, registo); } finally { aAnular = antes; }
  };
  st.setConfig = async (patch, registo) => {
    if (!aAnular) loteAnular.push({ t: "cfg", prev: prevCfg(patch) });
    return cfg(patch, registo);
  };
  if (st.updateMuitas) {
    const muitas = st.updateMuitas.bind(st);
    st.updateMuitas = async (lista, registo) => {
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
  const podeAnular = opts.anular !== false && lote.length > 0;
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.innerHTML = `<span>${esc(msg)}</span>${podeAnular ? `<button class="tb" data-t="anular">Anular</button>` : ""}${opts.acao ? `<button class="tb" data-t="acao">${esc(opts.acao.label)}</button>` : ""}`;
  document.body.appendChild(t);
  const tempo = setTimeout(() => t.remove(), podeAnular || opts.acao ? 8000 : 2600);
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
  const unidades = (cfg.unidades || []).map((u) => ({ ...u }));
  const uMap = Object.fromEntries(unidades.map((u) => [u.id, u]));
  for (const u of unidades) Object.assign(u, { acts: [], dur: 0, feito: 0, fim: null, atraso: null, n: { concluida: 0, em_curso: 0, bloqueada: 0, por_iniciar: 0, atrasada: 0 } });
  const tot = { n: acts.length, concluida: 0, em_curso: 0, bloqueada: 0, por_iniciar: 0, atrasada: 0, semPlano: 0, fim: null, atraso: null };
  for (const a of acts) {
    const r = res.get(a.id);
    const u = uMap[a.unidade];
    if (!u) continue;
    u.acts.push(a);
    const w = Math.max(1, r.dur);
    u.dur += w; u.feito += w * pctEfetiva(a) / 100;
    u.n[r.estado]++; tot[r.estado]++;
    if (r.atrasada) { u.n.atrasada++; tot.atrasada++; }
    if (r.semPlano && r.estado !== "concluida") tot.semPlano++;
    // fim previsto da fração e da obra: o fim provável (uma previsão já ultrapassada conta a partir de hoje)
    if (!u.fim || r.provFim > u.fim) u.fim = r.provFim;
    if (r.estado !== "concluida") { u.atraso = Math.max(u.atraso ?? 0, r.atraso || 0); tot.atraso = Math.max(tot.atraso ?? 0, r.atraso || 0); }
    if (!tot.fim || r.provFim > tot.fim) tot.fim = r.provFim;
  }
  for (const u of unidades) {
    u.pct = u.dur ? Math.round((100 * u.feito) / u.dur) : 0;
    const ord = (a) => (a.esp && espIdx[a.esp] ? espIdx[a.esp].ordem : 99);
    u.acts.sort((a, b) => ord(a) - ord(b) || (res.get(a.id).inicio || "").localeCompare(res.get(b.id).inicio || ""));
  }
  S = { cfg, res, hoje, unidades, uMap, tot, espIdx, acts: d.atividades, equipas: [] };
  // equipas: as registadas em Definições e as que aparecem nos trabalhos (vindas do Excel)
  const registadas = (cfg.equipas || []).filter((e) => e && e.nome);
  const nomesReg = new Set(registadas.map((e) => e.nome));
  const soNosTrab = [...new Set(acts.map((a) => a.equipa).filter((n) => n && !nomesReg.has(n)))].map((nome) => ({ nome, daObra: true }));
  S.eqLista = [...registadas, ...soNosTrab].sort((a, b) => a.nome.localeCompare(b.nome, "pt", { numeric: true }));
  S.equipas = S.eqLista.map((e) => e.nome);
}
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
    clearTimeout(pend);
    pend = setTimeout(() => { compute(); render(); }, ev === "data" ? 60 : 0);
  });
  compute();
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { const i = document.querySelector("#psqD input"); if (i && i.offsetParent) { e.preventDefault(); i.focus(); } else if (S) { e.preventDefault(); abrirPesquisaMovel(); } }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest || !e.target.closest(".fpick")) document.querySelectorAll(".fmenu").forEach((m) => (m.hidden = true)); });
  window.addEventListener("hashchange", () => {
    if (ui.sheet) closeSheet();
    if (ui.nova) closeNova();
    document.querySelectorAll('[data-dw="fracao"],[data-dw="equipa"]').forEach((e) => e.remove());
    render(); window.scrollTo(0, 0);
  });
  render();
  if ("serviceWorker" in navigator && cloud) navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* ============================================================ render principal */
let lastView = "";
function render() {
  const app = $("#app");
  if (store.needsLogin()) { app.innerHTML = loginHTML(); bindLogin(); lastView = "login"; return; }
  if (store.user.papel === "sem_acesso") {
    app.innerHTML = `<div class="login"><div class="login-box"><h2>Conta sem acesso</h2><p>A conta <b>${esc(store.user.email)}</b> entrou, mas ainda não tem perfil nesta obra. Peça ao dono de obra para o adicionar em Equipa.</p><button class="btn" id="sair">Sair</button></div></div>`;
    $("#sair").onclick = () => store.logout();
    return;
  }
  const view = routeView();
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
        <div class="who"><b>${esc(store.user.nome)}</b><span class="role">${PAPEL[store.user.papel]}</span></div>
        <button class="btn sm" data-ajuda>Ajuda</button>
        <button class="btn sm" data-repor title="Voltar todos os ecrãs aos filtros padrão">Repor filtros</button>
        <button class="btn sm" data-sair>Sair</button>
      </div>
    </aside>
    <header class="topbar">${brandHTML(true)}<div class="row" style="gap:4px"><div id="syncB"></div>${filtrosAlterados() ? `<button class="btn sm ghost" data-repor title="Repor filtros">Repor</button>` : ""}<button class="btn sm ghost" data-psqm aria-label="Procurar" title="Procurar">${ICON.lupa}</button><button class="btn sm ghost" data-ajuda aria-label="Ajuda" title="Ajuda">?</button><button class="btn sm ghost" data-sair>Sair</button></div></header>
    <main class="main"><div class="main-in" id="view">${view.html}</div></main>
    <nav class="tabbar">${nav.filter((n) => !n.soLado).map((n) => `<a href="#${n.id}" class="${view.nav === n.id ? "on" : ""}">${ICON[n.id]}<span>${n.short || n.label}</span></a>`).join("")}</nav>
  </div>`;
  app.querySelectorAll("[data-sair]").forEach((b) => (b.onclick = () => store.logout()));
  app.querySelectorAll("[data-repor]").forEach((b) => (b.onclick = reporFiltros));
  app.querySelectorAll("[data-ajuda]").forEach((b) => (b.onclick = () => abrirGuia(true)));
  const pd = $("#psqD"); if (pd && S) ligarPesquisa(pd);
  app.querySelectorAll("[data-psqm]").forEach((b) => (b.onclick = abrirPesquisaMovel));
  renderSync();
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
  if (b) b.innerHTML = `<span class="sync ${cls}" title="${esc(txt)}"><i></i>${esc(curto)}</span>`;
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
  if (p === "empreiteiro") return [{ id: "semana", label: "A minha semana", short: "Semana" }, items[2], items[4], items[1], items[0], { ...items[3], soLado: true }];
  if (p === "fiscal") return [items[1], items[0], items[2], items[4]];
  return [items[0], items[1], items[2], items[4], items[3]];
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
  const v = { painel: painelView, unidades: unidadesView, plano: planoView, regras: regrasView, equipa: equipaView, equipas: equipasView, gantt: ganttView, semana: semanaView, relatorio: relatorioView }[h] || painelView;
  const navDe = { equipa: "regras", equipas: "regras", relatorio: "painel" };
  return { nav: navDe[h] || (h in { painel: 1, unidades: 1, plano: 1, regras: 1, gantt: 1, semana: 1 } ? h : "painel"), ...v() };
}

/* ============================================================ login */
function loginHTML() {
  const nome = "ALTIS";
  if (store.modo === "demo") {
    return `<div class="login"><div class="login-box">
      <div class="brand"><div class="brand-mark">${nome.slice(0, 2)}</div><div><b>Controlo de obra ${nome}</b><span>Versão de demonstração</span></div></div>
      <p>Esta versão usa os dados reais do cronograma, mas guarda as alterações só neste dispositivo. Escolha um perfil para experimentar:</p>
      <div class="roles">
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
    ${dono ? `<p>Importe o cronograma extraído do Excel (${store.seed ? store.seed.atividades.length : 0} atividades, ${store.seed ? store.seed.unidades.length : 0} frações e zonas). Só é preciso fazer isto uma vez.</p>
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
    bar.innerHTML = `<b>A importação parou:</b> ${esc(e.code || e.message)}. <button class="btn sm" id="impFecha">Fechar</button>`;
    bar.querySelector("#impFecha").onclick = () => bar.remove();
    if (aoFalhar) aoFalhar();
  } finally { importando = false; render(); }
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
  for (const a of Object.values(S.acts)) {
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
  const html = `
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
    ${t.semPlano && can("executar") ? `<div class="banner warn"><span><b>${t.semPlano} atividades com datas por confirmar.</b> Não tinham data no Excel e a aplicação deu-lhes a primeira data possível, o que torna o fim previsto otimista.</span><a class="btn sm" href="#plano" data-f="porconfirmar">Rever datas</a></div>` : ""}
    <section class="card" id="semanaRes"><div class="card-h"><h2>Esta semana</h2><span class="note">últimos 7 dias</span></div><div class="note">A carregar...</div></section>
    ${heatHTML()}
    <section class="card">
      <div class="card-h"><h2>Últimas atualizações</h2></div>
      <div class="list">${rec.length ? rec.map((r) => `<div class="li"><span class="li-t">${esc(r.texto)}</span><span class="note num">${fdt(r.em)}</span>
        <span class="li-s"><span>${esc(r.nomePor || r.por)}</span><span class="role">${PAPEL[r.papel] || ""}</span>${r.unidade ? `<a class="mono" href="#u-${esc(r.unidade)}">${esc(r.unidade)}</a>` : ""}</span></div>`).join("")
        : `<div class="empty">Ainda não há registos. Quando o empreiteiro ou o fiscal atualizarem atividades, aparecem aqui.</div>`}</div>
    </section>`;
  return { html, bind: () => { bindCommon(); resumoSemana(); guardarFotoDiaria(); const bf = $("#impFalta"); if (bf) bf.onclick = () => { bf.disabled = true; importarComProgresso(true, () => { bf.disabled = false; }); }; } };
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
    <div class="heat-wrap"><table class="heat"><thead><tr><th class="corner"></th>${esp.map((e) => `<th><div title="${esc(e.nome)}">${esc(CURTO[e.key] || (e.nome.length > 16 ? e.nome.slice(0, 15) + "." : e.nome))}</div></th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
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
  const grupos = [["A", "Bloco A"], ["B", "Bloco B"], ["C", "Bloco C"], ["D", "Bloco D"], ["Geral", "Geral"]];
  const html = `
    <div class="card-h"><h1>Apartamentos</h1>
      <div class="row"><div class="chips">${["todos", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${fil === b ? "on" : ""}" data-bloco="${b}">${b === "todos" ? "Todos" : b === "Geral" ? "Geral" : "Bloco " + b}</button>`).join("")}</div>
      ${store.user.papel === "dono" ? `<button class="btn pri" id="novaFr">+ Nova fração</button>` : ""}</div></div>
    ${store.user.papel === "fiscal" ? `<div class="banner">Escolha o apartamento onde está. Lá dentro registe a percentagem de cada especialidade e tire as fotografias.</div>` : ""}
    <div class="ubar"><label class="check"><input type="checkbox" id="porVist" ${ui.porVist ? "checked" : ""}><span>Só as por vistoriar há mais de 7 dias</span></label><span class="note num">${nPrecisa} ${nPrecisa === 1 ? "fração" : "frações"} por vistoriar</span></div>
    ${grupos.filter(([g]) => fil === "todos" || fil === g).map(([g, nome]) => {
      const us = S.unidades.filter((u) => u.bloco === g && (!ui.porVist || precisaVist(u)));
      if (!us.length) return "";
      return `<section class="col" style="display:flex;flex-direction:column;gap:10px"><div class="grp">${nome}</div><div class="ucards">${us.map((u) => {
        const dv = u.atraso;
        const uv = ultimaVistoria(u);
        return `<a class="ucard" href="#u-${esc(u.id)}">
          <div class="ucard-h"><b>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" ? u.id : u.nome)}</b><span class="mono num">${u.pct}%</span></div>
          ${segHTML(u)}
          <div class="ln"><span>Fim previsto</span><span><b>${fd(u.fim)}</b> ${deltaHTML(dv)}</span></div>
          <div class="ln"><span>Última vistoria</span><span class="${!uv || uv < limite ? "vatr" : ""}"><b>${uv ? fdt(uv).split(" ").slice(0, 2).join(" ") : "nunca"}</b></span></div>
          <div class="meta">${u.n.atrasada ? `<span class="pill late">${u.n.atrasada} atrasadas</span>` : ""}${u.n.bloqueada ? `<span class="pill st-bloqueada">${u.n.bloqueada} bloqueadas</span>` : ""}${u.n.em_curso ? `<span class="pill st-em_curso">${u.n.em_curso} em curso</span>` : ""}${!u.n.atrasada && !u.n.bloqueada && !u.n.em_curso ? `<span class="pill st-${u.n.concluida === u.acts.length ? "concluida" : "por_iniciar"}">${u.n.concluida === u.acts.length ? "Tudo concluído" : "Por iniciar"}</span>` : ""}</div>
        </a>`;
      }).join("")}</div></section>`;
    }).join("")}`;
  return { html, bind: () => { bindCommon(); const nf = $("#novaFr"); if (nf) nf.onclick = openNovaFracao; const pv = $("#porVist"); if (pv) pv.onchange = () => { ui.porVist = pv.checked; render(); }; } };
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
    const pe = a.pctEmp ?? 0, pf = a.pctFiscal;
    const dica = [ESTADO[r.estado] + (r.atrasada ? ", atrasada" : ""), a.equipa, espera.length && r.estado === "bloqueada" ? "À espera de: " + espera.join(", ") : ""].filter(Boolean).join(" · ");
    return `<div class="arow linha ${edU ? "editing" : ""}" ${edU ? "" : `data-a="${a.id}"`} title="${esc(dica)}">
      <span class="dot st-${r.estado}${r.atrasada ? " atr" : ""}" aria-label="${esc(ESTADO[r.estado] + (r.atrasada ? ", atrasada" : ""))}"></span>
      <div class="nm1">${edU ? `<button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button>` : `<b>${esc(nomeAtiv(a))}</b>`}${espera.length && r.estado === "bloqueada" ? `<span class="wait1">à espera de ${esc(espera[0])}${espera.length > 1 ? " +" + (espera.length - 1) : ""}</span>` : a.equipa ? `<span class="eq1">${esc(a.equipa)}</span>` : ""}</div>
      <div class="tl" aria-hidden="true">
        <div class="fc st-${r.estado}" style="left:${pos(r.inicio)}%;width:${Math.max(0.8, pos(r.fim) - pos(r.inicio))}%"></div>
        ${S.hoje >= t0 && S.hoje <= t1 ? `<div class="today" style="left:${pos(S.hoje)}%"></div>` : ""}
      </div>
      <div class="dt1">${edU ? `${dateInput(a.id, "ini", r.estado === "concluida" ? a.realInicio || r.inicio : r.inicio)}${dateInput(a.id, "fim", r.estado === "concluida" ? a.realFim || r.fim : r.fim)}` : `<span class="mono num">${fd(r.inicio)} a ${fd(r.fim)}</span>`}</div>
      <div class="dv1">${deltaHTML(r.atraso)}</div>
      <div class="pcts" title="Empreiteiro / Fiscal"><span class="vf-slot" data-vfotos="${a.id}"></span>E <b>${Math.round(pe)}%</b> · F <b>${pf == null ? "s/v" : Math.round(pf) + "%"}</b></div>
    </div>`;
  }).join("");
  const barraConc = `<div class="ubar"><label class="check"><input type="checkbox" id="uSemConc" ${ui.uSemConc ? "checked" : ""}><span>Esconder concluídas</span></label>
    <span class="note num">${ui.uSemConc ? `${visiveis.length} por concluir · ${nConcl} concluída${nConcl === 1 ? "" : "s"} escondida${nConcl === 1 ? "" : "s"}` : `${u.acts.length} atividades`}</span>
    <span class="legend" style="margin-left:auto"><span><i class="dot st-concluida"></i>Concluída</span><span><i class="dot st-em_curso"></i>Em curso</span><span><i class="dot st-bloqueada"></i>Bloqueada</span><span><i class="dot st-por_iniciar"></i>Por iniciar</span><span><i class="dot st-por_iniciar atr"></i>Atrasada</span></span></div>`;
  const rowsVist = visiveis.map((a) => {
    const r = S.res.get(a.id);
    const v = ui.vistoria[a.id];
    const cur = v && v.pct != null ? v.pct : a.pctFiscal != null ? Math.round(a.pctFiscal) : null;
    const nf = v && v.fotos ? v.fotos.length : 0;
    const comAberto = v && (v.abrirC || (v.coment && v.coment.length));
    return `<div class="vrow">
      <div class="nm" style="display:flex;flex-direction:column;gap:3px;min-width:0"><b style="overflow-wrap:anywhere">${esc(nomeAtiv(a))}</b>
        <small class="muted">Empreiteiro diz ${Math.round(a.pctEmp ?? 0)}% · <span class="pill st-${r.estado}" style="font-size:.7rem">${ESTADO[r.estado]}</span>${a.fiscalEm ? ` · última vistoria ${fdt(a.fiscalEm)}` : ""}</small>
        ${a.fiscalNota ? `<small class="vult">Último comentário: ${esc(a.fiscalNota)}</small>` : ""}</div>
      <div class="ctl">
        <button type="button" class="btn sm ${comAberto ? "on-c" : ""}" data-vc="${a.id}" title="Escrever comentário" aria-label="Comentário">${ICON.coment}</button>
        <span class="vf-slot" data-vfotos="${a.id}"></span>
        ${fotoPickerHTML(a.id, nf)}
      </div>
      <div class="vpct">${pctCtlHTML(a.id, cur, v && v.pct != null)}</div>
      ${comAberto || nf ? `<div class="vextra">
        ${comAberto ? `<input class="inp" data-vct="${a.id}" value="${esc((v && v.coment) || "")}" placeholder="Comentário sobre ${esc(nomeAtiv(a).toLowerCase())}: o que viu, não conformidades">` : ""}
        ${pendentesHTML(a.id, v && v.fotos)}</div>` : ""}
    </div>`;
  }).join("");
  const temMud = (v) => v.pct != null || (v.fotos && v.fotos.length) || (v.coment && v.coment.trim());
  const nChg = Object.values(ui.vistoria).filter((v) => v.unidade === id && temMud(v)).length;
  const html = `
    <div class="row" style="justify-content:space-between"><div class="row" style="gap:6px"><a class="back" href="#unidades">Apartamentos</a>
      ${(() => { const vz = vizinhas(u.id); return `<span class="unav">${vz.ant ? `<a class="btn sm" href="#u-${esc(vz.ant)}" title="Fração anterior">‹ ${esc(vz.ant)}</a>` : ""}${vz.seg ? `<a class="btn sm" href="#u-${esc(vz.seg)}" title="Fração seguinte">${esc(vz.seg)} ›</a>` : ""}</span>`; })()}</div><div class="row" style="gap:6px"><a class="btn sm" href="#plano" data-verplano="${esc(u.id)}|${esc(u.bloco)}">Ver nos trabalhos</a><a class="btn sm" href="#gantt" data-vergantt="${esc(u.id)}|${esc(u.bloco)}">Ver no Gantt</a>${can("criar") ? `<button class="btn sm" data-nova="unit:${esc(u.id)}">+ Nova atividade nesta fração</button>` : ""}${store.user.papel === "dono" && !(ui.delUnit && ui.delUnit.id === u.id) ? `<button class="btn sm warn" id="delU">Eliminar fração</button>` : ""}</div></div>
    ${delUnidadeHTML(u)}
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
      <button data-tab="fotos" class="${tab === "fotos" ? "on" : ""}">Fotografias</button>
      ${can("executar") && tab !== "vist" && tab !== "fotos" ? `<button id="uEdit" class="tab-act ${edU ? "on" : ""}">${edU ? "Terminar edição" : "Editar datas"}</button>` : ""}
    </div>
    ${edU && tab === "ativ" ? `<div class="banner">Altere as datas de cada atividade. Cada alteração fica guardada logo e as atividades seguintes acertam-se sozinhas.</div>` : ""}
    ${tab === "vist" && fiscal ? `<p class="note">Escolha a percentagem que verificou em cada especialidade e tire as fotografias. No fim, guarde a vistoria de uma só vez. Funciona sem rede.</p>
      <label class="f">Nota da vistoria (opcional)<input class="inp" id="vnota" value="${esc(ui.vnota || "")}" placeholder="Ex.: humidade no teto do WC, falta silicone na base de duche"></label>
      ${barraConc}
      <div class="arows">${rowsVist || `<div class="empty">Tudo concluído nesta fração.</div>`}</div>
      <h3 style="margin-top:6px">Fotografias desta fração</h3>
      <p class="note" style="margin:0">Toque no × para apagar uma fotografia já guardada (só as suas, ou todas se for o dono de obra).</p>
      <div id="vfotos" class="photos"><div class="note">A carregar fotografias...</div></div>
      <div class="vbar"><span id="vcnt">${nChg ? `${nChg} especialidade${nChg > 1 ? "s" : ""} por guardar` : "Sem alterações"}</span>
        <button class="btn pri" id="vsave" ${nChg ? "" : "disabled"}>Guardar vistoria</button></div>`
      : tab === "fotos" ? `<div id="fotos" class="photos"><div class="note">A carregar fotografias...</div></div>`
      : `${barraConc}<div class="arows">${rowsAtiv || `<div class="empty">${u.acts.length ? "Tudo concluído nesta fração. Desligue \"Esconder concluídas\" para ver o histórico." : "Sem atividades."}</div>`}</div>
         <p class="note">Barra: previsão. Traço vermelho: hoje. E e F: percentagem declarada pelo empreiteiro e verificada pelo fiscal. Passe o rato por cima de uma linha para ver o detalhe.</p>`}`;
  if (tab === "vist" && !fiscal) ui.unidadeTab = "ativ";
  return { html, bind: () => bindUnidade(u) };
}
function bindUnidade(u) {
  bindCommon();
  bindDelUnidade(u);
  const ue = $("#uEdit"); if (ue) ue.onclick = () => { ui.unitEdit = !ui.unitEdit; render(); };
  const usc = $("#uSemConc"); if (usc) usc.onchange = () => { ui.uSemConc = usc.checked; render(); };
  bindDateInputs(document.querySelector("#view") || document);
  document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { ui.unidadeTab = b.dataset.tab; render(); }));
  bindPctCtl(document.querySelector("#view") || document,
    (id) => { const v = ui.vistoria[id], a = S.acts[id]; return v && v.pct != null ? v.pct : a.pctFiscal != null ? Math.round(a.pctFiscal) : Math.round(a.pctEmp ?? 0); },
    (id, val) => { ui.vistoria[id] = { ...(ui.vistoria[id] || { unidade: u.id }), unidade: u.id, pct: val }; render(); });
  const vist = (id) => (ui.vistoria[id] = { ...(ui.vistoria[id] || { unidade: u.id }), unidade: u.id });
  const view = document.querySelector("#view");
  if (ui.unidadeTab === "vist" && view) {
    bindFotoPickers(view, (id, fotos) => { const v = vist(id); v.fotos = (v.fotos || []).concat(fotos); render(); });
    view.querySelectorAll("[data-prm]").forEach((b) => (b.onclick = () => { const [id, i] = b.dataset.prm.split("|"); ui.vistoria[id].fotos.splice(+i, 1); render(); }));
    view.querySelectorAll("[data-vc]").forEach((b) => (b.onclick = () => { const v = vist(b.dataset.vc); v.abrirC = !v.abrirC || !!(v.coment && v.coment.length); render(); const i = view.querySelector(`[data-vct="${b.dataset.vc}"]`); if (i) i.focus(); }));
    const contar = () => {
      const n = Object.values(ui.vistoria).filter((v) => v.unidade === u.id && (v.pct != null || (v.fotos && v.fotos.length) || (v.coment && v.coment.trim()))).length;
      const c = $("#vcnt"), sb = $("#vsave");
      if (c) c.textContent = n ? `${n} especialidade${n > 1 ? "s" : ""} por guardar` : "Sem alterações";
      if (sb) sb.disabled = !n;
    };
    view.querySelectorAll("[data-vct]").forEach((i) => (i.oninput = () => { vist(i.dataset.vct).coment = i.value; contar(); }));
    loadFotos(u.id, $("#vfotos"));
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
      const partes = [v.pct != null ? `${v.pct}% (empreiteiro dizia ${Math.round(a.pctEmp ?? 0)}%)` : "", nf ? `${nf} fotografia${nf > 1 ? "s" : ""}` : "", texto ? "comentário: " + texto : ""].filter(Boolean);
      await store.updateAtividade(id, patch, { tipo: "vistoria", texto: `Vistoria ${nomeAtiv(a)} em ${a.unidade}: ${partes.join(", ")}` });
      delete ui.vistoria[id]; n++;
    }
    ui.vnota = "";
    const seg = vizinhas(u.id).seg;
    toast(`Vistoria guardada (${n} especialidade${n > 1 ? "s" : ""})`, seg ? { acao: { label: `Seguinte: ${seg}`, fn: () => (location.hash = "#u-" + seg) } } : {});
    render();
  };
  if (ui.unidadeTab === "fotos") loadFotos(u.id, $("#fotos"));
  botoesFotosLinhas(u.id, document.querySelector("#view") || document);
}
/* ============================================================ percentagem com botões grandes */
function pctCtlHTML(key, val, mudou) {
  return `<div class="pctc ${mudou ? "mudou" : ""}" role="group" aria-label="Percentagem verificada">
    ${[0, 25, 50, 75, 100].map((p) => `<button type="button" class="pb ${val === p ? "on" : ""}" data-pv="${key}|${p}">${p}</button>`).join("")}
    <span class="psep"></span>
    <button type="button" class="pb pm" data-pv="${key}|-5" aria-label="Menos 5 por cento">−</button>
    <span class="pval num">${val == null ? "s/v" : val + "%"}</span>
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
  if (!fotos.length) { el.innerHTML = `<div class="empty" style="grid-column:1/-1">Ainda sem fotografias${ativ ? " desta atividade" : " nesta fração"}.</div>`; return; }
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
    } catch (err) { toast("Não foi possível apagar: " + (err.code || err.message)); b.disabled = false; }
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
      } catch (err) { toast("Não foi possível apagar: " + (err.code || err.message)); }
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
  const q = p.q.trim().toLowerCase();
  // filtros de "onde" e "o quê" (os estados contam-se sobre este conjunto)
  const base = Object.values(S.acts).map((a) => ({ a, r: S.res.get(a.id) })).filter(({ a, r }) => {
    const u = S.uMap[a.unidade];
    if (!u) return false;
    if (p.bloco && u.bloco !== p.bloco) return false;
    if (p.tipo && u.tipo !== p.tipo) return false;
    if (p.unidade && a.unidade !== p.unidade) return false;
    if (p.ativ && nomeAtiv(a) !== p.ativ) return false;
    if (p.equipa === "_sem" ? !!a.equipa : p.equipa && a.equipa !== p.equipa) return false;
    if (p.soAtr && !r.atrasada) return false;
    if (esconde && concluida(a, r)) return false;
    if (q && !(nomeAtiv(a) + " " + a.unidade + " " + a.ref + " " + (a.equipa || "")).toLowerCase().includes(q)) return false;
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
  const linha = ({ a, r }) => {
    const espera = r.estado === "bloqueada" ? [...new Set(r.bloqueadaPor.map((id) => S.acts[id]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))] : [];
    const ini = r.inicio, fim = r.fim;
    const cIni = ed ? dIn(a.id, "ini", ini) : `<span class="mono num">${fd(ini)}</span>`;
    const cFim = ed ? dIn(a.id, "fim", fim) : `<span class="mono num">${fd(fim)}</span>`;
    const ck = atr ? `<td class="ck"><input type="checkbox" data-ck="${a.id}" ${p.selec.has(a.id) ? "checked" : ""} aria-label="Escolher ${esc(nomeAtiv(a) + " " + a.unidade)}"></td>` : "";
    return `<tr ${ed ? "" : atr ? `data-tck="${a.id}" class="${p.selec.has(a.id) ? "sel" : ""}"` : `data-a="${a.id}"`}>${ck}<td class="mono">${esc(a.unidade)}</td>
      <td>${ed ? `<button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button>` : `<b>${esc(nomeAtiv(a))}</b>`}${a.equipa ? `<div class="note">${esc(a.equipa)}</div>` : atr ? `<div class="note semeq">sem equipa</div>` : ""}${espera.length ? `<div class="wait">À espera de: ${esc(espera.slice(0, 2).join(", "))}${espera.length > 2 ? "..." : ""}</div>` : ""}</td>
      <td><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span></td><td>${cIni}</td><td>${cFim}</td><td>${p.f === "porconfirmar" && can("executar") ? `<button class="btn sm" data-conf="${a.id}" title="A data mostrada está certa">Confirmar</button>` : deltaHTML(r.atraso)}</td><td class="mono num">${Math.round(pctEfetiva(a))}%</td></tr>`;
  };
  const html = `
    <div class="card-h"><h1>Trabalhos</h1><div class="row">
      ${can("executar") ? `<button class="btn ${atr ? "warn" : ""}" id="pAtr">${atr ? "Terminar atribuição" : "Atribuir equipa"}</button>` : ""}
      ${can("executar") ? `<button class="btn ${ed ? "warn" : ""}" id="pEdit">${ed ? "Terminar edição" : "Editar datas"}</button>` : ""}
      ${can("criar") ? `<button class="btn pri" data-nova="">+ Nova atividade</button>` : ""}</div></div>
    ${ed ? `<div class="banner">Altere as datas diretamente na tabela. Cada alteração fica guardada logo e as atividades que dependem desta acertam-se sozinhas.
      Nas atividades por iniciar muda a previsão; nas iniciadas ou concluídas, corrige a data real.</div>`
      : papel === "empreiteiro" && !atr ? `<div class="banner">Toque numa atividade para a iniciar, atualizar a percentagem ou concluir. Para mudar várias datas, use Editar datas.</div>` : ""}
    <div class="chips" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${p.bloco === b ? "on" : ""}" data-pb="${b}">${b === "Geral" ? "Geral" : b ? "Bloco " + b : "Todos os blocos"}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Estado">${ESTADOS.map(([k, l]) => `<button class="chip ${p.f === k ? "on" : ""}" data-pf="${k}">${l} <span class="num" style="opacity:.65">${conta[k]}</span></button>`).join("")}</div>
    <div class="filters">
      <label class="f">Frações<select class="inp" id="pt">${TIPOS.map(([k, l]) => `<option value="${k}" ${p.tipo === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Apartamento ou fração<select class="inp" id="pu"><option value="">Todas${p.bloco === "Geral" ? " do geral" : p.bloco ? " do bloco " + p.bloco : ""}</option>${["A", "B", "C", "D", "Geral"].map((g) => {
        const us = unidadesFil.filter((u) => u.bloco === g);
        return us.length ? `<optgroup label="${g === "Geral" ? "Geral" : "Bloco " + g}">${us.map((u) => `<option value="${esc(u.id)}" ${p.unidade === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</optgroup>` : "";
      }).join("")}</select></label>
      <label class="f">Atividade<select class="inp" id="pa"><option value="">Todas</option>${nomes.map((n) => `<option ${p.ativ === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="f">Equipa<select class="inp" id="pe"><option value="">Todas</option><option value="_sem" ${p.equipa === "_sem" ? "selected" : ""}>Sem equipa</option>${S.equipas.map((e) => `<option ${p.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></label>
      <label class="f" style="flex:1;min-width:180px">Procurar<input class="inp" id="pq" value="${esc(p.q)}" placeholder="Ex.: B-F503, louças, 2#10"></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="psa" ${p.soAtr ? "checked" : ""}><span>Só atrasadas</span></label>
      <label class="check" style="align-self:center" title="${p.f === "concluida" ? "Não se aplica ao ver as concluídas" : "Esconde as atividades 100% concluídas"}"><input type="checkbox" id="psc" ${p.semConc ? "checked" : ""} ${p.f === "concluida" ? "disabled" : ""}><span>Esconder concluídas</span></label>
      ${filtrosAlterados() ? `<button class="btn sm" id="pclr" style="align-self:center">Repor filtros</button>` : ""}
    </div>
    ${p.f === "porconfirmar" ? `<div class="banner warn"><span>Estas atividades nunca tiveram data no Excel. A aplicação deu-lhes a primeira data possível: hoje, ou logo a seguir às anteriores. Corra a lista e, em cada uma, corrija a data (com Editar datas) ou confirme que está certa. Ao mudar uma data, a atividade sai desta lista.</span>${can("executar") && shown.length ? `<button class="btn sm" id="confTodas">Confirmar as ${shown.length} mostradas</button>` : ""}</div>` : ""}
    ${atr ? `<div class="atrbar" id="atrbar">
      <span class="num"><b>${p.selec.size}</b> escolhida${p.selec.size === 1 ? "" : "s"}</span>
      <button class="btn sm" id="atrTodas">Escolher as ${shown.length} da lista</button>${p.selec.size ? `<button class="btn sm ghost" id="atrLimpa">Limpar escolha</button>` : ""}
      <label class="f">Equipa<select class="inp" id="atrEq"><option value="">Escolha...</option>${S.equipas.map((e) => `<option ${p.atrEq === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_sem">Retirar a equipa</option><option value="_nova">+ Nova equipa...</option></select></label>
      <button class="btn pri" id="atrOk" ${p.selec.size ? "" : "disabled"}>Atribuir</button>
      <span class="note">Use os filtros (por exemplo Atividade e Equipa "Sem equipa") para chegar aos trabalhos certos, escolha-os e atribua.</span></div>` : ""}
    <div class="note num">${list.length} atividade${list.length === 1 ? "" : "s"}${esconde ? ` · concluídas escondidas <button class="btn sm ghost" id="pmostra" style="min-height:24px;padding:0 6px;text-decoration:underline">mostrar</button>` : ""}</div>
    ${shown.length ? `<div class="tbl-wrap"><table class="tbl ${ed ? "editing" : ""}"><thead><tr>${atr ? `<th class="ck"><input type="checkbox" id="atrCkAll" ${shown.length && shown.every(({ a }) => p.selec.has(a.id)) ? "checked" : ""} aria-label="Escolher todas"></th>` : ""}${[["unidade", "Fração"], ["atividade", "Atividade"], ["estado", "Estado"], ["inicio", ed ? "Início" : "Início previsto"], ["fim", ed ? "Fim" : "Fim previsto"], ["desvio", "Atraso"], ["pct", "%"]].map(([k, l]) => {
      const on = p.sort && p.sort.col === k;
      return `<th aria-sort="${on ? (p.sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button class="th-sort ${on ? "on" : ""}" data-sort="${k}" title="Ordenar por ${l.toLowerCase()}">${l}<span class="arr">${on ? (p.sort.dir === "desc" ? "▼" : "▲") : "↕"}</span></button></th>`;
    }).join("")}</tr></thead><tbody>
    ${shown.map(linha).join("")}</tbody></table></div>${list.length > MAX ? `<p class="note">A mostrar ${MAX} de ${list.length}. Use os filtros para afinar.</p>` : ""}`
    : `<div class="empty">${atr && p.equipa === "_sem" ? "Não há trabalhos sem equipa com estes filtros. Para mudar a equipa de trabalhos que já têm uma, ponha o filtro Equipa em Todas." : "Nenhuma atividade com estes filtros."}</div>`}`;
  return {
    html, bind: () => {
      bindCommon();
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
          const ids = [...p.selec].filter((id) => S.acts[id]);
          await atribuirEquipa(ids, v === "_sem" ? null : v);
          p.selec = new Set();
        };
      }
      let tm; $("#pq").oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { p.q = e.target.value; render(); const i = $("#pq"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); };
      bindDateInputs(document);
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
function bindDateInputs(root) {
  root.querySelectorAll("[data-ed]").forEach((inp) => (inp.onchange = () => {
    const [id, campo] = inp.dataset.ed.split("|");
    if (inp.dataset.gravado === inp.value) return; // o mesmo valor não é gravado duas vezes
    inp.dataset.gravado = inp.value;
    inp.blur();
    editarData(id, campo, inp.value);
  }));
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
async function decidirSeguintes(id, patch) {
  const a = S.acts[id];
  const abertas = [...downstream(id, S.res)].filter((sid) => { const x = S.acts[sid], xr = S.res.get(sid); return x && xr && xr.estado !== "concluida" && !x.realInicio; });
  if (!abertas.length) return null;
  const simul = schedule(Object.values(S.acts).map((x) => (x.id === id ? { ...x, ...patch } : x)), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {});
  // o que conta para as seguintes é o fim provável (uma previsão já ultrapassada conta a partir de hoje)
  const delta = diffDays(S.res.get(id).provFim, simul.get(id).provFim);
  if (!delta) return null;
  const mexem = abertas.filter((sid) => simul.get(sid).prevIni !== S.res.get(sid).prevIni).length;
  const n = abertas.length, dias = Math.abs(delta), um = n === 1;
  const lista = abertas.slice(0, 4).map((sid) => `<li>${rotuloAt(S.acts[sid], a)} <span class="note">começa ${fd(S.res.get(sid).prevIni)}</span></li>`).join("") + (n > 4 ? `<li class="note">e mais ${n - 4}</li>` : "");
  const frente = delta > 0;
  const k = await perguntar({
    titulo: frente ? `O fim passa ${dias} dia${dias === 1 ? "" : "s"} para a frente` : `O fim passa ${dias} dia${dias === 1 ? "" : "s"} para trás`,
    texto: `<p>Há ${um ? "1 atividade seguinte" : n + " atividades seguintes"} por iniciar que ${um ? "depende" : "dependem"} desta:</p><ul class="dlg-l">${lista}</ul>
      <p class="note">${frente ? (mexem === n ? "Se não escolher andar todas, cada uma anda só o necessário para não começar antes de esta acabar." : mexem ? `Se não escolher andar todas, só ${mexem === 1 ? "1 anda" : mexem + " andam"} para a frente (as que ficariam a começar antes de esta acabar); as outras ficam nas datas que têm.` : "Nenhuma fica em conflito: se não escolher andar todas, ficam nas datas que têm.")
        : "Se não as puxar, ficam nas datas que têm e passa a haver folga entre esta e as seguintes."}</p>`,
    opcoes: [
      { k: "todas", l: frente ? `Andar todas ${dias} dia${dias === 1 ? "" : "s"} para a frente` : `Puxar todas ${dias} dia${dias === 1 ? "" : "s"} para trás`, estilo: "pri" },
      { k: "so", l: frente ? "Só as que ficam em conflito" : "Deixar as seguintes onde estão" },
    ],
  });
  if (k !== "todas") return null;
  return { delta, lista: abertas.map((sid) => { const xr = S.res.get(sid); return { id: sid, patch: { inicioPrevisto: addDays(xr.prevIni, delta), fimPrevisto: addDays(xr.prevFim, delta), duracaoManual: null, dataOk: true } }; }) };
}
/** Grava a alteração desta atividade e, se for o caso, das seguintes; um único Anular desfaz tudo. */
async function gravarComSeguintes(id, patch, registo, _delta, msg) {
  const dec = await decidirSeguintes(id, patch);
  await store.updateAtividade(id, patch, registo);
  const seg = dec && dec.lista, delta = dec && dec.delta;
  if (seg && seg.length) {
    await store.updateMuitas(seg, { tipo: "previsao", texto: `${seg.length} atividades seguintes de ${nomeAtiv(S.acts[id])} em ${S.acts[id].unidade} movidas ${delta > 0 ? "+" : ""}${delta} dias` });
    return toast(`${msg}. ${seg.length} atividade${seg.length > 1 ? "s seguintes movidas" : " seguinte movida"} ${delta > 0 ? "+" : ""}${delta} dias`);
  }
  toast(msg);
}

/** Grava uma data editada em qualquer ecrã, com avisos quando há conflito com as anteriores ou efeito nas seguintes. */
async function editarData(id, campo, v) {
  const a = S.acts[id], r = S.res.get(id);
  if (!a || !r) return;
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
      await store.updateAtividade(id, { realInicio: null }, { tipo: "correcao", texto: `Anulou o início de ${N}` });
      return toast("Início real apagado: volta a estar por iniciar");
    }
    if (v > S.hoje) return falha("O início real não pode ser no futuro.");
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
    await store.updateAtividade(id, { realInicio: v, pctEmp: Math.max(Number(a.pctEmp) || 0, 5), empEm: new Date().toISOString() }, { tipo: a.realInicio ? "correcao" : "inicio", texto: a.realInicio ? `Corrigiu o início real de ${N} para ${fd(v)}` : `${N} iniciada a ${fd(v)}` });
    return toast(a.realInicio ? "Início real corrigido" : `Marcada como iniciada a ${fd(v)}`);
  }
  if (campo === "realFim") {
    if (!v) {
      if (!conc) return;
      await store.updateAtividade(id, { realFim: null, concluido: false, pctEmp: Math.min(Number(a.pctEmp) || 0, 90), empEm: new Date().toISOString() }, { tipo: "reabrir", texto: `Reabriu ${N}` });
      return toast("Fim real apagado: a atividade volta a estar em curso");
    }
    if (v > S.hoje) return falha("O fim real não pode ser no futuro. Para uma data futura use a previsão.");
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
    const patch = { inicioPrevisto: dia, dataOk: true, fimPrevisto: null, duracaoManual: Math.max(0, diffDays(r.prevIni, r.prevFim)) }; // a previsão anda inteira
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
  const w = (ui.semana = ui.semana || { equipa: "", bloco: "" });
  const hoje = S.hoje, lim = addDays(hoje, 7);
  const base = Object.values(S.acts).map((a) => ({ a, r: S.res.get(a.id) })).filter(({ a }) => {
    const u = S.uMap[a.unidade];
    if (!u) return false;
    if (w.bloco && u.bloco !== w.bloco) return false;
    if (w.equipa === "_sem" ? a.equipa : w.equipa && a.equipa !== w.equipa) return false;
    return true;
  });
  const emCurso = base.filter(({ r }) => r.estado === "em_curso").sort((x, y) => x.r.fim.localeCompare(y.r.fim));
  const comecar = base.filter(({ r }) => r.estado === "por_iniciar" && r.inicio <= lim).sort((x, y) => x.r.inicio.localeCompare(y.r.inicio) || x.a.unidade.localeCompare(y.a.unidade));
  const espera = base.filter(({ r }) => r.estado === "bloqueada" && r.inicio <= addDays(lim, 7)).sort((x, y) => x.r.inicio.localeCompare(y.r.inicio));
  const acabar = emCurso.filter(({ r }) => r.fim <= lim).length;
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
        : tipo === "comecar" ? `<button class="btn sm pri" data-q="ini|${a.id}">Iniciar</button>` : `<button class="btn sm" data-a="${a.id}">Ver</button>`}</div>
    </div>`;
  };
  const secao = (titulo, sub, lista, tipo, filtro) => `<section class="card">
    <div class="card-h"><h2>${titulo} <span class="note num">${lista.length}</span></h2>${sub ? `<span class="note">${sub}</span>` : ""}</div>
    ${lista.length ? `<div class="srows">${lista.slice(0, MAX).map((x) => linha(x, tipo)).join("")}</div>${lista.length > MAX ? `<a class="note" href="#plano" data-semver="${filtro}">Ver as ${lista.length} nos Trabalhos</a>` : ""}`
      : `<div class="empty">Nada nesta lista${w.equipa || w.bloco ? " com estes filtros" : ""}.</div>`}
  </section>`;
  const html = `
    <div class="card-h"><h1>A minha semana</h1><span class="note">De hoje, ${fd(hoje)}, a ${fd(lim)}</span></div>
    <div class="kpis kpis3">
      <div class="kpi k-curso"><b>${emCurso.length}</b><span>Em curso, ${acabar} acabam esta semana</span></div>
      <div class="kpi k-ok"><b>${comecar.length}</b><span>Para começar até ${fd(lim)}</span></div>
      <div class="kpi k-bloq"><b>${espera.length}</b><span>À espera de outras atividades</span></div>
    </div>
    <div class="chips" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${w.bloco === b ? "on" : ""}" data-sb="${b}">${b === "Geral" ? "Geral" : b ? "Bloco " + b : "Todos os blocos"}</button>`).join("")}</div>
    <div class="filters"><label class="f">Equipa<select class="inp" id="sEq"><option value="">Todas as equipas</option>${S.equipas.map((e) => `<option ${w.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_sem" ${w.equipa === "_sem" ? "selected" : ""}>Sem equipa atribuída</option></select></label></div>
    ${secao("Em curso", "Atualize a percentagem ou conclua", emCurso, "curso", "em_curso")}
    ${secao("Para começar", `Até ${fd(lim)}, já com as anteriores concluídas`, comecar, "comecar", "proximas")}
    ${secao("À espera de outras", "Ainda não podem começar: falta acabar o que está indicado", espera, "espera", "bloqueada")}`;
  return {
    html, bind: () => {
      bindCommon();
      document.querySelectorAll("[data-sb]").forEach((b) => (b.onclick = () => { w.bloco = b.dataset.sb; render(); }));
      $("#sEq").onchange = (e) => { w.equipa = e.target.value; render(); };
      document.querySelectorAll("[data-semver]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, PLANO_PADRAO(), { f: b.dataset.semver, bloco: w.bloco, equipa: w.equipa === "_sem" ? "" : w.equipa }); }));
      document.querySelectorAll("[data-q]").forEach((b) => (b.onclick = async () => {
        const [acao, id] = b.dataset.q.split("|");
        const a = S.acts[id]; const N = nomeAtiv(a) + " em " + a.unidade;
        const agora = new Date().toISOString(), pct = Math.round(a.pctEmp ?? 0);
        b.disabled = true;
        if (acao === "ini") await editarData(id, "realIni", S.hoje);
        else if (acao === "mais") { const v = Math.min(95, pct + 10); await store.updateAtividade(id, { pctEmp: v, empEm: agora, ...(a.realInicio ? {} : { realInicio: S.hoje }) }, { tipo: "progresso", texto: `${N}: ${v}% feito (empreiteiro)` }); toast(`${N}: ${v}%`); }
        else if (acao === "fim") { await store.updateAtividade(id, { realFim: S.hoje, realInicio: a.realInicio || S.hoje, concluido: true, pctEmp: 100, empEm: agora }, { tipo: "conclusao", texto: `Concluiu ${N}` }); toast(`Concluída: ${N}`); }
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
  for (const a of Object.values(S.acts)) {
    const r = S.res.get(a.id);
    if (r.estado === "concluida" || !(r.atraso > 0)) continue;
    const g = (grupos[nomeAtiv(a)] = grupos[nomeAtiv(a)] || { nome: nomeAtiv(a), max: 0, n: 0, us: [] });
    g.max = Math.max(g.max, r.atraso); g.n++; g.us.push(a.unidade);
  }
  const atrG = Object.values(grupos).sort((x, y) => y.max - x.max).slice(0, 12);
  const comentarios = Object.values(S.acts).filter((a) => a.fiscalNota && a.fiscalNotaEm).sort((x, y) => y.fiscalNotaEm.localeCompare(x.fiscalNotaEm)).slice(0, 15);
  const fr = S.unidades.filter((u) => u.acts.length);
  const html = `
    <div class="rel-acoes no-print"><a class="back" href="#painel">Painel</a>
      <div class="row"><button class="btn pri" id="rPrint">Imprimir ou guardar em PDF</button><button class="btn" id="rCsv">Descarregar para Excel</button></div></div>
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
      ${atrG.map((g) => `<tr><td>${esc(g.nome)}</td><td class="num">${g.n}</td><td class="num">${g.max} dias</td><td class="mono small">${esc(g.us.slice(0, 8).join(", "))}${g.us.length > 8 ? " ..." : ""}</td></tr>`).join("")}</tbody></table>` : `<p>Sem atividades atrasadas.</p>`}
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
  toast("Ficheiro para Excel descarregado", { anular: false });
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
    <div class="card-h"><h1>Gantt</h1><div class="row"><button class="btn sm" id="gHoje" title="Mostrar o dia de hoje">Hoje</button>
      <div class="chips" role="group" aria-label="Escala">${[["dia", "Dias"], ["semana", "Semanas"], ["mes", "Meses"]].map(([k, l]) => `<button class="chip ${g.zoom === k ? "on" : ""}" data-gz="${k}">${l}</button>`).join("")}</div></div></div>
    <div class="chips" role="group" aria-label="Bloco">${["", ...blocos].map((b) => `<button class="chip ${g.bloco === b ? "on" : ""}" data-gb="${b}">${b ? (b === "Geral" ? "Geral" : "Bloco " + b) : "Todos os blocos"}</button>`).join("")}</div>
    <div class="filters">
      <label class="f">Apartamento ou fração<select class="inp" id="gu"><option value="">Todas${g.bloco ? " do " + (g.bloco === "Geral" ? "geral" : "bloco " + g.bloco) : ""}</option>${us.map((u) => `<option value="${esc(u.id)}" ${g.unidade === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</select></label>
      <label class="f">Atividade<select class="inp" id="ga"><option value="">Todas</option>${nomes.map((n) => `<option ${g.ativ === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="gc" ${g.abertas ? "checked" : ""}><span>Esconder concluídas</span></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="gl" ${g.ligacoes ? "checked" : ""}><span>Mostrar ligações</span></label>
      <div class="row" style="align-self:center;gap:6px" role="group" aria-label="Nível de detalhe"><span class="note">Mostrar:</span><button class="btn sm" id="gnB">Blocos</button><button class="btn sm" id="gnU">Frações</button><button class="btn sm" id="gnA">Tudo</button></div>
      ${filtrosAlterados() ? `<button class="btn sm" id="grep" style="align-self:center">Repor filtros</button>` : ""}
    </div>
    <div class="gsel" id="gsel" hidden></div>
    <div class="legend"><span><i class="gl-bar st-concluida"></i>Concluída</span><span><i class="gl-bar st-em_curso"></i>Em curso</span><span><i class="gl-bar st-bloqueada"></i>Bloqueada</span><span><i class="gl-bar st-por_iniciar"></i>Por iniciar</span><span><i class="gl-bar st-por_iniciar atr"></i>Atrasada</span><span title="Dias desde a previsão de fim até hoje, ou até ao fim provável"><i class="gl-bar gl-tail"></i>Atraso</span><span><i class="gl-today"></i>Hoje</span><span class="note">Toque numa barra para ver a cadeia de dependências.${can("executar") ? " Com o rato, arraste a barra para mudar a data ou puxe a ponta direita para mudar o fim." : ""}</span></div>
    <div class="gantt" id="gantt"></div>`;
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
  $("#gnB").onclick = () => { g.abertosB.clear(); g.abertos.clear(); g.unidade = ""; render(); };
  $("#gnU").onclick = () => { todosB().forEach((b) => g.abertosB.add(b)); g.abertos.clear(); render(); };
  $("#gnA").onclick = () => { todosB().forEach((b) => g.abertosB.add(b)); S.unidades.forEach((u) => g.abertos.add(u.id)); render(); };
  drawGantt();
}
function drawGantt() {
  const g = ui.gantt, box = $("#gantt");
  if (!box) return;
  const H = 30, LW = window.innerWidth < 640 ? 132 : 250, HEAD = 46;
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
      const acts = u.acts.filter((a) => (!g.ativ || nomeAtiv(a) === g.ativ) && (!g.abertas || S.res.get(a.id).estado !== "concluida"));
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
  if (!rows.length) { box.innerHTML = `<div class="empty">Nenhuma atividade com estes filtros.</div>`; $("#gsel").hidden = true; return; }
  // escala
  let t0 = null, t1 = null;
  for (const x of rows) {
    const ds = x.t !== "a" ? [x.ini, x.fim] : [x.r.inicio, x.r.fim];
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
    return `<div class="grow ga${cls(a.id)}" style="top:${y}px">
      <button class="glab" data-gopen="${a.id}" title="Abrir ficha"><span class="gname">${esc(nomeAtiv(a))}</span></button>
      ${plan}<button class="gbar st-${r.estado}${r.atrasada ? " atr" : ""}" data-gs="${a.id}" style="left:${left}px;width:${w}px" title="${esc(nomeAtiv(a) + " · " + a.unidade + " · " + fd(r.inicio) + " a " + fd(r.fim) + (pct ? " · " + pct + "%" : ""))}">${r.estado === "em_curso" && pct ? `<i style="width:${pct}%"></i>` : ""}${g.zoom !== "mes" && w > 46 ? `<span>${fd(r.fim)}</span>` : ""}</button></div>`;
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
        const naCadeia = temSel && (d.id === g.sel || up.has(d.id)) && (x.a.id === g.sel || up.has(x.a.id) || down.has(x.a.id)) || (temSel && (d.id === g.sel || down.has(d.id)) && down.has(x.a.id));
        if (muitas && !naCadeia) continue;
        const pr = S.res.get(d.id);
        const xa = (d.tipo === "SS" ? X(pr.inicio) : X(pr.fim)), ya = i1 * H + H / 2;
        const xb = X(x.r.inicio), yb = i2 * H + H / 2;
        let path;
        if (xb - xa >= 12) path = `M${xa} ${ya}H${xa + 6}V${yb}H${xb - 2}`;
        else path = `M${xa} ${ya}H${xa + 6}V${yb - H / 2 * Math.sign(yb - ya || 1)}H${xb - 8}V${yb}H${xb - 2}`;
        arrows += `<path d="${path}" class="${naCadeia ? "on" : temSel ? "dim" : ""}" marker-end="url(#${naCadeia ? "ahOn" : "ah"})"/>`;
      }
    }
  }
  box.style.setProperty("--lw", LW + "px");
  box.innerHTML = `<div class="gin" style="width:${LW + W}px;height:${HEAD + rows.length * H}px">
    <div class="ghead" style="width:${LW + W}px"><div class="gcorner">${rows.filter((x) => x.t === "b").length} bloco${rows.filter((x) => x.t === "b").length === 1 ? "" : "s"} · ${rows.filter((x) => x.t === "b").reduce((s, x) => s + x.n, 0)} atividades</div><div class="gscale" style="left:${LW}px;width:${W}px">${head}${ticks}</div></div>
    <div class="gbody" style="top:${HEAD}px;height:${rows.length * H}px">
      <div class="gtoday" style="left:${LW + tx}px"></div>
      ${body}
      <svg class="garrows" style="left:${LW}px" width="${W}" height="${rows.length * H}" viewBox="0 0 ${W} ${rows.length * H}" aria-hidden="true">
        <defs><marker id="ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" class="ahf"/></marker>
        <marker id="ahOn" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" class="ahf on"/></marker></defs>
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
        <button class="btn sm pri" data-a="${a.id}">Abrir ficha</button><button class="btn sm" id="gunsel">Limpar seleção</button></div>`;
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
        if (d.modo === "mover") editarData(id, "ini", addDays(r.estado === "concluida" ? S.acts[id].realInicio || r.inicio : r.inicio, d.dd));
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
  const chave = [g.bloco, g.unidade, g.ativ, g.zoom, g.abertas].join("|");
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

/* ============================================================ guia de primeira utilização */
const GUIA = {
  dono: [
    ["O ponto de situação", "No Painel vê o fim previsto da obra, quantas atividades estão atrasadas ou bloqueadas, o avanço de cada bloco e o mapa dos apartamentos. Toque num número para ver a lista correspondente."],
    ["Trabalhos e Gantt", "Em Trabalhos estão todas as atividades, com filtros por bloco, apartamento e estado. Mude datas com Editar datas, ou arrastando as barras no Gantt. As atividades que dependem dessa acertam-se sozinhas."],
    ["Definições", "Em Definições escolhe a sequência entre especialidades e os dias de cada uma, gere as equipas de trabalho e, em Acessos, cria as contas do empreiteiro e do fiscal. Depois de cada alteração aparece Anular em baixo, para desfazer um engano."],
  ],
  empreiteiro: [
    ["A minha semana", "Ao entrar vê o que está em curso, o que deve começar nos próximos 7 dias e o que está à espera de outras atividades. Filtre pela sua equipa ou pelo bloco. Os botões Iniciar, +10% e Concluir gravam logo."],
    ["Mais detalhe", "Toque no nome de uma atividade para abrir a ficha: datas, equipa, motivo de atraso, ligações a outras atividades, fotografias e histórico. Em Trabalhos e no Gantt vê a obra toda."],
    ["As suas equipas", "Em Definições, Equipas de trabalho, crie e edite as equipas. Em Trabalhos, com Atribuir equipa, escolha vários trabalhos e atribua-os de uma vez."],
    ["Enganou-se? Sem rede?", "Depois de guardar aparece Anular em baixo, durante alguns segundos. A aplicação funciona sem rede: guarda tudo no telemóvel e envia quando houver ligação."],
  ],
  fiscal: [
    ["Escolha o apartamento", "Em Apartamentos escolha onde está. Os que não vê há mais de 7 dias aparecem marcados e pode filtrá-los."],
    ["Faça a vistoria", "Em cada especialidade toque na percentagem que verificou, escreva um comentário e junte fotografias, da câmara ou da galeria. O botão com o número mostra as fotografias já guardadas."],
    ["Guarde e siga", "Guarde a vistoria de uma vez e passe ao apartamento seguinte. Funciona sem rede e envia quando houver ligação. Se se enganar, toque em Anular."],
  ],
};
function abrirGuia(forcar) {
  const papel = store.user && store.user.papel;
  const passos = GUIA[papel];
  if (!passos || document.querySelector(".guia")) return;
  const chave = "obra-guia-visto-" + papel;
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
  if (can("executar")) t.push(["equipas", "Equipas de trabalho"]);
  if (store.user.papel === "dono") t.push(["equipa", "Acessos"]);
  return `<div class="eyebrow">Definições</div><div class="tabs">${t.map(([h, l]) => `<a href="#${h}" class="deftab ${atual === h ? "on" : ""}">${l}</a>`).join("")}</div>`;
}
/* ============================================================ regras (sequência) */
function regrasView() {
  const dono = store.user.papel === "dono";
  const esp = [...S.cfg.especialidades].sort((a, b) => a.ordem - b.ordem);
  const regras = S.cfg.regras || {}, dur = S.cfg.duracoes || {};
  const nAp = S.unidades.filter((u) => u.tipo === "Apartamento").length;
  const html = `
    ${defTabs("regras")}
    <div class="card-h"><h1>Sequência dos trabalhos</h1>${dono ? `<button class="btn pri" data-nova="esp">+ Nova especialidade</button>` : ""}</div>
    <p style="max-width:70ch">Cada especialidade só pode arrancar num apartamento quando as especialidades da coluna «Só começa depois de» estiverem concluídas <b>nesse mesmo apartamento</b>. Uma regra aqui aplica-se de uma vez aos ${nAp} apartamentos. Se uma atividade se atrasar, todas as que dependem dela andam para a frente sozinhas.</p>
    ${dono ? "" : `<div class="banner">Só o dono de obra pode alterar esta sequência. Ligações pontuais entre duas atividades podem ser feitas na ficha de cada atividade.</div>`}
    <div class="rules">
      <div class="rule rule-h"><span>Especialidade</span><span>Dias por fração</span><span>Só começa depois de</span></div>
      ${esp.map((e) => {
        const pre = regras[e.key] || [];
        const disp = esp.filter((x) => x.key !== e.key && !pre.includes(x.key));
        return `<div class="rule"><b>${esc(e.nome)}</b>
          <input class="inp num" type="number" min="0" max="365" value="${dur[e.key] ?? ""}" data-dur="${e.key}" ${dono ? "" : "disabled"} aria-label="Dias por fração de ${esc(e.nome)}">
          <div class="tags">${pre.map((k) => `<span class="tag ${dono ? "" : "ro"}">${esc(S.espIdx[k] ? S.espIdx[k].nome : k)}${dono ? `<button data-rm="${e.key}|${k}" aria-label="Retirar">×</button>` : ""}</span>`).join("") || `<span class="note">Sem condições</span>`}
          ${dono ? `<select class="inp" data-add="${e.key}"><option value="">+ acrescentar</option>${disp.map((x) => `<option value="${x.key}">${esc(x.nome)}</option>`).join("")}</select>` : ""}</div></div>`;
      }).join("")}
    </div>
    <p class="note">As ligações que já existiam no Excel (por exemplo a sequência da Equipa 4 de apartamento em apartamento) continuam ativas além destas regras.</p>`;
  return {
    html, bind: () => {
      if (!dono) return;
      document.querySelectorAll("[data-nova]").forEach((b) => (b.onclick = () => openNova(b.dataset.nova)));
      const save = (patch, texto) => store.setConfig(patch, { tipo: "regras", texto }).then(() => toast("Sequência atualizada"));
      document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => {
        const [k, p] = b.dataset.rm.split("|");
        const r = { ...regras, [k]: (regras[k] || []).filter((x) => x !== p) };
        save({ regras: r }, `Sequência: ${S.espIdx[k].nome} deixou de esperar por ${S.espIdx[p].nome}`);
      }));
      document.querySelectorAll("[data-add]").forEach((s) => (s.onchange = () => {
        const k = s.dataset.add, p = s.value;
        if (!p) return;
        const r = { ...regras, [k]: [...(regras[k] || []), p] };
        save({ regras: r }, `Sequência: ${S.espIdx[k].nome} passa a esperar por ${S.espIdx[p].nome}`);
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
    <p style="max-width:70ch">Cada pessoa entra com o seu email e palavra-passe. O perfil define o que pode fazer: o <b>empreiteiro</b> inicia, conclui e reporta atrasos; o <b>fiscal</b> regista vistorias e fotografias; o <b>dono de obra</b> vê tudo e define a sequência.</p>
    <section class="card"><h2>Pessoas com acesso</h2><div class="list" id="ulist"><div class="note">A carregar...</div></div></section>
    <section class="card"><h2>Adicionar pessoa</h2>
      ${demo ? `<div class="banner warn">Na demonstração não se criam contas reais. Na versão instalada, isto cria a conta e o perfil de uma vez.</div>` : ""}
      <form id="uf" class="grid2" style="gap:12px">
        <label class="f">Nome<input class="inp" id="un" required></label>
        <label class="f">Email<input class="inp" id="ue" type="email" required></label>
        <label class="f">Palavra-passe inicial<input class="inp" id="us" type="text" minlength="6" placeholder="mínimo 6 caracteres" ${demo ? "" : "required"}></label>
        <label class="f">Perfil<select class="inp" id="up"><option value="empreiteiro">Empreiteiro</option><option value="fiscal">Fiscal</option><option value="dono">Dono de obra</option></select></label>
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
        } catch (err) { $("#ust").textContent = "Erro: " + (err.code || err.message); }
      };
      const dr = $("#dreset");
      if (dr) dr.onclick = () => { store.reset(); toast("Dados de demonstração repostos"); };
    },
  };
}

/* ============================================================ equipas de trabalho */
const telLink = (t) => `<a href="tel:${esc(String(t).replace(/[^\d+]/g, ""))}">${esc(t)}</a>`;
/** Atribui (ou retira, com nome null) uma equipa a vários trabalhos de uma vez. */
async function atribuirEquipa(ids, nome) {
  const lista = ids.filter((id) => S.acts[id] && (S.acts[id].equipa || null) !== (nome || null)).map((id) => ({ id, patch: { equipa: nome || null } }));
  if (!lista.length) { toast(nome ? `Já estava${ids.length > 1 ? "m" : ""} com ${nome}` : "Já estava sem equipa"); return; }
  const um = lista.length === 1 ? S.acts[lista[0].id] : null;
  const alvo = um ? `${nomeAtiv(um)} em ${um.unidade}` : `${lista.length} trabalhos`;
  await store.updateMuitas(lista, { tipo: "equipa", texto: nome ? `${alvo} atribuído${um ? "" : "s"} a ${nome}` : `${alvo} ficou sem equipa` });
  toast(nome ? `${lista.length === 1 ? "Atribuído" : lista.length + " trabalhos atribuídos"} a ${nome}` : `Equipa retirada de ${lista.length === 1 ? "1 trabalho" : lista.length + " trabalhos"}`);
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
    <p style="max-width:70ch">As equipas que fazem os trabalhos na obra (mosaicos, pintura, carpintaria...). Cada trabalho pode ter uma equipa. Atribua uma a uma na ficha do trabalho, ou várias de uma vez em Trabalhos, com <b>Atribuir equipa</b>.</p>
    ${semEq ? `<div class="banner"><span><b>${semEq} trabalhos por fazer ainda não têm equipa.</b></span><button class="btn sm" data-eqatr="_sem">Atribuir equipas</button></div>` : ""}
    ${lista.length ? `<div class="eqcards">${lista.map((e) => {
      const t = statsEquipa(e.nome);
      const esps = (e.esp || []).map((k) => S.espIdx[k]).filter(Boolean);
      return `<section class="eqcard">
        <div class="eqcard-h"><b>${esc(e.nome)}</b>${e.daObra ? `<span class="pill" title="Veio do Excel. Ao editar fica registada aqui.">do Excel</span>` : ""}</div>
        ${e.responsavel || e.telefone ? `<div class="note">${e.responsavel ? esc(e.responsavel) : ""}${e.responsavel && e.telefone ? " · " : ""}${e.telefone ? telLink(e.telefone) : ""}</div>` : ""}
        ${esps.length ? `<div class="tags">${esps.map((x) => `<span class="tag ro">${esc(x.nome)}</span>`).join("")}</div>` : ""}
        <div class="eqstats num"><span><b>${t.fazer}</b> por fazer</span><span><b>${t.curso}</b> em curso</span>${t.atr ? `<span class="mau-t"><b>${t.atr}</b> atrasados</span>` : ""}<span><b>${t.conc}</b> concluídos</span></div>
        ${t.prox ? `<div class="note">Próximo: ${esc(nomeAtiv(t.prox.a))} em ${esc(t.prox.a.unidade)}, ${t.prox.r.inicio <= S.hoje ? "já pode começar" : fd(t.prox.r.inicio)}</div>` : ""}
        ${e.notas ? `<div class="note">${esc(e.notas)}</div>` : ""}
        <div class="row" style="gap:6px;margin-top:auto"><button class="btn sm" data-eqver="${esc(e.nome)}">Ver trabalhos</button><button class="btn sm" data-eqatr="${esc(e.nome)}">Atribuir trabalhos</button><button class="btn sm" data-eqed="${esc(e.nome)}">Editar</button></div>
      </section>`;
    }).join("")}</div>` : `<div class="empty">Ainda não há equipas. Crie a primeira com <b>+ Nova equipa</b>.</div>`}`;
  return {
    html, bind: () => {
      $("#eqNova").onclick = () => openEquipa(null);
      document.querySelectorAll("[data-eqed]").forEach((b) => (b.onclick = () => openEquipa(b.dataset.eqed)));
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
/** Criar ou editar uma equipa. nome = null para nova. opts.aoGravar(nome) corre depois de gravar. */
function openEquipa(nome, opts = {}) {
  document.querySelectorAll('[data-dw="equipa"]').forEach((e) => e.remove());
  const orig = nome ? S.eqLista.find((e) => e.nome === nome) : null;
  const e0 = orig ? { ...orig, esp: [...(orig.esp || [])] } : { nome: "", responsavel: "", telefone: "", esp: [], notas: "" };
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
        <h3>Especialidades habituais <span class="note">(opcional)</span></h3>
        <div class="chips" id="eqEsp">${esp.map((x) => `<button type="button" class="chip ${e0.esp.includes(x.key) ? "on" : ""}" data-eqe="${x.key}">${esc(x.nome)}</button>`).join("")}</div>
        <label class="check" id="eqAutoW" hidden><input type="checkbox" id="eqAuto"><span id="eqAutoT"></span></label>
      </div>
      <label class="f">Notas<textarea class="inp" id="eqNo" rows="2" placeholder="Ex.: trabalha só no bloco C, de manhã">${esc(e0.notas || "")}</textarea></label>
      <div class="err" id="eqErr"></div>
      <div class="row"><button class="btn pri" type="submit">${orig ? "Guardar" : "Criar equipa"}</button><button class="btn" type="button" id="eqCancel">Cancelar</button></div>
      ${orig ? `<details class="formbox delbox" id="eqDel"><summary><b>Eliminar equipa</b></summary>
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
  const semEqDe = () => Object.values(S.acts).filter((a) => !a.equipa && e0.esp.includes(a.esp) && S.res.get(a.id).estado !== "concluida");
  const auto = () => {
    const n = e0.esp.length ? semEqDe().length : 0;
    q("#eqAutoW").hidden = !n;
    q("#eqAutoT").textContent = `Atribuir já esta equipa aos ${n} trabalhos por fazer destas especialidades que ainda não têm equipa`;
  };
  sh.querySelectorAll("[data-eqe]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.eqe;
    e0.esp = e0.esp.includes(k) ? e0.esp.filter((x) => x !== k) : [...e0.esp, k];
    b.classList.toggle("on"); auto();
  }));
  auto();
  setTimeout(() => q("#eqN").focus(), 50);
  const registadas = () => (S.cfg.equipas || []).filter((e) => e && e.nome);
  q("#eqf").onsubmit = async (ev) => {
    ev.preventDefault();
    const novo = q("#eqN").value.trim().replace(/\s+/g, " ");
    if (!novo) return;
    if (S.equipas.some((n) => n.toLowerCase() === novo.toLowerCase() && (!orig || n !== orig.nome))) { q("#eqErr").textContent = "Já existe uma equipa com esse nome."; return; }
    const dados = { id: (orig && orig.id) || "eq" + Date.now().toString(36), nome: novo, responsavel: q("#eqR").value.trim() || null, telefone: q("#eqT").value.trim() || null, esp: e0.esp, notas: q("#eqNo").value.trim() || null };
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
    if (paraAuto.length) await store.updateMuitas(paraAuto.map((id) => ({ id, patch: { equipa: novo } })), { tipo: "equipa", texto: `${paraAuto.length} trabalhos atribuídos a ${novo}` });
    toast(orig ? "Equipa guardada" : `«${novo}» criada${paraAuto.length ? ` e atribuída a ${paraAuto.length} trabalhos` : ""}`);
    if (opts.aoGravar) await opts.aoGravar(novo);
  };
  const del = q("#eqDelOk");
  if (del) del.onclick = async () => {
    const r = sh.querySelector('input[name="eqDest"]:checked');
    const dest = r && r.value === "_outra" ? q("#eqDestSel").value : null;
    const ids = Object.values(S.acts).filter((a) => a.equipa === orig.nome).map((a) => ({ id: a.id, patch: { equipa: dest } }));
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
    if (!st.codigoManual) q("#fCod").value = sugerirCodigo(st.tipo, st.bloco, st.piso);
    q("#fEspW").hidden = st.ativ !== "padrao";
    q("#fCopW").hidden = st.ativ !== "copiar";
    q("#fIniW").hidden = st.ativ === "nenhuma";
    const n = nAtiv();
    q("#fRes").innerHTML = `Vai criar <b class="mono">${esc(q("#fCod").value.trim().toUpperCase() || "?")}</b> (${esc(st.tipo.toLowerCase())}${st.bloco !== "Geral" ? ", bloco " + st.bloco : ""}${st.tipo !== "Zona comum" ? ", piso " + (Number(st.piso) || 0) : ""})${n ? ` com <b>${n} atividades</b>` : " sem atividades"}.`;
  };
  ["#fTipo", "#fBloco", "#fPiso", "#fCop"].forEach((x) => (q(x).oninput = q(x).onchange = atualiza));
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
    const nova = { id, bloco: st.bloco, tipo: st.tipo, nome, piso };
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
        if (x.equipa) a.equipa = x.equipa;
        if (ini && x.planInicio) { a.planInicio = addDays(x.planInicio, desloc); a.planFim = x.planFim ? addDays(x.planFim, desloc) : null; }
        else if (ini) { a.planInicio = ini; a.planFim = addDays(ini, x.duracao || 0); }
        return a;
      });
    }
    const unidades = ordenaUnidades([...(S.cfg.unidades || []), nova]);
    const texto = `Nova fração ${id} (${st.tipo.toLowerCase()}${st.bloco !== "Geral" ? ", bloco " + st.bloco : ""})${lista.length ? ` com ${lista.length} atividades` : ""}`;
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
  const b0 = $("#delU"); if (b0) b0.onclick = () => { ui.delUnit = { id: u.id, passo: 1 }; render(); };
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
function openNova(preset, opts = {}) {
  const p = preset || "";
  ui.nova = {
    esp: p === "esp" ? "__outra" : "",
    novaEsp: p === "esp",
    onde: p.startsWith("unit:") ? "escolher" : "apart",
    blocos: ["A", "B", "C", "D"],
    sel: new Set(p.startsWith("unit:") ? [p.slice(5)] : []),
    saltar: true,
    depois: [],
    especificas: opts.especificas ? opts.especificas.map((d) => ({ ...d })) : [],
  };
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
  const dono = store.user.papel === "dono";
  const esp = [...S.cfg.especialidades].sort((a, b) => a.ordem - b.ordem);
  const ONDE = [["apart", "Todos os apartamentos"], ["lojas", "Todas as lojas"], ["zonas", "Zonas comuns"], ["geral", "Geral"], ["escolher", "Escolher frações"]];
  const grupos = ["A", "B", "C", "D", "Geral"];
  const html = `
  <div class="scrim" data-dw="nova"></div>
  <aside class="sheet" data-dw="nova" role="dialog" aria-label="Nova atividade">
    <div class="sheet-h"><div style="display:flex;flex-direction:column;gap:4px"><div class="eyebrow">Trabalhos</div><h2>Nova atividade</h2></div><button class="x" aria-label="Fechar">×</button></div>
    <form class="sheet-b" id="nf">
      <div class="formbox">
        <h3>O que é</h3>
        <label class="f">Atividade<select class="inp" id="nEsp">
          <option value="">Escolha...</option>
          <option value="__outra" ${n.esp === "__outra" ? "selected" : ""}>Outra atividade (escrever o nome)</option>
          <optgroup label="Especialidades existentes">${esp.map((e) => `<option value="${e.key}" ${n.esp === e.key ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</optgroup>
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
  q("#nEsp").onchange = (ev) => {
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
    if (equipa && !S.equipas.some((x) => x.toLowerCase() === equipa.toLowerCase())) cfgPatch.equipas = [...(S.cfg.equipas || []).filter((e) => e && e.nome), { id: "eq" + Date.now().toString(36), nome: equipa, esp: [] }];
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
  const fonteTxt = { excel: "Excel", regra: "Sequência", manual: "Manual" };
  const depRow = (pid, fonte, rem, tipo) => {
    const p = S.acts[pid]; if (!p) return "";
    const pr = S.res.get(pid);
    return `<div class="dep"><div><button class="lnk" data-go="${pid}">${esc(nomeAtiv(p))}</button> <span class="mono muted">${esc(p.unidade)}</span>${p.unidade !== a.unidade ? ` <span class="src outra">outra fração</span>` : ""}${fonte ? ` <span class="src">${fonteTxt[fonte] || ""}</span>` : ""}${tipo === "SS" ? ` <span class="src">em paralelo</span>` : ""}</div>
      <div class="row" style="gap:6px"><span class="pill st-${pr.estado}">${ESTADO[pr.estado]}</span><span class="mono note">${fd(pr.fim)}</span>${rem ? `<button class="btn sm ghost" data-rmdep="${pid}|${fonte}" title="Retirar ligação">×</button>` : ""}</div></div>`;
  };
  const exec = can("executar") && r.estado !== "concluida";
  const pct = Math.round(a.pctEmp ?? 0);
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
    <div class="stabs" role="tablist">${[["estado", "Estado"], ["lig", `Ligações <span class="num">${r.preds.length + r.succ.length}</span>`], ["fotos", "Fotografias"], ["hist", "Histórico"]].map(([k, l]) => `<button role="tab" data-stab="${k}" class="${(ui.sheetTab || "estado") === k ? "on" : ""}" aria-selected="${(ui.sheetTab || "estado") === k}">${l}</button>`).join("")}</div>
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
      ${a.obs ? `<div class="note"><b>Observações do Excel:</b> ${esc(a.obs)}</div>` : ""}
      ${can("criar") ? `<div class="row" style="gap:6px"><button class="btn sm" id="bNovaU" title="Criar um trabalho novo em ${esc(a.unidade)}">+ Novo trabalho nesta fração</button><button class="btn sm" id="bNovaSeg" title="Criar um trabalho novo que só começa quando este acabar">+ Novo trabalho a seguir a este</button></div>` : ""}
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
          <div class="row" style="gap:6px"><span class="pill st-${xr.estado}">${ESTADO[xr.estado]}</span><span class="mono note">${fd(xr.inicio)}</span>${podeDeps ? `<button class="btn sm" data-troca="${sid}">Trocar</button><button class="btn sm ghost" data-tirasuc="${sid}" title="Deixa de esperar por esta">×</button>` : ""}</div></div>
          ${podeDeps && ui.sheet.troca === sid ? `<div class="formbox trocabox"><b>Trocar ${esc(nomeAtiv(x))} (${esc(x.unidade)}) por:</b>${depPickerHTML("tp", x.unidade, "Trocar por esta")}<button class="btn sm ghost" data-trocacancel>Cancelar</button></div>` : ""}`;
      }).join("") : `<div class="note">Nenhuma.</div>`}</div>
      ${podeDeps ? `<details class="formbox" id="sucBox"><summary><b>+ Acrescentar atividade seguinte</b> <span class="note">desta ou de outra fração</span></summary>
        <p class="note" style="margin:8px 0">A atividade que escolher passa a esperar por esta.</p>${depPickerHTML("sp", a.unidade, "Acrescentar")}</details>` : ""}
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
    await atribuirEquipa([id], se.value || null);
  };
  on("#bNovaU", () => { const u = a.unidade; closeSheet(); openNova("unit:" + u); });
  on("#bNovaSeg", () => { const u = a.unidade; closeSheet(); openNova("unit:" + u, { especificas: [{ id, tipo: "FS" }] }); });
  on("#bIni", () => editarData(id, "realIni", S.hoje));
  on("#bFim", () => upd({ realFim: S.hoje, realInicio: a.realInicio || S.hoje, concluido: true, pctEmp: 100, empEm: new Date().toISOString() }, `Concluiu ${N}`, "conclusao"));
  on("#bReabrir", () => upd({ concluido: false, realFim: null, pctEmp: 90 }, `Reabriu ${N}`, "reabrir"));
  on("#bUndo", () => upd({ realInicio: null, realFim: null, concluido: false }, `Anulou início de ${N}`, "correcao"));
  const rp = $("#rPct", sh); if (rp) rp.oninput = () => ($("#oPct", sh).textContent = rp.value + "%");
  on("#bPct", () => {
    const v = Number(rp.value);
    const patch = { pctEmp: v, empEm: new Date().toISOString() };
    if (v > 0 && !a.realInicio) patch.realInicio = S.hoje;
    upd(patch, `${N}: ${v}% feito (empreiteiro)`, "progresso");
  });
  on("#bPrev", () => {
    const mot = $("#dMot", sh).value.trim(), dur = $("#dDur", sh).value;
    const patch = { motivo: mot || null, duracaoManual: dur === "" ? null : Math.max(0, Number(dur)) };
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
    await store.updateAtividade(id, patch,
      { tipo: "vistoria", texto: `Vistoria ${N}: ${v}% (empreiteiro dizia ${pct}%)${fotos.length ? `, ${fotos.length} fotografia(s)` : ""}${nota ? ", comentário: " + nota : ""}` });
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
  sh.querySelectorAll("[data-rmdep]").forEach((b) => (b.onclick = () => {
    const [pid, fonte] = b.dataset.rmdep.split("|");
    const p = S.acts[pid];
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
