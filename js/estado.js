// Estado partilhado pela aplicação. Só se muda através das funções set...(), para todos os módulos verem o valor novo.
export let store = undefined;
export const setStore = (v) => (store = v);
export let S = null; // estado calculado da obra (ver calculo.js)
export const setS = (v) => (S = v);
export let filtrosDe = null;
export const setFiltrosDe = (v) => (filtrosDe = v);
export let loteAnular = [];
export const setLoteAnular = (v) => (loteAnular = v);
export let aAnular = false;
export const setAAnular = (v) => (aAnular = v);
export let snapDatas = null; // datas de todas as atividades antes da primeira gravação do lote, para contar o que mudou
export const setSnapDatas = (v) => (snapDatas = v);
export let versaoNova = null;
export const setVersaoNova = (v) => (versaoNova = v);
export let lastView = "";
export const setLastView = (v) => (lastView = v);
export let importando = false;
export const setImportando = (v) => (importando = v);
