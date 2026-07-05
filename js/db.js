/**
 * db.js — Couche d'accès aux données Firestore (Firebase v9 modular)
 * Chargé via CDN dans index.html, aucun serveur ni build requis.
 * La config Firebase est le seul élément stocké en localStorage, par appareil.
 */

/* =========================================================
   CONFIG FIREBASE (seul élément en localStorage)
========================================================= */
const FirebaseConfig = {
  _key: 'ftsi_firebase_config',
  get() {
    try { return JSON.parse(localStorage.getItem(this._key) || '{}'); } catch { return {}; }
  },
  set(cfg) { localStorage.setItem(this._key, JSON.stringify(cfg)); },
  isReady() {
    const c = this.get();
    return !!(c.apiKey && c.projectId);
  },
  clear() { localStorage.removeItem(this._key); },
};

/* =========================================================
   INSTANCE FIRESTORE (initialisée après config)
========================================================= */
let _db = null;

function getDb() {
  if (!_db) throw new Error('Firestore non initialisé — configurez Firebase d\'abord.');
  return _db;
}

async function initFirestore() {
  const cfg = FirebaseConfig.get();
  if (!cfg.apiKey || !cfg.projectId) throw new Error('Configuration Firebase incomplète.');

  const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const { getFirestore, connectFirestoreEmulator } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  const app = getApps().length ? getApp() : initializeApp(cfg);
  _db = getFirestore(app);
  return _db;
}

/* =========================================================
   HELPERS FIRESTORE
========================================================= */
async function col(name) {
  const { collection } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  return collection(getDb(), name);
}

async function fsGetAll(collectionName, orderField = null) {
  const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const ref = collection(getDb(), collectionName);
  const q = orderField ? query(ref, orderBy(orderField)) : ref;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fsGet(collectionName, id) {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const ref = doc(getDb(), collectionName, id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function fsSet(collectionName, id, data) {
  const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const ref = doc(getDb(), collectionName, id);
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  await setDoc(ref, clean, { merge: true });
  return { id, ...clean };
}

async function fsDelete(collectionName, id) {
  const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  await deleteDoc(doc(getDb(), collectionName, id));
}

async function fsAdd(collectionName, data) {
  const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const ref = collection(getDb(), collectionName);
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const docRef = await addDoc(ref, clean);
  return { id: docRef.id, ...clean };
}

async function fsQuery(collectionName, filters = [], orderField = null) {
  const { collection, getDocs, query, orderBy, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const ref = collection(getDb(), collectionName);
  const constraints = [];
  filters.forEach(([field, op, value]) => constraints.push(where(field, op, value)));
  if (orderField) constraints.push(orderBy(orderField));
  const q = query(ref, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================================================
   GÉNÉRATEUR D'ID
========================================================= */
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* =========================================================
   DB — API PUBLIQUE (async, même interface qu'avant)
========================================================= */
const DB = {

  // ---- CONFIG ----
  getFirebaseConfig: () => FirebaseConfig.get(),
  saveFirebaseConfig: (cfg) => FirebaseConfig.set(cfg),
  clearFirebaseConfig: () => FirebaseConfig.clear(),
  isConfigured: () => FirebaseConfig.isReady(),

  async init() {
    await initFirestore();
  },

  async ping() {
    // Vérifie qu'on peut lire la collection catégories
    await fsGetAll('categories');
    return true;
  },

  // ---- CATEGORIES ----
  async getCategories() {
    const rows = await fsGetAll('categories', 'nom');
    return rows.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  },

  async saveCategory(cat) {
    const id = cat.id || newId();
    return fsSet('categories', id, { nom: cat.nom, couleur: cat.couleur || '#2563EB' });
  },

  // ---- LIEUX ----
  async getLieux() {
    const rows = await fsGetAll('lieux', 'nom');
    return rows.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  },

  async saveLieu(item) {
    const id = item.id || newId();
    return fsSet('lieux', id, { nom: item.nom });
  },

  async deleteLieu(id) {
    return fsDelete('lieux', id);
  },

  // ---- FORMATEURS ----
  async getFormateurs() {
    const rows = await fsGetAll('formateurs', 'nom');
    return rows.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  },

  async saveFormateur(item) {
    const id = item.id || newId();
    return fsSet('formateurs', id, { nom: item.nom });
  },

  async deleteFormateur(id) {
    return fsDelete('formateurs', id);
  },

  // ---- FORMATIONS ----
  async getFormations(filters = {}) {
    let rows = await fsGetAll('formations', 'dateDebut');

    if (filters.dateFrom) rows = rows.filter(f => f.dateDebut >= filters.dateFrom);
    if (filters.dateTo)   rows = rows.filter(f => f.dateDebut <= filters.dateTo);

    return rows.map(this._mapFormation).sort((a, b) => (a.dateDebut || '').localeCompare(b.dateDebut || ''));
  },

  async getFormationById(id) {
    const row = await fsGet('formations', id);
    return row ? this._mapFormation(row) : null;
  },

  async saveFormation(f) {
    const isEdit = !!f.id;
    const id = f.id || newId();
    const data = {
      categorieId:  f.categorieId  || null,
      description:  f.description  || '',
      dateDebut:    f.dateDebut    || null,
      dateFin:      f.dateFin      || null,
      lieu:         f.lieu         || '',
      formateurs:   f.formateurs   || '',
      placesMax:    f.placesMax    || 10,
      statut:       f.statut       || 'validee',
      updatedAt:    new Date().toISOString(),
    };
    const result = await fsSet('formations', id, data);
    const mapped = this._mapFormation({ id, ...data });

    // Notification
    const cats = await this.getCategories();
    const catName = cats.find(c => c.id === mapped.categorieId)?.nom || 'Formation';
    const dateStr = mapped.dateDebut ? new Date(mapped.dateDebut).toLocaleDateString('fr-FR') : '';
    await this.addNotification({
      formationId: id,
      type: isEdit ? 'modification' : 'creation',
      message: isEdit
        ? `Formation modifiée : ${catName} (${dateStr})`
        : `Nouvelle formation : ${catName} (${dateStr})`,
    });

    return mapped;
  },

  async deleteFormation(id) {
    const f = await this.getFormationById(id);
    const cats = await this.getCategories();
    const catName = cats.find(c => c.id === f?.categorieId)?.nom || 'Formation';
    const dateStr = f?.dateDebut ? new Date(f.dateDebut).toLocaleDateString('fr-FR') : '';
    await fsDelete('formations', id);
    await this.addNotification({
      formationId: id,
      type: 'suppression',
      message: `Formation supprimée : ${catName} (${dateStr})`,
    });
  },

  async setStatut(id, statut) {
    const f = await this.getFormationById(id);
    const cats = await this.getCategories();
    const catName = cats.find(c => c.id === f?.categorieId)?.nom || 'Formation';
    const dateStr = f?.dateDebut ? new Date(f.dateDebut).toLocaleDateString('fr-FR') : '';
    await fsSet('formations', id, { statut, updatedAt: new Date().toISOString() });
    await this.addNotification({
      formationId: id,
      type: statut === 'annulee' ? 'annulation' : 'modification',
      message: statut === 'annulee'
        ? `Formation annulée : ${catName} (${dateStr})`
        : `Formation validée : ${catName} (${dateStr})`,
    });
  },

  _mapFormation(row) {
    if (!row) return null;
    return {
      id:          row.id,
      categorieId: row.categorieId || null,
      description: row.description || '',
      dateDebut:   row.dateDebut   || null,
      dateFin:     row.dateFin     || null,
      lieu:        row.lieu        || '',
      formateurs:  row.formateurs  || '',
      placesMax:   row.placesMax   || 10,
      statut:      row.statut      || 'validee',
    };
  },

  // ---- NOTIFICATIONS ----
  async getNotifications(limit = 50) {
    const { collection, getDocs, query, orderBy, limit: fsLimit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const ref = collection(getDb(), 'notifications');
    const q = query(ref, orderBy('createdAt', 'desc'), fsLimit(limit));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async countUnread() {
    const rows = await fsQuery('notifications', [['lue', '==', false]]);
    return rows.length;
  },

  async addNotification({ formationId, type, message }) {
    return fsAdd('notifications', {
      formationId: formationId || null,
      type,
      message,
      lue: false,
      createdAt: new Date().toISOString(),
    });
  },

  async markNotificationRead(id) {
    return fsSet('notifications', id, { lue: true });
  },

  async markAllNotificationsRead() {
    const unread = await fsQuery('notifications', [['lue', '==', false]]);
    await Promise.all(unread.map(n => fsSet('notifications', n.id, { lue: true })));
  },
};

/* =========================================================
   ÉCRAN "PAS DE CONFIG"
========================================================= */
function showNoConfigScreen() {
  document.getElementById('app').style.display = 'none';
  const el = document.getElementById('no-config-screen');
  if (el) el.style.display = 'flex';
}
function hideNoConfigScreen() {
  const el = document.getElementById('no-config-screen');
  if (el) el.style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

window.DB = DB;
window.FirebaseConfig = FirebaseConfig;
window.newId = newId;
window.showNoConfigScreen = showNoConfigScreen;
window.hideNoConfigScreen = hideNoConfigScreen;
