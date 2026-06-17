/**
 * db.js — Couche d'accès aux données
 * Par défaut : localStorage (mode démo / solo)
 * Peut être remplacé par Supabase via window.DB_ADAPTER
 */

const DB_KEYS = {
  USERS: 'ftsi_users',
  FORMATIONS: 'ftsi_formations',
  INSCRIPTIONS: 'ftsi_inscriptions',
  CATEGORIES: 'ftsi_categories',
  CATALOGUE: 'ftsi_catalogue',
  SUPABASE_CFG: 'ftsi_supabase_config',
};

/* ===================================================
   LOCAL STORAGE ADAPTER (défaut)
=================================================== */
const LocalAdapter = {
  _read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  },
  _write(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // --- USERS ---
  getUsers() { return this._read(DB_KEYS.USERS) || []; },
  getUserById(id) { return this.getUsers().find(u => u.id === id) || null; },
  getUserByUsername(username) { return this.getUsers().find(u => u.username === username) || null; },
  saveUser(user) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    this._write(DB_KEYS.USERS, users);
    return user;
  },
  deleteUser(id) {
    const users = this.getUsers().filter(u => u.id !== id);
    this._write(DB_KEYS.USERS, users);
  },
  authenticate(username, password) {
    const hash = this._hashPassword(password);
    return this.getUsers().find(u => u.username === username && u.passwordHash === hash && u.isActive !== false) || null;
  },
  _hashPassword(pwd) {
    // Simple hash pour démo — remplacer par bcrypt côté serveur en prod
    let hash = 0;
    for (let i = 0; i < pwd.length; i++) {
      const ch = pwd.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + pwd.length;
  },
  changePassword(userId, newPassword) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) { user.passwordHash = this._hashPassword(newPassword); this._write(DB_KEYS.USERS, users); }
  },

  // --- CATEGORIES ---
  getCategories() { return this._read(DB_KEYS.CATEGORIES) || []; },
  saveCategory(cat) {
    const cats = this.getCategories();
    const idx = cats.findIndex(c => c.id === cat.id);
    if (idx >= 0) cats[idx] = cat; else cats.push(cat);
    this._write(DB_KEYS.CATEGORIES, cats);
    return cat;
  },
  deleteCategory(id) {
    this._write(DB_KEYS.CATEGORIES, this.getCategories().filter(c => c.id !== id));
  },

  // --- CATALOGUE ---
  getCatalogue() { return this._read(DB_KEYS.CATALOGUE) || []; },
  saveCatalogueItem(item) {
    const items = this.getCatalogue();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item; else items.push(item);
    this._write(DB_KEYS.CATALOGUE, items);
    return item;
  },
  deleteCatalogueItem(id) {
    this._write(DB_KEYS.CATALOGUE, this.getCatalogue().filter(i => i.id !== id));
  },

  // --- FORMATIONS ---
  getFormations(filters = {}) {
    let list = this._read(DB_KEYS.FORMATIONS) || [];
    // Enrichir avec nb inscrits
    const inscriptions = this._read(DB_KEYS.INSCRIPTIONS) || [];
    list = list.map(f => ({
      ...f,
      inscritsCount: inscriptions.filter(i => i.formationId === f.id && i.statut === 'inscrit').length,
    }));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const cats = this._read(DB_KEYS.CATEGORIES) || [];
      list = list.filter(f => {
        const catName = (cats.find(c => c.id === f.categorieId)?.nom || '').toLowerCase();
        return catName.includes(q) || (f.lieu||'').toLowerCase().includes(q) || (f.formateurs||'').toLowerCase().includes(q);
      });
    }
    if (filters.categorieId) list = list.filter(f => f.categorieId === filters.categorieId);
    if (filters.statut) list = list.filter(f => f.statut === filters.statut);
    if (filters.dateFrom) list = list.filter(f => f.dateDebut >= filters.dateFrom);
    if (filters.dateTo) list = list.filter(f => f.dateDebut <= filters.dateTo);
    return list.sort((a, b) => (a.dateDebut||'').localeCompare(b.dateDebut||''));
  },
  getFormationById(id) {
    return this.getFormations().find(f => f.id === id) || null;
  },
  saveFormation(f) {
    const raw = this._read(DB_KEYS.FORMATIONS) || [];
    const idx = raw.findIndex(x => x.id === f.id);
    const { inscritsCount, ...clean } = f;
    if (idx >= 0) raw[idx] = clean; else raw.push(clean);
    this._write(DB_KEYS.FORMATIONS, raw);
    return this.getFormationById(f.id);
  },
  deleteFormation(id) {
    this._write(DB_KEYS.FORMATIONS, (this._read(DB_KEYS.FORMATIONS)||[]).filter(f => f.id !== id));
    this._write(DB_KEYS.INSCRIPTIONS, (this._read(DB_KEYS.INSCRIPTIONS)||[]).filter(i => i.formationId !== id));
  },
  duplicateFormation(id, createdBy) {
    const f = this.getFormationById(id);
    if (!f) return null;
    const copy = { ...f, id: this._newId(), statut: 'validee', createdBy, createdAt: new Date().toISOString() };
    delete copy.inscritsCount;
    const raw = this._read(DB_KEYS.FORMATIONS) || [];
    raw.push(copy);
    this._write(DB_KEYS.FORMATIONS, raw);
    return this.getFormationById(copy.id);
  },

  // --- INSCRIPTIONS ---
  getInscriptions(formationId) {
    const all = this._read(DB_KEYS.INSCRIPTIONS) || [];
    const list = all.filter(i => i.formationId === formationId && i.statut === 'inscrit');
    const users = this.getUsers();
    return list.map(i => ({ ...i, user: users.find(u => u.id === i.userId) }));
  },
  getUserFormations(userId) {
    const all = this._read(DB_KEYS.INSCRIPTIONS) || [];
    const ids = all.filter(i => i.userId === userId && i.statut === 'inscrit').map(i => i.formationId);
    return this.getFormations().filter(f => ids.includes(f.id));
  },
  isInscrit(formationId, userId) {
    return (this._read(DB_KEYS.INSCRIPTIONS)||[]).some(i => i.formationId === formationId && i.userId === userId && i.statut === 'inscrit');
  },
  inscrire(formationId, userId) {
    const all = this._read(DB_KEYS.INSCRIPTIONS) || [];
    const existing = all.find(i => i.formationId === formationId && i.userId === userId);
    if (existing) { existing.statut = 'inscrit'; }
    else { all.push({ id: this._newId(), formationId, userId, statut: 'inscrit', dateInscription: new Date().toISOString() }); }
    this._write(DB_KEYS.INSCRIPTIONS, all);
  },
  desinscrire(formationId, userId) {
    const all = this._read(DB_KEYS.INSCRIPTIONS) || [];
    const i = all.find(i => i.formationId === formationId && i.userId === userId);
    if (i) { i.statut = 'annulee'; this._write(DB_KEYS.INSCRIPTIONS, all); }
  },

  // --- STATS utilisateur ---
  getUserStats(userId) {
    const now = new Date().toISOString();
    const formations = this.getUserFormations(userId);
    const aVenir = formations.filter(f => f.dateDebut >= now);
    const passees = formations.filter(f => f.dateDebut < now);
    const heures = passees.reduce((acc, f) => {
      if (f.dateDebut && f.dateFin) {
        const d = (new Date(f.dateFin) - new Date(f.dateDebut)) / 3600000;
        return acc + d;
      }
      return acc;
    }, 0);
    return { aVenir: aVenir.length, passees: passees.length, heures: Math.round(heures * 10) / 10 };
  },

  // --- SUPABASE CONFIG ---
  getSupabaseConfig() { return this._read(DB_KEYS.SUPABASE_CFG) || {}; },
  saveSupabaseConfig(cfg) { this._write(DB_KEYS.SUPABASE_CFG, cfg); },

  // --- UTILS ---
  _newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
};

/* ===================================================
   SEED DATA
=================================================== */
function seedIfEmpty() {
  const db = LocalAdapter;
  if (db.getUsers().length > 0) return;

  // Hash helper
  const h = db._hashPassword.bind(db);

  // Catégories FTSI
  const catNames = [
    'SIG', 'SIG - Stains', 'GLOCK', 'DIVA', 'TDI', 'PPI', 'TIREURS QUALIFIÉS',
    'OTUAS NIV 1', 'OTUAS NIV 2', 'STAGES', 'ROC', 'EXERCICE PRU',
    'ENTRAÎNEMENT STHI', 'ENTRAÎNEMENT MROP', 'EVA NIV 1', 'EVA NIV 2', 'EVA NIV 3',
    'TIR LASER', 'TASER - RECYCLAGE', 'TASER - HABILITATION',
    'HK G36 - RECYCLAGE', 'HK G36 - HABILITATION',
    'LBD - RECYCLAGE', 'LBD - HABILITATION',
    'BÂTON - RECYCLAGE', 'BÂTON - HABILITATION',
    'GRENADES - RECYCLAGE', 'GRENADES - HABILITATION',
    'COBRA - RECYCLAGE', 'COBRA - HABILITATION',
    'CONDOR - RECYCLAGE', 'CONDOR - HABILITATION',
    'COUGARD - RECYCLAGE', 'COUGARD - HABILITATION',
    'GENL - RECYCLAGE', 'GENL - HABILITATION',
    'OPÉRATEURS SPI 4G - RECYCLAGE', 'OPÉRATEURS SPI 4G - HABILITATION',
    'PPI CHEF - RECYCLAGE', 'PPI CHEF - HABILITATION',
    'TIKKA - RECYCLAGE', 'TIKKA - HABILITATION',
    'ADMINISTRATIF',
  ];
  // Palette cyclique pour distinguer visuellement les catégories
  const palette = ['#2563EB','#DC2626','#16A34A','#D97706','#9333EA','#0891B2','#DB2777','#65A30D','#7C3AED','#0D9488'];
  const cats = catNames.map((nom, i) => ({ id: 'cat_' + (i+1), nom, couleur: palette[i % palette.length] }));
  cats.forEach(c => db.saveCategory(c));

  // Utilisateurs — dont un compte "configurateur" (gestion Supabase uniquement)
  const users = [
    { id: 'u0', username: 'configurateur', passwordHash: h('config123'), nom: 'Configurateur', prenom: 'Compte', email: '', couleur: '#0F172A', isAdmin: true, isConfigurateur: true, isActive: true },
    { id: 'u1', username: 'admin', passwordHash: h('admin123'), nom: 'Dupont', prenom: 'Jean', email: 'j.dupont@ftsi.fr', couleur: '#DC2626', isAdmin: true, isConfigurateur: false, isActive: true },
    { id: 'u2', username: 'marie.martin', passwordHash: h('password'), nom: 'Martin', prenom: 'Marie', email: 'm.martin@ftsi.fr', couleur: '#2563EB', isAdmin: false, isConfigurateur: false, isActive: true },
    { id: 'u3', username: 'pierre.durand', passwordHash: h('password'), nom: 'Durand', prenom: 'Pierre', email: 'p.durand@ftsi.fr', couleur: '#16A34A', isAdmin: false, isConfigurateur: false, isActive: true },
    { id: 'u4', username: 'sophie.bernard', passwordHash: h('password'), nom: 'Bernard', prenom: 'Sophie', email: 's.bernard@ftsi.fr', couleur: '#9333EA', isAdmin: false, isConfigurateur: false, isActive: true },
    { id: 'u5', username: 'lucas.petit', passwordHash: h('password'), nom: 'Petit', prenom: 'Lucas', email: 'l.petit@ftsi.fr', couleur: '#D97706', isAdmin: false, isConfigurateur: false, isActive: true },
  ];
  users.forEach(u => db.saveUser(u));

  // Catalogue (quelques exemples types)
  const byName = n => cats.find(c => c.nom === n)?.id;
  const catalogue = [
    { id: 'c1', titre: 'SIG', description: 'Entraînement SIG standard', categorieId: byName('SIG'), dureeHeures: 7 },
    { id: 'c2', titre: 'GLOCK', description: 'Entraînement GLOCK', categorieId: byName('GLOCK'), dureeHeures: 7 },
    { id: 'c3', titre: 'TASER - RECYCLAGE', description: 'Recyclage annuel TASER', categorieId: byName('TASER - RECYCLAGE'), dureeHeures: 4 },
    { id: 'c4', titre: 'OTUAS NIV 1', description: "Formation initiale OTUAS niveau 1", categorieId: byName('OTUAS NIV 1'), dureeHeures: 21 },
  ];
  catalogue.forEach(c => db.saveCatalogueItem(c));

  // Formations de démonstration
  const now = new Date();
  const dt = (dj, hh, mm=0) => {
    const d = new Date(now); d.setDate(d.getDate() + dj);
    d.setHours(hh, mm, 0, 0); return d.toISOString();
  };
  const formations = [
    { id: 'f1', categorieId: byName('SIG'), dateDebut: dt(7,9), dateFin: dt(7,17), lieu: 'Stand de tir A', formateurs: 'Jean Dupont', placesMax: 8, statut: 'validee', createdBy: 'u1' },
    { id: 'f2', categorieId: byName('GLOCK'), dateDebut: dt(14,9), dateFin: dt(14,17), lieu: 'Stand de tir B', formateurs: 'Pierre Durand', placesMax: 12, statut: 'validee', createdBy: 'u1' },
    { id: 'f3', categorieId: byName('OTUAS NIV 1'), dateDebut: dt(21,9), dateFin: dt(21,18), lieu: 'Salle de cours', formateurs: 'Marie Martin', placesMax: 10, statut: 'validee', createdBy: 'u1' },
    { id: 'f4', categorieId: byName('TASER - RECYCLAGE'), dateDebut: dt(28,8), dateFin: dt(28,16), lieu: 'Site technique', formateurs: 'Lucas Petit', placesMax: 6, statut: 'validee', createdBy: 'u1' },
    { id: 'f5', categorieId: byName('LBD - HABILITATION'), dateDebut: dt(35,14), dateFin: dt(35,18), lieu: 'Stand de tir A', formateurs: 'Jean Dupont, Sophie Bernard', placesMax: 15, statut: 'validee', createdBy: 'u1' },
    { id: 'f6', categorieId: byName('ROC'), dateDebut: dt(-7,9), dateFin: dt(-7,17), lieu: 'Terrain extérieur', formateurs: 'Pierre Durand', placesMax: 20, statut: 'validee', createdBy: 'u1' },
    { id: 'f7', categorieId: byName('EVA NIV 1'), dateDebut: dt(-14,9), dateFin: dt(-14,12), lieu: 'Salle de cours', formateurs: 'Marie Martin', placesMax: 12, statut: 'validee', createdBy: 'u1' },
    { id: 'f8', categorieId: byName('ADMINISTRATIF'), dateDebut: dt(42,9), dateFin: dt(42,17), lieu: 'Salle de réunion', formateurs: 'Jean Dupont', placesMax: 12, statut: 'validee', createdBy: 'u1' },
  ];
  formations.forEach(f => db.saveFormation(f));

  // Inscriptions
  const inscriptions = [
    { formationId: 'f1', userId: 'u1' }, { formationId: 'f1', userId: 'u2' }, { formationId: 'f1', userId: 'u4' },
    { formationId: 'f2', userId: 'u1' }, { formationId: 'f2', userId: 'u3' },
    { formationId: 'f3', userId: 'u2' }, { formationId: 'f3', userId: 'u1' },
    { formationId: 'f6', userId: 'u3' }, { formationId: 'f7', userId: 'u4' }, { formationId: 'f7', userId: 'u2' },
    { formationId: 'f4', userId: 'u5' }, { formationId: 'f5', userId: 'u5' },
  ];
  inscriptions.forEach(i => db.inscrire(i.formationId, i.userId));

  console.log('✅ Données de démo insérées');
}

/* Export global */
window.DB = LocalAdapter;
window.seedIfEmpty = seedIfEmpty;
