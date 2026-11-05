// Camada de dados. Dois modos:
//  - CloudStore: Firebase (Firestore com cache offline + Auth). Funciona sem rede e sincroniza depois.
//  - DemoStore: tudo neste dispositivo, para experimentar a aplicação sem configurar nada.

const nowISO = () => new Date().toISOString();

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
      atividades: acts, fotos: [], registos: [],
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
      if (saved.utilizadores) this.state.utilizadores = saved.utilizadores;
    }
    this.patches = (saved && saved.patches) || {};
    this.novas = (saved && saved.novas) || [];
    this.removidas = (saved && saved.removidas) || [];
  }
  _save() {
    const c = this.state.config;
    const data = { config: { regras: c.regras, duracoes: c.duracoes, especialidades: c.especialidades, unidades: c.unidades }, patches: this.patches,
      novas: this.novas.filter((a) => this.state.atividades[a.id]), removidas: this.removidas,
      registos: this.state.registos.slice(-500), utilizadores: this.state.utilizadores };
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ ...data, fotos: this.state.fotos }));
    } catch (e) {
      try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e2) { /* sem armazenamento */ }
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
      this.novas.push(n);
    }
    if (registo) this._reg(lista.length === 1 ? lista[0].id : null, lista.length === 1 ? lista[0].unidade : null, registo);
    this._save();
    this.emit("data");
  }
  async removeAtividades(ids, registo) {
    for (const id of ids) {
      delete this.state.atividades[id];
      delete this.patches[id];
      if (!this.novas.some((a) => a.id === id)) this.removidas.push(id);
    }
    this.novas = this.novas.filter((a) => !ids.includes(a.id));
    if (registo) this._reg(null, null, registo);
    this._save();
    this.emit("data");
  }
  async addFoto(ativ, unidade, dataUrl, nota) {
    this.state.fotos.push({ id: "f" + Date.now() + Math.random().toString(36).slice(2, 6), ativ, unidade, data: dataUrl, nota: nota || "",
      por: this.user.email, nomePor: this.user.nome, em: nowISO() });
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
  async getRegistosDesde(iso) { return this.state.registos.filter((r) => r.em >= iso).sort((a, b) => b.em.localeCompare(a.em)); }
  recentes(n = 30) { return [...this.state.registos].sort((a, b) => b.em.localeCompare(a.em)).slice(0, n); }
  async listUsers() { return this.state.utilizadores; }
  async addUser({ nome, email, papel }) {
    this.state.utilizadores = this.state.utilizadores.filter((u) => u.email !== email).concat([{ nome, email, papel }]);
    this._save();
  }
  async reset() { try { localStorage.removeItem(this.KEY); } catch (e) {} this._load(); this.emit("data"); }
}

/* ---------------------------------------------------------------- CLOUD */
export class CloudStore extends Emitter {
  constructor(cfg, seed) {
    super();
    this.modo = "cloud";
    this.cfg = cfg;
    this.seed = seed;
    this.user = null;
    this.state = { config: null, atividades: {}, fotos: [], registos: [], utilizadores: [] };
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
    this._unsubs.push(fb.onSnapshot(fb.query(fb.collection(db, "registos"), fb.orderBy("em", "desc"), fb.limit(60)), meta, (s) => {
      this.state.registos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      this._meta("registos", s.metadata);
      this.emit("data");
    }, (e) => this._erro(e)));
  }
  _erro(e) { console.error(e); this.sync.texto = "Erro de acesso: " + (e.code || e.message); this.emit("sync"); }
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
    b.commit().catch((e) => this._erro(e));
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
      b.commit().catch((e) => this._erro(e));
    }
    this.emit("data");
  }
  async setConfig(patch, registo) {
    const fb = this.fb;
    const b = fb.writeBatch(this.db);
    b.set(fb.doc(this.db, "config", "obra"), patch, { merge: true });
    if (registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(null, null, registo));
    b.commit().catch((e) => this._erro(e));
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
      b.commit().catch((e) => this._erro(e));
    }
    this.emit("data");
  }
  async removeAtividades(ids, registo) {
    const fb = this.fb;
    for (let i = 0; i < ids.length; i += 400) {
      const b = fb.writeBatch(this.db);
      for (const id of ids.slice(i, i + 400)) { b.delete(fb.doc(this.db, "atividades", id)); delete this.state.atividades[id]; }
      if (i === 0 && registo) b.set(fb.doc(fb.collection(this.db, "registos")), this._regDoc(null, null, registo));
      b.commit().catch((e) => this._erro(e));
    }
    this.emit("data");
  }
  async addFoto(ativ, unidade, dataUrl, nota) {
    const fb = this.fb;
    fb.addDoc(fb.collection(this.db, "fotos"), { ativ, unidade, data: dataUrl, nota: nota || "", por: this.user.email, nomePor: this.user.nome, em: nowISO() })
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
