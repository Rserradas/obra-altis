// Criar e eliminar frações; nova atividade.
import { addDays, diffDays } from "../engine.js";
import { $, esc, toast, ui } from "./base.js";
import { espAp, nomeAtiv } from "./calculo.js";
import { filarSemPerguntar } from "./equipas.js";
import { S, store } from "./estado.js";
import { render } from "./nucleo.js";
import { bindDepPicker, depPickerHTML } from "./plano.js";

/* ============================================================ frações: criar e eliminar */
export const ORD_B = { A: 0, B: 1, C: 2, D: 3, Geral: 9 };
export const ordenaUnidades = (lista) => [...lista].sort((a, b) => (ORD_B[a.bloco] ?? 5) - (ORD_B[b.bloco] ?? 5) || (a.piso ?? 99) - (b.piso ?? 99) || a.id.localeCompare(b.id));
export function proximoLote() {
  const lotes = Object.values(S.acts).map((a) => (/^N(\d+)$/.exec(a.lote || "") || [])[1]).filter(Boolean).map(Number);
  return "N" + ((lotes.length ? Math.max(...lotes) : 0) + 1);
}
export function sugerirCodigo(tipo, bloco, piso) {
  const ids = new Set(S.unidades.map((u) => u.id));
  if (tipo === "Zona comum") { let c = `${bloco}-ZC`, i = 2; while (ids.has(c)) c = `${bloco}-ZC${i++}`; return c; }
  if (tipo === "Loja") { let n = 1; while (ids.has(`${bloco}-L${String(n).padStart(3, "0")}`)) n++; return `${bloco}-L${String(n).padStart(3, "0")}`; }
  const p = Math.max(0, Number(piso) || 0);
  const nums = S.unidades.filter((u) => u.id.startsWith(`${bloco}-F${p}`)).map((u) => Number(u.id.slice(-2))).filter((x) => !isNaN(x));
  let n = nums.length ? Math.max(...nums) + 1 : 1;
  while (ids.has(`${bloco}-F${p}${String(n).padStart(2, "0")}`)) n++;
  return `${bloco}-F${p}${String(n).padStart(2, "0")}`;
}
export function openNovaFracao() {
  document.querySelectorAll('[data-dw="fracao"]').forEach((e) => e.remove());
  const esp = espAp();
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
export function delUnidadeHTML(u) {
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
export function bindDelUnidade(u) {
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
export function slugKey(s) {
  return "x_" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
}
/** Atividades com nome próprio (fora das especialidades), para poder reutilizá-las noutras frações. */
export function atividadesJaCriadas() {
  const m = new Map();
  for (const a of Object.values(S.acts)) {
    if (a.esp && S.espIdx[a.esp] && !S.espIdx[a.esp].grupo) continue; // as das zonas comuns e geral também servem de modelo
    const nome = nomeAtiv(a); if (!nome) continue;
    const x = m.get(nome) || { nome, n: 0, us: new Set(), dias: null, equipa: null };
    x.us.add(a.unidade); x.n = x.us.size;
    if (x.dias == null) { const r = S.res.get(a.id); x.dias = r ? r.dur : a.duracao; }
    if (!x.equipa && a.equipa) x.equipa = a.equipa;
    m.set(nome, x);
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}
export function openNova(preset, opts = {}) {
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
export function closeNova() { ui.nova = null; document.querySelectorAll('[data-dw="nova"]').forEach((e) => e.remove()); }
export function novaAlvos() {
  const n = ui.nova;
  const us = S.unidades;
  if (n.onde === "apart") return us.filter((u) => u.tipo === "Apartamento" && n.blocos.includes(u.bloco));
  if (n.onde === "lojas") return us.filter((u) => u.tipo === "Loja" && /-L\d+$/.test(u.id));
  if (n.onde === "zonas") return us.filter((u) => u.tipo === "Zona comum" && n.blocos.includes(u.bloco));
  if (n.onde === "geral") return us.filter((u) => u.tipo === "Geral");
  return us.filter((u) => n.sel.has(u.id));
}
export function renderNova() {
  document.querySelectorAll('[data-dw="nova"]').forEach((e) => e.remove());
  const n = ui.nova;
  const dono = store.user.papel === "dono" || store.user.papel === "empreiteiro"; // podem criar especialidades
  const esp = espAp();
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
