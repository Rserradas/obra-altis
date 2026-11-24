// Folha da semana: as atividades da semana agrupadas por andar, apartamento ou atividade, para trabalhar no ecrã e imprimir (completa ou compacta).
import { pctEfetiva } from "../engine.js";
import { $, ESTADO, PAPEL, can, deltaHTML, erroSimples, esc, fd, toast, ui } from "./base.js";
import { blocoLabel, nomeAtiv } from "./calculo.js";
import { S, store } from "./estado.js";
import { openSheet } from "./ficha.js";
import { gruposEsp, itemDe, nomeGrupo } from "./grupos.js";
import { render } from "./nucleo.js";
import { pendAberto, pendDe } from "./pendentes.js";
import { impAbertos } from "./proximas.js";
import { bindPctCtl, gravarSit, pctCtlHTML, sitAtual, sitMudou, sitOrig } from "./unidades.js";

/** Bloco e andar de uma fração, com a chave que dá a ordem (pisos por ordem, zonas comuns no fim do bloco, Geral no fim de tudo). */
export function andarDe(u) {
  if (!u || u.bloco === "Geral") return { k: "zz~geral", l: "Geral (obra toda)" };
  if (u.tipo === "Zona comum" || u.piso == null || u.piso >= 99) return { k: `${u.bloco}~zz`, l: `${blocoLabel(u.bloco)} · zonas comuns` };
  const p = Number(u.piso);
  return { k: `${u.bloco}~${String(p + 10).padStart(3, "0")}`, l: `${blocoLabel(u.bloco)} · ${p === 0 ? "rés-do-chão" : p < 0 ? `cave ${-p}` : p + ".º andar"}` };
}
const ordemEsp = (a) => (a.esp && S.espIdx[a.esp] ? S.espIdx[a.esp].ordem : 999);
const media = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + pctEfetiva(x.a), 0) / xs.length) : 0);
const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Como se agrupa a folha e como sai no papel (fica guardado neste dispositivo). */
export const MODOS_FOLHA = { andar: "Andar", apartamento: "Apartamento", atividade: "Atividade" };
const PAG_LBL = { andar: "Cada andar numa folha nova", apartamento: "Cada apartamento numa folha nova", atividade: "Cada grupo numa folha nova" };
export function opcFolha() {
  if (!ui.folhaOpc) {
    let o = {}; try { o = JSON.parse(localStorage.getItem("obra-folha-opc") || "{}") || {}; } catch (e) {}
    ui.folhaOpc = { agr: MODOS_FOLHA[o.agr] ? o.agr : "andar", papel: o.papel === "completa" ? "completa" : "compacta", pag: !!o.pag };
  }
  return ui.folhaOpc;
}
const gravarOpc = () => { try { localStorage.setItem("obra-folha-opc", JSON.stringify(ui.folhaOpc)); } catch (e) {} };

function grupoIdx() {
  const doItem = new Map();
  gruposEsp().forEach((g, i) => (g.itens || []).forEach((it) => { if (!doItem.has(it)) doItem.set(it, { id: g.id, nome: g.nome, i }); }));
  return doItem;
}
const OUTRAS = { id: "_outras", nome: "Outras", i: 9999 };
const fracLbl = (u, id) => (!u ? id : u.tipo === "Apartamento" || u.nome === u.id ? u.id : `${u.nome} (${u.id})`);
const cmpFrac = (x, y) => andarDe(S.uMap[x]).k.localeCompare(andarDe(S.uMap[y]).k) || x.localeCompare(y);
const cmpArr = (x, y) => { for (let i = 0; i < x.length; i++) { const c = typeof x[i] === "string" ? String(x[i]).localeCompare(String(y[i])) : x[i] - y[i]; if (c) return c; } return 0; };

/** Os níveis de cada modo: cada nível dá a chave, o nome e a ordem de um item. O último nível é o bloco com as linhas. */
function niveis(modo) {
  const gi = grupoIdx();
  const andar = (x) => { const an = andarDe(S.uMap[x.a.unidade]); return { k: an.k, l: an.l, o: [an.k] }; };
  const grupo = (x) => { const g = gi.get(itemDe(x.a)) || OUTRAS; return { k: g.id, l: g.nome, o: [g.id === "_outras" ? 1 : 0, ordemEsp(x.a), g.i] }; };
  const ativ = (x) => ({ k: itemDe(x.a), l: nomeAtiv(x.a), o: [ordemEsp(x.a), nomeAtiv(x.a)] });
  const frac = (x) => { const u = S.uMap[x.a.unidade], an = andarDe(u); return { k: x.a.unidade, l: fracLbl(u, x.a.unidade), sub: u && u.bloco !== "Geral" ? an.l : "", o: [an.k, x.a.unidade] }; };
  if (modo === "apartamento") return { lv: [frac, grupo], mostra: "a", linhas: (a, b) => ordemEsp(a.a) - ordemEsp(b.a) || nomeAtiv(a.a).localeCompare(nomeAtiv(b.a)) };
  if (modo === "atividade") return { lv: [grupo, ativ], mostra: "u", linhas: (a, b) => cmpFrac(a.a.unidade, b.a.unidade) };
  return { lv: [andar, grupo, ativ], mostra: "u", linhas: (a, b) => a.a.unidade.localeCompare(b.a.unidade) };
}

/** Agrupa a folha pelo modo escolhido. Devolve a árvore de nós { k, l, sub, itens, filhos | linhas } e o que mostrar em cada linha. */
export function agruparFolha(itens, modo = "andar") {
  const { lv, mostra, linhas } = niveis(modo);
  const constroi = (xs, d, pre) => {
    const m = new Map();
    for (const x of xs) {
      const n = lv[d](x), k = pre + "|" + n.k;
      if (!m.has(k)) m.set(k, { k, l: n.l, sub: n.sub || "", o: n.o, itens: [] });
      const N = m.get(k); N.itens.push(x);
      N.o = N.o.map((v, i) => (typeof v === "number" ? Math.min(v, n.o[i]) : v));
    }
    return [...m.values()].sort((x, y) => cmpArr(x.o, y.o)).map((N) => (d < lv.length - 1 ? { ...N, filhos: constroi(N.itens, d + 1, N.k) } : { ...N, linhas: N.itens.slice().sort(linhas) }));
  };
  return { arv: constroi(itens, 0, modo), mostra, prof: lv.length };
}

/** Filtros só da folha: andar e apartamentos escolhidos. Devolve os itens e as opções (andares e frações que existem). */
export function filtrarFolha(todos, w) {
  const andares = new Map();
  for (const x of todos) { const an = andarDe(S.uMap[x.a.unidade]); if (!andares.has(an.k)) andares.set(an.k, an.l); }
  const efAndar = w.fAndar && andares.has(w.fAndar) ? w.fAndar : "";
  const noAndar = efAndar ? todos.filter((x) => andarDe(S.uMap[x.a.unidade]).k === efAndar) : todos;
  const fracs = [...new Set(noAndar.map((x) => x.a.unidade))].sort(cmpFrac);
  const efUs = (w.fUs || []).filter((u) => fracs.includes(u));
  const itens = efUs.length ? noAndar.filter((x) => efUs.includes(x.a.unidade)) : noAndar;
  return { itens, andares: [...andares].sort((x, y) => x[0].localeCompare(y[0])), fracs, efAndar, efUs };
}
export const nFiltrosFolha = (f) => (f ? (f.efAndar ? 1 : 0) + (f.efUs.length ? 1 : 0) : 0);

/** Andar e Apartamentos, a seguir aos filtros da Minha semana. */
export function filtrosFolhaHTML(f) {
  const lblUs = f.efUs.length ? (f.efUs.length === 1 ? f.efUs[0] : `${f.efUs.length} escolhidos`) : "Todos";
  return `<label class="f">Andar<select class="inp" id="fsAnd"><option value="">Todos os andares</option>${f.andares.map(([k, l]) => `<option value="${esc(k)}" ${f.efAndar === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
    <label class="f">Apartamentos<button type="button" class="inp fs-usb ${f.efUs.length ? "on" : ""}" id="fsUs" aria-expanded="${!!ui.folhaUpick}">${esc(lblUs)}</button></label>`;
}
function escolherUsHTML(f) {
  if (!ui.folhaUpick) return "";
  const porAndar = new Map();
  for (const id of f.fracs) { const an = andarDe(S.uMap[id]); if (!porAndar.has(an.k)) porAndar.set(an.k, { l: an.l, ids: [] }); porAndar.get(an.k).ids.push(id); }
  const sel = new Set(f.efUs);
  return `<div class="fs-upick no-print" id="fsPick"><div class="fs-uph"><b>Escolha os apartamentos</b><span class="note">${f.efUs.length ? pl(f.efUs.length, "escolhido", "escolhidos") : "Sem escolha: entram todos"}</span>
      <span class="fs-ops-b"><button class="btn sm" data-fuall="1">Todos</button><button class="btn sm pri" id="fsPickOk">Fechar</button></span></div>
    ${[...porAndar.values()].map((A) => `<div class="fs-upa"><button type="button" class="lnk-b fs-upl" data-fuand="${esc(A.ids.join(","))}" title="Escolher ou tirar todos deste andar">${esc(A.l)}</button><div class="chips">${A.ids.map((id) => `<button type="button" class="chip mono ${sel.has(id) ? "on" : ""}" data-fu="${esc(id)}" aria-pressed="${sel.has(id)}">${esc(id)}</button>`).join("")}</div></div>`).join("")}
  </div>`;
}

const fechados = () => (ui.folhaFech = ui.folhaFech instanceof Set ? ui.folhaFech : new Set());

function linha({ a, r }, podeMexer, mostra = "u") {
  const s = sitAtual(a), o = sitOrig(a), mud = podeMexer && sitMudou(a);
  const pe = Math.round(Number(a.pctEmp) || 0), pf = a.pctFiscal == null ? null : Math.round(Number(a.pctFiscal));
  const espera = r.estado === "bloqueada" ? [...new Set(r.bloqueadaPor.map((id) => S.acts[id]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))] : [];
  const nImp = impAbertos(a).length, nPend = pendDe(a.unidade, a.id).filter(pendAberto).length;
  const ini = r.prevIni || r.inicio, fim = r.prevFim || r.fim;
  const iniV = a.realInicio || ini, provDif = r.estado === "em_curso" && r.provFim && r.provFim !== fim;
  const novo = s.est === "conc" ? "concluída hoje" : s.est === "curso" ? `em curso, ${s.pct}%` : "não iniciada";
  const bt = (k, l) => `<button type="button" class="sb sb-${k} ${s.est === k ? "on" : ""}" data-fsit="${a.id}|${k}" aria-pressed="${s.est === k}">${l}</button>`;
  return `<div class="fs-row ${mud ? "mudou" : ""} ${r.atrasada ? "atr" : ""}" id="fs-${a.id}">
    <div class="fs-i">
      <div class="fs-l1">${mostra === "a" ? `<button class="lnk-b fs-u fs-ua" data-a="${a.id}" title="Abrir a ficha">${esc(nomeAtiv(a))}</button>` : `<button class="lnk-b mono fs-u" data-a="${a.id}" title="Abrir a ficha">${esc(a.unidade)}</button>`}<span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>${deltaHTML(r.atraso)}<span class="fs-pct num" title="Percentagem do empreiteiro e da última vistoria do fiscal"><b>${pe}%</b> <span class="note fs-fis">fiscal ${pf == null ? "s/v" : pf + "%"}</span></span><span class="fs-bar" aria-hidden="true"><i style="width:${pe}%"></i></span></div>
      <div class="fs-dt"><span class="fs-d1"><small>Início</small> <b class="num">${fd(iniV)}</b>${a.realInicio ? ` <small>(começou)</small>` : ""}</span><span class="fs-d1"><small>Conclusão</small> <b class="num">${fd(fim)}</b>${provDif ? ` <small class="fs-prov">(provável ${fd(r.provFim)})</small>` : ""}</span>${a.equipa ? `<span class="fs-eq">${esc(a.equipa)}</span>` : `<span class="fs-sem">sem equipa</span>`}</div>
      ${espera.length ? `<div class="fs-l2 wait1">à espera de ${esc(espera.slice(0, 3).join(", "))}${espera.length > 3 ? ` e mais ${espera.length - 3}` : ""}</div>` : ""}
      ${nImp || nPend ? `<div class="fs-l2 fs-al">${[nImp ? pl(nImp, "impedimento", "impedimentos") : "", nPend ? pl(nPend, "pendente por resolver", "pendentes por resolver") : ""].filter(Boolean).join(" · ")}</div>` : ""}
      ${mud ? `<div class="fs-l2 fs-alt"><b>Por guardar:</b> ${esc(novo)} (era ${o.est === "conc" ? "concluída" : o.est === "curso" ? `em curso, ${o.pct}%` : "não iniciada"})</div>` : ""}
    </div>
    ${podeMexer ? `<div class="fs-a no-print">
      <div class="sit-est" role="group" aria-label="Estado de ${esc(nomeAtiv(a) + " em " + a.unidade)}">${bt("por", "Não iniciada")}${bt("curso", "Em curso")}${bt("conc", "Concluída")}</div>
      ${s.est === "curso" ? pctCtlHTML("fs~" + a.id, s.pct, mud && s.pct !== o.pct) : ""}
    </div>` : ""}
    <div class="fs-p" aria-hidden="true"><span>% em obra</span><i></i><span>Notas</span><i class="fs-pn"></i></div>
  </div>`;
}

/** Versão compacta (só no papel): uma linha por trabalho; o nome do bloco (atividade ou grupo) vai numa coluna à esquerda, só na primeira linha. */
function linhaC({ a, r }, mostra, comEq) {
  const pe = Math.round(Number(a.pctEmp) || 0);
  const ini = r.prevIni || r.inicio, fim = r.prevFim || r.fim, iniV = a.realInicio || ini;
  const provDif = r.estado === "em_curso" && r.provFim && r.provFim !== fim;
  const est = r.estado === "bloqueada" ? "À espera" : ESTADO[r.estado];
  return `<td class="${mostra === "a" ? "" : "mono"} fc-q">${esc(mostra === "a" ? nomeAtiv(a) : a.unidade)}</td>
    <td>${esc(est)}${r.atraso > 0 ? ` <b class="fc-atr">+${r.atraso}d</b>` : ""}</td><td class="num">${r.estado === "em_curso" ? pe + "%" : ""}</td>
    <td class="num fc-dt"><b>${fd(iniV)}</b></td><td class="num fc-dt"><b>${fd(fim)}</b>${provDif ? ` <small>prov. ${fd(r.provFim)}</small>` : ""}</td>
    ${comEq ? `<td class="fc-eq">${esc(a.equipa || "")}</td>` : ""}<td class="fc-w"></td><td class="fc-w fc-wn"></td>`;
}
function compactaHTML(tree, { comEq, periodo, modo }) {
  const { arv, mostra } = tree;
  const folhas = (N, pre) => (N.filhos ? N.filhos.flatMap((F) => folhas(F, [...pre, F.l])) : [{ ...N, pre }]);
  const cL = modo === "apartamento" ? "Grupo" : "Atividade", cR = mostra === "a" ? "Atividade" : "Fração";
  return `<div class="fs-cmp print-only">${arv.map((T) => {
    const blocos = T.filhos.flatMap((F) => folhas(F, [F.l]));
    return `<section class="fc-sec"><div class="fc-h"><b>${esc(T.l)}</b>${T.sub ? `<span>${esc(T.sub)}</span>` : ""}<span class="fc-hn">${pl(T.itens.length, "trabalho", "trabalhos")} · ${esc(periodo)}</span></div>
      <table class="fc-t ${modo === "apartamento" ? "m-a" : ""}"><thead><tr><th class="fc-c-l">${cL}</th><th class="fc-c-r">${cR}</th><th class="fc-c-e">Estado</th><th class="fc-c-f">Feito</th><th class="fc-c-i">Início</th><th class="fc-c-c">Conclusão</th>${comEq ? '<th class="fc-c-eq">Equipa</th>' : ""}<th class="fc-c-po">% em obra</th><th>Notas</th></tr></thead>
      ${blocos.map((B, bi) => { const n = B.linhas.length, gp = B.pre.slice(0, -1).join(" · "), ant = bi ? blocos[bi - 1].pre.slice(0, -1).join(" · ") : null;
        const cab = (gp && gp !== ant ? `<small>${esc(gp)}</small>` : "") + esc(B.pre[B.pre.length - 1]);
        return `<tbody class="fc-b ${n <= 8 ? "fc-bs" : ""}">${B.linhas.map((x, i) => `<tr class="${x.r.atrasada ? "atr" : ""}">${i ? "" : `<td class="fc-l" rowspan="${n}">${cab}</td>`}${linhaC(x, mostra, comEq)}</tr>`).join("")}</tbody>`; }).join("")}</table></section>`;
  }).join("")}</div>`;
}

/** HTML da folha: itens = [{ a, r }] já filtrados pela Minha semana e pelos filtros da folha. */
export function folhaHTML(itens, { hoje, lim, filtrosTxt, filtros, equipaFixa }) {
  const podeMexer = can("executar"), op = opcFolha();
  const tree = agruparFolha(itens, op.agr), { arv, mostra } = tree, fch = fechados();
  const nMud = podeMexer ? itens.filter(({ a }) => sitMudou(a)).length : 0;
  const det = (k, cls, sum, corpo) => `<details class="fs-d ${cls}" data-fsk="${esc(k)}" ${fch.has(k) ? "" : "open"}><summary>${sum}</summary>${corpo}</details>`;
  const resumo = (xs) => `<span class="fs-n note num">${pl(xs.length, "atividade", "atividades")} · ${media(xs)}% feito</span>`;
  const bloco = (N) => `<div class="fs-ativ"><div class="fs-ah"><b>${esc(N.l)}</b><span class="note num">${mostra === "a" ? pl(N.linhas.length, "atividade", "atividades") : pl(N.linhas.length, "fração", "frações")} · ${media(N.linhas)}%</span></div>${N.linhas.map((x) => linha(x, podeMexer, mostra)).join("")}</div>`;
  const no = (N, d) => (N.linhas ? bloco(N) : det(N.k, d ? "fs-grupo" : "fs-andar", `<span class="fs-t">${esc(N.l)}</span>${N.sub ? `<span class="fs-sub note">${esc(N.sub)}</span>` : ""}${resumo(N.itens)}`, N.filhos.map((F) => no(F, d + 1)).join("")));
  const corpo = arv.map((N) => no(N, 0)).join("");
  const quem = store.user && (store.user.nome || store.user.email || PAPEL[store.user.papel]);
  const periodo = `${fd(hoje)} a ${fd(lim)}`;
  const cmp = op.papel === "compacta";
  return `
    <div class="fs-cab print-only">
      <div class="fs-cab1"><b>Folha da semana</b><span>${esc((S.cfg.obra && S.cfg.obra.nome) || S.cfg.nome || "ALTIS")}</span></div>
      <div class="fs-cab2">De ${fd(hoje, true)} a ${fd(lim, true)} · agrupada por ${MODOS_FOLHA[op.agr].toLowerCase()} · ${esc(filtrosTxt || "Todos os blocos, equipas e grupos")} · ${pl(itens.length, "trabalho", "trabalhos")} · impressa a ${fd(hoje, true)}${quem ? " por " + esc(quem) : ""}</div>
    </div>
    ${filtros ? escolherUsHTML(filtros) : ""}
    <div class="fs-agr no-print"><span class="fs-agl">Agrupar por</span><div class="seg-v sm" role="group" aria-label="Agrupar por">${Object.entries(MODOS_FOLHA).map(([k, l]) => `<button type="button" data-fagr="${k}" class="${op.agr === k ? "on" : ""}" aria-pressed="${op.agr === k}">${l}</button>`).join("")}</div></div>
    <div class="fs-ops no-print">
      <span class="fs-ops-c">
        <label class="check"><input type="checkbox" id="fsEsp" ${ui.folhaEspera ? "checked" : ""}><span>Incluir as à espera de outras</span></label>
        <label class="f fs-papel">No papel<select class="inp" id="fsPapel"><option value="compacta" ${cmp ? "selected" : ""}>Compacta, uma linha por trabalho</option><option value="completa" ${cmp ? "" : "selected"}>Completa, como no ecrã</option></select></label>
        <label class="check"><input type="checkbox" id="fsPag" ${op.pag ? "checked" : ""}><span>${PAG_LBL[op.agr]}</span></label>
      </span>
      <span class="fs-ops-b"><button class="btn sm" id="fsAbrir">${fch.size ? "Abrir tudo" : "Fechar tudo"}</button><button class="btn sm pri" id="fsPrint">Imprimir ou PDF</button></span>
    </div>
    <p class="note no-print fs-dica">${podeMexer ? "Mude o estado e a percentagem em cada linha e carregue em Guardar no fim: grava tudo de uma vez e pode Anular. " : ""}Toque no ${mostra === "a" ? "nome da atividade" : "código da fração"} para abrir a ficha. ${cmp ? "No papel sai a versão compacta: uma linha por trabalho, com as datas e duas colunas em branco, % em obra e Notas, para preencher na visita." : "No papel sai como no ecrã, com duas colunas em branco, % em obra e Notas, para preencher na visita."}${op.pag ? " Cada " + (op.agr === "atividade" ? "grupo" : op.agr) + " começa numa folha nova, para entregar em separado." : ""}</p>
    ${itens.length ? `<div class="fs-wrap ${cmp ? "cmp" : ""} ${op.pag ? "pag" : ""}"><div class="fs">${corpo}</div>${cmp ? compactaHTML(tree, { comEq: !equipaFixa && itens.some(({ a }) => a.equipa), periodo, modo: op.agr }) : ""}</div>` : `<div class="empty">Nada para esta semana com estes filtros.</div>`}
    ${podeMexer ? barraHTML(nMud) : ""}`;
}
const barraHTML = (nMud) => `<div class="vbar sitbar no-print" id="fsBar"><span class="vb-l"><b class="num">${nMud ? `${nMud} por guardar` : "Nada por guardar"}</b>${nMud ? `<button class="btn sm ghost vb-seg" id="fsDesf">Desfazer</button>` : ""}</span>
      <span class="sitbar-b"><button class="btn pri" id="fsSave" ${nMud ? "" : "disabled"}>${nMud ? `Guardar (${nMud})` : "Guardar"}</button></span></div>`;

export function bindFolha(itens, w) {
  const view = document.querySelector("#view"); if (!view) return;
  const op = opcFolha(), mostra = agruparFolha([], op.agr).mostra;
  view.querySelectorAll("[data-fagr]").forEach((b) => (b.onclick = () => { if (op.agr === b.dataset.fagr) return; op.agr = b.dataset.fagr; ui.folhaFech = new Set(); gravarOpc(); render(); }));
  const pp = $("#fsPapel"); if (pp) pp.onchange = () => { op.papel = pp.value; gravarOpc(); render(); };
  const pg = $("#fsPag"); if (pg) pg.onchange = () => { op.pag = pg.checked; gravarOpc(); render(); };
  if (w) {
    const an = $("#fsAnd"); if (an) an.onchange = () => { w.fAndar = an.value; render(); };
    const ub = $("#fsUs"); if (ub) ub.onclick = () => { ui.folhaUpick = !ui.folhaUpick; render(); };
    const ok = $("#fsPickOk"); if (ok) ok.onclick = () => { ui.folhaUpick = false; render(); };
    const us = () => (w.fUs = Array.isArray(w.fUs) ? w.fUs : []);
    view.querySelectorAll("[data-fu]").forEach((b) => (b.onclick = () => { const l = us(), id = b.dataset.fu, i = l.indexOf(id); i >= 0 ? l.splice(i, 1) : l.push(id); render(); }));
    view.querySelectorAll("[data-fuand]").forEach((b) => (b.onclick = () => { const l = us(), ids = b.dataset.fuand.split(","); const todos = ids.every((id) => l.includes(id)); w.fUs = todos ? l.filter((id) => !ids.includes(id)) : [...new Set([...l, ...ids])]; render(); }));
    view.querySelectorAll("[data-fuall]").forEach((b) => (b.onclick = () => { w.fUs = []; render(); }));
  }
  ui.sit = ui.sit || {};
  const fch = fechados();
  view.querySelectorAll("details.fs-d").forEach((d) => d.addEventListener("toggle", () => { const fch = fechados(); d.open ? fch.delete(d.dataset.fsk) : fch.add(d.dataset.fsk); const b = $("#fsAbrir"); if (b) b.textContent = fch.size ? "Abrir tudo" : "Fechar tudo"; }));
  const ab = $("#fsAbrir");
  if (ab) ab.onclick = () => { const abrir = fch.size > 0; view.querySelectorAll("details.fs-d").forEach((d) => { if (abrir) fch.delete(d.dataset.fsk); else fch.add(d.dataset.fsk); }); render(); };
  const es = $("#fsEsp"); if (es) es.onchange = () => { ui.folhaEspera = es.checked; render(); };
  // imprimir: abre tudo para o papel e volta a fechar o que estava fechado
  // (guarda o que estava fechado em ui, para resistir a um redesenho a meio da impressão)
  window.onbeforeprint = () => { if (!document.querySelector("details.fs-d") || ui.folhaPrint) return; ui.folhaPrint = new Set(fechados()); document.querySelectorAll("details.fs-d").forEach((d) => (d.open = true)); };
  window.onafterprint = () => {
    if (!ui.folhaPrint) return;
    const era = ui.folhaPrint; ui.folhaPrint = null;
    ui.folhaFech = new Set(era);
    document.querySelectorAll("details.fs-d").forEach((d) => (d.open = !era.has(d.dataset.fsk)));
  };
  const pr = $("#fsPrint"); if (pr) pr.onclick = () => window.print();
  if (!can("executar")) return;
  const porId = new Map(itens.map((x) => [x.a.id, x]));
  // um toque só redesenha a linha e a barra (a folha pode ter centenas de linhas)
  const ligarLinha = (root) => {
    root.querySelectorAll("[data-fsit]").forEach((b) => (b.onclick = () => {
      const [id, k] = b.dataset.fsit.split("|"), a = S.acts[id], cur = sitAtual(a), o = sitOrig(a);
      if (k !== "curso") return muda(id, k);
      muda(id, "curso", cur.est === "curso" ? cur.pct : o.est === "curso" ? o.pct : o.est === "conc" ? 90 : Math.max(5, Math.min(95, o.pct)));
    }));
    bindPctCtl(root, (key) => { const a = S.acts[key.slice(3)]; return a ? sitAtual(a).pct : 0; }, (key, val) => {
      const id = key.slice(3);
      if (val >= 100) muda(id, "conc"); else muda(id, "curso", val);
    });
  };
  const ligarBarra = () => {
    const df = $("#fsDesf"); if (df) df.onclick = () => { for (const id of Object.keys(ui.sit)) if (porId.has(id)) delete ui.sit[id]; render(); };
    const sv = $("#fsSave");
    if (sv) sv.onclick = async () => {
      const lista = itens.map(({ a }) => a).filter((a) => sitMudou(a));
      if (!lista.length) return;
      sv.disabled = true;
      try {
        await gravarSit(lista, "folha da semana");
        toast(`Folha da semana guardada: ${pl(lista.length, "atividade", "atividades")}`);
        render();
      } catch (e) { toast("Não foi possível guardar: " + erroSimples(e), { anular: false }); if (sv.isConnected) sv.disabled = false; }
    };
  };
  const muda = (id, est, pct) => {
    const a = S.acts[id], o = sitOrig(a);
    if (est === "conc") pct = 100; else if (est === "por") pct = 0;
    if (est === o.est && (est !== "curso" || pct === o.pct)) delete ui.sit[id];
    else ui.sit[id] = { unidade: a.unidade, est, pct };
    const row = document.getElementById("fs-" + id), x = porId.get(id);
    if (!row || !x) return render();
    const t = document.createElement("div"); t.innerHTML = linha(x, true, mostra);
    const novo = t.firstElementChild; row.replaceWith(novo);
    ligarLinha(novo);
    novo.querySelectorAll("[data-a]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); openSheet(b.dataset.a); }));
    const bar = $("#fsBar");
    if (bar) { const nMud = itens.filter(({ a }) => sitMudou(a)).length; const tb = document.createElement("div"); tb.innerHTML = barraHTML(nMud); bar.replaceWith(tb.firstElementChild); ligarBarra(); }
  };
  ligarLinha(view);
  ligarBarra();
}
export const filtrosFolhaTxt = (w, f) => [w.bloco ? blocoLabel(w.bloco) : "", f && f.efAndar ? (f.andares.find(([k]) => k === f.efAndar) || [, ""])[1] : "", f && f.efUs.length ? (f.efUs.length > 6 ? pl(f.efUs.length, "fração", "frações") : f.efUs.join(", ")) : "", w.equipa === "_sem" ? "sem equipa" : w.equipa ? "Equipa " + w.equipa : "", w.grupo ? "Grupo " + nomeGrupo(w.grupo) : ""].filter(Boolean).join(" · ");
