// Grupos de especialidades (Carpintaria, Pintura, ...): para filtrar tudo o que tem a ver com um ofício.
// Ficam na configuração da obra (gruposEsp). Enquanto ninguém os mexe, vale a proposta feita a partir dos nomes.
import { $, can, esc, semAcento, toast } from "./base.js";
import { nomeAtiv } from "./calculo.js";
import { defTabs } from "./definicoes.js";
import { S, store } from "./estado.js";
import { render } from "./nucleo.js";
import { confirmar } from "./plano.js";

/** Chave de uma atividade para os grupos: a especialidade, ou o nome para as que não têm especialidade. */
export const itemDe = (a) => (a.esp && S.espIdx[a.esp] ? a.esp : "n:" + nomeAtiv(a));

/** Todos os trabalhos que se podem pôr num grupo: as especialidades e os trabalhos com nome próprio. */
export function itensGrupos() {
  const usadas = new Set(Object.values(S.acts).map(itemDe));
  const esp = [...(S.cfg.especialidades || [])].sort((a, b) => a.ordem - b.ordem).filter((e) => usadas.has(e.key) || !e.grupo).map((e) => ({ id: e.key, nome: e.nome }));
  const nomes = [...usadas].filter((k) => k.startsWith("n:")).map((k) => ({ id: k, nome: k.slice(2) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  return [...esp, ...nomes];
}

// proposta inicial: palavras no nome de cada trabalho
const PROPOSTA = [
  ["Eletricidade e telecomunicações", (t) => /eletric|cabelagem|aparelhagem|telecom|intercomunicador|iluminacao|wallbox/.test(t)],
  ["Ar condicionado", (t) => /a\/c|ar condicionado/.test(t)],
  ["Canalização e louças", (t) => /louca|torneira|canaliz|tanque|bomba de agua/.test(t)],
  ["Pintura", (t) => /pintura/.test(t)],
  ["Tetos falsos", (t) => /teto falso|tetos falsos/.test(t)],
  ["Mosaicos e azulejos", (t) => /mosaico|azulejo/.test(t)],
  ["Carpintaria", (t) => /carpintaria|roupeiro|piso flutuante/.test(t) || (/\bportas\b/.test(t) && !/caixilharia/.test(t))],
  ["Caixilharia", (t) => /caixilharia|guarda-corpo/.test(t)],
  ["Acabamentos", (t) => /acabamento/.test(t)],
  ["Impermeabilização", (t) => /impermeabiliz/.test(t)],
  ["Elevadores", (t) => /elevador/.test(t)],
  ["Estrutura", (t) => /estrutura/.test(t)],
  ["Exteriores", (t) => /exterior|paisagismo/.test(t)],
  ["Escadas", (t) => /escadas/.test(t)],
  ["Painéis solares", (t) => /solar/.test(t)],
];
export const idGrupo = (nome) => "g_" + semAcento(nome).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
export function propostaGrupos() {
  const itens = itensGrupos();
  return PROPOSTA.map(([nome, f]) => ({ id: idGrupo(nome), nome, itens: itens.filter((x) => f(semAcento(x.nome))).map((x) => x.id) })).filter((g) => g.itens.length);
}
/** É a proposta da aplicação (ainda ninguém mexeu)? */
export const gruposSaoProposta = () => !Array.isArray(S.cfg.gruposEsp);
/** Os grupos em uso: os guardados, ou a proposta. */
let cache = { cfg: null, acts: null, v: null };
export function gruposEsp() {
  if (cache.cfg === S.cfg && cache.acts === S.acts) return cache.v;
  const v = gruposSaoProposta() ? propostaGrupos() : S.cfg.gruposEsp.filter((g) => g && g.id && g.nome).map((g) => ({ ...g, itens: Array.isArray(g.itens) ? g.itens : [] }));
  cache = { cfg: S.cfg, acts: S.acts, v };
  return v;
}
/** Função que diz se uma atividade passa no filtro de grupo (sem grupo, ou grupo que já não existe: passa tudo). */
const filtros = new Map();
export function filtroGrupo(gid) {
  if (!gid) return () => true;
  const gs = gruposEsp();
  if (filtros.get(gid)?.gs === gs) return filtros.get(gid).f;
  const f = criaFiltro(gid);
  filtros.set(gid, { gs, f });
  return f;
}
function criaFiltro(gid) {
  const g = gruposEsp().find((x) => x.id === gid);
  if (!g) return () => true;
  const s = new Set(g.itens || []);
  return (a) => s.has(itemDe(a));
}
export const nomeGrupo = (gid) => ((gruposEsp().find((x) => x.id === gid) || {}).nome || "");
/** Caixa de escolha do grupo, para os filtros. */
export function grupoSelectHTML(id, val) {
  const gs = gruposEsp();
  if (!gs.length) return "";
  const existe = gs.some((g) => g.id === val);
  return `<label class="f">Grupo<select class="inp" id="${id}"><option value="">Todos os grupos</option>${gs.map((g) => `<option value="${esc(g.id)}" ${existe && g.id === val ? "selected" : ""}>${esc(g.nome)}</option>`).join("")}</select></label>`;
}

/* ============================================================ Definições: grupos */
export function gruposView() {
  const ed = can("executar");
  const gs = gruposEsp(), proposta = gruposSaoProposta();
  const itens = itensGrupos(), nomeDe = Object.fromEntries(itens.map((x) => [x.id, x.nome]));
  const emAlgum = new Set(gs.flatMap((g) => g.itens));
  const semGrupo = itens.filter((x) => !emAlgum.has(x.id));
  const conta = (g) => { const s = new Set(g.itens); return Object.values(S.acts).filter((a) => s.has(itemDe(a))).length; };
  const card = (g, i) => {
    const fora = itens.filter((x) => !g.itens.includes(x.id));
    const livres = fora.filter((x) => !emAlgum.has(x.id)), outros = fora.filter((x) => emAlgum.has(x.id));
    return `<section class="card gr-card" data-gr="${i}">
      <div class="gr-h">${ed ? `<input class="inp gr-nome" data-grnome="${i}" value="${esc(g.nome)}" aria-label="Nome do grupo" maxlength="40">` : `<h2>${esc(g.nome)}</h2>`}
        <span class="note num">${g.itens.length === 1 ? "1 especialidade" : g.itens.length + " especialidades"} · ${conta(g)} atividades</span>
        ${ed ? `<button class="btn sm ghost" data-grapaga="${i}" title="Apagar este grupo">Apagar</button>` : ""}</div>
      <div class="gr-itens">${g.itens.length ? g.itens.map((k) => `<span class="gr-it">${esc(nomeDe[k] || (k.startsWith("n:") ? k.slice(2) : k))}${ed ? `<button type="button" class="gr-x" data-grtira="${i}|${esc(k)}" aria-label="Tirar ${esc(nomeDe[k] || k)} do grupo" title="Tirar do grupo">×</button>` : ""}</span>`).join("") : `<span class="note">Ainda sem especialidades.</span>`}</div>
      ${ed && fora.length ? `<label class="f gr-add">Juntar<select class="inp" data-grjunta="${i}"><option value="">Escolha uma especialidade...</option>
        ${livres.length ? `<optgroup label="Sem grupo">${livres.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join("")}</optgroup>` : ""}
        ${outros.length ? `<optgroup label="Já noutro grupo">${outros.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join("")}</optgroup>` : ""}</select></label>` : ""}
    </section>`;
  };
  const html = `${defTabs("grupos")}
    <div class="card-h"><h1>Grupos de especialidades</h1>${ed ? `<div class="row">${proposta ? "" : `<button class="btn" id="grProp">Voltar à proposta</button>`}<button class="btn pri" id="grNovo">+ Novo grupo</button></div>` : ""}</div>
    <p class="note">Junte especialidades num grupo maior, como Carpintaria ou Pintura. Depois, nos Trabalhos, na Minha semana, no Gantt e no Ponto de situação, o filtro Grupo mostra tudo o que tem a ver com esse grupo, em todas as frações. Uma especialidade pode estar em mais do que um grupo.</p>
    ${proposta ? `<div class="banner"><span>Esta é a proposta da aplicação, feita a partir dos nomes das especialidades. Corrija o que quiser: a primeira alteração fica guardada para todos.</span>${ed ? `<button class="btn sm" id="grAceita">Guardar como está</button>` : ""}</div>` : ""}
    <div class="gr-lista">${gs.map(card).join("")}</div>
    ${semGrupo.length ? `<section class="card gr-sem"><div class="gr-h"><h2>Sem grupo</h2><span class="note num">${semGrupo.length}</span></div>
      <p class="note">Estas não entram em nenhum grupo. Não faz mal: aparecem sempre que o filtro Grupo está em Todos os grupos.</p>
      <div class="gr-itens">${semGrupo.map((x) => `<span class="gr-it">${esc(x.nome)}</span>`).join("")}</div></section>` : ""}`;
  return {
    html, bind: () => {
      if (!ed) return;
      const gravar = async (lista, texto) => { await store.setConfig({ gruposEsp: lista }, { tipo: "config", texto }); toast(texto); };
      const copia = () => gruposEsp().map((g) => ({ id: g.id, nome: g.nome, itens: [...g.itens] }));
      const ac = $("#grAceita"); if (ac) ac.onclick = () => gravar(copia(), "Grupos de especialidades guardados");
      const pr = $("#grProp"); if (pr) pr.onclick = async () => {
        if (!(await confirmar("Voltar à proposta?", "<p>Os grupos voltam a ser os que a aplicação propõe a partir dos nomes. As suas alterações perdem-se (pode anular logo a seguir).</p>", "Sim, voltar à proposta"))) return;
        await store.setConfig({ gruposEsp: null }, { tipo: "config", texto: "Grupos de especialidades: voltou à proposta da aplicação" });
        toast("Grupos: voltou à proposta da aplicação");
      };
      $("#grNovo").onclick = async () => {
        const l = copia(); let n = "Novo grupo", k = 2;
        while (l.some((g) => g.nome === n)) n = "Novo grupo " + k++;
        let id = idGrupo(n); while (l.some((g) => g.id === id)) id += "_";
        l.push({ id, nome: n, itens: [] });
        await gravar(l, `Grupo "${n}" criado`);
        const inp = document.querySelector(`[data-grnome="${l.length - 1}"]`);
        if (inp) { inp.scrollIntoView({ block: "center" }); inp.focus(); inp.select(); }
      };
      document.querySelectorAll("[data-grnome]").forEach((inp) => {
        const fim = async () => {
          const i = +inp.dataset.grnome, l = copia(), nome = inp.value.trim().replace(/\s+/g, " ");
          if (!l[i] || nome === l[i].nome) return;
          if (!nome) { inp.value = l[i].nome; toast("O grupo precisa de um nome.", { anular: false }); return; }
          if (l.some((g, j) => j !== i && semAcento(g.nome) === semAcento(nome))) { toast("Já existe um grupo com esse nome.", { anular: false }); inp.value = l[i].nome; return; }
          const antes = l[i].nome; l[i].nome = nome;
          await gravar(l, `Grupo "${antes}" passou a chamar-se "${nome}"`);
        };
        inp.onchange = fim;
        inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } if (e.key === "Escape") { inp.value = inp.defaultValue; inp.blur(); } };
      });
      document.querySelectorAll("[data-grapaga]").forEach((b) => (b.onclick = async () => {
        const i = +b.dataset.grapaga, l = copia(), g = l[i];
        if (g.itens.length && !(await confirmar(`Apagar o grupo ${esc(g.nome)}?`, `<p>As especialidades não são apagadas: só deixam de estar juntas neste grupo.</p>`, "Sim, apagar o grupo"))) return;
        l.splice(i, 1);
        await gravar(l, `Grupo "${g.nome}" apagado`);
      }));
      document.querySelectorAll("[data-grtira]").forEach((b) => (b.onclick = async () => {
        const [i, k] = [+b.dataset.grtira.split("|")[0], b.dataset.grtira.slice(b.dataset.grtira.indexOf("|") + 1)];
        const l = copia(); l[i].itens = l[i].itens.filter((x) => x !== k);
        await gravar(l, `${nomeDe[k] || k} saiu do grupo ${l[i].nome}`);
      }));
      document.querySelectorAll("[data-grjunta]").forEach((s) => (s.onchange = async () => {
        const i = +s.dataset.grjunta, k = s.value; if (!k) return;
        const l = copia(); if (!l[i].itens.includes(k)) l[i].itens.push(k);
        await gravar(l, `${nomeDe[k] || k} entrou no grupo ${l[i].nome}`);
      }));
    },
  };
}
