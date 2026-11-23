// Últimas alterações: as alterações com Anular desta sessão ficam numa lista, para as anular mesmo depois de o aviso desaparecer.
import { anularLote, esc, toast } from "./base.js";
import { nomeAtiv } from "./calculo.js";
import { S, store } from "./estado.js";
import { render } from "./nucleo.js";
import { perguntar } from "./plano.js";

const MAX = 15;
const lista = []; // mais recentes primeiro: { id, texto, em, lote, depois, anulada }
const quem = () => (store && store.user && (store.user.email || store.user.papel)) || "";
const minhas = () => lista.filter((e) => e.por === quem());
const copia = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

/** Valores que a alteração deixou gravados, para saber depois se alguém voltou a mexer. */
function fotografar(lote) {
  const d = store.data || {}, acts = d.atividades || {}, cfg = d.config || {};
  return lote.map((x) => {
    if (x.t === "upd") return { t: "a", id: x.id, v: Object.fromEntries(Object.keys(x.prev).map((k) => [k, copia((acts[x.id] || {})[k])])) };
    if (x.t === "many") return { t: "m", l: x.lista.map(({ id, patch }) => ({ id, v: Object.fromEntries(Object.keys(patch).map((k) => [k, copia((acts[id] || {})[k])])) })) };
    if (x.t === "add") return { t: "n", ids: x.ids.slice() };
    if (x.t === "cfg") return { t: "c", v: Object.fromEntries(Object.keys(x.prev).map((k) => [k, copia(cfg[k])])) };
    return null;
  }).filter(Boolean);
}
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Atividades (e configuração) que mudaram depois desta alteração. */
function mexidasDepois(e) {
  const d = store.data || {}, acts = d.atividades || {}, cfg = d.config || {};
  const ids = new Set(); let conf = false, apagadas = 0;
  for (const f of e.depois) {
    if (f.t === "a" && Object.entries(f.v).some(([k, v]) => !igual((acts[f.id] || {})[k], v))) ids.add(f.id);
    if (f.t === "m") for (const x of f.l) if (Object.entries(x.v).some(([k, v]) => !igual((acts[x.id] || {})[k], v))) ids.add(x.id);
    if (f.t === "n") apagadas += f.ids.filter((id) => !acts[id]).length;
    if (f.t === "c" && Object.entries(f.v).some(([k, v]) => !igual(cfg[k], v))) conf = true;
  }
  return { ids: [...ids], conf, apagadas };
}

/** Chamado pelo aviso (toast) sempre que uma alteração pode ser anulada. Devolve a entrada, para o Anular do aviso a marcar. */
export function registarUltima(texto, lote) {
  if (!lote || !lote.length) return null;
  const e = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), texto: String(texto || "Alteração"), em: new Date(), lote, depois: fotografar(lote), anulada: false, por: quem() };
  lista.unshift(e);
  if (lista.length > MAX) lista.length = MAX;
  atualizarBotoes();
  return e;
}
export const marcarAnulada = (e) => { if (e) { e.anulada = true; atualizarBotoes(); } };
export const nUltimas = () => minhas().filter((e) => !e.anulada).length;
export const limparUltimas = () => { lista.length = 0; atualizarBotoes(); };
/** Botões "Últimas alterações" na barra lateral e no topo do telemóvel. */
export function ultimasBtnHTML(topo) {
  const n = nUltimas();
  return topo
    ? `<button class="btn sm ghost ult-b" data-ultimas aria-label="Últimas alterações" title="Últimas alterações: anular o que fez" ${minhas().length ? "" : "hidden"}>${ICON_DESF}${n ? `<span class="ult-n num">${n}</span>` : ""}</button>`
    : `<button class="btn sm ult-b" data-ultimas title="Ver e anular as alterações que fez nesta sessão" ${minhas().length ? "" : "hidden"}>${ICON_DESF}<span>Últimas alterações</span>${n ? `<span class="ult-n num">${n}</span>` : ""}</button>`;
}
const ICON_DESF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
function atualizarBotoes() {
  document.querySelectorAll("[data-ultimas]").forEach((b) => {
    const topo = !b.querySelector("span:not(.ult-n)");
    const t = document.createElement("div"); t.innerHTML = ultimasBtnHTML(topo);
    const novo = t.firstElementChild; novo.onclick = abrirUltimas; b.replaceWith(novo);
  });
  const dlg = document.querySelector('.dlg.ult-dlg'); if (dlg) desenharLista(dlg);
}

const haQuanto = (d) => {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "agora mesmo";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  return `às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
function desenharLista(dlg) {
  const box = dlg.querySelector(".ult-l");
  const l = minhas();
  box.innerHTML = l.length ? l.map((e) => `<div class="ult-i ${e.anulada ? "anulada" : ""}">
      <div class="ult-t"><b>${esc(e.texto)}</b><small class="note">${haQuanto(e.em)}${e.anulada ? " · anulada" : ""}</small></div>
      ${e.anulada ? `<span class="pill">Anulada</span>` : `<button class="btn sm" data-ultan="${e.id}">Anular</button>`}
    </div>`).join("") : `<div class="empty">Ainda não fez nenhuma alteração nesta sessão.</div>`;
  box.querySelectorAll("[data-ultan]").forEach((b) => (b.onclick = () => anularEntrada(b.dataset.ultan)));
}
export function abrirUltimas() {
  document.querySelectorAll('[data-dw="ult"]').forEach((e) => e.remove());
  document.body.insertAdjacentHTML("beforeend", `<div class="scrim dlg-s" data-dw="ult"></div>
    <div class="dlg ult-dlg" data-dw="ult" role="dialog" aria-modal="true" aria-labelledby="ultT"><h2 id="ultT">Últimas alterações</h2>
      <p class="note">O que gravou nesta sessão, da mais recente para a mais antiga (até ${MAX}). Anular repõe como estava antes dessa alteração; as atividades seguintes acertam-se sozinhas. As fotografias e os pendentes não entram aqui.</p>
      <div class="ult-l"></div>
      <div class="dlg-b"><button class="btn pri" data-ultfecha>Fechar</button></div></div>`);
  const dlg = document.querySelector(".dlg.ult-dlg");
  const fechar = () => { document.querySelectorAll('[data-dw="ult"]').forEach((e) => e.remove()); document.removeEventListener("keydown", tecla); };
  const tecla = (e) => { if (e.key === "Escape" && !document.querySelector('[data-dw="dlg"]')) fechar(); };
  document.addEventListener("keydown", tecla);
  dlg.querySelector("[data-ultfecha]").onclick = fechar;
  document.querySelector('.dlg-s[data-dw="ult"]').onclick = fechar;
  desenharLista(dlg);
  dlg.querySelector("[data-ultfecha]").focus();
}
async function anularEntrada(id) {
  const e = lista.find((x) => x.id === id);
  if (!e || e.anulada) return;
  const m = mexidasDepois(e);
  if (m.ids.length || m.conf || m.apagadas) {
    const nomes = m.ids.map((i) => S.acts[i]).filter(Boolean);
    const k = await perguntar({
      titulo: "Isto voltou a mudar depois",
      texto: `<p>Depois de <b>${esc(e.texto)}</b> houve outras alterações ${m.ids.length ? `${m.ids.length === 1 ? "nesta atividade" : `nestas ${m.ids.length} atividades`}` : m.conf ? "nas definições" : ""} (suas ou de outra pessoa):</p>
        ${nomes.length ? `<ul class="dlg-l">${nomes.slice(0, 6).map((a) => `<li>${esc(nomeAtiv(a))} em ${esc(a.unidade)}</li>`).join("")}${nomes.length > 6 ? `<li class="note">e mais ${nomes.length - 6}</li>` : ""}</ul>` : ""}
        <p>Se anular, ${m.ids.length || m.conf ? "esses campos voltam ao que eram antes desta alteração e as mudanças feitas depois neles perdem-se" : "nada se perde"}.${m.apagadas ? ` ${m.apagadas === 1 ? "Uma das atividades criadas já foi apagada" : m.apagadas + " das atividades criadas já foram apagadas"}.` : ""}</p>
        <p class="note">Se quer desfazer só a mais recente, anule primeiro as que estão por cima na lista.</p>`,
      opcoes: [{ k: "sim", l: "Anular na mesma", estilo: "warn" }, { k: "nao", l: "Cancelar", estilo: "pri" }],
    });
    if (k !== "sim") return;
  }
  try {
    await anularLote(e.lote);
    e.anulada = true;
    atualizarBotoes();
    toast(`Anulada: ${e.texto}`, { anular: false });
    render();
  } catch (err) { toast("Não foi possível anular: " + (err && err.message ? err.message : err), { anular: false }); }
}
