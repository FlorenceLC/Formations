/**
 * app.js — État global, navigation, auth, utilitaires UI
 * Toutes les opérations DB sont async/await.
 */

/* ===== STATE ===== */
const App = {
  currentUser: null,
  currentPage: 'dashboard',
  _sessionKey: 'ftsi_session_user',

  async init() {
    // 1. Vérifier si Supabase est configuré
    if (!DB.isConfigured()) {
      showNoConfigScreen();
      return;
    }
    // 2. Essai de restauration de session (userId stocké en sessionStorage)
    const savedId = sessionStorage.getItem(this._sessionKey);
    if (savedId) {
      try {
        const user = await DB.getUserById(savedId);
        if (user) { this._startApp(this._mapUser(user)); return; }
      } catch (e) {
        console.warn('Session restore failed:', e);
      }
    }
    this.showLogin();
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    hideNoConfigScreen();
  },

  async doLogin(username, password) {
    setLoginLoading(true);
    try {
      const raw = await DB.authenticate(username, password);
      if (!raw) {
        setLoginLoading(false);
        showLoginError('Identifiant ou mot de passe incorrect.');
        return;
      }
      const user = this._mapUser(raw);
      sessionStorage.setItem(this._sessionKey, user.id);
      setLoginLoading(false);
      this._startApp(user);
    } catch (e) {
      setLoginLoading(false);
      showLoginError('Erreur de connexion à la base de données. Vérifiez la configuration Supabase.');
      console.error(e);
    }
  },

  _startApp(user) {
    this.currentUser = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this.renderSidebar();
    this.navigate('dashboard');
  },

  _mapUser(raw) {
    // Normaliser peu importe si les clés viennent de Supabase (snake_case) ou du seed
    return {
      id:              raw.id,
      username:        raw.username,
      nom:             raw.nom,
      prenom:          raw.prenom,
      email:           raw.email || '',
      couleur:         raw.couleur || '#2563EB',
      isAdmin:         raw.isAdmin     ?? raw.is_admin     ?? false,
      isConfigurateur: raw.isConfigurateur ?? raw.is_configurateur ?? false,
    };
  },

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem(this._sessionKey);
    this.showLogin();
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.page === page));
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');
    const titles = {
      dashboard: 'Tableau de bord',
      planning:  'Planning',
      formations:'Formations',
      catalogue: 'Catalogue',
      admin:     'Administration',
      profil:    'Mon profil',
    };
    document.getElementById('topbar-title').textContent = titles[page] || page;
    document.getElementById('content').scrollTop = 0;
    Pages[page]?.render();
    if (window.innerWidth <= 768) this.closeSidebar();
  },

  renderSidebar() {
    const u = this.currentUser;
    const initials = (u.prenom?.[0] || '') + (u.nom?.[0] || '');
    ['sidebar-avatar', 'topbar-avatar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = initials.toUpperCase(); el.style.background = u.couleur; }
    });
    document.getElementById('sidebar-user-name').textContent  = `${u.prenom} ${u.nom}`;
    document.getElementById('sidebar-user-role').textContent  = u.isConfigurateur ? '🔧 Configurateur' : (u.isAdmin ? '⭐ Administrateur' : 'Collaborateur');
    document.getElementById('topbar-user-name').textContent   = `${u.prenom} ${u.nom}`;
    document.getElementById('nav-admin').style.display        = u.isAdmin ? 'flex' : 'none';
    const cfgBtn = document.getElementById('tab-btn-config');
    if (cfgBtn) cfgBtn.style.display = u.isConfigurateur ? 'inline-flex' : 'none';
  },

  openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('open'); },
  closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); },
};

/* ===== LOGIN HELPERS ===== */
function setLoginLoading(on) {
  const btn = document.getElementById('login-submit-btn');
  if (btn) { btn.disabled = on; btn.textContent = on ? 'Connexion…' : 'Se connecter'; }
}
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = '⚠  ' + msg; el.style.display = 'block'; }
}

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
  open(id)    { document.getElementById(id)?.classList.add('open'); },
  close(id)   { document.getElementById(id)?.classList.remove('open'); },
  closeAll()  { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); },
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
};

/* ===== STATUS ===== */
const STATUS = {
  validee: { label: 'Validée',  cls: 'badge-success' },
  annulee: { label: 'Annulée',  cls: 'badge-danger'  },
};
function statusBadge(s) {
  const st = STATUS[s] || { label: s, cls: 'badge-gray' };
  return `<span class="badge ${st.cls}">${st.label}</span>`;
}

/* ===== LOADING OVERLAY ===== */
function showLoading(msg = 'Chargement…') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;z-index:8888;';
    el.innerHTML = `<div style="background:#fff;border-radius:12px;padding:24px 32px;font-weight:600;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.15);">⏳ ${msg}</div>`;
    document.body.appendChild(el);
  }
}
function hideLoading() {
  document.getElementById('loading-overlay')?.remove();
}

/* ===== DOM READY ===== */
document.addEventListener('DOMContentLoaded', () => {

  // Login form
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('login-error').style.display = 'none';
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    await App.doLogin(username, password);
  });

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-page]').forEach(el =>
    el.addEventListener('click', () => App.navigate(el.dataset.page)));

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () =>
    confirmDialog('Déconnexion', 'Voulez-vous vous déconnecter ?', () => App.logout()));

  // Mobile sidebar
  document.getElementById('topbar-menu-btn').addEventListener('click', () => App.openSidebar());
  document.getElementById('sidebar-overlay').addEventListener('click', () => App.closeSidebar());

  // Close modals on backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) Modal.close(overlay.id); }));

  // Confirm dialog cancel
  document.getElementById('confirm-no').addEventListener('click', () =>
    document.getElementById('confirm-overlay').style.display = 'none');

  // Écran de config Supabase (si pas encore configuré)
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
        App.showLogin();
      } else {
        btn.disabled = false; btn.textContent = 'Se connecter';
        alert('❌ Connexion impossible. Vérifiez l\'URL et la clé anon Supabase, et que le schéma SQL a bien été exécuté.');
        DB.saveSupabaseConfig({});
      }
    });
  }

  // Init app
  App.init();
});
