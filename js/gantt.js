// Gantt e caminho crítico.
import { addDays, diffDays, downstream, pctEfetiva } from "../engine.js";
import { $, ESTADO, MESES, can, casaPesquisa, deltaHTML, esc, fd, filtrosAlterados, reporFiltros, termosPesquisa, toast, ui } from "./base.js";
import { modeloTag, nomeAtiv } from "./calculo.js";
import { S } from "./estado.js";
import { openSheet } from "./ficha.js";
import { render } from "./nucleo.js";
import { bindDateInputs, dataCompleta, dateInput, editarData } from "./plano.js";
import { bindCommon } from "./previsao.js";

/* ============================================================ gantt */
export function ganttView() {
  const g = (ui.gantt = ui.gantt || { bloco: "", unidade: "", ativ: "", abertas: true, zoom: "semana", abertos: new Set(), sel: null, ligacoes: true });
  g.abertosB = g.abertosB || new Set();
  if (!g.ativs) g.ativs = g.ativ ? [g.ativ] : [];
  g.estado = g.estado || ""; g.equipa = g.equipa || ""; g.tipo = g.tipo || ""; g.q = g.q || ""; g.de = g.de || ""; g.ate = g.ate || "";
  const blocos = ["A", "B", "C", "D", "Geral"];
  const us = S.unidades.filter((u) => (!g.bloco || u.bloco === g.bloco) && (!g.tipo || u.tipo === g.tipo));
  const nomes = ganttNomesAtiv(g.bloco);
  const nA = g.ativs.length;
  const html = `
    <div class="card-h"><h1>Gantt</h1></div>
    <div class="chips" role="group" aria-label="Bloco">${["", ...blocos].map((b) => `<button class="chip ${g.bloco === b ? "on" : ""}" data-gb="${b}">${b ? (b === "Geral" ? "Geral" : "Bloco " + b) : "Todos os blocos"}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Estado">${GANTT_EST.map(([k, l]) => `<button class="chip ${g.estado === k ? "on" : ""}" data-gest="${k}">${l}</button>`).join("")}</div>
    <div class="filters">
      <label class="f">Frações<select class="inp" id="gt">${[["", "Todas as frações"], ["Apartamento", "Apartamentos"], ["Loja", "Lojas"], ["Zona comum", "Zonas comuns"], ["Geral", "Geral"]].map(([k, l]) => `<option value="${k}" ${g.tipo === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Apartamento ou fração<select class="inp" id="gu"><option value="">Todas${g.bloco ? " do " + (g.bloco === "Geral" ? "geral" : "bloco " + g.bloco) : ""}</option>${us.map((u) => `<option value="${esc(u.id)}" ${g.unidade === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</select></label>
      <div class="f msel-w"><span class="msel-l">Atividades</span><details class="msel" id="gaD" ${g._mselAberto ? "open" : ""}><summary class="inp" id="gaS">${nA ? (nA === 1 ? esc(g.ativs[0]) : nA + " atividades") : "Todas"}</summary>
        <div class="msel-p"><div class="row" style="gap:6px;margin-bottom:6px"><input class="inp" id="gaQ" type="search" placeholder="Procurar atividade" style="flex:1;min-width:0"><button class="btn sm" id="gaT" type="button">Todas</button><button class="btn sm" id="gaN" type="button">Nenhuma</button></div>
        <div class="msel-l2">${nomes.map((n) => `<label class="check" data-gan="${esc(semAcentos(n))}"><input type="checkbox" value="${esc(n)}" ${g.ativs.includes(n) ? "checked" : ""}><span>${esc(n)}</span></label>`).join("")}</div>
        <button class="btn sm pri" id="gaOk" type="button" style="margin-top:8px;width:100%">Aplicar</button></div></details></div>
      <label class="f">Equipa<select class="inp" id="ge"><option value="">Todas</option><option value="_sem" ${g.equipa === "_sem" ? "selected" : ""}>Sem equipa</option>${S.equipasTodas.map((e) => `<option ${g.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></label>
      <label class="f">Procurar<input class="inp" id="gq" type="search" value="${esc(g.q)}" placeholder="Ex.: louças B-F503"></label>
      <label class="f gper">Mostrar de<input class="inp" type="date" id="gde" value="${g.de}"></label>
      <label class="f gper">até<input class="inp" type="date" id="gate" value="${g.ate}"></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="gc" ${g.abertas ? "checked" : ""} ${g.estado === "concluida" ? "disabled" : ""}><span>Esconder concluídas</span></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="gl" ${g.ligacoes ? "checked" : ""}><span>Mostrar ligações</span></label>
      <div class="row" style="align-self:center;gap:6px" role="group" aria-label="Nível de detalhe"><span class="note">Mostrar:</span><button class="btn sm" id="gnB">Blocos</button><button class="btn sm" id="gnU">Frações</button><button class="btn sm" id="gnA">Tudo</button></div>
      ${filtrosAlterados() ? `<button class="btn sm repor-on" id="grep" style="align-self:center">Limpar filtros</button>` : ""}
    </div>
    ${g.crit && ganttFiltrado() ? `<p class="note">O caminho crítico mostra sempre a cadeia toda${g.bloco ? " do bloco" : " da obra"}: os outros filtros não se aplicam enquanto estiver ligado.</p>` : ""}
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
    <div class="gprint-h">Gantt · ALTIS · ${g.crit ? "Caminho crítico" + (g.bloco ? " do " + (g.bloco === "Geral" ? "geral" : "bloco " + g.bloco) : " da obra") : (g.bloco ? (g.bloco === "Geral" ? "Geral" : "Bloco " + g.bloco) : "Todos os blocos") + ganttResumoFiltros()} · impresso a ${fd(S.hoje, true)}</div>
    <div class="gcrit-info" id="gcrit" hidden></div>
    <div class="gsel" id="gsel" hidden></div>
    <div class="legend"><span><i class="gl-bar st-concluida"></i>Concluída</span><span><i class="gl-bar st-em_curso"></i>Em curso</span><span><i class="gl-bar st-bloqueada"></i>Bloqueada</span><span><i class="gl-bar st-por_iniciar"></i>Por iniciar</span><span><i class="gl-bar st-por_iniciar atr"></i>Atrasada</span><span title="Dias desde a previsão de fim até hoje, ou até ao fim provável"><i class="gl-bar gl-tail"></i>Atraso</span><span><i class="gl-today"></i>Hoje</span><span class="note">Toque numa barra para ver a cadeia de dependências.${can("executar") ? " Com o rato, arraste a barra para mudar a data ou puxe a ponta direita para mudar o fim." : ""}</span></div>
    <div class="gantt" id="gantt"></div>
    </section>`;
  return { html, bind: bindGantt };
}
export function bindGantt() {
  const g = ui.gantt;
  bindCommon();
  document.querySelectorAll("[data-gb]").forEach((b) => (b.onclick = () => { g.bloco = b.dataset.gb; if (g.bloco) g.abertosB.add(g.bloco); g.unidade = ""; g.sel = null; const ns = new Set(ganttNomesAtiv(g.bloco)); g.ativs = g.ativs.filter((n) => ns.has(n)); render(); }));
  document.querySelectorAll("[data-gz]").forEach((b) => (b.onclick = () => { g.zoom = b.dataset.gz; render(); }));
  $("#gu").onchange = (e) => { g.unidade = e.target.value; if (g.unidade) { g.abertos.add(g.unidade); g.abertosB.add(S.uMap[g.unidade].bloco); } render(); };
  document.querySelectorAll("[data-gest]").forEach((b) => (b.onclick = () => { g.estado = b.dataset.gest; render(); }));
  $("#gt").onchange = (e) => { g.tipo = e.target.value; if (g.unidade && S.uMap[g.unidade] && g.tipo && S.uMap[g.unidade].tipo !== g.tipo) g.unidade = ""; render(); };
  $("#ge").onchange = (e) => { g.equipa = e.target.value; render(); };
  let tq; $("#gq").oninput = (e) => { clearTimeout(tq); tq = setTimeout(() => { g.q = e.target.value; render(); const i = $("#gq"); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch {} } }, 300); };
  const per = (sel, k) => { const el = $(sel); el.onchange = () => { const v = el.value; if (v && !dataCompleta(v)) return; g[k] = v; if (g.de && g.ate && g.ate < g.de) { toast("A data final não pode ser antes da inicial.", { anular: false }); g[k] = ""; } render(); }; };
  per("#gde", "de"); per("#gate", "ate");
  // atividades: escolher várias
  const gaD = $("#gaD");
  const marcadas = () => [...gaD.querySelectorAll(".msel-l2 input:checked")].map((c) => c.value);
  const aplicar = () => { g.ativs = marcadas(); g.ativ = ""; g._mselAberto = false; render(); };
  gaD.ontoggle = () => { g._mselAberto = gaD.open; if (!gaD.open) { const m = marcadas(); if (m.join("|") !== g.ativs.join("|")) aplicar(); } else { const q = $("#gaQ"); if (q && window.innerWidth > 640) q.focus(); } };
  $("#gaOk").onclick = () => { gaD.open = false; aplicar(); };
  $("#gaT").onclick = () => gaD.querySelectorAll(".msel-l2 label:not([hidden]) input").forEach((c) => (c.checked = true));
  $("#gaN").onclick = () => gaD.querySelectorAll(".msel-l2 input").forEach((c) => (c.checked = false));
  $("#gaQ").oninput = (e) => { const t = termosPesquisa(e.target.value); gaD.querySelectorAll("[data-gan]").forEach((l) => (l.hidden = !casaPesquisa(l.dataset.gan, t))); };
  if (!ui._gaFora) { ui._gaFora = true; document.addEventListener("click", (e) => { const d = document.querySelector("#gaD"); if (d && d.open && !d.contains(e.target)) d.open = false; }); }
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
export const GANTT_EST = [["", "Todas"], ["proximas", "Próximas 2 semanas"], ["em_curso", "Em curso"], ["atrasada", "Atrasadas"], ["nao_iniciada", "Não iniciadas"], ["bloqueada", "Bloqueadas"], ["porconfirmar", "Datas por confirmar"], ["concluida", "Concluídas"]];
export const semAcentos = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** Nomes das atividades pela ordem da sequência da obra. */
export function ganttNomesAtiv(bloco) {
  const espOrd = Object.fromEntries((S.cfg.especialidades || []).map((e) => [e.key, e.ordem]));
  const ord = new Map();
  for (const a of Object.values(S.acts)) {
    if (bloco && (S.uMap[a.unidade] || {}).bloco !== bloco) continue;
    const n = nomeAtiv(a), o = a.esp && espOrd[a.esp] != null ? espOrd[a.esp] : 999;
    if (!ord.has(n) || o < ord.get(n)) ord.set(n, o);
  }
  return [...ord.keys()].sort((x, y) => ord.get(x) - ord.get(y) || x.localeCompare(y, "pt"));
}
export function ganttFiltrado() {
  const g = ui.gantt || {};
  return !!((g.ativs && g.ativs.length) || g.estado || g.equipa || g.tipo || g.unidade || (g.q || "").trim() || g.de || g.ate);
}
export function ganttResumoFiltros() {
  const g = ui.gantt, r = [];
  if (g.tipo) r.push({ Apartamento: "Apartamentos", Loja: "Lojas", "Zona comum": "Zonas comuns", Geral: "Geral" }[g.tipo] || g.tipo);
  if (g.unidade) r.push(g.unidade);
  if (g.ativs && g.ativs.length) r.push(g.ativs.length <= 3 ? g.ativs.join(", ") : g.ativs.length + " atividades");
  if (g.estado) r.push((GANTT_EST.find(([k]) => k === g.estado) || [, ""])[1]);
  if (g.equipa) r.push(g.equipa === "_sem" ? "Sem equipa" : g.equipa);
  if ((g.q || "").trim()) r.push(`procura "${g.q.trim()}"`);
  if (g.de || g.ate) r.push(`${g.de ? "de " + fd(g.de) : ""}${g.de && g.ate ? " " : ""}${g.ate ? "até " + fd(g.ate) : ""}`);
  return r.length ? " · " + r.join(" · ") : "";
}
/** A atividade passa nos filtros do Gantt? */
export function ganttPassa(a, r) {
  const g = ui.gantt;
  if (g.ativs.length && !g.ativs.includes(nomeAtiv(a))) return false;
  if (g.equipa === "_sem" ? !!a.equipa : g.equipa && a.equipa !== g.equipa) return false;
  const conc = r.estado === "concluida";
  if (g.estado === "concluida") { if (!conc) return false; }
  else if (g.abertas && conc) return false;
  switch (g.estado) {
    case "proximas": if (conc || !(r.estado === "em_curso" || r.inicio <= addDays(S.hoje, 14))) return false; break;
    case "em_curso": if (r.estado !== "em_curso") return false; break;
    case "atrasada": if (!r.atrasada) return false; break;
    case "nao_iniciada": if (r.estado !== "por_iniciar" && r.estado !== "bloqueada") return false; break;
    case "bloqueada": if (r.estado !== "bloqueada") return false; break;
    case "porconfirmar": if (!r.semPlano || conc) return false; break;
  }
  const fim = maxD(r.fim, r.provFim);
  if (g.de && fim && fim < g.de) return false;
  if (g.ate && r.inicio && r.inicio > g.ate) return false;
  const q = termosPesquisa(g.q);
  if (q.length) { const u = S.uMap[a.unidade] || {}; if (!casaPesquisa(nomeAtiv(a) + " " + a.unidade + " " + (a.ref || "") + " " + (a.equipa || "") + " " + (u.nome || ""), q)) return false; }
  return true;
}
/* ============================================================ caminho crítico
   A cadeia de atividades que decide a data de fim (da obra, ou do bloco): começa na(s) atividade(s) que acabam
   em último lugar e anda para trás pelas antecessoras que a estão a prender (sem folga). Atravessa frações
   quando a ligação é da fila da equipa ou entre frações. As "raízes" são onde a cadeia começa hoje:
   qualquer dia que lá se ganhe ou perca, ganha-se ou perde-se no fim. */
export const maxD = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
export function cadeiaCritica(bloco) {
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
export function critInfoHTML(cc, bloco) {
  const onde = bloco ? (bloco === "Geral" ? "das zonas gerais" : "do bloco " + bloco) : "da obra";
  if (!cc) return `<span>Não há atividades por concluir ${onde}.</span>`;
  const rz = [...cc.raizes].map((id) => ({ a: S.acts[id], r: S.res.get(id) })).sort((x, y) => (y.r.atraso || 0) - (x.r.atraso || 0) || (x.r.provIni || "").localeCompare(y.r.provIni || ""));
  const porque = ({ r }) => r.estado === "em_curso" ? (r.atrasada ? `em curso, ${r.atraso} dias atrasada` : "em curso") : r.estado === "bloqueada" ? "à espera" : r.provIni <= S.hoje ? "pode começar já" : `começa a ${fd(r.provIni)}`;
  const aberto = !(ui.gantt && ui.gantt.full && window.innerWidth < 700);
  return `<details ${aberto ? "open" : ""}><summary><b>Fim ${onde}: ${fd(cc.fim, true)}</b> · cadeia de ${cc.set.size} atividade${cc.set.size === 1 ? "" : "s"} em ${cc.nFr} fraç${cc.nFr === 1 ? "ão" : "ões"}</summary>
    <div>Estas atividades decidem essa data: cada dia de atraso numa delas atrasa o fim, e cada dia ganho adianta-o. As setas vermelhas mostram quem espera por quem; ▶ marca onde a cadeia começa.</div>
    <div class="gc-rz"><span class="note">Onde a cadeia começa hoje (o que mais convém acelerar):</span>${rz.slice(0, 6).map((x) => `<button class="lnk-b gc-r" data-a="${x.a.id}"><span class="mono">${esc(x.a.unidade)}</span> <b>${esc(nomeAtiv(x.a))}</b> <span class="note">${porque(x)}</span></button>`).join("")}${rz.length > 6 ? `<span class="note">e mais ${rz.length - 6}</span>` : ""}</div></details>`;
}
export function mudarEcraInteiro(on) {
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
export function imprimirGantt() {
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
export function drawGantt() {
  const g = ui.gantt, box = $("#gantt");
  if (!box) return;
  const H = 30, LW = window.innerWidth < 640 ? 150 : g.crit ? 330 : 250, HEAD = 46;
  const k = { dia: 26, semana: 7, mes: 2.2 }[g.zoom];
  // linhas
  const us = S.unidades.filter((u) => (!g.bloco || u.bloco === g.bloco) && (!g.unidade || u.id === g.unidade) && (!g.tipo || u.tipo === g.tipo));
  const sozinha = us.length === 1;
  const rows = [];
  const ordemB = ["A", "B", "C", "D", "Geral"];
  for (const bl of ordemB) {
    const grupo = [];
    let bIni = null, bFim = null, bDur = 0, bFeito = 0, bN = 0, bAtr = 0;
    for (const u of us.filter((x) => x.bloco === bl)) {
      // por data de início: a real se já arrancou, senão a prevista; depois pelo fim
      const acts = u.acts.filter((a) => ganttPassa(a, S.res.get(a.id)))
        .sort((x, y) => { const rx = S.res.get(x.id), ry = S.res.get(y.id); return (rx.inicio || "9").localeCompare(ry.inicio || "9") || (rx.fim || "9").localeCompare(ry.fim || "9") || nomeAtiv(x).localeCompare(nomeAtiv(y), "pt"); });
      if (!acts.length) continue;
      let ini = null, fim = null, atr = 0;
      for (const a of acts) { const r = S.res.get(a.id); if (!ini || r.inicio < ini) ini = r.inicio; if (!fim || r.fim > fim) fim = r.fim; if (r.atrasada) atr++; }
      grupo.push({ u, acts, ini, fim, atr });
      if (!bIni || ini < bIni) bIni = ini; if (!bFim || fim > bFim) bFim = fim;
      bDur += u.dur; bFeito += u.feito; bN += acts.length; bAtr += atr;
    }
    if (!grupo.length) continue;
    const filtrado = ganttFiltrado() && !g.unidade ? bN <= 400 : false; // poucas linhas: abre tudo para se verem as barras
    const bAberto = sozinha || filtrado || g.bloco === bl || g.abertosB.has(bl);
    rows.push({ t: "b", bl, ini: bIni, fim: bFim, n: bN, nu: grupo.length, pct: bDur ? Math.round((100 * bFeito) / bDur) : 0, atr: bAtr, aberto: bAberto });
    if (!bAberto) continue;
    for (const x of grupo) {
      const aberto = sozinha || (filtrado && bN <= 150) || g.abertos.has(x.u.id);
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
  if (!g.crit && g.de) t0 = g.de;
  if (!g.crit && g.ate) t1 = g.ate;
  if (t1 <= t0) t1 = addDays(t0, 7);
  const W = Math.max(400, Math.round(diffDays(t0, t1) * k));
  const X = (d) => Math.min(W, Math.max(0, Math.round(diffDays(t0, d) * k))); // com um período escolhido, as barras são cortadas nas pontas
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
        <button class="glab" data-gtog="${esc(u.id)}" title="${x.aberto ? "Fechar" : "Abrir"}"><span class="car">${sozinha ? "" : x.aberto ? "▾" : "▸"}</span><b class="mono">${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</b>${modeloTag(u.id, true)}<span class="note num">${u.pct}% · ${x.n}</span></button>
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
      ${S.hoje >= t0 && S.hoje <= t1 ? `<div class="gtoday" style="left:${LW + tx}px"></div>` : ""}
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
  const chave = [g.bloco, g.unidade, (g.ativs || []).join(","), g.zoom, g.abertas, g.crit, g.estado, g.equipa, g.tipo, g.q, g.de, g.ate].join("|");
  if (g._chave !== chave) { g._chave = chave; box.scrollLeft = Math.max(0, tx - 160); g._sl = box.scrollLeft; g._st = 0; }
  else { box.scrollLeft = (g._sl || 0) + (g._t0 ? diffDays(t0, g._t0) * k : 0); box.scrollTop = g._st || 0; }
  g._t0 = t0; g._sl = box.scrollLeft;
  box.onscroll = () => { g._sl = box.scrollLeft; g._st = box.scrollTop; };
}

export function gTip(e, txt) {
  let t = document.getElementById("gtip");
  if (!e) { if (t) t.remove(); return; }
  if (!t) { t = document.createElement("div"); t.id = "gtip"; t.className = "gtip"; document.body.appendChild(t); }
  t.textContent = txt;
  t.style.left = e.clientX + 12 + "px"; t.style.top = e.clientY - 34 + "px";
}
