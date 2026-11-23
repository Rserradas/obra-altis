// Folha da semana: as atividades da semana agrupadas por bloco e andar, grupo e atividade, para trabalhar no ecrã e imprimir.
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

/** Agrupa: andar > grupo > atividade > frações. Cada atividade fica só no primeiro grupo a que pertence. */
export function agruparFolha(itens) {
  const gs = gruposEsp(), doItem = new Map();
  gs.forEach((g, i) => (g.itens || []).forEach((it) => { if (!doItem.has(it)) doItem.set(it, { id: g.id, nome: g.nome, i }); }));
  const andares = new Map();
  for (const x of itens) {
    const u = S.uMap[x.a.unidade], an = andarDe(u);
    if (!andares.has(an.k)) andares.set(an.k, { k: an.k, l: an.l, grupos: new Map(), itens: [] });
    const A = andares.get(an.k); A.itens.push(x);
    const g = doItem.get(itemDe(x.a)) || { id: "_outras", nome: "Outras", i: 9999 };
    if (!A.grupos.has(g.id)) A.grupos.set(g.id, { ...g, ativs: new Map(), itens: [], ordem: 999 });
    const G = A.grupos.get(g.id); G.itens.push(x); G.ordem = Math.min(G.ordem, ordemEsp(x.a));
    const ak = itemDe(x.a);
    if (!G.ativs.has(ak)) G.ativs.set(ak, { k: ak, l: nomeAtiv(x.a), ordem: ordemEsp(x.a), itens: [] });
    G.ativs.get(ak).itens.push(x);
  }
  return [...andares.values()].sort((x, y) => x.k.localeCompare(y.k)).map((A) => ({
    ...A,
    grupos: [...A.grupos.values()].sort((x, y) => (x.id === "_outras") - (y.id === "_outras") || x.ordem - y.ordem || x.i - y.i).map((G) => ({
      ...G,
      ativs: [...G.ativs.values()].sort((x, y) => x.ordem - y.ordem || x.l.localeCompare(y.l)).map((T) => ({ ...T, itens: T.itens.sort((p, q) => p.a.unidade.localeCompare(q.a.unidade)) })),
    })),
  }));
}

const fechados = () => (ui.folhaFech = ui.folhaFech instanceof Set ? ui.folhaFech : new Set());

function linha({ a, r }, podeMexer) {
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
      <div class="fs-l1"><button class="lnk-b mono fs-u" data-a="${a.id}" title="Abrir a ficha">${esc(a.unidade)}</button><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>${deltaHTML(r.atraso)}<span class="fs-pct num" title="Percentagem do empreiteiro e da última vistoria do fiscal"><b>${pe}%</b> <span class="note fs-fis">fiscal ${pf == null ? "s/v" : pf + "%"}</span></span><span class="fs-bar" aria-hidden="true"><i style="width:${pe}%"></i></span></div>
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

/** HTML da folha: itens = [{ a, r }] já filtrados pela Minha semana. */
export function folhaHTML(itens, { hoje, lim, filtrosTxt }) {
  const podeMexer = can("executar");
  const arv = agruparFolha(itens), fch = fechados();
  const nMud = podeMexer ? itens.filter(({ a }) => sitMudou(a)).length : 0;
  const det = (k, cls, sum, corpo) => `<details class="fs-d ${cls}" data-fsk="${esc(k)}" ${fch.has(k) ? "" : "open"}><summary>${sum}</summary>${corpo}</details>`;
  const resumo = (xs) => `<span class="fs-n note num">${pl(xs.length, "atividade", "atividades")} · ${media(xs)}% feito</span>`;
  const corpo = arv.map((A) => det(A.k, "fs-andar", `<span class="fs-t">${esc(A.l)}</span>${resumo(A.itens)}`,
    A.grupos.map((G) => det(A.k + "|" + G.id, "fs-grupo", `<span class="fs-t">${esc(G.nome)}</span>${resumo(G.itens)}`,
      G.ativs.map((T) => `<div class="fs-ativ"><div class="fs-ah"><b>${esc(T.l)}</b><span class="note num">${pl(T.itens.length, "fração", "frações")} · ${media(T.itens)}%</span></div>${T.itens.map((x) => linha(x, podeMexer)).join("")}</div>`).join(""))).join(""))).join("");
  const quem = store.user && (store.user.nome || store.user.email || PAPEL[store.user.papel]);
  return `
    <div class="fs-cab print-only">
      <div class="fs-cab1"><b>Folha da semana</b><span>${esc((S.cfg.obra && S.cfg.obra.nome) || "ALTIS")}</span></div>
      <div class="fs-cab2">De ${fd(hoje, true)} a ${fd(lim, true)} · ${esc(filtrosTxt || "Todos os blocos, equipas e grupos")} · ${pl(itens.length, "atividade", "atividades")} · impresso a ${fd(hoje, true)}${quem ? " por " + esc(quem) : ""}</div>
    </div>
    <div class="fs-ops no-print">
      <label class="check"><input type="checkbox" id="fsEsp" ${ui.folhaEspera ? "checked" : ""}><span>Incluir as à espera de outras</span></label>
      <span class="fs-ops-b"><button class="btn sm" id="fsAbrir">${fch.size ? "Abrir tudo" : "Fechar tudo"}</button><button class="btn sm pri" id="fsPrint">Imprimir ou PDF</button></span>
    </div>
    <p class="note no-print fs-dica">${podeMexer ? "Mude o estado e a percentagem em cada fração e carregue em Guardar no fim: grava tudo de uma vez e pode Anular. " : ""}Toque no código da fração para abrir a ficha. No papel saem duas colunas em branco, % em obra e Notas, para preencher na visita.</p>
    ${itens.length ? `<div class="fs">${corpo}</div>` : `<div class="empty">Nada para esta semana com estes filtros.</div>`}
    ${podeMexer ? barraHTML(nMud) : ""}`;
}
const barraHTML = (nMud) => `<div class="vbar sitbar no-print" id="fsBar"><span class="vb-l"><b class="num">${nMud ? `${nMud} por guardar` : "Nada por guardar"}</b>${nMud ? `<button class="btn sm ghost vb-seg" id="fsDesf">Desfazer</button>` : ""}</span>
      <span class="sitbar-b"><button class="btn pri" id="fsSave" ${nMud ? "" : "disabled"}>${nMud ? `Guardar (${nMud})` : "Guardar"}</button></span></div>`;

export function bindFolha(itens) {
  const view = document.querySelector("#view"); if (!view) return;
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
    const t = document.createElement("div"); t.innerHTML = linha(x, true);
    const novo = t.firstElementChild; row.replaceWith(novo);
    ligarLinha(novo);
    novo.querySelectorAll("[data-a]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); openSheet(b.dataset.a); }));
    const bar = $("#fsBar");
    if (bar) { const nMud = itens.filter(({ a }) => sitMudou(a)).length; const tb = document.createElement("div"); tb.innerHTML = barraHTML(nMud); bar.replaceWith(tb.firstElementChild); ligarBarra(); }
  };
  ligarLinha(view);
  ligarBarra();
}
export const filtrosFolhaTxt = (w) => [w.bloco ? blocoLabel(w.bloco) : "", w.equipa === "_sem" ? "sem equipa" : w.equipa ? w.equipa : "", w.grupo ? "Grupo " + nomeGrupo(w.grupo) : ""].filter(Boolean).join(" · ");
