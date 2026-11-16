// Trabalhos: lista, escolha em massa, datas e gravação com as seguintes.
import { addDays, diffDays, downstream, duracaoDe, pctEfetiva, schedule } from "../engine.js";
import { $, ESTADO, ICON, can, deltaHTML, esc, fd, filtrosAlterados, reporFiltros, toast, ui } from "./base.js";
import { actsObra, blocoLabel, compute, modeloTag, nomeAtiv, optsMotor } from "./calculo.js";
import { atribuirEquipa, openEquipa } from "./equipas.js";
import { S, store } from "./estado.js";
import { openSheet, patchTirarLigacao } from "./ficha.js";
import { render } from "./nucleo.js";
import { pendAberto, pendDe } from "./pendentes.js";
import { bindCommon } from "./previsao.js";

/* ============================================================ plano */
export function planoView() {
  const p = ui.plano;
  const papel = store.user.papel;
  if (p.f == null) p.f = "todas";
  p.tipo = p.tipo || ""; p.ativ = p.ativ || ""; p.unidade = p.unidade || "";
  if (p.unidade) { const uu = S.uMap[p.unidade]; if (!uu || (p.bloco && uu.bloco !== p.bloco) || (p.tipo && uu.tipo !== p.tipo)) p.unidade = ""; }
  const unidadesFil = S.unidades.filter((u) => (!p.bloco || u.bloco === p.bloco) && (!p.tipo || u.tipo === p.tipo)); p.soAtr = !!p.soAtr; p.editar = !!p.editar && can("executar");
  if (p.semConc == null) p.semConc = true; // por defeito, não mostrar o que já está 100% concluído
  const concluida = (a, r) => r.estado === "concluida" || pctEfetiva(a) >= 100;
  const esconde = p.semConc && p.f !== "concluida";
  const hoje = S.hoje, lim = addDays(hoje, 14);
  const ESTADOS = [["todas", "Todas"], ["proximas", "Próximas 2 semanas"], ["nao_iniciada", "Não iniciadas"], ["em_curso", "Em curso"], ["bloqueada", "Bloqueadas"],
    ["atrasada", "Atrasadas"], ["concluida", "Concluídas"], ["porconfirmar", "Datas por confirmar"]];
  const TIPOS = [["", "Todas as frações"], ["Apartamento", "Apartamentos"], ["Loja", "Lojas"], ["Zona comum", "Zonas comuns"], ["Geral", "Geral"]];
  const testa = (k, r) => {
    switch (k) {
      case "proximas": return r.estado !== "concluida" && (r.estado === "em_curso" || r.inicio <= lim);
      case "nao_iniciada": return r.estado === "por_iniciar" || r.estado === "bloqueada";
      case "em_curso": return r.estado === "em_curso";
      case "atrasada": return r.atrasada;
      case "bloqueada": return r.estado === "bloqueada";
      case "semplano": case "porconfirmar": return r.semPlano && r.estado !== "concluida";
      case "concluida": return r.estado === "concluida";
      default: return true;
    }
  };
  const semAc = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const qt = semAc(p.q.trim()).split(/\s+/).filter(Boolean); // várias palavras: todas têm de aparecer, sem ligar a acentos
  // filtros de "onde" e "o quê" (os estados contam-se sobre este conjunto)
  const base = Object.values(S.acts).map((a) => ({ a, r: S.res.get(a.id) })).filter(({ a, r }) => {
    const u = S.uMap[a.unidade];
    if (!u) return false;
    if (u.teste && p.unidade !== u.id) return false; // as de teste só aparecem quando se escolhe essa fração
    if (p.bloco && u.bloco !== p.bloco) return false;
    if (p.tipo && u.tipo !== p.tipo) return false;
    if (p.unidade && a.unidade !== p.unidade) return false;
    if (p.ativ && nomeAtiv(a) !== p.ativ) return false;
    if (p.equipa === "_sem" ? !!a.equipa : p.equipa && a.equipa !== p.equipa) return false;
    if (p.soAtr && !r.atrasada) return false;
    if (esconde && concluida(a, r)) return false;
    if (qt.length) { const txt = semAc(nomeAtiv(a) + " " + a.unidade + " " + a.ref + " " + (a.equipa || "") + " " + (u.nome || "")); if (!qt.every((t) => txt.includes(t))) return false; }
    return true;
  });
  const conta = Object.fromEntries(ESTADOS.map(([k]) => [k, base.filter(({ r }) => testa(k, r)).length]));
  if (esconde) conta.concluida = Object.values(S.acts).filter((a) => {
    const u = S.uMap[a.unidade], r = S.res.get(a.id);
    return u && (!p.bloco || u.bloco === p.bloco) && (!p.tipo || u.tipo === p.tipo) && (!p.unidade || a.unidade === p.unidade) && (!p.ativ || nomeAtiv(a) === p.ativ) && (!p.equipa || a.equipa === p.equipa) && concluida(a, r);
  }).length;
  const list = base.filter(({ r }) => testa(p.f, r));
  // ordenação: por coluna escolhida (clique no título) ou a ordem natural do filtro
  const ORDEM_EST = { em_curso: 0, bloqueada: 1, por_iniciar: 2, concluida: 3 };
  const natU = (u) => { const x = S.uMap[u]; return x ? [x.bloco, String(x.piso).padStart(2, "0"), u].join("|") : u; };
  const CHAVE = {
    unidade: (x) => natU(x.a.unidade),
    atividade: (x) => String(ordAt(x.a)).padStart(4, "0") + nomeAtiv(x.a).toLocaleLowerCase("pt"),
    estado: (x) => ORDEM_EST[x.r.estado] * 10 + (x.r.atrasada ? 0 : 1),
    inicio: (x) => x.r.inicio || "",
    fim: (x) => x.r.fim || "",
    desvio: (x) => (x.r.atraso == null ? -99999 : x.r.atraso),
    pct: (x) => pctEfetiva(x.a),
  };
  const cmp = (va, vb) => (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt"));
  // ordem normal: primeiro a atividade (pela sequência da obra), depois a fração
  const espOrd = Object.fromEntries((S.cfg.especialidades || []).map((e) => [e.key, e.ordem]));
  const ordAt = (a) => (a.esp && espOrd[a.esp] != null ? espOrd[a.esp] : 999);
  const natural = (x, y) => ordAt(x.a) - ordAt(y.a) || nomeAtiv(x.a).localeCompare(nomeAtiv(y.a), "pt") || natU(x.a.unidade).localeCompare(natU(y.a.unidade), "pt", { numeric: true }) || (x.r.inicio || "").localeCompare(y.r.inicio || "");
  if (p.sort && CHAVE[p.sort.col]) {
    const f = CHAVE[p.sort.col], dir = p.sort.dir === "desc" ? -1 : 1;
    list.sort((x, y) => dir * cmp(f(x), f(y)) || natural(x, y));
  } else list.sort(natural);
  const MAX = 300;
  const shown = list.slice(0, MAX);
  const nomes = [...new Set(Object.values(S.acts).map((a) => nomeAtiv(a)))].sort((a, b) => a.localeCompare(b, "pt"));
  const ed = p.editar, dono = papel === "dono";
  const atr = !!p.atribuir && can("executar");
  if (atr) p.selec = p.selec || new Set();
  const dIn = (id, campo, v, min) => `<input class="inp dt-in" type="date" data-ed="${id}|${campo}" value="${v || ""}" ${min ? `min="${min}"` : ""} aria-label="${campo}">`;
  ui.ligAberta = ui.ligAberta || new Set();
  const nCols = 7 + (atr ? 1 : 0);
  // ligações: o que esta atividade espera e o que espera por ela
  const ligItem = (id, de, comoSeg) => {
    const x = S.acts[id], rx = S.res.get(id); if (!x || !rx) return "";
    const pr = comoSeg ? ((rx.preds || []).find((q) => q.id === de) || {}) : ((S.res.get(de).preds || []).find((q) => q.id === id) || {});
    const porque = pr.fonte === "equipa" ? "mesma equipa, trabalho anterior" : pr.fonte === "grupo" ? "ao mesmo tempo, na fila da equipa" : pr.tipo === "SS" ? "começam juntas" : "";
    return `<li><button class="lnk-b" data-a="${id}"><span class="mono">${esc(x.unidade)}</span> <b>${esc(nomeAtiv(x))}</b></button>
      <span class="pill st-${rx.estado}">${ESTADO[rx.estado]}</span><span class="note num">${rx.estado === "concluida" ? "acabou a " + fd(rx.fim) : `${fd(rx.inicio)} a ${fd(rx.fim)}`}</span>${porque ? `<span class="note">(${porque})</span>` : ""}${rx.estado === "concluida" ? "" : deltaHTML(rx.atraso)}</li>`;
  };
  const ligHTML = (a, r) => {
    const ant = (r.preds || []).map((q) => q.id), seg = r.succ || [];
    const ord = (ids) => ids.slice().sort((x, y) => (S.res.get(x).inicio || "").localeCompare(S.res.get(y).inicio || ""));
    return `<tr class="lig-row"><td colspan="${nCols}"><div class="lig">
      <div><h4>Só começa depois de <span class="note num">${ant.length}</span></h4>${ant.length ? `<ul>${ord(ant).map((id) => ligItem(id, a.id, false)).join("")}</ul>` : `<p class="note">Nada: pode começar quando quiser.</p>`}</div>
      <div><h4>Dependem desta <span class="note num">${seg.length}</span></h4>${seg.length ? `<ul>${ord(seg).map((id) => ligItem(id, a.id, true)).join("")}</ul>` : `<p class="note">Nenhuma atividade espera por esta.</p>`}</div>
    </div></td></tr>`;
  };
  const linha = ({ a, r }) => {
    const nLig = (r.preds || []).length + (r.succ || []).length, aberta = ui.ligAberta.has(a.id);
    const bLig = `<button type="button" class="lig-b ${aberta ? "on" : ""}" data-lig="${a.id}" aria-expanded="${aberta}" title="Ver as atividades de que esta depende e as que dependem desta">${ICON.lig}<span class="num">${(r.preds || []).length} · ${(r.succ || []).length}</span></button>`;
    const espera = r.estado === "bloqueada" ? [...new Set(r.bloqueadaPor.map((id) => S.acts[id]).filter(Boolean).map((x) => nomeAtiv(x) + (x.unidade !== a.unidade ? " (" + x.unidade + ")" : "")))] : [];
    const ini = r.inicio, fim = r.fim;
    const cIni = ed ? dIn(a.id, "ini", ini) : `<span class="mono num">${fd(ini)}</span>`;
    const cFim = ed ? dIn(a.id, "fim", fim) : `<span class="mono num">${fd(fim)}</span>`;
    const ck = atr ? `<td class="ck"><input type="checkbox" data-ck="${a.id}" ${p.selec.has(a.id) ? "checked" : ""} aria-label="Escolher ${esc(nomeAtiv(a) + " " + a.unidade)}"></td>` : "";
    return `<tr ${ed ? "" : atr ? `data-tck="${a.id}" class="${p.selec.has(a.id) ? "sel" : ""}"` : `data-a="${a.id}"`}>${ck}<td class="mono">${esc(a.unidade)}${modeloTag(a.unidade, true)}</td>
      <td><div class="lig-nm">${ed ? `<button class="lnk-b" data-a="${a.id}"><b>${esc(nomeAtiv(a))}</b></button>` : `<b>${esc(nomeAtiv(a))}</b>`}${nLig && !atr ? bLig : ""}</div>${a.equipa ? `<div class="note">${esc(a.equipa)}</div>` : atr ? `<div class="note semeq">sem equipa</div>` : ""}${espera.length ? `<div class="wait">À espera de: ${esc(espera.slice(0, 2).join(", "))}${espera.length > 2 ? "..." : ""}</div>` : ""}</td>
      <td>${ed || can("executar") ? estadoEdHTML(a, r) : `<span class="pill st-${r.estado}">${ESTADO[r.estado]}</span>`}</td><td>${cIni}</td><td>${cFim}</td><td>${p.f === "porconfirmar" && can("executar") ? `<button class="btn sm" data-conf="${a.id}" title="A data mostrada está certa">Confirmar</button>` : deltaHTML(r.atraso)}</td><td class="mono num pctc2">${ed ? pctEdHTML(a) + pctFiscalHTML(a, true) : pctDuasHTML(a)}</td></tr>${aberta && !atr ? ligHTML(a, r) : ""}`;
  };
  const html = `
    <div class="card-h"><h1>Trabalhos</h1><div class="row">
      ${can("executar") ? `<button class="btn ${atr ? "warn" : ""}" id="pAtr" title="Escolher várias atividades para atribuir equipa, mudar a previsão, iniciar, concluir ou anular o início de uma vez">${atr ? "Terminar escolha" : "Concluir ou atribuir várias"}</button>` : ""}
      ${can("executar") ? `<button class="btn ${ed ? "warn" : ""}" id="pEdit">${ed ? "Terminar edição" : "Editar datas"}</button>` : ""}
      ${can("criar") ? `<button class="btn pri" data-nova="">+ Nova atividade</button>` : ""}</div></div>
    ${ed ? `<div class="banner">Altere as datas e a percentagem diretamente na tabela, ou toque no estado para iniciar ou concluir hoje. Cada alteração fica guardada logo e as atividades que dependem desta acertam-se sozinhas.
      Nas atividades por iniciar muda a previsão; nas iniciadas ou concluídas, corrige a data real.</div>`
      : papel === "empreiteiro" && !atr ? `<div class="banner">Toque numa atividade para a iniciar, atualizar a percentagem ou concluir. Para mudar várias datas, use Editar datas.</div>` : ""}
    ${(() => {
      const r = [];
      if (p.bloco) r.push(blocoLabel(p.bloco));
      if (p.tipo) r.push((TIPOS.find(([k]) => k === p.tipo) || [, p.tipo])[1]);
      if (p.unidade) r.push(p.unidade);
      if (p.ativ) r.push(p.ativ);
      if (p.equipa) r.push(p.equipa === "_sem" ? "Sem equipa" : "Equipa " + p.equipa);
      if (p.f && p.f !== "todas") r.push((ESTADOS.find(([k]) => k === p.f) || [, p.f])[1]);
      if (p.soAtr) r.push("Só atrasadas");
      if (p.q.trim()) r.push(`procura "${p.q.trim()}"`);
      if (!p.semConc && p.f !== "concluida") r.push("com as concluídas");
      return r.length ? `<div class="fres" role="status"><span>Filtros ativos: <b>${r.map(esc).join(" · ")}</b></span><button class="btn sm repor-on" data-repor>Limpar filtros</button></div>` : "";
    })()}
    <div class="chips" role="group" aria-label="Bloco">${["", "A", "B", "C", "D", "Geral"].map((b) => `<button class="chip ${p.bloco === b ? "on" : ""}" data-pb="${b}">${b === "Geral" ? "Geral" : b ? "Bloco " + b : "Todos os blocos"}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Estado">${ESTADOS.map(([k, l]) => `<button class="chip ${p.f === k ? "on" : ""}" data-pf="${k}">${l} <span class="num" style="opacity:.65">${conta[k]}</span></button>`).join("")}</div>
    <div class="filters">
      <label class="f">Frações<select class="inp" id="pt">${TIPOS.map(([k, l]) => `<option value="${k}" ${p.tipo === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Apartamento ou fração<select class="inp" id="pu"><option value="">Todas${p.bloco === "Geral" ? " do geral" : p.bloco ? " do bloco " + p.bloco : ""}</option>${["A", "B", "C", "D", "Geral"].map((g) => {
        const us = unidadesFil.filter((u) => u.bloco === g);
        return us.length ? `<optgroup label="${g === "Geral" ? "Geral" : "Bloco " + g}">${us.map((u) => `<option value="${esc(u.id)}" ${p.unidade === u.id ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</optgroup>` : "";
      }).join("")}${S.unidadesTeste.length ? `<optgroup label="Teste">${S.unidadesTeste.map((u) => `<option value="${esc(u.id)}" ${p.unidade === u.id ? "selected" : ""}>${esc(u.id)}</option>`).join("")}</optgroup>` : ""}</select></label>
      <label class="f">Atividade<select class="inp" id="pa"><option value="">Todas</option>${nomes.map((n) => `<option ${p.ativ === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="f">Equipa<select class="inp" id="pe"><option value="">Todas</option><option value="_sem" ${p.equipa === "_sem" ? "selected" : ""}>Sem equipa</option>${S.equipasTodas.map((e) => `<option ${p.equipa === e ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></label>
      <label class="f" style="flex:1;min-width:180px">Procurar<input class="inp" id="pq" value="${esc(p.q)}" placeholder="Ex.: B-F503, louças, 2#10"></label>
      <label class="check" style="align-self:center"><input type="checkbox" id="psa" ${p.soAtr ? "checked" : ""}><span>Só atrasadas</span></label>
      <label class="check" style="align-self:center" title="${p.f === "concluida" ? "Não se aplica ao ver as concluídas" : "Esconde as atividades 100% concluídas"}"><input type="checkbox" id="psc" ${p.semConc ? "checked" : ""} ${p.f === "concluida" ? "disabled" : ""}><span>Esconder concluídas</span></label>
      ${filtrosAlterados() ? `<button class="btn sm repor-on" id="pclr" style="align-self:center">Limpar filtros</button>` : ""}
    </div>
    ${p.f === "porconfirmar" ? `<div class="banner warn"><span>Estas atividades nunca tiveram data. A aplicação deu-lhes a primeira data possível: hoje, ou logo a seguir às anteriores. Corra a lista e, em cada uma, corrija a data (com Editar datas) ou confirme que está certa. Ao mudar uma data, a atividade sai desta lista.</span>${can("executar") && shown.length ? `<button class="btn sm" id="confTodas">Confirmar as ${shown.length} mostradas</button>` : ""}</div>` : ""}
    ${atr ? (() => {
      const n = p.selec.size, dis = n ? "" : "disabled";
      return `<div class="atrbar ${n ? "" : "vazia"}" id="atrbar">
      <div class="atr-top">
        <div class="atr-tit"><b>Escolha em massa</b><span class="atr-n ${n ? "on" : ""}"><b class="num">${n}</b> escolhida${n === 1 ? "" : "s"}</span></div>
        <div class="atr-sel"><button class="btn sm" id="atrTodas">Escolher as ${shown.length} da lista</button>${n ? `<button class="btn sm ghost" id="atrLimpa">Limpar escolha</button>` : ""}<button class="btn sm warn" id="atrFim" title="Fecha esta caixa e volta à lista normal">Terminar escolha</button></div>
      </div>
      <label class="f atr-q">Procurar para escolher<input class="inp" id="atrQ" type="search" value="${esc(p.q)}" placeholder="Ex.: louças B-F503"></label>
      ${n ? "" : `<p class="atr-dica">Filtre ou procure, e marque as atividades na lista (ou carregue em "Escolher as ${shown.length} da lista"). Depois escolha o que fazer em baixo.</p>`}
      <div class="atr-grupos">
        <section class="atr-g"><h4>Equipa</h4>
          <label class="f">Equipa a atribuir<select class="inp" id="atrEq"><option value="">Escolha...</option>${S.equipas.map((e) => `<option ${p.atrEq === e ? "selected" : ""}>${esc(e)}</option>`).join("")}<option value="_sem">Retirar a equipa</option><option value="_nova">+ Nova equipa...</option></select></label>
          <div class="atr-bt"><button class="btn pri" id="atrOk" ${dis}>Atribuir</button></div></section>
        <section class="atr-g"><h4>Execução</h4>
          <label class="f">Na data<input class="inp" type="date" id="atrData" value="${p.atrData || S.hoje}" max="${S.hoje}"></label>
          <div class="atr-bt"><button class="btn" id="atrIni" ${dis}>Iniciar</button><button class="btn ok" id="atrConc" ${dis}>Concluir</button><button class="btn ghost" id="atrAnIni" ${dis} title="Apaga o início real das escolhidas que estão em curso: voltam a estar por iniciar">Anular início</button></div></section>
        <section class="atr-g"><h4>Previsão</h4>
          <div class="atr-2"><label class="f">Início<input class="inp" type="date" id="prvIni" value="${p.prvIni || ""}"></label>
          <label class="f">Fim<input class="inp" type="date" id="prvFim" value="${p.prvFim || ""}"></label></div>
          <div class="atr-bt"><button class="btn pri" id="prvOk" ${dis} title="Muda a previsão das escolhidas. Se só indicar o início, o fim recalcula-se com a duração normal. Se só indicar o fim, o início fica como está.">Mudar previsão</button><button class="btn" id="prvRecIni" ${dis} title="Põe o início de cada escolhida no dia a seguir à última atividade de que depende (nunca antes de hoje), mantendo o prazo de cada uma">Recalcular o início</button><button class="btn" id="prvRec" ${dis} title="Volta a pôr o fim de cada escolhida com a duração normal, tirando os fins escritos à mão">Recalcular o fim</button></div></section>
      </div></div>`;
    })() : ""}
    <div class="note num">${list.length} atividade${list.length === 1 ? "" : "s"}${esconde ? ` · concluídas escondidas <button class="btn sm ghost" id="pmostra" style="min-height:24px;padding:0 6px;text-decoration:underline">mostrar</button>` : ""}</div>
    ${shown.length ? `<div class="tbl-wrap"><table class="tbl ${ed ? "editing" : ""}"><thead><tr>${atr ? `<th class="ck"><input type="checkbox" id="atrCkAll" ${shown.length && shown.every(({ a }) => p.selec.has(a.id)) ? "checked" : ""} aria-label="Escolher todas"></th>` : ""}${[["unidade", "Fração"], ["atividade", "Atividade"], ["estado", "Estado"], ["inicio", ed ? "Início" : "Início previsto"], ["fim", ed ? "Fim" : "Fim previsto"], ["desvio", "Atraso"], ["pct", "% · F"]].map(([k, l]) => {
      const on = p.sort && p.sort.col === k;
      return `<th aria-sort="${on ? (p.sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button class="th-sort ${on ? "on" : ""}" data-sort="${k}" title="Ordenar por ${l.toLowerCase()}">${l}<span class="arr">${on ? (p.sort.dir === "desc" ? "▼" : "▲") : "↕"}</span></button></th>`;
    }).join("")}</tr></thead><tbody>
    ${shown.map(linha).join("")}</tbody></table></div>${list.length > MAX ? `<p class="note">A mostrar ${MAX} de ${list.length}. Use os filtros para afinar.</p>` : ""}`
    : `<div class="empty">${atr && p.equipa === "_sem" ? "Não há trabalhos sem equipa com estes filtros. Para mudar a equipa de trabalhos que já têm uma, ponha o filtro Equipa em Todas." : `Nenhuma atividade com estes filtros.${filtrosAlterados() ? ` <button class="btn sm" data-repor>Limpar filtros</button>` : ""}`}</div>`}`;
  return {
    html, bind: () => {
      bindCommon();
      document.querySelectorAll("[data-lig]").forEach((b) => (b.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = b.dataset.lig;
        if (ui.ligAberta.has(id)) ui.ligAberta.delete(id); else ui.ligAberta.add(id);
        render();
      }));
      document.querySelectorAll("[data-pf]").forEach((b) => (b.onclick = () => { p.f = b.dataset.pf; p._fToque = true; render(); }));
      document.querySelectorAll("[data-pb]").forEach((b) => (b.onclick = () => { p.bloco = b.dataset.pb; render(); }));
      $("#pt").onchange = (e) => { p.tipo = e.target.value; render(); };
      $("#pu").onchange = (e) => { p.unidade = e.target.value; render(); };
      $("#pa").onchange = (e) => { p.ativ = e.target.value; render(); };
      $("#pe").onchange = (e) => { p.equipa = e.target.value; render(); };
      $("#psa").onchange = (e) => { p.soAtr = e.target.checked; render(); };
      $("#psc").onchange = (e) => { p.semConc = e.target.checked; render(); };
      const pm = $("#pmostra"); if (pm) pm.onclick = () => { p.semConc = false; render(); };
      document.querySelectorAll("[data-conf]").forEach((b) => (b.onclick = async (e) => {
        e.stopPropagation();
        const a = S.acts[b.dataset.conf];
        await store.updateAtividade(a.id, { dataOk: true, inicioPrevisto: a.inicioPrevisto || a.planInicio ? a.inicioPrevisto || null : S.res.get(a.id).prevIni }, { tipo: "previsao", texto: `Confirmou as datas de ${nomeAtiv(a)} em ${a.unidade}` });
        toast("Datas confirmadas");
      }));
      const ct = $("#confTodas");
      if (ct) ct.onclick = async () => {
        ct.disabled = true;
        for (const { a, r } of shown) await store.updateAtividade(a.id, { dataOk: true, inicioPrevisto: a.inicioPrevisto || a.planInicio ? a.inicioPrevisto || null : r.prevIni }, null);
        await store.updateAtividade(shown[0].a.id, {}, { tipo: "previsao", texto: `Confirmou as datas de ${shown.length} atividades` });
        toast(`${shown.length} atividades confirmadas`);
      };
      document.querySelectorAll("[data-sort]").forEach((b) => (b.onclick = () => {
        const col = b.dataset.sort;
        const desc0 = col === "desvio" || col === "pct"; // maiores primeiro no primeiro clique
        if (!p.sort || p.sort.col !== col) p.sort = { col, dir: desc0 ? "desc" : "asc" };
        else if (p.sort.dir === (desc0 ? "desc" : "asc")) p.sort.dir = desc0 ? "asc" : "desc";
        else p.sort = null; // terceiro clique: volta à ordem normal
        render();
      }));
      const clr = $("#pclr"); if (clr) clr.onclick = reporFiltros;
      const pe = $("#pEdit"); if (pe) pe.onclick = () => { p.editar = !p.editar; if (p.editar) p.atribuir = false; render(); };
      const pat = $("#pAtr"); if (pat) pat.onclick = () => { p.atribuir = !p.atribuir; if (p.atribuir) p.editar = false; else p.selec = new Set(); render(); };
      if (atr) {
        const marca = (id, on) => { on ? p.selec.add(id) : p.selec.delete(id); };
        document.querySelectorAll("[data-ck]").forEach((c) => (c.onclick = (e) => { e.stopPropagation(); marca(c.dataset.ck, c.checked); render(); }));
        document.querySelectorAll("[data-tck]").forEach((tr) => (tr.onclick = () => { const id = tr.dataset.tck; marca(id, !p.selec.has(id)); render(); }));
        const all = $("#atrCkAll"); if (all) all.onclick = () => { const on = all.checked; shown.forEach(({ a }) => marca(a.id, on)); render(); };
        $("#atrTodas").onclick = () => { shown.forEach(({ a }) => p.selec.add(a.id)); render(); };
        const lp = $("#atrLimpa"); if (lp) lp.onclick = () => { p.selec = new Set(); render(); };
        $("#atrFim").onclick = () => { p.atribuir = false; p.selec = new Set(); render(); };
        const sel = $("#atrEq");
        sel.onchange = () => {
          if (sel.value === "_nova") { sel.value = p.atrEq || ""; openEquipa(null, { aoGravar: (nome) => { p.atrEq = nome; render(); } }); return; }
          p.atrEq = sel.value;
          $("#atrOk").disabled = !p.selec.size || !sel.value;
        };
        $("#atrOk").disabled = !p.selec.size || !sel.value;
        $("#atrOk").onclick = async () => {
          const v = sel.value; if (!v || !p.selec.size) return;
          if (v === "_sem" && !(await confirmar("Retirar a equipa?", `<p>Os ${p.selec.size} trabalhos escolhidos ficam sem equipa.</p>`))) return;
          const ids = [...p.selec].filter((id) => S.acts[id]);
          if ((await atribuirEquipa(ids, v === "_sem" ? null : v)) === false) return;
          p.selec = new Set();
        };
        const dt = $("#atrData");
        dt.onchange = () => { p.atrData = dt.value; };
        $("#atrConc").onclick = async () => { if (await concluirVarias([...p.selec], dt.value || S.hoje)) p.selec = new Set(), render(); };
        $("#atrIni").onclick = async () => { if (await iniciarVarias([...p.selec], dt.value || S.hoje)) p.selec = new Set(), render(); };
        $("#atrAnIni").onclick = async () => { if (await anularInicioVarias([...p.selec])) p.selec = new Set(), render(); };
        $("#prvRec").onclick = async () => { if (await recalcularFim([...p.selec])) p.selec = new Set(), render(); };
        $("#prvRecIni").onclick = async () => { if (await recalcularInicioVarias([...p.selec])) p.selec = new Set(), render(); };
        const pi = $("#prvIni"), pf = $("#prvFim");
        pi.onchange = () => { p.prvIni = pi.value; };
        pf.onchange = () => { p.prvFim = pf.value; };
        $("#prvOk").onclick = async () => { if (await previsaoVarias([...p.selec], pi.value, pf.value)) { p.selec = new Set(); p.prvIni = ""; p.prvFim = ""; render(); } };
      }
      let tm; const procura = (sel) => { const el = $(sel); if (el) el.oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { p.q = e.target.value; render(); const i = $(sel); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch {} } }, 300); }; };
      procura("#pq"); procura("#atrQ");
      bindDateInputs(document);
      bindEstadoPct(document);
    },
  };
}

/** Seletor de uma atividade de qualquer fração (para ligações entre apartamentos). */
export function depPickerHTML(px, unidade, botao) {
  const grupos = ["A", "B", "C", "D", "Geral"];
  return `<div class="dpick">
    <div class="grid2" style="gap:8px">
      <label class="f">Fração<select class="inp" id="${px}U">${grupos.map((g) => {
        const us = S.unidades.filter((u) => u.bloco === g);
        return us.length ? `<optgroup label="${g === "Geral" ? "Geral" : "Bloco " + g}">${us.map((u) => `<option value="${esc(u.id)}" ${u.id === unidade ? "selected" : ""}>${esc(u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome)}</option>`).join("")}</optgroup>` : "";
      }).join("")}</select></label>
      <label class="f">Atividade<select class="inp" id="${px}A"></select></label>
    </div>
    <label class="f">Tipo de ligação<select class="inp" id="${px}T"><option value="FS">Só começa quando a outra acabar</option><option value="SS">Pode começar quando a outra começar</option></select></label>
    <div class="row"><button type="button" class="btn" id="${px}B" disabled>${botao}</button><span class="note" id="${px}N"></span></div>
  </div>`;
}
export function bindDepPicker(root, px, { excluir = new Set(), esp = null, self = null, onPick }) {
  const selU = root.querySelector("#" + px + "U"), selA = root.querySelector("#" + px + "A"), bt = root.querySelector("#" + px + "B"), nt = root.querySelector("#" + px + "N");
  const fill = (preferEsp) => {
    const u = S.uMap[selU.value];
    const lista = (u ? u.acts : []).filter((x) => !excluir.has(x.id));
    const escondidas = (u ? u.acts.length : 0) - lista.length - (u && self && u.acts.some((x) => x.id === self) ? 1 : 0);
    selA.innerHTML = `<option value="">Escolha...</option>` + lista.map((x) => {
      const r = S.res.get(x.id);
      return `<option value="${x.id}" ${preferEsp && x.esp === preferEsp ? "selected" : ""}>${esc(nomeAtiv(x))} (${ESTADO[r.estado].toLowerCase()}, fim ${fd(r.fim)})</option>`;
    }).join("");
    nt.textContent = escondidas ? `${escondidas} não aparece${escondidas > 1 ? "m" : ""}: já ligada${escondidas > 1 ? "s" : ""} ou dependente${escondidas > 1 ? "s" : ""} desta (evita ciclos).` : "";
    bt.disabled = !selA.value;
  };
  selU.onchange = () => fill(esp);
  selA.onchange = () => (bt.disabled = !selA.value);
  bt.onclick = () => { if (selA.value) onPick(selA.value, root.querySelector("#" + px + "T").value); };
  fill(null);
}

/** Campo de data que grava logo (usa editarData). */
export const dateInput = (id, campo, v, extra = "") => `<input class="inp dt-in" type="date" data-ed="${id}|${campo}" value="${v || ""}" ${extra} aria-label="${{ ini: "Início", fim: "Fim", prevIni: "Previsão de início", prevFim: "Previsão de fim", realIni: "Início real", realFim: "Fim real" }[campo] || "Data"}">`;
/** Em modo de edição: o estado vira um menu (iniciar hoje, concluir hoje...) e a percentagem um campo. */
export function estadoEdHTML(a, r) {
  const conc = r.estado === "concluida";
  const op = [];
  if (!a.realInicio && !conc) op.push(["ini", "Iniciar hoje"]);
  if (!conc) op.push(["fim", "Concluir hoje"]);
  if (conc) op.push(["reabrir", "Reabrir"]);
  if (a.realInicio && !conc) op.push(["anular", "Anular o início"]);
  return `<div class="fpick estpick"><button type="button" class="pill st-${r.estado} estb" data-estm="${a.id}" aria-haspopup="menu" title="Mudar o estado">${ESTADO[r.estado]} ▾</button>
    <div class="fmenu" hidden data-estmenu="${a.id}" role="menu">${op.map(([k, l]) => `<button type="button" class="fopt" role="menuitem" data-esta="${a.id}|${k}"><span><b>${l}</b>${k === "ini" || k === "fim" ? `<small>${fd(S.hoje, true)}</small>` : ""}</span></button>`).join("")}</div></div>`;
}
/** As duas percentagens (empreiteiro e fiscal), com a que conta destacada; avisa quando não estão de acordo. */
export function pctDuasHTML(a) {
  const e = Math.round(Number(a.pctEmp) || 0), f = a.pctFiscal == null ? null : Math.round(Number(a.pctFiscal));
  if (a.concluido) return `<span class="p2 conta" title="Concluída">100%</span>`;
  if (f == null) return `<span class="p2 conta" title="Empreiteiro: ${e}%. Ainda sem vistoria do fiscal.">${e}%</span> <span class="p2 sv" title="Sem vistoria">· F s/v</span>`;
  const contaF = !!(a.fiscalEm && (!a.empEm || a.fiscalEm >= a.empEm));
  const dif = Math.abs(e - f) >= 15;
  const dica = `Empreiteiro ${e}%, fiscal ${f}%. Conta a ${contaF ? "do fiscal" : "do empreiteiro"}, por ser a mais recente.${dif ? " Diferença de " + Math.abs(e - f) + " pontos." : ""}`;
  return `<span class="p2wrap ${dif ? "dif" : ""}" title="${esc(dica)}"><span class="p2 ${contaF ? "" : "conta"}">${e}%</span> · <span class="p2 ${contaF ? "conta" : ""}">F ${f}%</span></span>`;
}
export const pctFiscalHTML = (a) => `<span class="p2 sv"> F ${a.pctFiscal == null ? "s/v" : Math.round(Number(a.pctFiscal)) + "%"}</span>`;
export const pctEdHTML = (a) => `<label class="pct-ed" title="Percentagem feita (empreiteiro)"><input class="inp num" type="number" min="0" max="100" step="5" inputmode="numeric" data-pcted="${a.id}" value="${Math.round(Number(a.pctEmp) || 0)}" aria-label="Percentagem feita de ${esc(nomeAtiv(a))} em ${esc(a.unidade)}"><span>%</span></label>`;
/** Pede confirmação e conclui a atividade hoje (com os avisos das seguintes). */
/* ---- Várias de uma vez (Trabalhos, Concluir ou atribuir várias). As seguintes acertam-se sozinhas pela sequência. */
export const listaNomes = (xs, max = 6) => `<ul class="dlg-l">${xs.slice(0, max).map((a) => `<li>${esc(nomeAtiv(a))} em ${esc(a.unidade)}</li>`).join("")}${xs.length > max ? `<li class="note">e mais ${xs.length - max}</li>` : ""}</ul>`;
export async function concluirVarias(ids, v) {
  if (!dataCompleta(v)) { toast("Escolha uma data completa.", { anular: false }); return false; }
  if (v > S.hoje) { toast("A data de conclusão não pode ser no futuro.", { anular: false }); return false; }
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const ja = todas.filter((a) => S.res.get(a.id).estado === "concluida");
  const depois = todas.filter((a) => S.res.get(a.id).estado !== "concluida" && a.realInicio && a.realInicio > v);
  const alvo = todas.filter((a) => !ja.includes(a) && !depois.includes(a));
  if (!alvo.length) { toast(ja.length ? "As atividades escolhidas já estão concluídas." : "Nenhuma pode ser concluída nessa data: começaram depois dela.", { anular: false }); return false; }
  const baixas = alvo.filter((a) => Math.round(pctEfetiva(a)) < 90);
  const k = await perguntar({
    titulo: `Concluir ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>Ficam concluídas a <b>${fd(v, true)}</b>, com 100%:</p>${listaNomes(alvo)}
      ${baixas.length ? `<div class="dlg-av">Atenção: ${baixas.length} ${baixas.length === 1 ? "está registada" : "estão registadas"} com menos de 90%.</div>` : ""}
      ${(() => { const n = alvo.filter((a) => pendDe(a.unidade, a.id).some(pendAberto)).length; return n ? `<div class="dlg-av">${n} ${n === 1 ? "tem" : "têm"} pendentes por resolver. Os pendentes continuam abertos.</div>` : ""; })()}
      ${ja.length ? `<p class="note">${ja.length} já ${ja.length === 1 ? "estava concluída e fica" : "estavam concluídas e ficam"} como ${ja.length === 1 ? "estava" : "estavam"}.</p>` : ""}
      ${depois.length ? `<p class="note">${depois.length} ${depois.length === 1 ? "começou" : "começaram"} depois de ${fd(v)} e não ${depois.length === 1 ? "é concluída" : "são concluídas"}.</p>` : ""}
      <p class="note">As atividades seguintes acertam-se sozinhas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: `Sim, concluir ${alvo.length}`, estilo: "ok" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  const em = new Date().toISOString();
  const lista = alvo.map((a) => { const r = S.res.get(a.id); return { id: a.id, patch: { realInicio: a.realInicio || (r.prevIni && r.prevIni <= v ? r.prevIni : v), realFim: v, concluido: true, pctEmp: 100, empEm: em } }; });
  await store.updateMuitas(lista, { tipo: "conclusao", texto: `${alvo.length} atividades concluídas a ${fd(v)}: ${alvo.slice(0, 3).map((a) => nomeAtiv(a) + " em " + a.unidade).join(", ")}${alvo.length > 3 ? "..." : ""}` });
  toast(`${alvo.length} atividade${alvo.length === 1 ? "" : "s"} concluída${alvo.length === 1 ? "" : "s"} a ${fd(v)}`);
  return true;
}
export async function iniciarVarias(ids, v) {
  if (!dataCompleta(v)) { toast("Escolha uma data completa.", { anular: false }); return false; }
  if (v > S.hoje) { toast("A data de início real não pode ser no futuro.", { anular: false }); return false; }
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const alvo = todas.filter((a) => { const e = S.res.get(a.id).estado; return e === "por_iniciar" || e === "bloqueada"; });
  if (!alvo.length) { toast("As atividades escolhidas já estão iniciadas ou concluídas.", { anular: false }); return false; }
  const bloq = alvo.filter((a) => S.res.get(a.id).estado === "bloqueada");
  const k = await perguntar({
    titulo: `Iniciar ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>Ficam iniciadas a <b>${fd(v, true)}</b>:</p>${listaNomes(alvo)}
      ${bloq.length ? `<div class="dlg-av">Atenção: ${bloq.length} ainda ${bloq.length === 1 ? "está" : "estão"} à espera de outras atividades por concluir.</div>` : ""}
      ${todas.length > alvo.length ? `<p class="note">${todas.length - alvo.length} já ${todas.length - alvo.length === 1 ? "estava iniciada ou concluída e fica" : "estavam iniciadas ou concluídas e ficam"} como ${todas.length - alvo.length === 1 ? "estava" : "estavam"}.</p>` : ""}`,
    opcoes: [{ k: "sim", l: `Sim, iniciar ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  const em = new Date().toISOString();
  await store.updateMuitas(alvo.map((a) => ({ id: a.id, patch: { realInicio: v, pctEmp: Math.max(Number(a.pctEmp) || 0, 5), empEm: em } })), { tipo: "inicio", texto: `${alvo.length} atividades iniciadas a ${fd(v)}` });
  toast(`${alvo.length} atividade${alvo.length === 1 ? "" : "s"} iniciada${alvo.length === 1 ? "" : "s"} a ${fd(v)}`);
  return true;
}
/** Repõe o fim previsto com a duração normal (tira o fim escrito à mão e a duração própria). */
/**
 * Início recalculado pelas atividades de que esta depende: o dia a seguir ao fim previsto da última
 * (ou o arranque dela, numa ligação de início a início); nunca antes de hoje.
 */
export function inicioRecalc(id) {
  const a = S.acts[id], r = S.res.get(id);
  if (!a || !r) return { pode: false, porque: "" };
  if (r.estado === "concluida") return { pode: false, porque: "Atividade concluída." };
  if (a.realInicio) return { pode: false, porque: "Já começou: o início real é o que conta." };
  let { es, quem } = primeiraPossivel(r);
  // todas as de que depende já acabaram: pode começar hoje
  if (!es && r.preds.some((d) => S.res.get(d.id) && S.res.get(d.id).estado === "concluida")) es = S.hoje;
  if (!es) return { pode: false, porque: "Não depende de nenhuma atividade. Mude a data à mão, se precisar." };
  const dia = es < S.hoje ? S.hoje : es;
  const depois = quem ? `logo a seguir a ${nomeAtiv(quem)} em ${quem.unidade}` : "as atividades de que depende já acabaram";
  if (dia === r.prevIni) return { pode: false, dia, quem, porque: `O início já é o primeiro dia possível (${fd(dia)}): ${depois}.` };
  return { pode: true, dia, quem, es, porque: `Passa o início para ${fd(dia)}${es < S.hoje ? " (hoje)" : ""}: ${depois}. Mantém o prazo desta atividade.` };
}
export async function recalcularInicio(id) {
  const a = S.acts[id], r = S.res.get(id), ri = inicioRecalc(id);
  if (!ri.pode) { if (ri.porque) toast(ri.porque, { anular: false }); return false; }
  const N = `${nomeAtiv(a)} em ${a.unidade}`;
  const delta = diffDays(r.prevIni, ri.dia);
  // muda só o início; o prazo desta atividade fica igual (o fim anda com ele)
  const patch = { inicioPrevisto: ri.dia, dataOk: true, ...prazoDe(id) };
  await gravarComSeguintes(id, patch, { tipo: "previsao", texto: `${N}: início recalculado pelas atividades de que depende, ${fd(ri.dia)}` }, delta,
    `Início recalculado: ${fd(ri.dia)} (${delta > 0 ? delta + " dias mais tarde" : -delta + " dias mais cedo"})`);
  return true;
}
/**
 * Recalcular o início de várias: cada uma passa para o dia a seguir à última atividade de que depende (nunca antes de hoje),
 * com o mesmo prazo. Se uma escolhida depende de outra escolhida, conta já com a data nova dessa; por isso repete até estabilizar.
 */
export async function recalcularInicioVarias(ids) {
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const conc = todas.filter((a) => S.res.get(a.id).estado === "concluida");
  const comecadas = todas.filter((a) => !conc.includes(a) && a.realInicio);
  const cand = todas.filter((a) => !conc.includes(a) && !a.realInicio);
  const semDeps = cand.filter((a) => !S.res.get(a.id).preds.length);
  const patches = new Map();
  let res = S.res;
  for (let volta = 0; volta < 40; volta++) {
    let mudou = false;
    for (const a of cand) {
      const r = res.get(a.id);
      let es = null;
      let temConc = false;
      for (const d of r.preds) { const pr = res.get(d.id); if (!pr) continue; if (pr.estado === "concluida") { temConc = true; continue; } const c = d.tipo === "SS" ? pr.provIni : addDays(pr.provFim, 1); if (!es || c > es) es = c; }
      if (!es && temConc) es = S.hoje; // as de que depende já acabaram
      if (!es) continue;
      const dia = es < S.hoje ? S.hoje : es;
      const atual = patches.has(a.id) ? patches.get(a.id).inicioPrevisto : null;
      if (atual === dia || (!atual && dia === r.prevIni)) continue;
      patches.set(a.id, { inicioPrevisto: dia, dataOk: true, ...prazoDe(a.id) });
      mudou = true;
    }
    if (!mudou) break;
    res = schedule(Object.values(S.acts).map((x) => (patches.has(x.id) ? { ...x, ...patches.get(x.id) } : x)), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor());
  }
  const alvo = cand.filter((a) => patches.has(a.id) && patches.get(a.id).inicioPrevisto !== S.res.get(a.id).prevIni)
    .map((a) => ({ a, de: S.res.get(a.id).prevIni, para: patches.get(a.id).inicioPrevisto }));
  const jaCerto = cand.length - alvo.length - semDeps.length;
  if (!alvo.length) {
    toast(cand.length ? `Nenhuma muda: ${semDeps.length === cand.length ? "não dependem de outras atividades" : "já estão no primeiro dia possível"}.` : "As escolhidas já começaram ou estão concluídas: o início real é o que conta.", { anular: false });
    return false;
  }
  const mais = alvo.filter((x) => x.para > x.de).length, menos = alvo.length - mais;
  const k = await perguntar({
    titulo: `Recalcular o início de ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>Cada uma passa a começar no dia a seguir à última atividade de que depende (ou hoje, se esse dia já passou), com o mesmo prazo:</p>
      <ul class="dlg-l">${alvo.slice(0, 8).map((x) => `<li>${esc(nomeAtiv(x.a))} em ${esc(x.a.unidade)}: ${fd(x.de)} passa a <b>${fd(x.para)}</b></li>`).join("")}${alvo.length > 8 ? `<li class="note">e mais ${alvo.length - 8}</li>` : ""}</ul>
      <p class="note">${[menos ? `${menos} ${menos === 1 ? "começa" : "começam"} mais cedo` : "", mais ? `${mais} ${mais === 1 ? "começa" : "começam"} mais tarde` : ""].filter(Boolean).join(", ")}.
      ${jaCerto > 0 ? ` ${jaCerto} já ${jaCerto === 1 ? "estava" : "estavam"} no primeiro dia possível.` : ""}${semDeps.length ? ` ${semDeps.length} não ${semDeps.length === 1 ? "depende" : "dependem"} de nenhuma atividade e ${semDeps.length === 1 ? "fica" : "ficam"} como ${semDeps.length === 1 ? "está" : "estão"}.` : ""}${comecadas.length ? ` ${comecadas.length} já ${comecadas.length === 1 ? "começou" : "começaram"}: conta o início real.` : ""}${conc.length ? ` ${conc.length} ${conc.length === 1 ? "está concluída" : "estão concluídas"}.` : ""}</p>
      <p class="note">As atividades seguintes que não escolheu acertam-se se forem empurradas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: `Sim, recalcular ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  await store.updateMuitas(alvo.map((x) => ({ id: x.a.id, patch: patches.get(x.a.id) })),
    { tipo: "previsao", texto: alvo.length === 1 ? `${nomeAtiv(alvo[0].a)} em ${alvo[0].a.unidade}: início recalculado pelas atividades de que depende, ${fd(alvo[0].para)}` : `Início recalculado pelas atividades de que dependem em ${alvo.length} atividades` });
  toast(alvo.length === 1 ? `Início recalculado: ${fd(alvo[0].para)}` : `Início recalculado em ${alvo.length} atividades`);
  return true;
}
export async function recalcularFim(ids) {
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const mexida = (a) => !!a.fimPrevisto || (a.duracaoManual != null && a.duracaoManual !== "");
  const conc = todas.filter((a) => S.res.get(a.id).estado === "concluida");
  const alvo = todas.filter((a) => !conc.includes(a) && mexida(a));
  if (!alvo.length) { toast(todas.length === 1 ? "O fim desta atividade já está calculado com a duração normal." : "Nenhuma das escolhidas tem o fim mudado à mão: já estão todas com a duração normal.", { anular: false }); return false; }
  const durN = (a) => duracaoDe({ ...a, duracaoManual: null }, S.cfg.duracoes || {});
  if (alvo.length > 1 || todas.length > 1) {
    const iguais = todas.length - alvo.length - conc.length;
    const k = await perguntar({
      titulo: `Recalcular o fim de ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
      texto: `<p>O fim previsto volta a ser o início mais a duração normal de cada uma. Os fins escritos à mão e as durações próprias deixam de contar:</p>${listaNomes(alvo)}
        ${iguais ? `<p class="note">${iguais} já ${iguais === 1 ? "estava" : "estavam"} com a duração normal.</p>` : ""}
        ${conc.length ? `<p class="note">${conc.length} ${conc.length === 1 ? "está concluída e não muda" : "estão concluídas e não mudam"}.</p>` : ""}
        <p class="note">As atividades seguintes acertam-se sozinhas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
      opcoes: [{ k: "sim", l: `Sim, recalcular ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
    });
    if (k !== "sim") return false;
  }
  await store.updateMuitas(alvo.map((a) => ({ id: a.id, patch: { fimPrevisto: null, duracaoManual: null } })),
    { tipo: "previsao", texto: alvo.length === 1 ? `${nomeAtiv(alvo[0])} em ${alvo[0].unidade}: fim recalculado com a duração normal (${durN(alvo[0])} dias)` : `Fim recalculado com a duração normal em ${alvo.length} atividades` });
  toast(alvo.length === 1 ? `Fim recalculado com a duração normal (${durN(alvo[0])} dias)` : `Fim recalculado em ${alvo.length} atividades`);
  return true;
}
export async function anularInicioVarias(ids) {
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const conc = todas.filter((a) => S.res.get(a.id).estado === "concluida");
  const alvo = todas.filter((a) => a.realInicio && !conc.includes(a));
  if (!alvo.length) { toast(conc.length ? "As escolhidas estão concluídas. Para anular o início, apague primeiro o fim real." : "Nenhuma das escolhidas tem início real.", { anular: false }); return false; }
  const outras = todas.length - alvo.length - conc.length;
  const k = await perguntar({
    titulo: `Anular o início de ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>${alvo.length === 1 ? "Perde" : "Perdem"} o início real e ${alvo.length === 1 ? "volta" : "voltam"} a estar por iniciar:</p>${listaNomes(alvo)}
      ${conc.length ? `<p class="note">${conc.length} ${conc.length === 1 ? "está concluída e fica" : "estão concluídas e ficam"} como ${conc.length === 1 ? "estava" : "estavam"}. Para essas, apague primeiro o fim real.</p>` : ""}
      ${outras ? `<p class="note">${outras} ainda não ${outras === 1 ? "tinha" : "tinham"} começado.</p>` : ""}
      <p class="note">As datas previstas e as atividades seguintes acertam-se sozinhas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: `Sim, anular ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  await store.updateMuitas(alvo.map((a) => ({ id: a.id, patch: { realInicio: null } })), { tipo: "correcao", texto: `Anulou o início de ${alvo.length} atividades: ${alvo.slice(0, 3).map((a) => nomeAtiv(a) + " em " + a.unidade).join(", ")}${alvo.length > 3 ? "..." : ""}` });
  toast(`Início anulado em ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}`);
  return true;
}
export async function previsaoVarias(ids, ini, fim) {
  if (!ini && !fim) { toast("Indique a previsão de início, a de fim, ou as duas.", { anular: false }); return false; }
  if ((ini && !dataCompleta(ini)) || (fim && !dataCompleta(fim))) { toast("Escolha datas completas.", { anular: false }); return false; }
  if (ini && fim && fim < ini) { toast("A previsão de fim não pode ser antes da de início.", { anular: false }); return false; }
  const todas = ids.map((id) => S.acts[id]).filter(Boolean);
  const alvo = [], fora = [], cedo = [];
  for (const a of todas) {
    const r = S.res.get(a.id);
    if (!r || r.estado === "concluida") { fora.push(a); continue; }
    const arrancou = !!a.realInicio;
    const novoIni = ini && !arrancou ? ini : null;
    const iniEf = novoIni || r.prevIni;
    if (fim && iniEf && fim < iniEf) { fora.push(a); continue; }
    if (novoIni) { const { es } = primeiraPossivel(r); if (es && novoIni < es) cedo.push(a); }
    alvo.push({ a, r, arrancou, novoIni });
  }
  if (!alvo.length) { toast("Nenhuma das escolhidas pode ficar com essa previsão.", { anular: false }); return false; }
  const quero = [ini ? `início a <b>${fd(ini, true)}</b>` : "", fim ? `fim a <b>${fd(fim, true)}</b>` : ""].filter(Boolean).join(" e ");
  const k = await perguntar({
    titulo: `Mudar a previsão de ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}?`,
    texto: `<p>Ficam com ${quero}:</p>${listaNomes(alvo.map((x) => x.a))}
      ${ini && !fim ? `<p class="note">O fim recalcula-se com a duração normal de cada uma.</p>` : ""}
      ${fim && !ini ? `<p class="note">O início previsto fica como está.</p>` : ""}
      ${cedo.length ? `<div class="dlg-av">Atenção: ${cedo.length} ${cedo.length === 1 ? "só pode" : "só podem"} começar mais tarde, porque ${cedo.length === 1 ? "espera" : "esperam"} por outras atividades. Nestas, a aplicação não deixa começar antes da primeira data possível.</div>` : ""}
      ${fora.length ? `<p class="note">${fora.length} ${fora.length === 1 ? "não é alterada" : "não são alteradas"} (já concluídas, ou o fim ficaria antes do início).</p>` : ""}
      <p class="note">As atividades seguintes acertam-se sozinhas. Se se enganar, carregue em Anular na mensagem que aparece a seguir.</p>`,
    opcoes: [{ k: "sim", l: `Sim, mudar ${alvo.length}`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return false;
  const em = new Date().toISOString();
  const lista = alvo.map(({ a, r, arrancou, novoIni }) => {
    const patch = { dataOk: true };
    if (arrancou) {
      if (ini) patch.inicioPrevisto = ini;
      if (fim) patch.fimPrevisto = fim;
    } else {
      if (novoIni) { patch.inicioPrevisto = novoIni; patch.fimPrevisto = null; patch.duracaoManual = null; }
      if (fim) { patch.duracaoManual = diffDays(novoIni || r.prevIni, fim); patch.fimPrevisto = null; }
    }
    return { id: a.id, patch };
  });
  await store.updateMuitas(lista, { tipo: "previsao", texto: `Previsão de ${alvo.length} atividades mudada${ini ? ": início " + fd(ini) : ""}${fim ? (ini ? "," : ":") + " fim " + fd(fim) : ""}` });
  toast(`Previsão mudada em ${alvo.length} atividade${alvo.length === 1 ? "" : "s"}`);
  return true;
}
export async function concluirHoje(id) {
  const a = S.acts[id], r = S.res.get(id);
  if (!a || !r || r.estado === "concluida") return;
  const pct = Math.round(pctEfetiva(a));
  const k = await perguntar({
    titulo: "Concluir esta atividade?",
    texto: `<p>${rotuloAt(a)} fica concluída hoje, <b>${fd(S.hoje, true)}</b>, com 100%.</p>${pct < 90 ? `<p class="note">Atenção: está registada com ${pct}%.</p>` : ""}${(() => { const n = pendDe(a.unidade, a.id).filter(pendAberto).length; return n ? `<div class="dlg-av">Esta atividade tem ${n} pendente${n === 1 ? "" : "s"} por resolver. Pode concluir na mesma; os pendentes continuam abertos.</div>` : ""; })()}<p class="note">Se se enganar, pode reabri-la depois.</p>`,
    opcoes: [{ k: "sim", l: "Sim, concluir hoje", estilo: "ok" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return render();
  return editarData(id, "realFim", S.hoje);
}
export function bindEstadoPct(root) {
  root.querySelectorAll("[data-estm]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const m = root.querySelector(`[data-estmenu="${b.dataset.estm}"]`);
    const abrir = m.hidden;
    document.querySelectorAll(".fmenu").forEach((x) => (x.hidden = true));
    m.hidden = !abrir;
  }));
  root.querySelectorAll("[data-esta]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const [id, k] = b.dataset.esta.split("|"), a = S.acts[id];
    if (!a) return;
    const N = nomeAtiv(a) + " em " + a.unidade;
    b.closest(".fmenu").hidden = true;
    if (k === "ini") return editarData(id, "realIni", S.hoje);
    if (k === "fim") return concluirHoje(id);
    if ((k === "reabrir" || k === "anular") && !(await confirmar(k === "reabrir" ? "Reabrir esta atividade?" : "Anular o início?", k === "reabrir" ? `<p>${rotuloAt(a)} deixa de estar concluída e volta a estar em curso. A data real de fim é apagada.</p>` : `<p>${rotuloAt(a)} volta a estar por iniciar. A data real de início é apagada.</p>`, k === "reabrir" ? "Sim, reabrir" : "Sim, anular o início"))) return;
    if (k === "reabrir") { await store.updateAtividade(id, { concluido: false, realFim: null, pctEmp: Math.min(Number(a.pctEmp) || 0, 90), empEm: new Date().toISOString() }, { tipo: "reabrir", texto: `Reabriu ${N}` }); return toast(`Reaberta: ${N}`); }
    if (k === "anular") { await store.updateAtividade(id, { realInicio: null }, { tipo: "correcao", texto: `Anulou o início de ${N}` }); return toast("Início anulado: volta a estar por iniciar"); }
  }));
  root.querySelectorAll("[data-pcted]").forEach((inp) => (inp.onchange = async () => {
    const id = inp.dataset.pcted, a = S.acts[id], r = S.res.get(id);
    if (!a || !r) return;
    let v = Math.round(Number(inp.value));
    if (!isFinite(v)) return render();
    v = Math.max(0, Math.min(100, v));
    const N = nomeAtiv(a) + " em " + a.unidade;
    if (v >= 100 && r.estado !== "concluida") return concluirHoje(id); // 100% = concluída hoje, depois de confirmar
    if (v > 0 && !a.realInicio && r.estado !== "concluida") {
      await editarData(id, "realIni", S.hoje); // pode perguntar se a anterior ainda não acabou
      if (!S.acts[id].realInicio) return render(); // cancelou
    }
    await store.updateAtividade(id, { pctEmp: v, empEm: new Date().toISOString() }, { tipo: "progresso", texto: `${N}: ${v}% feito (empreiteiro)` });
    toast(`${N}: ${v}%`);
  }));
}
/** Atividades com datas impossíveis (ano antes de 1900, ex.: 0002-11-16), gravadas por engano ao escrever. */
export const CAMPOS_DATA = ["realInicio", "realFim", "inicioPrevisto", "fimPrevisto"];
export function datasEstranhas() {
  const out = [];
  for (const a of Object.values(S.acts)) {
    const maus = CAMPOS_DATA.filter((k) => a[k] && !dataCompleta(a[k]));
    if (maus.length) out.push({ a, maus, ex: a[maus[0]] });
  }
  return out;
}
export async function limparDatasEstranhas() {
  const m = datasEstranhas(); if (!m.length) return;
  const k = await perguntar({ titulo: "Apagar as datas impossíveis?", texto: `<p>Estas datas foram gravadas por engano e não fazem sentido. Ficam em branco; as atividades voltam ao estado em que estavam antes.</p>${listaNomes(m.map((x) => x.a))}`,
    opcoes: [{ k: "sim", l: "Sim, apagar", estilo: "pri" }, { k: "nao", l: "Cancelar" }] });
  if (k !== "sim") return;
  const lista = m.map(({ a, maus }) => { const patch = {}; for (const c of maus) patch[c] = null; if (maus.includes("realFim")) patch.concluido = false; return { id: a.id, patch }; });
  await store.updateMuitas(lista, { tipo: "correcao", texto: `Apagou ${lista.length} datas impossíveis (gravadas por engano ao escrever)` });
  toast(`Datas impossíveis apagadas em ${lista.length} atividade${lista.length === 1 ? "" : "s"}`);
}
/** Data completa e plausível (o navegador dá datas como 0002-11-16 enquanto se escreve o ano). */
export const dataCompleta = (v) => /^(19|20|21)\d\d-\d\d-\d\d$/.test(String(v || ""));
export function bindDateInputs(root) {
  root.querySelectorAll("[data-ed]").forEach((inp) => {
    let espera = null, aEscrever = false;
    const gravar = () => {
      clearTimeout(espera); espera = null;
      const [id, campo] = inp.dataset.ed.split("|");
      const v = inp.value;
      if (v && !dataCompleta(v)) { if (!aEscrever) toast("Data incompleta: escreva o dia, o mês e o ano com 4 algarismos.", { anular: false }); return; }
      if (inp.dataset.gravado === v) return; // o mesmo valor não é gravado duas vezes
      inp.dataset.gravado = v;
      aEscrever = false;
      inp.blur();
      editarData(id, campo, v);
    };
    // escrito à mão: só grava quando a data estiver completa e a pessoa parar de escrever (ou sair do campo)
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); aEscrever = false; gravar(); } else if (e.key.length === 1 || e.key === "Backspace" || e.key.startsWith("Arrow")) aEscrever = true; };
    inp.onchange = () => {
      clearTimeout(espera);
      if (inp.value && !dataCompleta(inp.value)) return; // ainda a escrever o ano
      if (aEscrever) espera = setTimeout(() => { aEscrever = false; gravar(); }, 1500);
      else gravar(); // escolhida no calendário
    };
    inp.onblur = () => { if (aEscrever || espera) { aEscrever = false; gravar(); } };
  });
}

/** Grava uma data editada no plano. Traduz a data escolhida no campo certo conforme o estado da atividade. */
/** Caixa de diálogo própria (não bloqueia o navegador). Devolve a chave da opção escolhida, ou null. */
export function perguntar({ titulo, texto, opcoes }) {
  return new Promise((resolve) => {
    document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove());
    document.body.insertAdjacentHTML("beforeend", `<div class="scrim dlg-s" data-dw="dlg"></div>
      <div class="dlg" data-dw="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">${titulo}</h2><div class="dlg-t">${texto}</div>
      <div class="dlg-b">${opcoes.map((o) => `<button class="btn ${o.estilo || ""}" data-dlg="${o.k}">${o.l}</button>`).join("")}</div></div>`);
    const fim = (k) => { document.querySelectorAll('[data-dw="dlg"]').forEach((e) => e.remove()); document.removeEventListener("keydown", esc_); resolve(k); };
    const esc_ = (e) => { if (e.key === "Escape") { e.stopPropagation(); fim(null); } };
    document.addEventListener("keydown", esc_);
    document.querySelectorAll("[data-dlg]").forEach((b) => (b.onclick = () => fim(b.dataset.dlg)));
    document.querySelector(".dlg-s").onclick = () => fim(null);
    const p = document.querySelector('.dlg [data-dlg]'); if (p) p.focus();
  });
}
/* ---- Correção única: atividades por concluir com o fim previsto já passado ficam com fim a DATA_CORR */
export const DATA_CORR = "2026-11-01";
export function expiradas() {
  return actsObra().filter((a) => { const r = S.res.get(a.id); return r && r.estado !== "concluida" && r.prevFim < S.hoje; });
}
export function patchCorr(a) {
  const r = S.res.get(a.id);
  const p = { fimPrevisto: DATA_CORR, dataOk: true };
  // se o início previsto ficava depois do novo fim, recua mantendo a duração que tinha
  if (r.prevIni > DATA_CORR) p.inicioPrevisto = addDays(DATA_CORR, -Math.max(0, diffDays(r.prevIni, r.prevFim)));
  // por iniciar e já empurrada pelas antecessoras: fixa o início onde está, senão o fim andava outra vez
  else if (r.estado !== "em_curso" && r.prevIni !== (a.inicioPrevisto || a.planInicio)) p.inicioPrevisto = r.prevIni;
  return p;
}
export async function corrigirExpiradas() {
  const lista = expiradas();
  if (!lista.length) return;
  const ids = new Set(lista.map((a) => a.id));
  const seg = new Set();
  for (const a of lista) for (const x of downstream(a.id, S.res)) if (!ids.has(x) && S.res.get(x).estado !== "concluida") seg.add(x);
  const k = await perguntar({
    titulo: "Corrigir datas expiradas",
    texto: `<p>${lista.length} atividades ainda não concluídas têm o fim previsto antes de hoje. Todas passam a ter fim previsto a <b>${fd(DATA_CORR, true)}</b>.</p><p>As ${seg.size} atividades seguintes a estas são recalculadas a partir das novas datas. É uma correção feita uma só vez; depois disto este aviso desaparece.</p>`,
    opcoes: [{ k: "sim", l: `Corrigir ${lista.length} atividades`, estilo: "pri" }, { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim") return;
  const antes = new Map([...seg].map((x) => [x, S.res.get(x).prevIni + "|" + S.res.get(x).prevFim]));
  await store.updateMuitas(lista.map((a) => ({ id: a.id, patch: patchCorr(a) })), { tipo: "previsao", texto: `Correção única: ${lista.length} atividades com o fim previsto já passado passaram a ter fim a ${fd(DATA_CORR, true)}` });
  await store.setConfig({ correcaoExpiradas: S.hoje });
  compute();
  let mexeram = 0; for (const [x, v] of antes) if (S.res.get(x).prevIni + "|" + S.res.get(x).prevFim !== v) mexeram++;
  toast(`${lista.length} atividades com fim previsto a ${fd(DATA_CORR, true)}. ${mexeram} atividades seguintes mudaram de data.`);
  render();
}
/** Confirmação para tudo o que anula ou retira alguma coisa. */
export async function confirmar(titulo, texto, sim = "Sim, retirar") {
  const k = await perguntar({ titulo, texto, opcoes: [{ k: "sim", l: sim, estilo: "warn" }, { k: "nao", l: "Cancelar" }] });
  if (k !== "sim") { render(); return false; }
  return true;
}
export const rotuloAt = (x, ref) => `<b>${esc(nomeAtiv(x))}</b>${!ref || x.unidade !== ref.unidade ? " em " + esc(x.unidade) : ""}`;
/** A primeira data em que a atividade pode começar e a antecessora que a impõe. */
export function primeiraPossivel(r) {
  let es = null, quem = null;
  for (const d of r.preds) {
    const pr = S.res.get(d.id); if (!pr) continue;
    if (pr.estado === "concluida") continue; // já acabou: não impede a data que se escreve
    const c = d.tipo === "SS" ? pr.provIni : addDays(pr.provFim, 1);
    if (!es || c > es) { es = c; quem = S.acts[d.id]; }
  }
  return { es, quem };
}
/**
 * Depois de mudar o fim de uma atividade, pergunta o que fazer às seguintes ainda por iniciar.
 * patch: o que vai ser gravado nesta atividade (para simular o efeito antes de gravar).
 */
/** Ao mudar a data de início de uma atividade, mantém o prazo dela sem fixar o fim:
 *  se o prazo é o da especialidade, continua a acompanhar os dias por fração; senão fica como duração própria. */
export function prazoDe(sid) {
  const x = S.acts[sid], xr = S.res.get(sid);
  const span = Math.max(0, diffDays(xr.prevIni, xr.prevFim));
  const padrao = duracaoDe({ ...x, duracaoManual: null }, S.cfg.duracoes || {});
  return { fimPrevisto: null, duracaoManual: span === padrao ? null : span };
}
export async function decidirSeguintes(id, patch) {
  const a = S.acts[id];
  const naFracao = location.hash.startsWith("#u-"); // a editar no ecrã de um apartamento: só esse apartamento
  const porIniciar = (sid) => { const x = S.acts[sid], xr = S.res.get(sid); return x && xr && xr.estado !== "concluida" && !x.realInicio; };
  const abertas = [...downstream(id, S.res)].filter(porIniciar);
  if (!abertas.length) return null;
  const todasAct = () => Object.values(S.acts);
  const simul = schedule(todasAct().map((x) => (x.id === id ? { ...x, ...patch } : x)), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor());
  // o que conta para as seguintes é o fim provável (uma previsão já ultrapassada conta a partir de hoje)
  const delta = diffDays(S.res.get(id).provFim, simul.get(id).provFim);
  if (!delta) return null;
  const mesmas = abertas.filter((sid) => S.acts[sid].unidade === a.unidade);
  const outras = abertas.filter((sid) => S.acts[sid].unidade !== a.unidade);
  const alvo = naFracao ? mesmas : abertas;
  const desloca = (lista) => lista.map((sid) => { const xr = S.res.get(sid); return { id: sid, patch: { inicioPrevisto: addDays(xr.prevIni, delta), ...prazoDe(sid), dataOk: true } }; });
  // efeito noutras frações se as deste apartamento andarem
  const pAlvo = new Map(desloca(alvo).map((x) => [x.id, x.patch]));
  const simul2 = schedule(todasAct().map((x) => (x.id === id ? { ...x, ...patch } : pAlvo.has(x.id) ? { ...x, ...pAlvo.get(x.id) } : x)), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor());
  const outrasMexem = outras.filter((sid) => simul2.get(sid).prevIni !== S.res.get(sid).prevIni);
  // ligações que saem deste apartamento para outras frações (desta atividade ou das seguintes deste apartamento)
  const cortes = [];
  for (const pid of [id, ...mesmas]) for (const sid of S.res.get(pid).succ || []) { if (S.acts[sid] && S.acts[sid].unidade !== a.unidade && porIniciar(sid) && !(S.res.get(sid).preds || []).some((d) => d.id === pid && d.fonte === "equipa")) cortes.push({ sid, pid }); }
  const mexem = (naFracao ? mesmas : abertas).filter((sid) => simul.get(sid).prevIni !== S.res.get(sid).prevIni).length;
  const lst = naFracao ? mesmas : abertas;
  const n = lst.length, dias = Math.abs(delta), um = n === 1, frente = delta > 0;
  const D = `${dias} dia${dias === 1 ? "" : "s"}`;
  const lista = lst.slice(0, 4).map((sid) => `<li>${rotuloAt(S.acts[sid], a)} <span class="note">começa ${fd(S.res.get(sid).prevIni)}</span></li>`).join("") + (n > 4 ? `<li class="note">e mais ${n - 4}</li>` : "");
  const exO = outrasMexem.slice(0, 3).map((sid) => rotuloAt(S.acts[sid], a)).join(", ");
  const opcoes = [];
  if (n) opcoes.push({ k: "todas", l: naFracao ? (frente ? `Andar as deste apartamento ${D} para a frente` : `Puxar as deste apartamento ${D} para trás`) : (frente ? `Andar todas ${D} para a frente` : `Puxar todas ${D} para trás`), estilo: "pri" });
  if (naFracao && outrasMexem.length && cortes.length) opcoes.push({ k: "isolar", l: n ? "Só este apartamento: desligar das outras frações" : "Não mexer nas outras frações: desligá-las desta", estilo: n ? "" : "pri" });
  opcoes.push({ k: "so", l: frente ? "Só as que ficam em conflito" : "Deixar as seguintes onde estão" });
  const k = await perguntar({
    titulo: frente ? `O fim passa ${D} para a frente` : `O fim passa ${D} para trás`,
    texto: `${n ? `<p>Há ${um ? "1 atividade seguinte" : n + " atividades seguintes"} por iniciar${naFracao ? " neste apartamento" : ""} que ${um ? "depende" : "dependem"} desta:</p><ul class="dlg-l">${lista}</ul>` : `<p>Neste apartamento não há atividades por iniciar a seguir a esta.</p>`}
      ${n ? `<p class="note">${frente ? (mexem === n ? "Se não escolher andar todas, cada uma anda só o necessário para não começar antes de esta acabar." : mexem ? `Se não escolher andar todas, só ${mexem === 1 ? "1 anda" : mexem + " andam"} para a frente (as que ficariam a começar antes de esta acabar); as outras ficam nas datas que têm.` : "Nenhuma fica em conflito: se não escolher andar todas, ficam nas datas que têm.") : "Se não as puxar, ficam nas datas que têm e passa a haver folga entre esta e as seguintes."}</p>` : ""}
      ${naFracao && outrasMexem.length ? `<p class="dlg-av"><b>Atenção:</b> ${outrasMexem.length === 1 ? "1 atividade de outra fração também mexe" : outrasMexem.length + " atividades de outras frações também mexem"} (${exO}${outrasMexem.length > 3 ? "..." : ""}), porque ${outrasMexem.length === 1 ? "está ligada" : "estão ligadas"} a este apartamento (por exemplo, a mesma equipa passa daqui para a fração seguinte). Para mexer só neste apartamento, escolha desligar das outras frações: ${cortes.length === 1 ? "essa ligação deixa" : "essas " + cortes.length + " ligações deixam"} de existir.</p>` : ""}`,
    opcoes,
  });
  if (k === "todas") return { delta, lista: desloca(alvo), cortes: [] };
  if (k === "isolar") {
    // retira as ligações deste apartamento para outras frações (junta várias na mesma atividade)
    const porSid = new Map();
    for (const { sid, pid } of cortes) {
      const x = { ...S.acts[sid], ...(porSid.get(sid) || {}) };
      const d = (S.res.get(sid).preds || []).find((q) => q.id === pid); if (!d) continue;
      const pt = d.fonte === "manual" ? { depsExtra: (x.depsExtra || []).filter((e) => e.id !== pid) } : { depsIgnorar: [...new Set([...(x.depsIgnorar || []), pid])] };
      // fica nas datas que tem agora (sem a ligação voltaria às datas antigas do Excel)
      const xr = S.res.get(sid);
      porSid.set(sid, { ...(porSid.get(sid) || {}), ...pt, inicioPrevisto: xr.prevIni, ...prazoDe(sid), dataOk: true });
    }
    return { delta, lista: desloca(alvo), cortes: [...porSid.entries()].map(([sid, pt]) => ({ id: sid, patch: pt })) };
  }
  return null;
}
export async function gravarComSeguintes(id, patch, registo, _delta, msg) {
  const dec = await decidirSeguintes(id, patch);
  const a = S.acts[id];
  if (dec && dec.cortes && dec.cortes.length) await store.updateMuitas(dec.cortes, { tipo: "dependencia", texto: `${dec.cortes.length} atividades de outras frações deixaram de esperar por ${a.unidade} (ao mudar ${nomeAtiv(a)})` });
  await store.updateAtividade(id, patch, registo);
  const seg = dec && dec.lista, delta = dec && dec.delta;
  const extra = dec && dec.cortes && dec.cortes.length ? `, ${dec.cortes.length} ligação${dec.cortes.length > 1 ? "ões" : ""} a outras frações retirada${dec.cortes.length > 1 ? "s" : ""}` : "";
  if (seg && seg.length) {
    await store.updateMuitas(seg, { tipo: "previsao", texto: `${seg.length} atividades seguintes de ${nomeAtiv(a)} em ${a.unidade} movidas ${delta > 0 ? "+" : ""}${delta} dias` });
    const ad = Math.abs(delta);
    return toast(`${msg}. ${seg.length > 1 ? "As seguintes foram" : "A seguinte foi"} ${delta > 0 ? "para a frente" : "para trás"} ${ad} dia${ad === 1 ? "" : "s"}${extra}`);
  }
  toast(msg + extra);
}

/** Grava uma data editada em qualquer ecrã, com avisos quando há conflito com as anteriores ou efeito nas seguintes. */
export async function editarData(id, campo, v, { manterPrazo = false } = {}) {
  const a = S.acts[id], r = S.res.get(id);
  if (!a || !r) return;
  if (v && !dataCompleta(v)) return; // nunca grava datas a meio de escrever
  const N = nomeAtiv(a) + " em " + a.unidade;
  const reg = (texto) => ({ tipo: "previsao", texto });
  const falha = (msg) => { toast(msg); render(); };
  const conc = r.estado === "concluida";
  // campos genéricos (Trabalhos, Gantt): conforme o estado, é a previsão ou o real
  if (campo === "ini") campo = conc || a.realInicio ? "realIni" : "prevIni";
  if (campo === "fim") campo = conc ? "realFim" : "prevFim";
  if (campo === "planIni" || campo === "planFim") {
    if (store.user.papel !== "dono") return;
    const ini = campo === "planIni" ? v || null : a.planInicio || null;
    const fim = campo === "planFim" ? v || null : a.planFim || null;
    if (ini && fim && fim < ini) return falha("O fim do plano não pode ser antes do início.");
    await store.updateAtividade(id, { planInicio: ini, planFim: fim }, reg(`Plano original de ${N}: ${ini ? fd(ini) : "sem data"} a ${fim ? fd(fim) : "sem data"}`));
    return toast("Plano atualizado");
  }
  if (campo === "realIni") {
    if (!v) {
      if (conc) return falha("Para tirar o início real, apague primeiro o fim real.");
      if (!a.realInicio) return;
      if (!(await confirmar("Apagar o início real?", `<p>${rotuloAt(a)} volta a estar por iniciar.</p>`, "Sim, apagar"))) return;
      await store.updateAtividade(id, { realInicio: null }, { tipo: "correcao", texto: `Anulou o início de ${N}` });
      return toast("Início real apagado: volta a estar por iniciar");
    }
    if (v > S.hoje) return falha(`O início real é o dia em que a atividade começou de facto, por isso não pode ser no futuro. Se vai começar a ${fd(v)}, mude a Previsão de início; no dia, registe o início real.`);
    if (a.realFim && conc && v > a.realFim) return falha("O início não pode ser depois do fim real.");
    if (!a.realInicio) {
      // arrancar com antecessoras por acabar
      const pend = r.preds.filter((d) => d.tipo !== "SS" && S.res.get(d.id) && S.res.get(d.id).estado !== "concluida").map((d) => S.acts[d.id]).filter(Boolean);
      if (pend.length) {
        const q = pend[0], qr = S.res.get(q.id);
        const k = await perguntar({
          titulo: "A atividade anterior ainda não acabou",
          texto: `<p>${rotuloAt(a)} só devia começar depois de ${rotuloAt(q, a)}, que está ${ESTADO[qr.estado].toLowerCase()} (${Math.round(pctEfetiva(q))}%) e tem fim previsto a ${fd(qr.provFim)}.${pend.length > 1 ? ` Há mais ${pend.length - 1} por acabar.` : ""}</p>`,
          opcoes: [{ k: "ver", l: `Ver ${esc(nomeAtiv(q))}`, estilo: "pri" }, { k: "sim", l: "Iniciar mesmo assim" }, { k: "nao", l: "Cancelar" }],
        });
        if (k === "ver") { render(); return openSheet(q.id, { empilhar: !!ui.sheet && ui.sheet.id === id }); }
        if (k !== "sim") return render();
      }
    }
    const ja = !!a.realInicio;
    await store.updateAtividade(id, { realInicio: v, pctEmp: Math.max(Number(a.pctEmp) || 0, 5), empEm: new Date().toISOString() }, { tipo: ja ? "correcao" : "inicio", texto: ja ? `Corrigiu o início real de ${N} para ${fd(v)}` : `${N} iniciada a ${fd(v)}` });
    return toast(ja ? "Início real corrigido" : `Iniciada a ${fd(v)}: ${N}`);
  }
  if (campo === "realFim") {
    if (!v) {
      if (!conc) return;
      if (!(await confirmar("Apagar o fim real?", `<p>${rotuloAt(a)} deixa de estar concluída e volta a estar em curso.</p>`, "Sim, apagar e reabrir"))) return;
      await store.updateAtividade(id, { realFim: null, concluido: false, pctEmp: Math.min(Number(a.pctEmp) || 0, 90), empEm: new Date().toISOString() }, { tipo: "reabrir", texto: `Reabriu ${N}` });
      return toast("Fim real apagado: a atividade volta a estar em curso");
    }
    if (v > S.hoje) return falha(`O fim real é o dia em que a atividade acabou de facto, por isso não pode ser no futuro. Se vai acabar a ${fd(v)}, mude a Previsão de fim.`);
    const ini = a.realInicio || (r.prevIni && r.prevIni <= v ? r.prevIni : v);
    if (v < ini) return falha("O fim real não pode ser antes do início real.");
    const patch = { realInicio: ini, realFim: v, concluido: true, pctEmp: 100, empEm: new Date().toISOString() };
    return gravarComSeguintes(id, patch, { tipo: "conclusao", texto: conc ? `Corrigiu o fim real de ${N} para ${fd(v)}` : `${N} concluída a ${fd(v)}` },
      diffDays(r.provFim, v), conc ? "Fim real corrigido" : `Concluída a ${fd(v)}`);
  }
  if (campo === "prevIni") {
    if (!v) return falha("Escolha uma data.");
    if (a.realInicio || conc) {
      // já arrancou: só muda a referência para o atraso de início
      await store.updateAtividade(id, { inicioPrevisto: v, dataOk: true }, reg(`Previsão de início de ${N} corrigida para ${fd(v)}`));
      return toast("Previsão guardada");
    }
    const { es, quem } = primeiraPossivel(r);
    let dia = v;
    if (es && v < es && quem) {
      const qr = S.res.get(quem.id);
      const podeLig = can("executar");
      const k = await perguntar({
        titulo: `Não pode começar a ${fd(v)}`,
        texto: `<p>${rotuloAt(a)} só pode começar quando ${rotuloAt(quem, a)} ${qr.estado === "concluida" ? "acabar, e acabou" : "acabar, e o fim previsto é"} a <b>${fd(qr.provFim)}</b>.</p><p>A primeira data possível é <b>${fd(es)}</b>.</p>`,
        opcoes: [
          { k: "es", l: `Começar a ${fd(es)}`, estilo: "pri" },
          { k: "ver", l: `Rever ${esc(nomeAtiv(quem))}` },
          ...(podeLig ? [{ k: "tirar", l: "Deixar de depender dela" }] : []),
          { k: "nao", l: "Cancelar" },
        ],
      });
      if (k === "ver") { render(); return openSheet(quem.id, { empilhar: !!ui.sheet && ui.sheet.id === id }); }
      if (k === "tirar") {
        const pt = patchTirarLigacao(id, quem.id);
        if (pt) await store.updateAtividade(id, pt, { tipo: "dependencia", texto: `${N} deixou de esperar por ${nomeAtiv(quem)} em ${quem.unidade}` });
        const r2 = schedule(Object.values(S.acts), S.cfg.regras || {}, S.hoje, S.cfg.duracoes || {}, optsMotor()).get(id);
        const out = primeiraPossivel({ preds: r2.preds });
        if (out.es && v < out.es) dia = out.es; // ainda há outra a impor uma data
      } else if (k === "es") dia = es;
      else return render();
    }
    const delta = diffDays(r.prevIni, dia);
    // nova previsão de início: o fim volta a contar com a duração normal desta atividade (a do Gantt, ao arrastar a barra, mantém o prazo)
    const patch = { inicioPrevisto: dia, dataOk: true, ...(manterPrazo ? prazoDe(id) : { fimPrevisto: null, duracaoManual: null }) };
    return gravarComSeguintes(id, patch, reg(`Nova previsão de início para ${N}: ${fd(dia)}`), delta,
      dia !== v ? `Fica a ${fd(dia)}` : delta ? "Previsão guardada" : "Sem alteração");
  }
  if (campo === "prevFim") {
    if (!v) return falha("Escolha uma data.");
    if (v < (r.prevIni || v)) return falha("A previsão de fim não pode ser antes da previsão de início.");
    const patch = !a.realInicio && !conc ? { duracaoManual: diffDays(r.prevIni, v), fimPrevisto: null, dataOk: true } : { fimPrevisto: v, dataOk: true };
    return gravarComSeguintes(id, patch, reg(`Nova previsão de fim para ${N}: ${fd(v)}`), conc ? 0 : diffDays(r.prevFim, v),
      !a.realInicio && !conc ? `Previsão guardada: ${patch.duracaoManual} dias` : "Previsão guardada");
  }
}
