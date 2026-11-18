// Camada de dados. Dois modos:
//  - CloudStore: Firebase (Firestore com cache offline + Auth). Funciona sem rede e sincroniza depois.
//  - DemoStore: tudo neste dispositivo, para experimentar a aplicação sem configurar nada.

const nowISO = () => new Date().toISOString();

/* Cópia de segurança: o mesmo formato na demonstração e na cloud.
   { formato, versao, criadoEm, por, obra, colecoes: { config: {id: doc}, atividades, pendentes, registos, fotos, utilizadores } } */
export const COPIA_FORMATO = "obra-altis-copia";
export const COPIA_COLECOES = ["config", "atividades", "pendentes", "registos", "fotos", "utilizadores"];
/** Tira tipos que não passam para JSON (datas do Firestore passam a texto ISO). */
function paraJSON(v) {
  if (v == null || typeof v !== "object") return v;
  if (typeof v.toDate === "function") { try { return v.toDate().toISOString(); } catch (e) { return null; } }
  if (Array.isArray(v)) return v.map(paraJSON);
  const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = paraJSON(x); return o;
}
const semId = (o) => { const { id, ...r } = o || {}; return r; };

class Emitter {
  constructor() { this._l = new Set(); }
  on(fn) { this._l.add(fn); return () => this._l.delete(fn); }
  /** Administrador: escolhe a vista (dono, empreiteiro ou fiscal) sem mudar as permissões reais. */
  get admin() { return !!this.user && this.user.papelReal === "admin"; }
  setVista(p) {
    if (!this.admin) return;
    this.user.papel = p || null;
    try { if (p) sessionStorage.setItem("obra-vista", p); else sessionStorage.removeItem("obra-vista"); } catch (e) {}
    this.emit("auth");
  }
  _comoAdmin() {
    if (this.user && this.user.papel === "admin") {
      this.user.papelReal = "admin";
      let v = null; try { v = sessionStorage.getItem("obra-vista"); } catch (e) {}
      this.user.papel = ["dono", "empreiteiro", "fiscal"].includes(v) ? v : null;
    }
  }
  emit(...a) { for (const f of this._l) try { f(...a); } catch (e) { console.error(e); } }
}

/* ---------------------------------------------------------------- DEMO */
export class DemoStore extends Emitter {
  constructor(seed) {
    super();
    this.modo = "demo";
    this.seed = seed;
    this.KEY = "obra-demo-v1";
    this.state = null;
    this.user = null;
    this.sync = { online: navigator.onLine, pendentes: 0, texto: "Modo demonstração" };
  }
  _load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(this.KEY) || "null"); } catch (e) { saved = null; }
    const s = this.seed;
    const acts = {};
    for (const a of s.atividades) acts[a.id] = { ...a };
    this.state = {
      config: { nome: s.obra.nome, especialidades: s.especialidades, regras: s.regras, duracoes: s.duracoes, unidades: s.unidades },
      atividades: acts, fotos: [], registos: [], pendentes: {},
      utilizadores: [
        { email: "dono@demo", nome: "Dono de obra", papel: "dono" },
        { email: "empreiteiro@demo", nome: "Empreiteiro", papel: "empreiteiro" },
        { email: "fiscal@demo", nome: "Fiscal", papel: "fiscal" },
        { email: "admin@demo", nome: "Administrador", papel: "admin" },
      ],
    };
    if (saved) {
      if (saved.config) Object.assign(this.state.config, saved.config);
      for (const a of saved.novas || []) acts[a.id] = { ...a };
      for (const id of saved.removidas || []) delete acts[id];
      for (const [id, p] of Object.entries(saved.patches || {})) if (acts[id]) Object.assign(acts[id], p);
      this.state.registos = saved.registos || [];
      this.state.fotos = saved.fotos || [];
      this.state.pendentes = saved.pendentes || {};
      if (saved.utilizadores) this.state.utilizadores = saved.utilizadores;
    }
    this.patches = (saved && saved.patches) || {};
    this._simularVistoria();
    this.novas = (saved && saved.novas) || [];
    this.removidas = (saved && saved.removidas) || [];
  }
  _save() {
    const c = this.state.config;
    const data = { config: { regras: c.regras, duracoes: c.duracoes, especialidades: c.especialidades, unidades: c.unidades, correcaoExpiradas: c.correcaoExpiradas }, patches: this.patches,
      novas: this.novas.filter((a) => this.state.atividades[a.id]), removidas: this.removidas,
      registos: this.state.registos.filter((r) => !r.sim).slice(-500), utilizadores: this.state.utilizadores, pendentes: this.state.pendentes };
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ ...data, fotos: this.state.fotos.filter((f) => !f.sim) }));
    } catch (e) {
      try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e2) { /* sem armazenamento */ }
    }
  }
  /**
   * Só na demonstração: uma vistoria simulada do fiscal há 3 dias, em 3 frações, com comentários e fotografias desenhadas,
   * para se ver o relatório completo. Não fica gravada (marcada sim) e volta a ser criada ao abrir.
   * Nos testes locais (localhost) não aparece, a menos que o endereço tenha ?sim.
   */
  _simularVistoria() {
    try { if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sim\b/.test(location.search)) return; } catch (e) { return; }
    this.state.registos = this.state.registos.filter((r) => !r.sim);
    this.state.fotos = this.state.fotos.filter((f) => !f.sim);
    const d = new Date(); d.setDate(d.getDate() - 3); d.setHours(10, 5, 0, 0);
    const em = (min) => new Date(d.getTime() + min * 60000).toISOString();
    const CORES = [["#c9b79c", "#8a6f4e"], ["#d9d4c7", "#6f7d86"], ["#bcc7c1", "#55705f"], ["#e2d3c1", "#a0643c"], ["#cfd6dd", "#3f5f86"]];
    const foto = (u, esp, k) => {
      const [fundo, linha] = CORES[k % CORES.length];
      const ladr = Array.from({ length: 6 }, (_, i) => `<path d="M0 ${60 + i * 50}h640M${(i * 97) % 640} 0v480" stroke="${linha}" stroke-opacity=".35" stroke-width="3"/>`).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="${fundo}"/>${ladr}
        <rect x="${120 + (k % 3) * 40}" y="110" width="220" height="250" fill="none" stroke="${linha}" stroke-width="10"/><circle cx="${470 - (k % 2) * 60}" cy="200" r="46" fill="${linha}" fill-opacity=".55"/>
        <rect x="0" y="410" width="640" height="70" fill="#000" fill-opacity=".45"/><text x="24" y="453" font-family="Arial, sans-serif" font-size="26" fill="#fff">Foto simulada · ${u}</text></svg>`;
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    };
    const NOTAS = ["Falta rematar o canto junto à janela da sala.", "Juntas por limpar na base do duche.", "Material em obra, falta montar duas portas.", "Tubagem testada e sem fugas.", "Pintura com manchas no teto do quarto 2, refazer."];
    const acts = Object.values(this.state.atividades);
    const fracs = ["B-F503", "B-F504", "C-F107"].filter((u) => acts.some((a) => a.unidade === u));
    let min = 0, k = 0;
    for (const u of fracs) {
      const lista = acts.filter((a) => a.unidade === u && !a.concluido).sort((x, y) => (x.realInicio ? 0 : 1) - (y.realInicio ? 0 : 1) || String(x.planInicio || "").localeCompare(String(y.planInicio || ""))).slice(0, 5);
      lista.forEach((a, i) => {
        const emp = Math.round(Number(a.pctEmp) || 0);
        const confirmado = i === 3;
        const depois = confirmado ? emp : Math.min(100, Math.max(5, emp + [10, -15, 25, 0, 5][i]));
        const nota = i === 3 ? null : NOTAS[(k + i) % NOTAS.length];
        const nf = i === 0 ? 2 : i === 2 ? 1 : i === 4 ? 2 : 0;
        const quando = em(min += 2);
        for (let j = 0; j < nf; j++) this.state.fotos.push({ id: "fsim" + k + "-" + j, sim: true, ativ: a.id, unidade: u, data: foto(u, a.seccao || "", k + j), nota: nota || "", por: "fiscal@demo", nomePor: "Fiscal", em: quando });
        const dados = { esp: a.seccao, antes: null, depois, emp, nota, nfotos: nf, confirmado };
        this.state.registos.push({ id: "gsim" + k, sim: true, tipo: "vistoria", ativ: a.id, unidade: u, por: "fiscal@demo", nomePor: "Fiscal", papel: "fiscal", em: quando,
          texto: `Vistoria ${a.seccao} em ${u}: ${depois}% (empreiteiro dizia ${emp}%)`, dados });
        k++;
      });
    }
  }
  async init() {
    this._load();
    let p = null;
    try { p = localStorage.getItem(this.KEY + "-papel"); } catch (e) {}
    const u = p && this.state.utilizadores.find((x) => x.papel === p);
    if (u) { this.user = { ...u }; this._comoAdmin(); }
    return true;
  }
  needsLogin() { return !this.user; }
  async loginDemo(papel) {
    const u = this.state.utilizadores.find((x) => x.papel === papel);
    this.user = { ...u };
    try { localStorage.setItem(this.KEY + "-papel", papel); sessionStorage.removeItem("obra-vista"); } catch (e) {}
    this._comoAdmin();
    this.emit("auth");
  }
  async logout() { this.user = null; try { localStorage.removeItem(this.KEY + "-papel"); sessionStorage.removeItem("obra-vista"); } catch (e) {} this.emit("auth"); }
  get data() { return this.state; }
  async updateAtividade(id, patch, registo) {
    const a = this.state.atividades[id];
    const p = { ...patch, atualizadoEm: nowISO(), atualizadoPor: this.user.email };
    Object.assign(a, p);
    this.patches[id] = { ...(this.patches[id] || {}), ...p };
    if (registo) this._reg(id, a.unidade, registo);
    this._save();
    this.emit("data");
  }
  /** Várias atividades de uma vez (uma só atualização do ecrã). lista: [{ id, patch }] */
  async updateMuitas(lista, registo) {
    const em = nowISO();
    for (const { id, patch } of lista) {
      const a = this.state.atividades[id];
      if (!a) continue;
      const p = { ...patch, atualizadoEm: em, atualizadoPor: this.user.email };
      Object.assign(a, p);
      this.patches[id] = { ...(this.patches[id] || {}), ...p };
    }
    if (registo) this._reg(lista.length === 1 ? lista[0].id : null, null, registo);
    this._save();
    this.emit("data");
  }
  _reg(ativ, unidade, r) {
    this.state.registos.push({ id: "g" + Date.now() + Math.random().toString(36).slice(2, 6), ativ, unidade,
      por: this.user.email, nomePor: this.user.nome, papel: this.user.papelReal || this.user.papel, em: nowISO(), ...r });
  }
  async setConfig(patch, registo) {
    Object.assign(this.state.config, patch);
    if (registo) this._reg(null, null, registo);
    this._save();
    this.emit("data");
  }
  async addAtividades(lista, cfgPatch, registo) {
    if (cfgPatch) Object.assign(this.state.config, cfgPatch);
    const agora = nowISO();
    for (const a of lista) {
      const n = { ...a, criadoEm: agora, criadoPor: this.user.email };
      this.state.atividades[a.id] = n;
      this.novas = this.novas.filter((x) => x.id !== a.id);
      this.novas.push(n);
      delete this.patches[a.id];
    }
    // uma atividade eliminada que volta (Anular) deixa de contar como removida
    const voltam = new Set(lista.map((a) => a.id));
    this.removidas = this.removidas.filter((id) => !voltam.has(id));
    if (registo) this._reg(lista.length === 1 ? lista[0].id : null, lista.length === 1 ? lista[0].unidade : null, registo);
    this._save();
    this.emit("data");
  }
  async removeAtividades(ids, registo) {
    for (const id of ids) {
      delete this.state.atividades[id];
      delete this.patches[id];
      if (!this.removidas.includes(id)) this.removidas.push(id); // também as que tinham voltado com Anular (podem existir no ficheiro de origem)
    }
    this.novas = this.novas.filter((a) => !ids.includes(a.id));
    if (registo) this._reg(null, null, registo);
    this._save();
    this.emit("data");
  }
  /** Pendentes: pontos por resolver numa fração (ou numa atividade). */
  async addPendente(p, registo) {
    const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.state.pendentes[id] = { id, ...p };
    if (registo) this._reg(p.ativ || null, p.unidade, { ...registo, pid: id });
    this._save();
    this.emit("data");
    return id;
  }
  async updatePendente(id, patch, registo) {
    const x = this.state.pendentes[id]; if (!x) return;
    Object.assign(x, patch);
    if (registo) this._reg(x.ativ || null, x.unidade, { ...registo, pid: id });
    this._save();
    this.emit("data");
  }
  async removePendente(id, registo) {
    const x = this.state.pendentes[id]; if (!x) return;
    delete this.state.pendentes[id];
    if (registo) this._reg(x.ativ || null, x.unidade, { ...registo, pid: id });
    this._save();
    this.emit("data");
  }
  async addFoto(ativ, unidade, dataUrl, nota, em) { // em: dia de uma vistoria passada que se está a corrigir
    this.state.fotos.push({ id: "f" + Date.now() + Math.random().toString(36).slice(2, 6), ativ, unidade, data: dataUrl, nota: nota || "",
      por: this.user.email, nomePor: this.user.nome, em: em || nowISO() });
    this._save();
    this.emit("fotos", unidade);
  }
  async getFotos(unidade) { return this.state.fotos.filter((f) => f.unidade === unidade); }
  async removeFoto(foto, registo) {
    this.state.fotos = this.state.fotos.filter((f) => f.id !== foto.id);
    if (registo) this._reg(foto.ativ, foto.unidade, registo);
    this._save();
    this.emit("fotos", foto.unidade);
  }
  async getRegistos(ativ) { return this.state.registos.filter((r) => r.ativ === ativ).sort((a, b) => b.em.localeCompare(a.em)); }
  /** Muda campos de vários registos (ex.: marcar um relatório de vistoria como eliminado). */
  async marcarRegistos(ids, patch, registo) {
    const set = new Set(ids);
    for (const r of this.state.registos) if (set.has(r.id)) Object.assign(r, patch);
    if (registo) this._reg(null, null, registo);
    this._save();
    this.emit("data");
  }
  async getRegistosDesde(iso) { return this.state.registos.filter((r) => r.em >= iso).sort((a, b) => b.em.localeCompare(a.em)); }
  async getRegistosTipo(tipo) { return this.state.registos.filter((r) => r.tipo === tipo).sort((a, b) => b.em.localeCompare(a.em)); }
  async getFotosEntre(ini, fim) { return this.state.fotos.filter((f) => f.em >= ini && f.em < fim); }
  recentes(n = 30) { return [...this.state.registos].sort((a, b) => b.em.localeCompare(a.em)).slice(0, n); }
  async listUsers() { return this.state.utilizadores; }
  async addUser({ nome, email, papel }) {
    this.state.utilizadores = this.state.utilizadores.filter((u) => u.email !== email).concat([{ nome, email, papel }]);
    this._save();
  }
  async reset() { try { localStorage.removeItem(this.KEY); } catch (e) {} this._load(); this.emit("data"); }
  async exportar() {
    const st = this.state;
    const mapa = (lista, k = "id") => Object.fromEntries(lista.map((x) => [x[k], k === "id" ? semId(x) : x]));
    return paraJSON({
      config: { obra: st.config },
      atividades: Object.fromEntries(Object.values(st.atividades).map((a) => [a.id, semId(a)])),
      pendentes: Object.fromEntries(Object.entries(st.pendentes).map(([id, x]) => [id, semId(x)])),
      registos: mapa(st.registos),
      fotos: mapa(st.fotos),
      utilizadores: Object.fromEntries(st.utilizadores.map((u) => [u.email, u])),
    });
  }
  /** Substitui tudo pelo que está na cópia (os acessos nunca se apagam, só se acrescentam). */
  async repor(C, opts = {}, onProgress) {
    const seedActs = Object.fromEntries(this.seed.atividades.map((a) => [a.id, a]));
    const acts = C.atividades || {};
    this.removidas = Object.keys(seedActs).filter((id) => !(id in acts));
    this.novas = Object.entries(acts).filter(([id]) => !seedActs[id]).map(([id, d]) => ({ ...d, id }));
    this.patches = {};
    for (const [id, d] of Object.entries(acts)) {
      if (!seedActs[id]) continue;
      const pt = { ...d };
      for (const k of Object.keys(seedActs[id])) if (k !== "id" && !(k in d)) pt[k] = null;
      this.patches[id] = pt;
    }
    const cfg = (C.config && C.config.obra) || {};
    this.state.config = { ...this.state.config, ...cfg };
    this.state.pendentes = Object.fromEntries(Object.entries(C.pendentes || {}).map(([id, x]) => [id, { id, ...x }]));
    this.state.registos = Object.entries(C.registos || {}).map(([id, x]) => ({ id, ...x }));
    this.state.fotos = Object.entries(C.fotos || {}).map(([id, x]) => ({ id, ...x }));
    const us = new Map(this.state.utilizadores.map((u) => [u.email, u]));
    if (opts.acessos) for (const [email, u] of Object.entries(C.utilizadores || {})) us.set(email, { ...u, email });
    this.state.utilizadores = [...us.values()];
    this._save();
    this._load();
    this._reg(null, null, { tipo: "copia", texto: "Repôs uma cópia de segurança" });
    this._save();
    try { onProgress && onProgress(1, 1); } catch (e) {}
    this.emit("data");
  }
}

/* ---------------------------------------------------------------- CLOUD */
export class CloudStore extends Emitter {
  constructor(cfg, seed) {
    super();
    this.modo = "cloud";
    this.cfg = cfg;
    this.seed = seed;
    this.user = null;
    this.state = { config: null, atividades: {}, fotos: [], registos: [], utilizadores: [], pendentes: {} };
    this.sync = { online: navigator.onLine, pendentes: 0, texto: "A ligar..." };
    this._unsubs = [];
  }
  async init() {
    const fb = (this.fb = await import("./firebase.js"));
    this.app = fb.initializeApp(this.cfg.firebase);
    this.db = fb.initializeFirestore(this.app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) });
    this.auth = fb.getAuth(this.app);
    window.addEventListener("online", () => this._syncText());
    window.addEventListener("offline", () => this._syncText());
    await new Promise((resolve) => {
      let first = true;
      fb.onAuthStateChanged(this.auth, async (u) => {
        await this._onAuth(u);
        if (first) { first = false; resolve(); } else this.emit("auth");
      });
    });
    return true;
  }
  needsLogin() { return !this.user; }
  async _onAuth(u) {
    this._unsubs.forEach((f) => f()); this._unsubs = [];
    if (!u) { this.user = null; return; }
    const fb = this.fb;
    const email = (u.email || "").toLowerCase();
    let perfil = null;
    try {
      const snap = await fb.getDoc(fb.doc(this.db, "utilizadores", email));
      if (snap.exists()) perfil = snap.data();
    } catch (e) { console.warn("perfil", e); }
    const isAdmin = email === String(this.cfg.adminEmail || "").toLowerCase();
    if (!perfil && isAdmin) perfil = { nome: "Administrador", papel: "admin" };
    if (isAdmin && perfil.papel === "dono") perfil = { ...perfil, papel: "admin" }; // o dono principal pode ver todas as vistas
    if (!perfil) { this.user = { email, nome: email, papel: "sem_acesso" }; return; }
    this.user = { email, nome: perfil.nome || email, papel: perfil.papel };
    this._comoAdmin();
    this._listen();
  }
  _listen() {
    const fb = this.fb, db = this.db;
    const meta = { includeMetadataChanges: true };
    this._unsubs.push(fb.onSnapshot(fb.doc(db, "config", "obra"), meta, (s) => {
      this.state.config = s.exists() ? s.data() : null;
      this._meta("config", s.metadata);
      this.emit("data");
    }, (e) => this._erro(e)));
    this._unsubs.push(fb.onSnapshot(fb.collection(db, "atividades"), meta, (s) => {
      const m = {};
      s.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      this.state.atividades = m;
      this._meta("atividades", s.metadata);
      this.emit("data");
    }, (e) => this._erro(e)));
    this._unsubs.push(fb.onSnapshot(fb.collection(db, "pendentes"), meta, (s) => {
      const m = {};
      s.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      this.state.pendentes = m;
      this._meta("pendentes", s.metadata);
      this.emit("data");
    }, (e) => { console.warn("pendentes", e); this.state.pendentes = {}; this.semPendentes = true; this.emit("data"); }));
    this._unsubs.push(fb.onSnapshot(fb.query(fb.collection(db, "registos"), fb.orderBy("em", "desc"), fb.limit(60)), meta, (s) => {
      this.state.registos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      this._meta("registos", s.metadata);
      this.emit("data");
    }, (e) => this._erro(e)));
  }
  _erro(e, escrita) {
    console.error(e);
    this.sync.texto = "Erro de acesso: " + (e.code || e.message);
    this.emit("sync");
    // uma gravação recusada pelo servidor desfaz-se sozinha no ecrã: avisa, para não parecer que gravou
    if (escrita) { this.ultimoErro = { code: e.code || "", msg: e.message || String(e), papel: this.user && (this.user.papelReal || this.user.papel), email: this.user && this.user.email }; this.emit("erroEscrita"); }
  }
  _meta(k, md) {
    this._pend = this._pend || {};
    this._pend[k] = md.hasPendingWrites;
    this._fromCache = md.fromCache;
    this._syncText();
  }
  _syncText() {
    const pend = Object.values(this._pend || {}).some(Boolean);
    const online = navigator.onLine;
    this.sync.online = online;
    this.sync.pendentes = pend ? 1 : 0;
    this.sync.texto = !online ? (pend ? "Sem rede. Alterações guardadas, enviam quando houver rede" : "Sem rede. A trabalhar com a última cópia")
      : pend ? "A sincronizar..." : "Sincronizado";
    this.emit("sync");
  }
  get data() { return this.state; }
  async login(email, senha) { await this.fb.signInWithEmailAndPassword(this.auth, email.trim(), senha); }
  async logout() { try { sessionStorage.removeItem("obra-vista"); } catch (e) {} await this.fb.signOut(this.auth); }
  async resetSenha(email) { await this.fb.sendPasswordResetEmail(this.auth, email.trim()); }
  _regDoc(ativ, unidade, r) {
    return { ativ: ativ || null, unidade: unidade || null, por: this.user.email, nomePor: this.user.nome, papel: this.user.papelReal || this.user.papel, em: nowISO(), ...r };
  }
  async updateAtividade(id, patch, registo) {
    const fb = this.fb;
    const a = this.state.atividades[id];
    const p = { ...patch, atualizadoEm: nowISO(), atualizadoPor: this.user.email };
    // Escrita local imediata (fica em fila se não houver rede)
    const b = fb.writeBatch(this.db);
    b.update(fb.doc(this.db, "atividades", id), p);
    if (registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(id, a && a.unidade, registo));
    b.commit().catch((e) => this._erro(e, true));
    if (a) Object.assign(a, p);
    this.emit("data");
  }
  async updateMuitas(lista, registo) {
    const fb = this.fb, em = nowISO();
    for (let i = 0; i < lista.length; i += 400) {
      const b = fb.writeBatch(this.db);
      for (const { id, patch } of lista.slice(i, i + 400)) {
        const p = { ...patch, atualizadoEm: em, atualizadoPor: this.user.email };
        b.update(fb.doc(this.db, "atividades", id), p);
        const a = this.state.atividades[id]; if (a) Object.assign(a, p);
      }
      if (i === 0 && registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(lista.length === 1 ? lista[0].id : null, null, registo));
      b.commit().catch((e) => this._erro(e, true));
    }
    this.emit("data");
  }
  /** Muda campos de vários registos (ex.: marcar um relatório de vistoria como eliminado). */
  async marcarRegistos(ids, patch, registo) {
    const fb = this.fb;
    for (let i = 0; i < ids.length; i += 400) {
      const b = fb.writeBatch(this.db);
      for (const id of ids.slice(i, i + 400)) b.update(fb.doc(this.db, "registos", id), patch);
      if (i === 0 && registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(null, null, registo));
      await b.commit().catch((e) => this._erro(e, true));
    }
    for (const r of this.state.registos) if (ids.includes(r.id)) Object.assign(r, patch);
    this.emit("data");
  }
  async setConfig(patch, registo) {
    const fb = this.fb;
    const b = fb.writeBatch(this.db);
    b.set(fb.doc(this.db, "config", "obra"), patch, { merge: true });
    if (registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(null, null, registo));
    b.commit().catch((e) => this._erro(e, true));
    Object.assign(this.state.config, patch);
    this.emit("data");
  }
  async addAtividades(lista, cfgPatch, registo) {
    const fb = this.fb;
    const agora = nowISO();
    if (cfgPatch) { await this.setConfig(cfgPatch); }
    for (let i = 0; i < lista.length; i += 400) {
      const b = fb.writeBatch(this.db);
      for (const a of lista.slice(i, i + 400)) {
        const { id, ...rest } = a;
        const doc = { ...rest, criadoEm: agora, criadoPor: this.user.email };
        b.set(fb.doc(this.db, "atividades", id), doc);
        this.state.atividades[id] = { id, ...doc };
      }
      if (i === 0 && registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(lista.length === 1 ? lista[0].id : null, lista.length === 1 ? lista[0].unidade : null, registo));
      b.commit().catch((e) => this._erro(e, true));
    }
    this.emit("data");
  }
  async removeAtividades(ids, registo) {
    const fb = this.fb;
    for (let i = 0; i < ids.length; i += 400) {
      const b = fb.writeBatch(this.db);
      for (const id of ids.slice(i, i + 400)) { b.delete(fb.doc(this.db, "atividades", id)); delete this.state.atividades[id]; }
      if (i === 0 && registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(null, null, registo));
      b.commit().catch((e) => this._erro(e, true));
    }
    this.emit("data");
  }
  async addPendente(p, registo) {
    const fb = this.fb;
    const ref = fb.doc(fb.collection(this.db, "pendentes"));
    const b = fb.writeBatch(this.db);
    b.set(ref, p);
    if (registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(p.ativ || null, p.unidade, { ...registo, pid: ref.id }));
    b.commit().catch((e) => this._erro(e, true));
    this.state.pendentes[ref.id] = { id: ref.id, ...p };
    this.emit("data");
    return ref.id;
  }
  async updatePendente(id, patch, registo) {
    const fb = this.fb;
    const x = this.state.pendentes[id];
    const b = fb.writeBatch(this.db);
    b.update(fb.doc(this.db, "pendentes", id), patch);
    if (registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(x && x.ativ || null, x && x.unidade, { ...registo, pid: id }));
    b.commit().catch((e) => this._erro(e, true));
    if (x) Object.assign(x, patch);
    this.emit("data");
  }
  async removePendente(id, registo) {
    const fb = this.fb;
    const x = this.state.pendentes[id];
    const b = fb.writeBatch(this.db);
    b.delete(fb.doc(this.db, "pendentes", id));
    if (registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(x && x.ativ || null, x && x.unidade, { ...registo, pid: id }));
    b.commit().catch((e) => this._erro(e, true));
    delete this.state.pendentes[id];
    this.emit("data");
  }
  async addFoto(ativ, unidade, dataUrl, nota, em) { // em: dia de uma vistoria passada que se está a corrigir
    const fb = this.fb;
    fb.addDoc(fb.collection(this.db, "fotos"), { ativ, unidade, data: dataUrl, nota: nota || "", por: this.user.email, nomePor: this.user.nome, em: em || nowISO() })
      .catch((e) => this._erro(e));
    this.emit("fotos", unidade);
  }
  async removeFoto(foto, registo) {
    const fb = this.fb;
    await fb.deleteDoc(fb.doc(this.db, "fotos", foto.id));
    if (registo) fb.addDoc(fb.collection(this.db, "registos"), this._regDoc(foto.ativ, foto.unidade, registo)).catch((e) => this._erro(e));
    this.emit("fotos", foto.unidade);
  }
  async getFotos(unidade) {
    const fb = this.fb;
    const s = await fb.getDocs(fb.query(fb.collection(this.db, "fotos"), fb.where("unidade", "==", unidade)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  /** Registos de um tipo (ex.: todas as vistorias). Só igualdade: não precisa de índice composto. */
  async getRegistosTipo(tipo) {
    const fb = this.fb;
    const q = await fb.getDocs(fb.query(fb.collection(this.db, "registos"), fb.where("tipo", "==", tipo)));
    return q.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.em || "").localeCompare(a.em || ""));
  }
  async getFotosEntre(ini, fim) {
    const fb = this.fb;
    const s = await fb.getDocs(fb.query(fb.collection(this.db, "fotos"), fb.where("em", ">=", ini), fb.where("em", "<", fim)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  async getRegistosDesde(iso) {
    const fb = this.fb;
    const q = await fb.getDocs(fb.query(fb.collection(this.db, "registos"), fb.where("em", ">=", iso), fb.orderBy("em", "desc"), fb.limit(1000)));
    return q.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  async getRegistos(ativ) {
    const fb = this.fb;
    const s = await fb.getDocs(fb.query(fb.collection(this.db, "registos"), fb.where("ativ", "==", ativ)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.em.localeCompare(a.em));
  }
  recentes(n = 30) { return this.state.registos.slice(0, n); }
  async listUsers() {
    const fb = this.fb;
    const s = await fb.getDocs(fb.collection(this.db, "utilizadores"));
    return s.docs.map((d) => ({ email: d.id, ...d.data() }));
  }
  async addUser({ nome, email, senha, papel }) {
    const fb = this.fb;
    email = email.trim().toLowerCase();
    if (senha) {
      // Cria a conta numa instância secundária para não terminar a sessão do dono
      const sec = fb.initializeApp(this.cfg.firebase, "sec" + Date.now());
      try {
        await fb.createUserWithEmailAndPassword(fb.getAuth(sec), email, senha);
      } catch (e) {
        if (e.code !== "auth/email-already-in-use") throw e;
      } finally {
        try { await fb.signOut(fb.getAuth(sec)); await fb.deleteApp(sec); } catch (e) {}
      }
    }
    await fb.setDoc(fb.doc(this.db, "utilizadores", email), { nome, papel, criadoEm: nowISO() });
  }
  /** Lê tudo o que está na base de dados (precisa de rede, para não sair uma cópia incompleta). */
  async exportar(onProgress) {
    if (!navigator.onLine) throw new Error("Sem rede: ligue-se à internet para fazer a cópia de segurança.");
    const fb = this.fb, out = {};
    for (const [i, c] of COPIA_COLECOES.entries()) {
      try { onProgress && onProgress(i, COPIA_COLECOES.length, c); } catch (e) {}
      const snap = await fb.getDocs(fb.collection(this.db, c));
      const m = {}; snap.forEach((d) => { m[d.id] = paraJSON(d.data()); });
      out[c] = m;
    }
    return out;
  }
  /** Substitui tudo pelo que está na cópia: escreve os documentos da cópia e apaga os que não estavam lá.
      Os acessos (utilizadores) nunca se apagam, só se repõem ou acrescentam. */
  async repor(C, opts = {}, onProgress) {
    if (!navigator.onLine) throw new Error("Sem rede: ligue-se à internet para repor a cópia.");
    const fb = this.fb, db = this.db, ops = [];
    // antes de mexer em nada: confirmar que as regras da base de dados deixam o dono repor tudo
    try {
      const b0 = fb.writeBatch(db);
      for (const c of ["registos", "fotos"]) b0.set(fb.doc(db, c, "_teste_copia"), { teste: true, por: "_", criadoPor: "_" });
      await b0.commit();
      const b1 = fb.writeBatch(db);
      for (const c of ["registos", "fotos"]) b1.delete(fb.doc(db, c, "_teste_copia"));
      await b1.commit();
    } catch (e) {
      throw new Error("as regras de acesso da base de dados ainda não deixam repor cópias a este utilizador (é preciso atualizá-las na consola do Firebase). Nada foi alterado");
    }
    for (const c of ["config", "atividades", "pendentes", "registos", "fotos"]) {
      const novo = C[c] || {};
      const atual = await fb.getDocs(fb.collection(db, c));
      atual.forEach((d) => { if (!(d.id in novo)) ops.push({ c, id: d.id, del: true }); });
      for (const [id, data] of Object.entries(novo)) ops.push({ c, id, data });
    }
    if (opts.acessos) for (const [id, data] of Object.entries(C.utilizadores || {})) ops.push({ c: "utilizadores", id, data }); // os acessos só o dono repõe
    let b = fb.writeBatch(db), n = 0, peso = 0, feitos = 0;
    const avisa = () => { try { onProgress && onProgress(feitos, ops.length); } catch (e) {} };
    avisa();
    for (const op of ops) {
      const ref = fb.doc(db, op.c, op.id);
      if (op.del) b.delete(ref); else b.set(ref, op.data);
      n++; peso += op.del ? 100 : JSON.stringify(op.data).length;
      if (n >= 400 || peso > 3000000) { await b.commit(); feitos += n; avisa(); b = fb.writeBatch(db); n = 0; peso = 0; }
    }
    if (n) { await b.commit(); feitos += n; avisa(); }
    await fb.addDoc(fb.collection(db, "registos"), this._regDoc(null, null, { tipo: "copia", texto: "Repôs uma cópia de segurança" }));
    return ops.length;
  }
  /** Importa o cronograma do Excel. Com soFaltam, só acrescenta os trabalhos que ainda não estão na base de dados. */
  async importSeed(onProgress, { soFaltam = false } = {}) {
    const fb = this.fb, s = this.seed;
    const avisa = (i, n) => { try { onProgress && onProgress(i, n); } catch (e) { /* o ecrã pode ter mudado */ } };
    if (!soFaltam) {
      await fb.setDoc(fb.doc(this.db, "config", "obra"), {
        nome: s.obra.nome, especialidades: s.especialidades, regras: s.regras, duracoes: s.duracoes, unidades: s.unidades,
        importadoEm: nowISO(), fonte: s.obra.fonte, importCompleto: false,
      });
    }
    const acts = soFaltam ? s.atividades.filter((a) => !this.state.atividades[a.id]) : s.atividades;
    for (let i = 0; i < acts.length; i += 400) {
      const b = fb.writeBatch(this.db);
      for (const a of acts.slice(i, i + 400)) { const { id, ...rest } = a; b.set(fb.doc(this.db, "atividades", id), rest); }
      await b.commit();
      avisa(Math.min(acts.length, i + 400), acts.length);
    }
    await fb.setDoc(fb.doc(this.db, "config", "obra"), { importCompleto: true }, { merge: true });
    return acts.length;
  }
  /** Quantos trabalhos do Excel faltam na base de dados (importação interrompida). */
  faltamImportar() {
    const c = this.state.config;
    if (!this.seed || !c || c.importCompleto) return 0;
    return this.seed.atividades.filter((a) => !this.state.atividades[a.id]).length;
  }

}
