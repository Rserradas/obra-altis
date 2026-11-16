// Pendentes: regras, lista, formulários e o ecrã Pendentes.
import { $, casaPesquisa, esc, fd, fdt, semAcento, termosPesquisa, toast, ui } from "./base.js";
import { modeloTag, nomeAtiv } from "./calculo.js";
import { S, store } from "./estado.js";
import { ordenaUnidades } from "./nova.js";
import { render } from "./nucleo.js";
import { perguntar } from "./plano.js";
import { bindCommon } from "./previsao.js";
import { pl } from "./segurar.js";
import { diaLocal } from "./vistorias.js";

/* ============================================================ pendentes
   Pontos por resolver numa fração ou numa atividade (ex.: falta silicone numa janela). Todos criam.
   O dono e o fiscal fecham qualquer um; o empreiteiro marca como resolvido e o fiscal verifica.
   Fica sempre à vista se o fiscal já confirmou. Não mexem nas datas. */
export const pendTodos = () => Object.values((store.data && store.data.pendentes) || {});
export const pendDe = (unidade, ativ) => pendTodos().filter((x) => x.unidade === unidade && (ativ === undefined || x.ativ === ativ));
/** Ainda precisa de alguma coisa: por resolver, à espera do fiscal, ou fechado sem o ok do fiscal. */
export const pendVivo = (x) => x.estado !== "fechado" || !x.fiscalOk;
export const pendAberto = (x) => x.estado !== "fechado";
export function pendEstado(x) {
  if (x.estado === "aberto") return { k: "por", l: "Por resolver" };
  if (x.estado === "feito") return { k: "esp", l: "Resolvido pelo empreiteiro, por verificar" };
  return x.fiscalOk ? { k: "ok", l: "Fechado e confirmado pelo fiscal" } : { k: "semok", l: "Fechado, sem confirmação do fiscal" };
}
export const QUEM = { dono: "Dono de obra", empreiteiro: "Empreiteiro", fiscal: "Fiscal", admin: "Administrador" };
export function pendPode(x, acao) {
  const p = store.user.papel, eu = store.user.email;
  switch (acao) {
    case "feito": return x.estado === "aberto" && p === "empreiteiro";
    case "fechar": return x.estado !== "fechado" && (p === "dono" || p === "fiscal");
    case "confirmar": return p === "fiscal" && x.estado === "fechado" && !x.fiscalOk;
    case "reabrir": return x.estado !== "aberto" && (p === "dono" || p === "fiscal" || (x.criadoPor === eu && !x.fiscalOk));
    case "apagar": return p === "dono" || (x.criadoPor === eu && x.estado === "aberto");
    case "editar": return p === "dono" || p === "fiscal" || store.admin || (x.criadoPor === eu && x.estado !== "fechado");
    default: return false;
  }
}
/** Pede um texto curto (nota) numa caixa. Devolve o texto, "" sem texto, ou null se cancelar. */
export function pedirTexto({ titulo, texto, placeholder = "", sim = "Guardar", obrigatorio = false, valor = "" }) {
  return new Promise((resolve) => {
    document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove());
    document.body.insertAdjacentHTML("beforeend", `<div class="scrim dlg-s" data-dw="dlg"></div>
      <div class="dlg" data-dw="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">${titulo}</h2><div class="dlg-t">${texto || ""}
      <textarea class="inp" id="dlgTxt" rows="3" placeholder="${esc(placeholder)}">${esc(valor)}</textarea></div>
      <div class="dlg-b"><button class="btn pri" data-dlg="sim">${sim}</button><button class="btn" data-dlg="nao">Cancelar</button></div></div>`);
    const ta = document.querySelector("#dlgTxt"), bs = document.querySelector('.dlg [data-dlg="sim"]');
    const atual = () => { bs.disabled = obrigatorio && !ta.value.trim(); };
    ta.oninput = atual; atual();
    const fim = (v) => { document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove()); resolve(v); };
    document.querySelectorAll(".dlg [data-dlg]").forEach((b) => (b.onclick = () => fim(b.dataset.dlg === "sim" ? ta.value.trim() : null)));
    document.querySelector(".dlg-s").onclick = () => fim(null);
    ta.onkeydown = (e) => { if (e.key === "Escape") fim(null); };
    ta.focus();
  });
}
export const pendPasso = (acao, nota) => ({ em: new Date().toISOString(), por: store.user.email, nome: store.user.nome, papel: store.user.papel, acao, ...(nota ? { nota } : {}) });
/** O que o fiscal faz num pendente conta como vistoria: fica no registo de vistorias e aparece no relatório desse dia. */
/** Registos de pendentes de um pendente que entretanto foi apagado deixam de contar. */
export const pendRegVivo = (r) => (!r.pend || !r.pid || !!((store.data && store.data.pendentes) || {})[r.pid]) && !r.relApagado; // um relatório eliminado também sai
export const pendReg = (texto) => (store.user.papel === "fiscal" ? { tipo: "vistoria", pend: true, texto } : { tipo: "pendente", texto });
export const PEND_ACAO = { criado: "criou", feito: "marcou como resolvido", fechado: "fechou", confirmado: "confirmou (fiscal)", reaberto: "reabriu", editado: "editou" };
export async function pendCriar(unidade, ativ, texto, { calado = false } = {}) {
  texto = String(texto || "").trim();
  if (!texto) { toast("Escreva o que está pendente.", { anular: false }); return false; }
  const a = ativ ? S.acts[ativ] : null;
  const doc = { unidade, ativ: ativ || null, texto, estado: "aberto", fiscalOk: false, criadoPor: store.user.email, criadoNome: store.user.nome,
    criadoPapel: store.user.papel, criadoEm: new Date().toISOString(), historico: [pendPasso("criado")] };
  await store.addPendente(doc, pendReg(`${unidade}${a ? ", " + nomeAtiv(a) : ""}: novo pendente "${texto}"`));
  if (!calado) toast("Pendente registado", { anular: false });
  return true;
}
export async function pendAcao(id, acao) {
  const x = (store.data.pendentes || {})[id]; if (!x || !pendPode(x, acao)) return;
  const fiscal = store.user.papel === "fiscal";
  let nota = "";
  if (acao === "apagar") {
    const k = await perguntar({ titulo: "Apagar este pendente?", texto: `<p>"${esc(x.texto)}" desaparece para todos. Use só para pendentes criados por engano. Se já foi resolvido, feche-o.</p>`, opcoes: [{ k: "sim", l: "Sim, apagar", estilo: "warn" }, { k: "nao", l: "Cancelar" }] });
    if (k !== "sim") return;
    await store.removePendente(id, { tipo: "pendente", texto: `${x.unidade}: apagou o pendente "${x.texto}"` });
    toast("Pendente apagado", { anular: false });
    return;
  }
  if (acao === "reabrir") {
    nota = await pedirTexto({ titulo: "Reabrir o pendente", texto: `<p>"${esc(x.texto)}" volta a Por resolver. Diga o que ainda falta.</p>`, placeholder: "Ex.: o silicone ficou mal acabado no canto", sim: "Reabrir", obrigatorio: true });
    if (nota == null) return;
  } else if (acao === "feito" || acao === "fechar") {
    nota = await pedirTexto({ titulo: acao === "feito" ? "Já está resolvido?" : fiscal ? "Está concluído?" : "Fechar o pendente",
      texto: `<p>"${esc(x.texto)}"</p><p class="note">${acao === "feito" ? "Fica como resolvido pelo empreiteiro, à espera de o fiscal verificar. " : fiscal ? "Fica fechado e confirmado pelo fiscal. " : x.fiscalOk ? "" : "Fica fechado, e marcado como ainda sem confirmação do fiscal. "}Nota opcional:</p>`,
      placeholder: "Ex.: silicone aplicado a 8 nov", sim: acao === "feito" ? "Sim, está resolvido" : fiscal ? "Sim, está concluído" : "Fechar" });
    if (nota == null) return;
  }
  const agora = new Date().toISOString(), eu = store.user.email;
  const passo = pendPasso(acao === "feito" ? "feito" : acao === "fechar" ? (fiscal ? "confirmado" : "fechado") : acao === "confirmar" ? "confirmado" : "reaberto", nota);
  const patch = { historico: [...(x.historico || []), passo], ultimaNota: nota || x.ultimaNota || "" };
  if (acao === "feito") Object.assign(patch, { estado: "feito", feitoEm: agora, feitoPor: eu, feitoNome: store.user.nome });
  if (acao === "fechar") Object.assign(patch, { estado: "fechado", fechadoEm: agora, fechadoPor: eu, fechadoNome: store.user.nome, fechadoPapel: store.user.papel });
  if ((acao === "fechar" && fiscal) || acao === "confirmar") Object.assign(patch, { fiscalOk: true, fiscalOkEm: agora, fiscalOkPor: eu, fiscalOkNome: store.user.nome });
  if (acao === "confirmar" && x.estado !== "fechado") Object.assign(patch, { estado: "fechado", fechadoEm: agora, fechadoPor: eu, fechadoNome: store.user.nome, fechadoPapel: "fiscal" });
  if (acao === "reabrir") Object.assign(patch, { estado: "aberto", fiscalOk: false, ultimaNota: nota });
  await store.updatePendente(id, patch, pendReg(`${x.unidade}: ${PEND_ACAO[passo.acao]} o pendente "${x.texto}"${nota ? ` (${nota})` : ""}`));
  toast({ feito: "Marcado como resolvido: o fiscal vai verificar", fechar: fiscal ? "Pendente confirmado e fechado" : "Pendente fechado", confirmar: "Confirmado pelo fiscal", reabrir: "Pendente reaberto" }[acao], { anular: false });
}
/** Editar um pendente: texto, fração ou zona, e atividade. Fica no histórico do pendente. */
export function pendAtivOps(uid, sel) {
  const u = S.uMap[uid]; if (!u) return "";
  const vivas = u.acts.filter((a) => S.res.get(a.id).estado !== "concluida" || a.id === sel), conc = u.acts.filter((a) => S.res.get(a.id).estado === "concluida" && a.id !== sel);
  return `<option value="">${u.tipo === "Zona comum" || u.tipo === "Geral" ? "Em geral" : "Fração em geral"}</option>${[...vivas, ...conc].map((a) => `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${esc(nomeAtiv(a))}${S.res.get(a.id).estado === "concluida" ? " (concluída)" : ""}</option>`).join("")}`;
}
export function pendEditHTML(x) {
  const grupos = PEND_BLOCOS.map((b) => ({ b, us: ordenaUnidades(S.unidades.filter((u) => u.bloco === b)) })).filter((g) => g.us.length);
  return `<div class="pd-ed" data-pde="${esc(x.id)}">
    <label class="f">Pendente<textarea class="inp" rows="2" maxlength="300" data-pdet>${esc(x.texto)}</textarea></label>
    <div class="pd-ed-r">
      <label class="f">Onde<select class="inp" data-pdeu>${grupos.map(({ b, us }) => `<optgroup label="${b === "Geral" ? "Geral" : "Bloco " + b}">${us.map((u) => `<option value="${esc(u.id)}" ${u.id === x.unidade ? "selected" : ""}>${esc(rotuloU(u) === u.id ? u.id : rotuloU(u) + " (" + u.id + ")")}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <label class="f">Atividade<select class="inp" data-pdea>${pendAtivOps(x.unidade, x.ativ)}</select></label>
    </div>
    <div class="row"><button class="btn sm pri" data-pdeok>Guardar</button><button class="btn sm" data-pdeno>Cancelar</button></div>
  </div>`;
}
export function bindPendEdit(f) {
  const id = f.dataset.pde, x = (store.data.pendentes || {})[id]; if (!x) return;
  const t = f.querySelector("[data-pdet]"), su = f.querySelector("[data-pdeu]"), sa = f.querySelector("[data-pdea]");
  su.onchange = () => { sa.innerHTML = pendAtivOps(su.value, null); };
  const sair = () => { ui.pdEdit = null; const y = window.scrollY; render(); window.scrollTo(0, y); };
  f.querySelector("[data-pdeno]").onclick = (e) => { e.stopPropagation(); sair(); };
  t.onkeydown = (e) => { if (e.key === "Escape") sair(); };
  f.querySelector("[data-pdeok]").onclick = async (e) => {
    e.stopPropagation();
    const texto = t.value.trim().replace(/\s+/g, " ");
    if (!texto) { toast("Escreva o que está pendente.", { anular: false }); t.focus(); return; }
    const unidade = su.value, ativ = sa.value || null;
    const mud = [];
    if (texto !== x.texto) mud.push(`texto era "${x.texto}"`);
    if (unidade !== x.unidade) mud.push(`estava em ${x.unidade}`);
    if (ativ !== (x.ativ || null)) mud.push(ativ ? `atividade passou a ${nomeAtiv(S.acts[ativ])}` : "passou a ser em geral");
    if (!mud.length) { sair(); return; }
    const patch = { texto, unidade, ativ, editadoEm: new Date().toISOString(), historico: [...(x.historico || []), pendPasso("editado", mud.join("; "))] };
    ui.pdEdit = null;
    const mudouSitio = unidade !== x.unidade;
    await store.updatePendente(id, patch, pendReg(`${unidade}: editou o pendente "${texto}" (${mud.join("; ")})`));
    toast(mudouSitio ? `Pendente editado e passado para ${unidade}` : "Pendente editado", { anular: false });
  };
}
export function pendItemHTML(x, { mostrarAtiv = true } = {}) {
  const e = pendEstado(x), a = x.ativ ? S.acts[x.ativ] : null;
  const quem = (nome, papel) => `${esc(nome || "")}${papel && String(nome || "").toLowerCase() !== (QUEM[papel] || papel).toLowerCase() ? ` (${esc((QUEM[papel] || papel).toLowerCase())})` : ""}`;
  const linhas = [`Criado por ${quem(x.criadoNome, x.criadoPapel)} a ${fd(diaLocal(x.criadoEm))}`];
  if (x.estado !== "aberto" && x.feitoEm) linhas.push(`feito por ${esc(x.feitoNome || "")} a ${fd(diaLocal(x.feitoEm))}`);
  if (x.estado === "fechado" && x.fechadoEm) linhas.push(`fechado por ${quem(x.fechadoNome, x.fechadoPapel)} a ${fd(diaLocal(x.fechadoEm))}`);
  const fok = x.fiscalOk ? `<span class="pd-fok sim">Fiscal confirmou${x.fiscalOkEm ? " a " + fd(diaLocal(x.fiscalOkEm)) : ""}</span>` : `<span class="pd-fok nao">Ainda sem ok do fiscal</span>`;
  const bt = (k, l, cls = "") => pendPode(x, k) ? `<button class="btn sm ${cls}" data-pd="${k}|${x.id}">${l}</button>` : "";
  const fiscal = store.user.papel === "fiscal";
  const h = x.historico || [];
  return `<div class="pd-i pd-${e.k}">
    <div class="pd-t"><div class="pd-l1"><span class="pd-e">${e.l}</span>${mostrarAtiv ? (a ? `<button class="lnk-b chip-u" data-a="${a.id}">${esc(nomeAtiv(a))}</button>` : `<span class="chip-u">${(() => { const u = S.uMap[x.unidade]; return u && (u.tipo === "Zona comum" || u.tipo === "Geral") ? "Em geral" : "Fração em geral"; })()}</span>`) : ""}</div>
      <b class="pd-txt">${esc(x.texto)}</b>
      ${x.ultimaNota ? `<span class="pd-nota">Última nota: ${esc(x.ultimaNota)}</span>` : ""}
      <small>${linhas.join(", ")}.${x.estado !== "aberto" ? " " + fok : ""}</small></div>
    ${ui.pdEdit === x.id ? pendEditHTML(x) : ""}
    <div class="pd-b" ${ui.pdEdit === x.id ? "hidden" : ""}>${bt("editar", "Editar", "ghost")}${bt("feito", "Já está resolvido", "ok")}${bt("fechar", fiscal ? "Concluído?" : "Fechar", "ok")}${bt("confirmar", "Dar o ok de fiscal", "ok")}${bt("reabrir", fiscal && x.estado !== "aberto" ? "Ainda não está" : "Reabrir")}${bt("apagar", "Apagar", "ghost")}</div>
    ${h.length > 1 ? `<details class="pd-h"><summary>Histórico (${h.length})</summary><ul>${h.map((p) => `<li><span class="num">${fdt(p.em)}</span> ${esc(p.nome || p.por)} ${PEND_ACAO[p.acao] || p.acao}${p.nota ? `: <i>${esc(p.nota)}</i>` : ""}</li>`).join("")}</ul></details>` : ""}
  </div>`;
}
/** Estado do pendente num dado momento (ISO), refeito a partir do histórico. Serve para os relatórios antigos não mudarem. */
export function pendEstadoEm(x, limite) {
  let estado = "aberto", fiscalOk = false;
  for (const p of x.historico || []) {
    if ((p.em || "") >= limite) break;
    if (p.acao === "feito") estado = "feito";
    else if (p.acao === "fechado") estado = "fechado";
    else if (p.acao === "confirmado") { estado = "fechado"; fiscalOk = true; }
    else if (p.acao === "reaberto") { estado = "aberto"; fiscalOk = false; }
  }
  return { estado, fiscalOk };
}
/** Formulário para criar um pendente numa fração (com escolha de atividade) ou numa atividade fixa. */
export function pendFormHTML(unidade, ativFixa) {
  const k = unidade + "|" + (ativFixa || "");
  ui.pdDraft = ui.pdDraft || {};
  const d = ui.pdDraft[k] || { t: "", a: "" };
  const u = S.uMap[unidade];
  const ops = !ativFixa && u ? u.acts.filter((a) => S.res.get(a.id).estado !== "concluida" || d.a === a.id).concat(u.acts.filter((a) => S.res.get(a.id).estado === "concluida" && d.a !== a.id)) : [];
  return `<div class="pd-novo" data-pdform="${esc(k)}">
    <label class="f pd-f1">Novo pendente<input class="inp" data-pdtxt value="${esc(d.t)}" placeholder="Ex.: falta silicone na janela do quarto 2" maxlength="300"></label>
    ${ativFixa ? "" : `<label class="f">Em que atividade<select class="inp" data-pdativ><option value="">Fração em geral</option>${ops.map((a) => `<option value="${a.id}" ${d.a === a.id ? "selected" : ""}>${esc(nomeAtiv(a))}${S.res.get(a.id).estado === "concluida" ? " (concluída)" : ""}</option>`).join("")}</select></label>`}
    <button class="btn pri" data-pdadd>Adicionar pendente</button></div>`;
}
export function pendListaHTML(lista, opts = {}) {
  const ord = (xs) => xs.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  const por = ord(lista.filter((x) => x.estado === "aberto")), esp = ord(lista.filter((x) => x.estado === "feito"));
  const semok = ord(lista.filter((x) => x.estado === "fechado" && !x.fiscalOk)), ok = ord(lista.filter((x) => x.estado === "fechado" && x.fiscalOk));
  const g = (t, xs, vazio) => xs.length ? `<h3 class="pd-g">${t} <span class="note num">${xs.length}</span></h3>${xs.map((x) => pendItemHTML(x, opts)).join("")}` : vazio || "";
  if (!lista.length) return `<div class="empty">${opts.vazio || "Sem pendentes. Quando alguém registar um ponto por resolver, aparece aqui."}</div>`;
  const gEsp = g("Resolvidos pelo empreiteiro, por verificar", esp), gPor = g("Por resolver", por);
  return `${opts.resolvidosPrimeiro ? gEsp + gPor : gPor + gEsp}${g("Fechados sem confirmação do fiscal", semok)}
    ${ok.length && !opts.semFechados ? `<details class="pd-fech"><summary>Fechados e confirmados pelo fiscal <span class="note num">${ok.length}</span></summary>${ok.slice(0, 40).map((x) => pendItemHTML(x, opts)).join("")}</details>` : ""}`;
}
export function bindPendentes(root) {
  if (!root) return;
  root.querySelectorAll("[data-pd]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [acao, id] = b.dataset.pd.split("|");
    if (acao === "editar") { ui.pdEdit = id; const y = window.scrollY; render(); window.scrollTo(0, y); const i = document.querySelector(`[data-pde="${id}"] textarea`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return; }
    pendAcao(id, acao); }));
  root.querySelectorAll("[data-pde]").forEach((f) => bindPendEdit(f));
  root.querySelectorAll("[data-pdform]").forEach((f) => {
    const k = f.dataset.pdform, [unidade, ativFixa] = k.split("|");
    ui.pdDraft = ui.pdDraft || {};
    const d = (ui.pdDraft[k] = ui.pdDraft[k] || { t: "", a: "" });
    const t = f.querySelector("[data-pdtxt]"), sel = f.querySelector("[data-pdativ]"), add = f.querySelector("[data-pdadd]");
    t.oninput = () => (d.t = t.value);
    if (sel) sel.onchange = () => (d.a = sel.value);
    const vai = async () => { if (await pendCriar(unidade, ativFixa || (sel && sel.value) || null, t.value)) { ui.pdDraft[k] = { t: "", a: d.a }; t.value = ""; render(); } };
    add.onclick = vai;
    t.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); vai(); } };
  });
}
/* ============================================================ ecrã Pendentes (todos os pendentes da obra) */
/* Pendentes: blocos e frações que abrem e fecham, filtros, e um pendente novo para uma ou várias frações, zonas comuns ou geral. */
export const PEND_BLOCOS = ["A", "B", "C", "D", "Geral"];
export const rotuloU = (u) => (u.tipo === "Zona comum" ? "Zonas comuns" : u.tipo === "Geral" ? u.nome || "Geral" : /LOJAS$/.test(u.id) ? "Lojas (geral)" : u.id);
export const tipoPend = (u) => (u.tipo === "Apartamento" ? "ap" : u.tipo === "Loja" ? "loja" : u.tipo === "Zona comum" ? "zc" : "geral");
export function pendentesView() {
  const st = (ui.pendF = ui.pendF || { e: store.user.papel === "empreiteiro" ? "por" : "abertos", bloco: "", q: "", tipo: "", ativ: "", quem: "" });
  const ab = (ui.pendAb = ui.pendAb || new Set(PEND_BLOCOS.map((b) => "b:" + b)));
  const todos = pendTodos().filter((x) => S.uMap[x.unidade] && !S.idsTeste.has(x.unidade));
  const EST = [["abertos", "Por fechar", (x) => x.estado !== "fechado"], ["por", "Por resolver", (x) => x.estado === "aberto"], ["esp", "Resolvidos, por verificar", (x) => x.estado === "feito"],
    ["semok", "Fechados sem ok do fiscal", (x) => x.estado === "fechado" && !x.fiscalOk], ["fech", "Fechados", (x) => x.estado === "fechado"], ["todos", "Todos", () => true]];
  const fE = (EST.find(([k]) => k === st.e) || EST[0])[2];
  const q = termosPesquisa(st.q);
  const nomeA = (x) => (x.ativ && S.acts[x.ativ] ? nomeAtiv(S.acts[x.ativ]) : "");
  const passaSemEstado = (x) => { const u = S.uMap[x.unidade];
    return (!st.bloco || u.bloco === st.bloco) && (!st.tipo || tipoPend(u) === st.tipo) && (!st.ativ || (st.ativ === "_fr" ? !nomeA(x) : nomeA(x) === st.ativ))
      && (!st.quem || x.criadoPapel === st.quem) && (!q.length || casaPesquisa([x.texto, x.unidade, u.nome || "", nomeA(x), x.ultimaNota || ""].join(" "), q)); };
  const lista = todos.filter((x) => fE(x) && passaSemEstado(x));
  const porU = new Map();
  for (const x of lista) (porU.get(x.unidade) || porU.set(x.unidade, []).get(x.unidade)).push(x);
  const n = (f) => todos.filter((x) => f(x) && passaSemEstado(x)).length;
  const nomesAtiv = [...new Set(todos.map(nomeA).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  const filtrosOn = st.e !== (store.user.papel === "empreiteiro" ? "por" : "abertos") || st.bloco || st.q || st.tipo || st.ativ || st.quem;
  const abreTudo = q.length > 0 || lista.length <= 6; // com uma procura ou poucos resultados, abre tudo
  const contaEst = (xs) => { const c = { por: 0, esp: 0, f: 0 }; for (const x of xs) x.estado === "aberto" ? c.por++ : x.estado === "feito" ? c.esp++ : c.f++; return [c.por ? `<span class="pdc por">${c.por} por resolver</span>` : "", c.esp ? `<span class="pdc esp">${c.esp} por verificar</span>` : "", c.f ? `<span class="pdc f">${c.f} fechado${c.f === 1 ? "" : "s"}</span>` : ""].join(""); };
  const blocos = PEND_BLOCOS.map((b) => ({ b, us: ordenaUnidades([...porU.keys()].map((id) => S.uMap[id]).filter((u) => u.bloco === b)) })).filter((x) => x.us.length);
  const fracHTML = (u) => { const xs = porU.get(u.id).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || "")); const k = "u:" + u.id;
    return `<details class="pd-fr" data-pdab="${esc(k)}" ${abreTudo || ab.has(k) ? "open" : ""}><summary><span class="pd-fr-t">${rotuloU(u) === u.id ? `<b class="mono">${esc(u.id)}</b>${modeloTag(u.id)} <span class="note">${esc(u.tipo)}</span>` : `<b>${esc(rotuloU(u))}</b> <span class="note mono">${esc(u.id)}</span>`}</span><span class="pd-cs">${contaEst(xs)}</span>
      <span class="pd-fr-ac"><a class="btn sm ghost" href="#u-${esc(u.id)}" data-irpend="${esc(u.id)}">Abrir fração</a><button class="btn sm ghost" data-pdnaqui="${esc(u.id)}">+ Pendente aqui</button></span></summary>
      <div class="pd-lista">${xs.map((x) => pendItemHTML(x)).join("")}</div></details>`; };
  const html = `
    <div class="card-h"><h1>Pendentes</h1><div class="row"><span class="note num">${todos.filter((x) => x.estado === "aberto").length} por resolver · ${todos.filter((x) => x.estado === "feito").length} resolvidos, por verificar</span><button class="btn ${ui.pdNovo && ui.pdNovo.aberto ? "" : "pri"}" id="pdNovoBt">${ui.pdNovo && ui.pdNovo.aberto ? "Fechar" : "+ Novo pendente"}</button></div></div>
    ${ui.pdNovo && ui.pdNovo.aberto ? pendNovoHTML() : ""}
    <div class="filters pd-filtros">
      <div class="chips rolar" role="group" aria-label="Estado">${EST.map(([k, l, f]) => `<button class="chip ${st.e === k ? "on" : ""}" data-pe="${k}">${l} <span class="num">${n(f)}</span></button>`).join("")}</div>
      <div class="chips rolar" role="group" aria-label="Bloco">${["", ...PEND_BLOCOS].map((b) => `<button class="chip ${st.bloco === b ? "on" : ""}" data-pbl="${b}">${b === "" ? "Todos os blocos" : b === "Geral" ? "Geral" : "Bloco " + b}</button>`).join("")}</div>
      <label class="f">Onde<select class="inp" id="pdTipo">${[["", "Todos"], ["ap", "Apartamentos"], ["loja", "Lojas"], ["zc", "Zonas comuns"], ["geral", "Geral"]].map(([k, l]) => `<option value="${k}" ${st.tipo === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Atividade<select class="inp" id="pdAtiv"><option value="">Todas</option><option value="_fr" ${st.ativ === "_fr" ? "selected" : ""}>Fração em geral</option>${nomesAtiv.map((a) => `<option ${st.ativ === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>
      <label class="f">Registado por<select class="inp" id="pdQuem">${[["", "Todos"], ["fiscal", "Fiscal"], ["empreiteiro", "Empreiteiro"], ["dono", "Dono de obra"]].map(([k, l]) => `<option value="${k}" ${st.quem === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f pd-q">Procurar<input class="inp" id="pdq" type="search" value="${esc(st.q)}" placeholder="Texto, fração ou atividade"></label>
    </div>
    <div class="pd-barra"><span class="note num">${lista.length} pendente${lista.length === 1 ? "" : "s"} em ${porU.size} ${porU.size === 1 ? "sítio" : "sítios"}</span>
      ${lista.length ? `<button class="btn sm" data-pdtudo="1">Abrir tudo</button><button class="btn sm" data-pdtudo="0">Fechar tudo</button>` : ""}${filtrosOn ? `<button class="btn sm repor-on" id="pdclr">Limpar filtros</button>` : ""}</div>
    ${blocos.length ? blocos.map(({ b, us }) => { const xs = us.flatMap((u) => porU.get(u.id)); const k = "b:" + b;
      return `<details class="pd-bl" data-pdab="${k}" ${abreTudo || ab.has(k) ? "open" : ""}><summary><h2>${b === "Geral" ? "Geral" : "Bloco " + b}</h2><span class="note num">${pl(xs.length, "pendente", "pendentes")} em ${pl(us.length, "sítio", "sítios")}</span><span class="pd-cs">${contaEst(xs)}</span></summary>
        <div class="pd-bl-in">${us.map(fracHTML).join("")}</div></details>`; }).join("")
      : `<div class="empty">${todos.length ? `Nenhum pendente com estes filtros. ${filtrosOn ? `<button class="btn sm" id="pdclr2">Limpar filtros</button>` : ""}` : "Ainda não há pendentes. Carregue em + Novo pendente para registar o primeiro."}</div>`}`;
  return { html, bind: () => {
    bindCommon(); bindPendentes(document.querySelector("#view")); bindPendNovo();
    document.querySelectorAll("[data-pe]").forEach((b) => (b.onclick = () => { st.e = b.dataset.pe; render(); }));
    document.querySelectorAll("[data-pbl]").forEach((b) => (b.onclick = () => { st.bloco = b.dataset.pbl; render(); }));
    [["#pdTipo", "tipo"], ["#pdAtiv", "ativ"], ["#pdQuem", "quem"]].forEach(([sel, k]) => { const el = $(sel); if (el) el.onchange = () => { st[k] = el.value; render(); }; });
    const qi = $("#pdq"); let tm; if (qi) qi.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { st.q = qi.value; render(); const n2 = $("#pdq"); if (n2) { n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); } }, 300); };
    ["#pdclr", "#pdclr2"].forEach((s) => { const c = $(s); if (c) c.onclick = () => { ui.pendF = null; render(); }; });
    // abrir e fechar: fica lembrado enquanto a aplicação está aberta
    document.querySelectorAll("details[data-pdab]").forEach((d) => (d.ontoggle = () => { if (d.open) ab.add(d.dataset.pdab); else ab.delete(d.dataset.pdab); }));
    document.querySelectorAll("[data-pdtudo]").forEach((b) => (b.onclick = () => {
      const abrir = b.dataset.pdtudo === "1";
      document.querySelectorAll("details[data-pdab]").forEach((d) => { d.open = abrir; if (abrir) ab.add(d.dataset.pdab); else ab.delete(d.dataset.pdab); });
    }));
    document.querySelectorAll("[data-pdnaqui]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); ui.pdNovo = { ...(ui.pdNovo || { t: "", esp: "" }), aberto: true, us: new Set([b.dataset.pdnaqui]) }; render(); window.scrollTo(0, 0); const i = $("#pdnT"); if (i) i.focus(); }));
    const nb = $("#pdNovoBt"); if (nb) nb.onclick = () => { ui.pdNovo = { t: "", esp: "", us: new Set(), ...(ui.pdNovo || {}), aberto: !(ui.pdNovo && ui.pdNovo.aberto) }; render(); const i = $("#pdnT"); if (i) i.focus(); };
  } };
}
/** Formulário de um pendente novo para uma ou várias frações, zonas comuns ou geral. */
export function pendNovoHTML() {
  const d = ui.pdNovo;
  d.us = d.us || new Set();
  const porB = PEND_BLOCOS.map((b) => ({ b, us: ordenaUnidades(S.unidades.filter((u) => u.bloco === b)) })).filter((x) => x.us.length);
  const escolhidas = [...d.us].map((id) => S.uMap[id]).filter(Boolean);
  const nomes = [...new Set(escolhidas.flatMap((u) => u.acts.map(nomeAtiv)))].sort((a, b) => a.localeCompare(b, "pt"));
  if (d.esp && !nomes.includes(d.esp)) d.esp = "";
  const semAtiv = d.esp ? escolhidas.filter((u) => !u.acts.some((a) => nomeAtiv(a) === d.esp)).length : 0;
  ui.pdnAb = ui.pdnAb || new Set();
  return `<section class="card pdn" id="pdNovo">
    <div class="card-h"><h2>Novo pendente</h2></div>
    <label class="f">O que está pendente<textarea class="inp" id="pdnT" rows="2" maxlength="300" placeholder="Ex.: falta silicone nas janelas dos quartos">${esc(d.t || "")}</textarea></label>
    <div class="pdn-onde"><div class="pdn-h"><b>Onde</b> <span class="note">escolha uma ou várias frações, as zonas comuns ou o geral</span>
      <span class="pdn-atalhos"><button type="button" class="btn sm" data-pdnzc>Todas as zonas comuns</button>${d.us.size ? `<button type="button" class="btn sm ghost" data-pdnlimpa>Tirar todas</button>` : ""}</span></div>
      ${porB.map(({ b, us }) => { const nSel = us.filter((u) => d.us.has(u.id)).length; const fr = us.filter((u) => u.tipo === "Apartamento" || u.tipo === "Loja");
        return `<details class="pdn-b" data-pdnab="${b}" ${ui.pdnAb.has(b) || (nSel && nSel < 12) ? "open" : ""}><summary><b>${b === "Geral" ? "Geral" : "Bloco " + b}</b>${nSel ? ` <span class="pdn-n">${nSel} escolhida${nSel === 1 ? "" : "s"}</span>` : ""}
          ${fr.length ? `<button type="button" class="btn sm ghost" data-pdnbl="${b}">${fr.every((u) => d.us.has(u.id)) ? "Tirar as frações" : `Todas as frações (${fr.length})`}</button>` : ""}</summary>
          <div class="chips">${us.map((u) => `<button type="button" class="chip ${d.us.has(u.id) ? "on" : ""} ${u.tipo === "Zona comum" || u.tipo === "Geral" ? "zc" : ""}" data-pdnu="${esc(u.id)}" aria-pressed="${d.us.has(u.id)}">${esc(rotuloU(u))}</button>`).join("")}</div></details>`; }).join("")}
    </div>
    <div class="pdn-fim">
      <label class="f">Atividade <span class="note">(opcional)</span><select class="inp" id="pdnA" ${escolhidas.length ? "" : "disabled"}><option value="">${escolhidas.length === 1 ? "Fração em geral" : "Em geral, em cada sítio"}</option>${nomes.map((a) => `<option ${d.esp === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>
      <button class="btn pri" id="pdnOk" ${escolhidas.length ? "" : "disabled"}>${escolhidas.length > 1 ? `Registar em ${escolhidas.length} sítios` : "Registar pendente"}</button>
    </div>
    ${semAtiv ? `<p class="note" style="margin:0">Em ${pl(semAtiv, "sítio escolhido não há", "sítios escolhidos não há")} ${esc(d.esp)}: aí o pendente fica em geral.</p>` : ""}
    ${escolhidas.length > 1 ? `<p class="note" style="margin:0">Fica um pendente em cada sítio, para cada um ser resolvido e fechado à parte.</p>` : ""}
  </section>`;
}
export function bindPendNovo() {
  const d = ui.pdNovo; const box = $("#pdNovo");
  if (!d || !box) return;
  const t = $("#pdnT"); t.oninput = () => (d.t = t.value);
  const re = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
  box.querySelectorAll("[data-pdnu]").forEach((b) => (b.onclick = () => { const id = b.dataset.pdnu; d.us.has(id) ? d.us.delete(id) : d.us.add(id); re(); }));
  box.querySelectorAll("[data-pdnbl]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const bl = b.dataset.pdnbl; const fr = S.unidades.filter((u) => u.bloco === bl && (u.tipo === "Apartamento" || u.tipo === "Loja")); const tudo = fr.every((u) => d.us.has(u.id)); fr.forEach((u) => (tudo ? d.us.delete(u.id) : d.us.add(u.id))); ui.pdnAb.add(bl); re(); }));
  const zc = box.querySelector("[data-pdnzc]"); if (zc) zc.onclick = () => { S.unidades.filter((u) => u.tipo === "Zona comum").forEach((u) => d.us.add(u.id)); re(); };
  const lp = box.querySelector("[data-pdnlimpa]"); if (lp) lp.onclick = () => { d.us.clear(); re(); };
  box.querySelectorAll("details[data-pdnab]").forEach((x) => (x.ontoggle = () => { if (x.open) ui.pdnAb.add(x.dataset.pdnab); else ui.pdnAb.delete(x.dataset.pdnab); }));
  const sa = $("#pdnA"); if (sa) sa.onchange = () => { d.esp = sa.value; re(); };
  const ok = $("#pdnOk"); if (ok) ok.onclick = async () => {
    const texto = (t.value || "").trim();
    if (!texto) { toast("Escreva o que está pendente.", { anular: false }); t.focus(); return; }
    const us = ordenaUnidades([...d.us].map((id) => S.uMap[id]).filter(Boolean));
    if (!us.length) { toast("Escolha onde fica o pendente.", { anular: false }); return; }
    ok.disabled = true;
    for (const u of us) {
      const a = d.esp ? u.acts.find((x) => nomeAtiv(x) === d.esp && S.res.get(x.id).estado !== "concluida") || u.acts.find((x) => nomeAtiv(x) === d.esp) : null;
      await pendCriar(u.id, a ? a.id : null, texto, { calado: true });
    }
    toast(us.length === 1 ? `Pendente registado em ${rotuloU(us[0]) === us[0].id ? us[0].id : rotuloU(us[0]) + " (" + us[0].id + ")"}` : `Pendente registado em ${us.length} sítios`, { anular: false });
    for (const u of us) { (ui.pendAb = ui.pendAb || new Set()).add("u:" + u.id); ui.pendAb.add("b:" + u.bloco); }
    ui.pdNovo = { aberto: false, t: "", esp: "", us: new Set() };
    render();
  };
}
