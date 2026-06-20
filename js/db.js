/**
 * db.js — Couche d'accès Supabase
 * Pas d'authentification. Pas de localStorage pour les données métier.
 * Seule la config Supabase (URL + clé) est stockée en local, par appareil.
 */

/* =========================================================
   CONFIG SUPABASE (seul élément en localStorage)
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

  async ping() {
    const r = await fetch(this._url('categories', 'limit=1'), {
      method: 'GET',
      headers: { ...this._headers(), 'Accept': 'application/json' },
    });
    return r.ok;
  },
};

/* =========================================================
   GÉNÉRATEUR D'ID
========================================================= */
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* =========================================================
   DB — API PUBLIQUE (async)
========================================================= */
const DB = {

  // ---- CONFIG ----
  getSupabaseConfig: () => SupabaseConfig.get(),
  saveSupabaseConfig: (cfg) => SupabaseConfig.set(cfg),
  isConfigured: () => SupabaseConfig.isReady(),
  ping: () => Supa.ping(),

  // ---- CATEGORIES ----
  async getCategories() {
    return Supa.select('categories', 'order=nom.asc');
  },

  async saveCategory(cat) {
    const row = { id: cat.id || newId(), nom: cat.nom, couleur: cat.couleur || '#2563EB' };
    return Supa.upsert('categories', row);
  },

  // ---- LIEUX ----
  async getLieux() {
    return Supa.select('lieux', 'order=nom.asc');
  },
  async saveLieu(item) {
    const row = { id: item.id || newId(), nom: item.nom };
    return Supa.upsert('lieux', row);
  },
  async deleteLieu(id) {
    return Supa.delete('lieux', id);
  },

  // ---- FORMATEURS ----
  async getFormateurs() {
    return Supa.select('formateurs', 'order=nom.asc');
  },
  async saveFormateur(item) {
    const row = { id: item.id || newId(), nom: item.nom };
    return Supa.upsert('formateurs', row);
  },
  async deleteFormateur(id) {
    return Supa.delete('formateurs', id);
  },

  // ---- FORMATIONS ----
  async getFormations(filters = {}) {
    let query = 'order=date_debut.asc';
    if (filters.dateFrom) query += `&date_debut=gte.${filters.dateFrom}`;
    if (filters.dateTo)   query += `&date_debut=lte.${filters.dateTo}`;
    const rows = await Supa.select('formations', query);
    return rows.map(this._mapFormation);
  },

  async getFormationById(id) {
    const rows = await Supa.select('formations', `id=eq.${id}&limit=1`);
    return rows[0] ? this._mapFormation(rows[0]) : null;
  },

  async saveFormation(f) {
    const isEdit = !!f.id;
    const row = {
      id: f.id || newId(),
      categorie_id: f.categorieId || null,
      description: f.description || '',
      date_debut: f.dateDebut || null,
      date_fin: f.dateFin || null,
      lieu: f.lieu || '',
      formateurs: f.formateurs || '',
      places_max: f.placesMax || 10,
      statut: f.statut || 'validee',
      updated_at: new Date().toISOString(),
    };
    const result = await Supa.upsert('formations', row);
    const mapped = this._mapFormation(result);

    // Notification de création / modification
    const cats = await this.getCategories();
    const catName = cats.find(c => c.id === mapped.categorieId)?.nom || 'Formation';
    const dateStr = mapped.dateDebut ? new Date(mapped.dateDebut).toLocaleDateString('fr-FR') : '';
    await this.addNotification({
      formationId: mapped.id,
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
    await Supa.delete('formations', id);
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
    await Supa.update('formations', id, { statut, updated_at: new Date().toISOString() });
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
      id: row.id,
      categorieId: row.categorie_id,
      description: row.description || '',
      dateDebut: row.date_debut,
      dateFin: row.date_fin,
      lieu: row.lieu || '',
      formateurs: row.formateurs || '',
      placesMax: row.places_max || 10,
      statut: row.statut || 'validee',
    };
  },

  // ---- NOTIFICATIONS ----
  async getNotifications(limit = 50) {
    return Supa.select('notifications', `order=created_at.desc&limit=${limit}`);
  },

  async countUnread() {
    const rows = await Supa.select('notifications', 'lue=eq.false&select=id');
    return rows.length;
  },

  async addNotification({ formationId, type, message }) {
    return Supa.insert('notifications', {
      id: newId(),
      formation_id: formationId || null,
      type,
      message,
      lue: false,
    });
  },

  async markNotificationRead(id) {
    await Supa.update('notifications', id, { lue: true });
  },

  async markAllNotificationsRead() {
    const unread = await Supa.select('notifications', 'lue=eq.false&select=id');
    await Promise.all(unread.map(n => Supa.update('notifications', n.id, { lue: true })));
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

/* =========================================================
   EXPORT
========================================================= */
window.DB = DB;
window.SupabaseConfig = SupabaseConfig;
window.newId = newId;
window.showNoConfigScreen = showNoConfigScreen;
window.hideNoConfigScreen = hideNoConfigScreen;
