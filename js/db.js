/**
 * db.js — Couche d'accès aux données
 * 100% Supabase REST API — aucun localStorage pour les données métier.
 * La configuration Supabase (URL + clé) est le seul élément stocké en local.
 */

/* =========================================================
   CONFIG SUPABASE
   Seule chose persistée en localStorage : l'URL et la clé anon.
========================================================= */
const SupabaseConfig = {
  _key: 'ftsi_supabase_config',
  get() {
    try { return JSON.parse(localStorage.getItem(this._key) || '{}'); } catch { return {}; }
  },
  set(cfg) { localStorage.setItem(this._key, JSON.stringify(cfg)); },
  isReady() { const c = this.get(); return !!(c.url && c.anonKey); },
};

/* =========================================================
   CLIENT REST SUPABASE
========================================================= */
const Supa = {
  _cfg() { return SupabaseConfig.get(); },

  _headers() {
    const { anonKey } = this._cfg();
    return {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Prefer': 'return=representation',
    };
  },

  _url(table, query = '') {
    const { url } = this._cfg();
    return `${url.replace(/\/$/, '')}/rest/v1/${table}${query ? '?' + query : ''}`;
  },

  async select(table, query = '') {
    const r = await fetch(this._url(table, query), {
      method: 'GET',
      headers: { ...this._headers(), 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error(`SELECT ${table} → ${r.status} ${await r.text()}`);
    return r.json();
  },

  async insert(table, data) {
    const r = await fetch(this._url(table), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`INSERT ${table} → ${r.status} ${await r.text()}`);
    const result = await r.json();
    return Array.isArray(result) ? result[0] : result;
  },

  async upsert(table, data) {
    const r = await fetch(this._url(table), {
      method: 'POST',
      headers: { ...this._headers(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`UPSERT ${table} → ${r.status} ${await r.text()}`);
    const result = await r.json();
    return Array.isArray(result) ? result[0] : result;
  },

  async update(table, id, data) {
    const r = await fetch(this._url(table, `id=eq.${id}`), {
      method: 'PATCH',
      headers: this._headers(),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`UPDATE ${table} → ${r.status} ${await r.text()}`);
    const result = await r.json();
    return Array.isArray(result) ? result[0] : result;
  },

  async delete(table, id) {
    const r = await fetch(this._url(table, `id=eq.${id}`), {
      method: 'DELETE',
      headers: this._headers(),
    });
    if (!r.ok) throw new Error(`DELETE ${table} → ${r.status} ${await r.text()}`);
  },

  async rpc(fn, params = {}) {
    const { url, anonKey } = this._cfg();
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error(`RPC ${fn} → ${r.status} ${await r.text()}`);
    return r.json();
  },

  // Test rapide de connexion
  async ping() {
    const r = await fetch(this._url('categories', 'limit=1'), {
      method: 'GET',
      headers: { ...this._headers(), 'Accept': 'application/json' },
    });
    return r.ok;
  },
};

/* =========================================================
   HASH MOT DE PASSE (simple, côté client)
========================================================= */
function hashPassword(pwd) {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    hash = ((hash << 5) - hash) + pwd.charCodeAt(i);
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + pwd.length;
}

/* =========================================================
   GÉNÉRATEUR D'ID
========================================================= */
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* =========================================================
   DB — API PUBLIQUE (toutes les fonctions sont async)
========================================================= */
const DB = {

  // ---- CONFIG ----
  getSupabaseConfig: () => SupabaseConfig.get(),
  saveSupabaseConfig: (cfg) => SupabaseConfig.set(cfg),
  isConfigured: () => SupabaseConfig.isReady(),
  ping: () => Supa.ping(),

  // ---- USERS ----
  async getUsers() {
    return Supa.select('users', 'is_active=eq.true&order=nom.asc');
  },

  async getUserById(id) {
    const rows = await Supa.select('users', `id=eq.${id}&limit=1`);
    return rows[0] || null;
  },

  async getUserByUsername(username) {
    const uname = (username || '').trim().toLowerCase();
    const rows = await Supa.select('users', `username=ilike.${uname}&limit=1`);
    return rows[0] || null;
  },

  async authenticate(username, password) {
    const uname = (username || '').trim().toLowerCase();
    const hash = hashPassword(password);
    const rows = await Supa.select('users',
      `username=ilike.${encodeURIComponent(uname)}&password_hash=eq.${encodeURIComponent(hash)}&is_active=eq.true&limit=1`
    );
    return rows[0] || null;
  },

  async saveUser(user) {
    const row = {
      id: user.id || newId(),
      username: user.username,
      password_hash: user.passwordHash || user.password_hash,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email || '',
      couleur: user.couleur || '#2563EB',
      is_admin: user.isAdmin || user.is_admin || false,
      is_configurateur: user.isConfigurateur || user.is_configurateur || false,
      is_active: user.isActive !== false && user.is_active !== false,
    };
    const result = await Supa.upsert('users', row);
    return this._mapUser(result);
  },

  async changePassword(userId, newPassword) {
    await Supa.update('users', userId, { password_hash: hashPassword(newPassword) });
  },

  async deleteUser(id) {
    await Supa.update('users', id, { is_active: false });
  },

  _mapUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      nom: row.nom,
      prenom: row.prenom,
      email: row.email || '',
      couleur: row.couleur || '#2563EB',
      isAdmin: row.is_admin || false,
      isConfigurateur: row.is_configurateur || false,
      isActive: row.is_active !== false,
    };
  },

  // ---- CATEGORIES ----
  async getCategories() {
    return Supa.select('categories', 'order=nom.asc');
  },

  async saveCategory(cat) {
    const row = { id: cat.id || newId(), nom: cat.nom, couleur: cat.couleur || '#2563EB' };
    return Supa.upsert('categories', row);
  },

  async deleteCategory(id) {
    return Supa.delete('categories', id);
  },

  // ---- CATALOGUE ----
  async getCatalogue() {
    return Supa.select('catalogue', 'order=titre.asc');
  },

  async saveCatalogueItem(item) {
    const row = {
      id: item.id || newId(),
      titre: item.titre,
      description: item.description || '',
      categorie_id: item.categorieId || item.categorie_id || null,
      duree_heures: item.dureeHeures || item.duree_heures || 0,
    };
    return Supa.upsert('catalogue', row);
  },

  async deleteCatalogueItem(id) {
    return Supa.delete('catalogue', id);
  },

  // ---- FORMATIONS ----
  async getFormations(filters = {}) {
    let query = 'order=date_debut.asc';

    if (filters.categorieId) query += `&categorie_id=eq.${filters.categorieId}`;
    if (filters.statut)      query += `&statut=eq.${filters.statut}`;
    if (filters.dateFrom)    query += `&date_debut=gte.${filters.dateFrom}`;
    if (filters.dateTo)      query += `&date_debut=lte.${filters.dateTo}`;

    let rows = await Supa.select('formations', query);

    // Filtre texte côté client (PostgREST ilike multi-colonnes = complexe)
    if (filters.search) {
      const q = filters.search.toLowerCase();
      // Récupérer les catégories pour chercher par nom
      let cats = [];
      try { cats = await this.getCategories(); } catch {}
      rows = rows.filter(f => {
        const catName = (cats.find(c => c.id === f.categorie_id)?.nom || '').toLowerCase();
        return catName.includes(q)
          || (f.lieu || '').toLowerCase().includes(q)
          || (f.formateurs || '').toLowerCase().includes(q);
      });
    }

    // Enrichir avec nb inscrits
    const allInscrits = await Supa.select('inscriptions', 'statut=eq.inscrit');
    return rows.map(f => ({
      ...this._mapFormation(f),
      inscritsCount: allInscrits.filter(i => i.formation_id === f.id).length,
    }));
  },

  async getFormationById(id) {
    const rows = await Supa.select('formations', `id=eq.${id}&limit=1`);
    if (!rows[0]) return null;
    const inscrits = await Supa.select('inscriptions', `formation_id=eq.${id}&statut=eq.inscrit`);
    return { ...this._mapFormation(rows[0]), inscritsCount: inscrits.length };
  },

  async saveFormation(f) {
    const row = {
      id: f.id || newId(),
      categorie_id: f.categorieId || f.categorie_id || null,
      description: f.description || '',
      date_debut: f.dateDebut || f.date_debut || null,
      date_fin: f.dateFin || f.date_fin || null,
      lieu: f.lieu || '',
      formateurs: f.formateurs || '',
      places_max: f.placesMax || f.places_max || 10,
      statut: f.statut || 'validee',
      created_by: f.createdBy || f.created_by || null,
    };
    const result = await Supa.upsert('formations', row);
    return this._mapFormation(result);
  },

  async deleteFormation(id) {
    await Supa.delete('formations', id);
  },

  async duplicateFormation(id, createdBy) {
    const f = await this.getFormationById(id);
    if (!f) return null;
    const copy = {
      ...f,
      id: newId(),
      statut: 'validee',
      createdBy,
    };
    delete copy.inscritsCount;
    return this.saveFormation(copy);
  },

  _mapFormation(row) {
    if (!row) return null;
    return {
      id: row.id,
      categorieId: row.categorie_id,
      description: row.description || '',
      dateDebut: row.date_debut,
      dateFin: row.date_fin,
      lieu: row.lieu || '',
      formateurs: row.formateurs || '',
      placesMax: row.places_max || 10,
      statut: row.statut || 'validee',
      createdBy: row.created_by,
      inscritsCount: row.inscritsCount || 0,
    };
  },

  // ---- INSCRIPTIONS ----
  async getInscriptions(formationId) {
    const rows = await Supa.select('inscriptions',
      `formation_id=eq.${formationId}&statut=eq.inscrit`);
    // Enrichir avec les infos utilisateur
    const users = await this.getUsers();
    return rows.map(i => ({
      ...i,
      user: users.find(u => u.id === i.user_id) || null,
    }));
  },

  async getUserFormations(userId) {
    const inscrits = await Supa.select('inscriptions',
      `user_id=eq.${userId}&statut=eq.inscrit`);
    if (!inscrits.length) return [];
    const ids = inscrits.map(i => `"${i.formation_id}"`).join(',');
    const rows = await Supa.select('formations',
      `id=in.(${inscrits.map(i => i.formation_id).join(',')})&order=date_debut.asc`);
    const allInscrits = await Supa.select('inscriptions', 'statut=eq.inscrit');
    return rows.map(f => ({
      ...this._mapFormation(f),
      inscritsCount: allInscrits.filter(i => i.formation_id === f.id).length,
    }));
  },

  async isInscrit(formationId, userId) {
    const rows = await Supa.select('inscriptions',
      `formation_id=eq.${formationId}&user_id=eq.${userId}&statut=eq.inscrit&limit=1`);
    return rows.length > 0;
  },

  async inscrire(formationId, userId) {
    // Upsert : si la ligne existe (annulée), on la remet en "inscrit"
    await Supa.upsert('inscriptions', {
      id: newId(),
      formation_id: formationId,
      user_id: userId,
      statut: 'inscrit',
    });
  },

  async desinscrire(formationId, userId) {
    const rows = await Supa.select('inscriptions',
      `formation_id=eq.${formationId}&user_id=eq.${userId}&limit=1`);
    if (rows[0]) await Supa.update('inscriptions', rows[0].id, { statut: 'annulee' });
  },

  // ---- STATS UTILISATEUR ----
  async getUserStats(userId) {
    const now = new Date().toISOString();
    const formations = await this.getUserFormations(userId);
    const aVenir  = formations.filter(f => f.dateDebut >= now);
    const passees = formations.filter(f => f.dateDebut && f.dateDebut < now);
    const heures  = passees.reduce((acc, f) => {
      if (f.dateDebut && f.dateFin) {
        return acc + (new Date(f.dateFin) - new Date(f.dateDebut)) / 3600000;
      }
      return acc;
    }, 0);
    return {
      aVenir:   aVenir.length,
      passees:  passees.length,
      heures:   Math.round(heures * 10) / 10,
    };
  },
};

/* =========================================================
   ÉCRAN "PAS DE CONFIG" — affiché si Supabase non configuré
========================================================= */
function showNoConfigScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display        = 'none';
  const el = document.getElementById('no-config-screen');
  if (el) el.style.display = 'flex';
}

function hideNoConfigScreen() {
  const el = document.getElementById('no-config-screen');
  if (el) el.style.display = 'none';
}

/* =========================================================
   EXPORT
========================================================= */
window.DB           = DB;
window.SupabaseConfig = SupabaseConfig;
window.hashPassword = hashPassword;
window.newId        = newId;
window.showNoConfigScreen = showNoConfigScreen;
window.hideNoConfigScreen = hideNoConfigScreen;
