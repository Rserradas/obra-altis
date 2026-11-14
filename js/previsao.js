// Fim da obra.
import { addDays, diffDays, pctEfetiva } from "../engine.js";
import { $, CURTO, ESTADO, MESES, deltaHTML, esc, fd, ui } from "./base.js";
import { actsObra, eModelo, espAp, modeloTag, mudarModelo, nomeAtiv } from "./calculo.js";
import { S, aAnular, setAAnular, store } from "./estado.js";
import { openSheet } from "./ficha.js";
import { openNova } from "./nova.js";
import { render } from "./nucleo.js";

/* ============================================================ fim da obra (previsão por bloco e por fração) */
export const NOME_BLOCO = (k) => (k.length === 1 ? "Bloco " + k : k);
export function estadoFr(u) {
  const t = u.acts.length;
  if (!t) return { k: "vazio", l: "Sem trabalhos" };
  if (u.n.concluida === t) return { k: "pronto", l: "Pronto" };
  if (u.n.concluida || u.n.em_curso) return { k: "curso", l: "Em curso" };
  return { k: "porcomecar", l: "Por começar" };
}
export function infoFracao(u) {
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
export function previsaoView() {
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
      <span class="pv-id"><b class="mono">${esc(i.u.tipo === "Apartamento" || i.u.tipo === "Loja" ? i.u.id : i.u.nome || i.u.id)}</b>${modeloTag(i.u.id)}${i.u.tipo && i.u.tipo !== "Apartamento" ? `<small>${esc(i.u.tipo)}</small>` : ""}</span>
      <span class="pv-est e-${i.est.k}">${i.est.l}</span>
      <span class="pv-pc"><span class="track"><i style="width:${i.u.pct}%"></i></span><span class="num mono">${i.u.pct}%</span></span>
      <span class="pv-f"><b class="num">${i.est.k === "pronto" ? "pronto a " : ""}${fd(i.fim, true)}</b>${atrHTML(i.atraso)}</span>
      <span class="pv-u">${i.est.k === "pronto" ? `<span class="note">tudo concluído</span>` : `<span class="note">falta${i.falta === 1 ? "" : "m"} <b>${i.falta}</b>${i.ultima ? ` · acaba com ${esc(nomeAtiv(i.ultima))}` : ""}</span>`}</span>
    </a>`;
  const html = `
    <div class="card-h"><h1>Fim da obra</h1><div class="row no-print"><a class="btn" href="#segurar">O que está a segurar a obra</a><button class="btn" id="pvPrint">Imprimir</button></div></div>
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
export async function guardarFotoDiaria() {
  if (store.user.papel !== "dono" || !S) return;
  const h = (S.cfg.historico || []);
  if (h.length && h[h.length - 1].d === S.hoje) return;
  const novo = [...h, { d: S.hoje, fim: S.tot.fim, atr: S.tot.atrasada, conc: S.tot.concluida }].slice(-120);
  setAAnular(true);
  try { await store.setConfig({ historico: novo }, null); } catch (e) {} finally { setAAnular(false); }
}
export async function resumoSemana() {
  const el = $("#semanaRes"); if (!el) return;
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  let regs = [];
  try { regs = (await store.getRegistosDesde(desde)).filter((r) => !r.relApagado); } catch (e) { el.querySelector(".note:last-child").textContent = "Não foi possível carregar."; return; }
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
export function heatHTML() {
  const esp = espAp();
  const fil = ui.bloco;
  const us = S.unidades.filter((u) => (u.tipo === "Apartamento" || u.tipo === "Loja") && (fil === "todos" || u.bloco === fil));
  let lastB = null;
  const rows = us.map((u) => {
    let pre = "";
    const bk = u.tipo === "Loja" ? "Lojas" : u.bloco;
    if (bk !== lastB) { lastB = bk; pre = `<tr class="blk"><th colspan="${esp.length + 1}">${bk === "Lojas" ? "Lojas" : "Bloco " + bk}</th></tr>`; }
    const byE = {};
    for (const a of u.acts) if (a.esp) (byE[a.esp] = byE[a.esp] || []).push(a);
    return pre + `<tr><th><a href="#u-${esc(u.id)}">${esc(u.id)}</a>${modeloTag(u.id, true)}</th>${esp.map((e) => {
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
export function bindCommon() {
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
  document.querySelectorAll("[data-modelo]").forEach((b) => (b.onclick = () => mudarModelo(b.dataset.modelo, !eModelo(b.dataset.modelo))));
  document.querySelectorAll("[data-a]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); openSheet(b.dataset.a); }));
  document.querySelectorAll("#view [data-irpend]").forEach((b) => (b.onclick = () => { ui.lastUnit = b.dataset.irpend; ui.unidadeTab = store.user.papel === "fiscal" ? "vist" : "pend"; }));
  document.querySelectorAll("[data-bloco]").forEach((b) => (b.onclick = () => { ui.bloco = b.dataset.bloco; render(); }));
  document.querySelectorAll("a[data-f]").forEach((b) => (b.onclick = () => { ui.plano.f = b.dataset.f; ui.plano._fToque = true; }));
}
