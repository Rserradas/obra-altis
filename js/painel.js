// Precisa de atenção e Painel.
import { $, PAPEL, PLANO_PADRAO, can, deltaHTML, esc, fd, fdt, ui } from "./base.js";
import { actsObra, nomeAtiv } from "./calculo.js";
import { S, importando, store } from "./estado.js";
import { ordenaUnidades } from "./nova.js";
import { importarComProgresso } from "./nucleo.js";
import { pendTodos } from "./pendentes.js";
import { DATA_CORR, concluirHoje, corrigirExpiradas, datasEstranhas, editarData, expiradas, limparDatasEstranhas } from "./plano.js";
import { bindCommon, guardarFotoDiaria, heatHTML, resumoSemana } from "./previsao.js";
import { bindCcGantt, segurarCardHTML } from "./segurar.js";
import { ultimaVistoria } from "./unidades.js";

/* ============================================================ precisa de atenção (painel e semana) */
/** Quantas atividades por concluir dependem desta, direta ou indiretamente. */
export function nSeguintes(id) {
  const vistos = new Set([id]), fila = [id];
  let n = 0;
  while (fila.length) {
    const r = S.res.get(fila.shift());
    for (const sid of (r && r.succ) || []) {
      if (vistos.has(sid)) continue;
      vistos.add(sid);
      const rs = S.res.get(sid);
      if (rs && rs.estado !== "concluida") { n++; fila.push(sid); }
    }
  }
  return n;
}
export function atencaoDados() {
  const vivas = actsObra().map((a) => ({ a, r: S.res.get(a.id) })).filter(({ r }) => r && r.estado !== "concluida");
  const comSeg = (xs) => xs.map((x) => ({ ...x, seg: nSeguintes(x.a.id) })).sort((x, y) => y.seg - x.seg || (y.r.atraso || 0) - (x.r.atraso || 0));
  // em curso com o fim previsto já passado: muitas vezes já acabaram e ninguém as concluiu
  const esquecidas = comSeg(vivas.filter(({ r }) => r.estado === "em_curso" && r.atrasada));
  // livres para começar (as anteriores já acabaram) e com o início previsto já passado
  const paradas = comSeg(vivas.filter(({ a, r }) => r.estado === "por_iniciar" && !a.realInicio && r.prevIni && r.prevIni < S.hoje));
  const limite = new Date(Date.now() - 7 * 86400000).toISOString();
  const semVist = S.unidades.filter((u) => u.n.em_curso > 0 && (!ultimaVistoria(u) || ultimaVistoria(u) < limite));
  const pends = pendTodos().filter((x) => !S.idsTeste.has(x.unidade) && S.uMap[x.unidade]);
  const porFr = (xs) => { const m = new Map(); for (const x of xs) m.set(x.unidade, (m.get(x.unidade) || 0) + 1); return ordenaUnidades([...m.keys()].map((id) => S.uMap[id])).map((u) => [u.id, m.get(u.id)]); };
  const pendPor = pends.filter((x) => x.estado === "aberto");
  const pendFiscal = pends.filter((x) => (x.estado === "feito" || x.estado === "fechado") && !x.fiscalOk);
  return { esquecidas, paradas, semVist, pendPor, pendFiscal, porFr };
}
export function atencaoHTML({ max = 3, vist = true, fechavel = false } = {}) {
  const d = atencaoDados();
  const ex = can("executar");
  const linha = ({ a, r, seg }, tipo) => `<div class="at-l">
    <button class="lnk-b at-n" data-a="${a.id}"><span><b>${esc(nomeAtiv(a))}</b> <span class="mono">${esc(a.unidade)}</span></span>
      <small>${tipo === "fim" ? `devia ter acabado a ${fd(r.prevFim)}` : `podia ter começado a ${fd(r.prevIni)}`}${seg ? ` · atrasa ${seg} atividade${seg === 1 ? "" : "s"} seguinte${seg === 1 ? "" : "s"}` : ""}</small></button>
    <span class="at-b">${ex ? (tipo === "fim" ? `<button class="btn sm ok" data-at="fim|${a.id}">Concluí hoje</button>` : `<button class="btn sm pri" data-at="ini|${a.id}">Iniciei hoje</button>`) : ""}<button class="btn sm" data-a="${a.id}">Abrir</button></span>
  </div>`;
  const grupo = (titulo, sub, xs, tipo, f) => !xs.length ? "" : `<div class="at-g">
    <h3>${titulo} <span class="note num">${xs.length}</span></h3><p class="note">${sub}</p>
    ${xs.slice(0, max).map((x) => linha(x, tipo)).join("")}
    ${xs.length > max ? `<a class="note" href="#plano" data-atver="${f}">Ver as ${xs.length} nos Trabalhos</a>` : ""}</div>`;
  const frs = (lista) => `<div class="at-fr">${d.porFr(lista).slice(0, 16).map(([id, n]) => `<a class="mono chip-u" href="#u-${esc(id)}" data-irpend="${esc(id)}">${esc(id)}${n > 1 ? ` <b>${n}</b>` : ""}</a>`).join("")}</div>`;
  const papel = store.user.papel;
  const gPend = (d.pendPor.length && papel !== "fiscal" ? `<div class="at-g"><h3>Pendentes por resolver <span class="note num">${d.pendPor.length}</span></h3><p class="note">${papel === "empreiteiro" ? "Pontos registados nas frações. Quando estiverem resolvidos, carregue em Já está resolvido, aqui ou em Pendentes." : "Pontos registados nas frações, à espera do empreiteiro."}</p>${frs(d.pendPor)}</div>` : "")
    + (d.pendFiscal.length && papel !== "empreiteiro" ? `<div class="at-g"><h3>Pendentes resolvidos ou fechados, por verificar <span class="note num">${d.pendFiscal.length}</span></h3><p class="note">${papel === "fiscal" ? "O empreiteiro diz que estão resolvidos. Na próxima vistoria destas frações, veja se ficaram bem." : "Resolvidos pelo empreiteiro ou fechados, mas o fiscal ainda não verificou."}</p>${frs(d.pendFiscal)}</div>` : "");
  const corpo = gPend + grupo("Em curso, com o fim já passado", "Se já acabaram, conclua-as: as atividades seguintes avançam logo. As que atrasam mais atividades aparecem primeiro.", d.esquecidas, "fim", "em_curso")
    + grupo("Podiam já ter começado", "As anteriores já estão concluídas e a data de início já passou. Se já começaram, registe o início.", d.paradas, "ini", "proximas")
    + (vist && d.semVist.length ? `<div class="at-g"><h3>Frações em obra sem vistoria há mais de 7 dias <span class="note num">${d.semVist.length}</span></h3>
      <div class="at-fr">${d.semVist.slice(0, 12).map((u) => `<a class="mono chip-u" href="#u-${esc(u.id)}">${esc(u.id)}</a>`).join("")}${d.semVist.length > 12 ? `<a class="note" href="#unidades" data-atvist>ver todas</a>` : ""}</div></div>` : "");
  if (fechavel) {
    // em A minha semana fica fechado por defeito, para não empurrar as listas da semana
    if (!corpo) return "";
    const resumo = [d.pendPor.length ? `${d.pendPor.length} pendente${d.pendPor.length === 1 ? "" : "s"} por resolver` : "", d.esquecidas.length ? `${d.esquecidas.length} em curso com o fim já passado` : "", d.paradas.length ? `${d.paradas.length} podiam já ter começado` : ""].filter(Boolean).join(", ");
    return `<details class="card atencao" id="atencao" ${ui.atencaoAberta ? "open" : ""}><summary><b>Precisa de atenção</b> <span class="note">${resumo}</span></summary>${corpo}</details>`;
  }
  return `<section class="card atencao" id="atencao"><div class="card-h"><h2>Precisa de atenção</h2><span class="note">o que convém tratar primeiro</span></div>
    ${corpo || `<div class="empty">Nada urgente: não há pendentes, nem atividades esquecidas ou paradas.</div>`}</section>`;
}
export function bindAtencao() {
  document.querySelectorAll("#atencao [data-irpend]").forEach((b) => (b.onclick = () => { ui.lastUnit = b.dataset.irpend; ui.unidadeTab = store.user.papel === "fiscal" ? "vist" : "pend"; }));
  const dt = document.querySelector("details#atencao"); if (dt) dt.ontoggle = () => { ui.atencaoAberta = dt.open; };
  document.querySelectorAll("[data-atver]").forEach((b) => (b.onclick = () => { Object.assign(ui.plano, PLANO_PADRAO(), { f: b.dataset.atver, soAtr: b.dataset.atver === "em_curso", _fToque: true }); }));
  document.querySelectorAll("[data-atvist]").forEach((b) => (b.onclick = () => { ui.porVist = true; ui.bloco = "todos"; }));
  document.querySelectorAll("[data-at]").forEach((b) => (b.onclick = async () => {
    const [acao, id] = b.dataset.at.split("|");
    b.disabled = true;
    if (acao === "fim") await concluirHoje(id);
    else await editarData(id, "realIni", S.hoje);
  }));
}
/* ============================================================ painel */
export function painelView() {
  const t = S.tot;
  const blocos = {};
  for (const u of S.unidades) {
    const k = u.tipo === "Loja" ? "Lojas" : u.bloco;
    blocos[k] = blocos[k] || { dur: 0, feito: 0, fim: null, n: 0 };
    blocos[k].dur += u.dur; blocos[k].feito += u.feito; blocos[k].n += u.acts.length;
    if (!blocos[k].fim || (u.fim && u.fim > blocos[k].fim)) blocos[k].fim = u.fim;
  }
  const ordB = ["A", "B", "C", "D", "Lojas", "Geral"];
  const grupos = {};
  for (const a of actsObra()) {
    const r = S.res.get(a.id);
    if (r.estado === "concluida" || !(r.atraso > 0)) continue;
    const k = nomeAtiv(a);
    const g = (grupos[k] = grupos[k] || { nome: k, max: 0, soma: 0, itens: [] });
    g.itens.push({ a, r }); g.max = Math.max(g.max, r.atraso); g.soma += r.atraso;
  }
  const atrG = Object.values(grupos).sort((x, y) => y.max - x.max || y.itens.length - x.itens.length).slice(0, 8);
  for (const g of atrG) g.itens.sort((x, y) => y.r.atraso - x.r.atraso);
  const rec = store.recentes(12);
  const falta = !importando && store.user.papel === "dono" && store.faltamImportar ? store.faltamImportar() : 0;
  const corr = (store.user.papel === "dono" || store.admin) && !S.cfg.correcaoExpiradas ? expiradas().length : 0;
  const html = `
    ${corr ? `<div class="banner warn no-print"><span><b>Correção única:</b> ${corr} atividades por concluir têm o fim previsto já passado. Pode pôr todas com fim previsto a ${fd(DATA_CORR, true)}.</span><button class="btn sm pri" id="corrExp">Corrigir datas</button></div>` : ""}
    ${(() => { const m = datasEstranhas(); return m.length && (can("executar") || store.user.papel === "dono") ? `<div class="banner warn no-print"><span><b>${m.length} ${m.length === 1 ? "atividade tem" : "atividades têm"} uma data impossível</b> (por exemplo, do ano ${esc(m[0].ex.slice(0, 4))}), gravada por engano enquanto se escrevia a data à mão: ${m.slice(0, 4).map((x) => `${esc(nomeAtiv(x.a))} em ${esc(x.a.unidade)}`).join(", ")}${m.length > 4 ? "..." : ""}.</span><button class="btn sm pri" id="limparDatas">Apagar essas datas</button></div>` : ""; })()}
    ${store.semPendentes && (store.user.papel === "dono" || store.admin) ? `<div class="banner warn no-print"><span><b>Os pendentes ainda não funcionam:</b> falta publicar as regras novas do Firebase (Firestore, Regras). Veja o texto em firestore.rules.</span></div>` : ""}
    ${falta ? `<div class="banner warn no-print"><span><b>A importação do cronograma ficou a meio: faltam ${falta} de ${store.seed.atividades.length} trabalhos.</b> Os que já estão na aplicação não são alterados.</span><button class="btn sm pri" id="impFalta">Completar importação</button></div>` : ""}
    <div class="card-h no-print"><h1>Painel</h1><a class="btn" href="#relatorio">Relatório para reunião</a></div>
    <div class="headline">
      <div class="fim">
        <div class="eyebrow">Fim previsto da obra</div>
        <big class="num">${fd(t.fim, true)}</big>
        <div class="sub">${t.atrasada ? `${t.atrasada} atividades atrasadas.` : ""} Recalculado hoje com o estado real e a sequência.</div>
      </div>
      <div class="kpis">
        <a class="kpi k-ok" href="#plano" data-f="concluida"><b>${t.concluida}</b><span>Concluídas de ${t.n}</span></a>
        <a class="kpi k-curso" href="#plano" data-f="em_curso"><b>${t.em_curso}</b><span>Em curso</span></a>
        <a class="kpi k-crit" href="#plano" data-f="atrasada" title="Atrasada: a previsão de fim já passou e a atividade ainda não está concluída."><b>${t.atrasada}</b><span>Atrasadas <span class="qm" aria-hidden="true">?</span></span></a>
        <a class="kpi k-bloq" href="#plano" data-f="bloqueada"><b>${t.bloqueada}</b><span>Bloqueadas por outras</span></a>
      </div>
    </div>
    ${segurarCardHTML()}
    ${atencaoHTML()}
    <div class="grid2">
      <section class="card">
        <div class="card-h"><h2>Avanço por bloco</h2><span class="note">média ponderada pela duração</span></div>
        <div class="bars">${ordB.filter((k) => blocos[k]).map((k) => {
          const b = blocos[k]; const p = b.dur ? Math.round((100 * b.feito) / b.dur) : 0;
          return `<div class="bar-row"><b>${k.length === 1 ? "Bloco " + k : k}</b><div class="track"><i style="width:${p}%"></i></div><span class="num mono">${p}%</span><span class="bfim note num">fim ${fd(b.fim)}</span></div>`;
        }).join("")}</div>
      </section>
      <section class="card">
        <div class="card-h"><h2>Maiores atrasos</h2><a class="note" href="#plano" data-f="atrasada">ver todos</a></div>
        <p class="note" style="margin:0">Por especialidade, com o maior atraso de cada uma. Toque para ver a lista nos Trabalhos.</p>
        <div class="list">${atrG.length ? atrG.map((g) => `
          <a class="li li-g" href="#plano" data-atrg="${esc(g.nome)}"><span class="li-t">${esc(g.nome)}</span>${deltaHTML(g.max, `Maior atraso: ${g.max} dias. Atraso médio: ${Math.round(g.soma / g.itens.length)} dias.`)}
          <span class="li-s"><b>${g.itens.length} ${g.itens.length === 1 ? "fração" : "frações"}</b>${g.itens.slice(0, 5).map((x) => `<span class="mono chip-u">${esc(x.a.unidade)}</span>`).join("")}${g.itens.length > 5 ? `<span>+${g.itens.length - 5}</span>` : ""}</span></a>`).join("")
          : `<div class="empty">Sem atividades atrasadas.</div>`}</div>
      </section>
    </div>
    ${t.semPlano && can("executar") ? `<div class="banner warn"><span><b>${t.semPlano} atividades com datas por confirmar.</b> Não tinham data e a aplicação deu-lhes a primeira data possível, o que torna o fim previsto otimista.</span><a class="btn sm" href="#plano" data-f="porconfirmar">Rever datas</a></div>` : ""}
    <section class="card" id="semanaRes"><div class="card-h"><h2>Esta semana</h2><span class="note">últimos 7 dias</span></div><div class="note">A carregar...</div></section>
    ${heatHTML()}
    <section class="card">
      <div class="card-h"><h2>Últimas atualizações</h2></div>
      <div class="list">${rec.length ? rec.map((r) => `<div class="li"><span class="li-t">${esc(r.texto)}</span><span class="note num">${fdt(r.em)}</span>
        <span class="li-s"><span>${esc(r.nomePor || r.por)}</span><span class="role">${PAPEL[r.papel] || ""}</span>${r.unidade ? `<a class="mono" href="#u-${esc(r.unidade)}">${esc(r.unidade)}</a>` : ""}</span></div>`).join("")
        : `<div class="empty">Ainda não há registos. Quando o empreiteiro ou o fiscal atualizarem atividades, aparecem aqui.</div>`}</div>
    </section>`;
  return { html, bind: () => { bindCommon(); bindAtencao(); resumoSemana(); bindCcGantt();
    const ld = $("#limparDatas"); if (ld) ld.onclick = limparDatasEstranhas; guardarFotoDiaria(); const bc = $("#corrExp"); if (bc) bc.onclick = corrigirExpiradas; const bf = $("#impFalta"); if (bf) bf.onclick = () => { bf.disabled = true; importarComProgresso(true, () => { bf.disabled = false; }); }; } };
}
