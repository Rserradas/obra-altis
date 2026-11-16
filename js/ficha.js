// Ficha da atividade.
import { downstream, duracaoDe } from "../engine.js";
import { $, ESTADO, PAPEL, can, deltaHTML, erroSimples, esc, fd, fdt, toast, ui } from "./base.js";
import { nomeAtiv } from "./calculo.js";
import { atribuirEquipa, openEquipa } from "./equipas.js";
import { S, store } from "./estado.js";
import { closeNova, openNova, ordenaUnidades } from "./nova.js";
import { bindPendentes, pendAberto, pendDe, pendFormHTML, pendListaHTML } from "./pendentes.js";
import { bindDateInputs, bindDepPicker, concluirHoje, confirmar, dateInput, depPickerHTML, editarData, inicioRecalc, perguntar, recalcularFim, recalcularInicio, rotuloAt } from "./plano.js";
import { bindFotoPickers, bindPctCtl, fotoPickerHTML, loadFotos, pctCtlHTML, pendentesHTML } from "./unidades.js";

/* ============================================================ ficha de atividade */
export function openSheet(id, opts = {}) {
  const hist = opts.empilhar && ui.sheet ? [...(ui.sheet.hist || []), ui.sheet.id].slice(-30) : opts.hist || [];
  ui.sheet = { id, form: null, hist };
  ui.sheetTab = opts.tab || "estado";
  renderSheet();
}
/** Antecessoras de uma atividade, diretas e indiretas (para evitar ciclos). */
export function aMontante(id) {
  const up = new Set(), st = [id];
  while (st.length) { const x = st.pop(); for (const p of S.res.get(x)?.preds || []) if (!up.has(p.id)) { up.add(p.id); st.push(p.id); } }
  return up;
}
/** Tira a ligação "sid espera por id" (da sequência, do Excel ou manual). */
export function patchTirarLigacao(sid, id) {
  const x = S.acts[sid];
  const d = (S.res.get(sid)?.preds || []).find((p) => p.id === id);
  if (!d) return null;
  return d.fonte === "manual" ? { depsExtra: (x.depsExtra || []).filter((e) => e.id !== id) } : { depsIgnorar: [...new Set([...(x.depsIgnorar || []), id])] };
}
export function patchPorLigacao(sid, id, tipo) {
  const y = S.acts[sid];
  return { depsExtra: [...(y.depsExtra || []).filter((e) => e.id !== id), { id, tipo: tipo || "FS" }], depsIgnorar: (y.depsIgnorar || []).filter((e) => e !== id) };
}
export const rotulo = (x) => `${nomeAtiv(x)}${x.unidade ? " · " + x.unidade : ""}`;
export function closeSheet() { ui.sheet = null; document.querySelectorAll('[data-dw="ativ"]').forEach((e) => e.remove()); }
/** Fechar a ficha pelo × ou pelo fundo: se há alterações por guardar, pergunta primeiro. */
export async function fecharFicha() {
  const sh = ui.sheet;
  const n = sh && sh.sujos ? sh.sujos().length : 0;
  if (!n) return closeSheet();
  const k = await perguntar({
    titulo: "Tem alterações por guardar",
    texto: `<p>Mexeu nesta ficha e ainda não guardou. Quer guardar antes de fechar?</p>`,
    opcoes: [{ k: "sim", l: "Guardar e fechar", estilo: "pri" }, { k: "nao", l: "Fechar sem guardar", estilo: "warn" }, { k: "ficar", l: "Continuar a editar" }],
  });
  if (k === "sim") { if (ui.sheet && ui.sheet.guardarTudo && (await ui.sheet.guardarTudo())) closeSheet(); }
  else if (k === "nao") {
    const x = ui.sheet && S.acts[ui.sheet.id];
    if (x && ui.pdDraft) delete ui.pdDraft[x.unidade + "|" + x.id];
    if (ui.sheet) ui.sheet.pctTmp = null;
    closeSheet();
  }
}
export function renderSheet() {
  document.querySelectorAll('[data-dw="ativ"]').forEach((e) => e.remove());
  const id = ui.sheet.id, a = S.acts[id], r = S.res.get(id);
  if (!a) { closeSheet(); return; }
  const down = downstream(id, S.res);
  const fonteTxt = { excel: "Original", regra: "Sequência", manual: "Manual", equipa: "Fila da equipa", grupo: "Ao mesmo tempo, na fila da equipa" };
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
      <div class="sh-acoes"><button class="btn sm pri" id="sGuardar" hidden title="Guardar o que mudou nesta ficha">Guardar</button><button class="x" aria-label="Fechar">×</button></div></div>
    <div class="stabs" role="tablist">${[["estado", "Estado"], ["lig", `Ligações <span class="num">${r.preds.length + r.succ.length}</span>`], ["pend", `Pendentes${pendDe(a.unidade, a.id).filter(pendAberto).length ? ` <span class="num">${pendDe(a.unidade, a.id).filter(pendAberto).length}</span>` : ""}`], ["fotos", "Fotografias"], ["hist", "Histórico"]].map(([k, l]) => `<button role="tab" data-stab="${k}" class="${(ui.sheetTab || "estado") === k ? "on" : ""}" aria-selected="${(ui.sheetTab || "estado") === k}">${l}</button>`).join("")}</div>
    <div class="sheet-b papel-${store.user.papel}">
      <div class="spane" data-pane="estado" ${(ui.sheetTab || "estado") === "estado" ? "" : "hidden"}>
      ${(() => {
        const ed = can("executar"), dono = store.user.papel === "dono", conc = r.estado === "concluida";
        const v = (txt, b) => `<span class="v">${b ? "<b>" + txt + "</b>" : txt}</span>`;
        const fimMexido = !!a.fimPrevisto || (a.duracaoManual != null && a.duracaoManual !== "");
        const durN = duracaoDe({ ...a, duracaoManual: null }, S.cfg.duracoes || {});
        const recBtn = ed && !conc ? `<button type="button" class="btn sm recfim" id="bRecFim" ${fimMexido ? "" : "disabled"} title="${fimMexido ? `Volta a pôr o fim com a duração normal desta atividade (${durN} dias)` : `O fim já está calculado com a duração normal (${durN} dias)`}">Recalcular o fim</button>` : "";
        const ri = inicioRecalc(id);
        const recIni = ed && !conc ? `<button type="button" class="btn sm recfim" id="bRecIni" ${ri.pode ? "" : "disabled"} title="${esc(ri.porque)}">Recalcular o início</button>` : "";
        const prev = ed ? `<span class="v">${dateInput(id, "prevIni", r.prevIni)}${recIni}</span><span class="v">${dateInput(id, "prevFim", r.prevFim)}${recBtn}</span>` : v(fd(r.prevIni, true), true) + v(fd(r.prevFim, true), true);
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
  $('.scrim[data-dw="ativ"]').onclick = () => fecharFicha();
  $(".x", sh).onclick = () => fecharFicha();
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
  document.onkeydown = (e) => { if (e.key === "Escape") { if (document.querySelector(".dlg")) return; if (ui.nova) closeNova(); else if (ui.sheet) fecharFicha(); } };
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
  on("#bRecFim", () => recalcularFim([id]));
  on("#bRecIni", () => recalcularInicio(id));
  on("#bFim", () => concluirHoje(id));
  on("#bReabrir", () => upd({ concluido: false, realFim: null, pctEmp: 90 }, `Reabriu ${N}`, "reabrir"));
  on("#bUndo", () => upd({ realInicio: null, realFim: null, concluido: false }, `Anulou início de ${N}`, "correcao"));
  const rp = $("#rPct", sh); if (rp) rp.oninput = () => { $("#oPct", sh).textContent = rp.value + "%"; ui.sheet.pctTmp = { id, v: Number(rp.value) }; };
  const guardarPct = (v) => {
    ui.sheet.pctTmp = null;
    const patch = { pctEmp: v, empEm: new Date().toISOString() };
    if (v > 0 && !a.realInicio) patch.realInicio = S.hoje;
    return upd(patch, `${N}: ${v}% feito (empreiteiro)`, "progresso");
  };
  on("#bPct", () => {
    const pt = ui.sheet.pctTmp;
    guardarPct(pt && pt.id === id ? pt.v : Number(rp.value));
  });
  on("#bPrev", () => guardarPrev($("#dMot", sh).value.trim(), $("#dDur", sh).value));
  const guardarPrev = (mot, dur) => {
    const patch = { motivo: mot || null, duracaoManual: dur === "" ? null : Math.max(0, Number(dur)) };
    // uma duração escrita passa a mandar no fim (um fim escrito antes deixaria a duração sem efeito)
    if (dur !== "" && S.res.get(id).estado !== "concluida") patch.fimPrevisto = null;
    const partes = [];
    if (dur !== "") partes.push("duração de " + dur + " dias");
    if (mot) partes.push("motivo: " + mot);
    return upd(patch, `${N}: ${partes.join(", ") || "motivo e duração limpos"}`, "previsao");
  };
  const pctVist0 = Math.round(a.pctFiscal ?? a.pctEmp ?? 0);
  let pctVist = pctVist0;
  const fpw = $("#fPctW", sh);
  const ligaPct = () => bindPctCtl(fpw, () => pctVist, (k, val) => { pctVist = val; fpw.innerHTML = pctCtlHTML("sheet", val, true); ligaPct(); marcaSujo(); });
  if (fpw) ligaPct();
  let fotos = [];
  const desenhaPend = () => {
    const el = $("#fPend", sh); if (!el) return;
    el.innerHTML = pendentesHTML("sv", fotos);
    el.querySelectorAll("[data-prm]").forEach((b) => (b.onclick = () => { fotos.splice(+b.dataset.prm.split("|")[1], 1); desenhaPend(); }));
    marcaSujo();
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
  on("#bVist", () => guardarVist(pctVist, $("#fNota", sh).value.trim(), fotos));
  const guardarVist = async (v, nota, fotos) => {
    const agora = new Date().toISOString();
    for (const f of fotos) await store.addFoto(id, a.unidade, f, nota);
    const patch = { pctFiscal: v, fiscalEm: agora, fiscalPor: store.user.email };
    if (nota) Object.assign(patch, { fiscalNota: nota, fiscalNotaEm: agora });
    const dados = { esp: nomeAtiv(a), antes: a.pctFiscal ?? null, depois: v, emp: pct, nota: nota || null, nfotos: fotos.length };
    await store.updateAtividade(id, patch,
      { tipo: "vistoria", texto: `Vistoria ${N}: ${v}% (empreiteiro dizia ${pct}%)${fotos.length ? `, ${fotos.length} fotografia(s)` : ""}${nota ? ", comentário: " + nota : ""}`, dados });
    fotos.length = 0; toast("Vistoria guardada");
  };
  /* Botão Guardar no canto: aparece quando há alguma coisa escrita ou mexida que ainda não foi guardada. */
  const sujos = () => {
    const out = [];
    const rpx = $("#rPct", sh); if (rpx && Number(rpx.value) !== Math.round(a.pctEmp ?? 0)) out.push("pct");
    const dm = $("#dMot", sh), dd = $("#dDur", sh); if (dm && dd && (dm.value.trim() !== (a.motivo || "") || dd.value !== String(a.duracaoManual ?? ""))) out.push("prev");
    const fn = $("#fNota", sh); if ($("#bVist", sh) && (pctVist !== pctVist0 || (fn && fn.value.trim()) || fotos.length)) out.push("vist");
    const pt = sh.querySelector('[data-pane="pend"] [data-pdtxt]'); if (pt && pt.value.trim()) out.push("pend");
    return out;
  };
  ui.sheet.sujos = sujos;
  const bG = $("#sGuardar", sh);
  function marcaSujo() { if (!bG) return; const n = sujos().length; bG.hidden = !n; bG.textContent = n > 1 ? `Guardar (${n})` : "Guardar"; }
  sh.addEventListener("input", marcaSujo);
  sh.addEventListener("change", marcaSujo);
  const guardarTudo = async () => {
    const s = sujos(); if (!s.length) return true;
    // ler tudo antes de gravar: cada gravação volta a desenhar a ficha
    const rpx = $("#rPct", sh), pt = ui.sheet.pctTmp;
    const v = { pct: pt && pt.id === id ? pt.v : rpx ? Number(rpx.value) : null, mot: ($("#dMot", sh) || {}).value, dur: ($("#dDur", sh) || {}).value, vv: pctVist, nota: (($("#fNota", sh) || {}).value || "").trim(), fotos: [...fotos] };
    bG.disabled = true;
    try {
      if (s.includes("vist")) await guardarVist(v.vv, v.nota, v.fotos);
      if (s.includes("pct")) await guardarPct(v.pct);
      if (s.includes("prev")) await guardarPrev((v.mot || "").trim(), v.dur);
      if (s.includes("pend")) { const b = document.querySelector('aside[data-dw="ativ"] [data-pane="pend"] [data-pdadd]'); if (b) b.click(); }
      if (s.length > 1) toast("Tudo guardado");
      return true;
    } catch (e) { toast("Não foi possível guardar: " + erroSimples(e), { anular: false }); if (bG.isConnected) bG.disabled = false; return false; }
  };
  ui.sheet.guardarTudo = guardarTudo;
  if (bG) bG.onclick = guardarTudo;
  marcaSujo();
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
