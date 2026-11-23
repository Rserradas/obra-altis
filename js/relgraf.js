// Gráficos do relatório de vistoria: avanço de cada fração vistoriada e Gantt de cada fração.
import { addDays, diffDays, pctEfetiva } from "../engine.js";
import { esc, fd } from "./base.js";
import { nomeAtiv } from "./calculo.js";
import { S } from "./estado.js";

const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
/** Avanço médio da obra (as frações de teste não contam), ponderado pela duração como o de cada fração. */
const avancoObra = () => {
  let dur = 0, feito = 0;
  for (const u of S.unidades) { dur += u.dur || 0; feito += u.feito || 0; }
  return dur ? Math.round((100 * feito) / dur) : 0;
};

/** Gráfico de barras: o avanço de cada fração vistoriada, com a média da obra como referência. */
export function avancoFracoesHTML(uids, nomeU, descU) {
  const us = uids.map((id) => S.uMap[id]).filter(Boolean);
  if (!us.length) return "";
  const media = avancoObra();
  const linha = (u) => {
    const n = u.acts.length, conc = u.n ? u.n.concluida : 0, pct = Math.max(0, Math.min(100, u.pct || 0));
    return `<div class="rg-l"><span class="rg-n"><b class="mono">${esc(nomeU(u.id))}</b><small>${esc(descU(u.id))}</small></span>
      <span class="rg-bar" title="${esc(nomeU(u.id))}: ${pct}% de avanço, ${conc} de ${n} atividades concluídas"><i style="width:${pct}%"></i><em style="left:${media}%"></em></span>
      <span class="rg-v num"><b>${pct}%</b><small>${conc}/${n} concl.</small></span></div>`;
  };
  return `<div class="rg-av">${us.map(linha).join("")}
    <div class="rg-l rg-eixo" aria-hidden="true"><span></span><span class="rg-esc"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></span><span></span></div></div>
    <p class="rv-nota rg-leg"><span class="rg-k rg-k-av"></span> avanço da fração, ponderado pela duração das atividades &nbsp; <span class="rg-k rg-k-med"></span> média da obra: ${media}% &nbsp; · valores à data de emissão</p>`;
}

/** Marcas do eixo do tempo: meses, ou semanas quando o período é curto. */
function marcas(ini, fim) {
  const dias = diffDays(ini, fim), out = [];
  if (dias <= 70) {
    let d = addDays(ini, (8 - new Date(ini + "T12:00:00Z").getUTCDay()) % 7); // segunda-feira seguinte
    for (; d <= fim; d = addDays(d, 7)) out.push([d, fd(d, false)]);
  } else {
    const M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    let [y, m] = ini.split("-").map(Number);
    for (;;) {
      m++; if (m > 12) { m = 1; y++; }
      const d = `${y}-${String(m).padStart(2, "0")}-01`;
      if (d > fim) break;
      out.push([d, M[m - 1] + (m === 1 ? " " + String(y).slice(2) : "")]);
    }
  }
  return out;
}

/** Gantt de uma fração: uma linha por atividade, na ordem da sequência. As vistoriadas neste relatório ficam em destaque. */
export function ganttFracaoHTML(uid, vistas) {
  const u = S.uMap[uid];
  if (!u || !u.acts.length) return "";
  const linhas = u.acts.map((a) => ({ a, r: S.res.get(a.id) })).filter((x) => x.r && x.r.provIni && x.r.provFim);
  if (!linhas.length) return "";
  let ini = linhas.reduce((m, { r }) => [r.provIni, r.prevIni].filter(Boolean).reduce((p, q) => (q < p ? q : p), m), linhas[0].r.provIni);
  let fim = linhas.reduce((m, { r }) => [r.provFim, r.prevFim].filter(Boolean).reduce((p, q) => (q > p ? q : p), m), linhas[0].r.provFim);
  if (S.hoje < ini) ini = S.hoje; if (S.hoje > fim) fim = S.hoje;
  ini = addDays(ini, -2); fim = addDays(fim, 2);
  const total = Math.max(1, diffDays(ini, fim) + 1);
  const x = (d) => (100 * diffDays(ini, d)) / total;
  const larg = (a, b) => Math.max(0.6, (100 * (diffDays(a, b) + 1)) / total);
  const hojeX = x(S.hoje);
  const estadoDe = (r) => (r.estado === "concluida" ? "conc" : r.atrasada ? "atr" : r.estado === "em_curso" ? "curso" : r.estado === "bloqueada" ? "bloq" : "ini");
  const TXT = { conc: "concluída", atr: "atrasada", curso: "em curso", bloq: "à espera de outras", ini: "por iniciar" };
  const fila = ({ a, r }) => {
    const e = estadoDe(r), pct = Math.round(pctEfetiva(a)), v = vistas && vistas.has(a.id);
    const plano = r.prevIni && r.prevFim ? `<s style="left:${x(r.prevIni)}%;width:${larg(r.prevIni, r.prevFim)}%" title="Previsto: ${fd(r.prevIni)} a ${fd(r.prevFim)}"></s>` : "";
    const dica = `${nomeAtiv(a)}: ${fd(r.provIni)} a ${fd(r.provFim)}, ${TXT[e]}${e !== "conc" && pct > 0 ? `, ${pct}% feito` : ""}${r.atraso > 0 && e !== "conc" ? `, ${r.atraso} dias de atraso` : ""}`;
    return `<div class="rg-g-l${v ? " vista" : ""}"><span class="rg-g-n" title="${esc(nomeAtiv(a))}">${esc(nomeAtiv(a))}</span>
      <span class="rg-g-t">${plano}<b class="rg-b ${e}" style="left:${x(r.provIni)}%;width:${larg(r.provIni, r.provFim)}%" title="${esc(dica)}">${e !== "conc" && pct > 0 ? `<i style="width:${pct}%"></i>` : ""}</b></span>
      <span class="rg-g-p num">${e === "conc" ? "100%" : pct ? pct + "%" : ""}</span></div>`;
  };
  const ticks = marcas(ini, fim).map(([d, t]) => `<span style="left:${x(d)}%">${esc(t)}</span>`).join("");
  return `<div class="rg-g">
    <div class="rg-g-l rg-g-cab"><span class="rg-g-n">Planeamento</span><span class="rg-g-t rg-g-ax">${ticks}</span><span class="rg-g-p"></span></div>
    <div class="rg-g-c" style="--hoje:${hojeX.toFixed(2)}">${linhas.map(fila).join("")}</div>
    <p class="rv-nota rg-leg">${pl(linhas.length, "atividade", "atividades")} de ${fd(ini, true)} a ${fd(fim, true)} · a negrito as vistoriadas neste relatório · linha vermelha: hoje</p>
  </div>`;
}

/** Legenda das cores do Gantt (uma vez, antes das frações). */
export const legendaGanttHTML = () => `<p class="rv-nota rg-leg rg-leg-g"><span class="rg-k conc"></span> concluída <span class="rg-k curso"></span> em curso (parte escura: percentagem feita) <span class="rg-k atr"></span> atrasada <span class="rg-k bloq"></span> à espera de outras <span class="rg-k ini"></span> por iniciar <span class="rg-k prev"></span> previsão</p>`;
