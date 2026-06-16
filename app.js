/**
 * app.js — État global, navigation, auth, utilitaires UI
 */

/* ===== STATE ===== */
const App = {
  currentUser: null,
  currentPage: 'dashboard',

  init() {
    seedIfEmpty();
    this.checkSession();
  },

  checkSession() {
    const saved = sessionStorage.getItem('ftsi_session');
    if (saved) {
      const user = DB.getUserById(saved);
      if (user) { this.loginSuccess(user); return; }
    }
    this.showLogin();
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  },

  loginSuccess(user) {
    this.currentUser = user;
    sessionStorage.setItem('ftsi_session', user.id);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this.renderSidebar();
    this.navigate('dashboard');
  },

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('ftsi_session');
    this.showLogin();
  },

  navigate(page) {
    this.currentPage = page;
    // Update sidebar active
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // Show page
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');
    // Update topbar title
    const titles = {
      dashboard: 'Tableau de bord',
      planning: 'Planning',
      formations: 'Formations',
      catalogue: 'Catalogue',
      admin: 'Administration',
      profil: 'Mon profil',
    };
    document.getElementById('topbar-title').textContent = titles[page] || page;
    // Scroll to top
    document.getElementById('content').scrollTop = 0;
    // Render page
    Pages[page]?.render();
    // Close sidebar on mobile
    if (window.innerWidth <= 768) this.closeSidebar();
  },

  renderSidebar() {
    const u = this.currentUser;
    // Avatar
    const initials = (u.prenom?.[0] || '') + (u.nom?.[0] || '');
    document.getElementById('sidebar-avatar').textContent = initials.toUpperCase();
    document.getElementById('sidebar-avatar').style.background = u.couleur || '#2563EB';
    document.getElementById('topbar-avatar').textContent = initials.toUpperCase();
    document.getElementById('topbar-avatar').style.background = u.couleur || '#2563EB';
    document.getElementById('sidebar-user-name').textContent = `${u.prenom} ${u.nom}`;
    document.getElementById('sidebar-user-role').textContent = u.isAdmin ? '⭐ Administrateur' : 'Collaborateur';
    document.getElementById('topbar-user-name').textContent = `${u.prenom} ${u.nom}`;
    // Show/hide admin nav
    document.getElementById('nav-admin').style.display = u.isAdmin ? 'flex' : 'none';
  },

  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('open');
  },
  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
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
  open(id) { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); },
  closeAll() { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); },
};

/* ===== CONFIRM DIALOG ===== */
function confirm(title, msg, onYes) {
  const el = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  el.style.display = 'flex';
  document.getElementById('confirm-yes').onclick = () => { el.style.display = 'none'; onYes(); };
  document.getElementById('confirm-no').onclick = () => { el.style.display = 'none'; };
}

/* ===== DATE UTILS ===== */
const Fmt = {
  date(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  dateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  },
  time(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  },
  datetime(iso) { return iso ? `${this.date(iso)} ${this.time(iso)}` : '—'; },
  weekday(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long' });
  },
  monthYear(date) {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  },
  dureeH(iso1, iso2) {
    if (!iso1 || !iso2) return '—';
    const h = (new Date(iso2) - new Date(iso1)) / 3600000;
    return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
  },
  isoDate(date) { return date.toISOString().slice(0, 10); },
};

/* ===== STATUS LABELS ===== */
const STATUS = {
  validee: { label: 'Validée', cls: 'badge-success' },
  en_attente: { label: 'En attente', cls: 'badge-warning' },
  annulee: { label: 'Annulée', cls: 'badge-danger' },
};
function statusBadge(statut) {
  const s = STATUS[statut] || { label: statut, cls: 'badge-gray' };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

/* ===== ID generator ===== */
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* ===== DOM ready ===== */
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Login form
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const user = DB.authenticate(username, password);
    if (user) {
      document.getElementById('login-error').style.display = 'none';
      App.loginSuccess(user);
    } else {
      const err = document.getElementById('login-error');
      err.style.display = 'block';
      err.textContent = '⚠  Identifiant ou mot de passe incorrect.';
      document.getElementById('login-password').value = '';
    }
  });

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => App.navigate(el.dataset.page));
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    confirm('Déconnexion', 'Voulez-vous vous déconnecter ?', () => App.logout());
  });

  // Mobile sidebar
  document.getElementById('topbar-menu-btn').addEventListener('click', () => App.openSidebar());
  document.getElementById('sidebar-overlay').addEventListener('click', () => App.closeSidebar());

  // Close modals on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) Modal.close(overlay.id); });
  });

  // Confirm dialog
  document.getElementById('confirm-no').addEventListener('click', () => {
    document.getElementById('confirm-overlay').style.display = 'none';
  });
});
