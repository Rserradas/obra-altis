// Relatórios de vistoria.
import { $, erroSimples, esc, fd, fdt, toast, ui } from "./base.js";
import { nomeAtiv } from "./calculo.js";
import { S, store } from "./estado.js";
import { ordenaUnidades } from "./nova.js";
import { render } from "./nucleo.js";
import { PEND_ACAO, pendEstadoEm, pendRegVivo, pendTodos } from "./pendentes.js";
import { perguntar } from "./plano.js";
import { bindCommon } from "./previsao.js";
import { pl } from "./segurar.js";
import { abrirGaleria } from "./unidades.js";

/* ============================================================ relatórios de vistoria */
export const diaLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const diaNome = (dia) => { const d = new Date(dia + "T12:00:00"); return `${DIAS_SEM[d.getDay()]}, ${fd(dia, true)}`; };
export const hora = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
/** Agrupa os registos de vistoria por dia e por fiscal. */
export function resumoVistorias(regs) {
  const dias = new Map();
  for (const r of regs) {
    const dia = diaLocal(r.em);
    const k = dia + "|" + r.por;
    const x = dias.get(k) || { dia, por: r.por, nome: r.nomePor || r.por, regs: [], us: new Set(), ativs: new Set(), fotos: 0, coments: 0 };
    x.regs.push(r); if (r.unidade) x.us.add(r.unidade); if (r.ativ && !r.pend) x.ativs.add(r.ativ);
    if (r.pend) x.pends = (x.pends || 0) + 1;
    x.fotos += (r.dados && r.dados.nfotos) || (/(\d+) fotografia/.exec(r.texto || "") || [0, 0])[1] * 1;
    if ((r.dados && r.dados.nota) || /comentário:/.test(r.texto || "")) x.coments++;
    dias.set(k, x);
  }
  return [...dias.values()].sort((a, b) => b.dia.localeCompare(a.dia) || a.nome.localeCompare(b.nome));
}
/** O dono de obra elimina qualquer relatório; o fiscal, os seus. */
export const podeEliminarRel = (x) => store.user.papel === "dono" || store.admin || (store.user.papel === "fiscal" && x.por === store.user.email);
/**
 * Elimina o relatório de vistoria de um dia: os registos desse dia saem da lista e dos relatórios (com Anular).
 * As percentagens das atividades ficam como estão. As fotografias desse dia só saem se a pessoa o escolher (não dá para anular).
 */
export async function eliminarRelatorio(x) {
  const ini = new Date(x.dia + "T00:00:00").toISOString(), fim = new Date(new Date(x.dia + "T00:00:00").getTime() + 86400000).toISOString();
  let fotos = [];
  try { fotos = (await store.getFotosEntre(ini, fim)).filter((f) => f.por === x.por && (store.user.papel === "dono" || store.admin || f.por === store.user.email)); } catch (e) { fotos = []; }
  const ids = x.regs.map((r) => r.id).filter(Boolean);
  const k = await perguntar({
    titulo: `Eliminar o relatório de ${diaNome(x.dia)}?`,
    texto: `<p>A vistoria de <b>${esc(x.nome)}</b> nesse dia sai da lista e deixa de aparecer nos relatórios: ${pl(x.us.size, "fração", "frações")}, ${pl(x.ativs.size, "especialidade", "especialidades")}.</p>
      <p class="note">As percentagens das atividades ficam como estão: só o relatório é eliminado. Os pendentes também ficam como estão.</p>
      ${fotos.length ? `<p class="note">Há ${pl(fotos.length, "fotografia", "fotografias")} desse dia. ${fotos.length === 1 ? "Pode mantê-la nas frações ou apagá-la também; apagar a fotografia" : "Pode mantê-las nas frações ou apagá-las também; apagar as fotografias"} não se pode anular.</p>` : ""}`,
    opcoes: [{ k: "sim", l: "Eliminar o relatório", estilo: "warn" }, ...(fotos.length ? [{ k: "fotos", l: fotos.length === 1 ? "Eliminar o relatório e a fotografia" : `Eliminar o relatório e as ${fotos.length} fotografias` }] : []), { k: "nao", l: "Cancelar" }],
  });
  if (k !== "sim" && k !== "fotos") return false;
  const marca = { relApagado: new Date().toISOString(), relApagadoPor: store.user.email };
  await store.marcarRegistos(ids, marca, { tipo: "relatorio", texto: `Eliminou o relatório de vistoria de ${fd(x.dia, true)} (${x.nome})` });
  if (k === "fotos") for (const f of fotos) await store.removeFoto(f, null);
  toast(`Relatório de ${fd(x.dia, true)} eliminado${k === "fotos" ? `, com ${pl(fotos.length, "fotografia", "fotografias")}` : ""}`, {
    anular: false,
    acao: { label: "Anular", fn: async () => { await store.marcarRegistos(ids, { relApagado: null, relApagadoPor: null }, { tipo: "relatorio", texto: `Repôs o relatório de vistoria de ${fd(x.dia, true)} (${x.nome})` }); toast(`Relatório de ${fd(x.dia, true)} reposto${k === "fotos" ? ". As fotografias apagadas não voltam" : ""}`, { anular: false }); if (location.hash === "#vistorias") render(); } },
  });
  ui.vistHist = null;
  return true;
}
export function vistoriasView() {
  const st = (ui.vistLista = ui.vistLista || { por: store.user.papel === "fiscal" ? store.user.email : "", sel: null });
  const html = `
    <div class="card-h"><h1>Relatórios de vistoria</h1></div>
    <p style="max-width:70ch">Cada vez que o fiscal guarda uma vistoria, fica registado o que mudou: a percentagem antes e depois, o comentário e as fotografias. Escolha um ou mais dias e veja o relatório, que pode imprimir ou guardar em PDF.</p>
    <div id="vlista"><div class="note">A carregar as vistorias...</div></div>`;
  return {
    html, bind: async () => {
      const box = $("#vlista");
      let regs = [];
      try { regs = await store.getRegistosTipo("vistoria"); } catch (e) { box.innerHTML = `<div class="err">Não foi possível carregar as vistorias: ${esc(erroSimples(e))}.</div>`; return; }
      regs = regs.filter(pendRegVivo); // um pendente apagado sai dos relatórios
      const todos = resumoVistorias(regs);
      const fiscais = [...new Map(todos.map((x) => [x.por, x.nome])).entries()];
      const desenha = () => {
        const lista = todos.filter((x) => !st.por || x.por === st.por);
        if (st.sel == null) st.sel = new Set(lista.length ? [lista[0].dia + "|" + lista[0].por] : []);
        const n = [...st.sel].filter((k) => lista.some((x) => x.dia + "|" + x.por === k)).length;
        box.innerHTML = `
          ${fiscais.length > 1 || (st.por && !fiscais.some(([e]) => e === st.por)) ? `<div class="filters"><label class="f">Fiscal<select class="inp" id="vfPor"><option value="">Todos</option>${fiscais.map(([e, nome]) => `<option value="${esc(e)}" ${st.por === e ? "selected" : ""}>${esc(nome)}</option>`).join("")}</select></label></div>` : ""}
          ${lista.length ? `<div class="vdias">${lista.map((x) => { const k = x.dia + "|" + x.por; return `<label class="vdia ${st.sel.has(k) ? "on" : ""}">
              <input type="checkbox" data-vd="${esc(k)}" ${st.sel.has(k) ? "checked" : ""}>
              <span class="vd-t"><b>${diaNome(x.dia)}</b><small>${esc(x.nome)} · ${hora(x.regs[x.regs.length - 1].em)} a ${hora(x.regs[0].em)}</small></span>
              <span class="vd-n num"><span><b>${x.us.size}</b> ${x.us.size === 1 ? "fração" : "frações"}</span><span><b>${x.ativs.size}</b> ${x.ativs.size === 1 ? "especialidade" : "especialidades"}</span><span><b>${x.fotos}</b> ${x.fotos === 1 ? "fotografia" : "fotografias"}</span><span><b>${x.coments}</b> ${x.coments === 1 ? "comentário" : "comentários"}</span>${x.pends ? `<span><b>${x.pends}</b> ${x.pends === 1 ? "pendente" : "pendentes"}</span>` : ""}</span>
              <span class="vd-ac"><button class="btn sm" data-vd1="${esc(k)}">Ver só este dia</button>${podeEliminarRel(x) ? `<button class="btn sm ghost vd-del" data-vdel="${esc(k)}" title="Eliminar este relatório">Eliminar</button>` : ""}</span></label>`; }).join("")}</div>
            <div class="vdbar"><span class="num"><b>${n}</b> ${n === 1 ? "dia escolhido" : "dias escolhidos"}</span><button class="btn pri" id="vdVer" ${n ? "" : "disabled"}>Ver relatório</button></div>`
          : `<div class="empty">Ainda não há vistorias guardadas${st.por ? " deste fiscal" : ""}. Quando o fiscal guardar uma vistoria num apartamento, aparece aqui.</div>`}`;
        const fp = $("#vfPor"); if (fp) fp.onchange = () => { st.por = fp.value; st.sel = null; desenha(); };
        box.querySelectorAll("[data-vd]").forEach((c) => (c.onchange = () => { c.checked ? st.sel.add(c.dataset.vd) : st.sel.delete(c.dataset.vd); desenha(); }));
        const abrir = (ks) => { ui.relVist = { chaves: ks }; location.hash = "#relvist"; };
        box.querySelectorAll("[data-vd1]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abrir([b.dataset.vd1]); }));
        box.querySelectorAll("[data-vdel]").forEach((b) => (b.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          const x = todos.find((y) => y.dia + "|" + y.por === b.dataset.vdel);
          if (x && (await eliminarRelatorio(x))) { st.sel = null; render(); }
        }));
        const vv = $("#vdVer"); if (vv) vv.onclick = () => abrir([...st.sel].filter((k) => lista.some((x) => x.dia + "|" + x.por === k)));
      };
      desenha();
    },
  };
}
export function relVistView() {
  const rv = ui.relVist;
  if (!rv) return { html: `<div class="empty">Escolha primeiro os dias. <a href="#vistorias">Relatórios de vistoria</a></div>` };
  const html = `<div class="no-print row" style="justify-content:space-between"><a class="btn sm" href="#vistorias">‹ Relatórios de vistoria</a><button class="btn pri" id="rvPrint">Imprimir ou guardar em PDF</button></div>
    <div id="rvBox"><div class="note">A preparar o relatório...</div></div>`;
  return {
    html, bind: async () => {
      $("#rvPrint").onclick = () => window.print();
      const box = $("#rvBox");
      let regs;
      try { regs = await store.getRegistosTipo("vistoria"); } catch (e) { box.innerHTML = `<div class="err">Não foi possível carregar as vistorias: ${esc(erroSimples(e))}.</div>`; return; }
      regs = regs.filter(pendRegVivo); // um pendente apagado sai dos relatórios
      // chaves "dia|fiscal"; o atalho "Relatório de hoje" usa dias + por
      const chaves = new Set(rv.chaves || (rv.dias || []).map((d) => d + "|" + rv.por));
      const sel = regs.filter((r) => chaves.has(diaLocal(r.em) + "|" + r.por)).sort((a, b) => a.em.localeCompare(b.em));
      if (!sel.length) { box.innerHTML = `<div class="empty">Não há vistorias guardadas ${rv.dias ? "hoje" : "nos dias escolhidos"}.</div>`; return; }
      const dias = [...new Set(sel.map((r) => diaLocal(r.em)))].sort();
      const fiscais = [...new Set(sel.map((r) => r.nomePor || r.por))];
      // por atividade: primeiro "antes", último "depois"
      const porAt = new Map();
      for (const r of sel.filter((r) => !r.pend)) {
        const k = r.ativ || r.id;
        const x = porAt.get(k) || { ativ: r.ativ, unidade: r.unidade, regs: [] };
        x.regs.push(r); porAt.set(k, x);
      }
      const linhas = [...porAt.values()].map((x) => {
        const a = S.acts[x.ativ];
        const prim = x.regs[0], ult = x.regs[x.regs.length - 1];
        const d0 = prim.dados || {}, d1 = ult.dados || {};
        const depois = [...x.regs].reverse().map((r) => r.dados && r.dados.depois).find((v) => v != null);
        const notas = [...new Set(x.regs.map((r) => r.dados ? r.dados.nota : (/comentário: (.*)$/.exec(r.texto || "") || [])[1]).filter(Boolean))];
        // vistoria anterior ao período (de qualquer fiscal), para ver se a obra andou
        const ini0 = new Date(dias[0] + "T00:00:00").toISOString();
        const ant = x.ativ ? regs.filter((r) => !r.pend && r.ativ === x.ativ && r.em < ini0).sort((p, q) => q.em.localeCompare(p.em))[0] : null;
        const valDe = (r) => (r.dados && r.dados.depois != null ? r.dados.depois : (() => { const m = /: (\d+)% \(empreiteiro/.exec(r.texto || ""); return m ? Number(m[1]) : null; })());
        const prev = ant ? { pct: valDe(ant), em: ant.em } : null;
        const confirmado = x.regs.some((r) => r.dados && r.dados.confirmado);
        const corrigido = x.regs.map((r) => r.corrigidoEm).filter(Boolean).sort().pop() || null;
        return { ...x, a, corrigido, nome: (a && nomeAtiv(a)) || d1.esp || "Atividade", antes: d0.antes ?? null, depois: depois ?? null, emp: d1.emp ?? (a ? Math.round(Number(a.pctEmp) || 0) : null), notas, semDados: !prim.dados, texto: ult.texto, prev, confirmado };
      });
      const atencao = linhas.filter((l) => l.depois != null && l.emp != null && Math.abs(l.depois - l.emp) >= 15);
      const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
      const parado = linhas.filter((l) => l.prev && l.prev.pct != null && l.depois != null && l.depois < 100 && l.depois <= l.prev.pct && diasEntre(l.prev.em, (l.regs[l.regs.length - 1] || {}).em || new Date().toISOString()) >= 7);
      const porU = new Map();
      for (const l of linhas) { const k = l.unidade || "?"; (porU.get(k) || porU.set(k, []).get(k)).push(l); }
      const visitadas = new Set([...porU.keys(), ...sel.filter((r) => r.pend && r.unidade).map((r) => r.unidade)]);
      const ordemU = ordenaUnidades([...porU.keys()].map((id) => S.uMap[id] || { id, bloco: "?", piso: 99 })).map((u) => u.id);
      const pctTxt = (v) => (v == null ? "s/v" : v + "%");
      const nomeU = (id) => { const u = S.uMap[id]; return u ? (u.tipo === "Apartamento" || /-L\d+$/.test(u.id) ? u.id : u.nome) : id; };
      const descU = (id) => { const u = S.uMap[id]; if (!u) return ""; return [u.tipo, u.bloco && u.bloco !== "Geral" ? "Bloco " + u.bloco : "", u.tipo === "Apartamento" ? "Piso " + u.piso : ""].filter(Boolean).join(" · "); };
      const iniciais = (t) => String(t).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("");
      const ref = `RV-${dias[0].replace(/-/g, "")}${dias.length > 1 ? "-" + dias[dias.length - 1].replace(/-/g, "") : ""}-${iniciais(fiscais[0] || "F")}`;
      const horario = dias.map((d) => { const rs = sel.filter((r) => diaLocal(r.em) === d); return `${fd(d, true)}, das ${hora(rs[0].em)} às ${hora(rs[rs.length - 1].em)}`; });
      const nCom = linhas.filter((l) => l.notas.length).length;
      // fotografias dos dias escolhidos, do(s) fiscal(is) do relatório
      const pors = new Set(sel.map((r) => r.por));
      box.innerHTML = `<div class="note">A carregar as fotografias...</div>`;
      let fotos = [];
      for (const d of dias) {
        const ini = new Date(d + "T00:00:00").toISOString(), fim = new Date(new Date(d + "T00:00:00").getTime() + 86400000).toISOString();
        try { fotos = fotos.concat(await store.getFotosEntre(ini, fim)); } catch (e) { /* sem fotografias */ }
      }
      const ativsSel = new Set(linhas.map((l) => l.ativ));
      fotos = fotos.filter((f) => pors.has(f.por) && ativsSel.has(f.ativ));
      // numeração pela ordem do relatório (fração, especialidade, hora)
      const ordemL = ordemU.flatMap((uid) => porU.get(uid));
      fotos.sort((a, b) => ordemL.findIndex((l) => l.ativ === a.ativ) - ordemL.findIndex((l) => l.ativ === b.ativ) || (a.em || "").localeCompare(b.em || ""));
      fotos.forEach((f, i) => (f.num = i + 1));
      const refsDe = (ativ) => fotos.filter((f) => f.ativ === ativ).map((f) => `<a href="#rvf${f.num}" class="rv-fr">F${f.num}</a>`).join(" ");
      // pendentes: todos os que já existiam no fim do período e ainda não estavam fechados nessa altura,
      // mais os que foram fechados durante o período. O estado é o desse dia (um relatório antigo não muda).
      const iniP = new Date(dias[0] + "T00:00:00").toISOString(), fimP = new Date(new Date(dias[dias.length - 1] + "T00:00:00").getTime() + 86400000).toISOString();
      const noPer = (p) => p.em >= iniP && p.em < fimP && dias.includes(diaLocal(p.em));
      const pendRel = pendTodos().filter((x) => (x.criadoEm || "") < fimP && S.uMap[x.unidade] && (!S.idsTeste.has(x.unidade) || porU.has(x.unidade)))
        .map((x) => ({ x, e: pendEstadoEm(x, fimP), ev: (x.historico || []).filter(noPer) }))
        .filter(({ e, ev }) => e.estado !== "fechado" || ev.some((p) => p.acao === "fechado" || p.acao === "confirmado"))
        .sort((a, b) => (b.x.criadoEm || "").localeCompare(a.x.criadoEm || ""));
      const nPendAb = pendRel.filter(({ e }) => e.estado !== "fechado").length;
      let sec = 0;
      box.innerHTML = `<article class="rv">
        <header class="rv-cab">
          <div class="rv-marca"><div class="brand-mark">AL</div><div><b>${esc(S.cfg.nome || "Obra ALTIS")}</b><span>Controlo de obra</span></div></div>
          <div class="rv-tit"><h1>Relatório de vistoria</h1><span class="mono">${esc(ref)}</span></div>
        </header>
        <table class="rv-id"><tbody>
          <tr><th>${dias.length === 1 ? "Data" : "Datas"}</th><td>${dias.length === 1 ? diaNome(dias[0]) : dias.map((d) => diaNome(d)).join("; ")}</td><th>Fiscal</th><td>${esc(fiscais.join(", "))}</td></tr>
          <tr><th>Horário</th><td>${horario.join("<br>")}</td><th>Emitido</th><td>${fdt(new Date().toISOString())}, por ${esc(store.user.nome)}</td></tr>
        </tbody></table>
        <div class="rv-res num">
          <div><b>${visitadas.size}</b><span>${visitadas.size === 1 ? "fração visitada" : "frações visitadas"}</span></div>
          <div><b>${linhas.length}</b><span>${linhas.length === 1 ? "especialidade vistoriada" : "especialidades vistoriadas"}</span></div>
          <div><b>${fotos.length}</b><span>${fotos.length === 1 ? "fotografia" : "fotografias"}</span></div>
          <div class="${atencao.length ? "mau" : ""}"><b>${atencao.length}</b><span>${atencao.length === 1 ? "diferença com o empreiteiro" : "diferenças com o empreiteiro"}</span></div>
          <div class="${parado.length ? "aviso" : ""}"><b>${parado.length}</b><span>sem avanço desde a vistoria anterior</span></div>
          <div class="${nPendAb ? "aviso" : ""}"><b>${nPendAb}</b><span>${nPendAb === 1 ? "pendente por resolver" : "pendentes por resolver"}</span></div>
        </div>

        <section class="rv-sec"><h2>${++sec}. Pontos de atenção</h2>
          <h3 class="rv-sub">Diferenças entre o fiscal e o empreiteiro</h3>
          ${atencao.length ? `<p class="rv-nota">Especialidades em que a percentagem verificada pelo fiscal difere 15 pontos ou mais da indicada pelo empreiteiro.</p>
          <table class="rv-t"><thead><tr><th>Fração</th><th>Especialidade</th><th class="n">Fiscal</th><th class="n">Empreiteiro</th><th class="n">Diferença</th></tr></thead><tbody>
          ${atencao.map((l) => `<tr><td class="mono">${esc(nomeU(l.unidade))}</td><td>${esc(l.nome)}</td><td class="n"><b>${pctTxt(l.depois)}</b></td><td class="n">${pctTxt(l.emp)}</td><td class="n mau">${l.depois - l.emp > 0 ? "+" : ""}${l.depois - l.emp} pp</td></tr>`).join("")}
          </tbody></table>` : `<p class="rv-nota">Sem diferenças relevantes entre o fiscal e o empreiteiro.</p>`}
          <h3 class="rv-sub">Sem avanço desde a vistoria anterior</h3>
          ${parado.length ? `<p class="rv-nota">Especialidades por concluir que estão com a mesma percentagem (ou menos) do que na vistoria anterior, feita há 7 dias ou mais.</p>
          <table class="rv-t"><thead><tr><th>Fração</th><th>Especialidade</th><th class="n">Vistoria anterior</th><th class="n">Agora</th><th class="n">Parado há</th></tr></thead><tbody>
          ${parado.map((l) => `<tr><td class="mono">${esc(nomeU(l.unidade))}</td><td>${esc(l.nome)}${l.confirmado ? ` <span class="rv-conf">confirmado</span>` : ""}</td><td class="n">${pctTxt(l.prev.pct)} · ${fd(diaLocal(l.prev.em))}</td><td class="n"><b>${pctTxt(l.depois)}</b></td><td class="n aviso">${diasEntre(l.prev.em, l.regs[l.regs.length - 1].em)} dias</td></tr>`).join("")}
          </tbody></table>` : `<p class="rv-nota">Todas as especialidades com vistoria anterior avançaram (ou não tinham vistoria anterior).</p>`}
        </section>

        <section class="rv-sec"><h2>${++sec}. Assuntos pendentes</h2>
          ${pendRel.length ? `<p class="rv-nota">Todos os pontos por resolver em ${fd(dias[dias.length - 1], true)}, os mais recentes primeiro, com a data em que foram registados. Aparecem em todos os relatórios até serem fechados. O estado é o desse dia.</p>
            <table class="rv-t"><thead><tr><th>Registado</th><th>Fração</th><th>Pendente</th><th>Atividade</th><th>Estado</th><th>Ok do fiscal</th><th>Nestes dias</th></tr></thead><tbody>
            ${pendRel.map(({ x, e, ev }) => { const a = x.ativ ? S.acts[x.ativ] : null; const novo = noPer({ em: x.criadoEm || "" });
              return `<tr class="${e.estado === "aberto" ? "at" : ""}"><td class="num">${fd(diaLocal(x.criadoEm))}${novo ? `<small class="rv-novo">novo</small>` : ""}</td><td class="mono">${esc(nomeU(x.unidade))}</td>
                <td><b>${esc(x.texto)}</b><small>por ${esc(x.criadoNome || "")}</small></td><td>${a ? esc(nomeAtiv(a)) : `<span class="rv-vazio">fração em geral</span>`}</td>
                <td>${{ aberto: "Por resolver", feito: "Resolvido pelo empreiteiro, por verificar", fechado: "Fechado" }[e.estado]}</td><td>${e.fiscalOk ? `<span class="rv-conf">Confirmado</span>` : `<span class="aviso">Por confirmar</span>`}</td>
                <td>${ev.length ? ev.map((p) => `${fd(diaLocal(p.em))}: ${esc(p.nome || p.por)} ${PEND_ACAO[p.acao] || p.acao}${p.nota ? `: <i>${esc(p.nota)}</i>` : ""}`).join("<br>") : `<span class="rv-vazio">sem alterações</span>`}</td></tr>`; }).join("")}
            </tbody></table>` : `<p class="rv-nota">Não havia pendentes por resolver em ${fd(dias[dias.length - 1], true)}.</p>`}
        </section>

        <section class="rv-sec"><h2>${++sec}. Registo por fração</h2>
          <p class="rv-nota">"Vistoria anterior" é a última vistoria antes deste período; "Agora" é a percentagem verificada no fim do período; "Evolução" é a diferença entre as duas, em pontos percentuais (pp). Por baixo de cada especialidade estão as observações e as fotografias (Fn remete para o registo fotográfico).</p>
          ${ordemU.map((uid) => `<div class="rv-u"><h3><span class="mono">${esc(nomeU(uid))}</span><small>${esc(descU(uid))}</small></h3>
            <table class="rv-t"><thead><tr><th>Especialidade</th><th class="n">Vistoria anterior</th><th class="n">Agora</th><th class="n">Evolução</th><th class="n">Empreiteiro</th></tr></thead>
            ${porU.get(uid).map((l) => { const at = atencao.includes(l) ? "at" : "", refs = refsDe(l.ativ), notas = l.notas.map((t) => esc(t)).join(" · ");
              const obs = l.confirmado || notas || refs ? `<tr class="rv-obs ${at}"><td colspan="5">${l.confirmado ? `<span class="rv-conf">Confirmado sem alteração</span> ` : ""}${notas}${refs ? `<span class="rv-obs-f${notas ? " sep" : ""}">Fotos: ${refs}</span>` : ""}</td></tr>` : "";
              return `<tbody class="rv-esp${obs ? " com-obs" : ""}"><tr class="${at}"><td><b>${esc(l.nome)}</b>${l.a ? ` <button class="lnk-b no-print rv-fic" data-a="${l.a.id}">ficha</button>` : ""}</td>
              ${l.semDados && l.depois == null ? `<td colspan="4" class="rv-ant">${esc(l.texto || "")}</td>` : (() => {
                const base = l.prev && l.prev.pct != null ? l.prev.pct : null;
                const ev = base != null && l.depois != null ? l.depois - base : null;
                const evTxt = ev == null ? `<span class="rv-vazio">primeira</span>` : ev > 0 ? `<span class="bom">+${ev} pp</span><small>em ${diasEntre(l.prev.em, l.regs[l.regs.length - 1].em)} d</small>` : parado.includes(l) ? `<span class="aviso">sem avanço</span><small>${diasEntre(l.prev.em, l.regs[l.regs.length - 1].em)} d</small>` : ev < 0 ? `<span class="mau">${ev} pp</span>` : `<span>0 pp</span>`;
                return `<td class="n">${l.prev ? `${pctTxt(l.prev.pct)}<small>${fd(diaLocal(l.prev.em))}</small>` : `<span class="rv-vazio">sem vistoria</span>`}</td><td class="n"><b>${pctTxt(l.depois)}</b></td><td class="n rv-ev">${evTxt}</td><td class="n">${pctTxt(l.emp)}</td>`;
              })()}
              </tr>${obs}</tbody>`; }).join("")}
            </table></div>`).join("")}
        </section>

        ${fotos.length ? `<section class="rv-sec rv-fotos"><h2>${++sec}. Registo fotográfico</h2>
          <div class="rv-fg">${fotos.map((f, i) => { const l = linhas.find((x) => x.ativ === f.ativ); return `<figure id="rvf${f.num}"><button class="rv-img" data-rvi="${i}" aria-label="Ver a fotografia F${f.num} em grande"><img src="${f.data}" alt="F${f.num}: ${esc((l && l.nome) || "")} em ${esc(nomeU(f.unidade))}"></button>
            <figcaption><b>F${f.num}</b> · <span class="mono">${esc(nomeU(f.unidade))}</span> · ${esc((l && l.nome) || "")} · ${fd(diaLocal(f.em))} ${hora(f.em)}${f.nota ? `<br><span>${esc(f.nota)}</span>` : ""}</figcaption></figure>`; }).join("")}</div>
        </section>` : ""}

        <section class="rv-sec rv-ass"><h2>${++sec}. Validação</h2>
          <div class="rv-assg">
            <div><span>O fiscal</span><b>${esc(fiscais.join(", "))}</b><i></i><small>Assinatura e data</small></div>
            <div><span>Tomei conhecimento: o empreiteiro</span><b>&nbsp;</b><i></i><small>Assinatura e data</small></div>
          </div>
        </section>
        <footer class="rv-pe">${esc(ref)} · ${esc(S.cfg.nome || "Obra ALTIS")} · Relatório gerado pela aplicação de controlo de obra</footer>
      </article>`;
      bindCommon();
      box.querySelectorAll("[data-rvi]").forEach((b) => (b.onclick = () => abrirGaleria(fotos, +b.dataset.rvi)));
      document.title = ref + " · Relatório de vistoria";
    },
  };
}
