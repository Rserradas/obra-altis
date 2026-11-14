// Cálculo do estado da obra a partir dos dados.
import { pctEfetiva, schedule, todayISO } from "../engine.js";
import { toast } from "./base.js";
import { S, setS, store } from "./estado.js";

/* ============================================================ cálculo */
export function compute() {
  const d = store.data;
  if (!d.config) { setS(null); return; }
  const cfg = d.config;
  const acts = Object.values(d.atividades);
  const hoje = todayISO();
  const res = schedule(acts, cfg.regras || {}, hoje, cfg.duracoes || {}, optsMotor(cfg));
  const espIdx = Object.fromEntries((cfg.especialidades || []).map((e) => [e.key, e]));
  const todasU = (cfg.unidades || []).map((u) => ({ ...u }));
  const uMap = Object.fromEntries(todasU.map((u) => [u.id, u]));
  // frações de teste: aparecem à parte e não contam para a obra
  const unidades = todasU.filter((u) => !u.teste);
  const unidadesTeste = todasU.filter((u) => u.teste);
  for (const u of todasU) Object.assign(u, { acts: [], dur: 0, feito: 0, fim: null, atraso: null, n: { concluida: 0, em_curso: 0, bloqueada: 0, por_iniciar: 0, atrasada: 0 } });
  const tot = { n: 0, concluida: 0, em_curso: 0, bloqueada: 0, por_iniciar: 0, atrasada: 0, semPlano: 0, fim: null, atraso: null };
  for (const a of acts) {
    const r = res.get(a.id);
    const u = uMap[a.unidade];
    if (!u) continue;
    u.acts.push(a);
    const w = Math.max(1, r.dur);
    u.dur += w; u.feito += w * pctEfetiva(a) / 100;
    u.n[r.estado]++;
    if (r.atrasada) u.n.atrasada++;
    if (r.estado !== "concluida") u.atraso = Math.max(u.atraso ?? 0, r.atraso || 0);
    if (!u.fim || r.provFim > u.fim) u.fim = r.provFim;
    if (u.teste) continue;
    tot.n++; tot[r.estado]++;
    if (r.atrasada) tot.atrasada++;
    if (r.semPlano && r.estado !== "concluida") tot.semPlano++;
    // fim previsto da obra: o fim provável (uma previsão já ultrapassada conta a partir de hoje)
    if (r.estado !== "concluida") tot.atraso = Math.max(tot.atraso ?? 0, r.atraso || 0);
    if (!tot.fim || r.provFim > tot.fim) tot.fim = r.provFim;
  }
  for (const u of todasU) {
    u.pct = u.dur ? Math.round((100 * u.feito) / u.dur) : 0;
    const ord = (a) => (a.esp && espIdx[a.esp] ? espIdx[a.esp].ordem : 99);
    u.acts.sort((a, b) => ord(a) - ord(b) || (res.get(a.id).inicio || "").localeCompare(res.get(b.id).inicio || ""));
  }
  const idsTeste = new Set(unidadesTeste.map((u) => u.id));
  setS({ cfg, res, hoje, unidades, unidadesTeste, idsTeste, uMap, tot, espIdx, acts: d.atividades, equipas: [] });
  // equipas: as registadas em Definições e as que aparecem nos trabalhos (vindas do Excel)
  const registadas = (cfg.equipas || []).filter((e) => e && e.nome);
  const nomesReg = new Set(registadas.map((e) => e.nome));
  const soNosTrab = [...new Set(acts.map((a) => a.equipa).filter((n) => n && !nomesReg.has(n)))].map((nome) => ({ nome, daObra: true }));
  S.eqLista = [...registadas, ...soNosTrab].sort((a, b) => a.nome.localeCompare(b.nome, "pt", { numeric: true }));
  S.equipasTodas = S.eqLista.map((e) => e.nome);
  // as equipas que saíram da obra deixam de aparecer para atribuir, mas ficam no histórico e nos filtros
  S.equipas = S.eqLista.filter((e) => e.ativa !== false).map((e) => e.nome);
}
/** Opções do motor de datas: as frentes de cada equipa (quantos trabalhos faz ao mesmo tempo). */
export function optsMotor(cfg = S.cfg) {
  const frentes = {};
  for (const e of (cfg && cfg.equipas) || []) if (e && e.nome && Number(e.frentes) > 1) frentes[e.nome] = Math.floor(Number(e.frentes));
  return { frentes };
}
export const frentesDe = (nome) => Math.max(1, Math.floor(Number(((S.cfg.equipas || []).find((e) => e && e.nome === nome) || {}).frentes) || 1));
/* Andares modelo: guardados na configuração da obra; enquanto ninguém mexer, são estes. */
export const MODELOS_PADRAO = ["B-F103", "B-F104", "B-F105"];
export const modelos = () => new Set(Array.isArray(S.cfg.modelos) ? S.cfg.modelos : MODELOS_PADRAO);
export const eModelo = (uid) => modelos().has(uid);
export const modeloTag = (uid, curto = false) => (eModelo(uid) ? `<span class="mod-b${curto ? " curto" : ""}" title="Andar modelo">${curto ? "M" : "Modelo"}</span>` : "");
export async function mudarModelo(uid, on) {
  const m = modelos();
  if (on) m.add(uid); else m.delete(uid);
  await store.setConfig({ modelos: [...m].sort() }, { tipo: "config", texto: `${uid} ${on ? "passou a ser" : "deixou de ser"} andar modelo` });
  toast(`${uid} ${on ? "marcado como andar modelo" : "deixou de ser andar modelo"}`, { anular: false });
}
/** Atividades da obra (sem as das frações de teste). */
export const actsObra = () => Object.values(S.acts).filter((a) => !S.idsTeste.has(a.unidade));
export const nomeAtiv = (a) => (a.esp && S.espIdx[a.esp] ? S.espIdx[a.esp].nome : a.seccao);
/** Especialidades dos apartamentos e lojas (sem as das zonas comuns e geral), pela ordem da lista. */
export const espAp = () => (S.cfg.especialidades || []).filter((e) => !e.grupo).sort((a, b) => a.ordem - b.ordem);
export const blocoLabel = (b) => (b === "Geral" ? "Geral" : "Bloco " + b);
