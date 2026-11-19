// A minha semana, relatório para reunião e pesquisa rápida.
import { addDays, pctEfetiva } from "../engine.js";
import { $, ESTADO, PLANO_PADRAO, casaPesquisa, semAcento, deltaHTML, esc, fd, termosPesquisa, toast, ui } from "./base.js";
import { actsObra, modeloTag, nomeAtiv } from "./calculo.js";
import { S, store } from "./estado.js";
import { openSheet } from "./ficha.js";
import { render } from "./nucleo.js";
import { atencaoHTML, bindAtencao } from "./painel.js";
import { filtroGrupo, grupoSelectHTML, nomeGrupo } from "./grupos.js";
import { concluirHoje, editarData } from "./plano.js";
import { bindCommon } from "./previsao.js";
import { ORD_BLOCOS, analiseSegurar, ganhoEm, ordenarSeg, pl, rotuloAlvo } from "./segurar.js";
import { ultimaVistoria } from "./unidades.js";

/* ============================================================ a minha semana (empreiteiro) */
export function semanaView() {
  const w = (ui.semana = ui.semana || { equipa: "", bloco: "", ver: "", grupo: "" });
  const hoje = S.hoje, lim = addDays(hoje, 7);
  const noGrupo = filtroGrupo(w.grupo);
  const base = Object.values(S.acts).map((a) => ({ a, r: S.res.get(a.id) })).filter(({ a }) => {
    const u = S.uMap[a.unidade];
    if (!u || u.teste) return false;
    if (w.bloco && u.bloco !== w.bloco) return false;
    if (w.equipa === "_sem" ? a.equipa : w.equipa && a.equipa !== w.equipa) return false;
    if (!noGrupo(a)) return false;
    return true;
  });
  const emCurso = base.filter(({ r }) => r.estado === "em_curso").sort((x, y) => x.r.fim.localeCompare(y.r.fim));
  const comecar = base.filter(({ r }) => r.estado === "por_iniciar" && r.inicio <= lim).sort((x, y) => x.r.inicio.localeCompare(y.r.inicio) || x.a.unidade.localeCompare(y.a.unidade));
  const espera = base.filter(({ r }) => r.estado === "bloqueada" && r.inicio <= addDays(lim, 7)).sort((x, y) => x.r.inicio.localeCompare(y.r.inicio));
  const acabar = emCurso.filter(({ r }) => r.provFim <= lim).length; // pelo fim provável (as já atrasadas contam a partir de hoje)
  // avisos de hoje: o que já devia estar marcado e ainda não está
  // (as que nunca tiveram data, em Datas por confirmar, ficam de fora: a data de hoje foi a aplicação que a pôs)
  const porIniciar = ({ a, r }) => r.estado !== "concluida" && !a.realInicio && !r.semPlano;
  const porData = (x, y) => x.r.inicio.localeCompare(y.r.inicio) || x.a.unidade.localeCompare(y.a.unidade);
  const atrCom = base.filter((x) => porIniciar(x) && x.r.inicio < hoje).sort(porData);
  const comHoje = base.filter((x) => porIniciar(x) && x.r.inicio === hoje).sort(porData);
  const acabHoje = base.filter(({ r }) => r.estado !== "concluida" && !r.semPlano && r.fim === hoje).sort((x, y) => x.a.unidade.localeCompare(y.a.unidade));
  const AVISOS = [["atrcom", "Atrasadas para começar", atrCom, "Já deviam ter começado e ainda não estão marcadas como iniciadas"],
    ["comhoje", "Começam hoje", comHoje, "Previstas para hoje e ainda não iniciadas"],
    ["acabhoje", "Acabam hoje", acabHoje, "Previstas para acabar hoje e ainda não concluídas"]];
  const aviso = AVISOS.find(([k]) => k === w.ver);
  const VER = [["", "Tudo"], ["curso", "Em curso"], ["comecar", "Para começar"], ["espera", "À espera de outras"]];
  const MAX = aviso ? 200 : 60;
  const tipoDe = (r) => (r.estado === "em_curso" ? "curso" : r.estado === "bloqueada" ? "espera" : "comecar");
  const linha = ({ a, r }, tipo0) => {
    const tipo = tipo0 === "auto" ? tipoDe(r) : tipo0;
    const pct = Math.round(a.pctEmp ?? 0);
    const esperaPor = tipo === "espera" ? [...new Set(r.bloqueadaPor.map((id) => S.acts[id]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))] : [];
    return `<div class="srow ${r.atrasada ? "atr" : ""}">
      <span class="mono su">${esc(a.unidade)}</span>
      <button class="lnk-b sn" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b>${a.equipa || esperaPor.length ? `<span class="sx">${a.equipa ? `<small>${esc(a.equipa)}</small>` : ""}${esperaPor.length ? `<small class="wait1">à espera de ${esc(esperaPor.slice(0, 2).join(", "))}${esperaPor.length > 2 ? "..." : ""}</small>` : ""}</span>` : ""}</button>
      <div class="si">${tipo === "curso" ? `<div class="sbar"><i style="width:${pct}%"></i></div><span class="num mono">${pct}%</span><span class="note">${r.fim === hoje ? "acaba hoje" : "até " + fd(r.fim)}</span>`
        : `<span class="note">${r.inicio < hoje ? `devia ter começado a ${fd(r.inicio)}` : `${tipo === "espera" ? "pode começar" : "começa"} ${r.inicio === hoje ? "hoje" : fd(r.inicio)}`}${w.ver === "acabhoje" ? ", devia acabar hoje" : ""}</span>`}${deltaHTML(r.atraso)}</div>
      <div class="sa">${tipo === "curso" ? `<button class="btn sm" data-q="mais|${a.id}" ${pct >= 95 ? "disabled" : ""}>+10%</button><button class="btn sm ok" data-q="fim|${a.id}">Concluir</button>`
        : tipo === "comecar" ? `<button class="btn sm pri" data-q="ini|${a.id}">Iniciar</button><button class="btn sm ok" data-q="fim|${a.id}" title="Já está feita: fica concluída hoje">Concluir</button>` : `<button class="btn sm" data-a="${a.id}">Ver ficha</button>`}</div>
    </div>`;
  };
  const secao = (titulo, sub, lista, tipo, filtro) => `<section class="card">
    <div class="card-h"><h2>${titulo} <span class="note num">${lista.length}</span></h2>${sub ? `<span class="note">${sub}</span>` : ""}</div>
    ${lista.length ? `<div class="srows">${lista.slice(0, MAX).map((x) => linha(x, tipo)).join("")}</div>${lista.length > MAX ? (filtro ? `<a class="note" href="#plano" data-semver="${filtro}">Ver as ${lista.length} nos Trabalhos</a>` : `<p class="note">A mostrar ${MAX} de ${lista.length}. Escolha um bloco, grupo ou equipa para ver menos.</p>`) : ""}`
      : `<div class="empty">${w.equipa || w.bloco || w.grupo ? `Nada nesta lista com estes filtros. <button class="btn sm" data-repor>Limpar filtros</button>` : "Nada nesta lista."}</div>`}
  </section>`;
  const html = `
    <div class="card-h"><h1>A minha semana</h1><span class="note">De hoje, ${fd(hoje)}, a ${fd(lim)}</span></div>
    <div class="kpis kpis3">
      <button class="kpi k-curso ${w.ver === "curso" ? "sel" : ""}" data-sver="curso" aria-pressed="${w.ver === "curso"}" title="Mostrar só as em curso"><b>${emCurso.length}</b><span>Em curso, ${acabar} acabam esta semana</span></button>
      <button class="kpi k-ok ${w.ver === "comecar" ? "sel" : ""}" data-sver="comecar" aria-pressed="${w.ver === "comecar"}" title="Mostrar só as para começar"><b>${comecar.length}</b><span>Para começar até ${fd(lim)}</span></button>
      <button class="kpi k-bloq ${w.ver === "espera" ? "sel" : ""}" data-sver="espera" aria-pressed="${w.ver === "espera"}" title="Mostrar só as à espera"><b>${espera.length}</b><span>À espera de outras atividades</span></button>
    </div>
    <div class="chips avisos" role="group" aria-label="Avisos de hoje">${AVISOS.map(([k, l, lista]) => `<button class="chip aviso ${lista.length ? "alerta" : ""} ${w.ver === k ? "on" : ""}" data-sver="${k}" aria-pressed="${w.ver === k}">${l} <span class="num">${lista.length}</span></button>`).join("")}</div>
    ${atencaoHTML({ max: 3, vist: false, fechavel: true })}
    <div class="chips" role="group" aria-label="Mostrar">${VER.map(([k, l]) => `<button class="chip ${w.ver === k ? "on" : ""}" data-sver2="${k}">${l}${k ? ` <span class="num" style="opacity:.65">${{ curso: emCurso, comecar, espera }[k].length}</span>` : ""}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${w.bloco === b ? "on" : ""}" data-sb="${b}">${b === "Geral" ? "Geral" : b ? "Bloco " + b : "Todos os blocos"}</button>`).join("")}</div>
    <div class="filters"><label class="f">Equipa<select class="inp" id="sEq"><option value="">Todas as equipas</option>${S.equipasTodas.map((e) => `<option ${w.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_sem" ${w.equipa === "_sem" ? "selected" : ""}>Sem equipa atribuída</option></select></label>${grupoSelectHTML("sGr", w.grupo)}</div>
    ${aviso ? secao(aviso[1], aviso[3], aviso[2], "auto", null) : ""}
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
      const sg = $("#sGr"); if (sg) sg.onchange = (e) => { w.grupo = e.target.value; render(); };
      document.querySelectorAll("[data-semver]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, PLANO_PADRAO(), { f: b.dataset.semver, bloco: w.bloco, equipa: w.equipa === "_sem" ? "" : w.equipa, grupo: w.grupo || "" }); }));
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
export const fdc = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
export function relatorioView() {
  // filtro de grupo de especialidades (Carpintaria, Pintura, ...): tudo passa a contar só com as atividades do grupo
  const gid = nomeGrupo(ui.relGrupo || "") ? ui.relGrupo : "", noG = filtroGrupo(gid), nomeG = gid ? nomeGrupo(gid) : "";
  const actsR = actsObra().filter(noG);
  const soma = () => ({ dur: 0, feito: 0, fim: null, n: 0, atr: 0, conc: 0, curso: 0, bloq: 0 });
  const junta = (b, a, r) => {
    const w = Math.max(1, r.dur || 0);
    b.dur += w; b.feito += (w * pctEfetiva(a)) / 100; b.n++;
    if (r.atrasada) b.atr++;
    if (r.estado === "concluida") b.conc++; else if (r.estado === "em_curso") b.curso++; else if (r.estado === "bloqueada") b.bloq++;
    if (!b.fim || r.provFim > b.fim) b.fim = r.provFim;
  };
  const tt = soma(), blocos = {}, porU = {};
  for (const a of actsR) {
    const u = S.uMap[a.unidade], r = S.res.get(a.id);
    if (!u || !r) continue;
    junta(tt, a, r);
    const k = u.tipo === "Loja" ? "Lojas" : u.bloco;
    junta((blocos[k] = blocos[k] || soma()), a, r);
    junta((porU[u.id] = porU[u.id] || soma()), a, r);
  }
  const t = gid ? { fim: tt.fim, concluida: tt.conc, n: tt.n, em_curso: tt.curso, atrasada: tt.atr, bloqueada: tt.bloq } : S.tot;
  const grupos = {};
  for (const a of actsR) {
    const r = S.res.get(a.id);
    if (r.estado === "concluida" || !(r.atraso > 0)) continue;
    const g = (grupos[nomeAtiv(a)] = grupos[nomeAtiv(a)] || { nome: nomeAtiv(a), max: 0, n: 0, us: [] });
    g.max = Math.max(g.max, r.atraso); g.n++; g.us.push(a.unidade);
  }
  const atrG = Object.values(grupos).sort((x, y) => y.max - x.max).slice(0, 12);
  const comentarios = actsR.filter((a) => a.fiscalNota && a.fiscalNotaEm).sort((x, y) => y.fiscalNotaEm.localeCompare(x.fiscalNotaEm)).slice(0, 15);
  const fr = S.unidades.filter((u) => porU[u.id]);
  const html = `
    <div class="rel-acoes no-print"><a class="back" href="#painel">Painel</a>
      <div class="row">${grupoSelectHTML("rGr", gid)}<button class="btn pri" id="rPrint">Imprimir ou guardar em PDF</button><button class="btn" id="rCsv">Descarregar tabela</button></div></div>
    <article class="rel">
      <header class="rel-h"><div><div class="eyebrow">Ponto de situação</div><h1>Obra ${esc(S.cfg.nome || "")}${nomeG ? ` · ${esc(nomeG)}` : ""}</h1></div><div class="rel-d">${fd(S.hoje, true)}</div></header>
      <section class="rel-kpis">
        <div><b>${fd(t.fim, true)}</b><span>fim previsto ${nomeG ? "do grupo" : "da obra"}</span></div>
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
      ${(() => { const an = analiseSegurar(), l = ordenarSeg(an.cands.filter((c) => noG(c.a)), "obra").slice(0, 8), g = ganhoEm(an.tudo, "obra");
        const ef = (e) => [e.obra > 0 ? `obra ${pl(e.obra, "dia", "dias")} mais cedo` : "", ...ORD_BLOCOS.filter((b) => e.blocos[b]).map((b) => `${rotuloAlvo(b).toLowerCase()} ${pl(e.blocos[b], "dia", "dias")}`), e.fr.length ? `${pl(e.fr.length, "fração ou zona", "frações ou zonas")} mais cedo, até ${pl(e.fr[0].g, "dia", "dias")}` : ""].filter(Boolean).join("; ");
        return `<h2>O que está a segurar a obra</h2>
      <p>${g > 0 ? `Se todos os atrasos de hoje ficassem resolvidos, a obra acabava ${pl(g, "dia", "dias")} mais cedo, a ${fd(addDays(an.fimO, -g), true)}.` : "Nenhum atraso de hoje está a empurrar o fim da obra: a data é decidida pelo plano."}${l.length ? ` Os trabalhos atrasados${nomeG ? " deste grupo" : ""} com mais efeito:` : nomeG ? " Nenhum trabalho atrasado deste grupo está a segurar a obra." : ""}</p>
      ${l.length ? `<table class="rel-t"><thead><tr><th>Trabalho</th><th>Fração</th><th>Equipa</th><th>Atraso</th><th>Se estivesse em dia</th></tr></thead><tbody>
      ${l.map((c) => `<tr><td>${esc(nomeAtiv(c.a))}</td><td class="mono">${esc(c.a.unidade)}</td><td>${esc(c.a.equipa || "")}</td><td class="num">${c.dias} dias</td><td>${esc(ef(c.ef))}</td></tr>`).join("")}</tbody></table>` : ""}`; })()}
      <h2>Maiores atrasos por especialidade</h2>
      ${atrG.length ? `<table class="rel-t"><thead><tr><th>Especialidade</th><th>Frações</th><th>Maior atraso</th><th>Onde</th></tr></thead><tbody>
      ${atrG.map((g) => `<tr><td>${esc(g.nome)}</td><td class="num">${g.n}</td><td class="num">${g.max} dias</td><td class="mono small rel-onde">${g.us.slice(0, 8).map((x) => `<span>${esc(x)}</span>`).join(", ")}${g.us.length > 8 ? " ..." : ""}</td></tr>`).join("")}</tbody></table>` : `<p>Sem atividades atrasadas.</p>`}
      <h2>Situação por fração</h2>
      <table class="rel-t"><thead><tr><th>Fração</th><th>Avanço</th><th>Concluídas</th><th>Em curso</th><th>Atrasadas</th><th>Fim previsto</th><th>Última vistoria</th></tr></thead><tbody>
      ${fr.map((u) => { const uv = ultimaVistoria(u), b = porU[u.id], p = b.dur ? Math.round((100 * b.feito) / b.dur) : 0; return `<tr><td class="mono">${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</td><td class="num">${p}%</td><td class="num">${b.conc}/${b.n}</td><td class="num">${b.curso}</td><td class="num">${b.atr}</td><td>${fd(b.fim, true)}</td><td>${uv ? fdc(uv.slice(0, 10)) : "nunca"}</td></tr>`; }).join("")}
      </tbody></table>
      ${comentarios.length ? `<h2>Últimos comentários da fiscalização</h2><ul class="rel-c">${comentarios.map((a) => `<li><b>${esc(a.unidade)} · ${esc(nomeAtiv(a))}</b> (${fdc(a.fiscalNotaEm.slice(0, 10))}): ${esc(a.fiscalNota)}</li>`).join("")}</ul>` : ""}
      <p class="note">${nomeG ? `Só as atividades do grupo ${esc(nomeG)}. ` : ""}Gerado pela aplicação de controlo de obra a ${fd(S.hoje, true)}. As datas são previsões, recalculadas com o estado real e a sequência dos trabalhos.</p>
    </article>`;
  return {
    html, bind: () => {
      $("#rPrint").onclick = () => { try { window.print(); } catch (e) { toast("Este navegador não deixa imprimir daqui."); } };
      $("#rCsv").onclick = () => descarregarCSV(noG, nomeG);
      const rg = $("#rGr"); if (rg) rg.onchange = (e) => { ui.relGrupo = e.target.value; render(); };
    },
  };
}
export function descarregarCSV(filtro = () => true, nomeG = "") {
  const cab = ["Fração", "Bloco", "Tipo", "Atividade", "Equipa", "Estado", "Atrasada", "Início previsto", "Fim previsto", "Atraso (dias)", "% empreiteiro", "% fiscal", "Início real", "Fim real", "Último comentário"];
  const q = (v) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const linhas = [cab.join(";")];
  for (const u of S.unidades) for (const a of u.acts) {
    if (!filtro(a)) continue;
    const r = S.res.get(a.id);
    linhas.push([u.id, u.bloco, u.tipo, nomeAtiv(a), a.equipa || "", ESTADO[r.estado], r.atrasada ? "sim" : "não", fdc(r.inicio), fdc(r.fim), r.atraso ?? "", Math.round(a.pctEmp ?? 0), a.pctFiscal == null ? "" : Math.round(a.pctFiscal), fdc(a.realInicio), r.estado === "concluida" ? fdc(a.realFim) : "", a.fiscalNota || ""].map(q).join(";"));
  }
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `obra-${(S.cfg.nome || "obra").toLowerCase()}${nomeG ? "-" + semAcento(nomeG).replace(/[^a-z0-9]+/g, "-") : ""}-${S.hoje}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Tabela descarregada", { anular: false });
}

/* ============================================================ pesquisa rápida */
export function pesquisaHTML(id) {
  return `<div class="psq" id="${id}"><input class="inp" type="search" placeholder="Procurar apartamento ou atividade" aria-label="Procurar" autocomplete="off"><div class="psq-r" hidden></div></div>`;
}
export function ligarPesquisa(root) {
  const inp = root.querySelector("input"), out = root.querySelector(".psq-r");
  let res = [];
  const norm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const procurar = () => {
    const q = norm(inp.value.trim());
    if (q.length < 2) { out.hidden = true; res = []; return; }
    const fr = S.unidades.filter((u) => norm(u.id + " " + u.nome).includes(q) || norm(u.id).replace(/-/g, "").includes(q.replace(/[-\s]/g, ""))).slice(0, 6).map((u) => ({ t: "u", u }));
    const termos = termosPesquisa(q);
    const nomes = [...new Set(Object.values(S.acts).map((a) => nomeAtiv(a)))].filter((n) => casaPesquisa(n, termos)).slice(0, 4).map((n) => ({ t: "n", n }));
    const at = Object.values(S.acts).filter((a) => casaPesquisa(nomeAtiv(a) + " " + a.unidade + " " + a.ref + " " + (a.equipa || ""), termos))
      .slice(0, 8).map((a) => ({ t: "a", a }));
    res = [...fr, ...nomes, ...at];
    out.innerHTML = res.length ? res.map((x, i) => x.t === "u" ? `<button data-pr="${i}"><span class="psq-k">Fração</span><b class="mono">${esc(x.u.id)}</b>${modeloTag(x.u.id)}<span class="note">${esc(x.u.tipo)} · ${x.u.pct}%</span></button>`
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
export function abrirPesquisaMovel() {
  if (document.querySelector(".psq-ov")) return;
  const ov = document.createElement("div");
  ov.className = "psq-ov";
  ov.innerHTML = `<div class="psq-ov-in">${pesquisaHTML("psqM")}<button class="btn" data-fecha>Fechar</button></div>`;
  document.body.appendChild(ov);
  ov.querySelector("[data-fecha]").onclick = () => ov.remove();
  ligarPesquisa(ov.querySelector(".psq"));
  ov.querySelector("input").focus();
}
