// Definições: sequência, simulação, acessos e cópia de segurança.
import { addDays, schedule } from "../engine.js";
import { COPIA_COLECOES, COPIA_FORMATO } from "../store.js";
import { $, PAPEL, VERSAO, can, casaPesquisa, erroSimples, esc, fd, filtrosAlterados, semAcento, termosPesquisa, toast, ui } from "./base.js";
import { nomeAtiv, optsMotor } from "./calculo.js";
import { S, store } from "./estado.js";
import { openNova, slugKey } from "./nova.js";
import { render } from "./nucleo.js";
import { confirmar, perguntar } from "./plano.js";
import { bindCommon } from "./previsao.js";
import { hora } from "./vistorias.js";

/* ============================================================ definições: sequência + equipa */
export function defTabs(atual) {
  const t = [["regras", "Sequência e durações"]];
  if (can("executar")) t.push(["equipas", "Equipas de trabalho"], ["planequipa", "Plano das equipas"]);
  if (store.user.papel === "dono") t.push(["equipa", "Acessos"]);
  t.push(["copia", "Cópia de segurança"]); // todos fazem e repõem cópias
  return `<div class="eyebrow">Definições</div><div class="tabs">${t.map(([h, l]) => `<a href="#${h}" class="deftab ${atual === h ? "on" : ""}">${l}</a>`).join("")}</div>`;
}
/* ============================================================ simulação do tempo mínimo
   Só com a sequência e os dias por fração desta página: cada especialidade arranca num apartamento
   logo que as suas condições acabam nesse apartamento. Com equipas limitadas, cada equipa faz os
   apartamentos um a seguir ao outro. Não conta com o que já está feito nem com as outras ligações entre trabalhos. */
export function simular(esp, regras, dur, nAp, eq) {
  const keys = esp.map((e) => e.key), ks = new Set(keys);
  const pre = Object.fromEntries(keys.map((k) => [k, (regras[k] || []).filter((p) => ks.has(p) && p !== k)]));
  // ordem topológica
  const ordem = [], feito = new Set(), emCurso = new Set();
  let ciclo = false;
  const visita = (k) => { if (feito.has(k)) return; if (emCurso.has(k)) { ciclo = true; return; } emCurso.add(k); for (const p of pre[k]) visita(p); emCurso.delete(k); feito.add(k); ordem.push(k); };
  for (const k of keys) visita(k);
  const d = (k) => Math.max(0, Number(dur[k]) || 0);
  const n = Math.max(1, nAp);
  const ini = {}, fim = {}, porQuem = {};
  for (const k of ordem) {
    ini[k] = []; fim[k] = []; porQuem[k] = [];
    const livre = []; // fim da última fração de cada equipa
    for (let i = 0; i < n; i++) {
      let s = 0, q = null;
      for (const p of pre[k]) if (fim[p] && fim[p][i] > s) { s = fim[p][i]; q = { k: p, i }; }
      if (eq) { const t = i % eq; if ((livre[t] || 0) > s) { s = livre[t]; q = { k, i: i - eq }; } }
      ini[k][i] = s; fim[k][i] = s + d(k); porQuem[k][i] = q;
      if (eq) livre[i % eq] = fim[k][i];
    }
  }
  let total = 0, ult = null;
  for (const k of ordem) for (let i = 0; i < n; i++) if (fim[k][i] > total || (fim[k][i] === total && !ult)) { total = fim[k][i]; ult = { k, i }; }
  // caminho crítico: volta atrás pela condição que impôs cada arranque
  const critico = new Set();
  for (let c = ult; c && c.i >= 0; c = porQuem[c.k][c.i]) critico.add(c.k);
  const linhas = ordem.map((k) => ({ k, ini: Math.min(...ini[k]), fim: Math.max(...fim[k]), dur: d(k), um: [ini[k][0], fim[k][0]] }));
  return { linhas, total, critico, ciclo, n };
}
export function simGanttHTML(esp, regras, dur, nAp) {
  if (!esp.length) return "";
  const op = ui.simEq || "0", eq = Number(op);
  const r = simular(esp, regras, dur, nAp, eq);
  const so = ui.simOrd || "ini";
  const pos = Object.fromEntries(esp.map((e, i) => [e.key, i]));
  const nm = (k) => (S.espIdx[k] ? S.espIdx[k].nome : k);
  const crit = (l) => (r.critico.has(l.k) ? 0 : 1);
  const cmp = {
    ini: (a, b) => a.ini - b.ini || a.fim - b.fim,
    fim: (a, b) => a.fim - b.fim || a.ini - b.ini,
    dur: (a, b) => (b.fim - b.ini) - (a.fim - a.ini) || a.ini - b.ini,
    crit: (a, b) => crit(a) - crit(b) || a.ini - b.ini || a.fim - b.fim,
    nome: (a, b) => nm(a.k).localeCompare(nm(b.k), "pt", { sensitivity: "base", numeric: true }),
    lista: (a, b) => pos[a.k] - pos[b.k],
  }[so] || ((a, b) => a.ini - b.ini);
  r.linhas.sort(cmp);
  const ords = [["ini", "Início"], ["fim", "Fim"], ["dur", "Mais longas"], ["crit", "Críticas primeiro"], ["nome", "Nome"], ["lista", "Ordem da lista"]];
  const T = Math.max(1, r.total);
  const pc = (x) => ((x / T) * 100).toFixed(3) + "%";
  const passo = [7, 14, 28, 56, 91, 182].find((x) => T / x <= 6) || 365;
  const marcas = []; for (let x = passo; x < T; x += passo) marcas.push(x);
  const fimData = addDays(S.hoje, r.total);
  const semDias = esp.filter((e) => dur[e.key] == null || dur[e.key] === "").length;
  const nomeDe = (k) => (S.espIdx[k] ? S.espIdx[k].nome : k);
  const ops = [["0", "Sem limite"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]];
  return `<section class="sim">
    <div class="card-h"><h2>Simulação do tempo mínimo da obra</h2></div>
    <p style="max-width:75ch">Calculado só com a sequência e os dias por fração desta página, para ${r.n} apartamentos, como se a obra começasse hoje do zero. Cada especialidade arranca num apartamento logo que as condições acabam nesse apartamento.${eq ? ` Cada especialidade tem ${eq === 1 ? "uma equipa, que faz" : eq + " equipas, que fazem"} os apartamentos um a seguir ao outro.` : " Com equipas sem limite, todos os apartamentos andam ao mesmo tempo."} Não conta com o que já está feito nem com as outras ligações entre trabalhos.</p>
    <div class="sim-op"><span class="note">Equipas por especialidade</span><div class="sim-seg">${ops.map(([v, l]) => `<button class="${op === v ? "on" : ""}" data-simeq="${v}">${l}</button>`).join("")}</div></div>
    <div class="sim-op"><span class="note">Ordenar por</span><div class="sim-seg">${ords.map(([v, l]) => `<button class="${so === v ? "on" : ""}" data-simord="${v}">${l}</button>`).join("")}</div></div>
    ${r.ciclo ? `<div class="banner warn">Há condições em círculo (uma especialidade espera por outra que espera por ela). A simulação ignora esse círculo.</div>` : ""}
    <div class="sim-tot"><div><div class="eyebrow">Tempo mínimo</div><big class="num">${r.total} dias</big><span class="note"> cerca de ${Math.round(r.total / 7)} semanas</span></div><div><div class="eyebrow">Começando hoje, acabava a</div><big class="num">${fd(fimData, true)}</big></div></div>
    <div class="sim-g">
      <div class="sim-row sim-ax"><span></span><div class="sim-tr">${marcas.map((x, j) => `<i style="left:${pc(x)}"><em class="${j % 2 ? "imp" : ""}">${x} d</em></i>`).join("")}</div><span></span></div>
      ${r.linhas.map((l) => `<div class="sim-row ${r.critico.has(l.k) ? "crit" : ""}"><span class="sim-n" title="${esc(nomeDe(l.k))}">${esc(nomeDe(l.k))}</span><div class="sim-tr">${marcas.map((x) => `<i style="left:${pc(x)}"></i>`).join("")}<b style="left:${pc(l.ini)};width:${pc(Math.max(l.fim - l.ini, 0))}" title="${esc(nomeDe(l.k))}: dia ${l.ini} a ${l.fim}"></b>${eq ? `<s style="left:${pc(l.um[0])};width:${pc(l.um[1] - l.um[0])}"></s>` : ""}</div><span class="sim-d num">${l.ini} a ${l.fim}</span></div>`).join("")}
    </div>
    <p class="note"><span class="sim-lg crit"></span> Caminho crítico: se uma destas especialidades demorar mais, a obra acaba mais tarde.${eq ? ` <span class="sim-lg um"></span> Primeiro apartamento; a barra clara vai até ao último.` : ""}${semDias ? ` ${semDias} especialidades sem dias por fração contam como 0 dias.` : ""}</p>
  </section>`;
}
/* ============================================================ regras (sequência) */
/* Secções da Sequência. base: a ordem das especialidades de cada secção começa aí (as dos apartamentos vêm primeiro nos Trabalhos). */
export const SEQ_GRUPOS = [
  { k: "ap", l: "Apartamentos e lojas", base: 0 },
  { k: "zc", l: "Zonas comuns", tipo: "Zona comum", pref: "zc_", base: 1000, de: "das zonas comuns" },
  { k: "geral", l: "Geral", tipo: "Geral", pref: "g_", base: 2000, de: "gerais" },
];
/** Trabalhos das zonas comuns ou gerais que ainda não estão na lista da Sequência. */
export function trabFora(G) {
  const g = SEQ_GRUPOS.find((x) => x.k === G);
  return Object.values(S.acts).filter((a) => {
    const u = S.uMap[a.unidade];
    return u && !u.teste && u.tipo === g.tipo && !(a.esp && S.espIdx[a.esp]) && (a.seccao || "").trim();
  });
}
/**
 * Junta os trabalhos das zonas comuns (ou gerais) com o mesmo nome numa linha da Sequência.
 * As ligações do cronograma que todos esses trabalhos já têm entre si passam a regras da lista; as datas não mudam.
 */
export async function organizarSeq(G) {
  const g = SEQ_GRUPOS.find((x) => x.k === G);
  const fora = trabFora(G);
  if (!fora.length) return;
  const limpa = (t) => String(t || "").trim().replace(/\s+/g, " ");
  const chaveNome = (t) => semAcento(limpa(t)).toLowerCase();
  const doGrupo = (S.cfg.especialidades || []).filter((e) => e.grupo === G);
  const porNome = new Map(doGrupo.map((e) => [chaveNome(e.nome), e.key]));
  const usadas = new Set((S.cfg.especialidades || []).map((e) => e.key));
  const novas = [];
  // ordem das novas: pela data prevista mais cedo de cada uma
  const ini = (a) => (S.res.get(a.id) || {}).prevIni || "9999";
  const grupos = new Map();
  for (const a of fora) { const n = chaveNome(a.seccao); if (!grupos.has(n)) grupos.set(n, []); grupos.get(n).push(a); }
  const lista = [...grupos.entries()].sort((x, y) => x[1].map(ini).sort()[0].localeCompare(y[1].map(ini).sort()[0]));
  let ordem = Math.max(g.base, ...doGrupo.map((e) => e.ordem));
  const keyDe = new Map(); // id da atividade -> especialidade
  for (const a of Object.values(S.acts)) if (a.esp && S.espIdx[a.esp] && S.espIdx[a.esp].grupo === G) keyDe.set(a.id, a.esp);
  for (const [n, acts] of lista) {
    let k = porNome.get(n);
    if (!k) {
      const raiz = g.pref + slugKey(limpa(acts[0].seccao)).slice(2);
      k = raiz; let i = 2; while (usadas.has(k)) k = raiz + "_" + i++;
      usadas.add(k); porNome.set(n, k);
      novas.push({ key: k, nome: limpa(acts[0].seccao), ordem: ++ordem, grupo: G });
    }
    for (const a of acts) keyDe.set(a.id, k);
  }
  // regras: só as ligações (fim para início) que todos os trabalhos dessa linha já têm, na mesma zona
  const regras = { ...(S.cfg.regras || {}) };
  const novasK = new Set(novas.map((e) => e.key));
  const porUnidK = new Map(); // unidade|esp -> ids
  for (const [id, k] of keyDe) { const u = S.acts[id].unidade; const c = u + "|" + k; if (!porUnidK.has(c)) porUnidK.set(c, []); porUnidK.get(c).push(id); }
  for (const k of novasK) {
    const inst = [...keyDe].filter(([, x]) => x === k).map(([id]) => S.acts[id]);
    const cand = new Set();
    for (const a of inst) for (const d of a.deps || []) { const p = keyDe.get(d.id); if (p && p !== k && S.acts[d.id].unidade === a.unidade) cand.add(p); }
    const ok = [...cand].filter((p) => inst.every((a) => {
      const alvo = porUnidK.get(a.unidade + "|" + p) || [];
      if (!alvo.length) return true; // não há esse trabalho nesta zona: a regra não faz nada aqui
      const ign = new Set(a.depsIgnorar || []);
      return alvo.every((pid) => ign.has(pid) || (a.deps || []).some((d) => d.id === pid && (d.tipo || "FS") === "FS"));
    }));
    if (ok.length) regras[k] = [...new Set([...(regras[k] || []), ...ok])];
  }
  // confirma que as datas ficam iguais antes de gravar
  const antes = S.res;
  const novoActs = Object.values(S.acts).map((a) => (keyDe.has(a.id) && a.esp !== keyDe.get(a.id) ? { ...a, esp: keyDe.get(a.id) } : a));
  const depois = schedule(novoActs, regras, S.hoje, S.cfg.duracoes || {}, optsMotor());
  const mudou = novoActs.filter((a) => { const x = antes.get(a.id), y = depois.get(a.id); return x && y && (x.provIni !== y.provIni || x.provFim !== y.provFim); });
  if (mudou.length) { for (const k of novasK) delete regras[k]; Object.assign(regras, Object.fromEntries(Object.entries(S.cfg.regras || {}).filter(([k]) => novasK.has(k)))); }
  const patches = fora.map((a) => ({ id: a.id, patch: { esp: keyDe.get(a.id) } }));
  const n = fora.length, nl = novas.length;
  await store.setConfig({ especialidades: [...(S.cfg.especialidades || []), ...novas], regras }, { tipo: "regras", texto: `Sequência: ${n} trabalhos ${g.de} organizados${nl ? ` em ${nl} linhas` : ""}` });
  await store.updateMuitas(patches, null);
  toast(`${n} ${n === 1 ? "trabalho" : "trabalhos"} ${g.de} na lista. As datas não mudaram.`);
}
export function regrasView() {
  const dono = store.user.papel === "dono";
  const seq = dono || store.user.papel === "empreiteiro"; // dono e empreiteiro podem mudar tudo neste ecrã
  // secções: apartamentos e lojas, zonas comuns, geral (cada uma com a sua lista e as suas regras)
  const G = SEQ_GRUPOS.some((g) => g.k === ui.seqG) ? ui.seqG : "ap";
  const gInfo = SEQ_GRUPOS.find((g) => g.k === G);
  const grupoDe = (e) => e.grupo || "ap";
  const todas = [...(S.cfg.especialidades || [])].sort((a, b) => a.ordem - b.ordem);
  const esp = todas.filter((e) => grupoDe(e) === G);
  const foraSeq = G === "ap" ? [] : trabFora(G);
  const nG = (k) => todas.filter((e) => grupoDe(e) === k).length;
  const regras = S.cfg.regras || {}, dur = S.cfg.duracoes || {};
  // dias de cada trabalho quando não há valor na lista (o que cada atividade já tem)
  const diasHab = (k) => { const c = {}; for (const a of Object.values(S.acts)) if (a.esp === k) { const d = Number(a.duracao) || 0; c[d] = (c[d] || 0) + 1; } const t = Object.entries(c).sort((x, y) => y[1] - x[1])[0]; return t ? t[0] : ""; };
  // a lista segue sempre a sequência (calculada a partir das condições); clicar no título da coluna só muda a visualização
  const vs = ui.regSort || null;
  // seguintes: as especialidades que esperam por esta (o inverso de «Só começa depois de»)
  const seguintes = (k) => esp.filter((x) => (regras[x.key] || []).includes(k));
  const chave = { nome: (e) => e.nome, dias: (e) => Number(dur[e.key] ?? -1), cond: (e) => (regras[e.key] || []).length, seg: (e) => seguintes(e.key).length };
  const vista = vs ? [...esp].sort((a, b) => {
    const x = chave[vs.col](a), y = chave[vs.col](b);
    const c = typeof x === "string" ? x.localeCompare(y, "pt", { sensitivity: "base", numeric: true }) : x - y;
    return (vs.dir === "desc" ? -c : c) || a.ordem - b.ordem;
  }) : esp;
  const NOMES_COL = { nome: "ordem alfabética", dias: "dias por fração", cond: "número de condições", seg: "número de atividades que dependem desta" };
  const th = (col, l) => { const on = vs && vs.col === col; return `<button class="th-sort ${on ? "on" : ""}" data-rsort="${col}" title="Ordenar por ${l.toLowerCase()}">${l}<span class="arr">${on ? (vs.dir === "desc" ? "▼" : "▲") : "↕"}</span></button>`; };
  const nAp = S.unidades.filter((u) => u.tipo === "Apartamento").length;
  const nZc = S.unidades.filter((u) => u.tipo === "Zona comum").length;
  const colDias = G === "ap" ? "Dias por fração" : G === "zc" ? "Dias por bloco" : "Dias";
  const textoG = {
    ap: `Cada especialidade só pode arrancar num apartamento quando as especialidades da coluna «Só começa depois de» estiverem concluídas <b>nesse mesmo apartamento</b>. Uma regra aqui aplica-se de uma vez aos ${nAp} apartamentos. Se uma atividade se atrasar, todas as que dependem dela andam para a frente sozinhas.`,
    zc: `Cada trabalho só pode arrancar na zona comum de um bloco quando os trabalhos da coluna «Só começa depois de» estiverem concluídos <b>na zona comum desse mesmo bloco</b>. Uma regra aqui aplica-se de uma vez às ${nZc} zonas comuns. Se um trabalho se atrasar, os que dependem dele andam para a frente sozinhos.`,
    geral: `Trabalhos gerais da obra (estrutura, exteriores, garagens, instalações técnicas). Cada um só pode arrancar quando os trabalhos da coluna «Só começa depois de» estiverem concluídos. Se um trabalho se atrasar, os que dependem dele andam para a frente sozinhos.`,
  }[G];
  const html = `
    ${defTabs("regras")}
    <div class="card-h"><h1>Sequência dos trabalhos</h1>${seq && esp.length && G === "ap" ? `<div class="row"><button class="btn pri" data-nova="esp">+ Nova especialidade</button></div>` : ""}</div>
    <div class="seq-g" role="tablist" aria-label="Secção da sequência">${SEQ_GRUPOS.map((g) => `<button type="button" role="tab" class="${g.k === G ? "on" : ""}" aria-selected="${g.k === G}" data-seqg="${g.k}">${g.l} <span class="num">${nG(g.k)}</span></button>`).join("")}</div>
    <p>${textoG}</p>
    ${foraSeq.length ? (seq ? `<div class="banner warn"><span>${esp.length ? `<b>${foraSeq.length} ${foraSeq.length === 1 ? "trabalho" : "trabalhos"} ${gInfo.de} ainda fora desta lista.</b> Acrescente-os para poder dar-lhes sequência.` : `<b>Os ${foraSeq.length} trabalhos ${gInfo.de} ainda não estão organizados.</b> A aplicação junta os que têm o mesmo nome (por exemplo o mesmo trabalho nos 4 blocos) e mostra-os aqui, com as ligações que já vêm do cronograma. As datas não mudam.`}</span><button class="btn pri" id="seqOrg">${esp.length ? "Acrescentar" : "Organizar"}</button></div>` : `<div class="banner">Os trabalhos ${gInfo.de} ainda não foram organizados nesta lista. O dono de obra ou o empreiteiro podem fazê-lo.</div>`) : ""}
    ${seq ? "" : `<div class="banner">Só o dono de obra e o empreiteiro podem alterar esta sequência.</div>`}
    ${vs ? `<div class="banner"><span>A ver por <b>${NOMES_COL[vs.col]}</b>${vs.dir === "desc" ? " (decrescente)" : ""}.</span><button class="btn sm" id="rsVoltar">Voltar à ordem da sequência</button></div>` : ""}
    <div class="reg-q"><input class="inp" type="search" id="regQ" placeholder="${G === "ap" ? "Procurar especialidade" : "Procurar trabalho"}" aria-label="${G === "ap" ? "Procurar especialidade" : "Procurar trabalho"}" autocomplete="off" value="${esc(ui.regQ || "")}"><span class="note" id="regQn"></span></div>
    ${esp.length ? `<div class="rules">
      <div class="rule rule-h"><span>${th("nome", G === "ap" ? "Especialidade" : "Trabalho")}</span><span>${th("dias", colDias)}</span><span>${th("cond", "Só começa depois de")}</span><span>${th("seg", "Dependem desta")}</span></div>
      ${vista.map((e) => {
        const pre = regras[e.key] || [];
        // não deixa escolher uma especialidade que já espera (direta ou indiretamente) por esta: seria um círculo
        const espera = (k, alvo, vis = new Set()) => { if (vis.has(k)) return false; vis.add(k); return (regras[k] || []).some((q) => q === alvo || espera(q, alvo, vis)); };
        const disp = esp.filter((x) => x.key !== e.key && !pre.includes(x.key) && !espera(x.key, e.key)).sort((x, y) => x.nome.localeCompare(y.nome, "pt", { sensitivity: "base", numeric: true }));
        return `<div class="rule" data-rk="${e.key}" data-rq="${esc(semAcento([e.nome, ...pre.map((k) => (S.espIdx[k] ? S.espIdx[k].nome : k))].join(" ")))}" ><div class="rnome" data-rnome="${e.key}"><b>${esc(e.nome)}</b>${seq ? `<button class="ren-b" data-ren="${e.key}" title="Mudar o nome" aria-label="Mudar o nome de ${esc(e.nome)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14 8l3 3"/></svg></button>` : ""}</div>
          <input class="inp num" type="number" min="0" max="365" value="${dur[e.key] ?? ""}" ${G === "ap" ? "" : `placeholder="${diasHab(e.key)}" title="Vazio: cada trabalho fica com os dias que já tem"`} data-dur="${e.key}" ${seq ? "" : "disabled"} aria-label="${colDias} de ${esc(e.nome)}">
          <div class="tags">${pre.map((k) => `<span class="tag ${seq ? "" : "ro"}">${esc(S.espIdx[k] ? S.espIdx[k].nome : k)}${seq ? `<button data-rm="${e.key}|${k}" aria-label="Retirar">×</button>` : ""}</span>`).join("") || `<span class="note">Sem condições</span>`}
          ${seq ? `<select class="inp" data-add="${e.key}"><option value="">+ acrescentar</option>${disp.map((x) => `<option value="${x.key}">${esc(x.nome)}</option>`).join("")}</select>` : ""}</div>
          <div class="tags segs" title="Especialidades que só começam depois de esta estar concluída">${seguintes(e.key).sort((x, y) => x.ordem - y.ordem).map((x) => `<button type="button" class="tag seg" data-rgo="${x.key}" title="Ir para ${esc(x.nome)}">${esc(x.nome)}</button>`).join("") || `<span class="note">Nenhuma</span>`}</div></div>`;
      }).join("")}
    </div>
    <p class="note">${G === "ap" ? "As outras ligações entre trabalhos (por exemplo a sequência da Equipa 4 de apartamento em apartamento) continuam ativas além destas regras." : "As ligações que cada trabalho tem na sua ficha (com apartamentos ou com outras zonas) continuam ativas além destas regras."}</p>` : G === "ap" ? "" : foraSeq.length ? "" : `<div class="empty">Não há trabalhos ${gInfo.de}.</div>`}
    ${G === "ap" ? simGanttHTML(esp, regras, dur, nAp) : ""}`;
  return {
    html, bind: () => {
      document.querySelectorAll("[data-rsort]").forEach((b) => (b.onclick = () => {
        const col = b.dataset.rsort, d0 = col === "nome" ? "asc" : "desc";
        if (!vs || vs.col !== col) ui.regSort = { col, dir: d0 };
        else if (vs.dir === d0) ui.regSort = { col, dir: d0 === "asc" ? "desc" : "asc" };
        else ui.regSort = null; // terceiro clique: volta à ordem da lista
        render();
      }));
      const rv = $("#rsVoltar"); if (rv) rv.onclick = () => { ui.regSort = null; render(); };
      document.querySelectorAll("[data-rgo]").forEach((b) => (b.onclick = (ev) => {
        ev.stopPropagation();
        const r = document.querySelector(`.rule[data-rk="${b.dataset.rgo}"]`); if (!r) return;
        if (r.hidden) { const q = $("#regQ"); q.value = ""; q.dispatchEvent(new Event("input")); }
        r.scrollIntoView({ behavior: "smooth", block: "center" });
        r.classList.remove("piscar"); void r.offsetWidth; r.classList.add("piscar");
      }));
      document.querySelectorAll("[data-simeq]").forEach((b) => (b.onclick = () => { ui.simEq = b.dataset.simeq; render(); }));
      document.querySelectorAll("[data-seqg]").forEach((b) => (b.onclick = () => { ui.seqG = b.dataset.seqg; ui.regSort = null; render(); }));
      const so = $("#seqOrg"); if (so) so.onclick = () => organizarSeq(G);
      document.querySelectorAll("[data-simord]").forEach((b) => (b.onclick = () => { ui.simOrd = b.dataset.simord; render(); }));
      const rq = $("#regQ");
      const filtra = () => {
        if (!$("#regQn")) return;
        ui.regQ = rq.value;
        const t = termosPesquisa(rq.value);
        let n = 0;
        document.querySelectorAll(".rule[data-rq]").forEach((r) => { const ok = casaPesquisa(r.dataset.rq, t); r.hidden = !ok; if (ok) n++; });
        const fa = filtrosAlterados();
        document.querySelectorAll("aside [data-repor]").forEach((x) => x.classList.toggle("repor-on", fa));
        document.querySelectorAll("[data-repor-top]").forEach((x) => (x.hidden = !fa));
        $("#regQn").textContent = t.length ? (n ? `${n} de ${esp.length}` : "Nenhuma especialidade encontrada") : "";
      };
      rq.oninput = filtra; filtra();
      if (!seq) return;
      document.querySelectorAll("[data-nova]").forEach((b) => (b.onclick = () => openNova(b.dataset.nova)));
      const save = (patch, texto) => store.setConfig(patch, { tipo: "regras", texto }).then(() => toast("Sequência atualizada"));
      document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => {
        const [k, p] = b.dataset.rm.split("|");
        if (!(await confirmar("Retirar esta condição?", `<p><b>${esc(S.espIdx[k].nome)}</b> deixa de esperar por <b>${esc(S.espIdx[p].nome)}</b> em todas as frações.</p>`))) return;
        const r = { ...regras, [k]: (regras[k] || []).filter((x) => x !== p) };
        save({ regras: r }, `Sequência: ${S.espIdx[k].nome} deixou de esperar por ${S.espIdx[p].nome}`);
      }));
      document.querySelectorAll("[data-add]").forEach((s) => (s.onchange = () => {
        const k = s.dataset.add, p = s.value;
        if (!p) return;
        const r = { ...regras, [k]: [...(regras[k] || []), p] };
        // confirma que a regra nova não cria um círculo com as ligações que já existem nos apartamentos
        const r2 = schedule(Object.values(S.acts), r, S.hoje, S.cfg.duracoes || {}, optsMotor());
        const novos = [...r2.values()].filter((x) => x.ciclo && !S.res.get(x.id).ciclo);
        if (novos.length) {
          const a0 = S.acts[novos[0].id];
          s.value = "";
          perguntar({ titulo: "Esta regra cria um círculo", texto: `<p>Em ${novos.length} atividades, ${esc(S.espIdx[p].nome)} já espera (direta ou indiretamente) por ${esc(S.espIdx[k].nome)}. Por exemplo: ${esc(nomeAtiv(a0))} em ${esc(a0.unidade)}.</p><p class="note">Com esta regra, uma esperaria pela outra e a aplicação não conseguiria calcular as datas. A regra não foi gravada.</p>`, opcoes: [{ k: "ok", l: "Percebi", estilo: "pri" }] });
          return;
        }
        save({ regras: r }, `Sequência: ${S.espIdx[k].nome} passa a esperar por ${S.espIdx[p].nome}`);
      }));
      document.querySelectorAll("[data-ren]").forEach((bt) => (bt.onclick = () => {
        const k = bt.dataset.ren, e = S.espIdx[k], box = document.querySelector(`[data-rnome="${k}"]`);
        box.classList.add("ed");
        box.innerHTML = `<input class="inp" value="${esc(e.nome)}" maxlength="80" aria-label="Novo nome"><button class="btn sm pri" data-rok>Guardar</button><button class="btn sm ghost" data-rno>Cancelar</button>`;
        const inp = box.querySelector("input");
        inp.focus(); inp.select();
        const grava = async () => {
          const nome = inp.value.trim().replace(/\s+/g, " ");
          if (!nome || nome === e.nome) return render();
          if (S.cfg.especialidades.some((x) => x.key !== k && x.nome.toLowerCase() === nome.toLowerCase())) { toast("Já existe uma especialidade com esse nome."); inp.focus(); return; }
          const lista = S.cfg.especialidades.map((x) => (x.key === k ? { ...x, nome, editado: true } : x));
          await store.setConfig({ especialidades: lista }, { tipo: "regras", texto: `Especialidade "${e.nome}" passou a chamar-se "${nome}"` });
          toast(`Passou a chamar-se ${nome}`);
        };
        box.querySelector("[data-rok]").onclick = grava;
        box.querySelector("[data-rno]").onclick = () => render();
        inp.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); grava(); } else if (ev.key === "Escape") render(); };
      }));
      document.querySelectorAll("[data-dur]").forEach((i) => (i.onchange = () => {
        const k = i.dataset.dur, v = i.value === "" ? null : Math.max(0, Number(i.value));
        save({ duracoes: { ...dur, [k]: v } }, v == null ? `Duração de ${S.espIdx[k].nome}: cada trabalho fica com os dias que já tinha` : `Duração de ${S.espIdx[k].nome}: ${v} ${G === "ap" ? "dias por fração" : G === "zc" ? "dias por bloco" : "dias"}`);
      }));
    },
  };
}

/* ============================================================ equipa */
export function equipaView() {
  const demo = store.modo === "demo";
  const html = `
    ${defTabs("equipa")}
    <h1>Acessos</h1>
    <p>Cada pessoa entra com o seu email e palavra-passe. O perfil define o que pode fazer: o <b>empreiteiro</b> inicia, conclui e reporta atrasos; o <b>fiscal</b> regista vistorias e fotografias; o <b>dono de obra</b> vê tudo e define a sequência; o <b>administrador</b> tem os mesmos direitos do dono de obra e escolhe como quer ver a aplicação (como dono, empreiteiro ou fiscal), para confirmar o que cada um vê.</p>
    <section class="card"><h2>Pessoas com acesso</h2><div class="list" id="ulist"><div class="note">A carregar...</div></div></section>
    <section class="card"><h2>Adicionar pessoa</h2>
      ${demo ? `<div class="banner warn">Na demonstração não se criam contas reais. Na versão instalada, isto cria a conta e o perfil de uma vez.</div>` : ""}
      <form id="uf" class="grid2" style="gap:12px">
        <label class="f">Nome<input class="inp" id="un" required></label>
        <label class="f">Email<input class="inp" id="ue" type="email" required></label>
        <label class="f">Palavra-passe inicial<input class="inp" id="us" type="text" minlength="6" placeholder="mínimo 6 caracteres" ${demo ? "" : "required"}></label>
        <label class="f">Perfil<select class="inp" id="up"><option value="empreiteiro">Empreiteiro</option><option value="fiscal">Fiscal</option><option value="dono">Dono de obra</option><option value="admin">Administrador (vê como qualquer perfil)</option></select></label>
        <div class="row"><button class="btn pri" type="submit">Adicionar</button><span class="note" id="ust"></span></div>
      </form>
    </section>
    ${demo ? `<section class="card"><h2>Demonstração</h2><p class="note">Para ver a aplicação com outro perfil, saia e escolha outro. Pode também apagar as alterações feitas neste dispositivo.</p><div class="row"><button class="btn" id="dreset">Repor dados originais</button></div></section>` : ""}`;
  return {
    html, bind: async () => {
      const el = $("#ulist");
      const draw = async () => {
        const us = await store.listUsers();
        el.innerHTML = us.length ? us.map((u) => `<div class="li"><span class="li-t">${esc(u.nome)}</span><span class="role">${PAPEL[u.papel] || u.papel}</span><span class="li-s mono">${esc(u.email)}</span></div>`).join("") : `<div class="empty">Ainda ninguém. Adicione o empreiteiro e o fiscal.</div>`;
      };
      draw().catch(() => (el.innerHTML = `<div class="err">Não foi possível carregar.</div>`));
      $("#uf").onsubmit = async (e) => {
        e.preventDefault();
        $("#ust").textContent = "A criar...";
        try {
          await store.addUser({ nome: $("#un").value.trim(), email: $("#ue").value.trim(), senha: $("#us").value, papel: $("#up").value });
          $("#ust").textContent = "Adicionado. Envie-lhe o endereço da aplicação, o email e a palavra-passe.";
          e.target.reset(); draw();
        } catch (err) { $("#ust").textContent = "Não foi possível: " + erroSimples(err) + "."; }
      };
      const dr = $("#dreset");
      if (dr) dr.onclick = () => { store.reset(); toast("Dados de demonstração repostos"); };
    },
  };
}

/* ============================================================ cópia de segurança
   Todos os papéis. Descarrega um ficheiro com tudo o que está registado (trabalhos, datas, pendentes,
   histórico, fotografias, notas, equipas, sequência e acessos) e pode repor tudo a partir desse ficheiro. */
export const COPIA_NOMES = { config: "definições da obra", atividades: "atividades", pendentes: "pendentes", registos: "registos do histórico", fotos: "fotografias", utilizadores: "acessos" };
export const COPIA_ULT = "obra-ultima-copia";
export function copiaConta(C) { return Object.fromEntries(COPIA_COLECOES.map((c) => [c, Object.keys((C && C[c]) || {}).length])); }
export function copiaResumoHTML(n) {
  return `<ul class="copia-n">${["atividades", "pendentes", "registos", "fotos", "utilizadores"].map((c) => `<li><b class="num">${n[c] || 0}</b> ${COPIA_NOMES[c]}</li>`).join("")}</ul>`;
}
export const nomeFicheiroCopia = (quando) => { const d = new Date(quando); const p2 = (x) => String(x).padStart(2, "0"); return `obra-${(S.cfg.nome || "altis").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-copia-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`; };
/** Lê tudo e descarrega o ficheiro. Devolve o número de documentos de cada tipo, ou null se falhar. */
export async function descarregarCopia(estado) {
  const marca = (t) => { if (estado) estado.textContent = t; };
  try {
    marca("A ler os dados...");
    const C = await store.exportar((i, n, c) => marca(`A ler ${COPIA_NOMES[c] || c} (${i + 1} de ${n})...`));
    const quando = new Date().toISOString();
    const copia = { formato: COPIA_FORMATO, versao: 1, app: VERSAO, criadoEm: quando, por: store.user.email, nomePor: store.user.nome, obra: S.cfg.nome || "", modo: store.modo, colecoes: C };
    const blob = new Blob([JSON.stringify(copia)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomeFicheiroCopia(quando);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    try { localStorage.setItem(COPIA_ULT + "-" + store.modo, JSON.stringify({ em: quando, ficheiro: a.download, mb: +(blob.size / 1048576).toFixed(1) })); } catch (e) {}
    marca("");
    return copiaConta(C);
  } catch (e) {
    marca("");
    toast("Não foi possível fazer a cópia: " + erroSimples(e) + ".", { anular: false });
    return null;
  }
}
export function copiaView() {
  const st = (ui.copia = ui.copia || { lida: null, nomeF: "", erro: "" });
  let ult = null; try { ult = JSON.parse(localStorage.getItem(COPIA_ULT + "-" + store.modo) || "null"); } catch (e) {}
  const dias = ult ? Math.floor((Date.now() - new Date(ult.em).getTime()) / 86400000) : null;
  const L = st.lida;
  const html = `
    ${defTabs("copia")}
    <h1>Cópia de segurança</h1>
    <p>A cópia é um ficheiro com tudo o que está registado${store.modo === "demo" ? " (nesta demonstração, os dados deste dispositivo)" : " online"}: atividades e datas, percentagens, notas da fiscalização, pendentes, histórico, fotografias, equipas, sequência e acessos. Guarde-a no computador ou numa pasta partilhada da empresa. Não inclui as palavras-passe.</p>
    <section class="card"><h2>Fazer uma cópia</h2>
      ${ult ? `<p>Última cópia feita neste dispositivo: <b>${fd(ult.em.slice(0, 10), true)}</b>${dias ? `, há ${dias} dia${dias === 1 ? "" : "s"}` : ", hoje"}${ult.mb != null ? ` (${ult.mb} MB)` : ""}.</p>` : `<p>Ainda não fez nenhuma cópia neste dispositivo.</p>`}
      ${dias != null && dias >= 7 ? `<div class="banner warn"><span>Já passou mais de uma semana desde a última cópia.</span></div>` : ""}
      <div class="row" style="gap:10px;align-items:center"><button class="btn pri" id="cpDesc">Descarregar cópia de segurança</button><span class="note" id="cpEst"></span></div>
      <p class="note">Sugestão: faça uma cópia por semana, por exemplo antes da reunião de obra. Com muitas fotografias o ficheiro pode ter vários MB.</p>
    </section>
    <section class="card"><h2>Repor a partir de uma cópia</h2>
      <p>Volta a pôr tudo exatamente como estava quando a cópia foi feita. <b>O que foi registado depois disso perde-se.</b> Antes de repor, a aplicação descarrega automaticamente uma cópia do estado atual, para poder voltar atrás. ${store.user.papel === "dono" ? "Os acessos das pessoas nunca são apagados." : "Os acessos das pessoas não mudam: só o dono de obra mexe nos acessos."}</p>
      <label class="btn" style="cursor:pointer;display:inline-flex;width:auto">Escolher ficheiro da cópia<input type="file" id="cpFich" accept=".json,application/json" hidden></label>
      ${st.erro ? `<div class="err" style="margin-top:10px">${esc(st.erro)}</div>` : ""}
      ${L ? `<div class="copia-lida">
        <p><b>${esc(st.nomeF)}</b></p>
        <p>Cópia feita a <b>${fd(L.criadoEm.slice(0, 10), true)}</b> às ${hora(L.criadoEm)}${L.nomePor ? ` por ${esc(L.nomePor)}` : ""}${L.obra ? `, obra ${esc(L.obra)}` : ""}${L.modo === "demo" ? " (cópia da demonstração)" : ""}.</p>
        <h3>O que tem</h3>${copiaResumoHTML(copiaConta(L.colecoes))}
        ${L.modo && L.modo !== store.modo ? `<div class="dlg-av">Atenção: esta cópia foi feita ${L.modo === "demo" ? "na demonstração" : "na versão online"} e vai ser reposta ${store.modo === "demo" ? "na demonstração" : "na versão online"}.</div>` : ""}
        <div class="row" style="gap:10px;margin-top:12px;align-items:center"><button class="btn warn" id="cpRepor">Repor esta cópia</button><button class="btn ghost" id="cpCanc">Cancelar</button><span class="note" id="cpEst2"></span></div>
      </div>` : ""}
    </section>`;
  return {
    html, bind: () => {
      bindCommon();
      $("#cpDesc").onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true;
        const n = await descarregarCopia($("#cpEst"));
        b.disabled = false;
        if (n) { toast(`Cópia descarregada: ${n.atividades} atividades, ${n.pendentes} pendentes, ${n.registos} registos, ${n.fotos} fotografias`, { anular: false }); render(); }
      };
      $("#cpFich").onchange = async (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        st.lida = null; st.erro = ""; st.nomeF = f.name;
        try {
          const j = JSON.parse(await f.text());
          if (!j || j.formato !== COPIA_FORMATO || !j.colecoes || !j.colecoes.atividades) throw new Error("formato");
          if (!Object.keys(j.colecoes.atividades).length) throw new Error("vazia");
          st.lida = j;
        } catch (err) {
          st.erro = err.message === "vazia" ? "Esta cópia não tem atividades. Não pode ser reposta." : "Este ficheiro não é uma cópia de segurança desta aplicação.";
        }
        render();
      };
      const cc = $("#cpCanc"); if (cc) cc.onclick = () => { st.lida = null; st.erro = ""; render(); };
      const cr = $("#cpRepor");
      if (cr) cr.onclick = async () => {
        const L = st.lida, n = copiaConta(L.colecoes);
        const k1 = await perguntar({
          titulo: "Repor esta cópia?",
          texto: `<p>Tudo volta a ficar como estava a <b>${fd(L.criadoEm.slice(0, 10), true)}</b> às ${hora(L.criadoEm)}: ${n.atividades} atividades, ${n.pendentes} pendentes, ${n.registos} registos e ${n.fotos} fotografias.</p>
            <div class="dlg-av">O que foi registado depois dessa data perde-se, para todas as pessoas.</div>
            <p class="note">Primeiro é descarregada uma cópia do estado atual, para poder voltar atrás.</p>`,
          opcoes: [{ k: "sim", l: "Continuar", estilo: "warn" }, { k: "nao", l: "Cancelar", estilo: "pri" }],
        });
        if (k1 !== "sim") return;
        const est = $("#cpEst2");
        const atual = await descarregarCopia(est);
        if (!atual) { toast("A cópia do estado atual falhou, por isso nada foi reposto.", { anular: false }); return; }
        const k2 = await perguntar({
          titulo: "Tem a certeza?",
          texto: `<p>A cópia do estado atual já foi descarregada (${atual.atividades} atividades, ${atual.registos} registos). Confirme que a encontra na pasta de transferências.</p><p>Vai agora substituir tudo pelos dados da cópia de ${fd(L.criadoEm.slice(0, 10), true)}. Isto não se anula com o botão Anular.</p>`,
          opcoes: [{ k: "sim", l: "Sim, substituir tudo", estilo: "warn" }, { k: "nao", l: "Cancelar", estilo: "pri" }],
        });
        if (k2 !== "sim") return;
        cr.disabled = true;
        try {
          await store.repor(L.colecoes, { acessos: store.user.papel === "dono" }, (i, tot) => { if (est) est.textContent = tot > 1 ? `A repor... ${Math.round((100 * i) / tot)}%` : "A repor..."; });
          st.lida = null;
          toast("Cópia reposta. Os dados são agora os da cópia.", { anular: false });
          render();
        } catch (e) {
          cr.disabled = false; if (est) est.textContent = "";
          toast("A reposição falhou a meio: " + erroSimples(e) + ". Volte a repor a cópia, ou reponha a cópia do estado atual que foi descarregada.", { anular: false });
        }
      };
    },
  };
}
