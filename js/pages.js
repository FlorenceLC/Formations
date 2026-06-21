/**
 * pages.js — Planning + Notifications (seules pages de l'application)
 */

async function run(fn) {
  try { await fn(); }
  catch (e) { toast('Erreur : ' + e.message, 'error'); console.error(e); }
}

const Pages = {

  /* ========================================================
     PLANNING
  ======================================================== */
  planning: {
    view: 'month',          // 'month' | 'week'
    currentDate: new Date(),
    filterFormateur: localStorage.getItem('ftsi_filter_formateur') || '',
    _formateursLoaded: false,

    render() { run(() => this._render()); },

    async _render() {
      this._renderControls();
      this._updateLegend();
      await this._loadFormateurFilter();
      const container = document.getElementById('planning-view');
      let formations, cats;
      try {
        [formations, cats] = await Promise.all([DB.getFormations(), DB.getCategories()]);
      } catch (e) {
        this._renderError(container, e);
        return;
      }
      if (this.view === 'month') this._renderMonth(container, formations, cats);
      else                       this._renderWeek(container, formations, cats);
    },

    _renderError(container, e) {
      const msg = e.message || '';
      const is404 = msg.includes('404');
      const is401 = msg.includes('401');
      let hint = 'Vérifiez la configuration Supabase.';
      if (is404) hint = 'La table "formations" n\'existe pas encore — le script sql/schema.sql n\'a probablement pas été exécuté dans Supabase.';
      if (is401) hint = 'Clé d\'accès invalide — vérifiez la clé "anon public" dans les Paramètres.';
      container.innerHTML = `
        <div class="empty-state" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);">
          <div class="empty-icon">⚠️</div>
          <p style="font-weight:700;margin-bottom:8px;">Impossible de charger le planning</p>
          <p style="font-size:13px;max-width:420px;margin:0 auto 18px;line-height:1.5;">${hint}</p>
          <button class="btn btn-primary" onclick="Pages.settings.open()">⚙️ Ouvrir les paramètres</button>
        </div>`;
    },

    _renderControls() {
      const label = this.view === 'month'
        ? Fmt.monthYear(this.currentDate)
        : (() => {
            const ws = this._weekStart(this.currentDate);
            const we = new Date(ws); we.setDate(we.getDate() + 4); // vendredi
            return `${Fmt.dateShort(ws.toISOString())} — ${Fmt.dateShort(we.toISOString())} ${ws.getFullYear()}`;
          })();
      document.getElementById('planning-label').textContent = label.charAt(0).toUpperCase() + label.slice(1);

      // Numéro de semaine affiché en vue semaine
      const weekBadge = document.getElementById('week-number-badge');
      if (this.view === 'week') {
        const wn = Fmt.weekNumber(this._weekStart(this.currentDate));
        weekBadge.textContent = `S${wn}`;
        weekBadge.style.display = 'inline-flex';
      } else {
        weekBadge.style.display = 'none';
      }
    },

    _weekStart(d) {
      const s = new Date(d);
      const day = s.getDay() === 0 ? 6 : s.getDay() - 1; // lundi = 0
      s.setDate(s.getDate() - day); s.setHours(0,0,0,0); return s;
    },

    async _loadFormateurFilter() {
      if (this._formateursLoaded) return;
      try {
        const formateurs = await DB.getFormateurs();
        const sel = document.getElementById('filter-formateur');
        sel.innerHTML = '<option value="">👨‍🏫 Tous les formateurs</option>';
        formateurs.forEach(f => {
          const o = document.createElement('option');
          o.value = f.nom; o.textContent = f.nom;
          sel.appendChild(o);
        });
        // Si le formateur précédemment filtré n'existe plus, revenir à "Tous"
        const stillExists = !this.filterFormateur || formateurs.some(f => f.nom === this.filterFormateur);
        if (!stillExists) {
          this.filterFormateur = '';
          localStorage.removeItem('ftsi_filter_formateur');
        }
        sel.value = this.filterFormateur;
        this._formateursLoaded = true;
      } catch (e) { /* silencieux, sera retenté au prochain render */ }
    },

    setFilterFormateur(nom) {
      this.filterFormateur = nom;
      // Préférence personnelle de l'appareil uniquement — jamais envoyée à Supabase
      if (nom) localStorage.setItem('ftsi_filter_formateur', nom);
      else localStorage.removeItem('ftsi_filter_formateur');
      this._updateLegend();
      this.render();
    },

    _updateLegend() {
      const legend = document.getElementById('planning-legend');
      if (this.filterFormateur) {
        legend.innerHTML = `
          <span><span class="legend-swatch" style="background:var(--primary-light);border-left:3px solid var(--primary);"></span>Formations de <strong>${this.filterFormateur}</strong></span>
          <span><span class="legend-swatch" style="background:#F1F5F9;border-left:3px solid var(--text-light);"></span>Autres formateurs</span>
          <span><span class="legend-swatch" style="background:var(--danger-light);border-left:3px solid var(--danger);"></span>Formation annulée</span>
        `;
      } else {
        legend.innerHTML = `
          <span><span class="legend-swatch" style="background:var(--primary-light);border-left:3px solid var(--primary);"></span>Formation planifiée</span>
          <span><span class="legend-swatch" style="background:var(--danger-light);border-left:3px solid var(--danger);"></span>Formation annulée</span>
          <span>💡 Cliquez sur une formation pour voir le détail</span>
        `;
      }
    },

    _matchesFilter(f) {
      if (!this.filterFormateur) return true;
      const noms = (f.formateurs || '').split(',').map(s => s.trim());
      return noms.includes(this.filterFormateur);
    },

    /* Le calendrier n'affiche pas le week-end : si on est samedi ou dimanche,
       on met en avant le lundi suivant comme repère "aujourd'hui". */
    _highlightDate() {
      const d = new Date(); d.setHours(0,0,0,0);
      const day = d.getDay(); // 0 = dimanche, 6 = samedi
      if (day === 6) d.setDate(d.getDate() + 2); // samedi -> lundi
      if (day === 0) d.setDate(d.getDate() + 1); // dimanche -> lundi
      return d;
    },

    /* ---- VUE MOIS (lundi → vendredi uniquement) ---- */
    _renderMonth(container, formations, cats) {
      const year  = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const first = new Date(year, month, 1);
      const last  = new Date(year, month + 1, 0);
      const today = this._highlightDate();

      const byDate = {};
      formations.forEach(f => {
        if (!f.dateDebut) return;
        const key = Fmt.isoDate(new Date(f.dateDebut));
        (byDate[key] = byDate[key] || []).push(f);
      });

      // Construire la liste des semaines (lundi à vendredi) couvrant le mois
      let weekStart = this._weekStart(first);
      const weeks = [];
      while (true) {
        const days = [];
        for (let i = 0; i < 5; i++) { // lundi → vendredi
          const d = new Date(weekStart); d.setDate(d.getDate() + i);
          days.push(d);
        }
        weeks.push({ weekNum: Fmt.weekNumber(weekStart), days });
        weekStart = new Date(weekStart); weekStart.setDate(weekStart.getDate() + 7);
        if (days[4] >= last) break;
        if (weeks.length > 7) break; // sécurité anti-boucle infinie
      }

      let html = `<div class="cal-grid">
        <div class="cal-header">
          ${['Lundi','Mardi','Mercredi','Jeudi','Vendredi'].map(d => `<div class="cal-day-header">${d}</div>`).join('')}
        </div>
        <div class="cal-body" style="grid-template-rows: repeat(${weeks.length}, 1fr); display:grid; grid-auto-flow:row;">`;

      weeks.forEach(week => {
        week.days.forEach((d, idx) => {
          const isCurrent = d.getMonth() === month;
          const isToday   = d.getTime() === today.getTime();
          const key       = Fmt.isoDate(d);
          const dayForms  = byDate[key] || [];

          html += `<div class="cal-cell${!isCurrent ? ' other-month' : ''}${isToday ? ' today' : ''}" style="grid-column:${idx+1};">`;
          html += `<div style="display:flex;align-items:center;gap:6px;">
                      <div class="day-num">${d.getDate()}</div>
                      ${idx === 0 ? `<span style="font-size:10px;font-weight:700;color:var(--text-light);">S${week.weekNum}</span>` : ''}
                    </div>`;

          dayForms.slice(0, 4).forEach(f => {
            const cat = cats.find(c => c.id === f.categorieId);
            const isAnnulee = f.statut === 'annulee';
            const isFilteredOut = !isAnnulee && !this._matchesFilter(f);
            const cls = isAnnulee ? ' annulee' : (isFilteredOut ? ' filtered-out' : '');
            html += `<div class="cal-event${cls}"
              title="${cat?.nom||'—'}\n⏰ ${Fmt.time(f.dateDebut)}\n👨‍🏫 ${f.formateurs||'—'}\n📍 ${f.lieu||'—'}"
              onclick="Pages.planning._openDetail('${f.id}')">
              <div class="cal-event-cat">${cat?.nom || '—'}</div>
              <div class="cal-event-meta">⏰ ${Fmt.time(f.dateDebut)} · 👨‍🏫 ${f.formateurs||'—'}</div>
            </div>`;
          });
          if (dayForms.length > 4)
            html += `<div class="cal-more" onclick="Pages.planning._openDetail('${dayForms[4].id}')">+${dayForms.length - 4} autre(s)</div>`;

          html += `</div>`;
        });
      });

      html += `</div></div>`;
      container.innerHTML = html;
    },

    /* ---- VUE SEMAINE (lundi → vendredi) ---- */
    _renderWeek(container, formations, cats) {
      const ws = this._weekStart(this.currentDate);
      const today = this._highlightDate();
      const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];

      let html = '<div class="week-grid">';
      for (let i = 0; i < 5; i++) {
        const d = new Date(ws); d.setDate(d.getDate() + i); d.setHours(0,0,0,0);
        const isToday  = d.getTime() === today.getTime();
        const key      = Fmt.isoDate(d);
        const dayForms = formations.filter(f => f.dateDebut && Fmt.isoDate(new Date(f.dateDebut)) === key);

        html += `<div class="week-col${isToday ? ' today' : ''} show">
          <div class="week-col-header"><div class="wday">${jours[i]}</div><div class="wdate">${d.getDate()}</div></div>
          <div class="week-col-body">`;

        if (!dayForms.length) {
          html += '<div class="week-empty">Aucune formation</div>';
        } else {
          dayForms.forEach(f => {
            const cat = cats.find(c => c.id === f.categorieId);
            const isAnnulee = f.statut === 'annulee';
            const isFilteredOut = !isAnnulee && !this._matchesFilter(f);
            const cls = isAnnulee ? ' annulee' : (isFilteredOut ? ' filtered-out' : '');
            html += `<div class="week-event${cls}" onclick="Pages.planning._openDetail('${f.id}')">
              <div class="week-event-cat">${cat?.nom || '—'}</div>
              <div class="week-event-meta">⏰ ${Fmt.time(f.dateDebut)} – ${Fmt.time(f.dateFin)}</div>
              <div class="week-event-meta">👨‍🏫 ${f.formateurs||'—'}</div>
              <div class="week-event-meta">📍 ${f.lieu||'—'}</div>
              <div class="week-event-meta">👥 ${f.placesMax} places</div>
            </div>`;
          });
        }
        html += `</div></div>`;
      }
      html += '</div>';
      container.innerHTML = html;
    },

    prev() {
      if (this.view === 'month') this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      else this.currentDate.setDate(this.currentDate.getDate() - 7);
      this.render();
    },
    next() {
      if (this.view === 'month') this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      else this.currentDate.setDate(this.currentDate.getDate() + 7);
      this.render();
    },
    today() { this.currentDate = new Date(); this.render(); },
    refresh() { toast('Planning actualisé 🔄', 'info'); this.render(); App._refreshNotifBadge(); },
    switchView(v) {
      this.view = v;
      document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
      this.render();
    },

    /* ---- DÉTAIL D'UNE FORMATION ---- */
    _openDetail(id) {
      run(async () => {
        const [f, cats] = await Promise.all([DB.getFormationById(id), DB.getCategories()]);
        if (!f) return;
        const cat = cats.find(c => c.id === f.categorieId);

        document.getElementById('detail-modal-title').textContent = cat?.nom || '—';
        document.getElementById('detail-modal-body').innerHTML = `
          <div class="detail-row"><span class="detail-icon">🏷</span><div><div class="detail-key">Catégorie</div><div class="detail-val">${cat?.nom||'—'}</div></div></div>
          <div class="detail-row"><span class="detail-icon">⏰</span><div><div class="detail-key">Horaires</div><div class="detail-val">${Fmt.date(f.dateDebut)} · ${Fmt.time(f.dateDebut)} – ${Fmt.time(f.dateFin)} (${Fmt.dureeH(f.dateDebut,f.dateFin)})</div></div></div>
          <div class="detail-row"><span class="detail-icon">👨‍🏫</span><div><div class="detail-key">Formateurs</div><div class="detail-val">${f.formateurs||'—'}</div></div></div>
          <div class="detail-row"><span class="detail-icon">📍</span><div><div class="detail-key">Lieu</div><div class="detail-val">${f.lieu||'—'}</div></div></div>
          <div class="detail-row"><span class="detail-icon">👥</span><div><div class="detail-key">Places maximum</div><div class="detail-val">${f.placesMax}</div></div></div>
          <div class="detail-row"><span class="detail-icon">🔖</span><div><div class="detail-key">Statut</div><div class="detail-val">${statusBadge(f.statut)}</div></div></div>
          ${f.description ? `<div class="detail-row"><span class="detail-icon">📝</span><div><div class="detail-key">Description</div><div class="detail-val">${f.description}</div></div></div>` : ''}
        `;

        const footer = document.getElementById('detail-modal-footer');
        footer.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-ghost'; closeBtn.textContent = 'Fermer';
        closeBtn.onclick = () => Modal.close('detail-modal');
        footer.appendChild(closeBtn);

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary'; editBtn.textContent = '✏️ Modifier';
        editBtn.onclick = () => { Modal.close('detail-modal'); this._openForm(id); };
        footer.appendChild(editBtn);

        if (f.statut !== 'annulee') {
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'btn btn-danger'; cancelBtn.textContent = '✖ Annuler la formation';
          cancelBtn.onclick = () => {
            confirmDialog('Annuler la formation', `Confirmer l'annulation de « ${cat?.nom} » ?`, () => {
              run(async () => {
                await DB.setStatut(id, 'annulee');
                toast('Formation annulée', 'info');
                Modal.close('detail-modal');
                this.render();
                App._refreshNotifBadge();
              });
            });
          };
          footer.appendChild(cancelBtn);
        } else {
          const validateBtn = document.createElement('button');
          validateBtn.className = 'btn btn-success'; validateBtn.textContent = '✔ Réactiver';
          validateBtn.onclick = () => {
            run(async () => {
              await DB.setStatut(id, 'validee');
              toast('Formation réactivée', 'success');
              Modal.close('detail-modal');
              this.render();
              App._refreshNotifBadge();
            });
          };
          footer.appendChild(validateBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-icon'; deleteBtn.style.background = 'var(--danger-light)'; deleteBtn.style.color = 'var(--danger)';
        deleteBtn.textContent = '🗑'; deleteBtn.title = 'Supprimer';
        deleteBtn.onclick = () => {
          confirmDialog('Supprimer', `Supprimer définitivement « ${cat?.nom} » du ${Fmt.date(f.dateDebut)} ?`, () => {
            run(async () => {
              await DB.deleteFormation(id);
              toast('Formation supprimée', 'info');
              Modal.close('detail-modal');
              this.render();
              App._refreshNotifBadge();
            });
          });
        };
        footer.appendChild(deleteBtn);

        Modal.open('detail-modal');
      });
    },

    /* ---- FORMULAIRE CRÉATION / MODIFICATION ---- */
    async _openForm(id = null) {
      const isEdit = !!id;
      const [f, cats, lieux, formateurs] = await Promise.all([
        id ? DB.getFormationById(id) : Promise.resolve(null),
        DB.getCategories(),
        DB.getLieux(),
        DB.getFormateurs(),
      ]);

      document.getElementById('form-modal-title').textContent = isEdit ? '✏️  Modifier la formation' : '➕  Nouvelle formation';

      // Catégories
      const sel = document.getElementById('form-categorie');
      sel.innerHTML = '<option value="">— Sélectionner —</option>';
      cats.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=c.nom; sel.appendChild(o); });
      sel.innerHTML += '<option value="__new__">➕ Nouvelle catégorie...</option>';

      // Lieux
      const lieuSel = document.getElementById('form-lieu');
      lieuSel.innerHTML = '<option value="">— Sélectionner —</option>';
      lieux.forEach(l => { const o=document.createElement('option'); o.value=l.nom; o.textContent=l.nom; lieuSel.appendChild(o); });

      // Formateurs (multi-select)
      const formSel = document.getElementById('form-formateurs');
      formSel.innerHTML = '';
      formateurs.forEach(fo => { const o=document.createElement('option'); o.value=fo.nom; o.textContent=fo.nom; formSel.appendChild(o); });

      document.getElementById('form-id').value          = id || '';
      document.getElementById('form-categorie').value   = f?.categorieId || '';
      document.getElementById('form-date').value        = f?.dateDebut ? Fmt.isoDate(new Date(f.dateDebut)) : Fmt.isoDate(new Date());
      document.getElementById('form-creneau').value     = f ? guessCreneau(f.dateDebut) : 'matin';
      document.getElementById('form-lieu').value         = f?.lieu || '';
      document.getElementById('form-places').value      = f?.placesMax || 10;
      document.getElementById('form-description').value = f?.description || '';
      document.getElementById('form-statut').value      = f?.statut === 'annulee' ? 'annulee' : 'validee';
      document.getElementById('form-new-categorie').value = '';
      document.getElementById('form-new-categorie-row').style.display = 'none';

      // Pré-sélection des formateurs existants
      const existing = (f?.formateurs || '').split(',').map(s => s.trim()).filter(Boolean);
      Array.from(formSel.options).forEach(o => { o.selected = existing.includes(o.value); });

      Modal.open('form-modal');
    },

    openNew() { this._openForm(); },

    save() {
      run(async () => {
        const id      = document.getElementById('form-id').value;
        const dateStr = document.getElementById('form-date').value;
        const creneau = document.getElementById('form-creneau').value;
        if (!dateStr) { toast('La date est obligatoire', 'error'); return; }

        const { dateDebut, dateFin } = buildCreneauDates(dateStr, creneau);

        let categorieId = document.getElementById('form-categorie').value;
        if (categorieId === '__new__') {
          const nom = document.getElementById('form-new-categorie').value.trim();
          if (!nom) { toast('Saisir le nom de la catégorie', 'error'); return; }
          const nc = await DB.saveCategory({ id: newId(), nom, couleur: '#2563EB' });
          categorieId = nc.id;
        }
        if (!categorieId) { toast('La catégorie est obligatoire', 'error'); return; }

        const formateurs = Array.from(document.getElementById('form-formateurs').selectedOptions).map(o => o.value).join(', ');

        await DB.saveFormation({
          id: id || undefined,
          categorieId,
          description: document.getElementById('form-description').value.trim(),
          dateDebut, dateFin,
          lieu:        document.getElementById('form-lieu').value,
          formateurs,
          placesMax:   parseInt(document.getElementById('form-places').value) || 10,
          statut:      document.getElementById('form-statut').value,
        });

        Modal.close('form-modal');
        toast(id ? 'Formation mise à jour ✅' : 'Formation créée ✅', 'success');
        this.render();
        App._refreshNotifBadge();
      });
    },
  },

  /* ========================================================
     NOTIFICATIONS
  ======================================================== */
  notifications: {
    open() {
      document.getElementById('notif-panel-overlay').classList.add('open');
      run(() => this._render());
    },
    close() {
      document.getElementById('notif-panel-overlay').classList.remove('open');
    },

    async _render() {
      const body = document.getElementById('notif-panel-body');
      body.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Chargement…</p></div>';
      const notifs = await DB.getNotifications(50);

      if (!notifs.length) {
        body.innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div><p>Aucune notification</p></div>';
        return;
      }

      body.innerHTML = notifs.map(n => `
        <div class="notif-item${!n.lue ? ' unread' : ''}">
          <span class="notif-icon">${NOTIF_ICONS[n.type] || 'ℹ️'}</span>
          <div class="notif-text">
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${Fmt.relativeTime(n.created_at)}</div>
          </div>
        </div>
      `).join('');

      // Marquer tout comme lu à l'ouverture
      await DB.markAllNotificationsRead();
      App._refreshNotifBadge();
    },
  },

  /* ========================================================
     GESTION DES LISTES — Formateurs / Lieux
  ======================================================== */
  lists: {
    _current: null, // 'formateurs' | 'lieux'

    openManager(type) {
      this._current = type;
      const title = type === 'formateurs' ? '👨‍🏫 Gérer les formateurs' : '📍 Gérer les lieux';
      document.getElementById('list-manager-title').textContent = title;
      document.getElementById('list-manager-input').value = '';
      document.getElementById('list-manager-input').placeholder = type === 'formateurs' ? 'Nom du formateur…' : 'Nom du lieu…';
      run(() => this._renderItems());
      Modal.open('list-manager-modal');
    },

    async _renderItems() {
      const container = document.getElementById('list-manager-items');
      container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;">Chargement…</div>';
      const items = this._current === 'formateurs' ? await DB.getFormateurs() : await DB.getLieux();

      if (!items.length) {
        container.innerHTML = '<div class="empty-state" style="padding:24px;"><p style="font-size:13px;">Liste vide</p></div>';
        return;
      }

      container.innerHTML = items.map(item => `
        <div class="list-manager-row" data-id="${item.id}">
          <input class="form-control list-edit-input" type="text" value="${item.nom.replace(/"/g,'&quot;')}" style="flex:1;">
          <button class="btn btn-icon" style="background:var(--success-light);color:var(--success);" title="Enregistrer" onclick="Pages.lists.update('${item.id}')">✔</button>
          <button class="btn btn-icon" style="background:var(--danger-light);color:var(--danger);" title="Supprimer" onclick="Pages.lists.remove('${item.id}','${item.nom.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      `).join('');
    },

    add() {
      run(async () => {
        const input = document.getElementById('list-manager-input');
        const nom = input.value.trim();
        if (!nom) { toast('Saisir un nom', 'error'); return; }

        if (this._current === 'formateurs') await DB.saveFormateur({ nom });
        else                                 await DB.saveLieu({ nom });

        input.value = '';
        toast('Ajouté ✅', 'success');
        await this._renderItems();
        await this._refreshFormSelects();
      });
    },

    update(id) {
      run(async () => {
        const row = document.querySelector(`.list-manager-row[data-id="${id}"]`);
        const nom = row.querySelector('.list-edit-input').value.trim();
        if (!nom) { toast('Le nom ne peut pas être vide', 'error'); return; }

        if (this._current === 'formateurs') await DB.saveFormateur({ id, nom });
        else                                 await DB.saveLieu({ id, nom });

        toast('Modifié ✅', 'success');
        await this._renderItems();
        await this._refreshFormSelects();
      });
    },

    remove(id, nom) {
      confirmDialog('Supprimer', `Supprimer « ${nom} » de la liste ?`, () => {
        run(async () => {
          if (this._current === 'formateurs') await DB.deleteFormateur(id);
          else                                 await DB.deleteLieu(id);
          toast('Supprimé', 'info');
          await this._renderItems();
          await this._refreshFormSelects();
        });
      });
    },

    // Recharger les <select> du formulaire formation si la modale est ouverte derrière
    async _refreshFormSelects() {
      const lieuSel = document.getElementById('form-lieu');
      const formSel = document.getElementById('form-formateurs');
      if (this._current === 'lieux' && lieuSel) {
        const current = lieuSel.value;
        const lieux = await DB.getLieux();
        lieuSel.innerHTML = '<option value="">— Sélectionner —</option>';
        lieux.forEach(l => { const o=document.createElement('option'); o.value=l.nom; o.textContent=l.nom; lieuSel.appendChild(o); });
        lieuSel.value = current;
      }
      if (this._current === 'formateurs' && formSel) {
        const selected = Array.from(formSel.selectedOptions).map(o => o.value);
        const formateurs = await DB.getFormateurs();
        formSel.innerHTML = '';
        formateurs.forEach(fo => { const o=document.createElement('option'); o.value=fo.nom; o.textContent=fo.nom; formSel.appendChild(o); });
        Array.from(formSel.options).forEach(o => { o.selected = selected.includes(o.value); });
      }
      // Rafraîchir aussi le filtre formateur du planning
      if (this._current === 'formateurs') {
        Pages.planning._formateursLoaded = false;
        await Pages.planning._loadFormateurFilter();
      }
    },
  },

  /* ========================================================
     PARAMÈTRES — Configuration Supabase
  ======================================================== */
  settings: {
    open() {
      const cfg = DB.getSupabaseConfig();
      document.getElementById('settings-url').value = cfg.url || '';
      document.getElementById('settings-key').value = cfg.anonKey || '';
      document.getElementById('settings-error').style.display = 'none';
      this._updateStatus(DB.isConfigured());
      Modal.open('settings-modal');
    },

    _updateStatus(connected) {
      const el = document.getElementById('settings-status');
      el.className = 'config-status ' + (connected ? 'connected' : 'disconnected');
      el.innerHTML = connected ? '✅ Connecté' : '⚠️ Non connecté';
    },

    _showError(msg) {
      const el = document.getElementById('settings-error');
      el.textContent = msg;
      el.style.display = 'block';
    },

    save() {
      run(async () => {
        const url = document.getElementById('settings-url').value.trim();
        const key = document.getElementById('settings-key').value.trim();
        if (!url || !key) { toast('URL et clé obligatoires', 'error'); return; }
        DB.saveSupabaseConfig({ url, anonKey: key });
        toast('Configuration enregistrée ✅', 'success');
        document.getElementById('settings-error').style.display = 'none';
        this._updateStatus(true);
        hideNoConfigScreen();
        Pages.planning.render();
        App._refreshNotifBadge();
      });
    },

    test() {
      run(async () => {
        const url = document.getElementById('settings-url').value.trim();
        const key = document.getElementById('settings-key').value.trim();
        if (!url || !key) { toast('Complétez l\'URL et la clé', 'error'); return; }

        DB.saveSupabaseConfig({ url, anonKey: key });
        document.getElementById('settings-error').style.display = 'none';

        try {
          const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/categories?limit=1`, {
            headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
          });
          if (r.ok) {
            toast('✅ Connexion réussie !', 'success');
            this._updateStatus(true);
          } else if (r.status === 404) {
            this._updateStatus(false);
            this._showError('❌ Erreur 404 : la table "categories" n\'existe pas encore. Exécutez le script sql/schema.sql dans Supabase → SQL Editor, puis réessayez.');
          } else if (r.status === 401) {
            this._updateStatus(false);
            this._showError('❌ Erreur 401 : clé invalide ou incorrecte. Vérifiez que vous avez copié la clé "anon public" depuis Settings → API.');
          } else {
            this._updateStatus(false);
            const body = await r.text();
            this._showError(`❌ Erreur ${r.status} : ${body.slice(0, 200)}`);
          }
        } catch (e) {
          this._updateStatus(false);
          this._showError('❌ Connexion impossible. Vérifiez l\'URL (elle doit commencer par https://) et votre connexion internet.');
        }
      });
    },
  },
};
