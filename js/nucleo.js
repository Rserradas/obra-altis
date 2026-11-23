// Arranque, versão, desenho principal da página e login.
import { CloudStore, DemoStore } from "../store.js";
import { abrirGuia, ajudaEcra } from "./ajuda.js";
import { $, ICON, PAPEL, VERSAO, VISTAS, avisoErroEscrita, can, erroSimples, esc, filtrosAlterados, guardarFiltros, instalarAnular, lerFiltros, mudarVista, reporFiltros, toast, ui, vistaSelHTML } from "./base.js";
import { compute } from "./calculo.js";
import { copiaView, equipaView, regrasView } from "./definicoes.js";
import { gruposView } from "./grupos.js";
import { equipasView, planEquipaView } from "./equipas.js";
import { S, importando, lastView, setImportando, setLastView, setStore, setVersaoNova, store, versaoNova } from "./estado.js";
import { closeSheet, renderSheet } from "./ficha.js";
import { ganttView } from "./gantt.js";
import { closeNova } from "./nova.js";
import { painelView } from "./painel.js";
import { pendentesView } from "./pendentes.js";
import { perguntar, planoView } from "./plano.js";
import { previsaoView } from "./previsao.js";
import { proximasView } from "./proximas.js";
import { segurarView } from "./segurar.js";
import { abrirPesquisaMovel, ligarPesquisa, pesquisaHTML, relatorioView, semanaView } from "./semana.js";
import { unidadeView, unidadesView } from "./unidades.js";
import { relVistView, vistoriasView } from "./vistorias.js";

/* ============================================================ arranque */
export async function boot() {
  const cfg = window.OBRA_CONFIG || {};
  let seed = null;
  try { seed = await (await fetch("seed.json")).json(); } catch (e) { console.warn("seed", e); }
  const cloud = cfg.firebase && cfg.firebase.apiKey;
  setStore(cloud ? new CloudStore(cfg, seed) : new DemoStore(seed));
  try { await store.init(); instalarAnular(store); } catch (e) {
    $("#app").innerHTML = `<div class="login"><div class="login-box"><h2>Não foi possível abrir a obra</h2><p class="err">${esc(e.message)}</p><p class="note">Verifique a configuração (config.js) e a ligação à internet.</p></div></div>`;
    return;
  }
  let pend = null;
  store.on((ev) => {
    if (ev === "sync") { renderSync(); return; }
    if (ev === "erroEscrita") { avisoErroEscrita(store.ultimoErro || {}); return; }
    clearTimeout(pend);
    pend = setTimeout(() => { compute(); render(); }, ev === "data" ? 60 : 0);
  });
  compute();
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { const i = document.querySelector("#psqD input"); if (i && i.offsetParent) { e.preventDefault(); i.focus(); } else if (S) { e.preventDefault(); abrirPesquisaMovel(); } }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest || !e.target.closest(".fpick")) document.querySelectorAll(".fmenu").forEach((m) => (m.hidden = true)); });
  document.addEventListener("click", (e) => { if (!e.target.closest || !e.target.closest("[data-maism],[data-mais]")) document.querySelectorAll("[data-maism]").forEach((m) => (m.hidden = true)); });
  window.addEventListener("hashchange", () => {
    if (ui.sheet) closeSheet();
    if (ui.nova) closeNova();
    document.querySelectorAll('[data-dw="fracao"],[data-dw="equipa"]').forEach((e) => e.remove());
    render(); window.scrollTo(0, 0);
  });
  render();
  if ("serviceWorker" in navigator && cloud) navigator.serviceWorker.register("sw.js").catch(() => {});
  // procura versões novas ao abrir, ao voltar à aplicação e de 15 em 15 minutos
  setTimeout(verificarVersao, 4000);
  setInterval(verificarVersao, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verificarVersao(); });
}

/* ============================================================ versão da aplicação */

/** Lê versao.json do servidor (sem cache). Devolve a versão publicada, ou null sem rede. */
export async function versaoPublicada() {
  try {
    const r = await fetch("versao.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.versao ? String(j.versao) : null;
  } catch (e) { return null; }
}
export async function verificarVersao() {
  const v = await versaoPublicada();
  if (v && v !== VERSAO) { setVersaoNova(v); mostrarAvisoVersao(); atualizarVerChips(); }
  return v;
}
export function mostrarAvisoVersao() {
  if (document.querySelector(".nova-versao")) return;
  const el = document.createElement("div");
  el.className = "nova-versao no-print"; el.setAttribute("role", "status");
  el.innerHTML = `<span><b>Há uma versão nova da aplicação.</b> Atualize para ter as últimas melhorias. O que já gravou não se perde.</span>
    <span class="row" style="gap:6px"><button class="btn sm pri" data-nv="sim">Atualizar agora</button><button class="btn sm ghost" data-nv="nao">Mais tarde</button></span>`;
  el.onclick = (e) => {
    const b = e.target.closest("[data-nv]"); if (!b) return;
    if (b.dataset.nv === "sim") atualizarApp(); else el.remove();
  };
  document.body.appendChild(el);
}
export async function atualizarApp() {
  const pend = store && store.sync && store.sync.pendentes;
  if (pend) { toast("Ainda há alterações a enviar. Espere que fique Sincronizado e tente outra vez.", { anular: false }); return; }
  try { const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()); if (reg) await reg.update(); } catch (e) {}
  location.reload();
}
export async function abrirAjuda() {
  const k = await perguntar({
    titulo: "Ajuda",
    texto: `<p>Em cada ecrã, o botão <b>?</b> ao lado do título explica para que serve esse ecrã.</p>
      <p>O guia rápido mostra, em poucos passos, o essencial para o seu perfil.</p>
      <p class="note" id="ajVer">Está a usar a versão <b>${esc(VERSAO)}</b>.${versaoNova ? ` Já existe a versão ${esc(versaoNova)}.` : ""}</p>`,
    opcoes: [{ k: "guia", l: "Ver o guia rápido", estilo: "pri" }, { k: "ver", l: versaoNova ? "Atualizar agora" : "Procurar atualização" }, { k: "nao", l: "Fechar" }],
  });
  if (k === "guia") abrirGuia(true);
  else if (k === "ver") {
    if (versaoNova) return atualizarApp();
    const v = await verificarVersao();
    if (!v) toast("Não foi possível confirmar a versão. Verifique a ligação à internet.", { anular: false });
    else if (v === VERSAO) toast(`Já tem a versão mais recente (${VERSAO}).`, { anular: false });
  }
}
export async function sairConfirmar() {
  const pend = store.sync && store.sync.pendentes;
  const k = await perguntar({
    titulo: "Sair da aplicação?",
    texto: pend ? `<div class="dlg-av">Ainda há alterações por enviar. Se sair agora, podem perder-se. Espere que fique Sincronizado.</div>` : `<p>Para voltar a entrar precisa do seu email e palavra-passe.</p>`,
    opcoes: [{ k: "sim", l: "Sim, sair", estilo: "warn" }, { k: "nao", l: "Cancelar" }],
  });
  if (k === "sim") store.logout();
}

/* ============================================================ render principal */

export function render() {
  const app = $("#app");
  if (!location.hash.startsWith("#relvist")) document.title = "Controlo de Obra ALTIS";
  if (store.needsLogin()) { app.innerHTML = loginHTML(); bindLogin(); setLastView("login"); return; }
  if (store.user.papel === "sem_acesso") {
    app.innerHTML = `<div class="login"><div class="login-box"><h2>Conta sem acesso</h2><p>A conta <b>${esc(store.user.email)}</b> entrou, mas ainda não tem perfil nesta obra. Peça ao dono de obra para o adicionar em Equipa.</p><button class="btn" id="sair">Sair</button></div></div>`;
    $("#sair").onclick = () => store.logout();
    return;
  }
  if (store.admin && !store.user.papel) {
    app.innerHTML = `<div class="login"><div class="login-box">
      <div class="brand"><div class="brand-mark">AL</div><div><b>Olá, ${esc(store.user.nome)}</b><span>Administrador</span></div></div>
      <p>Escolha como quer ver a aplicação. Vê exatamente os ecrãs e os botões que esse perfil vê. Pode mudar de vista a qualquer momento, em "Ver como".</p>
      <div class="roles">${VISTAS.map(([k, l, d]) => `<button data-vista="${k}"><b>${l}</b><span>${d}</span></button>`).join("")}</div>
      <button class="btn ghost sm" id="sair">Sair</button></div></div>`;
    app.querySelectorAll("[data-vista]").forEach((b) => (b.onclick = () => mudarVista(b.dataset.vista)));
    $("#sair").onclick = () => store.logout();
    setLastView("vista");
    return;
  }
  lerFiltros();
  const view = routeView();
  guardarFiltros();
  const nav = navItems();
  const scrollY = window.scrollY;
  const same = lastView === location.hash;
  app.innerHTML = `
  <div class="shell">
    <aside class="side">
      ${brandHTML()}
      ${pesquisaHTML("psqD")}
      <nav class="nav">${nav.map((n) => `<a href="#${n.id}" class="${view.nav === n.id ? "on" : ""}">${ICON[n.id]}<span>${n.label}</span></a>`).join("")}</nav>
      <div class="side-foot">
        <div id="syncA"></div>
        <div class="who"><b>${esc(store.user.nome)}</b><span class="role">${store.admin ? "Administrador" : PAPEL[store.user.papel]}</span></div>
        ${store.admin ? vistaSelHTML("vistaD") : ""}
        <button class="btn sm" data-ajuda>Ajuda e versão</button>
        <button class="btn sm ${filtrosAlterados() ? "repor-on" : ""}" data-repor title="Voltar todos os ecrãs aos filtros padrão">Limpar filtros</button>
        <button class="btn sm" data-sair>Sair</button>
      </div>
    </aside>
    ${store.admin ? `<div class="vista-band">A ver como <b>${PAPEL[store.user.papel]}</b>${vistaSelHTML("vistaM")}</div>` : ""}
    <header class="topbar">${brandHTML(true)}<div class="row" style="gap:4px"><div id="syncB"></div><button class="btn sm repor-on" data-repor data-repor-top title="Há filtros ativos: limpar" ${filtrosAlterados() ? "" : "hidden"}>Limpar filtros</button><button class="btn sm ghost" data-psqm aria-label="Procurar" title="Procurar">${ICON.lupa}</button><button class="btn sm ghost" data-ajuda aria-label="Ajuda" title="Ajuda">?</button><button class="btn sm ghost" data-sair>Sair</button></div></header>
    <main class="main"><div class="main-in" id="view">${view.html}</div></main>
    <nav class="tabbar">${nav.filter((n) => !n.soLado).map((n) => `<a href="#${n.id}" class="${view.nav === n.id ? "on" : ""}">${ICON[n.id]}<span>${n.short || n.label}</span></a>`).join("")}${nav.some((n) => n.soLado) ? `<button type="button" class="tb-mais ${nav.some((n) => n.soLado && view.nav === n.id) ? "on" : ""}" data-mais aria-haspopup="menu" aria-expanded="false">${ICON.mais}<span>Mais</span></button>` : ""}</nav>
    ${nav.some((n) => n.soLado) ? `<div class="mais-m" hidden role="menu" data-maism>${nav.filter((n) => n.soLado).map((n) => `<a href="#${n.id}" role="menuitem" class="${view.nav === n.id ? "on" : ""}">${ICON[n.id]}<span>${n.label}</span></a>`).join("")}</div>` : ""}
  </div>`;
  app.querySelectorAll("[data-sair]").forEach((b) => (b.onclick = sairConfirmar));
  const bm = app.querySelector("[data-mais]"), mm = app.querySelector("[data-maism]");
  if (bm && mm) {
    bm.onclick = (e) => { e.stopPropagation(); mm.hidden = !mm.hidden; bm.setAttribute("aria-expanded", String(!mm.hidden)); };
    mm.querySelectorAll("a").forEach((a) => (a.onclick = () => { mm.hidden = true; }));
  }
  ["#vistaD", "#vistaM"].forEach((id) => { const sl = $(id); if (sl) sl.onchange = () => mudarVista(sl.value); });
  app.querySelectorAll("[data-repor]").forEach((b) => (b.onclick = reporFiltros));
  app.querySelectorAll("[data-ajuda]").forEach((b) => (b.onclick = abrirAjuda));
  app.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = abrirNovidades));
  const pd = $("#psqD"); if (pd && S) ligarPesquisa(pd);
  app.querySelectorAll("[data-psqm]").forEach((b) => (b.onclick = abrirPesquisaMovel));
  renderSync();
  ajudaEcra();
  view.bind && view.bind();
  if (S) abrirGuia(false);
  if (ui.sheet) {
    const ae = document.activeElement;
    const busy = ae && ae.closest && ae.closest(".sheet") && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
    if (!busy) renderSheet();
    else if (ae.matches("[data-ed]")) {
      // num campo de data (por exemplo, passou do início para o fim com Tab): a ficha atualiza-se na mesma e o cursor volta ao mesmo campo,
      // para nunca ficar a mostrar datas e durações antigas que depois seriam gravadas por engano
      const k = ae.dataset.ed, v = ae.value, mexido = v !== ae.defaultValue;
      renderSheet();
      const n = document.querySelector(`aside[data-dw="ativ"] [data-ed="${k}"]`);
      if (n) { if (mexido) n.value = v; n.focus({ preventScroll: true }); }
    }
  }
  if (same) window.scrollTo(0, scrollY);
  setLastView(location.hash);
}
export function renderSync() {
  const s = store.sync;
  const cls = store.modo === "demo" ? "demo" : !s.online ? "off" : s.pendentes ? "pend" : "";
  const txt = store.modo === "demo" ? "Demonstração: dados só neste dispositivo" : s.texto;
  const curto = store.modo === "demo" ? "Demonstração" : !s.online ? "Sem rede" : s.pendentes ? "A enviar" : "Sincronizado";
  const a = $("#syncA"), b = $("#syncB");
  if (a) a.innerHTML = `<span class="sync ${cls}"><i></i>${esc(txt)}</span>`;
  if (b) b.innerHTML = `<span class="sync ${cls}" title="${esc(txt)}"><i></i><span class="sync-t">${esc(curto)}</span></span>`;
}
export function brandHTML(compact) {
  const nome = (S && S.cfg.nome) || "Obra";
  return `<div class="brand"><div class="brand-mark">${esc(nome.slice(0, 2).toUpperCase())}</div><div><b>${esc(nome)}</b>${compact ? "" : `<span>Controlo de obra</span>`}${verChipHTML()}</div></div>`;
}
/** A versão está sempre à vista. Se houver uma mais recente, o botão diz para atualizar. */
export function verChipHTML() {
  return versaoNova
    ? `<button type="button" class="verchip nova" data-ver title="Há uma versão nova: ${esc(versaoNova)}">Versão ${esc(VERSAO)} · atualizar</button>`
    : `<button type="button" class="verchip" data-ver title="Ver o que mudou nesta versão">Versão ${esc(VERSAO)}</button>`;
}
export function atualizarVerChips() { document.querySelectorAll("[data-ver]").forEach((b) => { b.outerHTML = verChipHTML(); }); document.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = abrirNovidades)); }
/* O que mudou em cada versão (as mais recentes primeiro). */
/** Chave para ordenar versões: "14.11.2026 V2" vira "20261114-002"; as antigas (2026.11.17) ficam antes. */
export function chaveVersao(v) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s*V(\d+)$/i.exec(String(v || "").trim());
  if (!m) return "0-" + v;
  return `${m[3]}${m[2].padStart(2, "0")}${m[1].padStart(2, "0")}-${m[4].padStart(3, "0")}`;
}
export const NOVIDADES = [
  ["23.11.2026 V3", ["Folha da semana: cada linha ficou mais curta, sem a descrição, as observações e a referência."]],
  ["23.11.2026 V2", ["Minha semana, novo separador Folha da semana: as atividades da semana agrupadas por bloco e andar, grupo e atividade, com a percentagem do empreiteiro e do fiscal, as datas, a equipa, os impedimentos e as observações. Pode mudar o estado e a percentagem e gravar tudo com Guardar, e imprimir ou guardar em PDF, com colunas em branco para preencher em obra.", "Minha semana: Escolher várias para marcar atividades e iniciá-las ou concluí-las de uma vez, com data de início e de fim.", "Minha semana: botão Tirar filtros quando há filtros ligados.", "Ponto de situação: tocar no nome da atividade abre a ficha."]],
  ["23.11.2026 V1", ["Relatório de vistoria: logo no início aparecem os apartamentos vistoriados e um gráfico com a percentagem de acabamento de cada um, comparada com a média da obra.", "No registo de cada apartamento há agora um Gantt com todas as atividades, a cor do estado, a percentagem feita, a previsão e a linha de hoje. As atividades vistoriadas nesse relatório ficam a negrito."]],
  ["22.11.2026 V1", ["Próximas semanas: novo ecrã para o empreiteiro planear as semanas seguintes. Mostra os trabalhos que começam em cada semana e se estão prontos, à espera de outro trabalho ou com impedimentos (sem equipa, pendentes por resolver, material, projeto, aprovação e outros). Pode marcar impedimentos num trabalho ou num grupo de uma vez, resolvê-los e editá-los, e confirmar as datas.", "Os impedimentos também aparecem na ficha da atividade e na Minha semana.", "Apartamentos e lojas, Ponto de situação: cada atividade tem o botão da câmara para tirar ou escolher fotografias, com nota opcional. Ficam na galeria da fração, ligadas à atividade, e gravam com o Guardar."]],
  ["19.11.2026 V2", ["A minha semana: as linhas são mais finas e cabem quase o dobro das atividades no ecrã. A equipa aparece na mesma linha do nome. No telemóvel cada atividade ocupa duas filas, com os botões ao lado da percentagem."]],
  ["19.11.2026 V1", ["A minha semana: três avisos novos, Atrasadas para começar, Começam hoje e Acabam hoje, com o que já devia estar marcado e ainda não está. Quando têm atividades ficam vermelhos e a piscar; toque num para ver a lista, com Iniciar e Concluir. As atividades que nunca tiveram data não entram.", "Definições, Grupos: grupos de especialidades, como Carpintaria, Pintura ou Eletricidade. A aplicação propõe os grupos a partir dos nomes e pode corrigi-los: tirar, juntar, mudar o nome, criar ou apagar. Uma especialidade pode estar em vários grupos.", "Filtro Grupo nos Trabalhos, na Minha semana, no Gantt e no Relatório para reunião (a tabela descarregada também sai só com o grupo escolhido)."]],
  ["18.11.2026 V4", ["Apartamentos e lojas: novo separador Ponto de situação para o empreiteiro, que abre logo ao entrar na fração. Em cada atividade carrega em Não iniciada, Em curso (com a percentagem, como na vistoria) ou Concluída, e no fim carrega em Guardar, que grava tudo de uma vez e deixa anular.", "O botão da fração seguinte passa ao apartamento ao lado, também no Ponto de situação, e pergunta antes se houver alterações por guardar."]],
  ["18.11.2026 V3", ["A minha semana: em Para começar, além de Iniciar, há o botão Concluir. Pede confirmação, diz que início real fica registado e deixa anular.", "Apartamentos e lojas: o dono de obra tem o botão Eliminar várias, para escolher as atividades da fração e eliminá-las de uma vez. Pede confirmação com a lista e deixa anular logo a seguir."]],
  ["18.11.2026 V2", ["Ficha da atividade: depois de mudar a previsão de início, a ficha mostra logo o fim e a duração novos, mesmo que já esteja noutro campo de data. O botão Guardar só grava o que mudou de facto e nunca volta a pôr uma duração antiga.", "Sequência dos trabalhos: saem os números e as setas. A lista ordena-se sozinha pelas condições (cada especialidade aparece depois daquelas de que depende) e essa ordem passa a valer também no Gantt, nos Trabalhos e nos apartamentos. Para mudar a ordem, mude as condições."]],
  ["18.11.2026 V1", ["Plano das equipas: botão Editar datas na fila de cada equipa. Todas as datas da fila ficam editáveis, muda as que quiser e carrega em Gravar, que grava tudo de uma vez e deixa anular. Se mudar só o início, o trabalho mantém os dias que tinha; se mudar o fim, muda a duração. No fim a aplicação avisa os trabalhos que ficaram mais tarde do que escreveu e diz porquê."]],
  ["16.11.2026 V3", ["Relatórios de vistoria: todas as pessoas veem à partida as vistorias de todos os fiscais, sem mudar a vista. O filtro Fiscal volta a Todos ao mudar de vista ou em Limpar filtros.", "Relatório de vistoria: as fotografias aparecem logo por baixo da especialidade vistoriada, duas por linha, em vez de ficarem todas no fim.", "Plano das equipas: cada trabalho da fila ocupa uma só linha; Ao mesmo tempo que o de cima passa a ser a caixa Junto.", "Os textos de explicação dos ecrãs usam a largura toda.", "Procurar: em todas as caixas pode escrever várias palavras (por exemplo B-F203 carpintaria) e o código da fração pode ir sem hífen (BF203)."]],
  ["16.11.2026 V2", ["Sequência das atividades: se escrever um número que já é de outra especialidade, pode pô-las a começar ao mesmo tempo. Ficam com o mesmo número e as mesmas condições, e a aplicação mostra antes o que muda.", "Datas: uma atividade já concluída deixa de empurrar a data de início que escrever na seguinte. Recalcular o início também deixa de contar com as concluídas.", "Relatório de vistoria, Registo por fração: as observações e as fotografias ficam numa linha por baixo de cada especialidade, a data da correção deixa de aparecer e Confirmado sem alteração ocupa uma só linha."]],
  ["16.11.2026 V1", ["Plano das equipas: os trabalhos marcados Ao mesmo tempo que o de cima começam no mesmo dia que o primeiro do grupo, mesmo que a data prevista deles fosse mais tarde. Só começam depois se algo da fração os impedir, e a fila diz o quê.", "Sequência das atividades e fila das equipas: além de arrastar e das setas, pode escrever a posição na caixa do número e carregar em Enter."]],
  ["14.11.2026 V4", ["Plano das equipas: filtros por bloco, fração, trabalho e estado; frentes (quantos trabalhos a equipa faz ao mesmo tempo) e a opção Ao mesmo tempo que o de cima em cada linha da fila.", "Trabalhos: Recalcular o início de várias atividades de uma vez, na escolha em massa.", "Relatórios de vistoria: o fiscal elimina os seus e o dono de obra qualquer um, com Anular.", "Pendentes: novo pendente para uma ou várias frações, zonas comuns ou geral; filtros; blocos e frações que abrem e fecham; editar um pendente.", "Andares modelo (B-F103, B-F104, B-F105) assinalados nos ecrãs, com filtro nos Apartamentos.", "Por dentro: o código da aplicação foi organizado em vários ficheiros, sem mudar o que a aplicação faz."]],
  ["14.11.2026 V3", ["O que está a segurar a obra: no Painel e num ecrã próprio, os trabalhos atrasados que mais atrasam o fim da obra, de cada bloco e de cada fração, com o efeito de cada um e um resumo por equipa. Também no relatório para reunião.", "Vistoria: o fiscal pode corrigir a vistoria de um dia anterior (por exemplo, uma percentagem esquecida). A correção fica nesse dia e no relatório desse dia, sem criar uma vistoria nova."]],
  ["14.11.2026 V2", ["Sequência: secções próprias para as zonas comuns e para os trabalhos gerais, com dias e condições como nos apartamentos.", "Ficha da atividade: botão Recalcular o início, que põe o início logo a seguir às atividades de que depende, mantendo o prazo.", "O número da versão passa a ser o dia da publicação e a versão desse dia, por exemplo 14.11.2026 V2."]],
  ["14.11.2026 V1", ["Definições, Cópia de segurança: todas as pessoas podem descarregar uma cópia com tudo o que está registado e repor a partir dela (os acessos só o dono de obra repõe).", "A versão da aplicação está sempre à vista; ao tocar nela vê o que mudou.", "Ficha da atividade: aparece um botão Guardar no canto sempre que há alguma coisa por guardar, e a aplicação avisa se fechar sem guardar.", "Botão Recalcular o fim: na ficha, ao lado da previsão de fim, e na escolha em massa dos Trabalhos. Repõe o fim com a duração normal.", "Trabalhos: a caixa de escolha em massa está arrumada em três grupos: Equipa, Execução e Previsão."]],
  ["13.11.2026 V4", ["Gantt: filtros por várias atividades, estado, equipa, tipo de fração, procura e período.", "Trabalhos: a lista vem ordenada pela sequência das atividades e depois por fração.", "Trabalhos: botão Terminar escolha também dentro da caixa de escolha."]],
  ["13.11.2026 V3", ["Trabalhos: anular o início real de várias atividades de uma vez.", "Trabalhos: procurar dentro da caixa de escolha, com várias palavras e sem ligar a acentos."]],
  ["13.11.2026 V2", ["Trabalhos: mudar a previsão de início e de fim de várias atividades de uma vez."]],
  ["13.11.2026 V1", ["Gantt: ecrã inteiro, imprimir só o gráfico e caminho crítico da obra ou do bloco."]],
];
export async function abrirNovidades() {
  const lista = NOVIDADES.filter(([v]) => chaveVersao(v) <= chaveVersao(VERSAO)).slice(0, 3);
  const k = await perguntar({
    titulo: `Versão ${VERSAO}`,
    texto: `${versaoNova ? `<div class="dlg-av">Já existe a versão ${esc(versaoNova)}. Atualize para ter as últimas melhorias. O que já gravou não se perde.</div>` : ""}
      ${lista.length ? lista.map(([v, it], i) => `<h3 style="margin:${i ? "14px" : "4px"} 0 6px;font-size:1rem">${i ? "Versão " + esc(v) : "O que mudou nesta versão"}</h3><ul class="dlg-l">${it.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`).join("") : `<p>Sem notas para esta versão.</p>`}`,
    opcoes: [{ k: "ver", l: versaoNova ? "Atualizar agora" : "Procurar atualização", estilo: versaoNova ? "pri" : "" }, { k: "nao", l: "Fechar" }],
  });
  if (k === "ver") {
    if (versaoNova) return atualizarApp();
    const v = await verificarVersao();
    if (!v) toast("Não foi possível confirmar a versão. Verifique a ligação à internet.", { anular: false });
    else if (v === VERSAO) toast(`Já tem a versão mais recente (${VERSAO}).`, { anular: false });
  }
}
export function navItems() {
  const p = store.user.papel;
  const items = [
    { id: "painel", label: "Painel" },
    { id: "unidades", label: "Apartamentos", short: "Apartamentos" },
    { id: "plano", label: "Trabalhos", short: "Trabalhos" },
    { id: "regras", label: "Definições", short: "Definições" },
    { id: "gantt", label: "Gantt", short: "Gantt" },
  ];
  const vist = { id: "vistorias", label: "Relatórios de vistoria", short: "Relatórios" };
  const pend = { id: "pendentes", label: "Pendentes", short: "Pendentes" };
  const prev = { id: "previsao", label: "Fim da obra", short: "Fim" };
  const prox = { id: "proximas", label: "Próximas semanas", short: "Próximas" };
  if (p === "empreiteiro") return [{ id: "semana", label: "A minha semana", short: "Semana" }, prox, pend, items[2], items[1], { ...items[4], soLado: true }, { ...items[0], soLado: true }, { ...prev, soLado: true }, { ...vist, soLado: true }, { ...items[3], soLado: true }];
  if (p === "fiscal") return [items[1], pend, vist, items[0], items[2], { ...prox, soLado: true }, { ...prev, soLado: true }, { ...items[4], soLado: true }, { ...items[3], soLado: true }];
  return [items[0], prev, items[1], items[2], { ...prox, soLado: true }, { ...pend, soLado: true }, { ...items[4], soLado: true }, { ...vist, soLado: true }, items[3]];
}
export function routeView() {
  let h = location.hash.replace("#", "");
  if (!S) return { nav: "", html: semConfigHTML(), bind: bindSemConfig };
  if (!h) h = navItems()[0].id;
  if (h.startsWith("u-")) {
    const uid = h.slice(2);
    if (ui.lastUnit !== uid) { ui.lastUnit = uid; ui.unidadeTab = store.user.papel === "fiscal" ? "vist" : store.user.papel === "empreiteiro" ? "sit" : "ativ"; }
    return { nav: "unidades", ...unidadeView(uid) };
  }
  if (h === "equipa" && store.user.papel !== "dono") h = "painel";
  if (h === "equipas" && !can("executar")) h = "painel";
  const v = { pendentes: pendentesView, painel: painelView, unidades: unidadesView, plano: planoView, regras: regrasView, equipa: equipaView, copia: copiaView, equipas: equipasView, gantt: ganttView, semana: semanaView, relatorio: relatorioView, vistorias: vistoriasView, relvist: relVistView, previsao: previsaoView, proximas: proximasView, planequipa: planEquipaView, segurar: segurarView, grupos: gruposView }[h] || painelView;
  if (h === "planequipa" && !can("executar")) h = "painel";
  const navDe = { equipa: "regras", copia: "regras", grupos: "regras", equipas: "regras", planequipa: "regras", relatorio: "painel", relvist: "vistorias", segurar: "painel" };
  return { nav: navDe[h] || (h in { painel: 1, unidades: 1, plano: 1, regras: 1, gantt: 1, semana: 1, vistorias: 1, previsao: 1, pendentes: 1, proximas: 1 } ? h : "painel"), ...v() };
}

/* ============================================================ login */
export function loginHTML() {
  const nome = "ALTIS";
  if (store.modo === "demo") {
    return `<div class="login"><div class="login-box">
      <div class="brand"><div class="brand-mark">${nome.slice(0, 2)}</div><div><b>Controlo de obra ${nome}</b><span>Versão de demonstração</span></div></div>
      <p>Esta versão usa os dados reais do cronograma, mas guarda as alterações só neste dispositivo. Escolha um perfil para experimentar:</p>
      <div class="roles">
        <button data-p="admin"><b>Administrador</b><span>Escolhe a vista: dono de obra, empreiteiro ou fiscal, para ver o que cada um pode fazer</span></button>
        <button data-p="dono"><b>Dono de obra</b><span>Ponto de situação, mapa dos apartamentos, sequência e equipa</span></button>
        <button data-p="empreiteiro"><b>Empreiteiro</b><span>Trabalhos, iniciar e concluir, reportar atrasos</span></button>
        <button data-p="fiscal"><b>Fiscal</b><span>Vistoria apartamento a apartamento, com percentagem e fotografias</span></button>
      </div>
    </div></div>`;
  }
  return `<div class="login"><form class="login-box" id="lf">
    <div class="brand"><div class="brand-mark">${nome.slice(0, 2)}</div><div><b>Controlo de obra ${nome}</b><span>Entre com a sua conta</span></div></div>
    <label class="f">Email<input class="inp" id="le" type="email" autocomplete="username" required></label>
    <label class="f">Palavra-passe<input class="inp" id="lp" type="password" autocomplete="current-password" required></label>
    <div class="err" id="lerr"></div>
    <button class="btn pri" type="submit">Entrar</button>
    <button class="btn ghost sm" type="button" id="lreset">Esqueci-me da palavra-passe</button>
  </form></div>`;
}
export function bindLogin() {
  if (store.modo === "demo") {
    document.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { location.hash = ""; store.loginDemo(b.dataset.p); }));
    return;
  }
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    $("#lerr").textContent = "";
    try { await store.login($("#le").value, $("#lp").value); location.hash = ""; }
    catch (err) { $("#lerr").textContent = err.code === "auth/network-request-failed" ? "Sem rede. O primeiro acesso precisa de internet." : "Email ou palavra-passe errados."; }
  };
  $("#lreset").onclick = async () => {
    const em = $("#le").value;
    if (!em) { $("#lerr").textContent = "Escreva primeiro o seu email."; return; }
    try { await store.resetSenha(em); $("#lerr").textContent = "Enviámos um email para definir nova palavra-passe."; } catch (e) { $("#lerr").textContent = "Não foi possível enviar o email."; }
  };
}
export function semConfigHTML() {
  const dono = store.user.papel === "dono";
  return `<div class="card" style="max-width:640px">
    <h1>A obra ainda não tem dados</h1>
    ${dono ? `<p>Importe o cronograma (${store.seed ? store.seed.atividades.length : 0} atividades, ${store.seed ? store.seed.unidades.length : 0} frações e zonas). Só é preciso fazer isto uma vez.</p>
      <div class="row"><button class="btn pri" id="imp">Importar cronograma</button><span class="note" id="impst"></span></div>`
      : `<p>O dono de obra ainda não importou o cronograma. Volte a abrir a aplicação mais tarde.</p>`}
  </div>`;
}
export function bindSemConfig() {
  const b = $("#imp");
  if (!b) return;
  b.onclick = async () => {
    b.disabled = true;
    await importarComProgresso(false, () => { b.disabled = false; });
  };
}

/** Importa (ou completa) o cronograma, com uma barra fixa que não depende do ecrã aberto. */

export async function importarComProgresso(soFaltam, aoFalhar) {
  if (importando) return;
  setImportando(true);
  document.querySelectorAll(".impbar").forEach((x) => x.remove());
  const bar = document.createElement("div");
  bar.className = "impbar"; bar.setAttribute("role", "status");
  bar.innerHTML = `<b>A importar o cronograma...</b> <span class="num">0</span><span class="note">Não feche esta página até terminar.</span>`;
  document.body.appendChild(bar);
  const num = bar.querySelector(".num");
  try {
    const n = await store.importSeed((i, t) => (num.textContent = `${i} de ${t}`), { soFaltam });
    bar.remove();
    toast(soFaltam ? `Importação completa: acrescentados ${n} trabalhos` : "Cronograma importado");
  } catch (e) {
    bar.innerHTML = `<b>A importação parou:</b> ${esc(erroSimples(e))}. O que já entrou fica guardado e pode completar depois. <button class="btn sm" id="impFecha">Fechar</button>`;
    bar.querySelector("#impFecha").onclick = () => bar.remove();
    if (aoFalhar) aoFalhar();
  } finally { setImportando(false); render(); }
}
