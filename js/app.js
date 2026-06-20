/**
 * app.js — Initialisation, utilitaires UI (toast, modal, confirm, dates)
 * Pas d'authentification, pas de navigation entre pages : Planning uniquement.
 */

const App = {
  async init() {
    if (!DB.isConfigured()) {
      showNoConfigScreen();
      return;
    }
    hideNoConfigScreen();
    Pages.planning.render();
    this._refreshNotifBadge();
    // Rafraîchir le badge de notifications périodiquement
    setInterval(() => this._refreshNotifBadge(), 30000);
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
  isoDate(d)     { return d.toISOString().slice(0,10); },
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

/* ===== NOTIFICATION TYPE ICONS ===== */
const NOTIF_ICONS = {
  creation:     '🆕',
  modification: '✏️',
  suppression:  '🗑',
  annulation:   '⚠️',
};

/* ===== DOM READY ===== */
document.addEventListener('DOMContentLoaded', () => {

  // Bouton notifications
  document.getElementById('notif-bell-btn').addEventListener('click', () => Pages.notifications.open());
  document.getElementById('notif-panel-close').addEventListener('click', () => Pages.notifications.close());
  document.getElementById('notif-panel-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) Pages.notifications.close();
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

  // Lien "changer la configuration" (optionnel, accessible discrètement)
  const changeCfgBtn = document.getElementById('btn-change-config');
  if (changeCfgBtn) {
    changeCfgBtn.addEventListener('click', () => {
      confirmDialog('Changer de base', 'Voulez-vous reconfigurer la connexion à Supabase ?', () => {
        DB.saveSupabaseConfig({});
        showNoConfigScreen();
      });
    });
  }

  App.init();
});
