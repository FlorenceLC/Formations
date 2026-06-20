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

    render() { run(() => this._render()); },

    async _render() {
      this._renderControls();
      const [formations, cats] = await Promise.all([DB.getFormations(), DB.getCategories()]);
      const container = document.getElementById('planning-view');
      if (this.view === 'month') this._renderMonth(container, formations, cats);
      else                       this._renderWeek(container, formations, cats);
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

    /* ---- VUE MOIS (lundi → vendredi uniquement) ---- */
    _renderMonth(container, formations, cats) {
      const year  = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const first = new Date(year, month, 1);
      const last  = new Date(year, month + 1, 0);
      const today = new Date(); today.setHours(0,0,0,0);

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
            html += `<div class="cal-event${isAnnulee ? ' annulee' : ''}"
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
      const today = new Date(); today.setHours(0,0,0,0);
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
            html += `<div class="week-event${isAnnulee ? ' annulee' : ''}" onclick="Pages.planning._openDetail('${f.id}')">
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
      const [f, cats] = await Promise.all([
        id ? DB.getFormationById(id) : Promise.resolve(null),
        DB.getCategories(),
      ]);

      document.getElementById('form-modal-title').textContent = isEdit ? '✏️  Modifier la formation' : '➕  Nouvelle formation';

      const sel = document.getElementById('form-categorie');
      sel.innerHTML = '<option value="">— Sélectionner —</option>';
      cats.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=c.nom; sel.appendChild(o); });
      sel.innerHTML += '<option value="__new__">➕ Nouvelle catégorie...</option>';

      document.getElementById('form-id').value          = id || '';
      document.getElementById('form-categorie').value   = f?.categorieId || '';
      document.getElementById('form-date-debut').value  = f?.dateDebut ? f.dateDebut.slice(0,16) : '';
      document.getElementById('form-date-fin').value    = f?.dateFin   ? f.dateFin.slice(0,16)   : '';
      document.getElementById('form-formateurs').value  = f?.formateurs || '';
      document.getElementById('form-lieu').value        = f?.lieu      || '';
      document.getElementById('form-places').value      = f?.placesMax || 10;
      document.getElementById('form-description').value = f?.description || '';
      document.getElementById('form-statut').value      = f?.statut === 'annulee' ? 'annulee' : 'validee';
      document.getElementById('form-new-categorie').value = '';
      document.getElementById('form-new-categorie-row').style.display = 'none';

      Modal.open('form-modal');
    },

    openNew() { this._openForm(); },

    save() {
      run(async () => {
        const id        = document.getElementById('form-id').value;
        const dateDebut  = document.getElementById('form-date-debut').value;
        const dateFin    = document.getElementById('form-date-fin').value;
        if (!dateDebut || !dateFin) { toast('Dates obligatoires', 'error'); return; }
        if (dateFin <= dateDebut)   { toast('La fin doit être après le début', 'error'); return; }

        let categorieId = document.getElementById('form-categorie').value;
        if (categorieId === '__new__') {
          const nom = document.getElementById('form-new-categorie').value.trim();
          if (!nom) { toast('Saisir le nom de la catégorie', 'error'); return; }
          const nc = await DB.saveCategory({ id: newId(), nom, couleur: '#2563EB' });
          categorieId = nc.id;
        }
        if (!categorieId) { toast('La catégorie est obligatoire', 'error'); return; }

        await DB.saveFormation({
          id: id || undefined,
          categorieId,
          description: document.getElementById('form-description').value.trim(),
          dateDebut:   new Date(dateDebut).toISOString(),
          dateFin:     new Date(dateFin).toISOString(),
          lieu:        document.getElementById('form-lieu').value.trim(),
          formateurs:  document.getElementById('form-formateurs').value.trim(),
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
};
