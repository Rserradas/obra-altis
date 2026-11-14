// O que está a segurar a obra.
import { addDays, diffDays, simularEmDia } from "../engine.js";
import { esc, fd, ui } from "./base.js";
import { actsObra, nomeAtiv } from "./calculo.js";
import { S } from "./estado.js";
import { render } from "./nucleo.js";
import { bindCommon } from "./previsao.js";

/* ============================================================ o que está a segurar a obra
   Para cada trabalho com atraso próprio (devia ter começado ou acabado e ainda não), simula que estava em dia
   e vê o que mudava: o fim da obra, de cada bloco e de cada fração. Os que mais adiantam o fim vêm primeiro. */
export const grupoBloco = (u) => (u.tipo === "Loja" ? "Lojas" : u.bloco);
export const ORD_BLOCOS = ["A", "B", "C", "D", "Lojas", "Geral"];
export function analiseSegurar() {
  if (S._seg) return S._seg;
  const res = S.res, maxDia = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
  const vivas = actsObra().filter((a) => S.uMap[a.unidade] && res.get(a.id) && res.get(a.id).estado !== "concluida");
  const porU = {}, uDoB = {};
  for (const a of vivas) (porU[a.unidade] = porU[a.unidade] || []).push(a.id);
  const fimU = {}, fimB = {};
  let fimO = null;
  for (const uid in porU) {
    const u = S.uMap[uid], b = grupoBloco(u);
    (uDoB[b] = uDoB[b] || []).push(uid);
    for (const id of porU[uid]) fimU[uid] = maxDia(fimU[uid], res.get(id).provFim);
    fimB[b] = maxDia(fimB[b], fimU[uid]);
    fimO = maxDia(fimO, fimU[uid]);
  }
  // o que muda nos fins com as datas simuladas
  const efeito = (nov) => {
    const novU = {}, tocB = new Set();
    let nAtiv = 0;
    for (const [id, r] of nov) {
      const a = S.acts[id];
      if (!a || !porU[a.unidade]) continue;
      if (r.provFim < res.get(id).provFim) nAtiv++;
      if (novU[a.unidade] !== undefined) continue;
      let f = null;
      for (const x of porU[a.unidade]) f = maxDia(f, (nov.get(x) || res.get(x)).provFim);
      novU[a.unidade] = f;
      tocB.add(grupoBloco(S.uMap[a.unidade]));
    }
    const fr = [];
    for (const uid in novU) { const g = diffDays(novU[uid], fimU[uid]); if (g > 0) fr.push({ uid, g, b: grupoBloco(S.uMap[uid]) }); }
    const blocos = {};
    let novO = null;
    for (const b in uDoB) {
      let f = fimB[b];
      if (tocB.has(b)) { f = null; for (const uid of uDoB[b]) f = maxDia(f, novU[uid] !== undefined ? novU[uid] : fimU[uid]); }
      const g = diffDays(f, fimB[b]);
      if (g > 0) blocos[b] = g;
      novO = maxDia(novO, f);
    }
    fr.sort((x, y) => y.g - x.g);
    return { obra: Math.max(0, diffDays(novO, fimO)), novoFim: novO, blocos, fr, nAtiv };
  };
  const sim = (ids) => efeito(simularEmDia(res, new Set(ids), S.hoje, S.cfg.duracoes || {}));
  // trabalhos com atraso próprio: o fim provável passou para lá do previsto
  const cands = vivas.filter((a) => { const r = res.get(a.id); return !r.ciclo && r.provFim > r.prevFim; }).map((a) => {
    const r = res.get(a.id);
    return { a, r, dias: diffDays(r.prevFim, r.provFim), ef: sim([a.id]) };
  });
  // equipas: e se todos os trabalhos atrasados da equipa estivessem em dia
  const eqs = {};
  for (const c of cands) { const k = c.a.equipa || ""; (eqs[k] = eqs[k] || { nome: k, itens: [] }).itens.push(c); }
  const equipas = Object.values(eqs).map((e) => ({ ...e, ef: sim(e.itens.map((c) => c.a.id)) }));
  const tudo = cands.length ? sim(cands.map((c) => c.a.id)) : null;
  // a última atividade de cada alvo (quando nenhum atraso mexe no fim, é o plano que o decide)
  const ultima = { obra: null };
  for (const a of vivas) {
    const r = res.get(a.id), b = grupoBloco(S.uMap[a.unidade]);
    if (!ultima.obra || r.provFim > res.get(ultima.obra.id).provFim) ultima.obra = a;
    if (!ultima[b] || r.provFim > res.get(ultima[b].id).provFim) ultima[b] = a;
  }
  S._seg = { cands, equipas, tudo, fimO, fimB, ultima, blocos: ORD_BLOCOS.filter((b) => fimB[b]) };
  return S._seg;
}
/** Ganho no alvo escolhido (obra ou um bloco) e soma dos dias ganhos nas frações desse alvo. */
export const ganhoEm = (ef, alvo) => (!ef ? 0 : alvo === "obra" ? ef.obra : ef.blocos[alvo] || 0);
export const somaFr = (ef, alvo) => ef.fr.reduce((s, x) => s + (alvo === "obra" || x.b === alvo ? x.g : 0), 0);
export const maxBloco = (ef, alvo) => (alvo === "obra" ? Math.max(0, ...Object.values(ef.blocos)) : 0);
export const frDoAlvo = (ef, alvo) => ef.fr.filter((x) => alvo === "obra" || x.b === alvo);
export function ordenarSeg(lista, alvo) {
  return lista.filter((c) => frDoAlvo(c.ef, alvo).length || ganhoEm(c.ef, alvo) > 0)
    .sort((x, y) => ganhoEm(y.ef, alvo) - ganhoEm(x.ef, alvo) || maxBloco(y.ef, alvo) - maxBloco(x.ef, alvo) || frDoAlvo(y.ef, alvo).length - frDoAlvo(x.ef, alvo).length || somaFr(y.ef, alvo) - somaFr(x.ef, alvo) || y.ef.nAtiv - x.ef.nAtiv || (y.dias || 0) - (x.dias || 0));
}
export const nomeAlvo = (alvo) => (alvo === "obra" ? "da obra" : alvo === "Lojas" ? "das lojas" : alvo === "Geral" ? "das zonas gerais" : "do bloco " + alvo);
export const sujeitoAlvo = (alvo) => (alvo === "obra" ? "a obra acabava" : alvo === "Lojas" ? "as lojas acabavam" : alvo === "Geral" ? "as zonas gerais acabavam" : "o bloco " + alvo + " acabava");
export const rotuloAlvo = (b) => (b === "obra" ? "Obra toda" : b.length === 1 ? "Bloco " + b : b === "Geral" ? "Zonas gerais" : b);
export const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
export function porqueAtrasa(c) {
  const { r } = c;
  if (r.estado === "em_curso") {
    if (r.eqOcupada) return `Em curso, mas a equipa está noutro trabalho: acaba a ${fd(r.provFim)}, ${pl(c.dias, "dia", "dias")} depois do previsto`;
    if (r.prevFim < S.hoje) return `Em curso, devia ter acabado a ${fd(r.prevFim)}`;
    return `Em curso, ao ritmo atual acaba a ${fd(r.provFim)}, ${pl(c.dias, "dia", "dias")} depois do previsto`;
  }
  return `Podia ter começado a ${fd(r.prevIni)} e ainda não começou`;
}
export function efeitoPills(ef, alvo, completo = true) {
  const p = [];
  const gA = ganhoEm(ef, alvo);
  if (gA > 0) p.push(`<span class="sg-p crit">Fim ${nomeAlvo(alvo)} ${pl(gA, "dia", "dias")} mais cedo</span>`);
  if (alvo === "obra" && completo) for (const b of ORD_BLOCOS) if (ef.blocos[b]) p.push(`<span class="sg-p">${rotuloAlvo(b)} ${pl(ef.blocos[b], "dia", "dias")} mais cedo</span>`);
  const fr = frDoAlvo(ef, alvo);
  if (fr.length) {
    const aps = fr.filter((x) => { const t = S.uMap[x.uid].tipo; return t === "Apartamento" || t === "Loja"; }).length;
    const zs = fr.length - aps;
    const txt = [aps ? pl(aps, "fração", "frações") : "", zs ? pl(zs, "zona", "zonas") : ""].filter(Boolean).join(" e ");
    p.push(`<span class="sg-p" title="${esc(fr.slice(0, 20).map((x) => `${x.uid}: ${x.g} dias`).join(", "))}">${txt} ${fr.length === 1 ? `acabava ${pl(fr[0].g, "dia", "dias")} mais cedo` : `acabavam mais cedo, até ${pl(fr[0].g, "dia", "dias")}`}</span>`);
  }
  if (completo && ef.nAtiv > 1) p.push(`<span class="sg-p fraco">${ef.nAtiv} trabalhos adiantavam</span>`);
  return p.join("");
}
export function linhaSeg(c, alvo, i) {
  const a = c.a;
  return `<div class="sg-l">
    <span class="sg-i num">${i + 1}</span>
    <button class="lnk-b sg-n" data-a="${a.id}">
      <span class="sg-t"><span class="mono chip-u">${esc(a.unidade)}</span> <b>${esc(nomeAtiv(a))}</b>${a.equipa ? ` <span class="note">${esc(a.equipa)}</span>` : ""}</span>
      <small>${porqueAtrasa(c)} <span class="delta mau" title="Dias de atraso deste trabalho">+${c.dias} d</span></small>
    </button>
    <div class="sg-ef">${efeitoPills(c.ef, alvo)}</div>
  </div>`;
}
export function resumoSegHTML(an, alvo) {
  const fim = alvo === "obra" ? an.fimO : an.fimB[alvo];
  const ult = an.ultima[alvo];
  const g = ganhoEm(an.tudo, alvo);
  const plano = ult ? `A última atividade é <button class="lnk-b sg-ult" data-a="${ult.id}"><b>${esc(nomeAtiv(ult))}</b> em <span class="mono">${esc(ult.unidade)}</span></button>, prevista de ${fd(S.res.get(ult.id).provIni)} a ${fd(S.res.get(ult.id).provFim, true)}.` : "";
  return `<div class="sg-top">
    <div class="sg-fim"><div class="eyebrow">Fim previsto ${nomeAlvo(alvo)}</div><big class="num">${fd(fim, true)}</big></div>
    <div class="sg-res">${g > 0
      ? `<p><b>Se todos os atrasos de hoje ficassem resolvidos, ${sujeitoAlvo(alvo)} a ${fd(addDays(fim, -g), true)}, ${pl(g, "dia", "dias")} mais cedo.</b> A lista mostra quais pesam mais.</p>`
      : `<p><b>Nenhum atraso de hoje está a empurrar este fim.</b> A data é decidida pelo plano. ${plano}</p><p class="note">Os atrasos abaixo não mexem no fim ${nomeAlvo(alvo)}, mas atrasam frações. Se crescerem, podem passar a mexer.</p>`}</div>
  </div>`;
}
export function segurarView() {
  const an = analiseSegurar();
  const sg = (ui.seg = ui.seg || { alvo: "obra", eq: null, todos: false });
  if (sg.alvo !== "obra" && !an.fimB[sg.alvo]) sg.alvo = "obra";
  const alvo = sg.alvo;
  const base = sg.eq != null ? an.cands.filter((c) => (c.a.equipa || "") === sg.eq) : an.cands;
  const lista = ordenarSeg(base, alvo);
  const semEf = base.length - lista.length;
  const LIM = 15;
  const ver = sg.todos ? lista : lista.slice(0, LIM);
  const eqs = an.equipas.filter((e) => frDoAlvo(e.ef, alvo).length || ganhoEm(e.ef, alvo) > 0)
    .sort((x, y) => ganhoEm(y.ef, alvo) - ganhoEm(x.ef, alvo) || maxBloco(y.ef, alvo) - maxBloco(x.ef, alvo) || frDoAlvo(y.ef, alvo).length - frDoAlvo(x.ef, alvo).length || somaFr(y.ef, alvo) - somaFr(x.ef, alvo));
  const ccBloco = alvo.length === 1 || alvo === "Geral" ? alvo : "";
  const html = `
    <a class="back no-print" href="#painel">Painel</a>
    <div class="card-h"><h1>O que está a segurar a obra</h1><div class="row no-print"><a class="btn" href="#gantt" data-ccgantt="${ccBloco}">Caminho crítico no Gantt</a></div></div>
    <p class="note sg-intro">Para cada trabalho atrasado, a aplicação simula que estava em dia e vê o que mudava: o fim da obra, de cada bloco e de cada fração. Os que mais adiantam o fim aparecem primeiro. Tudo o resto fica como está.</p>
    <div class="seq-g sg-alvo" role="tablist" aria-label="Ver o efeito em">${["obra", ...an.blocos].map((b) => `<button role="tab" data-sgalvo="${b}" class="${alvo === b ? "on" : ""}" aria-selected="${alvo === b}">${rotuloAlvo(b)}</button>`).join("")}</div>
    <section class="card">${resumoSegHTML(an, alvo)}</section>
    <section class="card">
      <div class="card-h"><h2>Trabalhos atrasados com mais efeito</h2><span class="note num">${lista.length}</span></div>
      ${sg.eq != null ? `<div class="banner"><span>Só os trabalhos de <b>${esc(sg.eq || "sem equipa atribuída")}</b>.</span><button class="btn sm" data-sgeq="__todas">Ver todas as equipas</button></div>` : ""}
      <div class="sg-lista">${ver.length ? ver.map((c, i) => linhaSeg(c, alvo, i)).join("") : `<div class="empty">${base.length ? "Nenhum destes atrasos mexe no fim de uma fração " + (alvo === "obra" ? "" : nomeAlvo(alvo)) + "." : "Não há trabalhos atrasados."}</div>`}</div>
      ${lista.length > LIM ? `<button class="btn sm sg-mais" data-sgtodos>${sg.todos ? "Mostrar só os primeiros " + LIM : "Mostrar todos (" + lista.length + ")"}</button>` : ""}
      ${semEf ? `<p class="note">Há mais ${pl(semEf, "trabalho atrasado", "trabalhos atrasados")} que não ${semEf === 1 ? "mexe" : "mexem"} no fim de nenhuma fração${alvo === "obra" ? "" : " " + nomeAlvo(alvo)}: ${semEf === 1 ? "tem" : "têm"} folga.</p>` : ""}
    </section>
    <section class="card">
      <div class="card-h"><h2>Por equipa</h2><span class="note">se todos os trabalhos atrasados da equipa estivessem em dia</span></div>
      <div class="sg-eqs">${eqs.length ? eqs.map((e) => `<button class="sg-eq ${sg.eq === e.nome ? "on" : ""}" data-sgeq="${esc(e.nome)}">
        <span class="sg-t"><b>${esc(e.nome || "Sem equipa atribuída")}</b> <span class="note">${pl(e.itens.length, "trabalho atrasado", "trabalhos atrasados")}</span></span>
        <span class="sg-ef">${efeitoPills(e.ef, alvo, false)}</span></button>`).join("") : `<div class="empty">Nenhuma equipa tem atrasos que mexam no fim.</div>`}</div>
      <p class="note">Toque numa equipa para ver só os trabalhos dela na lista de cima.</p>
    </section>`;
  return {
    html,
    bind: () => {
      bindCommon();
      document.querySelectorAll("[data-sgalvo]").forEach((b) => (b.onclick = () => { sg.alvo = b.dataset.sgalvo; sg.todos = false; render(); }));
      document.querySelectorAll("[data-sgeq]").forEach((b) => (b.onclick = () => { const v = b.dataset.sgeq; sg.eq = v === "__todas" || sg.eq === v ? null : v; sg.todos = false; render(); window.scrollTo(0, 0); }));
      const bt = document.querySelector("[data-sgtodos]"); if (bt) bt.onclick = () => { sg.todos = !sg.todos; render(); };
      bindCcGantt();
    },
  };
}
/** Abre o Gantt com o caminho crítico ligado (da obra ou de um bloco). */
export function bindCcGantt() {
  document.querySelectorAll("[data-ccgantt]").forEach((b) => (b.onclick = () => {
    ui.gantt = ui.gantt || { zoom: "semana", abertos: new Set(), ligacoes: true, abertas: true };
    Object.assign(ui.gantt, { crit: true, bloco: b.dataset.ccgantt || "", unidade: "", ativ: "", sel: null, _chave: null });
  }));
}
/** Cartão do Painel: os três trabalhos que mais seguram a obra. */
export function segurarCardHTML({ max = 3 } = {}) {
  const an = analiseSegurar();
  const lista = ordenarSeg(an.cands, "obra");
  const g = ganhoEm(an.tudo, "obra");
  const ult = an.ultima.obra;
  return `<section class="card sg-card">
    <div class="card-h"><h2>O que está a segurar a obra</h2><a class="note" href="#segurar">ver análise completa</a></div>
    <p class="note" style="margin:0">${g > 0 ? `Se todos os atrasos de hoje ficassem resolvidos, a obra acabava <b>${pl(g, "dia", "dias")} mais cedo</b>. Estes são os que mais pesam:`
      : `Nenhum atraso de hoje está a empurrar o fim da obra: é o plano que o decide${ult ? ` (acaba com ${esc(nomeAtiv(ult))} em ${esc(ult.unidade)})` : ""}. ${lista.length ? "Os atrasos que mais atrasam frações:" : ""}`}</p>
    <div class="sg-lista">${lista.length ? lista.slice(0, max).map((c, i) => linhaSeg(c, "obra", i)).join("") : `<div class="empty">Não há trabalhos atrasados a atrasar frações.</div>`}</div>
    ${lista.length > max ? `<a class="btn sm sg-mais" href="#segurar">Ver os ${lista.length}</a>` : ""}
  </section>`;
}
