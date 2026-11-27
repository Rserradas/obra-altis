// Utilidades: datas, texto, ícones, filtros guardados, avisos (toast), permissões.
import { todayISO } from "../engine.js";
import { S, aAnular, filtrosDe, loteAnular, setAAnular, setFiltrosDe, setLoteAnular, setSnapDatas, snapDatas, store } from "./estado.js";
import { closeSheet } from "./ficha.js";
import { closeNova } from "./nova.js";
import { render } from "./nucleo.js";
import { perguntar } from "./plano.js";
import { marcarAnulada, registarUltima } from "./ultimas.js";

/* ============================================================ utilidades */
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const fd = (iso, ano) => {
  if (!iso) return "sem data";
  const [y, m, d] = iso.split("-");
  const showY = ano === true || (ano !== false && y !== todayISO().slice(0, 4));
  return `${+d} ${MESES[+m - 1]}${showY ? " " + y : ""}`;
};
export const fdt = (isoT) => { if (!isoT) return ""; const d = new Date(isoT); return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const deltaHTML = (n, txt) => {
  if (n == null) return "";
  const cls = n > 0 ? "mau" : n < 0 ? "bom" : "zero";
  const s = n > 0 ? `+${n} d` : n < 0 ? `${n} d` : "no prazo";
  const dica = txt || (n > 0 ? `Atraso de ${n} dias: a data real de fim, ou hoje se ainda não acabou, está ${n} dias depois da previsão de fim`
    : n < 0 ? `Acabou ${-n} dias antes da previsão de fim` : "Dentro da previsão de fim");
  return `<span class="delta ${cls}" title="${esc(dica)}">${s}</span>`;
};
export const ESTADO = { concluida: "Concluída", em_curso: "Em curso", bloqueada: "Bloqueada", por_iniciar: "Por iniciar" };
export const PAPEL = { dono: "Dono de obra", empreiteiro: "Empreiteiro", fiscal: "Fiscal", admin: "Administrador", sem_acesso: "Sem acesso" };
export const VISTAS = [["dono", "Dono de obra", "Ponto de situação, mapa dos apartamentos, sequência, equipas e acessos"], ["empreiteiro", "Empreiteiro", "A minha semana, trabalhos, iniciar e concluir, datas, equipas e sequência"], ["fiscal", "Fiscal", "Vistoria apartamento a apartamento, com percentagem, comentários e fotografias"]];
export function mudarVista(p) {
  if (ui.sheet) closeSheet();
  if (ui.nova) closeNova();
  document.querySelectorAll('[data-dw]').forEach((e) => e.remove());
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  ui.vistLista = null;
  store.setVista(p);
  if (p) toast(`A ver como ${PAPEL[p]}`);
}
export const vistaSelHTML = (id) => `<label class="vista-sel" title="Administrador: escolha como quer ver a aplicação"><span>Ver como</span><select class="inp" id="${id}">${VISTAS.map(([k, l]) => `<option value="${k}" ${store.user.papel === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
export const CURTO = { cabelagem: "Cabelagem", telecom: "Telecom", ac_tubagem: "AC tubagem", ac_esgotos: "AC esgotos", pint_barramento: "Barramento",
  teto_falso: "Teto falso", mosaicos: "Mosaicos", azul_wc: "Azulejo WC", azul_cozinha: "Azulejo coz.", pint_primario: "Primário",
  caix_portas: "Portas/estores", caix_guarda: "Guarda-corpos", caix_ac: "Arm. AC", carp_cozinha: "Carp. cozinha", carp_roupeiros: "Roupeiros",
  carp_wc: "Carp. WC", loucas: "Louças", loucas_div: "Torneiras", piso_flut: "Piso flut.", aparelhagem: "Aparelhagem", ac_aparelhos: "AC aparelhos",
  pint_final: "Pintura final", acab_teto: "Acab. teto", acab_piso: "Acab. piso", acab_mosaicos: "Acab. mosaicos" };
export const ICON = {
  mais: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  vistorias: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m8.5 12 2 2 4-4M8.5 17h7"/></svg>',
  semana: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m8.5 15 2.2 2.2 4.8-4.8"/></svg>',
  proximas: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 15h6M12 12l3 3-3 3"/></svg>',
  painel: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  unidades: '<svg viewBox="0 0 24 24"><path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-4h6v4M8 8h2M14 8h2M8 12h2M14 12h2"/></svg>',
  plano: '<svg viewBox="0 0 24 24"><path d="M3 6h8M3 12h12M3 18h6"/><rect x="13" y="4" width="8" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1"/><rect x="11" y="16" width="8" height="4" rx="1"/></svg>',
  regras: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  gantt: '<svg viewBox="0 0 24 24"><path d="M3 4v16h18"/><rect x="6" y="6" width="7" height="3" rx="1"/><rect x="10" y="11" width="8" height="3" rx="1"/><rect x="8" y="16" width="5" height="2.5" rx="1"/></svg>',
  previsao: '<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h12l-2.5 3.5L17 11H5"/><path d="M3 21h8"/></svg>',
  equipa: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/></svg>',
  galeria: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
  coment: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  lupa: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pendentes: '<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/></svg>',
  lapis: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  lig: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};

export const semAcento = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Procurar: várias palavras separadas por espaços, todas têm de aparecer (por qualquer ordem), sem ligar a acentos nem a maiúsculas.
 *  Nos códigos os hífens e pontos não contam: BF-203, BF203 e B-F203 encontram o mesmo. */
export const termosPesquisa = (q) => semAcento(String(q || "").trim()).split(/\s+/).filter(Boolean);
export const casaPesquisa = (texto, termos) => {
  if (!termos || !termos.length) return true;
  const t = semAcento(texto), tc = t.replace(/[-.\s]/g, "");
  return termos.every((w) => t.includes(w) || tc.includes(w.replace(/[-.]/g, "")));
};
export const EQF_PADRAO = () => ({ bloco: "", fr: "", esp: "", estado: "", q: "" });
export const eqfAtivo = (f) => !!(f && (f.bloco || f.fr || f.esp || f.estado || f.q));
export const PLANO_PADRAO = () => ({ f: "todas", bloco: "", tipo: "", unidade: "", ativ: "", grupo: "", equipa: "", q: "", soAtr: false, semConc: true, sort: null, editar: false, atribuir: false, atrEq: "", selec: null });
export const VERSAO = "24.11.2026 V2"; // dia da publicação e versão do dia; mudar também em versao.json e no CACHE de sw.js (na raiz)
export const ui = { bloco: "todos", plano: PLANO_PADRAO(), unidadeTab: "ativ", vistoria: {}, sheet: null };
/** Há algum filtro diferente do padrão? */
export function filtrosAlterados() {
  const p = ui.plano, d = PLANO_PADRAO(), g = ui.gantt;
  const planoMudou = ["bloco", "tipo", "unidade", "ativ", "grupo", "equipa", "q", "soAtr", "editar", "atribuir"].some((k) => !!p[k] !== !!d[k]) || p.semConc === false || !!p.sort || (p.f || "todas") !== "todas";
  if (ui.regSort || ui.regQ) return true;
  const ganttMudou = g && (g.bloco || g.unidade || g.ativ || (g.ativs && g.ativs.length) || g.grupo || g.estado || g.equipa || g.tipo || g.q || g.de || g.ate || g.abertas === false || g.ligacoes === false || g.zoom !== "semana" || (g.abertosB && g.abertosB.size) || (g.abertos && g.abertos.size) || g.sel);
  const vl = ui.vistLista, vistMudou = !!(vl && vl.por);
  const sm = ui.semana, semMudou = !!(sm && (sm.bloco || sm.equipa || sm.grupo || sm.ver || sm.fAndar || (sm.fUs && sm.fUs.length)));
  const px = ui.prox, proxMudou = !!(px && (px.bloco || px.equipa || px.grupo || px.ver));
  return !!(semMudou || proxMudou || planoMudou || ganttMudou || vistMudou || eqfAtivo(ui.eqF) || ui.soModelo || ui.bloco !== "todos" || ui.unitEdit || ui.uSemConc === false || !!ui.porVist || !!ui.comPend);
}
/* Os filtros de Trabalhos, A minha semana e Apartamentos ficam guardados neste dispositivo, por utilizador. */

export const chaveFiltros = () => "obra-filtros-" + ((store && store.user && (store.user.email || store.user.papel)) || "");
export function lerFiltros() {
  const k = chaveFiltros();
  if (filtrosDe === k) return;
  const trocou = filtrosDe !== null;
  setFiltrosDe(k);
  if (trocou) { ui.plano = PLANO_PADRAO(); ui.semana = null; ui.bloco = "todos"; ui.porVist = false; ui.comPend = false; ui.eqF = null; }
  try {
    const f = JSON.parse(localStorage.getItem(k) || "null");
    if (!f) return;
    if (f.plano) Object.assign(ui.plano, PLANO_PADRAO(), f.plano);
    if (f.semana) ui.semana = f.semana;
    if (f.bloco) ui.bloco = f.bloco;
    if (f.porVist) ui.porVist = true;
    if (f.comPend) ui.comPend = true;
    if (f.eqF) ui.eqF = { ...EQF_PADRAO(), ...f.eqF };
  } catch (e) {}
}
export function guardarFiltros() {
  if (filtrosDe !== chaveFiltros()) return;
  const { bloco, tipo, unidade, ativ, grupo, equipa, q, soAtr, semConc, sort, f } = ui.plano;
  try { localStorage.setItem(filtrosDe, JSON.stringify({ plano: { bloco, tipo, unidade, ativ, grupo, equipa, q, soAtr, semConc, sort, f }, semana: ui.semana || null, bloco: ui.bloco, porVist: !!ui.porVist, comPend: !!ui.comPend, eqF: eqfAtivo(ui.eqF) ? ui.eqF : null })); } catch (e) {}
}
/** Volta todos os ecrãs aos filtros com que a aplicação abre (as vistorias por guardar mantêm-se). */
export function reporFiltros() {
  ui.bloco = "todos";
  ui.plano = PLANO_PADRAO();
  ui.gantt = null;
  ui.unitEdit = false;
  ui.uSemConc = true;
  ui.porVist = false;
  ui.comPend = false;
  ui.regSort = null;
  ui.regQ = "";
  ui.eqF = null;
  ui.soModelo = false;
  ui.vistLista = null;
  if (ui.semana) ui.semana = { equipa: "", bloco: "", ver: "" };
  ui.semana = null; ui.semEsc = false; ui.semSel = null; ui.folhaUpick = false;
  ui.prox = null;
  ui.delUnit = null;
  ui.uDel = null;
  ui.lastUnit = null;
  ui.unidadeTab = store.user && store.user.papel === "fiscal" ? "vist" : store.user && store.user.papel === "empreiteiro" ? "sit" : "ativ";
  window.scrollTo(0, 0);
  render();
  toast("Filtros limpos");
}

/** Traduz um erro do Firebase ou do browser para português simples. */
export function erroSimples(err) {
  const c = String((err && (err.code || err.message)) || "");
  const M = [
    [/permission|insufficient/i, "não tem permissão para isto"],
    [/unavailable|network|offline|failed to fetch/i, "sem ligação à internet. Tente outra vez quando houver rede"],
    [/email-already-in-use/i, "esse email já tem conta"],
    [/invalid-email/i, "o email não está bem escrito"],
    [/weak-password/i, "a palavra-passe é curta demais: use pelo menos 6 caracteres"],
    [/not-found/i, "já não existe, pode ter sido apagado por outra pessoa"],
    [/quota|resource-exhausted/i, "o limite de utilização do servidor foi atingido por hoje"],
    [/deadline|timeout/i, "o servidor demorou demasiado a responder. Tente outra vez"],
  ];
  for (const [re, txt] of M) if (re.test(c)) return txt;
  return "aconteceu um erro inesperado" + (c ? ` (${c})` : "");
}
/** O servidor recusou uma gravação: o ecrã volta ao valor anterior. Explica porquê. */
export function avisoErroEscrita(er) {
  const sem = /permission/i.test(er.code + " " + er.msg);
  perguntar({
    titulo: "A alteração não foi gravada",
    texto: sem
      ? `<p>O servidor recusou a gravação por falta de permissão, por isso o ecrã voltou ao valor anterior.</p><p class="note">Conta: ${esc(er.email || "")} (${esc(er.papel || "sem perfil")}). Se acabou de mudar as regras do Firebase, confirme que publicou a versão mais recente. Se não, diga ao dono de obra.</p>`
      : `<p>Não foi possível gravar: ${esc(erroSimples({ code: er.code || er.msg }))}. O ecrã voltou ao valor anterior.</p><p class="note">Tente outra vez. Se continuar a acontecer, diga ao dono de obra e indique este código: ${esc(er.code || er.msg || "")}</p>`,
    opcoes: [{ k: "ok", l: "Percebi", estilo: "pri" }],
  });
}
/* ---- Anular: cada alteração guardada fica num "lote" que a mensagem seguinte pode desfazer */


export const fotoDatas = () => (S ? new Map([...S.res].map(([id, r]) => [id, (r.inicio || "") + "|" + (r.fim || "")])) : null);
export function instalarAnular(st) {
  const upd = st.updateAtividade.bind(st), add = st.addAtividades.bind(st), cfg = st.setConfig.bind(st), rem = st.removeAtividades.bind(st);
  const prevCfg = (patch) => { const c = st.data.config || {}; const o = {}; for (const k of Object.keys(patch || {})) o[k] = c[k] === undefined ? null : JSON.parse(JSON.stringify(c[k])); return o; };
  st.updateAtividade = async (id, patch, registo) => {
    if (!aAnular && !snapDatas) setSnapDatas(fotoDatas());
    if (!aAnular) {
      const a = st.data.atividades[id] || {};
      const prev = {};
      for (const k of Object.keys(patch || {})) prev[k] = a[k] === undefined ? null : JSON.parse(JSON.stringify(a[k]));
      if (Object.keys(prev).length) loteAnular.push({ t: "upd", id, prev });
    }
    return upd(id, patch, registo);
  };
  st.addAtividades = async (lista, cfgPatch, registo) => {
    if (!aAnular && !snapDatas) setSnapDatas(fotoDatas());
    if (!aAnular) { loteAnular.push({ t: "add", ids: lista.map((a) => a.id) }); if (cfgPatch) loteAnular.push({ t: "cfg", prev: prevCfg(cfgPatch) }); }
    const antes = aAnular; setAAnular(true); // o setConfig interno não entra no lote
    try { return await add(lista, cfgPatch, registo); } finally { setAAnular(antes); }
  };
  st.setConfig = async (patch, registo) => {
    if (!aAnular && !snapDatas) setSnapDatas(fotoDatas());
    if (!aAnular) loteAnular.push({ t: "cfg", prev: prevCfg(patch) });
    return cfg(patch, registo);
  };
  if (st.updateMuitas) {
    const muitas = st.updateMuitas.bind(st);
    st.updateMuitas = async (lista, registo) => {
    if (!aAnular && !snapDatas) setSnapDatas(fotoDatas());
      if (!aAnular) loteAnular.push({ t: "many", lista: lista.map(({ id, patch }) => {
        const a = st.data.atividades[id] || {}, prev = {};
        for (const k of Object.keys(patch || {})) prev[k] = a[k] === undefined ? null : JSON.parse(JSON.stringify(a[k]));
        return { id, patch: prev };
      }) });
      return muitas(lista, registo);
    };
  }
  st._removeOrig = rem;
}
export async function anularLote(lote) {
  setAAnular(true);
  try {
    let primeiro = true;
    for (const x of [...lote].reverse()) {
      const reg = primeiro ? { tipo: "anular", texto: "Anulou a última alteração" } : null;
      if (x.t === "upd") { await store.updateAtividade(x.id, x.prev, reg); primeiro = false; }
      else if (x.t === "add") { await store.removeAtividades(x.ids, reg); primeiro = false; }
      else if (x.t === "cfg") { await store.setConfig(x.prev, reg); primeiro = false; }
      else if (x.t === "many") { await store.updateMuitas(x.lista, reg); primeiro = false; }
    }
  } finally { setAAnular(false); }
}
export function toast(msg, opts = {}) {
  document.querySelectorAll(".toast").forEach((x) => x.remove());
  const lote = loteAnular; setLoteAnular([]);
  const snap = snapDatas; setSnapDatas(null);
  const podeAnular = opts.anular !== false && lote.length > 0;
  const entrada = podeAnular ? registarUltima(msg, lote) : null; // fica também em Últimas alterações
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.innerHTML = `<span>${esc(msg)}</span>${podeAnular ? `<button class="tb" data-t="anular">Anular</button>` : ""}${opts.acao ? `<button class="tb" data-t="acao">${esc(opts.acao.label)}</button>` : ""}`;
  document.body.appendChild(t);
  const tempo = setTimeout(() => t.remove(), podeAnular || opts.acao || String(msg).length > 90 ? 8000 : 2600);
  // depois de recalcular, diz quantas atividades mudaram de data (incluindo as seguintes)
  if (snap && podeAnular) {
    const conta = () => {
      if (!t.isConnected || !S) return;
      const ids = [...S.res].filter(([id, r]) => snap.has(id) && snap.get(id) !== (r.inicio || "") + "|" + (r.fim || "")).map(([id]) => id);
      const fr = new Set(ids.map((id) => S.acts[id] && S.acts[id].unidade).filter(Boolean));
      let el = t.querySelector(".toast-d");
      if (!ids.length) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement("small"); el.className = "toast-d"; t.querySelector("span").appendChild(el); }
      el.textContent = `No total, mudaram as datas de ${ids.length} atividade${ids.length === 1 ? "" : "s"}${fr.size > 1 ? ` em ${fr.size} frações` : fr.size === 1 ? ` em ${[...fr][0]}` : ""}.`;
    };
    setTimeout(conta, 250); setTimeout(conta, 1200);
  }
  t.onclick = async (e) => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    clearTimeout(tempo); t.remove();
    if (b.dataset.t === "anular") { await anularLote(lote); marcarAnulada(entrada); setLoteAnular([]); toast("Alteração anulada", { anular: false }); }
    else if (opts.acao) opts.acao.fn();
  };
}
export const can = (acao) => {
  const p = store.user && store.user.papel;
  if (p === "dono") return true;
  if (p === "empreiteiro") return ["executar", "dependencias", "foto", "criar"].includes(acao);
  if (p === "fiscal") return ["vistoria", "foto"].includes(acao);
  return false;
};
