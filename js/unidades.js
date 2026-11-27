// Apartamentos, página da fração, vistoria e fotografias.
import { addDays, diffDays, pctEfetiva } from "../engine.js";
import { $, ESTADO, ICON, can, deltaHTML, erroSimples, esc, fd, fdt, reporFiltros, toast, ui } from "./base.js";
import { blocoLabel, eModelo, modeloTag, modelos, nomeAtiv } from "./calculo.js";
import { S, store } from "./estado.js";
import { bindDelUnidade, delUnidadeHTML, openNovaFracao } from "./nova.js";
import { render } from "./nucleo.js";
import { bindPendentes, pedirTexto, pendAberto, pendCriar, pendDe, pendFormHTML, pendListaHTML, pendVivo } from "./pendentes.js";
import { bindDateInputs, bindEstadoPct, confirmar, dateInput, estadoEdHTML, pctEdHTML, perguntar } from "./plano.js";
import { bindCommon } from "./previsao.js";
import { pl } from "./segurar.js";
import { DIAS_SEM, diaLocal, diaNome } from "./vistorias.js";

/* ============================================================ unidades */
export function segHTML(u) {
  const t = u.acts.length || 1;
  return `<div class="seg" title="${u.n.concluida} concluídas, ${u.n.em_curso} em curso, ${u.n.bloqueada} bloqueadas">
    <i style="width:${(100 * u.n.concluida) / t}%;background:var(--ok)"></i><i style="width:${(100 * u.n.em_curso) / t}%;background:var(--curso)"></i><i style="width:${(100 * u.n.bloqueada) / t}%;background:var(--bloq);opacity:.6"></i></div>`;
}
export const ultimaVistoria = (u) => u.acts.reduce((m, a) => [a.fiscalEm, a.fiscalNotaEm].reduce((mm, d) => (d && (!mm || d > mm) ? d : mm), m), null);
export function vizinhas(id) {
  const lista = S.unidades.map((u) => u.id);
  const i = lista.indexOf(id);
  return { ant: i > 0 ? lista[i - 1] : null, seg: i >= 0 && i < lista.length - 1 ? lista[i + 1] : null };
}
export function unidadesView() {
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
      <label class="check"><input type="checkbox" id="comPend" ${ui.comPend ? "checked" : ""}><span>Só as com pendentes por fechar</span></label><span class="note num ${nComPend ? "pd-cnt" : ""}">${nComPend} ${nComPend === 1 ? "fração" : "frações"} com pendentes</span>
      ${modelos().size ? `<label class="check"><input type="checkbox" id="soModelo" ${ui.soModelo ? "checked" : ""}><span>Só os andares modelo</span></label><span class="note num">${[...modelos()].join(", ")}</span>` : ""}</div>
    ${grupos.filter(([g]) => fil === "todos" || fil === g).map(([g, nome]) => {
      const us = S.unidades.filter((u) => u.bloco === g && (!ui.porVist || precisaVist(u)) && (!ui.comPend || nPendU(u)) && (!ui.soModelo || eModelo(u.id)));
      if (!us.length) return "";
      return `<section class="col" style="display:flex;flex-direction:column;gap:10px"><div class="grp">${nome}</div><div class="ucards">${us.map((u) => {
        const dv = u.atraso;
        const uv = ultimaVistoria(u);
        const np = nPendU(u);
        return `<a class="ucard ${np ? "tem-pend" : ""}" href="#u-${esc(u.id)}">
          <div class="ucard-h"><b>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" ? u.id : u.nome)}${modeloTag(u.id)}</b><span class="mono num">${u.pct}%</span></div>
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
    const sm = $("#soModelo"); if (sm) sm.onchange = () => { ui.soModelo = sm.checked; render(); };
    if (ui.porVist || ui.comPend || ui.soModelo) {
      if (!document.querySelector("#view .ucard")) document.querySelector("#view .ubar").insertAdjacentHTML("afterend", `<div class="empty">Nenhuma fração com estes filtros. <button class="btn sm" data-repor>Limpar filtros</button></div>`);
      document.querySelectorAll("#view .empty [data-repor]").forEach((b) => (b.onclick = reporFiltros));
    } } };
}

export function unidadeView(id) {
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
  // eliminar várias atividades desta fração (só o dono de obra)
  const delM = store.user.papel === "dono" && !!ui.uDel && ui.uDel.id === u.id && !edU;
  const delSel = delM ? ui.uDel.sel : new Set();
  // ponto de situação: o empreiteiro (ou o dono de obra) diz o estado e a percentagem de cada atividade, como o fiscal na vistoria
  const sitOK = can("executar") && !fiscal;
  const rowsAtiv = visiveis.map((a) => {
    const r = S.res.get(a.id);
    const espera = [...new Set(r.bloqueadaPor.map((pid) => S.acts[pid]).filter(Boolean).map((p) => nomeAtiv(p) + (p.unidade !== a.unidade ? " (" + p.unidade + ")" : "")))];
    const seguintes = [...new Set(r.succ.map((sid) => S.acts[sid]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))];
    const pe = a.pctEmp ?? 0, pf = a.pctFiscal;
    const dica = [ESTADO[r.estado] + (r.atrasada ? ", atrasada" : ""), a.equipa, espera.length && r.estado === "bloqueada" ? "À espera de: " + espera.join(", ") : "", seguintes.length ? "Segue-se: " + seguintes.join(", ") : ""].filter(Boolean).join(" · ");
    return `<div class="arow linha ${edU ? "editing" : ""} ${delM ? "udel" : ""} ${delSel.has(a.id) ? "udel-on" : ""}" ${edU || delM ? "" : `data-a="${a.id}"`} ${delM ? `data-udelrow="${a.id}"` : ""} title="${esc(dica)}">
      <span class="dot st-${r.estado}${r.atrasada ? " atr" : ""}" aria-label="${esc(ESTADO[r.estado] + (r.atrasada ? ", atrasada" : ""))}"></span>
      <div class="nm1">${delM ? `<input type="checkbox" class="udel-ck" data-udel="${a.id}" ${delSel.has(a.id) ? "checked" : ""} aria-label="Escolher ${esc(nomeAtiv(a))} para eliminar">` : ""}${edU ? `<button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button>` : `<b>${esc(nomeAtiv(a))}</b>`}${espera.length && r.estado === "bloqueada" ? `<span class="wait1">à espera de ${esc(espera[0])}${espera.length > 1 ? " +" + (espera.length - 1) : ""}</span>` : a.equipa ? `<span class="eq1">${esc(a.equipa)}</span>` : ""}${seguintes.length ? `<span class="seg1">segue-se ${esc(seguintes[0])}${seguintes.length > 1 ? " +" + (seguintes.length - 1) : ""}</span>` : ""}</div>
      <div class="tl" aria-hidden="true">
        <div class="fc st-${r.estado}" style="left:${pos(r.inicio)}%;width:${Math.max(0.8, pos(r.fim) - pos(r.inicio))}%"></div>
        ${S.hoje >= t0 && S.hoje <= t1 ? `<div class="today" style="left:${pos(S.hoje)}%"></div>` : ""}
      </div>
      <div class="dt1">${edU ? `${dateInput(a.id, "ini", r.estado === "concluida" ? a.realInicio || r.inicio : r.inicio)}${dateInput(a.id, "fim", r.estado === "concluida" ? a.realFim || r.fim : r.fim)}` : `<span class="mono num">${fd(r.inicio)} a ${fd(r.fim)}</span>`}</div>
      <div class="dv1">${deltaHTML(r.atraso)}</div>
      ${edU ? `<div class="pcts ed">${estadoEdHTML(a, r)}${pctEdHTML(a)}</div>` : `<div class="pcts" title="Empreiteiro / Fiscal"><span class="vf-slot" data-vfotos="${a.id}"></span>E <b>${Math.round(pe)}%</b> · F <b>${pf == null ? "s/v" : Math.round(pf) + "%"}</b></div>`}
    </div>`;
  }).join("");
  const nSit = sitOK ? visiveisSit(u).filter((a) => sitMudou(a) || sitFotosDe(a.id).fotos.length).length : 0;
  const rowsSit = sitOK && tab === "sit" ? visiveis.map((a) => {
    const r = S.res.get(a.id), s = sitAtual(a), mud = sitMudou(a), o = sitOrig(a);
    const espera = r.estado === "bloqueada" ? [...new Set(r.bloqueadaPor.map((pid) => S.acts[pid]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))] : [];
    const bt = (k, l) => `<button type="button" class="sb sb-${k} ${s.est === k ? "on" : ""}" data-sit="${a.id}|${k}" aria-pressed="${s.est === k}">${l}</button>`;
    const agora = o.est === "conc" ? "concluída" : o.est === "curso" ? `em curso, ${o.pct}%` : espera.length ? `à espera de ${espera[0]}${espera.length > 1 ? " +" + (espera.length - 1) : ""}` : "não iniciada";
    const sf = sitFotosDe(a.id), nf = sf.fotos.length;
    return `<div class="sitrow ${espera.length && s.est === "por" ? "espera" : ""} ${mud || nf ? "mudou" : ""}" id="sr-${a.id}">
      <div class="sit-nm"><button class="lnk-b" data-a="${a.id}" title="Abrir a ficha da atividade"><b>${esc(nomeAtiv(a))}</b></button><small>${mud ? `<span class="sit-alt">Por guardar</span> · era ` : nf ? `<span class="sit-alt">${nf === 1 ? "1 fotografia" : nf + " fotografias"} por guardar</span> · ` : "Agora: "}${esc(agora)}</small></div>
      <div class="sit-fx"><span class="vf-slot" data-vfotos="${a.id}"></span>${can("foto") ? fotoPickerHTML("f~" + a.id, nf) : ""}</div>
      <div class="sit-est" role="group" aria-label="Estado de ${esc(nomeAtiv(a))}">${bt("por", "Não iniciada")}${bt("curso", "Em curso")}${bt("conc", "Concluída")}</div>
      ${s.est === "curso" ? `<div class="sit-pct">${pctCtlHTML("s~" + a.id, s.pct, mud && s.pct !== o.pct)}</div>` : ""}
      ${nf ? `<div class="sit-fotos">${pendentesHTML("f~" + a.id, sf.fotos)}<input class="inp" data-sfn="${a.id}" value="${esc(sf.nota || "")}" placeholder="Nota das fotografias (opcional): o que mostram"></div>` : ""}
    </div>`;
  }).join("") : "";
  const segSit = vizinhas(u.id).seg;
  const barraConc = `<div class="ubar"><label class="check"><input type="checkbox" id="uSemConc" ${ui.uSemConc ? "checked" : ""}><span>Esconder concluídas</span></label>
    <span class="note num">${ui.uSemConc ? `${visiveis.length} por concluir · ${nConcl} concluída${nConcl === 1 ? "" : "s"} escondida${nConcl === 1 ? "" : "s"}` : `${u.acts.length} atividades`}</span>
    <span class="legend" style="margin-left:auto"><span><i class="dot st-concluida"></i>Concluída</span><span><i class="dot st-em_curso"></i>Em curso</span><span><i class="dot st-bloqueada"></i>Bloqueada</span><span><i class="dot st-por_iniciar"></i>Por iniciar</span><span><i class="dot st-por_iniciar atr"></i>Atrasada</span></span></div>`;
  const temMud = (v) => v.pct != null || (v.fotos && v.fotos.length) || (v.coment && v.coment.trim());
  // vista: já mexeu nesta vistoria, ou já foi vistoriada hoje
  // a corrigir uma vistoria passada: "vista" é o que ficou registado nesse dia
  const corrDia = fiscal ? vistCorrDia() : "";
  const regsDia = corrDia ? regsDoDia(u.id, corrDia) : {};
  const vista = (a) => { const v = ui.vistoria[a.id]; return !!(v && (temMud(v) || v.confirmado)) || (corrDia ? !!regsDia[a.id] : !!(a.fiscalEm && diaLocal(a.fiscalEm) === S.hoje)); };
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
        ${a.fiscalNota ? `<small class="vult">Último comentário: ${esc(a.fiscalNota)}${can("vistoria") ? ` <button type="button" class="vult-ed" data-vced="${a.id}" title="Corrigir este comentário" aria-label="Corrigir o último comentário de ${esc(nomeAtiv(a))}">${ICON.lapis}</button>` : ""}</small>` : ""}
        ${corrDia ? `<small class="vcorr-n ${regsDia[a.id] ? "" : "nao"}">${regsDia[a.id] ? `A ${fd(corrDia)} ficou ${(() => { const d = regsDia[a.id].dados || {}; return [d.depois != null ? `<b>${d.depois}%</b>` : "sem percentagem", d.nota ? "com comentário" : "", d.nfotos ? pl(d.nfotos, "fotografia", "fotografias") : ""].filter(Boolean).join(", "); })()}` : `A ${fd(corrDia)} não foi registada`}</small>` : ""}</div>
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
      <div><div class="eyebrow">${esc(u.tipo)}${u.bloco !== "Geral" ? " · " + blocoLabel(u.bloco) : ""}${u.tipo === "Apartamento" ? " · piso " + u.piso : ""}${store.user.papel === "dono" && (u.tipo === "Apartamento" || u.tipo === "Loja") && !u.teste ? ` <button class="btn sm ghost mod-tg" data-modelo="${esc(u.id)}" aria-pressed="${eModelo(u.id)}">${eModelo(u.id) ? "Deixar de ser andar modelo" : "Marcar como andar modelo"}</button>` : ""}</div><h1>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" ? u.id : u.nome)}${modeloTag(u.id)}</h1></div>
      <div class="stats">
        <div class="stat"><b class="num">${u.pct}%</b><span>avanço</span></div>
        <div class="stat"><b>${fd(u.fim)}</b><span>fim previsto ${deltaHTML(dv)}</span></div>
        <div class="stat"><b class="num">${u.n.concluida}/${u.acts.length}</b><span>concluídas</span></div>
      </div>
    </div>
    ${segHTML(u)}
    <div class="tabs">
      ${fiscal ? `<button data-tab="vist" class="${tab === "vist" ? "on" : ""}">Vistoria</button>` : ""}
      ${sitOK ? `<button data-tab="sit" class="${tab === "sit" ? "on" : ""}">Ponto de situação${nSit ? ` <span class="tab-n">${nSit}</span>` : ""}</button>` : ""}
      <button data-tab="ativ" class="${tab === "ativ" || (tab === "vist" && !fiscal) || (tab === "sit" && !sitOK) ? "on" : ""}">Atividades</button>
      <button data-tab="pend" class="${tab === "pend" ? "on" : ""}">Pendentes${nPend ? ` <span class="tab-n">${nPend}</span>` : ""}</button>
      <button data-tab="fotos" class="${tab === "fotos" ? "on" : ""}">Fotografias</button>
      ${can("executar") && tab !== "vist" && tab !== "sit" && tab !== "fotos" && tab !== "pend" && !delM ? `<button id="uEdit" class="tab-act ${edU ? "on" : ""}">${edU ? "Terminar edição" : "Editar datas"}</button>` : ""}
      ${store.user.papel === "dono" && tab !== "vist" && tab !== "sit" && tab !== "fotos" && tab !== "pend" && !edU && u.acts.length ? `<button id="uDelM" class="tab-act ${delM ? "on" : ""}">${delM ? "Cancelar eliminar" : "Eliminar várias"}</button>` : ""}
    </div>
    ${delM && tab !== "pend" && tab !== "fotos" && tab !== "sit" ? `<div class="banner warn udel-bar"><span>Escolha as atividades de ${esc(u.id)} que quer eliminar. <b class="num" id="uDelN">${delSel.size ? `${delSel.size} escolhida${delSel.size === 1 ? "" : "s"}` : "Nenhuma escolhida"}</b></span>
      <span class="row" style="gap:6px"><button class="btn sm" id="uDelTodas">${visiveis.length && visiveis.every((a) => delSel.has(a.id)) ? "Tirar todas" : "Escolher todas as que estão à vista"}</button><button class="btn sm warn" id="uDelOk" ${delSel.size ? "" : "disabled"}>Eliminar ${delSel.size || ""} ${delSel.size === 1 ? "atividade" : "atividades"}</button><button class="btn sm ghost" id="uDelNao">Cancelar</button></span></div>` : ""}
    ${edU && tab === "ativ" ? `<div class="banner">Altere as datas e a percentagem de cada atividade, ou toque no estado para a iniciar ou concluir hoje. Cada alteração fica guardada logo e as atividades seguintes acertam-se sozinhas.</div>` : ""}
    ${tab === "vist" && fiscal ? `<section class="pd-vist ${pendVist.length ? "" : "vazio"}"><div class="card-h"><h2>Pendentes deste apartamento <span class="note num">${pendVist.length}</span></h2>
          <button class="btn sm" data-pdabrir>${(ui.pdFormAberto || {})[u.id] ? "Fechar" : "+ Novo pendente"}</button></div>
        ${pendVist.length ? `<p class="note" style="margin:0">Se já está bem, carregue em «Concluído?»; se não, em «Ainda não está».</p><div class="pd-lista">${pendListaHTML(pendVist, { semFechados: true, resolvidosPrimeiro: true })}</div>` : ""}
        ${(ui.pdFormAberto || {})[u.id] ? pendFormHTML(u.id) : ""}</section>
      ${vistDiaHTML(u.id, corrDia)}
      <label class="f">Nota da vistoria (opcional)<input class="inp" id="vnota" value="${esc(ui.vnota || "")}" placeholder="Ex.: humidade no teto do WC, falta silicone na base de duche"></label>
      ${barraConc}
      <div class="arows">${rowsVist || `<div class="empty">Tudo concluído nesta fração.</div>`}</div>
      <h3 style="margin-top:6px">Fotografias desta fração</h3>
      <p class="note" style="margin:0">Toque no × para apagar uma fotografia já guardada (só as suas, ou todas se for o dono de obra).</p>
      <div id="vfotos" class="photos"><div class="note">A carregar fotografias...</div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn sm" data-relhoje>${corrDia ? `Ver o relatório de ${fd(corrDia)}` : "Ver o relatório de hoje"}</button></div>
      <div class="vbar"><span class="vb-l"><b class="num" id="vvis">Vistas ${nVistas} de ${visiveis.length}</b>${nVistas < visiveis.length ? `<button class="btn sm ghost vb-seg" id="vseg" title="Ir para a próxima especialidade por ver">Seguinte ›</button>` : ""}</span>
        <button class="btn pri" id="vsave" ${nChg ? "" : "disabled"}>${nChg ? `${corrDia ? "Guardar correção" : "Guardar"} (${nChg})` : "Nada por guardar"}</button></div>`
      : tab === "sit" && sitOK ? `<p class="note" style="margin:0">Toque no estado de cada atividade. Em curso: escolha a percentagem. Concluída fica concluída hoje. Com o botão da câmara junta fotografias de cada atividade, tiradas na hora ou da galeria. No fim carregue em Guardar, que grava tudo de uma vez.</p>
        ${barraConc}
        <div class="sitrows">${rowsSit || `<div class="empty">${u.acts.length ? "Tudo concluído nesta fração. Desligue \"Esconder concluídas\" para ver as concluídas." : "Esta fração ainda não tem atividades."}</div>`}</div>
        <div class="vbar sitbar"><span class="vb-l"><b class="num">${nSit ? `${nSit} por guardar` : "Nada por guardar"}</b>${nSit ? `<button class="btn sm ghost vb-seg" id="sitDesf">Desfazer</button>` : ""}</span>
          <span class="sitbar-b">${segSit ? `<button class="btn sm ghost vb-seg" id="sitSeg" title="Ir para a fração seguinte">${esc(segSit)} ›</button>` : ""}<button class="btn pri" id="sitSave" ${nSit ? "" : "disabled"}>${nSit ? `Guardar (${nSit})` : "Guardar"}</button></span></div>`
      : tab === "pend" ? `<p class="note" style="margin:0">Pontos por resolver nesta fração, à vista de todos. O empreiteiro marca como resolvido e o fiscal verifica na vistoria seguinte.</p>
        ${pendFormHTML(u.id)}
        <div class="pd-lista">${pendListaHTML(pendDe(u.id))}</div>`
      : tab === "fotos" ? `<div id="fotos" class="photos"><div class="note">A carregar fotografias...</div></div>`
      : `${barraConc}<div class="arows">${rowsAtiv || `<div class="empty">${u.acts.length ? "Tudo concluído nesta fração. Desligue \"Esconder concluídas\" para ver o histórico." : can("criar") ? "Esta fração ainda não tem atividades. Crie a primeira com + Nova atividade nesta fração, lá em cima." : "Esta fração ainda não tem atividades."}</div>`}</div>
         <p class="note">Barra: previsão. Traço vermelho: hoje. E e F: percentagem declarada pelo empreiteiro e verificada pelo fiscal. Passe o rato por cima de uma linha para ver o detalhe.</p>`}
    ${store.user.papel === "dono" && tab !== "vist" ? `<div class="perigo">${ui.delUnit && ui.delUnit.id === u.id ? delUnidadeHTML(u) : `<button class="btn sm ghost perigo-b" id="delU">Eliminar esta fração</button><span class="note">Apaga a fração e todas as suas atividades. ${u.teste ? "Pede o código para confirmar." : "Pede confirmação três vezes."}</span>`}</div>` : ""}`;
  if (tab === "vist" && !fiscal) ui.unidadeTab = "ativ";
  if (tab === "sit" && !sitOK) ui.unidadeTab = "ativ";
  return { html, bind: () => bindUnidade(u) };
}
export function bindUnidade(u) {
  bindCommon();
  bindPendentes(document.querySelector("#view"));
  bindDelUnidade(u);
  const ue = $("#uEdit"); if (ue) ue.onclick = () => { ui.unitEdit = !ui.unitEdit; render(); };
  bindEliminarVarias(u);
  if (ui.unidadeTab === "sit") bindSit(u);
  const usc = $("#uSemConc"); if (usc) usc.onchange = () => { ui.uSemConc = usc.checked; render(); };
  bindDateInputs(document.querySelector("#view") || document);
  bindEstadoPct(document.querySelector("#view") || document);
  document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { ui.unidadeTab = b.dataset.tab; render(); }));
  if (ui.unidadeTab !== "sit") bindPctCtl(document.querySelector("#view") || document,
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
    view.querySelectorAll("[data-vced]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); editarComentario(b.dataset.vced); }));
    view.querySelectorAll("[data-vc]").forEach((b) => (b.onclick = () => { const v = vist(b.dataset.vc); v.abrirC = !v.abrirC || !!(v.coment && v.coment.length); render(); const i = view.querySelector(`[data-vct="${b.dataset.vc}"]`); if (i) i.focus(); }));
    const contar = () => {
      const n = Object.values(ui.vistoria).filter((v) => v.unidade === u.id && (v.pct != null || (v.fotos && v.fotos.length) || (v.coment && v.coment.trim()))).length;
      const sb = $("#vsave");
      if (sb) { sb.disabled = !n; sb.textContent = n ? `${vistCorrDia() ? "Guardar correção" : "Guardar"} (${n})` : "Nada por guardar"; }
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
    // corrigir uma vistoria passada: tudo fica nesse dia, depois do que já lá estava
    const corrDia = vistCorrDia();
    sv.disabled = true;
    if (corrDia) await carregarHistVist(true);
    const emV = corrDia ? emCorrecao(corrDia) : agora;
    const naoAplic = [];
    let n = 0;
    for (const [id, v] of Object.entries(ui.vistoria)) {
      if (v.unidade !== u.id) continue;
      const coment = (v.coment || "").trim();
      if (v.pct == null && !(v.fotos && v.fotos.length) && !coment) { delete ui.vistoria[id]; continue; }
      const a = S.acts[id];
      const texto = [coment, nota].filter(Boolean).join(". ");
      const nf = (v.fotos || []).length;
      for (const f of v.fotos || []) await store.addFoto(id, u.id, f, texto, corrDia ? emV : undefined);
      const patch = {};
      // numa correção, a atividade só muda se não houver uma vistoria mais recente do que esse dia
      const maisRecente = (quando) => !!(corrDia && quando && quando > emV);
      if (v.pct != null && !maisRecente(a.fiscalEm)) Object.assign(patch, { pctFiscal: v.pct, fiscalEm: emV, fiscalPor: store.user.email });
      else if (v.pct != null) naoAplic.push(nomeAtiv(a));
      if (texto && !maisRecente(a.fiscalNotaEm)) Object.assign(patch, { fiscalNota: texto, fiscalNotaEm: emV });
      const ref = corrDia ? refCorrecao(a, corrDia) : null;
      const emp = ref && ref.emp != null ? ref.emp : Math.round(Number(a.pctEmp) || 0);
      const partes = [v.pct != null ? `${v.pct}% (empreiteiro dizia ${emp}%)${v.confirmado ? ", confirmado sem alteração" : ""}` : "", nf ? `${nf} fotografia${nf > 1 ? "s" : ""}` : "", texto ? "comentário: " + texto : ""].filter(Boolean);
      const antes = ref ? ref.antes : a.pctFiscal != null ? Math.round(a.pctFiscal) : null;
      const confirmado = !!v.confirmado && v.pct != null && v.pct === (antes != null ? antes : emp);
      const dados = { esp: nomeAtiv(a), antes, depois: v.pct ?? null, emp, nota: texto || null, nfotos: nf, confirmado, ...(corrDia ? { correcao: true } : {}) };
      await store.updateAtividade(id, patch, corrDia
        ? { tipo: "vistoria", em: emV, corrigidoEm: agora, texto: `Correção da vistoria de ${fd(corrDia, true)}, ${nomeAtiv(a)} em ${a.unidade}: ${partes.join(", ")}`, dados }
        : { tipo: "vistoria", texto: `Vistoria ${nomeAtiv(a)} em ${a.unidade}: ${partes.join(", ")}`, dados });
      delete ui.vistoria[id]; n++;
    }
    ui.vnota = "";
    const seg = vizinhas(u.id).seg;
    if (corrDia) await carregarHistVist(true);
    const msg = corrDia ? `Correção guardada na vistoria de ${fd(corrDia, true)} (${n} especialidade${n > 1 ? "s" : ""})${naoAplic.length ? `. Em ${naoAplic.join(", ")}, a percentagem atual não mudou porque há uma vistoria mais recente` : ""}`
      : `Vistoria guardada (${n} especialidade${n > 1 ? "s" : ""})`;
    toast(msg, seg ? { acao: { label: `Seguinte: ${seg}`, fn: () => (location.hash = "#u-" + seg) } } : {});
    render();
  };
  const rh = document.querySelector("[data-relhoje]");
  if (rh) rh.onclick = () => { ui.relVist = { dias: [vistCorrDia() || diaLocal(new Date().toISOString())], por: store.user.email }; location.hash = "#relvist"; };
  bindVistDia(u.id);
  if (ui.unidadeTab === "fotos") loadFotos(u.id, $("#fotos"));
  botoesFotosLinhas(u.id, document.querySelector("#view") || document);
}
/* ============================================================ corrigir uma vistoria passada
   Por defeito, o que o fiscal guarda é a vistoria de hoje. Se escolher um dia anterior, o que guardar fica nesse dia
   (no relatório desse dia, marcado como correção), um segundo depois do último registo que já lá estava. */
export const vistCorrDia = () => (ui.vistCorr && ui.vistCorr.dia && ui.vistCorr.dia < S.hoje ? ui.vistCorr.dia : "");
/** Registos de vistoria (sem os dos pendentes), carregados uma vez por sessão para escolher e corrigir dias. */
export async function carregarHistVist(forcar) {
  if (ui.vistHist && !forcar && ui.vistHist.por === store.user.email) return ui.vistHist;
  let regs = [];
  try { regs = (await store.getRegistosTipo("vistoria")).filter((r) => !r.pend && r.em && !r.relApagado); } catch (e) { regs = ui.vistHist ? ui.vistHist.regs : []; }
  ui.vistHist = { por: store.user.email, regs };
  return ui.vistHist;
}
export const histRegs = () => (ui.vistHist ? ui.vistHist.regs : []);
/** Dias anteriores em que quem está a usar a aplicação fez vistoria nesta fração (os mais recentes primeiro). */
export function diasVistFracao(uid) {
  const m = new Map();
  for (const r of histRegs()) {
    if (r.por !== store.user.email || r.unidade !== uid) continue;
    const d = diaLocal(r.em);
    if (d >= S.hoje) continue;
    const x = m.get(d) || { dia: d, ativs: new Set() };
    if (r.ativ) x.ativs.add(r.ativ);
    m.set(d, x);
  }
  return [...m.values()].sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 15);
}
/** O que ficou registado nesse dia em cada atividade da fração (o último registo do dia, de quem corrige). */
export function regsDoDia(uid, dia) {
  const out = {};
  for (const r of histRegs()) if (r.unidade === uid && r.ativ && r.por === store.user.email && diaLocal(r.em) === dia && (!out[r.ativ] || r.em > out[r.ativ].em)) out[r.ativ] = r;
  return out;
}
/** Hora a dar à correção: um segundo depois do último registo desse dia (para ser o valor final do dia), ou às 18h. */
export function emCorrecao(dia) {
  let ult = null;
  for (const r of histRegs()) if (r.por === store.user.email && diaLocal(r.em) === dia && (!ult || r.em > ult)) ult = r.em;
  const fimDia = new Date(dia + "T23:59:59").getTime();
  return new Date(ult ? Math.min(new Date(ult).getTime() + 1000, fimDia) : new Date(dia + "T18:00:00").getTime()).toISOString();
}
/** Percentagem do fiscal antes desse dia e a do empreiteiro nesse dia, para o registo da correção. */
export function refCorrecao(a, dia) {
  const ini = new Date(dia + "T00:00:00").toISOString();
  const doDia = histRegs().filter((r) => r.ativ === a.id && diaLocal(r.em) === dia).sort((x, y) => x.em.localeCompare(y.em));
  const d0 = doDia.length && doDia[0].dados ? doDia[0].dados : null;
  if (d0 && "antes" in d0) return { antes: d0.antes, emp: d0.emp };
  const ant = histRegs().filter((r) => r.ativ === a.id && r.em < ini).sort((x, y) => y.em.localeCompare(x.em))[0];
  if (ant) return { antes: ant.dados && ant.dados.depois != null ? ant.dados.depois : null, emp: null };
  return { antes: a.pctFiscal != null && a.fiscalEm && a.fiscalEm < ini ? Math.round(a.pctFiscal) : null, emp: null };
}
export const diaCurto = (dia) => `${DIAS_SEM[new Date(dia + "T12:00:00").getDay()]}, ${fd(dia, dia.slice(0, 4) !== S.hoje.slice(0, 4))}`;
/** Corrigir o último comentário do fiscal ali mesmo (lápis). A correção fica no dia em que o comentário foi escrito
 *  e o relatório desse dia passa a mostrar só o texto novo; o antigo fica no histórico da atividade. */
export async function editarComentario(id) {
  const a = S.acts[id];
  if (!a || !a.fiscalNota || !can("vistoria")) return;
  const antigo = a.fiscalNota, quando = a.fiscalNotaEm || a.fiscalEm || null;
  const dia = quando ? diaLocal(quando) : S.hoje, N = `${nomeAtiv(a)} em ${a.unidade}`;
  const novo = await pedirTexto({
    titulo: "Corrigir o comentário",
    texto: `<p class="note" style="margin-top:0">${esc(N)}, comentário ${quando ? `da vistoria de ${esc(fdt(quando))}` : "de uma vistoria anterior"}. A correção fica nesse dia e o relatório desse dia passa a mostrar o texto novo. Para apagar o comentário, deixe a caixa em branco.</p>`,
    valor: antigo, sim: "Guardar correção",
  });
  if (novo == null || novo === antigo) return;
  if (!novo && !(await confirmar("Apagar o comentário?", `<p>«${esc(antigo)}» deixa de aparecer em ${esc(N)} e no relatório de ${fd(dia, true)}. Continua no histórico da atividade.</p>`, "Sim, apagar"))) return;
  try {
    if (dia < S.hoje) await carregarHistVist(true);
    const agora = new Date().toISOString();
    const em = dia < S.hoje ? emCorrecao(dia) : agora;
    const dados = { esp: nomeAtiv(a), antes: null, depois: null, emp: null, nota: novo || null, notaSubstitui: antigo, nfotos: 0, confirmado: false, correcao: true };
    await store.updateAtividade(id, { fiscalNota: novo || null }, { tipo: "vistoria", em, corrigidoEm: agora, dados,
      texto: novo ? `Corrigiu o comentário da vistoria de ${fd(dia, true)}, ${N}: «${novo}» (era «${antigo}»)` : `Apagou o comentário da vistoria de ${fd(dia, true)}, ${N} (era «${antigo}»)` });
    if (dia < S.hoje) await carregarHistVist(true);
    toast(novo ? `Comentário corrigido${dia < S.hoje ? ` na vistoria de ${fd(dia, true)}` : ""}` : "Comentário apagado", { anular: false });
    render();
  } catch (e) { toast("Não foi possível guardar: " + erroSimples(e), { anular: false }); }
}
export function vistDiaHTML(uid, corrDia) {
  const dias = diasVistFracao(uid);
  return `<div class="vcorr-sel"><label class="f">Dia da vistoria<select class="inp" id="vDia">
      <option value="">Hoje, ${fd(S.hoje)}: vistoria nova</option>
      ${dias.map((x) => `<option value="${x.dia}" ${corrDia === x.dia ? "selected" : ""}>Corrigir ${diaCurto(x.dia)} · ${pl(x.ativs.size, "especialidade", "especialidades")}</option>`).join("")}
      ${corrDia && !dias.some((x) => x.dia === corrDia) ? `<option value="${corrDia}" selected>Corrigir ${diaCurto(corrDia)}</option>` : ""}
      <option value="__outro">Outro dia...</option></select></label>
    ${ui.vistOutro ? `<label class="f">Que dia?<input class="inp" type="date" id="vDiaOutro" min="${addDays(S.hoje, -120)}" max="${addDays(S.hoje, -1)}"></label>` : ""}
    ${!ui.vistHist ? `<span class="note">A procurar as vistorias anteriores...</span>` : ""}</div>
    ${corrDia ? `<div class="banner warn vcorr-b"><span><b>Está a corrigir a vistoria de ${diaNome(corrDia)}.</b> O que guardar agora fica nesse dia e aparece no relatório desse dia, marcado como correção. Se uma especialidade já teve uma vistoria mais recente, a percentagem atual dela não muda.</span><button class="btn sm" data-vhoje>Voltar a hoje</button></div>` : ""}`;
}
export function bindVistDia(uid) {
  const sel = $("#vDia");
  if (!sel) return;
  sel.onchange = () => {
    if (sel.value === "__outro") { ui.vistOutro = true; render(); const i = $("#vDiaOutro"); if (i) { i.focus(); try { i.showPicker && i.showPicker(); } catch (e) {} } return; }
    ui.vistOutro = false;
    ui.vistCorr = sel.value ? { dia: sel.value } : null;
    render();
  };
  const outro = $("#vDiaOutro");
  if (outro) outro.onchange = () => {
    if (!outro.value) return;
    if (outro.value >= S.hoje) { toast("Escolha um dia anterior a hoje.", { anular: false }); return; }
    ui.vistCorr = { dia: outro.value }; ui.vistOutro = false; render();
  };
  document.querySelectorAll("[data-vhoje]").forEach((b) => (b.onclick = () => { ui.vistCorr = null; ui.vistOutro = false; render(); }));
  if (!ui.vistHist) carregarHistVist().then(() => { if (location.hash === "#u-" + uid && ui.unidadeTab === "vist") render(); });
}
/* ============================================================ percentagem com botões grandes */
export function pctCtlHTML(key, val, mudou) {
  return `<div class="pctc ${mudou ? "mudou" : ""}" role="group" aria-label="Percentagem verificada">
    ${[0, 25, 50, 75, 100].map((p) => `<button type="button" class="pb ${val === p ? "on" : ""}" data-pv="${key}|${p}">${p}</button>`).join("")}
    <span class="psep"></span>
    <button type="button" class="pb pm" data-pv="${key}|-5" aria-label="Menos 5 por cento">−</button>
    <span class="pval num">${val == null ? "Não vi" : val + "%"}</span>
    <button type="button" class="pb pm" data-pv="${key}|+5" aria-label="Mais 5 por cento">+</button>
  </div>`;
}
/** Liga os botões de percentagem: onSet(key, novoValor), base(key) dá o valor atual para os −/+. */
export function bindPctCtl(root, base, onSet) {
  root.querySelectorAll("[data-pv]").forEach((b) => (b.onclick = () => {
    const [key, v] = b.dataset.pv.split("|");
    let val;
    if (v === "+5" || v === "-5") val = Math.max(0, Math.min(100, (base(key) ?? 0) + Number(v)));
    else val = Number(v);
    onSet(key, val);
  }));
}
/* ============================================================ fotografias: escolher origem, pré-visualizar, apagar */
export function fotoPickerHTML(key, n, texto) {
  return `<div class="fpick"><button type="button" class="btn sm" data-fp="${key}" aria-haspopup="menu" title="Juntar fotografia">${ICON.camera}${texto ? `<span>${texto}</span>` : ""}${n ? `<span class="num fcnt">${n}</span>` : ""}</button>
    <div class="fmenu" role="menu" hidden data-fm="${key}">
      <label class="fopt" role="menuitem">${ICON.camera}<span><b>Tirar fotografia</b><small>Abre a câmara</small></span><input type="file" accept="image/*" capture="environment" data-fin="${key}" hidden></label>
      <label class="fopt" role="menuitem">${ICON.galeria}<span><b>Escolher fotografias</b><small>Da galeria do telemóvel ou do computador</small></span><input type="file" accept="image/*" multiple data-fin="${key}" hidden></label>
    </div></div>`;
}
export function bindFotoPickers(root, onFiles) {
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
export function pendentesHTML(key, fotos) {
  if (!fotos || !fotos.length) return "";
  return `<div class="pend">${fotos.map((f, i) => `<div class="pth"><img src="${f}" alt="Fotografia por guardar"><button type="button" data-prm="${key}|${i}" aria-label="Retirar fotografia" title="Retirar">×</button></div>`).join("")}<span class="note">${fotos.length} por guardar</span></div>`;
}
export const podeApagarFoto = (f) => store.user && (store.user.papel === "dono" || f.por === store.user.email);

export async function loadFotos(unidade, el, ativ) {
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
export function abrirGaleria(fotos, i0, depoisApagar) {
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
export async function botoesFotosLinhas(unidade, root) {
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
export function compress(file, max = 1400) {
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

/** Eliminar várias atividades de uma fração de uma vez (dono de obra), com confirmação e Anular. */
function bindEliminarVarias(u) {
  const bm = $("#uDelM");
  if (bm) bm.onclick = () => { ui.uDel = ui.uDel && ui.uDel.id === u.id ? null : { id: u.id, sel: new Set() }; ui.unitEdit = false; render(); };
  if (!ui.uDel || ui.uDel.id !== u.id) return;
  const sel = ui.uDel.sel;
  const marca = (id, on) => { if (on) sel.add(id); else sel.delete(id); render(); };
  document.querySelectorAll("[data-udelrow]").forEach((row) => (row.onclick = (e) => {
    if (e.target.closest("[data-vfotos], .vf-slot, a")) return;
    const id = row.dataset.udelrow;
    marca(id, e.target.matches("[data-udel]") ? e.target.checked : !sel.has(id));
  }));
  const nao = $("#uDelNao"); if (nao) nao.onclick = () => { ui.uDel = null; render(); };
  const todas = $("#uDelTodas");
  if (todas) todas.onclick = () => {
    const vis = [...document.querySelectorAll("[data-udelrow]")].map((r) => r.dataset.udelrow);
    const tudo = vis.length && vis.every((id) => sel.has(id));
    for (const id of vis) { if (tudo) sel.delete(id); else sel.add(id); }
    render();
  };
  const ok = $("#uDelOk");
  if (ok) ok.onclick = async () => {
    const ids = [...sel].filter((id) => S.acts[id]);
    if (!ids.length) return;
    const nomes = ids.map((id) => nomeAtiv(S.acts[id])).sort((a, b) => a.localeCompare(b, "pt"));
    const nConc = ids.filter((id) => S.res.get(id) && S.res.get(id).estado === "concluida").length;
    const set = new Set(ids);
    // atividades de outras frações (ou desta, que ficam) que esperavam por estas
    const fora = [...new Set(ids.flatMap((id) => (S.res.get(id) ? S.res.get(id).succ : [])).filter((x) => !set.has(x)))].map((x) => S.acts[x]).filter(Boolean);
    const sim = await confirmar(`Eliminar ${ids.length} ${ids.length === 1 ? "atividade" : "atividades"} de ${esc(u.id)}?`,
      `<ul class="dlg-l">${nomes.slice(0, 12).map((n) => `<li>${esc(n)}</li>`).join("")}${nomes.length > 12 ? `<li>e mais ${nomes.length - 12}</li>` : ""}</ul>
      ${nConc ? `<div class="dlg-av">${nConc === 1 ? "Uma delas já está concluída." : `${nConc} delas já estão concluídas.`}</div>` : ""}
      ${fora.length ? `<p>${fora.length === 1 ? "Há 1 atividade" : `Há ${fora.length} atividades`} que ${fora.length === 1 ? "esperava" : "esperavam"} por estas e ${fora.length === 1 ? "deixa" : "deixam"} de esperar: ${esc(fora.slice(0, 4).map((x) => nomeAtiv(x) + (x.unidade !== u.id ? " (" + x.unidade + ")" : "")).join(", "))}${fora.length > 4 ? "..." : ""}.</p>` : ""}
      <p class="note">As fotografias e o histórico ficam guardados. Logo a seguir pode Anular.</p>`, `Sim, eliminar ${ids.length}`);
    if (!sim) return;
    const copia = ids.map((id) => JSON.parse(JSON.stringify(S.acts[id])));
    ui.uDel = null;
    try {
      await store.removeAtividades(ids, { tipo: "eliminar", texto: `Eliminou ${ids.length} ${ids.length === 1 ? "atividade" : "atividades"} de ${u.id}: ${nomes.join(", ")}` });
    } catch (e) { toast("Não foi possível eliminar: " + erroSimples(e), { anular: false }); return; }
    toast(`${ids.length} ${ids.length === 1 ? "atividade eliminada" : "atividades eliminadas"} de ${u.id}`, { anular: false, acao: { label: "Anular", fn: async () => {
      await store.addAtividades(copia, null, { tipo: "anular", texto: `Anulou a eliminação de ${copia.length} ${copia.length === 1 ? "atividade" : "atividades"} de ${u.id}` });
      toast("Eliminação anulada: as atividades voltaram", { anular: false });
    } } });
  };
}

/* ============================================================ ponto de situação do empreiteiro */
/** Estado gravado de uma atividade, nos termos do ponto de situação. */
export const sitOrig = (a) => { const r = S.res.get(a.id); return { est: r && r.estado === "concluida" ? "conc" : a.realInicio ? "curso" : "por", pct: Math.round(Number(a.pctEmp) || 0) }; };
export const sitAtual = (a) => { const o = sitOrig(a), m = ui.sit && ui.sit[a.id]; return m ? { est: m.est, pct: m.pct } : o; };
export const sitMudou = (a) => { const o = sitOrig(a), m = ui.sit && ui.sit[a.id]; return !!m && (m.est !== o.est || (m.est === "curso" && m.pct !== o.pct)); };
const visiveisSit = (u) => Object.values(S.acts).filter((a) => a.unidade === u.id);
/** Fotografias do ponto de situação ainda por guardar, por atividade: { unidade, fotos: [dataURL], nota }. */
const sitFotosDe = (id) => (ui.sitFotos && ui.sitFotos[id]) || { fotos: [], nota: "" };
const limparSitFotos = (uid) => { for (const [id, f] of Object.entries(ui.sitFotos || {})) if (f.unidade === uid) delete ui.sitFotos[id]; };
/** Grava o ponto de situação de uma fração: cada atividade mudada fica com o seu registo no histórico; um só Anular desfaz tudo. */
async function guardarSit(u) {
  const lista = visiveisSit(u).filter((a) => sitMudou(a));
  // fotografias primeiro (não dependem do estado): ficam na galeria da fração, ligadas à atividade
  let nFotos = 0;
  for (const a of visiveisSit(u)) {
    const sf = ui.sitFotos && ui.sitFotos[a.id];
    if (!sf || !sf.fotos.length) continue;
    const m = ui.sit && ui.sit[a.id], est = m && sitMudou(a) ? m : sitOrig(a);
    const nota = (sf.nota || "").trim() || `Ponto de situação: ${est.est === "conc" ? "concluída" : est.est === "curso" ? `em curso, ${est.pct}%` : "não iniciada"}`;
    for (const f of sf.fotos) { await store.addFoto(a.id, u.id, f, nota); nFotos++; }
    delete ui.sitFotos[a.id];
  }
  await gravarSit(lista);
  return { n: lista.length, nFotos };
}
/** Grava as mudanças de estado e percentagem (ui.sit) destas atividades; cada uma fica com o seu registo e um só Anular desfaz tudo. */
export async function gravarSit(lista, origem = "ponto de situação") {
  const hoje = S.hoje, agora = new Date().toISOString();
  for (const a of lista) {
    const r = S.res.get(a.id), o = sitOrig(a), m = ui.sit[a.id], N = nomeAtiv(a) + " em " + a.unidade;
    let patch, reg;
    if (m.est === "conc") {
      const ini = a.realInicio || (r.prevIni && r.prevIni <= hoje ? r.prevIni : hoje);
      patch = { realInicio: ini, realFim: hoje, concluido: true, pctEmp: 100, empEm: agora };
      reg = { tipo: "conclusao", texto: `${N} concluída a ${fd(hoje)} (ponto de situação)` };
    } else if (m.est === "curso") {
      patch = { pctEmp: m.pct, empEm: agora };
      if (!a.realInicio) patch.realInicio = hoje;
      if (o.est === "conc") Object.assign(patch, { realFim: null, concluido: false });
      reg = o.est === "por" ? { tipo: "inicio", texto: `${N} iniciada a ${fd(hoje)}, ${m.pct}% feito (ponto de situação)` }
        : o.est === "conc" ? { tipo: "reabrir", texto: `Reabriu ${N}: ${m.pct}% feito (ponto de situação)` }
        : { tipo: "progresso", texto: `${N}: ${m.pct}% feito (empreiteiro)` };
    } else {
      patch = { realInicio: null, realFim: null, concluido: false, pctEmp: 0, empEm: agora };
      reg = { tipo: "correcao", texto: `${N} voltou a não iniciada (ponto de situação)` };
    }
    if (origem !== "ponto de situação") reg.texto = reg.texto.replace("(ponto de situação)", `(${origem})`).replace("(empreiteiro)", `(empreiteiro, ${origem})`);
    await store.updateAtividade(a.id, patch, reg);
    delete ui.sit[a.id];
  }
}
function bindSit(u) {
  ui.sit = ui.sit || {};
  const view = document.querySelector("#view"); if (!view) return;
  const muda = (id, est, pct) => {
    const a = S.acts[id], o = sitOrig(a);
    if (est === "conc") pct = 100; else if (est === "por") pct = 0;
    if (est === o.est && (est !== "curso" || pct === o.pct)) delete ui.sit[id];
    else ui.sit[id] = { unidade: u.id, est, pct };
    render();
  };
  view.querySelectorAll("[data-sit]").forEach((b) => (b.onclick = () => {
    const [id, k] = b.dataset.sit.split("|"), a = S.acts[id], cur = sitAtual(a), o = sitOrig(a);
    if (k !== "curso") return muda(id, k);
    // em curso: mantém a percentagem que tinha; se ainda não tinha começado, 5%; se estava concluída, 90%
    muda(id, "curso", cur.est === "curso" ? cur.pct : o.est === "curso" ? o.pct : o.est === "conc" ? 90 : Math.max(5, Math.min(95, o.pct)));
  }));
  bindPctCtl(view, (key) => { const a = S.acts[key.slice(2)]; return a ? sitAtual(a).pct : 0; }, (key, val) => {
    const id = key.slice(2);
    if (val >= 100) muda(id, "conc"); else muda(id, "curso", val);
  });
  const desf = $("#sitDesf");
  if (desf) desf.onclick = () => { for (const [id, m] of Object.entries(ui.sit)) if (m.unidade === u.id) delete ui.sit[id]; limparSitFotos(u.id); render(); };
  // fotografias por atividade (câmara ou galeria), guardadas com o resto
  ui.sitFotos = ui.sitFotos || {};
  bindFotoPickers(view, (key, fotos) => {
    const id = key.slice(2), cur = ui.sitFotos[id] || { unidade: u.id, fotos: [], nota: "" };
    ui.sitFotos[id] = { ...cur, unidade: u.id, fotos: cur.fotos.concat(fotos) };
    render();
  });
  view.querySelectorAll("[data-prm]").forEach((b) => (b.onclick = () => {
    const [key, i] = b.dataset.prm.split("|"), id = key.slice(2), sf = ui.sitFotos[id];
    if (!sf) return;
    sf.fotos.splice(+i, 1);
    if (!sf.fotos.length) delete ui.sitFotos[id];
    render();
  }));
  view.querySelectorAll("[data-sfn]").forEach((inp) => (inp.oninput = () => { const sf = ui.sitFotos[inp.dataset.sfn]; if (sf) sf.nota = inp.value; }));
  const sv = $("#sitSave");
  const guardar = async () => {
    if (sv) sv.disabled = true;
    try {
      const { n, nFotos } = await guardarSit(u);
      const fts = nFotos ? `${nFotos} ${nFotos === 1 ? "fotografia" : "fotografias"}` : "";
      if (n) toast(`Ponto de situação de ${u.id} guardado: ${n} ${n === 1 ? "atividade" : "atividades"}${fts ? " e " + fts : ""}${fts ? ". O Anular não apaga as fotografias" : ""}`);
      else if (nFotos) { toast(`${u.id}: ${fts} ${nFotos === 1 ? "guardada" : "guardadas"} na galeria da fração`, { anular: false }); render(); }
      return true;
    } catch (e) { toast("Não foi possível guardar: " + erroSimples(e), { anular: false }); if (sv && sv.isConnected) sv.disabled = false; return false; }
  };
  if (sv) sv.onclick = guardar;
  const sg = $("#sitSeg");
  if (sg) sg.onclick = async () => {
    const seg = vizinhas(u.id).seg; if (!seg) return;
    const n = visiveisSit(u).filter((a) => sitMudou(a) || sitFotosDe(a.id).fotos.length).length;
    if (n) {
      const k = await perguntar({ titulo: `Guardar o ponto de situação de ${esc(u.id)}?`, texto: `<p>Tem ${n} ${n === 1 ? "alteração" : "alterações"} por guardar nesta fração.</p>`,
        opcoes: [{ k: "sim", l: "Guardar e seguir", estilo: "pri" }, { k: "nao", l: "Seguir sem guardar" }, { k: "c", l: "Ficar aqui" }] });
      if (k === "c" || !k) return render();
      if (k === "sim" && !(await guardar())) return;
      if (k === "nao") { for (const [id, m] of Object.entries(ui.sit)) if (m.unidade === u.id) delete ui.sit[id]; limparSitFotos(u.id); }
    }
    ui.lastUnit = seg; ui.unidadeTab = "sit"; // a fração seguinte abre também no ponto de situação
    location.hash = "#u-" + seg;
    window.scrollTo(0, 0);
  };
}
