// Próximas semanas: o que começa em cada uma das próximas semanas e o que ainda o pode impedir.
// Impedimentos: o que falta para um trabalho poder arrancar (material, frente, projeto, aprovação...).
// Ficam em atividade.restricoes = [{ id, tipo, texto, ate, quem, estado, lote?, criadoPor, criadoNome, criadoEm, resolvidoEm?, resolvidoNome? }].
// Um impedimento posto em vários trabalhos de uma vez partilha o mesmo "lote" e trata-se como um só.
import { addDays } from "../engine.js";
import { $, can, esc, fd, toast, ui } from "./base.js";
import { nomeAtiv } from "./calculo.js";
import { S, store } from "./estado.js";
import { openSheet } from "./ficha.js";
import { filtroGrupo, grupoSelectHTML } from "./grupos.js";
import { render } from "./nucleo.js";
import { pendAberto, pendDe } from "./pendentes.js";
import { perguntar } from "./plano.js";
import { bindCommon } from "./previsao.js";
import { pl } from "./segurar.js";

export const TIPOS_IMP = [["material", "Material"], ["frente", "Frente de trabalho"], ["projeto", "Projeto ou esclarecimento"], ["aprovacao", "Aprovação"], ["mao", "Mão de obra"], ["equip", "Equipamento"], ["outro", "Outro"]];
export const tipoImp = (k) => (TIPOS_IMP.find(([x]) => x === k) || [, "Outro"])[1];
export const impAbertos = (a) => (Array.isArray(a && a.restricoes) ? a.restricoes : []).filter((x) => x && x.estado !== "resolvido");
const ESTADOS = { pronta: "Pronta a arrancar", dep: "Depende de outras", imp: "Com impedimentos" };

/* ============================================================ semanas e prontidão */
const segundaDe = (iso) => addDays(iso, -((new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7));
/** As próximas n semanas, de segunda a domingo. Ao sábado e ao domingo a primeira é já a semana seguinte. */
export function semanasProx(n) {
  const h = S.hoje, seg = segundaDe(h), fimDeSemana = (new Date(h + "T12:00:00Z").getUTCDay() + 6) % 7 >= 5;
  const ini0 = fimDeSemana ? addDays(seg, 7) : seg;
  return Array.from({ length: n }, (_, i) => {
    const de = addDays(ini0, 7 * i), ate = addDays(de, 6);
    const nome = de === seg ? "Esta semana" : de === addDays(seg, 7) ? "Próxima semana" : "Semana de " + fd(de);
    return { i, de, ate, nome };
  });
}
/** O que falta para o trabalho poder arrancar.
 *  imp: impedimentos registados; falta: o que a aplicação vê sozinha (sem equipa, pendentes); deps: anteriores por acabar. */
export function prontidao(a, r) {
  const imp = impAbertos(a), falta = [];
  if (!a.equipa) falta.push({ k: "eq", l: "Sem equipa" });
  const np = pendDe(a.unidade, a.id).filter(pendAberto).length;
  if (np) falta.push({ k: "pend", l: pl(np, "pendente por resolver", "pendentes por resolver") });
  const deps = (r.bloqueadaPor || []).map((id) => ({ x: S.acts[id], xr: S.res.get(id) })).filter((d) => d.x && d.xr);
  const est = imp.length || falta.length ? "imp" : deps.length ? "dep" : "pronta";
  return { imp, falta, deps, risco: deps.some((d) => d.xr.atrasada), semData: !!r.semPlano, est };
}
/** Trabalhos por começar até ao fim da última semana (os atrasados para começar entram na primeira). */
export function trabalhosProx(nSem, filtro = () => true) {
  const sems = semanasProx(nSem), fim = sems[sems.length - 1].ate, lista = [];
  for (const a of Object.values(S.acts)) {
    const u = S.uMap[a.unidade];
    if (!u || u.teste || a.realInicio || !filtro(a, u)) continue;
    const r = S.res.get(a.id);
    if (!r || r.estado === "concluida" || r.estado === "em_curso" || !r.inicio || r.inicio > fim) continue;
    lista.push({ a, r, u, si: Math.max(0, sems.findIndex((s) => r.inicio <= s.ate)), ...prontidao(a, r) });
  }
  return { sems, lista };
}

/* ============================================================ ecrã */
export const PROX_PADRAO = () => ({ n: 4, por: "esp", ver: "", bloco: "", equipa: "", grupo: "", abertos: [] });
export function proximasView() {
  const w = (ui.prox = { ...PROX_PADRAO(), ...(ui.prox || {}) });
  const noGrupo = filtroGrupo(w.grupo);
  const filtro = (a, u) => (!w.bloco || u.bloco === w.bloco) && (w.equipa === "_sem" ? !a.equipa : !w.equipa || a.equipa === w.equipa) && noGrupo(a);
  const { sems, lista } = trabalhosProx(w.n, filtro);
  const podeEd = can("executar");
  const hoje = S.hoje;
  const conta = (l) => ({ n: l.length, pronta: l.filter((x) => x.est === "pronta").length, dep: l.filter((x) => x.est === "dep").length, imp: l.filter((x) => x.est === "imp").length });
  const porSem = sems.map((s) => lista.filter((x) => x.si === s.i));
  const abertos = new Set(w.abertos || []);
  const ordEsp = (a) => (a.esp && S.espIdx[a.esp] ? S.espIdx[a.esp].ordem : 9999);
  const grupoDe = (x) => w.por === "eq" ? [x.a.equipa || "~", x.a.equipa || "Sem equipa"]
    : w.por === "fr" ? [x.a.unidade, x.a.unidade]
    : [String(ordEsp(x.a)).padStart(5, "0") + nomeAtiv(x.a), nomeAtiv(x.a)];
  const resumo = (c, curto) => [c.pronta ? `<span class="pc ok">${c.pronta} ${curto ? "prontas" : c.pronta === 1 ? "pronta" : "prontas"}</span>` : "",
    c.dep ? `<span class="pc dep">${c.dep} ${c.dep === 1 ? "depende" : "dependem"} de outras</span>` : "",
    c.imp ? `<span class="pc imp">${c.imp} com impedimentos</span>` : ""].filter(Boolean).join("");

  const quando = (x) => {
    const r = x.r;
    if (r.inicio < hoje) return `<span class="note mau-t">devia ter começado a ${fd(r.inicio)}</span>`;
    return `<span class="note">${x.deps.length ? "pode começar" : "começa"} ${r.inicio === hoje ? "hoje" : fd(r.inicio)}</span>`;
  };
  const chipsDe = (x) => {
    const a = x.a, out = [];
    for (const m of x.imp) out.push(`<button class="pchip imp ${m.ate && m.ate < hoje ? "venc" : ""}" data-impv="${a.id}|${esc(m.id)}" title="${esc(tipoImp(m.tipo) + ": " + m.texto + (m.quem ? ". Quem resolve: " + m.quem : ""))}">${esc(tipoImp(m.tipo))}: ${esc(m.texto)}${m.ate ? ` · ${m.ate < hoje ? "prazo passou a" : "até"} ${fd(m.ate)}` : ""}</button>`);
    for (const f of x.falta) out.push(`<button class="pchip imp" data-a="${a.id}" title="Abrir a ficha para tratar">${esc(f.l)}</button>`);
    if (x.semData) out.push(`<button class="pchip av" data-conf="${a.id}" title="A data é a primeira possível, calculada pela aplicação. Toque para confirmar.">Data por confirmar</button>`);
    if (x.deps.length) {
      const d0 = x.deps[0], livre = x.deps.map((d) => d.xr.provFim).sort().pop();
      const nomeD = (d) => nomeAtiv(d.x) + (d.x.unidade !== a.unidade ? ` (${d.x.unidade})` : "");
      const tit = "Espera que acabem: " + x.deps.map((d) => `${nomeD(d)}, ${d.xr.estado === "em_curso" ? "acaba" : "prevista até"} ${fd(d.xr.provFim)}${d.xr.atrasada ? ", atrasada" : ""}`).join("; ");
      out.push(`<button class="pchip dep ${x.risco ? "risco" : ""}" data-a="${(x.deps.find((d) => d.xr.atrasada) || d0).x.id}" title="${esc(tit)}">${x.risco ? "Anterior atrasada, livre" : "Livre"} a ${fd(livre)} · espera por ${esc(nomeD(d0))}${x.deps.length > 1 ? ` e mais ${x.deps.length - 1}` : ""}</button>`);
    }
    if (x.est === "pronta") out.push(`<span class="pchip ok">Pronta a arrancar</span>`);
    return out.join("");
  };
  const linha = (x) => `<div class="prow est-${x.est}">
      <span class="mono su">${esc(x.a.unidade)}</span>
      <button class="lnk-b sn" data-a="${x.a.id}"><b>${esc(nomeAtiv(x.a))}</b>${x.a.equipa ? `<small>${esc(x.a.equipa)}</small>` : ""}</button>
      <div class="pq">${quando(x)}</div>
      <div class="pchips">${chipsDe(x)}</div>
      ${podeEd ? `<div class="sa"><button class="btn sm" data-imp="${x.a.id}" title="Registar o que falta para este trabalho poder arrancar">+ Impedimento</button></div>` : ""}
    </div>`;
  const MAXG = 80;
  const semana = (s) => {
    const l = porSem[s.i], c = conta(l);
    const vis = l.filter((x) => !w.ver || x.est === w.ver);
    const gs = new Map();
    for (const x of vis) { const [k, nome] = grupoDe(x); if (!gs.has(k)) gs.set(k, { k, nome, l: [] }); gs.get(k).l.push(x); }
    const grupos = [...gs.values()].sort((p, q) => p.k.localeCompare(q.k, "pt", { numeric: true }));
    const atras = s.i === 0 ? l.filter((x) => x.r.inicio < hoje).length : 0;
    return `<section class="card psem" id="psem-${s.i}">
      <div class="card-h"><h2>${esc(s.nome)} <span class="note">${fd(s.de)} a ${fd(s.ate)}</span></h2><span class="note num">${pl(c.n, "trabalho a começar", "trabalhos a começar")}${atras ? `, ${pl(atras, "já atrasado", "já atrasados")}` : ""}</span></div>
      ${c.n ? `<div class="pres">${resumo(c)}</div>` : ""}
      ${grupos.length ? grupos.map((g) => {
        const key = s.i + "|" + g.k, gc = conta(g.l);
        g.l.sort((p, q) => p.r.inicio.localeCompare(q.r.inicio) || p.a.unidade.localeCompare(q.a.unidade, "pt", { numeric: true }));
        return `<details class="pgrp" data-pg="${esc(key)}" ${abertos.has(key) ? "open" : ""}><summary><b>${esc(g.nome)}</b><span class="note num">${g.l.length}</span>${resumo(gc, true)}${podeEd && g.l.length > 1 ? `<button type="button" class="btn sm pg-imp" data-impg="${esc(key)}" title="O mesmo impedimento em todos estes trabalhos (por exemplo, material que ainda não chegou)">+ Impedimento a todos</button>` : ""}</summary>
          <div class="prows">${g.l.slice(0, MAXG).map(linha).join("")}</div>${g.l.length > MAXG ? `<p class="note">A mostrar ${MAXG} de ${g.l.length}. Escolha um bloco ou agrupe de outra maneira para ver menos.</p>` : ""}</details>`;
      }).join("") : `<div class="empty">${c.n ? "Nenhum trabalho desta semana com o que escolheu em Mostrar." : "Nenhum trabalho começa nesta semana" + (w.bloco || w.equipa || w.grupo ? " com estes filtros" : "") + "."}</div>`}
    </section>`;
  };

  // impedimentos em aberto (de toda a obra, com os mesmos filtros), juntos por lote
  const lotes = new Map();
  for (const a of Object.values(S.acts)) {
    const u = S.uMap[a.unidade];
    if (!u || u.teste || !filtro(a, u)) continue;
    const r = S.res.get(a.id);
    if (!r || r.estado === "concluida") continue;
    for (const m of impAbertos(a)) {
      const k = m.lote || a.id + "|" + m.id;
      if (!lotes.has(k)) lotes.set(k, { m, l: [] });
      lotes.get(k).l.push({ a, r, m });
    }
  }
  const impL = [...lotes.values()].map((g) => ({ ...g, ini: g.l.map((x) => x.r.inicio).sort()[0] }))
    .sort((p, q) => (p.m.ate || "9999").localeCompare(q.m.ate || "9999") || (p.ini || "").localeCompare(q.ini || ""));
  const impHTML = impL.length ? `<section class="card">
      <div class="card-h"><h2>Impedimentos em aberto <span class="note num">${impL.length}</span></h2><span class="note">Por ordem do prazo para resolver</span></div>
      <div class="ilist">${impL.map((g) => {
        const m = g.m, venc = m.ate && m.ate < hoje, tarde = m.ate && g.ini && m.ate > g.ini && !venc;
        const x0 = g.l[0];
        return `<div class="iitem ${venc ? "venc" : ""}">
          <div class="ii-t"><span class="pchip imp">${esc(tipoImp(m.tipo))}</span><b>${esc(m.texto)}</b></div>
          <div class="ii-d note">${m.ate ? `<span class="${venc ? "mau-t" : ""}">${venc ? "O prazo passou a" : "Resolver até"} ${fd(m.ate)}</span>` : "Sem prazo"}${m.quem ? ` · quem resolve: ${esc(m.quem)}` : ""}${g.ini ? ` · ${g.l.length > 1 ? "o primeiro trabalho" : "o trabalho"} ${g.ini < hoje ? "já devia ter começado a" : "começa"} ${fd(g.ini)}` : ""}${tarde ? ` <span class="mau-t">(depois do início)</span>` : ""}</div>
          <div class="ii-w note">${g.l.slice(0, 4).map((x) => `<button class="lnk" data-a="${x.a.id}">${esc(nomeAtiv(x.a))} <span class="mono">${esc(x.a.unidade)}</span></button>`).join(", ")}${g.l.length > 4 ? ` e mais ${g.l.length - 4}` : ""}</div>
          ${podeEd ? `<div class="ii-b"><button class="btn sm ok" data-impres="${x0.a.id}|${esc(m.id)}">Resolvido${g.l.length > 1 ? ` (${g.l.length})` : ""}</button><button class="btn sm" data-imped="${x0.a.id}|${esc(m.id)}">Editar</button></div>` : ""}
        </div>`;
      }).join("")}</div>
    </section>` : "";

  const tot = conta(lista);
  const VER = [["", "Tudo"], ["imp", "Com impedimentos"], ["dep", "Dependem de outras"], ["pronta", "Prontas a arrancar"]];
  const html = `
    <div class="card-h"><h1>Próximas semanas</h1><span class="note">De ${fd(sems[0].de)} a ${fd(sems[sems.length - 1].ate)}</span></div>
    <p class="note pintro">Os trabalhos que começam em cada semana e o que ainda os pode impedir. Um trabalho está pronto a arrancar quando as anteriores estão concluídas, tem equipa e não tem impedimentos por resolver. Registe os impedimentos com duas ou três semanas de antecedência, para haver tempo de os resolver.</p>
    <div class="kpis psem-k" style="--n:${sems.length}">${sems.map((s) => { const c = conta(porSem[s.i]); return `<button class="kpi" data-psem="${s.i}" title="Ir para esta semana"><b>${c.n}</b><span>${esc(s.nome)}</span><span class="pk-bar" aria-hidden="true">${c.n ? `<i class="ok" style="flex:${c.pronta}"></i><i class="dep" style="flex:${c.dep}"></i><i class="imp" style="flex:${c.imp}"></i>` : ""}</span><small class="note">${c.n ? `${c.pronta} ${c.pronta === 1 ? "pronta" : "prontas"}, ${c.imp} com impedimentos` : "nada a começar"}</small></button>`; }).join("")}</div>
    <div class="chips" role="group" aria-label="Mostrar">${VER.map(([k, l]) => `<button class="chip ${w.ver === k ? "on" : ""}" data-pver="${k}">${l}${k ? ` <span class="num" style="opacity:.65">${tot[k]}</span>` : ""}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${w.bloco === b ? "on" : ""}" data-pb="${b}">${b === "Geral" ? "Geral" : b ? "Bloco " + b : "Todos os blocos"}</button>`).join("")}</div>
    <div class="filters">
      <label class="f">Equipa<select class="inp" id="pEq"><option value="">Todas as equipas</option>${S.equipasTodas.map((e) => `<option ${w.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_sem" ${w.equipa === "_sem" ? "selected" : ""}>Sem equipa atribuída</option></select></label>
      ${grupoSelectHTML("pGr", w.grupo)}
      <label class="f">Agrupar por<select class="inp" id="pPor"><option value="esp" ${w.por === "esp" ? "selected" : ""}>Especialidade</option><option value="eq" ${w.por === "eq" ? "selected" : ""}>Equipa</option><option value="fr" ${w.por === "fr" ? "selected" : ""}>Fração</option></select></label>
      <label class="f">Semanas<select class="inp" id="pN">${[2, 3, 4, 6].map((n) => `<option value="${n}" ${w.n === n ? "selected" : ""}>${n} semanas</option>`).join("")}</select></label>
    </div>
    <div class="row no-print" style="gap:6px"><button class="btn sm" id="pAbrir">${abertos.size ? "Fechar tudo" : "Abrir tudo"}</button><button class="btn sm" id="pPrint">Imprimir ou guardar em PDF</button></div>
    ${impHTML}
    ${sems.map(semana).join("")}`;
  return {
    html, bind: () => {
      bindCommon();
      const view = $("#view");
      document.querySelectorAll("[data-pver]").forEach((b) => (b.onclick = () => { w.ver = b.dataset.pver; render(); }));
      document.querySelectorAll("[data-pb]").forEach((b) => (b.onclick = () => { w.bloco = b.dataset.pb; render(); }));
      $("#pEq").onchange = (e) => { w.equipa = e.target.value; render(); };
      const pg = $("#pGr"); if (pg) pg.onchange = (e) => { w.grupo = e.target.value; render(); };
      $("#pPor").onchange = (e) => { w.por = e.target.value; w.abertos = []; render(); };
      $("#pN").onchange = (e) => { w.n = +e.target.value; render(); };
      document.querySelectorAll("[data-psem]").forEach((b) => (b.onclick = () => { const el = $("#psem-" + b.dataset.psem); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }));
      $("#pAbrir").onclick = () => {
        w.abertos = abertos.size ? [] : [...view.querySelectorAll("[data-pg]")].map((d) => d.dataset.pg);
        render();
      };
      $("#pPrint").onclick = () => {
        const fechados = [...view.querySelectorAll("details.pgrp:not([open])")];
        fechados.forEach((d) => (d.open = true));
        try { window.print(); } catch (e) { toast("Este navegador não deixa imprimir daqui.", { anular: false }); }
        fechados.forEach((d) => (d.open = false));
      };
      view.querySelectorAll("details.pgrp").forEach((d) => d.addEventListener("toggle", () => {
        const s = new Set(w.abertos || []);
        if (d.open) s.add(d.dataset.pg); else s.delete(d.dataset.pg);
        w.abertos = [...s];
        const b = $("#pAbrir"); if (b) b.textContent = s.size ? "Fechar tudo" : "Abrir tudo";
      }));
      view.querySelectorAll("[data-impg]").forEach((b) => (b.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const det = b.closest("details");
        const ids = [...det.querySelectorAll(".prow [data-imp]")].map((x) => x.dataset.imp);
        impNovo(ids);
      }));
      bindImp(view);
    },
  };
}

/* ============================================================ impedimentos: criar, resolver, editar, apagar */
/** Liga os botões de impedimentos dentro de root (ecrã Próximas semanas, ficha da atividade). */
export function bindImp(root) {
  root.querySelectorAll("[data-imp]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); impNovo([b.dataset.imp]); }));
  root.querySelectorAll("[data-impv]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const [id, rid] = b.dataset.impv.split("|"); impGerir(id, rid); }));
  root.querySelectorAll("[data-imped]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const [id, rid] = b.dataset.imped.split("|"); impEditar(id, rid); }));
  root.querySelectorAll("[data-impres]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const [id, rid] = b.dataset.impres.split("|"); impMudar(id, rid, "resolver"); }));
  root.querySelectorAll("[data-conf]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); confirmarData(b.dataset.conf); }));
}
/** Caixa para escrever um impedimento. Devolve { tipo, texto, ate, quem } ou null. */
function dlgImp({ titulo, texto = "", v = {} }) {
  return new Promise((resolve) => {
    document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove());
    document.body.insertAdjacentHTML("beforeend", `<div class="scrim dlg-s" data-dw="dlg"></div>
      <div class="dlg" data-dw="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">${titulo}</h2><div class="dlg-t">${texto}
        <div class="imp-f">
          <label class="f">Tipo<select class="inp" id="iTipo">${TIPOS_IMP.map(([k, l]) => `<option value="${k}" ${(v.tipo || "material") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="f">O que falta<input class="inp" id="iTxt" value="${esc(v.texto || "")}" placeholder="Ex.: azulejo ainda não chegou, falta libertar a frente, falta pormenor da cozinha"></label>
          <div class="row" style="gap:10px;align-items:flex-end"><label class="f" style="flex:1 1 140px">Resolver até<input class="inp" type="date" id="iAte" value="${esc(v.ate || "")}"></label>
          <label class="f" style="flex:2 1 180px">Quem resolve<input class="inp" id="iQuem" value="${esc(v.quem || "")}" placeholder="Ex.: fornecedor, dono de obra, projetista"></label></div>
        </div></div>
      <div class="dlg-b"><button class="btn pri" data-dlg="sim">Guardar</button><button class="btn" data-dlg="nao">Cancelar</button></div></div>`);
    const txt = $("#iTxt"), bs = $('.dlg [data-dlg="sim"]');
    const atual = () => { bs.disabled = !txt.value.trim(); };
    txt.oninput = atual; atual();
    const fim = (ok) => {
      const out = ok ? { tipo: $("#iTipo").value, texto: txt.value.trim(), ate: $("#iAte").value || null, quem: $("#iQuem").value.trim() || null } : null;
      document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove()); document.removeEventListener("keydown", tecla);
      resolve(out);
    };
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); fim(false); } if (e.key === "Enter" && e.target === txt && txt.value.trim()) { e.preventDefault(); fim(true); } };
    document.addEventListener("keydown", tecla);
    document.querySelectorAll(".dlg [data-dlg]").forEach((b) => (b.onclick = () => fim(b.dataset.dlg === "sim")));
    $(".dlg-s").onclick = () => fim(false);
    txt.focus();
  });
}
const novoId = (i = 0) => "r" + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5);
const quemAgora = () => ({ em: new Date().toISOString(), por: store.user.email, nome: store.user.nome });
/** Novo impedimento num ou em vários trabalhos (no mesmo lote). */
export async function impNovo(ids) {
  ids = [...new Set(ids)].filter((id) => S.acts[id]);
  if (!ids.length || !can("executar")) return;
  const inis = ids.map((id) => (S.res.get(id) || {}).inicio).filter(Boolean).sort();
  const sug = inis[0] && addDays(inis[0], -1) > S.hoje ? addDays(inis[0], -1) : S.hoje;
  const a0 = S.acts[ids[0]];
  const onde = ids.length === 1 ? `<p>${esc(nomeAtiv(a0))} em <b>${esc(a0.unidade)}</b>${inis[0] ? `, previsto começar a ${fd(inis[0])}` : ""}.</p>`
    : `<p>Fica nos <b>${ids.length} trabalhos</b> deste grupo: ${ids.slice(0, 6).map((id) => esc(nomeAtiv(S.acts[id]) + " " + S.acts[id].unidade)).join(", ")}${ids.length > 6 ? " e mais " + (ids.length - 6) : ""}. Quando o resolver, resolve-se em todos.</p>`;
  const v = await dlgImp({ titulo: ids.length > 1 ? "Impedimento em vários trabalhos" : "Novo impedimento", texto: onde + `<p class="note">O que falta para poder arrancar. O prazo sugerido é a véspera do início.</p>`, v: { ate: sug } });
  if (!v) return;
  const q = quemAgora(), lote = ids.length > 1 ? "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : null;
  const base = { tipo: v.tipo, texto: v.texto, ate: v.ate, quem: v.quem, estado: "aberto", criadoPor: q.por, criadoNome: q.nome, criadoEm: q.em, ...(lote ? { lote } : {}) };
  const lista = ids.map((id, i) => ({ id, patch: { restricoes: [...(Array.isArray(S.acts[id].restricoes) ? S.acts[id].restricoes : []), { id: novoId(i), ...base }] } }));
  const desc = `${tipoImp(v.tipo).toLowerCase()}, "${v.texto}"${v.ate ? ", até " + fd(v.ate) : ""}`;
  if (lista.length === 1) await store.updateAtividade(lista[0].id, lista[0].patch, { tipo: "impedimento", texto: `${nomeAtiv(a0)} em ${a0.unidade}: novo impedimento (${desc})` });
  else await store.updateMuitas(lista, { tipo: "impedimento", texto: `Novo impedimento em ${lista.length} trabalhos (${desc})` });
  toast(lista.length === 1 ? "Impedimento registado" : `Impedimento registado em ${lista.length} trabalhos`);
}
/** Os trabalhos onde está este impedimento (o lote todo, ou só este trabalho). */
function alvos(id, rid, so1) {
  const a = S.acts[id]; if (!a) return { m: null, l: [] };
  const m = (a.restricoes || []).find((x) => x && x.id === rid); if (!m) return { m: null, l: [] };
  if (so1 || !m.lote) return { m, l: [{ a, casa: (x) => x.id === rid }] };
  const l = Object.values(S.acts).filter((x) => (x.restricoes || []).some((y) => y && y.lote === m.lote && y.estado !== "resolvido")).map((x) => ({ a: x, casa: (y) => y.lote === m.lote && y.estado !== "resolvido" }));
  return { m, l };
}
export async function impMudar(id, rid, acao, so1 = false, v = null) {
  const { m, l } = alvos(id, rid, so1);
  if (!m || !l.length) return;
  const q = quemAgora();
  const muda = (y) => acao === "resolver" ? { ...y, estado: "resolvido", resolvidoEm: q.em, resolvidoPor: q.por, resolvidoNome: q.nome }
    : acao === "editar" ? { ...y, tipo: v.tipo, texto: v.texto, ate: v.ate, quem: v.quem, editadoEm: q.em, editadoNome: q.nome } : y;
  const lista = l.map(({ a, casa }) => ({ id: a.id, patch: { restricoes: acao === "apagar" ? (a.restricoes || []).filter((y) => !(y && casa(y))) : (a.restricoes || []).map((y) => (y && casa(y) ? muda(y) : y)) } }));
  const verbo = { resolver: "resolvido", editar: "editado", apagar: "apagado" }[acao];
  const txt = `Impedimento ${verbo} (${tipoImp(m.tipo).toLowerCase()}, "${m.texto}")`;
  if (lista.length === 1) { const a = S.acts[lista[0].id]; await store.updateAtividade(lista[0].id, lista[0].patch, { tipo: "impedimento", texto: `${nomeAtiv(a)} em ${a.unidade}: ${txt.charAt(0).toLowerCase() + txt.slice(1)}` }); }
  else await store.updateMuitas(lista, { tipo: "impedimento", texto: `${txt} em ${lista.length} trabalhos` });
  toast(lista.length === 1 ? txt.split(" (")[0] : `${txt.split(" (")[0]} em ${lista.length} trabalhos`);
}
/** Ver um impedimento e escolher o que fazer. */
export async function impGerir(id, rid) {
  const { m, l } = alvos(id, rid, false);
  if (!m) return;
  const a = S.acts[id], n = l.length, pode = can("executar");
  const info = `<p><b>${esc(tipoImp(m.tipo))}:</b> ${esc(m.texto)}</p>
    <p class="note">${m.ate ? `${m.ate < S.hoje ? "O prazo passou a" : "Resolver até"} ${fd(m.ate)}. ` : "Sem prazo. "}${m.quem ? `Quem resolve: ${esc(m.quem)}. ` : ""}Registado por ${esc(m.criadoNome || m.criadoPor || "")}${m.criadoEm ? " a " + fd(m.criadoEm.slice(0, 10)) : ""}.</p>
    ${n > 1 ? `<p>Está em <b>${n} trabalhos</b>: ${l.slice(0, 6).map((x) => esc(nomeAtiv(x.a) + " " + x.a.unidade)).join(", ")}${n > 6 ? " e mais " + (n - 6) : ""}.</p>` : `<p>${esc(nomeAtiv(a))} em <b>${esc(a.unidade)}</b>.</p>`}`;
  if (!pode) { await perguntar({ titulo: "Impedimento", texto: info, opcoes: [{ k: "nao", l: "Fechar" }] }); return; }
  const k = await perguntar({ titulo: "Impedimento", texto: info, opcoes: [
    { k: "res", l: n > 1 ? `Está resolvido em todos (${n})` : "Está resolvido", estilo: "ok" },
    ...(n > 1 ? [{ k: "res1", l: `Resolvido só em ${esc(a.unidade)}` }] : []),
    { k: "ed", l: n > 1 ? "Editar (em todos)" : "Editar" },
    { k: "apg", l: n > 1 ? "Apagar (em todos)" : "Apagar" },
    { k: "nao", l: "Fechar" }] });
  if (k === "res") return impMudar(id, rid, "resolver");
  if (k === "res1") return impMudar(id, rid, "resolver", true);
  if (k === "ed") return impEditar(id, rid);
  if (k === "apg") {
    const c = await perguntar({ titulo: "Apagar este impedimento?", texto: `<p>"${esc(m.texto)}" desaparece${n > 1 ? ` dos ${n} trabalhos` : ""}. Use só para impedimentos registados por engano. Se já foi resolvido, marque como resolvido: fica no histórico.</p>`, opcoes: [{ k: "sim", l: "Sim, apagar", estilo: "warn" }, { k: "nao", l: "Cancelar" }] });
    if (c === "sim") return impMudar(id, rid, "apagar");
  }
}
export async function impEditar(id, rid) {
  const { m, l } = alvos(id, rid, false);
  if (!m || !can("executar")) return;
  const v = await dlgImp({ titulo: "Editar impedimento", texto: l.length > 1 ? `<p class="note">Muda nos ${l.length} trabalhos.</p>` : "", v: m });
  if (v) return impMudar(id, rid, "editar", false, v);
}
/** Confirma a data calculada pela aplicação (deixa de estar "por confirmar"). */
export async function confirmarData(id) {
  const a = S.acts[id], r = S.res.get(id); if (!a || !r) return;
  if (!can("executar")) { await perguntar({ titulo: "Data por confirmar", texto: `<p>${esc(nomeAtiv(a))} em ${esc(a.unidade)} nunca teve data: a aplicação pôs a primeira possível, ${fd(r.inicio)}. O empreiteiro ou o dono de obra confirmam-na.</p>`, opcoes: [{ k: "nao", l: "Fechar" }] }); return; }
  const k = await perguntar({ titulo: "Confirmar a data?", texto: `<p>${esc(nomeAtiv(a))} em <b>${esc(a.unidade)}</b> nunca teve data. A aplicação pôs a primeira possível: começa a <b>${fd(r.prevIni)}</b> e acaba a ${fd(r.prevFim)}.</p><p class="note">Se a data está certa, confirme. Para escolher outra, abra a ficha.</p>`,
    opcoes: [{ k: "sim", l: "Confirmar esta data", estilo: "pri" }, { k: "ficha", l: "Abrir a ficha para mudar" }, { k: "nao", l: "Cancelar" }] });
  if (k === "ficha") return openSheet(id);
  if (k !== "sim") return;
  await store.updateAtividade(id, { dataOk: true, inicioPrevisto: a.inicioPrevisto || a.planInicio ? a.inicioPrevisto || null : r.prevIni }, { tipo: "previsao", texto: `Confirmou as datas de ${nomeAtiv(a)} em ${a.unidade}` });
  toast("Data confirmada");
}

/* ============================================================ na ficha da atividade */
export function impFichaHTML(a, r) {
  const abertos = impAbertos(a), pode = can("executar");
  if (r.estado === "concluida" && !abertos.length) return "";
  if (!abertos.length && !pode) return "";
  return `<div class="imp-ficha"><div class="row" style="justify-content:space-between;gap:6px"><b>Impedimentos</b>${pode && r.estado !== "concluida" ? `<button class="btn sm" data-imp="${a.id}">+ Impedimento</button>` : ""}</div>
    ${abertos.length ? `<div class="pchips">${abertos.map((m) => `<button class="pchip imp ${m.ate && m.ate < S.hoje ? "venc" : ""}" data-impv="${a.id}|${esc(m.id)}">${esc(tipoImp(m.tipo))}: ${esc(m.texto)}${m.ate ? ` · ${m.ate < S.hoje ? "prazo passou a" : "até"} ${fd(m.ate)}` : ""}</button>`).join("")}</div>`
      : `<span class="note">Nada registado. Se falta alguma coisa para este trabalho poder arrancar (material, frente, projeto), registe aqui.</span>`}</div>`;
}
