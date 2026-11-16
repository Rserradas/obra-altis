// Equipas de trabalho e plano das equipas.
import { addDays, diffDays, schedule } from "../engine.js";
import { $, EQF_PADRAO, ESTADO, MESES, PLANO_PADRAO, deltaHTML, eqfAtivo, esc, fd, semAcento, toast, ui } from "./base.js";
import { espAp, frentesDe, nomeAtiv, optsMotor } from "./calculo.js";
import { defTabs } from "./definicoes.js";
import { S, store } from "./estado.js";
import { render } from "./nucleo.js";
import { confirmar, perguntar } from "./plano.js";
import { bindCommon } from "./previsao.js";
import { ORD_BLOCOS, grupoBloco, pl, rotuloAlvo } from "./segurar.js";

/* ============================================================ equipas de trabalho */
export const telLink = (t) => `<a href="tel:${esc(String(t).replace(/[^\d+]/g, ""))}">${esc(t)}</a>`;
/** Atribui (ou retira, com nome null) uma equipa a vários trabalhos de uma vez. */
export const temOrdem = (a) => a.eqOrdem != null && a.eqOrdem !== "" && a.eqOrdem !== false;
/** Na fila, um trabalho com ordem decimal (ex.: 20.5) faz-se ao mesmo tempo que o anterior. */
export const eJunto = (a) => !!a && temOrdem(a) && !Number.isInteger(Number(a.eqOrdem));
/** Ordens a gravar numa fila: 10, 20, 30...; os que vão ao mesmo tempo que o anterior ficam com a desse mais meio. */
export function ordensFila(ids, { juntar = new Set(), soltar = new Set() } = {}) {
  const out = new Map();
  let v = 0;
  ids.forEach((id, i) => {
    const junto = i > 0 && !soltar.has(id) && (juntar.has(id) || eJunto(S.acts[id]));
    if (junto) out.set(id, v + 0.5); else { v += 10; out.set(id, v); }
  });
  return out;
}
/** Ao mudar um trabalho de lugar, sai do grupo; se era o primeiro de um grupo, o seguinte passa a ser o primeiro. */
export function soltarAoMover(id, ids) {
  const s = new Set([id]);
  const i = ids.indexOf(id);
  if (!eJunto(S.acts[id]) && i >= 0 && ids[i + 1] && eJunto(S.acts[ids[i + 1]])) s.add(ids[i + 1]);
  return s;
}
/** Põe os trabalhos na fila da equipa, cada um na posição da data em que pode começar. Devolve a nova ordem (ids). */
export function ordemComNovos(nome, novos, base = null) {
  const ini = (id) => (S.res.get(id) && S.res.get(id).provIni) || "9";
  const ord = (base || filaEquipa(nome).map((a) => a.id)).filter((id) => !novos.includes(id));
  for (const id of [...novos].sort((x, y) => ini(x).localeCompare(ini(y)))) {
    let k = ord.findIndex((o) => S.res.get(o) && S.res.get(o).estado !== "concluida" && ini(o) > ini(id));
    if (k < 0) k = ord.length;
    while (k < ord.length && eJunto(S.acts[ord[k]])) k++; // não parte um grupo
    ord.splice(k, 0, id);
  }
  return ord;
}
/** Simula patches e diz o efeito. */
export function efeitoDe(lista) {
  const pm = new Map(lista.map((l) => [l.id, l.patch]));
  const novo = Object.values(S.acts).map((a) => (pm.has(a.id) ? { ...a, ...pm.get(a.id) } : a));
  const r2 = schedule(novo, S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor());
  let mudam = 0, fim = "";
  for (const a of novo) { const x = S.res.get(a.id), y = r2.get(a.id); if (x && y && (x.provIni !== y.provIni || x.provFim !== y.provFim)) mudam++; if (y && y.estado !== "concluida" && y.provFim > fim) fim = y.provFim; }
  return { r2, mudam, fim };
}
/** Atribuir (ou tirar) equipa: a disponibilidade da equipa passa logo a contar nas datas. */
export async function atribuirEquipa(ids, nome) {
  const muda = ids.filter((id) => S.acts[id] && (S.acts[id].equipa || null) !== (nome || null));
  if (!muda.length) { toast(nome ? `Já estava${ids.length > 1 ? "m" : ""} com ${nome}` : "Já estava sem equipa"); return; }
  const lista = [];
  if (nome) {
    const ord = ordemComNovos(nome, muda.filter((id) => S.res.get(id).estado !== "concluida"));
    const ords = ordensFila(ord);
    ord.forEach((id) => { const v = ords.get(id); const a = S.acts[id]; const p = {}; if (a.eqOrdem !== v) p.eqOrdem = v; if (a.equipa !== nome) p.equipa = nome; if (Object.keys(p).length) lista.push({ id, patch: p }); });
    for (const id of muda) if (!ord.includes(id)) lista.push({ id, patch: { equipa: nome, eqOrdem: null } }); // concluídas: só o nome
  } else for (const id of muda) lista.push({ id, patch: { equipa: null, eqOrdem: null } });
  const ef = efeitoDe(lista);
  const um = muda.length === 1 ? S.acts[muda[0]] : null;
  const alvo = um ? `${nomeAtiv(um)} em ${um.unidade}` : `${muda.length} trabalhos`;
  // trabalhos que passam para mais tarde por a equipa estar ocupada
  const tarde = nome ? muda.map((id) => ({ a: S.acts[id], de: S.res.get(id).provIni, para: ef.r2.get(id).provIni })).filter((x) => x.para > x.de) : [];
  const ciclo = muda.filter((id) => ef.r2.get(id).ciclo && !S.res.get(id).ciclo);
  if (tarde.length || ciclo.length) {
    const k = await perguntar({
      titulo: ciclo.length ? "Esta atribuição contradiz a sequência" : `A ${esc(nome)} está ocupada`,
      texto: `${tarde.length ? `<p>A equipa não pode fazer dois trabalhos ao mesmo tempo. ${tarde.length === 1 ? "Este trabalho passa" : "Estes trabalhos passam"} para mais tarde:</p>
        <ul class="dlg-l">${tarde.slice(0, 6).map((x) => { const pos = ef.r2.get(x.a.id).preds.find((d) => d.fonte === "equipa"); const ant = pos && S.acts[pos.id]; return `<li><b>${esc(nomeAtiv(x.a))}</b> em ${esc(x.a.unidade)}: começava a ${fd(x.de)}, passa a ${fd(x.para)}${ant ? `<br><small class="note">a equipa só fica livre depois de ${esc(nomeAtiv(ant))} em ${esc(ant.unidade)}</small>` : ""}</li>`; }).join("")}${tarde.length > 6 ? `<li class="note">e mais ${tarde.length - 6}</li>` : ""}</ul>` : ""}
        ${ciclo.length ? `<div class="dlg-av">Com a ordem da fila, a equipa teria de fazer um trabalho antes de outro de que ele depende. As datas destes trabalhos não se conseguem calcular.</div>` : ""}
        <p>${ef.mudam} ${ef.mudam === 1 ? "atividade muda" : "atividades mudam"} de datas. A obra ${ef.fim !== S.tot.fim ? `passa a acabar a <b>${fd(ef.fim, true)}</b> (era ${fd(S.tot.fim, true)})` : "continua a acabar a " + fd(ef.fim, true)}.</p>
        <p class="note">Pode mudar a ordem depois, no Plano das equipas.</p>`,
      opcoes: [{ k: "sim", l: `Atribuir à ${esc(nome)}`, estilo: ciclo.length ? "" : "pri" }, { k: "nao", l: "Cancelar", estilo: ciclo.length ? "pri" : "" }],
    });
    if (k !== "sim") return false;
  }
  await store.updateMuitas(lista, { tipo: "equipa", texto: nome ? `${alvo} atribuído${um ? "" : "s"} a ${nome}` : `${alvo} ficou sem equipa` });
  toast(`${nome ? `${muda.length === 1 ? "Atribuído" : muda.length + " trabalhos atribuídos"} a ${nome} e na fila dela` : `Equipa retirada de ${muda.length === 1 ? "1 trabalho" : muda.length + " trabalhos"}`}. ${ef.mudam ? `${ef.mudam} ${ef.mudam === 1 ? "atividade mudou" : "atividades mudaram"} de datas` : "Nenhuma data mudou"}.`);
  return true;
}
/** Põe na fila da sua equipa trabalhos acabados de criar (sem perguntar). */
export async function filarSemPerguntar(ids) {
  const porEq = {};
  for (const id of ids) { const a = S.acts[id]; if (a && a.equipa && S.equipas.includes(a.equipa) && !temOrdem(a) && S.res.get(id) && S.res.get(id).estado !== "concluida") (porEq[a.equipa] = porEq[a.equipa] || []).push(id); }
  const lista = [];
  for (const [nome, novos] of Object.entries(porEq)) { const ord = ordemComNovos(nome, novos), ords = ordensFila(ord); ord.forEach((id) => { const v = ords.get(id); if (S.acts[id].eqOrdem !== v) lista.push({ id, patch: { eqOrdem: v } }); }); }
  if (lista.length) await store.updateMuitas(lista, null);
}
/** Uma vez: pôr nas filas os trabalhos com equipa que nunca lá estiveram (por exemplo os que vieram da importação). */
export function planoFilasTodas() {
  const lista = [];
  const porEq = [];
  for (const nome of S.equipas) {
    const novos = Object.values(S.acts).filter((a) => a.equipa === nome && (a.eqOrdem == null || a.eqOrdem === "") && S.res.get(a.id).estado !== "concluida").map((a) => a.id);
    if (!novos.length) continue;
    const ord = ordemComNovos(nome, novos);
    const ords = ordensFila(ord);
    ord.forEach((id) => { const v = ords.get(id); if (S.acts[id].eqOrdem !== v) lista.push({ id, patch: { eqOrdem: v } }); });
    porEq.push({ nome, n: novos.length, ids: ord });
  }
  let ef = efeitoDe(lista);
  // o que ficar em conflito com a sequência fica de fora da fila
  const fora = lista.filter((l) => ef.r2.get(l.id).ciclo && !S.res.get(l.id).ciclo).map((l) => l.id);
  if (fora.length) { for (const l of lista) if (fora.includes(l.id)) l.patch = { eqOrdem: false }; ef = efeitoDe(lista); }
  const fimEq = (nome, res) => Object.values(S.acts).filter((a) => a.equipa === nome && res.get(a.id).estado !== "concluida").reduce((m, a) => (res.get(a.id).provFim > m ? res.get(a.id).provFim : m), "");
  for (const e of porEq) { e.antes = fimEq(e.nome, S.res); e.depois = fimEq(e.nome, ef.r2); }
  return { lista, porEq, fora: fora.length, ...ef, total: porEq.reduce((t, e) => t + e.n, 0) };
}
export async function filasTodas() {
  const pl = planoFilasTodas();
  if (!pl.total) return;
  const k = await perguntar({
    titulo: `Pôr ${pl.total} trabalhos nas filas das equipas?`,
    texto: `<p>Cada trabalho entra na fila da sua equipa pela data em que pode começar. A partir daí, cada equipa só faz um trabalho de cada vez.</p>
      <ul class="dlg-l">${pl.porEq.map((e) => `<li><b>${esc(e.nome)}</b>: ${e.n} trabalhos; acabava a ${fd(e.antes)}, passa a acabar a <b>${fd(e.depois, true)}</b></li>`).join("")}</ul>
      <p>${pl.mudam} atividades mudam de datas. A obra ${pl.fim !== S.tot.fim ? `passa a acabar a <b>${fd(pl.fim, true)}</b> (era ${fd(S.tot.fim, true)})` : `continua a acabar a ${fd(pl.fim, true)}`}.</p>
      ${pl.fora ? `<div class="dlg-av">${pl.fora} ${pl.fora === 1 ? "trabalho fica" : "trabalhos ficam"} fora da fila, porque a ordem das datas contradiz a sequência. Ficam na lista "sem lugar na fila" para os pôr à mão.</div>` : ""}
      <p class="note">Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: "Sim, pôr nas filas", estilo: "pri" }, { k: "nao", l: "Agora não" }],
  });
  if (k !== "sim") return;
  await store.updateMuitas(pl.lista, { tipo: "equipa", texto: `${pl.total} trabalhos postos nas filas das equipas` });
  toast(`${pl.total} trabalhos nas filas das equipas. ${pl.mudam} atividades mudaram de datas.`);
}
export function statsEquipa(nome) {
  const t = { total: 0, fazer: 0, curso: 0, atr: 0, conc: 0, prox: null };
  for (const a of Object.values(S.acts)) {
    if ((a.equipa || "") !== nome) continue;
    const r = S.res.get(a.id); if (!r) continue;
    t.total++;
    if (r.estado === "concluida") { t.conc++; continue; }
    t.fazer++;
    if (r.estado === "em_curso") t.curso++;
    if (r.atrasada) t.atr++;
    if (r.estado !== "em_curso" && (!t.prox || r.inicio < t.prox.r.inicio)) t.prox = { a, r };
  }
  return t;
}
export function equipasView() {
  const lista = S.eqLista;
  const semEq = Object.values(S.acts).filter((a) => !a.equipa && S.res.get(a.id).estado !== "concluida").length;
  const html = `
    ${defTabs("equipas")}
    <div class="card-h"><h1>Equipas de trabalho</h1><button class="btn pri" id="eqNova">+ Nova equipa</button></div>
    <p>As equipas que fazem os trabalhos na obra (mosaicos, pintura, carpintaria...). Na ficha de cada equipa diga o que ela pode fazer e onde trabalha: a aplicação mostra-lhe os trabalhos possíveis para planear. Se uma equipa sair da obra, abra a ficha dela e use <b>A equipa sai da obra</b>: os trabalhos que faltam passam para outras equipas.</p>
    ${semEq ? `<div class="banner"><span><b>${semEq} trabalhos por fazer ainda não têm equipa.</b></span><button class="btn sm" data-eqatr="_sem">Atribuir equipas</button></div>` : ""}
    ${lista.length ? `<div class="eqcards">${lista.filter((e) => e.ativa !== false).map((e) => {
      const t = statsEquipa(e.nome);
      const esps = (e.esp || []).map((k) => S.espIdx[k]).filter(Boolean);
      return `<section class="eqcard">
        <div class="eqcard-h"><b>${esc(e.nome)}</b>${e.daObra ? `<span class="pill" title="Já aparecia nos trabalhos. Ao editar fica registada aqui.">dos trabalhos</span>` : ""}</div>
        ${e.responsavel || e.telefone ? `<div class="note">${e.responsavel ? esc(e.responsavel) : ""}${e.responsavel && e.telefone ? " · " : ""}${e.telefone ? telLink(e.telefone) : ""}</div>` : ""}
        ${esps.length ? `<div class="tags">${esps.map((x) => `<span class="tag ro">${esc(x.nome)}</span>`).join("")}</div>` : ""}
        ${e.blocos && e.blocos.length ? `<div class="note">Trabalha em: ${e.blocos.map((k) => (k.length === 1 ? "Bloco " + k : k)).join(", ")}</div>` : ""}
        <div class="eqstats num"><span><b>${t.fazer}</b> por fazer</span><span><b>${t.curso}</b> em curso</span>${t.atr ? `<span class="mau-t"><b>${t.atr}</b> atrasados</span>` : ""}<span><b>${t.conc}</b> concluídos</span></div>
        ${t.prox ? `<div class="note">Próximo: ${esc(nomeAtiv(t.prox.a))} em ${esc(t.prox.a.unidade)}, ${t.prox.r.inicio <= S.hoje ? "já pode começar" : fd(t.prox.r.inicio)}</div>` : ""}
        ${e.notas ? `<div class="note">${esc(e.notas)}</div>` : ""}
        <div class="row" style="gap:6px;margin-top:auto"><button class="btn sm pri" data-eqplan="${esc(e.nome)}" title="Pôr os trabalhos desta equipa pela ordem em que os vai fazer">Planear</button><button class="btn sm" data-eqver="${esc(e.nome)}">Ver trabalhos</button><button class="btn sm" data-eqatr="${esc(e.nome)}">Atribuir trabalhos</button><button class="btn sm" data-eqed="${esc(e.nome)}">Editar</button></div>
      </section>`;
    }).join("")}</div>` : `<div class="empty">Ainda não há equipas. Crie a primeira com <b>+ Nova equipa</b>.</div>`}
    ${lista.some((e) => e.ativa === false) ? `<h2 style="margin-top:18px">Equipas que saíram da obra</h2><div class="eqcards">${lista.filter((e) => e.ativa === false).map((e) => { const t = statsEquipa(e.nome); return `<section class="eqcard inativa">
        <div class="eqcard-h"><b>${esc(e.nome)}</b><span class="pill">saiu${e.saiuEm ? " a " + fd(e.saiuEm) : ""}</span></div>
        <div class="eqstats num"><span><b>${t.conc}</b> concluídos</span>${t.fazer ? `<span class="mau-t"><b>${t.fazer}</b> ainda por fazer</span>` : ""}</div>
        <div class="row" style="gap:6px;margin-top:auto"><button class="btn sm" data-eqver="${esc(e.nome)}">Ver trabalhos</button><button class="btn sm" data-eqed="${esc(e.nome)}">Abrir</button></div></section>`; }).join("")}</div>` : ""}`;
  return {
    html, bind: () => {
      $("#eqNova").onclick = () => openEquipa(null);
      document.querySelectorAll("[data-eqed]").forEach((b) => (b.onclick = () => openEquipa(b.dataset.eqed)));
      document.querySelectorAll("[data-eqplan]").forEach((b) => (b.onclick = () => { ui.eqPlan = b.dataset.eqplan; location.hash = "#planequipa"; }));
      document.querySelectorAll("[data-eqver]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, PLANO_PADRAO(), { equipa: b.dataset.eqver }); location.hash = "#plano"; }));
      document.querySelectorAll("[data-eqatr]").forEach((b) => (b.onclick = () => {
        const nome = b.dataset.eqatr, e = S.eqLista.find((x) => x.nome === nome);
        const esps = e && e.esp && e.esp.length === 1 ? S.espIdx[e.esp[0]] : null;
        Object.assign(ui.plano, PLANO_PADRAO(), { equipa: "_sem", atribuir: true, selec: new Set(), atrEq: nome === "_sem" ? "" : nome, ativ: esps ? esps.nome : "" });
        location.hash = "#plano";
      }));
    },
  };
}
/** A equipa pode fazer este trabalho? (especialidade e zona escolhidas na ficha da equipa) */
export function podeFazer(e, a) {
  if (!e || !e.esp || !e.esp.length || !e.esp.includes(a.esp)) return false;
  if (!e.blocos || !e.blocos.length) return true;
  const u = S.uMap[a.unidade];
  return !!u && e.blocos.includes(u.tipo === "Loja" ? "Lojas" : u.bloco);
}
/* ============================================================ plano das equipas
   Cada equipa tem uma fila: a ordem em que vai fazer os trabalhos. O motor liga cada trabalho ao
   anterior da fila (só começa quando a equipa acaba o anterior), e tudo o que vem depois acerta-se. */
export function filaEquipa(nome) {
  return Object.values(S.acts).filter((a) => a.equipa === nome && temOrdem(a))
    .sort((x, y) => Number(x.eqOrdem) - Number(y.eqOrdem) || String(x.id).localeCompare(String(y.id)));
}
/** Grava uma nova ordem da fila (ids pela ordem) e diz o que mudou. */
export async function gravarFila(nome, ids, texto, extra = {}, semEquipa = [], grupos = {}) {
  const antes = filaEquipa(nome);
  const fimAntes = antes.filter((a) => S.res.get(a.id).estado !== "concluida").reduce((m, a) => (S.res.get(a.id).provFim > m ? S.res.get(a.id).provFim : m), "");
  const lista = [];
  const ords = ordensFila(ids, grupos);
  ids.forEach((id) => { const v = ords.get(id); const a = S.acts[id]; const p = { ...(extra[id] || {}) }; if (a.eqOrdem !== v) p.eqOrdem = v; if (a.equipa !== nome) p.equipa = nome; if (Object.keys(p).length) lista.push({ id, patch: p }); });
  for (const a of antes) if (!ids.includes(a.id)) lista.push({ id: a.id, patch: semEquipa.includes(a.id) ? { eqOrdem: null, equipa: null } : { eqOrdem: false } });
  for (const id of semEquipa) if (!antes.some((a) => a.id === id)) lista.push({ id, patch: { eqOrdem: null, equipa: null } });
  if (!lista.length) return;
  // simula antes de gravar para dizer quantas datas mudam
  const pm = new Map(lista.map((l) => [l.id, l.patch]));
  const novo = Object.values(S.acts).map((a) => (pm.has(a.id) ? { ...a, ...pm.get(a.id) } : a));
  const r2 = schedule(novo, S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor());
  let mudam = 0; for (const a of novo) { const x = S.res.get(a.id), y = r2.get(a.id); if (x && y && (x.provIni !== y.provIni || x.provFim !== y.provFim)) mudam++; }
  const fimDepois = ids.filter((id) => r2.get(id).estado !== "concluida").reduce((m, id) => (r2.get(id).provFim > m ? r2.get(id).provFim : m), "");
  const ciclo = ids.filter((id) => r2.get(id).ciclo).length;
  const novos = ids.filter((id) => r2.get(id).ciclo && !S.res.get(id).ciclo);
  if (novos.length) {
    const k = await perguntar({
      titulo: "Esta ordem contradiz a sequência",
      texto: `<p>Com esta ordem, a equipa faria um trabalho antes de outro de que ele depende. Por exemplo: ${esc(nomeAtiv(S.acts[novos[0]]))} em ${esc(S.acts[novos[0]].unidade)}.</p><p class="note">Assim a aplicação não consegue calcular as datas destes trabalhos. O melhor é escolher outra ordem.</p>`,
      opcoes: [{ k: "nao", l: "Não gravar", estilo: "pri" }, { k: "sim", l: "Gravar mesmo assim" }],
    });
    if (k !== "sim") return;
  }
  await store.updateMuitas(lista, { tipo: "equipa", texto: `${nome}: ${texto}` });
  toast(`${texto}. ${mudam ? `${mudam} ${mudam === 1 ? "atividade mudou" : "atividades mudaram"} de datas` : "Nenhuma data mudou"}${fimDepois && fimDepois !== fimAntes ? `; a equipa acaba a ${fd(fimDepois)}${fimAntes ? ` (era ${fd(fimAntes)})` : ""}` : ""}.${ciclo ? " Atenção: há trabalhos em conflito com a sequência." : ""}`);
}
export function planEquipaView() {
  const eqs = S.eqLista.filter((e) => e.ativa !== false);
  if (!eqs.length) return { html: `${defTabs("planequipa")}<div class="card-h"><h1>Plano das equipas</h1></div><div class="empty">Ainda não há equipas. Crie-as em <a href="#equipas">Equipas de trabalho</a>.</div>`, bind: () => {} };
  if (!ui.eqPlan || !eqs.some((e) => e.nome === ui.eqPlan)) ui.eqPlan = eqs[0].nome;
  const nome = ui.eqPlan;
  const ep = (ui.eqP = ui.eqP || { conc: false, fr: "", at: "" });
  const fq = (ui.eqF = ui.eqF || EQF_PADRAO());
  const passa = passaFiltroEq(fq);
  const fila = filaEquipa(nome);
  const naFila = new Set(fila.map((a) => a.id));
  const vis = ep.conc ? fila : fila.filter((a) => S.res.get(a.id).estado !== "concluida");
  const nConc = fila.length - fila.filter((a) => S.res.get(a.id).estado !== "concluida").length;
  const porOrdenar = Object.values(S.acts).filter((a) => a.equipa === nome && !naFila.has(a.id) && S.res.get(a.id).estado !== "concluida")
    .sort((x, y) => (S.res.get(x.id).inicio || "").localeCompare(S.res.get(y.id).inicio || ""));
  // janela das barras
  let t0 = null, t1 = null;
  for (const a of vis.filter(passa)) { const r = S.res.get(a.id); for (const d of [r.provIni, r.provFim]) if (d) { if (!t0 || d < t0) t0 = d; if (!t1 || d > t1) t1 = d; } }
  const span = Math.max(1, t0 ? diffDays(t0, t1) : 1);
  const pos = (d) => Math.max(0, Math.min(100, (100 * diffDays(t0, d)) / span));
  // dias parados e resumo: sempre da fila toda, com ou sem filtros
  let parada = 0, fimEq = null, iniEq = null;
  let ant = null;
  const gaps = new Map();
  for (const a of vis) {
    const r = S.res.get(a.id);
    const ini = r.provIni, fim = r.provFim;
    if (r.estado !== "concluida") { if (!iniEq || ini < iniEq) iniEq = ini; if (!fimEq || fim > fimEq) fimEq = fim; }
    let gap = 0, motivo = "", depoisGrupo = 0;
    // à espera de outro trabalho (que não seja da fila da equipa) ou da data prevista
    const porque = () => { const outra = (r.preds || []).filter((d) => d.fonte !== "equipa" && d.fonte !== "grupo").map((d) => ({ d, p: S.res.get(d.id) })).filter((x) => x.p).sort((x, y) => y.p.provFim.localeCompare(x.p.provFim))[0];
      return outra && addDays(outra.p.provFim, 1) >= ini ? `à espera de ${nomeAtiv(S.acts[outra.d.id])}${S.acts[outra.d.id].unidade !== a.unidade ? " em " + S.acts[outra.d.id].unidade : ""}` : ini === S.hoje ? "ainda não começou" : "data prevista mais tarde"; };
    // ao mesmo tempo que o de cima: compara com o primeiro do grupo, não conta como equipa parada
    const prim = r.estado !== "concluida" && (r.preds || []).find((d) => d.fonte === "grupo");
    // a equipa fica parada entre o fim do(s) trabalho(s) de que espera na fila e o início deste
    const antEq = r.estado === "concluida" || prim ? [] : (r.preds || []).filter((d) => d.fonte === "equipa").map((d) => S.res.get(d.id)).filter((p) => p && p.estado !== "concluida");
    if (prim && S.res.get(prim.id)) { depoisGrupo = Math.max(0, diffDays(S.res.get(prim.id).provIni, ini)); if (depoisGrupo > 0) motivo = porque(); }
    if (antEq.length) {
      gap = Math.max(0, diffDays(antEq.reduce((m, p) => (p.provFim > m ? p.provFim : m), ""), ini) - 1);
      if (gap > 0) {
        parada += gap;
        motivo = porque();
      }
    }
    gaps.set(a.id, { gap, motivo, depoisGrupo });
    ant = a;
  }
  const visF = vis.filter((a) => passa(a) && (fq.estado !== "parada" || gaps.get(a.id).gap > 0));
  const numGrupo = new Map();
  let nGrupos = 0;
  { let g = 0; for (const a of fila) { if (!eJunto(a) || !g) g++; numGrupo.set(a.id, g); } nGrupos = g; }
  const nFrentes = frentesDe(nome);
  const filtrado = visF.length !== vis.length;
  const visIds = visF.map((a) => a.id);
  const linhas = visF.map((a) => {
    const r = S.res.get(a.id);
    const ini = r.provIni, fim = r.provFim;
    const { gap, motivo, depoisGrupo } = gaps.get(a.id);
    const pi = fila.indexOf(a), k = visIds.indexOf(a.id), junto = eJunto(a);
    return `<div class="fq-row ${r.estado === "concluida" ? "conc" : ""} ${r.ciclo ? "ciclo" : ""} ${junto ? "junto" : ""}" data-fq="${a.id}" draggable="true">
      <div class="ordb"><button class="ord-b" data-fqm="${a.id}|-1" ${k === 0 ? "disabled" : ""} title="${filtrado ? "Fazer antes do trabalho visível de cima" : "Fazer antes"}" aria-label="Fazer antes">▲</button><button class="ord-b" data-fqm="${a.id}|1" ${k === visIds.length - 1 ? "disabled" : ""} title="${filtrado ? "Fazer depois do trabalho visível de baixo" : "Fazer depois"}" aria-label="Fazer depois">▼</button></div>
      ${r.estado === "concluida" ? `<span class="fq-n num" title="Lugar na fila">${numGrupo.get(a.id)}</span>` : `<input class="fq-n ord-n num" type="number" inputmode="numeric" min="1" max="${nGrupos}" value="${numGrupo.get(a.id)}" data-fqn="${a.id}" title="${junto ? "Ao mesmo tempo que o de cima. " : ""}Escreva o lugar na fila e carregue em Enter" aria-label="Lugar na fila de ${esc(nomeAtiv(a))} em ${esc(a.unidade)}">`}
      ${pi > 0 && r.estado !== "concluida" ? `<label class="fq-junto" title="${filtrado ? "Tire os filtros para juntar ou separar" : "Ao mesmo tempo que o de cima: a equipa faz este trabalho ao mesmo tempo que o de cima; o seguinte espera que acabem os dois"}"><input type="checkbox" data-fqj="${a.id}" ${junto ? "checked" : ""} ${filtrado ? "disabled" : ""} aria-label="Ao mesmo tempo que o de cima"><span>Junto</span></label>` : `<span class="fq-junto"></span>`}
      <div class="fq-t"><button class="lnk-b" data-a="${a.id}" title="${esc(nomeAtiv(a))} em ${esc(a.unidade)}"><b>${esc(nomeAtiv(a))}</b></button><span class="mono">${esc(a.unidade)}</span>
        ${gap > 0 ? `<span class="fq-gap" title="Equipa parada ${gap} ${gap === 1 ? "dia" : "dias"} antes: ${esc(motivo)}">parada ${gap} d</span>` : ""}
        ${depoisGrupo > 0 ? `<span class="fq-gap" title="Começa ${depoisGrupo} ${depoisGrupo === 1 ? "dia" : "dias"} depois do primeiro do grupo: ${esc(motivo)}">+${depoisGrupo} d</span>` : ""}
        ${r.ciclo ? `<span class="fq-gap mau-t" title="Esta ordem contradiz a sequência dos trabalhos">contradiz a sequência</span>` : ""}</div>
      <span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>
      <div class="tl fq-tl" aria-hidden="true"><div class="fc st-${r.estado}" style="left:${pos(ini)}%;width:${Math.max(1, pos(fim) - pos(ini))}%"></div>${S.hoje >= t0 && S.hoje <= t1 ? `<div class="today" style="left:${pos(S.hoje)}%"></div>` : ""}</div>
      <span class="fq-d mono num">${fd(ini)} a ${fd(fim)}</span>
      <span class="fq-dv">${deltaHTML(r.atraso)}</span>
      <span class="fq-ac"><button class="btn sm" data-fqx="${a.id}" title="Sai da fila, mas continua atribuído à equipa">Tirar da fila</button><button class="btn sm tira-b" data-fqrem="${a.id}" title="Deixa de ser desta equipa e sai da fila">× Tirar da equipa</button></span>
    </div>`;
  }).join("");
  const eq = eqs.find((e) => e.nome === nome);
  const pot = Object.values(S.acts).filter((a) => !naFila.has(a.id) && a.equipa !== nome && podeFazer(eq, a) && S.res.get(a.id).estado !== "concluida" && passa(a) && fq.estado !== "parada")
    .sort((x, y) => (!x.equipa || !S.equipas.includes(x.equipa) ? 0 : 1) - (!y.equipa || !S.equipas.includes(y.equipa) ? 0 : 1) || (S.res.get(x.id).inicio || "").localeCompare(S.res.get(y.id).inicio || ""));
  const porOrdenarF = porOrdenar.filter((a) => passa(a) && fq.estado !== "parada");
  // atividades que interessam a este ecrã, para as opções dos filtros
  const daPagina = [...fila, ...porOrdenar, ...Object.values(S.acts).filter((a) => !naFila.has(a.id) && a.equipa !== nome && podeFazer(eq, a) && S.res.get(a.id).estado !== "concluida")];
  const frs = S.unidades.filter((u) => (!fq.bloco || grupoBloco(u) === fq.bloco) && u.acts.some((a) => !naFila.has(a.id) && S.res.get(a.id).estado !== "concluida"));
  const ativsFr = ep.fr ? (S.uMap[ep.fr] ? S.uMap[ep.fr].acts : []).filter((a) => !naFila.has(a.id) && S.res.get(a.id).estado !== "concluida") : [];
  const html = `
    ${defTabs("planequipa")}
    <div class="card-h"><h1>Plano das equipas</h1>
      <label class="f" ${ep.vista === "todas" ? "hidden" : ""}>Equipa<select class="inp" id="fqEq">${eqs.map((e) => `<option ${e.nome === nome ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select></label></div>
    <p>Ponha os trabalhos da equipa pela ordem em que os vai fazer: por exemplo, primeiro os azulejos do A-F101, depois os do A-F102. Cada trabalho só começa quando a equipa acaba o anterior, e as datas de tudo o que vem a seguir acertam-se sozinhas. Se a equipa fizer vários trabalhos ao mesmo tempo, mude as Frentes ou marque Ao mesmo tempo que o de cima. Quando atribui uma equipa a um trabalho, ele entra logo na fila dela, pela data em que pode começar.</p>
    ${(() => { const n = Object.values(S.acts).filter((a) => a.equipa && S.equipas.includes(a.equipa) && (a.eqOrdem == null || a.eqOrdem === "") && S.res.get(a.id).estado !== "concluida").length; return n ? `<div class="banner warn no-print"><span><b>${n} trabalhos com equipa ainda não estão em fila nenhuma.</b> Enquanto não estiverem, a app não sabe que a equipa não pode fazê-los ao mesmo tempo.</span><button class="btn sm pri" id="fqTodasEq">Pôr nas filas</button></div>` : ""; })()}
    <div class="seg-v no-print">${[["lista", "Fila"], ["gantt", "Gantt da equipa"], ["todas", "Gantt de todas as equipas"]].map(([k, l]) => `<button class="${(ep.vista || "lista") === k ? "on" : ""}" data-fqv="${k}">${l}</button>`).join("")}</div>
    ${ep.vista === "todas" ? filtrosEqHTML(fq, Object.values(S.acts).filter((a) => a.equipa && S.res.get(a.id).estado !== "concluida"), false) + ganttEquipasHTML(null, passa) : `
    <div class="fq-res">
      <div><span class="eyebrow">Na fila</span><b class="num">${fila.length - nConc}</b><span class="note">por fazer${nConc ? ` · ${nConc} feitos` : ""}</span></div>
      <div><span class="eyebrow">Começa</span><b class="num">${iniEq ? fd(iniEq, true) : "sem trabalhos"}</b></div>
      <div><span class="eyebrow">Acaba a fila</span><b class="num">${fimEq ? fd(fimEq, true) : "sem trabalhos"}</b></div>
      <div><span class="eyebrow">Dias parada</span><b class="num ${parada ? "mau-t" : ""}">${parada}</b><span class="note">à espera de outros trabalhos</span></div>
    </div>
    ${filtrosEqHTML(fq, daPagina, true)}
    ${ep.vista === "gantt" ? ganttEquipasHTML(nome, passa) : `<section class="card">
      <div class="card-h"><h2>Fila da ${esc(nome)}</h2><div class="row">${nConc ? `<label class="check"><input type="checkbox" id="fqConc" ${ep.conc ? "checked" : ""}><span>Mostrar os já feitos</span></label>` : ""}
        <label class="f fq-fr" title="Quantos trabalhos esta equipa faz ao mesmo tempo">Frentes<select class="inp" id="fqFrentes">${[1, 2, 3, 4, 5, 6, 8, 10].map((n) => `<option value="${n}" ${n === nFrentes ? "selected" : ""}>${n === 1 ? "1 (um trabalho de cada vez)" : n + " ao mesmo tempo"}</option>`).join("")}</select></label></div></div>
      ${nFrentes > 1 ? `<p class="note fq-frn">Com ${nFrentes} frentes, a equipa faz ${nFrentes} trabalhos ao mesmo tempo: cada um começa quando acaba o que está ${nFrentes} lugares acima. Os trabalhos juntos com "Ao mesmo tempo que o de cima" contam como um só lugar.</p>` : ""}
      ${visF.length ? `<p class="note" style="margin:0">${filtrado ? `A mostrar ${visF.length} de ${vis.length} trabalhos da fila. O número é a posição na fila completa; as setas trocam com o trabalho visível de cima ou de baixo.` : "Para mudar a ordem, arraste as linhas, use as setas ou escreva o lugar na caixa do número e carregue em Enter. Marque Junto para a equipa fazer o trabalho ao mesmo tempo que o de cima."}</p><div class="fq">${linhas}</div>` : vis.length ? `<div class="empty">Nenhum trabalho da fila corresponde aos filtros.</div>` : `<div class="empty">A fila está vazia. Junte trabalhos em baixo.</div>`}
    </section>`}
    <section class="card">
      <div class="card-h"><h2>Trabalhos da equipa ainda sem lugar na fila</h2>${porOrdenarF.length > 1 ? `<button class="btn sm pri" id="fqTodas">${porOrdenarF.length < porOrdenar.length ? `Pôr estes ${porOrdenarF.length} na fila` : "Pôr todos na fila"}</button>` : ""}</div>
      ${porOrdenarF.length ? `<p class="note" style="margin:0">Enquanto aqui estiverem, a app não conta com a disponibilidade da equipa para eles: as datas são as de cada trabalho, como se a equipa os pudesse fazer todos ao mesmo tempo. Ponha-os na fila para isso deixar de acontecer.</p><div class="fq">${porOrdenarF.map((a) => { const r = S.res.get(a.id); return `<div class="fq-row fq-po"><span></span><span></span><span></span><div class="fq-t"><button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button><span class="mono">${esc(a.unidade)}</span></div><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span><span class="fq-tl"></span><span class="fq-d mono num">${fd(r.provIni)} a ${fd(r.provFim)}</span><span></span><span class="fq-ac"><button class="btn sm" data-fqadd="${a.id}">+ Pôr na fila</button><button class="btn sm tira-b" data-fqrem="${a.id}" title="Deixa de ser desta equipa">× Tirar da equipa</button></span></div>`; }).join("")}</div>`
        : porOrdenar.length ? `<div class="note">Nenhum dos ${porOrdenar.length} trabalhos sem lugar na fila corresponde aos filtros.</div>` : `<div class="note">Todos os trabalhos atribuídos a esta equipa já estão na fila.</div>`}
    </section>
    <section class="card">
      <div class="card-h"><h2>Trabalhos que a equipa pode fazer</h2>${pot.length > 40 ? `<span class="note">os primeiros 40 de ${pot.length}: use os filtros</span>` : ""}</div>
      ${!eq || !eq.esp || !eq.esp.length ? `<div class="note">Diga na ficha da equipa que especialidades ela faz e a aplicação mostra aqui os trabalhos possíveis. <button class="btn sm" data-eqed2="${esc(nome)}">Abrir a ficha da equipa</button></div>`
        : pot.length ? `<p class="note" style="margin:0">Pelas especialidades${eq.blocos && eq.blocos.length ? " e zonas" : ""} da equipa. Primeiro os que não têm equipa.</p><div class="fq">${pot.slice(0, 40).map((a) => { const r = S.res.get(a.id); const outra = a.equipa && S.equipas.includes(a.equipa); return `<div class="fq-row fq-po"><span></span><span></span><span></span><div class="fq-t"><button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button><span class="mono">${esc(a.unidade)}${outra ? ` · com ${esc(a.equipa)}` : a.equipa ? ` · era de ${esc(a.equipa)}, que saiu` : " · sem equipa"}</span></div><span class="pill st-${r.estado}">${ESTADO[r.estado]}</span><span class="fq-tl"></span><span class="fq-d mono num">${fd(r.provIni)} a ${fd(r.provFim)}</span><span></span><button class="btn sm" data-fqpot="${a.id}">+ Pôr na fila</button></div>`; }).join("")}</div>${pot.length > 40 ? `<p class="note">E mais ${pot.length - 40}. Escolha um apartamento para ver menos.</p>` : ""}`
        : `<div class="note">${eqfAtivo(fq) ? "Nenhum trabalho que esta equipa possa fazer corresponde aos filtros." : "Não há mais trabalhos por fazer que esta equipa possa fazer."}</div>`}
    </section>
    <section class="card">
      <div class="card-h"><h2>Juntar outro trabalho à fila</h2></div>
      <p class="note" style="margin:0">Escolha o apartamento e o trabalho. Se for de outra equipa, passa para a ${esc(nome)}.</p>
      <div class="row" style="align-items:flex-end;flex-wrap:wrap">
        <label class="f">Apartamento ou zona<select class="inp" id="fqFr"><option value="">Escolha...</option>${frs.map((u) => `<option value="${esc(u.id)}" ${ep.fr === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" ? u.id : u.nome || u.id)}</option>`).join("")}</select></label>
        <label class="f">Trabalho<select class="inp" id="fqAt" ${ep.fr ? "" : "disabled"}><option value="">Escolha...</option>${ativsFr.map((a) => `<option value="${a.id}">${esc(nomeAtiv(a))}${a.equipa ? " (" + esc(a.equipa) + ")" : ""}</option>`).join("")}</select></label>
        <button class="btn pri" id="fqJunta" disabled>Juntar à fila</button>
      </div>
    </section>`}`;
  return { html, bind: () => {
    bindCommon();
    $("#fqEq").onchange = (e) => { ui.eqPlan = e.target.value; ep.fr = ""; render(); };
    const fte = $("#fqTodasEq"); if (fte) fte.onclick = filasTodas;
    document.querySelectorAll("[data-fqv]").forEach((b) => (b.onclick = () => { ep.vista = b.dataset.fqv; render(); }));
    bindFiltrosEq(fq);
    document.querySelectorAll("[data-gez]").forEach((b) => (b.onclick = () => { ep.zoom = b.dataset.gez; render(); }));
    document.querySelectorAll("[data-geq]").forEach((b) => (b.onclick = () => { ui.eqPlan = b.dataset.geq; ep.vista = "gantt"; render(); }));
    const gs = $(".ge-scroll"); if (gs && !gs.dataset.posto) { const h = gs.querySelector(".ge-hoje"); if (h) gs.scrollLeft = Math.max(0, h.offsetLeft - 160); gs.dataset.posto = 1; }
    if (ep.vista === "todas") return;
    const fc = $("#fqConc"); if (fc) fc.onchange = () => { ep.conc = fc.checked; render(); };
    const ids = fila.map((a) => a.id);
    // as setas trocam com o vizinho visível (com filtros, os trabalhos escondidos ficam onde estão)
    document.querySelectorAll("[data-fqm]").forEach((b) => (b.onclick = () => {
      const [id, d] = b.dataset.fqm.split("|"); const k = visIds.indexOf(id);
      const viz = visIds[k + Number(d)]; if (!viz) return;
      const l = ids.filter((x) => x !== id);
      const soltar = soltarAoMover(id, ids);
      const preso = (x) => eJunto(S.acts[x]) && !soltar.has(x); // continua junto com o de cima
      // salta o grupo inteiro do vizinho: para baixo vai para depois do último do grupo; para cima, para antes do primeiro
      let pos = l.indexOf(viz);
      if (Number(d) > 0) { while (pos + 1 < l.length && preso(l[pos + 1])) pos++; pos++; } else { while (pos > 0 && preso(l[pos])) pos--; }
      l.splice(pos, 0, id);
      gravarFila(nome, l, `${nomeAtiv(S.acts[id])} em ${S.acts[id].unidade} passou para ${l.indexOf(id) + 1}.º`, {}, [], { soltar });
    }));
    // escrever o lugar: o trabalho passa a ser o N.º da fila (sai do grupo onde estava; os grupos contam como um lugar)
    document.querySelectorAll("[data-fqn]").forEach((inp) => {
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } if (e.key === "Escape") { inp.value = inp.defaultValue; inp.blur(); } };
      inp.onchange = () => {
        const id = inp.dataset.fqn, n = Math.round(Number(inp.value));
        if (!n || n === Number(inp.defaultValue)) { inp.value = inp.defaultValue; return; }
        const soltar = soltarAoMover(id, ids);
        const l = ids.filter((x) => x !== id);
        const preso = (x) => eJunto(S.acts[x]) && !soltar.has(x);
        const cabecas = l.map((x, i) => (i === 0 || !preso(x) ? i : -1)).filter((i) => i >= 0);
        const alvo = Math.max(1, Math.min(n, cabecas.length + 1));
        l.splice(alvo <= cabecas.length ? cabecas[alvo - 1] : l.length, 0, id);
        ui.focoFqn = id;
        gravarFila(nome, l, `${nomeAtiv(S.acts[id])} em ${S.acts[id].unidade} passou para ${alvo}.º lugar na fila`, {}, [], { soltar });
      };
    });
    if (ui.focoFqn) { const f = document.querySelector(`[data-fqn="${ui.focoFqn}"]`); ui.focoFqn = null; if (f) f.scrollIntoView({ block: "center" }); }
    // arrastar
    let arr = null;
    document.querySelectorAll(".fq-row[data-fq]").forEach((row) => {
      row.ondragstart = (e) => { if (/INPUT|SELECT/.test(e.target.tagName)) { e.preventDefault(); return; } arr = row.dataset.fq; row.classList.add("arr"); e.dataTransfer.effectAllowed = "move"; };
      row.ondragend = () => { row.classList.remove("arr"); document.querySelectorAll(".fq-row.alvo").forEach((x) => x.classList.remove("alvo")); };
      row.ondragover = (e) => { if (!arr) return; e.preventDefault(); document.querySelectorAll(".fq-row.alvo").forEach((x) => x.classList.remove("alvo")); row.classList.add("alvo"); };
      row.ondrop = (e) => { e.preventDefault(); const alvo = row.dataset.fq; if (!arr || arr === alvo) return; const id = arr; arr = null;
        const l = ids.filter((x) => x !== id); l.splice(l.indexOf(alvo) + (ids.indexOf(id) < ids.indexOf(alvo) ? 1 : 0), 0, id);
        gravarFila(nome, l, `${nomeAtiv(S.acts[id])} em ${S.acts[id].unidade} passou para ${l.indexOf(id) + 1}.º`, {}, [], { soltar: soltarAoMover(id, ids) }); };
    });
    document.querySelectorAll("[data-fqj]").forEach((c) => (c.onchange = () => {
      const id = c.dataset.fqj, a = S.acts[id], ant = S.acts[ids[ids.indexOf(id) - 1]];
      gravarFila(nome, ids, c.checked ? `${nomeAtiv(a)} em ${a.unidade} passa a ser feito ao mesmo tempo que ${nomeAtiv(ant)} em ${ant.unidade}` : `${nomeAtiv(a)} em ${a.unidade} deixa de ser feito ao mesmo tempo que o anterior`, {}, [], c.checked ? { juntar: new Set([id]) } : { soltar: new Set([id]) });
    }));
    const fr = $("#fqFrentes"); if (fr) fr.onchange = () => mudarFrentes(nome, Number(fr.value));
    document.querySelectorAll("[data-fqx]").forEach((b) => (b.onclick = async () => {
      const a = S.acts[b.dataset.fqx];
      if (!(await confirmar("Tirar da fila?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} sai da fila da ${esc(nome)}. Continua atribuído à equipa, mas a app deixa de contar com a disponibilidade dela para este trabalho: deixa de esperar pelo anterior da fila, e o seguinte deixa de esperar por ele.</p>`, "Sim, tirar da fila"))) return;
      gravarFila(nome, ids.filter((x) => x !== a.id), `${nomeAtiv(a)} em ${a.unidade} saiu da fila`);
    }));
    document.querySelectorAll("[data-fqrem]").forEach((b) => (b.onclick = async () => {
      const a = S.acts[b.dataset.fqrem];
      if (!(await confirmar("Tirar da equipa?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} deixa de ser da ${esc(nome)}${ids.includes(a.id) ? " e sai da fila dela. O trabalho seguinte da fila deixa de esperar por este" : ""}.</p><p class="note">Fica sem equipa. Pode atribuí-lo a outra equipa depois, aqui no plano dela ou em Trabalhos.</p>`, "Sim, tirar da equipa"))) return;
      gravarFila(nome, ids.filter((x) => x !== a.id), `${nomeAtiv(a)} em ${a.unidade} deixou de ser da ${nome}`, {}, [a.id]);
    }));
    document.querySelectorAll("[data-fqadd]").forEach((b) => (b.onclick = () => { const a = S.acts[b.dataset.fqadd]; gravarFila(nome, ordemComNovos(nome, [a.id], ids), `${nomeAtiv(a)} em ${a.unidade} entrou na fila`); }));
    const ft = $("#fqTodas"); if (ft) ft.onclick = async () => {
      if (!(await confirmar(`Pôr ${porOrdenarF.length} trabalhos na fila?`, `<p>Entram na fila da ${esc(nome)}, cada um na posição da data em que pode começar. Depois pode mudar a ordem.</p>`, "Sim, pôr na fila"))) return;
      gravarFila(nome, ordemComNovos(nome, porOrdenarF.map((a) => a.id), ids), `${porOrdenarF.length} trabalhos entraram na fila`);
    };
    document.querySelectorAll("[data-eqed2]").forEach((b) => (b.onclick = () => openEquipa(b.dataset.eqed2)));
    document.querySelectorAll("[data-fqpot]").forEach((b) => (b.onclick = async () => {
      const a = S.acts[b.dataset.fqpot];
      if (a.equipa && S.equipas.includes(a.equipa) && !(await confirmar("Mudar de equipa?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} está com a ${esc(a.equipa)}. Passa para a ${esc(nome)} e entra na fila dela, pela data em que pode começar.</p>`, "Sim, passar"))) return;
      gravarFila(nome, ordemComNovos(nome, [a.id], ids), `${nomeAtiv(a)} em ${a.unidade} entrou na fila`);
    }));
    const sf = $("#fqFr"), sa = $("#fqAt"), bj = $("#fqJunta");
    sf.onchange = () => { ep.fr = sf.value; render(); };
    sa.onchange = () => { bj.disabled = !sa.value; };
    bj.onclick = async () => {
      const a = S.acts[sa.value]; if (!a) return;
      if (a.equipa && a.equipa !== nome && !(await confirmar("Mudar de equipa?", `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} está com a ${esc(a.equipa)}. Passa para a ${esc(nome)} e entra na fila dela, pela data em que pode começar.</p>`, "Sim, passar"))) return;
      ep.fr = "";
      gravarFila(nome, ordemComNovos(nome, [a.id], ids), `${nomeAtiv(a)} em ${a.unidade} entrou na fila`);
    };
  } };
}
/** Muda quantas frentes (trabalhos ao mesmo tempo) uma equipa tem; diz o efeito no fim da fila. */
export async function mudarFrentes(nome, n) {
  n = Math.max(1, Math.floor(n || 1));
  const reg = (S.cfg.equipas || []).filter((e) => e && e.nome);
  const i = reg.findIndex((e) => e.nome === nome);
  const lista = i >= 0 ? reg.map((e, j) => (j === i ? { ...e, frentes: n > 1 ? n : null } : e)) : [...reg, { id: "eq" + Date.now().toString(36), nome, esp: [], blocos: [], frentes: n > 1 ? n : null }];
  const fimDe = (res) => filaEquipa(nome).filter((a) => res.get(a.id).estado !== "concluida").reduce((m, a) => (res.get(a.id).provFim > m ? res.get(a.id).provFim : m), "");
  const r2 = schedule(Object.values(S.acts), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor({ ...S.cfg, equipas: lista }));
  const antes = fimDe(S.res), depois = fimDe(r2);
  await store.setConfig({ equipas: lista }, { tipo: "equipa", texto: `${nome} passou a ter ${n === 1 ? "1 frente (um trabalho de cada vez)" : n + " frentes"}` });
  toast(`${nome}: ${n === 1 ? "um trabalho de cada vez" : n + " trabalhos ao mesmo tempo"}.${antes && depois && antes !== depois ? ` A fila passa a acabar a ${fd(depois, true)} (era ${fd(antes, true)}).` : ""}`);
}
/* ============================================================ filtros do plano das equipas */
export const EQF_ESTADOS = [["", "Todos"], ["atrasada", "Atrasados"], ["em_curso", "Em curso"], ["por_iniciar", "Podem começar"], ["bloqueada", "À espera de outros"], ["parada", "Com a equipa parada antes"]];
export function passaFiltroEq(f) {
  const q = semAcento(f.q || "").trim();
  return (a) => {
    const u = S.uMap[a.unidade] || {}, r = S.res.get(a.id);
    if (f.bloco && grupoBloco(u) !== f.bloco) return false;
    if (f.fr && a.unidade !== f.fr) return false;
    if (f.esp && nomeAtiv(a) !== f.esp) return false;
    if (f.estado === "atrasada" && !r.atrasada) return false;
    if (["em_curso", "por_iniciar", "bloqueada"].includes(f.estado) && r.estado !== f.estado) return false;
    if (q && !semAcento(`${a.unidade} ${u.nome || ""} ${nomeAtiv(a)} ${a.ref || ""}`).includes(q)) return false;
    return true;
  };
}
/** Barra de filtros. acts: as atividades do ecrã, para só mostrar opções que existem. */
export function filtrosEqHTML(f, acts, comParada) {
  const us = new Map(acts.map((a) => [a.unidade, S.uMap[a.unidade]]).filter(([, u]) => u));
  const blocos = ORD_BLOCOS.filter((b) => [...us.values()].some((u) => grupoBloco(u) === b));
  const frs = [...us.values()].filter((u) => !f.bloco || grupoBloco(u) === f.bloco).sort((a, b) => a.id.localeCompare(b.id, "pt", { numeric: true }));
  const esps = [...new Set(acts.filter((a) => (!f.bloco || grupoBloco(S.uMap[a.unidade] || {}) === f.bloco) && (!f.fr || a.unidade === f.fr)).map(nomeAtiv))].sort((a, b) => a.localeCompare(b, "pt"));
  if (f.fr && !frs.some((u) => u.id === f.fr)) frs.push(S.uMap[f.fr] || { id: f.fr });
  if (f.esp && !esps.includes(f.esp)) esps.push(f.esp);
  return `<div class="filters fq-filtros no-print">
    <label class="f">Bloco<select class="inp" id="fqfB"><option value="">Todos</option>${blocos.map((b) => `<option value="${b}" ${f.bloco === b ? "selected" : ""}>${rotuloAlvo(b)}</option>`).join("")}</select></label>
    <label class="f">Apartamento ou zona<select class="inp" id="fqfU"><option value="">Todos</option>${frs.map((u) => `<option value="${esc(u.id)}" ${f.fr === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || u.tipo === "Loja" || !u.nome ? u.id : u.nome)}</option>`).join("")}</select></label>
    <label class="f">Trabalho<select class="inp" id="fqfE"><option value="">Todos</option>${esps.map((n) => `<option ${f.esp === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <label class="f">Estado<select class="inp" id="fqfS">${EQF_ESTADOS.filter(([k]) => comParada || k !== "parada").map(([k, l]) => `<option value="${k}" ${f.estado === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="f fq-q">Procurar<input class="inp" id="fqfQ" type="search" value="${esc(f.q || "")}" placeholder="Ex.: B-F503, pladur"></label>
    ${eqfAtivo(f) ? `<button class="btn sm repor-on" id="fqfLimpar">Limpar filtros</button>` : ""}
  </div>`;
}
export function bindFiltrosEq(f) {
  const liga = (sel, k, depois) => { const el = $(sel); if (el) el.onchange = () => { f[k] = el.value; if (depois) depois(); render(); }; };
  liga("#fqfB", "bloco", () => { if (f.fr && S.uMap[f.fr] && grupoBloco(S.uMap[f.fr]) !== f.bloco && f.bloco) f.fr = ""; });
  liga("#fqfU", "fr");
  liga("#fqfE", "esp");
  liga("#fqfS", "estado");
  let tm;
  const q = $("#fqfQ");
  if (q) q.oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { f.q = e.target.value; render(); const i = $("#fqfQ"); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (er) {} } }, 300); };
  const l = $("#fqfLimpar"); if (l) l.onclick = () => { Object.assign(f, EQF_PADRAO()); render(); };
}
/** Gantt das equipas. nome = uma equipa (uma linha por trabalho, pela ordem da fila); null = todas (uma linha por equipa). */
export function ganttEquipasHTML(nome, passa = () => true) {
  const ep = ui.eqP;
  const pxd = { semana: 14, mes: 5, trimestre: 2 }[ep.zoom || "mes"];
  const eqs = S.eqLista.filter((e) => e.ativa !== false);
  const deEq = (n) => {
    const f = filaEquipa(n);
    const naFila = new Set(f.map((a) => a.id));
    const resto = Object.values(S.acts).filter((a) => a.equipa === n && !naFila.has(a.id)).sort((x, y) => (S.res.get(x.id).provIni || "").localeCompare(S.res.get(y.id).provIni || ""));
    return [...f.map((a) => ({ a, fila: true })), ...resto.map((a) => ({ a, fila: false }))].filter((x) => (S.res.get(x.a.id).estado !== "concluida" || (S.res.get(x.a.id).provFim || "") >= addDays(S.hoje, -30)) && passa(x.a));
  };
  const grupos = nome ? [{ n: nome, itens: deEq(nome) }] : eqs.map((e) => ({ n: e.nome, itens: deEq(e.nome) })).filter((g) => g.itens.length);
  const todos = grupos.flatMap((g) => g.itens);
  if (!todos.length) return `<section class="card"><div class="empty">${eqfAtivo(ui.eqF) ? "Nenhum trabalho corresponde aos filtros." : nome ? "Esta equipa não tem trabalhos por fazer." : "As equipas não têm trabalhos por fazer."}</div></section>`;
  let t0 = addDays(S.hoje, -21), t1 = addDays(S.hoje, 30);
  for (const { a } of todos) { const r = S.res.get(a.id); if (r.provIni && r.provIni < t0 && r.estado !== "concluida") t0 = r.provIni; if (r.provFim > t1) t1 = r.provFim; }
  if (diffDays(addDays(S.hoje, -120), t0) < 0) t0 = addDays(S.hoje, -120); // não recuar demasiado
  t0 = addDays(t0, -3); t1 = addDays(t1, 7);
  const dias = diffDays(t0, t1) + 1, W = dias * pxd;
  const x = (d) => diffDays(t0, d) * pxd;
  // eixo: meses (e semanas se houver espaço)
  const marcas = [];
  for (let d = t0.slice(0, 8) + "01"; d <= t1; ) { if (d >= t0) marcas.push({ d, l: `${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`, m: true }); const [y, m] = d.split("-").map(Number); d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; }
  if (pxd >= 10) for (let d = t0; d <= t1; d = addDays(d, 1)) if (new Date(d + "T12:00:00Z").getUTCDay() === 1) marcas.push({ d, l: String(Number(d.slice(8))), m: false });
  const barra = ({ a, fila }, comNome) => {
    const r = S.res.get(a.id);
    const l = x(r.provIni), w = Math.max(pxd, x(addDays(r.provFim, 1)) - l);
    const txt = comNome ? `${a.unidade} ${nomeAtiv(a)}` : a.unidade;
    return `<button class="ge-b st-${r.estado}${r.atrasada ? " atr" : ""}${fila ? "" : " solto"}${r.ciclo ? " ciclo" : ""}" style="left:${l}px;width:${w}px" data-a="${a.id}" title="${esc(`${nomeAtiv(a)} em ${a.unidade} · ${fd(r.provIni)} a ${fd(r.provFim)} · ${ESTADO[r.estado]}${r.atrasada ? " · atrasada " + r.atraso + " d" : ""}${fila ? "" : " · ainda sem lugar na fila"}`)}"><span>${esc(w > 46 ? txt : "")}</span></button>`;
  };
  // todas: cada equipa numa faixa; trabalhos sobrepostos vão para sub-linhas
  const linhas = [];
  if (nome) {
    for (const it of grupos[0].itens) linhas.push({ rot: `<b>${esc(nomeAtiv(it.a))}</b><span class="mono">${esc(it.a.unidade)}${it.fila ? "" : " · sem lugar na fila"}</span>`, bars: [barra(it, false)], fila: it.fila });
  } else {
    for (const g of grupos) {
      const subs = [];
      for (const it of g.itens) {
        const r = S.res.get(it.a.id);
        let k = subs.findIndex((fim) => fim < r.provIni);
        if (k < 0) { subs.push(""); k = subs.length - 1; }
        subs[k] = r.provFim;
        (g.sub = g.sub || [])[k] = (g.sub[k] || []).concat(barra(it, false));
      }
      const parada = (() => { let p = 0; for (const it of g.itens.filter((z) => z.fila && S.res.get(z.a.id).estado !== "concluida")) { const r = S.res.get(it.a.id); if ((r.preds || []).some((d) => d.fonte === "grupo")) continue; const ant = (r.preds || []).filter((d) => d.fonte === "equipa").map((d) => S.res.get(d.id)).filter((x) => x && x.estado !== "concluida"); if (ant.length) p += Math.max(0, diffDays(ant.reduce((m, x) => (x.provFim > m ? x.provFim : m), ""), r.provIni) - 1); } return p; })();
      const fimG = g.itens.reduce((m, it) => (S.res.get(it.a.id).provFim > m ? S.res.get(it.a.id).provFim : m), "");
      g.sub.forEach((bs, k) => linhas.push({ rot: k === 0 ? `<button class="lnk-b" data-geq="${esc(g.n)}"><b>${esc(g.n)}</b></button><span class="note">${g.itens.length} trabalhos · acaba ${fd(fimG)}${parada ? ` · <span class="mau-t">${parada} d parada</span>` : ""}</span>` : "", bars: bs, cont: k > 0 }));
    }
  }
  return `<section class="card ge">
    <div class="card-h"><h2>${nome ? `Gantt da ${esc(nome)}` : "Todas as equipas"}</h2>
      <div class="seg-v sm">${[["semana", "Semanas"], ["mes", "Meses"], ["trimestre", "Trimestres"]].map(([k, l]) => `<button class="${(ep.zoom || "mes") === k ? "on" : ""}" data-gez="${k}">${l}</button>`).join("")}</div></div>
    <p class="note" style="margin:0">${nome ? "Um trabalho por linha, pela ordem da fila. Os que ainda não têm lugar na fila aparecem no fim, tracejados." : "Uma faixa por equipa. Os espaços entre barras são dias em que a equipa está parada; barras umas por cima das outras são trabalhos ao mesmo tempo. Toque no nome da equipa para ver só essa."} Toque numa barra para abrir o trabalho.</p>
    <div class="ge-wrap">
      <div class="ge-rot">${`<div class="ge-ax"></div>`}${linhas.map((l) => `<div class="ge-l ${l.cont ? "cont" : ""} ${l.fila === false ? "solto" : ""}">${l.rot}</div>`).join("")}</div>
      <div class="ge-scroll"><div class="ge-in" style="width:${W}px">
        <div class="ge-ax">${marcas.map((m) => `<i class="${m.m ? "m" : "s"}" style="left:${x(m.d)}px"><em>${m.l}</em></i>`).join("")}</div>
        ${marcas.filter((m) => m.m).map((m) => `<i class="ge-grid" style="left:${x(m.d)}px"></i>`).join("")}
        <i class="ge-hoje" style="left:${x(S.hoje)}px"></i>
        ${linhas.map((l) => `<div class="ge-l ${l.cont ? "cont" : ""}">${l.bars.join("")}</div>`).join("")}
      </div></div>
    </div>
    <div class="legend"><span><i class="dot st-em_curso"></i>Em curso</span><span><i class="dot st-por_iniciar"></i>Por iniciar</span><span><i class="dot st-bloqueada"></i>À espera de outras</span><span><i class="dot st-concluida"></i>Concluída</span><span><i class="dot st-por_iniciar atr"></i>Atrasada</span><span><i class="ge-lg-hoje"></i>Hoje</span></div>
  </section>`;
}
/** Criar ou editar uma equipa. nome = null para nova. opts.aoGravar(nome) corre depois de gravar. */
export function openEquipa(nome, opts = {}) {
  document.querySelectorAll('[data-dw="equipa"]').forEach((e) => e.remove());
  const orig = nome ? S.eqLista.find((e) => e.nome === nome) : null;
  const e0 = orig ? { ...orig, esp: [...(orig.esp || [])], blocos: [...(orig.blocos || [])] } : { nome: "", responsavel: "", telefone: "", esp: [], blocos: [], notas: "" };
  const zonas = ["A", "B", "C", "D", "Lojas", "Geral"].filter((k) => S.unidades.some((u) => (u.tipo === "Loja" ? "Lojas" : u.bloco) === k));
  const nTrab = orig ? statsEquipa(orig.nome).total : 0;
  const esp = espAp();
  const html = `
  <div class="scrim" data-dw="equipa"></div>
  <aside class="sheet" data-dw="equipa" role="dialog" aria-label="${orig ? "Editar equipa" : "Nova equipa"}">
    <div class="sheet-h"><div style="display:flex;flex-direction:column;gap:4px"><div class="eyebrow">Equipas de trabalho</div><h2>${orig ? esc(orig.nome) : "Nova equipa"}</h2></div><button class="x" aria-label="Fechar">×</button></div>
    <form class="sheet-b" id="eqf">
      <div class="formbox">
        <label class="f">Nome<input class="inp" id="eqN" required value="${esc(e0.nome)}" placeholder="Ex.: Equipa 4 - Mosaicos"></label>
        ${orig && nTrab ? `<p class="note" style="margin:0">Se mudar o nome, os ${nTrab} trabalhos desta equipa passam a ter o nome novo.</p>` : ""}
        <div class="grid2" style="gap:10px">
          <label class="f">Responsável<input class="inp" id="eqR" value="${esc(e0.responsavel || "")}" placeholder="Nome do encarregado"></label>
          <label class="f">Telefone<input class="inp" id="eqT" type="tel" value="${esc(e0.telefone || "")}"></label>
        </div>
        <label class="f">Frentes de trabalho<select class="inp" id="eqFr">${[1, 2, 3, 4, 5, 6, 8, 10].map((n) => `<option value="${n}" ${n === Math.max(1, Number(e0.frentes) || 1) ? "selected" : ""}>${n === 1 ? "1: um trabalho de cada vez" : n + ": " + n + " trabalhos ao mesmo tempo"}</option>`).join("")}</select></label>
        <p class="note" style="margin:0">Quantos trabalhos da fila a equipa faz ao mesmo tempo, por exemplo a pintura em 3 apartamentos. Cada trabalho começa quando acaba o que está esse número de lugares acima.</p>
      </div>
      <div class="formbox">
        <h3>O que esta equipa pode fazer <span class="note">(ajuda a planear)</span></h3>
        <p class="note" style="margin:0">Especialidades</p>
        <div class="chips" id="eqEsp">${esp.map((x) => `<button type="button" class="chip ${e0.esp.includes(x.key) ? "on" : ""}" data-eqe="${x.key}">${esc(x.nome)}</button>`).join("")}</div>
        <p class="note" style="margin:0">Onde trabalha <span class="muted">(nenhum escolhido: em toda a obra)</span></p>
        <div class="chips" id="eqZon">${zonas.map((k) => `<button type="button" class="chip ${e0.blocos.includes(k) ? "on" : ""}" data-eqz="${k}">${k.length === 1 ? "Bloco " + k : k}</button>`).join("")}</div>
        <div class="note" id="eqPot"></div>
        <label class="check" id="eqAutoW" hidden><input type="checkbox" id="eqAuto"><span id="eqAutoT"></span></label>
      </div>
      <label class="f">Notas<textarea class="inp" id="eqNo" rows="2" placeholder="Ex.: trabalha só no bloco C, de manhã">${esc(e0.notas || "")}</textarea></label>
      <div class="err" id="eqErr"></div>
      <div class="row"><button class="btn pri" type="submit">${orig ? "Guardar" : "Criar equipa"}</button><button class="btn" type="button" id="eqCancel">Cancelar</button></div>
      ${orig && orig.ativa !== false ? `<details class="formbox saibox" id="eqSai"><summary><b>A equipa sai da obra</b></summary>
        <p class="note">Desistência, fim de contrato ou troca de empreiteiro. A equipa deixa de aparecer para atribuir trabalho, mas fica no histórico com os trabalhos que já fez.</p>
        ${statsEquipa(orig.nome).fazer ? `<p style="margin:6px 0">Tem <b>${statsEquipa(orig.nome).fazer}</b> trabalhos por fazer${statsEquipa(orig.nome).curso ? `, ${statsEquipa(orig.nome).curso} já em curso` : ""}. O que lhes acontece?</p>
        <label class="check"><input type="radio" name="saiDest" value="dist" checked><span><b>Distribuir pelas equipas que fazem o mesmo</b><br><small class="note">Cada trabalho vai para a equipa com as mesmas especialidades que fica livre mais cedo. Os que nenhuma equipa faz ficam sem equipa.</small></span></label>
        ${S.equipas.filter((n) => n !== orig.nome).length ? `<label class="check"><input type="radio" name="saiDest" value="outra"><span><b>Passar todos para uma equipa</b></span></label>
        <select class="inp" id="saiSel" style="margin-left:24px;width:calc(100% - 24px)">${S.equipas.filter((n) => n !== orig.nome).map((n) => `<option>${esc(n)}</option>`).join("")}</select>` : ""}
        <label class="check"><input type="radio" name="saiDest" value="sem"><span><b>Ficam sem equipa</b>, para atribuir depois</span></label>
        ${statsEquipa(orig.nome).curso ? `<label class="check"><input type="checkbox" id="saiCurso"><span>Os que já estão em curso ficam com esta equipa até acabarem</span></label>` : ""}
        <p class="note">Os trabalhos que passam para outra equipa entram no fim da fila dela, pela data de início. As datas dos trabalhos seguintes acertam-se sozinhas.</p>
        <button class="btn" type="button" id="saiVer">Ver o efeito nas datas</button>
        <div id="saiRes"></div>` : `<p class="note">Não tem trabalhos por fazer.</p><button class="btn warn" type="button" id="saiOk">Confirmar a saída de ${esc(orig.nome)}</button>`}
        </details>` : ""}
      ${orig && orig.ativa === false ? `<div class="formbox"><p style="margin:0">Esta equipa saiu da obra${orig.saiuEm ? " a " + fd(orig.saiuEm, true) : ""}.</p><button class="btn" type="button" id="eqReat">Voltar a pôr a equipa na obra</button></div>` : ""}
      ${orig ? `<details class="formbox delbox" id="eqDel"><summary><b>Eliminar equipa de vez</b></summary>
        ${nTrab ? `<p class="note">Esta equipa tem ${nTrab} trabalhos. O que lhes acontece?</p>
        <label class="check"><input type="radio" name="eqDest" value="" checked><span>Ficam sem equipa</span></label>
        ${S.equipas.filter((n) => n !== orig.nome).length ? `<label class="check"><input type="radio" name="eqDest" value="_outra"><span>Passam para</span></label>
        <select class="inp" id="eqDestSel" style="margin-left:24px;width:calc(100% - 24px)">${S.equipas.filter((n) => n !== orig.nome).map((n) => `<option>${esc(n)}</option>`).join("")}</select>` : ""}` : `<p class="note">Não tem trabalhos atribuídos.</p>`}
        <button class="btn warn" type="button" id="eqDelOk">Eliminar ${esc(orig.nome)}</button></details>` : ""}
    </form>
  </aside>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const sh = document.querySelector('aside[data-dw="equipa"]');
  const q = (x) => sh.querySelector(x);
  const fechar = () => document.querySelectorAll('[data-dw="equipa"]').forEach((e) => e.remove());
  q(".x").onclick = fechar; q("#eqCancel").onclick = fechar;
  document.querySelector('.scrim[data-dw="equipa"]').onclick = fechar;
  const potenciais = () => Object.values(S.acts).filter((a) => podeFazer(e0, a) && S.res.get(a.id).estado !== "concluida");
  const semEqDe = () => potenciais().filter((a) => !a.equipa || !S.equipas.includes(a.equipa));
  const auto = () => {
    const pot = e0.esp.length ? potenciais() : [];
    const n = e0.esp.length ? semEqDe().length : 0;
    q("#eqPot").innerHTML = e0.esp.length ? `Pode fazer <b>${pot.length}</b> trabalhos por fazer${pot.length ? `: <b>${n}</b> sem equipa e ${pot.length - n} com outras equipas` : ""}.` : "";
    q("#eqAutoW").hidden = !n;
    q("#eqAutoT").textContent = `Atribuir já esta equipa aos ${n} trabalhos sem equipa e pô-los na fila dela, pela data de início`;
  };
  sh.querySelectorAll("[data-eqe]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.eqe;
    e0.esp = e0.esp.includes(k) ? e0.esp.filter((x) => x !== k) : [...e0.esp, k];
    b.classList.toggle("on"); auto();
  }));
  sh.querySelectorAll("[data-eqz]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.eqz;
    e0.blocos = e0.blocos.includes(k) ? e0.blocos.filter((x) => x !== k) : [...e0.blocos, k];
    b.classList.toggle("on"); auto();
  }));
  auto();
  setTimeout(() => q("#eqN").focus(), 50);
  const registadas = () => (S.cfg.equipas || []).filter((e) => e && e.nome);
  q("#eqf").onsubmit = async (ev) => {
    ev.preventDefault();
    const novo = q("#eqN").value.trim().replace(/\s+/g, " ");
    if (!novo) return;
    if (S.equipasTodas.some((n) => n.toLowerCase() === novo.toLowerCase() && (!orig || n !== orig.nome))) { q("#eqErr").textContent = "Já existe uma equipa com esse nome."; return; }
    const dados = { id: (orig && orig.id) || "eq" + Date.now().toString(36), nome: novo, responsavel: q("#eqR").value.trim() || null, telefone: q("#eqT").value.trim() || null, esp: e0.esp, blocos: e0.blocos, notas: q("#eqNo").value.trim() || null, frentes: Number(q("#eqFr").value) > 1 ? Number(q("#eqFr").value) : null, ...(orig && orig.ativa === false ? { ativa: false, saiuEm: orig.saiuEm || null } : {}) };
    const reg = registadas();
    const i = orig ? reg.findIndex((e) => e.nome === orig.nome) : -1;
    const lista = i >= 0 ? reg.map((e, j) => (j === i ? dados : e)) : [...reg, dados];
    const paraAuto = q("#eqAuto").checked && !q("#eqAutoW").hidden ? semEqDe().map((a) => a.id) : [];
    fechar();
    await store.setConfig({ equipas: lista }, { tipo: "equipa", texto: orig ? (orig.nome !== novo ? `Equipa ${orig.nome} passou a chamar-se ${novo}` : `Editou a equipa ${novo}`) : `Criou a equipa ${novo}` });
    if (orig && orig.nome !== novo) {
      const ids = Object.values(S.acts).filter((a) => a.equipa === orig.nome).map((a) => ({ id: a.id, patch: { equipa: novo } }));
      if (ids.length) await store.updateMuitas(ids, null);
    }
    if (paraAuto.length) await atribuirEquipa(paraAuto, novo);
    toast(orig ? "Equipa guardada" : `«${novo}» criada${paraAuto.length ? ` e atribuída a ${paraAuto.length} trabalhos` : ""}`);
    if (opts.aoGravar) await opts.aoGravar(novo);
  };
  // ---- saída da equipa
  const planoSaida = () => {
    const dest = (sh.querySelector('input[name="saiDest"]:checked') || {}).value || "sem";
    const ficaCurso = !!(q("#saiCurso") && q("#saiCurso").checked);
    const mover = Object.values(S.acts).filter((a) => a.equipa === orig.nome && S.res.get(a.id).estado !== "concluida" && !(ficaCurso && S.res.get(a.id).estado === "em_curso"))
      .sort((x, y) => (S.res.get(x.id).provIni || "").localeCompare(S.res.get(y.id).provIni || ""));
    const lista = [];
    const ordem = {}; // proxima posição livre em cada fila
    const livre = {}; // dia em que cada equipa fica livre (estimativa para distribuir)
    const fila = (n) => { if (ordem[n] == null) { const f = filaEquipa(n); ordem[n] = (f.length ? Math.floor(Number(f[f.length - 1].eqOrdem) / 10) * 10 : 0) + 10; livre[n] = f.reduce((m, a) => (S.res.get(a.id).provFim > m ? S.res.get(a.id).provFim : m), S.hoje); } };
    const vai = {};
    for (const a of mover) {
      let n = null;
      if (dest === "outra") n = q("#saiSel").value;
      else if (dest === "dist") {
        const cand = S.eqLista.filter((e) => e.ativa !== false && e.nome !== orig.nome && podeFazer(e, a));
        for (const e of cand) fila(e.nome);
        cand.sort((x, y) => livre[x.nome].localeCompare(livre[y.nome]));
        n = cand.length ? cand[0].nome : null;
      }
      if (n) { fila(n); lista.push({ id: a.id, patch: { equipa: n, eqOrdem: ordem[n] } }); ordem[n] += 10; const r = S.res.get(a.id); livre[n] = addDays(livre[n] > r.provIni ? livre[n] : r.provIni, r.dur + 1); vai[n] = (vai[n] || 0) + 1; }
      else { lista.push({ id: a.id, patch: { equipa: null, eqOrdem: null } }); vai["_sem"] = (vai["_sem"] || 0) + 1; }
    }
    // as que ficam (em curso) saem da fila, para não prenderem ninguém depois de a equipa sair
    if (ficaCurso) for (const a of Object.values(S.acts)) if (a.equipa === orig.nome && S.res.get(a.id).estado === "em_curso" && temOrdem(a)) lista.push({ id: a.id, patch: { eqOrdem: false } });
    const pm = new Map(lista.map((l) => [l.id, l.patch]));
    const novo = Object.values(S.acts).map((a) => (pm.has(a.id) ? { ...a, ...pm.get(a.id) } : a));
    const novoMap = new Map(novo.map((a) => [a.id, a]));
    const r2 = schedule(novo, S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor());
    let mudam = 0, fimObra = "";
    for (const a of novo) { const x = S.res.get(a.id), y = r2.get(a.id); if (x && y && (x.provIni !== y.provIni || x.provFim !== y.provFim)) mudam++; if (y && y.estado !== "concluida" && y.provFim > fimObra) fimObra = y.provFim; }
    const fimEq = (n, res) => Object.values(S.acts).filter((a) => novoMap.get(a.id).equipa === n && res.get(a.id).estado !== "concluida").reduce((m, a) => (res.get(a.id).provFim > m ? res.get(a.id).provFim : m), "");
    const porEq = Object.entries(vai).filter(([n]) => n !== "_sem").map(([n, k]) => ({ n, k, antes: Object.values(S.acts).filter((a) => a.equipa === n && S.res.get(a.id).estado !== "concluida").reduce((m, a) => (S.res.get(a.id).provFim > m ? S.res.get(a.id).provFim : m), ""), depois: fimEq(n, r2) }));
    return { lista, mudam, fimObra, porEq, sem: vai["_sem"] || 0, n: mover.length, ficam: ficaCurso ? statsEquipa(orig.nome).curso : 0 };
  };
  const saiConfirmar = async (pl) => {
    const reg = registadas();
    const i = reg.findIndex((e) => e.nome === orig.nome);
    const dados = { ...(i >= 0 ? reg[i] : { id: "eq" + Date.now().toString(36), nome: orig.nome, esp: orig.esp || [] }), ativa: false, saiuEm: S.hoje };
    const lista = i >= 0 ? reg.map((e, j) => (j === i ? dados : e)) : [...reg, dados];
    fechar();
    await store.setConfig({ equipas: lista }, { tipo: "equipa", texto: `${orig.nome} saiu da obra${pl && pl.n ? `; ${pl.n} trabalhos por fazer ${pl.porEq.length ? "passaram para " + pl.porEq.map((x) => `${x.n} (${x.k})`).join(", ") : ""}${pl.sem ? `${pl.porEq.length ? " e " : ""}${pl.sem} ficaram sem equipa` : ""}` : ""}` });
    if (pl && pl.lista.length) await store.updateMuitas(pl.lista, null);
    toast(`${orig.nome} saiu da obra${pl && pl.mudam ? `. ${pl.mudam} atividades mudaram de datas` : ""}`);
  };
  const sv = q("#saiVer");
  if (sv) {
    const limpa = () => { q("#saiRes").innerHTML = ""; };
    sh.querySelectorAll('input[name="saiDest"], #saiSel, #saiCurso').forEach((x) => (x.onchange = limpa));
    sv.onclick = () => {
      const pl = planoSaida();
      q("#saiRes").innerHTML = `<div class="sai-res">
        <p style="margin:0"><b>${pl.n}</b> trabalhos mudam de equipa${pl.ficam ? `; ${pl.ficam} em curso ficam com ${esc(orig.nome)} até acabarem` : ""}.</p>
        ${pl.porEq.length ? `<ul class="dlg-l">${pl.porEq.map((x) => `<li><b>${esc(x.n)}</b> recebe ${x.k}: ${x.antes ? `acabava a ${fd(x.antes, true)}, ` : ""}passa a acabar a <b>${fd(x.depois, true)}</b></li>`).join("")}</ul>` : ""}
        ${pl.sem ? `<div class="dlg-av">${pl.sem} ${pl.sem === 1 ? "fica" : "ficam"} sem equipa. Atribua-os depois no Plano das equipas ou em Trabalhos.${(sh.querySelector('input[name="saiDest"]:checked') || {}).value === "dist" ? " Para a aplicação os poder distribuir, diga na ficha de cada equipa que especialidades ela faz." : ""}</div>` : ""}
        <p style="margin:0">${pl.mudam} atividades mudam de datas. A obra passa a acabar a <b>${fd(pl.fimObra, true)}</b>${S.tot.fim && pl.fimObra !== S.tot.fim ? ` (era ${fd(S.tot.fim, true)})` : " (não muda)"}.</p>
        <button class="btn warn" type="button" id="saiOk2">Confirmar a saída de ${esc(orig.nome)}</button></div>`;
      q("#saiOk2").onclick = async () => { if (await confirmar(`${esc(orig.nome)} sai da obra?`, `<p>Os trabalhos por fazer mudam como mostrado. Se se enganar, pode voltar a pôr a equipa na obra, mas os trabalhos não voltam sozinhos para ela.</p>`, "Sim, confirmar a saída")) saiConfirmar(pl); };
    };
  }
  const so = q("#saiOk"); if (so) so.onclick = async () => { if (await confirmar(`${esc(orig.nome)} sai da obra?`, "<p>Deixa de aparecer para atribuir trabalho. Fica no histórico.</p>", "Sim, confirmar a saída")) saiConfirmar(null); };
  const rt = q("#eqReat"); if (rt) rt.onclick = async () => {
    const lista = registadas().map((e) => (e.nome === orig.nome ? { ...e, ativa: true, saiuEm: null } : e));
    fechar();
    await store.setConfig({ equipas: lista }, { tipo: "equipa", texto: `${orig.nome} voltou à obra` });
    toast(`${orig.nome} voltou à obra`);
  };
  const del = q("#eqDelOk");
  if (del) del.onclick = async () => {
    if (!(await confirmar(`Eliminar a equipa ${esc(orig.nome)}?`, `<p>A equipa deixa de existir.${nTrab ? ` Os ${nTrab} trabalhos dela ${sh.querySelector('input[name="eqDest"]:checked') && sh.querySelector('input[name="eqDest"]:checked').value === "_outra" ? "passam para a equipa escolhida" : "ficam sem equipa"}.` : ""}</p>`, "Sim, eliminar"))) return;
    const r = sh.querySelector('input[name="eqDest"]:checked');
    const dest = r && r.value === "_outra" ? q("#eqDestSel").value : null;
    const ids = Object.values(S.acts).filter((a) => a.equipa === orig.nome).map((a) => ({ id: a.id, patch: { equipa: dest, eqOrdem: null } }));
    fechar();
    await store.setConfig({ equipas: registadas().filter((e) => e.nome !== orig.nome) }, { tipo: "equipa", texto: `Eliminou a equipa ${orig.nome}${ids.length ? (dest ? `; os ${ids.length} trabalhos passaram para ${dest}` : `; ${ids.length} trabalhos ficaram sem equipa`) : ""}` });
    if (ids.length) await store.updateMuitas(ids, null);
    toast(`«${orig.nome}» eliminada`);
  };
}
