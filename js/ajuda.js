// Ajuda de cada ecrã e guia de primeira utilização.
import { PAPEL, esc, ui } from "./base.js";
import { S, store } from "./estado.js";
import { navItems } from "./nucleo.js";

/* ============================================================ ajuda de cada ecrã (o "?" ao lado do título) */
export const AJUDA_ECRA = {
  painel: "O ponto de situação da obra: o fim previsto, o que está atrasado e o avanço de cada bloco. Em Precisa de atenção estão as atividades que convém tratar primeiro, com atalhos para as resolver logo.",
  segurar: "Os trabalhos atrasados que mais seguram o fim da obra. Para cada um, a aplicação simula que estava em dia e mostra quantos dias o fim da obra, de cada bloco e de cada fração andava para trás. Escolha um bloco para ver o que segura esse bloco, e toque numa equipa para ver só os trabalhos dela. Um trabalho atrasado que não aparece tem folga: o atraso dele não mexe em nenhum fim.",
  previsao: "Quando cada bloco e cada apartamento ficam prontos. As datas recalculam-se todos os dias com o estado real das atividades. Toque num apartamento para ver o que ainda falta.",
  unidades: "Todos os apartamentos, lojas e zonas comuns, com o avanço de cada um. Toque num para ver as atividades, fazer a vistoria ou ver as fotografias.",
  fracao: "As atividades desta fração, pela ordem da obra. Em Ponto de situação, o empreiteiro diz de cada atividade se não está iniciada, em curso (com a percentagem) ou concluída, e grava tudo de uma vez; com o botão da fração seguinte passa ao apartamento ao lado. Em Atividades, toque numa atividade para abrir a ficha. Com Editar datas muda as datas e a percentagem na lista. O dono de obra, com Eliminar várias, escolhe as atividades a tirar desta fração e elimina-as de uma vez (pode Anular logo a seguir). Em Pendentes estão os pontos por resolver: o empreiteiro marca como resolvido e o fiscal verifica. Na Vistoria, em Dia da vistoria, pode corrigir a vistoria de um dia anterior (por exemplo, uma percentagem esquecida): a correção fica nesse dia e no relatório desse dia.",
  plano: "Todas as atividades da obra, com filtros por bloco, fração, atividade e estado. Os filtros ficam guardados até carregar em Limpar filtros. Com Concluir ou atribuir várias trata várias atividades de uma vez.",
  gantt: "As atividades no tempo, em barras. Arraste uma barra para mudar as datas: as atividades seguintes acertam-se sozinhas. Uma atividade já concluída não empurra a data de início que escrever na seguinte. O botão Hoje leva-o ao dia de hoje.",
  semana: "O que está em curso, o que deve começar nos próximos 7 dias e o que está à espera de outras atividades. Os botões Iniciar e +10% gravam logo. Concluir pede confirmação e também aparece em Para começar, para dar como feita uma atividade que nunca foi iniciada na aplicação. Os três botões de cima avisam o que já devia estar marcado: Atrasadas para começar, Começam hoje e Acabam hoje. Quando têm atividades ficam vermelhos e a piscar; toque num para ver a lista. As que nunca tiveram data (Datas por confirmar) não entram. O filtro Grupo mostra só um ofício, como Carpintaria ou Pintura. Escolher várias: marque atividades de qualquer lista e fração, escolha em baixo a data de início e a de fim e carregue em Iniciar (usa a data de início) ou Concluir (usa a data de fim e, nas que ainda não tinham começado, a de início). Tudo tem Anular. No separador Folha da semana estão as mesmas atividades agrupadas por bloco e andar, grupo e atividade, com a percentagem, a do fiscal, as datas, a equipa, os impedimentos e as observações de cada fração. Pode mudar o estado e a percentagem e gravar tudo com Guardar, e imprimir ou guardar em PDF: no papel saem colunas em branco para a percentagem vista em obra e notas.",
  proximas: "Os trabalhos que começam em cada uma das próximas semanas, agrupados por especialidade, equipa ou fração, e o que ainda os pode impedir. Verde: pronto a arrancar (anteriores concluídas, com equipa e sem impedimentos). Roxo: depende de outras que ainda não acabaram; a vermelho se essa anterior estiver atrasada. Vermelho: tem impedimentos, falta equipa ou há pendentes por resolver. Em + Impedimento regista o que falta (material, frente, projeto, aprovação, mão de obra), com prazo e quem resolve; em + Impedimento a todos põe o mesmo em todos os trabalhos do grupo. Toque num impedimento para o dar como resolvido, editar ou apagar. Em cima ficam todos os impedimentos em aberto, pelo prazo, para tratar na reunião semanal. Data por confirmar quer dizer que o trabalho nunca teve data: toque para confirmar a que a aplicação calculou.",
  regras: "A sequência entre especialidades e os dias que cada uma leva por fração. Uma mudança aqui acerta as datas de todas as atividades que ainda não começaram. A lista ordena-se sozinha pela sequência: cada especialidade aparece depois daquelas de que depende. Para mudar a ordem, mude as condições na coluna Só começa depois de. Para duas especialidades começarem ao mesmo tempo, dê-lhes as mesmas condições. Tocar no título de uma coluna ordena a lista só para ver.",
  grupos: "Grupos de especialidades, como Carpintaria ou Pintura, para filtrar tudo o que tem a ver com um ofício nos Trabalhos, na Minha semana, no Gantt e no Ponto de situação. Ao início vale a proposta da aplicação, feita a partir dos nomes. Para corrigir: toque no × para tirar uma especialidade, use Juntar para acrescentar, mude o nome na caixa de cima ou crie um grupo novo. Uma especialidade pode estar em vários grupos.",
  equipas: "As equipas de trabalho da obra, com o que cada uma pode fazer. Abra uma equipa para ver os seus trabalhos, editar os dados ou tirá-la da obra.",
  planequipa: "A ordem em que cada equipa vai fazer os seus trabalhos. Para mudar a ordem, arraste, use as setas ou escreva o lugar na caixa do número e carregue em Enter. Por defeito, uma equipa faz um trabalho de cada vez, por isso a ordem mexe nas datas. Em Frentes diz quantos trabalhos a equipa faz ao mesmo tempo, e em cada linha pode marcar Junto, para a equipa fazer esse trabalho ao mesmo tempo que o de cima (por exemplo, a mesma pintura em vários apartamentos). Com Editar datas, todas as datas da fila ficam editáveis: mude as que quiser e carregue em Gravar, que grava tudo de uma vez (e pode Anular). Os filtros mostram só parte da fila; o resumo de cima é sempre da fila toda.",
  equipa: "As contas de quem usa a aplicação e o perfil de cada uma. O perfil define o que cada pessoa pode ver e fazer.",
  vistorias: "As vistorias guardadas pelo fiscal, dia a dia. Escolha os dias para ver o relatório, imprimi-lo ou guardá-lo em PDF. O fiscal pode eliminar os seus relatórios e o dono de obra qualquer um; as percentagens das atividades ficam como estão.",
  relatorio: "Um resumo da obra para levar à reunião. Pode imprimir ou guardar em PDF. Com o filtro Grupo o resumo conta só as atividades desse grupo, por exemplo só a Carpintaria.",
  pendentes: "Todos os pendentes da obra, por bloco e por fração. Toque num bloco ou numa fração para abrir ou fechar. Em + Novo pendente escreve o pendente e escolhe onde fica: uma ou várias frações, as zonas comuns ou o geral, e se quiser a atividade. O empreiteiro marca aqui o que já resolveu; o fiscal verifica na vistoria e carrega em Concluído?.",
};
export function ajudaEcra() {
  let h = location.hash.replace("#", "").split("?")[0];
  if (!h && S) h = navItems()[0].id;
  const k = h.startsWith("u-") ? "fracao" : h;
  const txt = AJUDA_ECRA[k];
  const h1 = document.querySelector("#view h1");
  if (!txt || !h1) return;
  ui.ajudaAberta = ui.ajudaAberta || new Set();
  const aberta = ui.ajudaAberta.has(k);
  h1.insertAdjacentHTML("beforeend", ` <button type="button" class="qh no-print" aria-expanded="${aberta}" aria-label="Para que serve este ecrã" title="Para que serve este ecrã">?</button>`);
  const caixa = document.createElement("div");
  caixa.className = "ajuda-ecra no-print"; caixa.hidden = !aberta;
  caixa.innerHTML = `<p>${esc(txt)}</p><button type="button" class="btn sm ghost">Percebi</button>`;
  const ref = h1.closest(".card-h, .uhead") || h1;
  ref.insertAdjacentElement("afterend", caixa);
  const bt = h1.querySelector(".qh");
  const muda = (abrir) => { caixa.hidden = !abrir; bt.setAttribute("aria-expanded", String(abrir)); if (abrir) ui.ajudaAberta.add(k); else ui.ajudaAberta.delete(k); };
  bt.onclick = (e) => { e.preventDefault(); e.stopPropagation(); muda(caixa.hidden); };
  caixa.querySelector("button").onclick = () => muda(false);
}
/* ============================================================ guia de primeira utilização */
export const AJUDA_PASSO = ["Ajuda sempre à mão", "Em cada ecrã, o ? ao lado do título explica para que serve. Em Ajuda (o ? lá em cima) volta a ver este guia e confirma a versão da aplicação. Quando houver uma versão nova, aparece um aviso com o botão Atualizar agora."];
export const GUIA = {
  dono: [
    ["O ponto de situação", "No Painel vê o fim previsto da obra, o avanço de cada bloco e, em Precisa de atenção, as atividades esquecidas ou paradas que estão a atrasar outras. Toque num número para ver a lista correspondente."],
    ["Fim da obra", "Em Fim vê quando cada bloco e cada apartamento ficam prontos, recalculado todos os dias com o estado real."],
    ["Trabalhos e Gantt", "Em Trabalhos estão todas as atividades, com filtros que ficam guardados até carregar em Limpar filtros. Mude datas com Editar datas, ou arrastando as barras no Gantt. As atividades que dependem dessa acertam-se sozinhas."],
    ["Definições", "Em Definições escolhe a sequência entre especialidades e os dias de cada uma, gere as equipas e, em Acessos, cria as contas do empreiteiro e do fiscal. Depois de cada alteração aparece Anular em baixo, com o número de datas que mudaram."],
    AJUDA_PASSO,
  ],
  empreiteiro: [
    ["A minha semana", "Ao entrar vê o que está em curso, o que deve começar nos próximos 7 dias e o que está à espera de outras atividades. Os botões Iniciar, +10% e Concluir gravam logo."],
    ["Precisa de atenção", "No topo aparecem os pendentes por resolver, as atividades em curso com o fim já passado e as que podiam já ter começado. Quando resolver um pendente, carregue em Já está resolvido: o fiscal verifica depois."],
    ["Mais detalhe", "Toque no nome de uma atividade para abrir a ficha: datas, equipa, motivo de atraso, ligações, fotografias e histórico. Em Trabalhos, com Concluir ou atribuir várias, trata várias atividades de uma vez."],
    ["Enganou-se? Sem rede?", "Depois de guardar aparece Anular em baixo, durante alguns segundos. A aplicação funciona sem rede: guarda tudo no telemóvel e envia quando houver ligação."],
    AJUDA_PASSO,
  ],
  fiscal: [
    ["Escolha o apartamento", "Em Apartamentos escolha onde está. Os que não vê há mais de 7 dias aparecem marcados e pode filtrá-los."],
    ["Faça a vistoria", "Em cada especialidade toque na percentagem que verificou, escreva um comentário e junte fotografias, da câmara ou da galeria. O botão com o número mostra as fotografias já guardadas."],
    ["Pendentes", "No topo da vistoria estão os pendentes do apartamento. Em cada um, carregue em «Concluído?» se já está bem, ou em «Ainda não está». Para registar um ponto novo (por exemplo, falta silicone numa janela), escreva-o em Novo pendente."],
    ["Guarde e siga", "Guarde a vistoria de uma vez e passe ao apartamento seguinte. Funciona sem rede e envia quando houver ligação. Se se enganar, toque em Anular."],
    AJUDA_PASSO,
  ],
};
export function abrirGuia(forcar) {
  const papel = store.user && store.user.papel;
  const passos = GUIA[papel];
  if (!passos || document.querySelector(".guia")) return;
  const chave = "obra-guia-v3-" + papel; // v2: guia revisto a 8 nov 2026, volta a aparecer uma vez
  if (!forcar) { try { if (localStorage.getItem(chave)) return; } catch (e) { return; } }
  let i = 0;
  const el = document.createElement("div");
  el.className = "guia";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Guia rápido");
  const fim = () => { try { localStorage.setItem(chave, "1"); } catch (e) {} el.remove(); };
  const desenha = () => {
    const [t, txt] = passos[i];
    el.innerHTML = `<div class="guia-box">
      <div class="eyebrow">Guia rápido · ${PAPEL[papel]} · ${i + 1} de ${passos.length}</div>
      <h2>${esc(t)}</h2><p>${esc(txt)}</p>
      <div class="guia-dots">${passos.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="row" style="justify-content:space-between"><button class="btn ghost" data-g="sair">Saltar</button>
        <div class="row">${i > 0 ? `<button class="btn" data-g="ant">Anterior</button>` : ""}<button class="btn pri" data-g="seg">${i < passos.length - 1 ? "Seguinte" : "Começar"}</button></div></div>
    </div>`;
  };
  el.onclick = (e) => {
    const b = e.target.closest("[data-g]"); if (!b) return;
    if (b.dataset.g === "sair") fim();
    else if (b.dataset.g === "ant") { i--; desenha(); }
    else if (i < passos.length - 1) { i++; desenha(); } else fim();
  };
  desenha();
  document.body.appendChild(el);
}
