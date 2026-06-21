/**
 * app.js — Initialisation, utilitaires UI (toast, modal, confirm, dates)
 * Pas d'authentification, pas de navigation entre pages : Planning uniquement.
 */

const App = {
  _lastNotifId: null,
  _notifPermissionAsked: false,

  async init() {
    if (!DB.isConfigured()) {
      showNoConfigScreen();
      return;
    }
    hideNoConfigScreen();
    Pages.planning.render();
    await this._initLastNotifId();
    this._requestNotifPermission();
    this._refreshNotifBadge();
    // Vérifier les nouvelles notifications toutes les 20 secondes
    setInterval(() => this._checkNewNotifications(), 20000);
  },

  async _initLastNotifId() {
    try {
      const notifs = await DB.getNotifications(1);
      this._lastNotifId = notifs[0]?.id || null;
    } catch (e) { /* silencieux */ }
  },

  _requestNotifPermission() {
    if (this._notifPermissionAsked) return;
    this._notifPermissionAsked = true;
    if ('Notification' in window && Notification.permission === 'default') {
      // Demander la permission après un court délai pour ne pas bloquer le chargement initial
      setTimeout(() => { Notification.requestPermission(); }, 1500);
    }
  },

  async _checkNewNotifications() {
    try {
      const notifs = await DB.getNotifications(10);
      if (!notifs.length) return;

      const newest = notifs[0];
      if (this._lastNotifId && newest.id !== this._lastNotifId) {
        // Trouver toutes les notifs plus récentes que la dernière connue
        const idx = notifs.findIndex(n => n.id === this._lastNotifId);
        const fresh = idx === -1 ? notifs : notifs.slice(0, idx);
        fresh.reverse().forEach(n => this._showSystemNotification(n));
      }
      this._lastNotifId = newest.id;
      this._refreshNotifBadge();
    } catch (e) { /* silencieux */ }
  },

  _showSystemNotification(notif) {
    const icon = NOTIF_ICONS[notif.type] || 'ℹ️';
    // Notification système (visible même app en arrière-plan / écran verrouillé sur certains OS,
    // tant que le navigateur/l'onglet reste ouvert en arrière-plan)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Formations FTSI', {
          body: `${icon} ${notif.message}`,
          tag: notif.id,
          silent: false,
        });
      } catch (e) { /* certains navigateurs mobiles restreignent l'API */ }
    }
    // Toast in-app en complément
    toast(notif.message, 'info');
  },

  async _refreshNotifBadge() {
    try {
      const count = await DB.countUnread();
      const badge = document.getElementById('notif-badge');
      if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; }
      else { badge.style.display = 'none'; }
    } catch (e) { /* silencieux si pas encore configuré */ }
  },
};

/* ===== TOAST ===== */
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ===== MODAL ===== */
const Modal = {
  open(id)   { document.getElementById(id)?.classList.add('open'); },
  close(id)  { document.getElementById(id)?.classList.remove('open'); },
};

/* ===== CONFIRM ===== */
function confirmDialog(title, msg, onYes) {
  const el = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  el.style.display = 'flex';
  document.getElementById('confirm-yes').onclick = () => { el.style.display = 'none'; onYes(); };
  document.getElementById('confirm-no').onclick  = () => { el.style.display = 'none'; };
}

/* ===== DATE UTILS ===== */
const Fmt = {
  date(iso)      { if (!iso) return '—'; return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }); },
  dateShort(iso) { if (!iso) return ''; return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }); },
  time(iso)      { if (!iso) return ''; return new Date(iso).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }); },
  monthYear(d)   { return d.toLocaleDateString('fr-FR', { month:'long', year:'numeric' }); },
  dureeH(i1, i2) { if (!i1||!i2) return '—'; const h=(new Date(i2)-new Date(i1))/3600000; return h%1===0?`${h}h`:`${h.toFixed(1)}h`; },
  isoDate(d)     { const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; },
  relativeTime(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'à l\'instant';
    if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff/3600)} h`;
    if (diff < 604800) return `il y a ${Math.floor(diff/86400)} j`;
    return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  },
  // Numéro de semaine ISO 8601
  weekNumber(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (date.getDay() + 6) % 7; // lundi = 0
    date.setDate(date.getDate() - dayNum + 3); // jeudi de cette semaine
    const firstThursday = new Date(date.getFullYear(), 0, 4);
    const diff = date - firstThursday;
    return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  },
};

/* ===== STATUS ===== */
const STATUS = {
  validee: { label: 'Validée', cls: 'badge-success' },
  annulee: { label: 'Annulée', cls: 'badge-danger'  },
};
function statusBadge(s) {
  const st = STATUS[s] || { label: s, cls: 'badge-gray' };
  return `<span class="badge ${st.cls}">${st.label}</span>`;
}

/* ===== CRÉNEAUX HORAIRES ===== */
const CRENEAUX = {
  matin: { label: '🌅 Matin',      startH: 8,  startM: 0, endH: 12, endM: 0, endNextDay: false },
  aprem: { label: '☀️ Après-midi', startH: 13, startM: 0, endH: 17, endM: 0, endNextDay: false },
  nuit:  { label: '🌙 Nuit',       startH: 19, startM: 0, endH: 1,  endM: 0, endNextDay: true  },
};

/* Construit dateDebut/dateFin ISO à partir d'une date (YYYY-MM-DD) et d'un créneau.
   Le créneau "nuit" se termine après minuit : la date de fin passe au jour suivant. */
function buildCreneauDates(dateStr, creneauKey) {
  const c = CRENEAUX[creneauKey];
  if (!c || !dateStr) return { dateDebut: null, dateFin: null };
  const [y, m, d] = dateStr.split('-').map(Number);
  const debut = new Date(y, m - 1, d, c.startH, c.startM, 0);
  const fin   = new Date(y, m - 1, d, c.endH, c.endM, 0);
  if (c.endNextDay) fin.setDate(fin.getDate() + 1);
  return { dateDebut: debut.toISOString(), dateFin: fin.toISOString() };
}

/* Devine le créneau à partir d'une heure de début (pour l'édition) */
function guessCreneau(dateDebutIso) {
  if (!dateDebutIso) return 'matin';
  const h = new Date(dateDebutIso).getHours();
  if (h < 13) return 'matin';
  if (h < 19) return 'aprem';
  return 'nuit';
}

/* ===== NOTIFICATION TYPE ICONS ===== */
const NOTIF_ICONS = {
  creation:     '🆕',
  modification: '✏️',
  suppression:  '🗑',
  annulation:   '⚠️',
};

/* ===== DOM READY ===== */
document.addEventListener('DOMContentLoaded', () => {

  // Bouton refresh
  document.getElementById('refresh-btn').addEventListener('click', () => {
    const btn = document.getElementById('refresh-btn');
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.4s';
    setTimeout(() => { btn.style.transform = ''; }, 400);
    Pages.planning.refresh();
  });

  // Bouton notifications
  document.getElementById('notif-bell-btn').addEventListener('click', () => Pages.notifications.open());
  document.getElementById('notif-panel-close').addEventListener('click', () => Pages.notifications.close());
  document.getElementById('notif-panel-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) Pages.notifications.close();
  });

  // Menu latéral (hamburger)
  document.getElementById('menu-btn-open').addEventListener('click', () => {
    document.getElementById('side-menu-overlay').classList.add('open');
  });
  document.getElementById('menu-btn-close').addEventListener('click', () => {
    document.getElementById('side-menu-overlay').classList.remove('open');
  });
  document.getElementById('side-menu-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('side-menu-overlay').classList.remove('open');
  });
  document.getElementById('menu-btn-settings').addEventListener('click', () => {
    document.getElementById('side-menu-overlay').classList.remove('open');
    Pages.settings.open();
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) Modal.close(overlay.id); }));

  // Confirm dialog cancel
  document.getElementById('confirm-no').addEventListener('click', () =>
    document.getElementById('confirm-overlay').style.display = 'none');

  // Écran de configuration Supabase (1ère utilisation)
  const cfgForm = document.getElementById('no-config-form');
  if (cfgForm) {
    cfgForm.addEventListener('submit', async e => {
      e.preventDefault();
      const url = document.getElementById('nc-url').value.trim();
      const key = document.getElementById('nc-key').value.trim();
      if (!url || !key) { alert('URL et clé obligatoires'); return; }
      DB.saveSupabaseConfig({ url, anonKey: key });
      const btn = cfgForm.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Test…';
      const ok = await DB.ping().catch(() => false);
      if (ok) {
        hideNoConfigScreen();
        App.init();
      } else {
        btn.disabled = false; btn.textContent = '🔌 Se connecter à Supabase';
        alert('❌ Connexion impossible. Vérifiez l\'URL, la clé anon, et que le schéma SQL a bien été exécuté.');
        DB.saveSupabaseConfig({});
      }
    });
  }

  App.init();
});
