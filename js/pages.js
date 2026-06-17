/**
 * pages.js — Logique de rendu de chaque page
 */

const Pages = {

  /* ========== DASHBOARD ========== */
  dashboard: {
    render() {
      const u = App.currentUser;
      const stats = DB.getUserStats(u.id);
      const allFormations = DB.getFormations();
      const aVenir = allFormations.filter(f => f.dateDebut >= new Date().toISOString() && f.statut !== 'annulee');

      document.getElementById('stat-formations-avenir').textContent = aVenir.length;
      document.getElementById('stat-mes-formations').textContent = stats.aVenir;
      document.getElementById('stat-heures').textContent = stats.heures + 'h';

      // Prochaines formations
      const myIds = DB.getUserFormations(u.id).map(f => f.id);
      const prochaines = aVenir.slice(0, 5);
      const container = document.getElementById('dashboard-prochaines');
      if (!prochaines.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Aucune formation à venir</p></div>';
        return;
      }
      container.innerHTML = prochaines.map(f => {
        const isInscrit = myIds.includes(f.id);
        const fCat = DB.getCategories().find(c => c.id === f.categorieId);
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
            <div style="background:${isInscrit ? 'var(--primary-light)' : 'var(--bg)'};border-radius:8px;padding:8px 12px;text-align:center;min-width:52px;flex-shrink:0;">
              <div style="font-size:18px;font-weight:800;color:${isInscrit ? 'var(--primary)' : 'var(--secondary)'}">${new Date(f.dateDebut).getDate()}</div>
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">${new Date(f.dateDebut).toLocaleDateString('fr-FR',{month:'short'})}</div>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${fCat?.nom || 'Formation'}</div>
              <div style="font-size:12px;color:var(--text-muted);">${Fmt.time(f.dateDebut)} — ${f.lieu || '—'}</div>
            </div>
            <div style="flex-shrink:0;display:flex;gap:6px;align-items:center;">
              ${isInscrit ? '<span class="badge badge-success">Inscrit</span>' : ''}
              ${statusBadge(f.statut)}
            </div>
          </div>`;
      }).join('');
    }
  },

  /* ========== PLANNING ========== */
  planning: {
    view: 'month',  // 'month' | 'week'
    currentDate: new Date(),

    render() {
      this._renderControls();
      this._renderView();
    },

    _renderControls() {
      // Period label
      const label = this.view === 'month'
        ? Fmt.monthYear(this.currentDate)
        : (() => {
          const ws = this._weekStart(this.currentDate);
          const we = new Date(ws); we.setDate(we.getDate() + 6);
          return `${Fmt.dateShort(ws.toISOString())} — ${Fmt.dateShort(we.toISOString())} ${ws.getFullYear()}`;
        })();
      document.getElementById('planning-label').textContent = label.charAt(0).toUpperCase() + label.slice(1);
    },

    _weekStart(d) {
      const s = new Date(d);
      const day = s.getDay() === 0 ? 6 : s.getDay() - 1;
      s.setDate(s.getDate() - day); s.setHours(0,0,0,0); return s;
    },

    _renderView() {
      const container = document.getElementById('planning-view');
      if (this.view === 'month') this._renderMonth(container);
      else this._renderWeek(container);
    },

    _getFormations() {
      return DB.getFormations();
    },

    _renderMonth(container) {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
      const today = new Date(); today.setHours(0,0,0,0);
      const myFormationIds = new Set(DB.getUserFormations(App.currentUser.id).map(f => f.id));
      const formations = this._getFormations();
      const cats = DB.getCategories();

      // Group by date
      const byDate = {};
      formations.forEach(f => {
        if (!f.dateDebut) return;
        const key = Fmt.isoDate(new Date(f.dateDebut));
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(f);
      });

      let html = `<div class="cal-grid">
        <div class="cal-header">
          ${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => `<div class="cal-day-header">${d}</div>`).join('')}
        </div>
        <div class="cal-body">`;

      const cellDate = new Date(first); cellDate.setDate(cellDate.getDate() - startDay);
      for (let i = 0; i < 42; i++) {
        const isCurrentMonth = cellDate.getMonth() === month;
        const isToday = cellDate.getTime() === today.getTime();
        const key = Fmt.isoDate(cellDate);
        const dayForms = byDate[key] || [];

        html += `<div class="cal-cell${!isCurrentMonth ? ' other-month' : ''}${isToday ? ' today' : ''}" data-date="${key}">
          <div class="day-num">${cellDate.getDate()}</div>`;

        dayForms.slice(0, 3).forEach(f => {
          const isMine = myFormationIds.has(f.id);
          const catName = cats.find(c => c.id === f.categorieId)?.nom || 'Formation';
          html += `<div class="cal-event${isMine ? ' my-event' : ''}"
            title="${catName}\n👨‍🏫 ${f.formateurs||'—'}\n📍 ${f.lieu||'—'}\n👥 ${f.inscritsCount}/${f.placesMax} participants"
            onclick="Pages.planning._openDetail('${f.id}')">
            <div class="cal-event-title">${catName}</div>
            <div class="cal-event-meta">⏰ ${Fmt.time(f.dateDebut)} · 👨‍🏫 ${f.formateurs||'—'} · 👤 ${f.inscritsCount}/${f.placesMax}</div>
          </div>`;
        });
        if (dayForms.length > 3) {
          html += `<div class="cal-more" onclick="Pages.planning._openDetail('${dayForms[3].id}')">+${dayForms.length - 3} autre(s)</div>`;
        }
        html += `</div>`;
        cellDate.setDate(cellDate.getDate() + 1);
        if (i >= 34 && cellDate.getMonth() !== month && i % 7 === 6) break;
      }
      html += `</div></div>`;
      container.innerHTML = html;
    },

    _renderWeek(container) {
      const ws = this._weekStart(this.currentDate);
      const today = new Date(); today.setHours(0,0,0,0);
      const myFormationIds = new Set(DB.getUserFormations(App.currentUser.id).map(f => f.id));
      const formations = this._getFormations();
      const cats = DB.getCategories();
      const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

      let html = '<div class="week-grid">';
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws); d.setDate(d.getDate() + i); d.setHours(0,0,0,0);
        const isToday = d.getTime() === today.getTime();
        const key = Fmt.isoDate(d);
        const dayForms = formations.filter(f => f.dateDebut && Fmt.isoDate(new Date(f.dateDebut)) === key);

        html += `<div class="week-col${isToday ? ' today' : ''} show">
          <div class="week-col-header">
            <div class="wday">${jours[i].slice(0,3)}</div>
            <div class="wdate">${d.getDate()}</div>
          </div>
          <div class="week-col-body">`;

        if (!dayForms.length) {
          html += '<div class="week-empty">—</div>';
        } else {
          dayForms.forEach(f => {
            const isMine = myFormationIds.has(f.id);
            const catName = cats.find(c => c.id === f.categorieId)?.nom || 'Formation';
            html += `<div class="week-event${isMine ? ' my-event' : ''}" onclick="Pages.planning._openDetail('${f.id}')">
              <div class="week-event-title">${catName}</div>
              <div class="week-event-meta">⏰ ${Fmt.time(f.dateDebut)}–${Fmt.time(f.dateFin)}</div>
              <div class="week-event-meta">📍 ${f.lieu||'—'}</div>
              <div class="week-event-meta">👨‍🏫 ${f.formateurs||'—'}</div>
              <div class="week-event-meta">👥 ${f.inscritsCount}/${f.placesMax}</div>
            </div>`;
          });
        }
        html += `</div></div>`;
      }
      html += '</div>';
      container.innerHTML = html;
    },

    prev() {
      if (this.view === 'month') { this.currentDate.setMonth(this.currentDate.getMonth() - 1); }
      else { this.currentDate.setDate(this.currentDate.getDate() - 7); }
      this.render();
    },
    next() {
      if (this.view === 'month') { this.currentDate.setMonth(this.currentDate.getMonth() + 1); }
      else { this.currentDate.setDate(this.currentDate.getDate() + 7); }
      this.render();
    },
    today() { this.currentDate = new Date(); this.render(); },
    switchView(v) { this.view = v; document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === v)); this.render(); },

    _openDetail(id) { Pages.formations._openDetail(id); },
    openNew() { Pages.formations._openForm(); },
  },

  /* ========== FORMATIONS ========== */
  formations: {
    filters: { search: '', categorieId: '', statut: '' },

    render() {
      this._renderCatFilter();
      this._renderTable();
    },

    _renderCatFilter() {
      const sel = document.getElementById('filter-categorie-formations');
      if (sel.children.length <= 1) {
        DB.getCategories().forEach(c => {
          const o = document.createElement('option');
          o.value = c.id; o.textContent = c.nom;
          sel.appendChild(o);
        });
      }
    },

    _renderTable() {
      const formations = DB.getFormations(this.filters);
      const tbody = document.getElementById('formations-tbody');
      const u = App.currentUser;

      if (!formations.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">Aucune formation trouvée</td></tr>`;
        return;
      }

      tbody.innerHTML = formations.map(f => {
        const isInscrit = DB.isInscrit(f.id, u.id);
        const cat = DB.getCategories().find(c => c.id === f.categorieId);
        return `<tr>
          <td>${cat ? `<span class="badge badge-primary" style="background:${cat.couleur}22;color:${cat.couleur};cursor:pointer;" onclick="Pages.formations._openDetail('${f.id}')">${cat.nom}</span>` : '—'}</td>
          <td>${Fmt.date(f.dateDebut)}</td>
          <td>${f.dateDebut ? Fmt.time(f.dateDebut) + ' – ' + Fmt.time(f.dateFin) : '—'}</td>
          <td>${f.lieu || '—'}</td>
          <td>${f.formateurs || '—'}</td>
          <td><span style="font-weight:700;">${f.placesMax}</span></td>
          <td>${statusBadge(f.statut)}</td>
          <td>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <button class="btn btn-icon" style="background:var(--primary-light);color:var(--primary);width:38px;height:38px;font-size:16px;" title="Voir le détail" onclick="Pages.formations._openDetail('${f.id}')">👁</button>
              ${isInscrit
                ? `<button class="btn btn-icon" style="background:var(--danger-light);color:var(--danger);width:38px;height:38px;font-size:16px;" title="Se désinscrire" onclick="Pages.formations._desinscrire('${f.id}')">✖</button>`
                : (f.statut !== 'annulee' ? `<button class="btn btn-icon" style="background:var(--success-light);color:var(--success);width:38px;height:38px;font-size:16px;" title="S'inscrire" onclick="Pages.formations._inscrire('${f.id}')">✚</button>` : '')}
              ${(u.isAdmin || f.createdBy === u.id) ? `
                <button class="btn btn-icon" style="background:var(--warning-light);color:var(--warning);width:38px;height:38px;font-size:16px;" title="Modifier" onclick="Pages.formations._openForm('${f.id}')">✏️</button>
                <button class="btn btn-icon" style="background:var(--primary-light);color:var(--primary);width:38px;height:38px;font-size:16px;" title="Dupliquer" onclick="Pages.formations._duplicate('${f.id}')">📋</button>
                ${u.isAdmin ? `<button class="btn btn-icon" style="background:var(--danger-light);color:var(--danger);width:38px;height:38px;font-size:16px;" title="Supprimer" onclick="Pages.formations._delete('${f.id}')">🗑</button>` : ''}
              ` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');
    },

    _openDetail(id) {
      const f = DB.getFormationById(id);
      if (!f) return;
      const cat = DB.getCategories().find(c => c.id === f.categorieId);
      const inscriptions = DB.getInscriptions(f.id);
      const isInscrit = DB.isInscrit(f.id, App.currentUser.id);

      document.getElementById('detail-modal-title').textContent = cat?.nom || 'Formation';
      document.getElementById('detail-modal-body').innerHTML = `
        <div class="detail-row"><span class="detail-icon">📅</span><div><div class="detail-key">Date</div><div class="detail-val">${Fmt.date(f.dateDebut)}</div></div></div>
        <div class="detail-row"><span class="detail-icon">⏰</span><div><div class="detail-key">Horaires</div><div class="detail-val">${Fmt.time(f.dateDebut)} – ${Fmt.time(f.dateFin)} (${Fmt.dureeH(f.dateDebut, f.dateFin)})</div></div></div>
        <div class="detail-row"><span class="detail-icon">📍</span><div><div class="detail-key">Lieu</div><div class="detail-val">${f.lieu || '—'}</div></div></div>
        <div class="detail-row"><span class="detail-icon">👨‍🏫</span><div><div class="detail-key">Formateurs</div><div class="detail-val">${f.formateurs || '—'}</div></div></div>
        <div class="detail-row"><span class="detail-icon">🏷</span><div><div class="detail-key">Catégorie</div><div class="detail-val">${cat?.nom || '—'}</div></div></div>
        <div class="detail-row"><span class="detail-icon">👥</span><div><div class="detail-key">Participants (${f.inscritsCount}/${f.placesMax})</div>
          <div class="participants-list">${inscriptions.length ? inscriptions.map(i => {
            const u = i.user;
            return `<span class="participant-chip" style="background:${u?.couleur||'#64748b'}22;color:${u?.couleur||'#64748b'};border-color:${u?.couleur||'#64748b'}44;">${u?.prenom} ${u?.nom}</span>`;
          }).join('') : '<span style="color:var(--text-muted);font-size:12px;">Aucun inscrit</span>'}</div>
        </div></div>
        <div class="detail-row"><span class="detail-icon">🔖</span><div><div class="detail-key">Statut</div><div class="detail-val">${statusBadge(f.statut)}</div></div></div>
        ${f.description ? `<div class="detail-row"><span class="detail-icon">📝</span><div><div class="detail-key">Description</div><div class="detail-val">${f.description}</div></div></div>` : ''}
      `;

      // Footer buttons
      const footer = document.getElementById('detail-modal-footer');
      footer.innerHTML = '';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn btn-ghost'; closeBtn.textContent = 'Fermer';
      closeBtn.onclick = () => Modal.close('detail-modal');
      footer.appendChild(closeBtn);

      if (f.statut !== 'annulee') {
        if (isInscrit) {
          const dBtn = document.createElement('button');
          dBtn.className = 'btn btn-danger'; dBtn.textContent = 'Se désinscrire';
          dBtn.onclick = () => { Pages.formations._desinscrire(f.id); Modal.close('detail-modal'); };
          footer.appendChild(dBtn);
        } else {
          const iBtn = document.createElement('button');
          iBtn.className = 'btn btn-success'; iBtn.textContent = "S'inscrire";
          iBtn.onclick = () => { Pages.formations._inscrire(f.id); Modal.close('detail-modal'); };
          footer.appendChild(iBtn);
        }
      }

      Modal.open('detail-modal');
    },

    _inscrire(id) {
      const f = DB.getFormationById(id);
      if (!f) return;
      if (f.inscritsCount >= f.placesMax) { toast('Formation complète', 'error'); return; }
      if (DB.isInscrit(id, App.currentUser.id)) { toast('Déjà inscrit', 'error'); return; }
      DB.inscrire(id, App.currentUser.id);
      toast('Inscription confirmée ✅', 'success');
      this.render();
      Pages.dashboard.render();
    },

    _desinscrire(id) {
      confirm('Se désinscrire', 'Confirmer la désinscription ?', () => {
        DB.desinscrire(id, App.currentUser.id);
        toast('Désinscription effectuée', 'info');
        this.render();
        Pages.dashboard.render();
      });
    },

    _delete(id) {
      const f = DB.getFormationById(id);
      const cat = DB.getCategories().find(c => c.id === f?.categorieId);
      confirm('Supprimer', `Supprimer définitivement « ${cat?.nom || 'cette formation'} » du ${Fmt.date(f?.dateDebut)} ?`, () => {
        DB.deleteFormation(id);
        toast('Formation supprimée', 'info');
        this.render();
      });
    },

    _duplicate(id) {
      DB.duplicateFormation(id, App.currentUser.id);
      toast('Formation dupliquée 📋', 'success');
      this.render();
    },

    _openForm(id = null) {
      const isEdit = !!id;
      const f = id ? DB.getFormationById(id) : null;
      document.getElementById('form-modal-title').textContent = isEdit ? '✏️  Modifier la formation' : '➕  Nouvelle formation';

      // Fill catalogue import
      const catSel = document.getElementById('form-catalogue-import');
      catSel.innerHTML = '<option value="">— Importer depuis le catalogue —</option>';
      DB.getCatalogue().forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.titre; catSel.appendChild(o); });
      catSel.style.display = isEdit ? 'none' : 'block';
      document.getElementById('form-catalogue-label').style.display = isEdit ? 'none' : 'block';

      // Fill categories
      const sel = document.getElementById('form-categorie');
      sel.innerHTML = '<option value="">— Sélectionner —</option>';
      DB.getCategories().forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nom; sel.appendChild(o); });
      sel.innerHTML += '<option value="__new__">➕ Nouvelle catégorie...</option>';

      // Fill formateurs multi-select avec les utilisateurs FTSI
      const formateursSel = document.getElementById('form-formateurs');
      formateursSel.innerHTML = '';
      DB.getUsers().filter(u => !u.isConfigurateur).forEach(u => {
        const o = document.createElement('option');
        o.value = `${u.prenom} ${u.nom}`;
        o.textContent = `${u.prenom} ${u.nom}`;
        formateursSel.appendChild(o);
      });

      // Fill form
      document.getElementById('form-id').value = id || '';
      document.getElementById('form-description').value = f?.description || '';
      document.getElementById('form-categorie').value = f?.categorieId || '';
      document.getElementById('form-date-debut').value = f?.dateDebut ? f.dateDebut.slice(0,16) : '';
      document.getElementById('form-date-fin').value = f?.dateFin ? f.dateFin.slice(0,16) : '';
      document.getElementById('form-lieu').value = f?.lieu || '';
      document.getElementById('form-places').value = f?.placesMax || 10;
      document.getElementById('form-statut').value = (f?.statut === 'annulee') ? 'annulee' : 'validee';
      document.getElementById('form-new-categorie').value = '';
      document.getElementById('form-new-categorie-row').style.display = 'none';

      // Pré-sélection des formateurs existants
      const existingFormateurs = (f?.formateurs || '').split(',').map(s => s.trim()).filter(Boolean);
      Array.from(formateursSel.options).forEach(opt => { opt.selected = existingFormateurs.includes(opt.value); });

      Modal.open('form-modal');
    },

    save() {
      const id = document.getElementById('form-id').value;

      const dateDebut = document.getElementById('form-date-debut').value;
      const dateFin = document.getElementById('form-date-fin').value;
      if (!dateDebut || !dateFin) { toast('Les dates de début et fin sont obligatoires', 'error'); return; }
      if (dateFin <= dateDebut) {
        toast('La date de fin doit être après le début', 'error'); return;
      }

      let categorieId = document.getElementById('form-categorie').value;
      if (categorieId === '__new__') {
        const nom = document.getElementById('form-new-categorie').value.trim();
        if (!nom) { toast('Saisir le nom de la nouvelle catégorie', 'error'); return; }
        const newCat = { id: newId(), nom, couleur: '#2563EB' };
        DB.saveCategory(newCat);
        categorieId = newCat.id;
      }
      if (!categorieId) { toast('La catégorie est obligatoire', 'error'); return; }

      const formateursSel = document.getElementById('form-formateurs');
      const formateurs = Array.from(formateursSel.selectedOptions).map(o => o.value).join(', ');

      const formation = {
        id: id || newId(),
        description: document.getElementById('form-description').value.trim(),
        categorieId,
        dateDebut: new Date(dateDebut).toISOString(),
        dateFin: new Date(dateFin).toISOString(),
        lieu: document.getElementById('form-lieu').value.trim(),
        formateurs,
        placesMax: parseInt(document.getElementById('form-places').value) || 10,
        statut: document.getElementById('form-statut').value,
        createdBy: id ? DB.getFormationById(id)?.createdBy : App.currentUser.id,
      };

      DB.saveFormation(formation);
      Modal.close('form-modal');
      toast(id ? 'Formation mise à jour ✅' : 'Formation créée ✅', 'success');
      this.render();
      Pages.planning.render();
      Pages.dashboard.render();
    },

    exportPDF() {
      toast('Export PDF en cours... (utilisez la fonction d\'impression du navigateur)', 'info');
      window.print();
    },

    exportExcel() {
      const formations = DB.getFormations(this.filters);
      const cats = DB.getCategories();
      const rows = [['Catégorie','Date','Début','Fin','Lieu','Formateurs','Places max','Inscrits','Statut']];
      formations.forEach(f => {
        const cat = cats.find(c => c.id === f.categorieId);
        rows.push([cat?.nom||'', Fmt.date(f.dateDebut), Fmt.time(f.dateDebut), Fmt.time(f.dateFin), f.lieu||'', f.formateurs||'', f.placesMax, f.inscritsCount, f.statut]);
      });
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'formations_ftsi.csv'; a.click();
      URL.revokeObjectURL(url);
      toast('Export CSV téléchargé ✅', 'success');
    },
  },

  /* ========== CATALOGUE ========== */
  catalogue: {
    render() {
      const items = DB.getCatalogue();
      const cats = DB.getCategories();
      const tbody = document.getElementById('catalogue-tbody');
      if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-muted);">Catalogue vide — ajoutez une première formation</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(item => {
        const cat = cats.find(c => c.id === item.categorieId);
        return `<tr>
          <td><strong>${item.titre}</strong>${item.description ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${item.description}</div>` : ''}</td>
          <td>${cat ? `<span class="badge badge-primary" style="background:${cat.couleur}22;color:${cat.couleur};">${cat.nom}</span>` : '—'}</td>
          <td>${item.dureeHeures ? item.dureeHeures + ' h' : '—'}</td>
        </tr>`;
      }).join('');
    },
  },

  /* ========== ADMIN ========== */
  admin: {
    _tab: 'users',
    render() { this.showTab(this._tab); },
    showTab(tab) {
      if (tab === 'config' && !App.currentUser.isConfigurateur) {
        toast('Accès réservé au compte configurateur', 'error');
        tab = 'users';
      }
      this._tab = tab;
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = c.dataset.tab === tab ? 'block' : 'none');
      if (tab === 'users') this._renderUsers();
      else if (tab === 'config') this._renderConfig();
    },

    _renderUsers() {
      const users = DB.getUsers();
      const tbody = document.getElementById('users-tbody');
      tbody.innerHTML = users.map(u => `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="sidebar-avatar" style="background:${u.couleur||'#64748b'};width:28px;height:28px;font-size:11px;">${(u.prenom?.[0]||'')+(u.nom?.[0]||'')}</div>
            <div><div style="font-weight:600;">${u.prenom} ${u.nom}</div><div style="font-size:11px;color:var(--text-muted);">@${u.username}</div></div>
          </div>
        </td>
        <td>${u.email || '—'}</td>
        <td>${u.isConfigurateur ? '<span class="badge badge-gray" style="background:#0F172A22;color:#0F172A;">🔧 Configurateur</span>' : (u.isAdmin ? '<span class="badge badge-warning">⭐ Admin</span>' : '<span class="badge badge-gray">Collaborateur</span>')}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-sm btn-icon" style="background:var(--warning-light);color:var(--warning);" title="Modifier" onclick="Pages.admin._editUser('${u.id}')">✏️</button>
            ${u.id !== App.currentUser.id ? `<button class="btn btn-sm btn-icon" style="background:var(--danger-light);color:var(--danger);" title="Supprimer" onclick="Pages.admin._deleteUser('${u.id}')">🗑</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
    },

    _openUserForm(id = null) {
      const u = id ? DB.getUserById(id) : null;
      document.getElementById('user-form-title').textContent = u ? '✏️  Modifier utilisateur' : '➕  Nouvel utilisateur';
      document.getElementById('user-id').value = id || '';
      document.getElementById('user-username').value = u?.username || '';
      document.getElementById('user-nom').value = u?.nom || '';
      document.getElementById('user-prenom').value = u?.prenom || '';
      document.getElementById('user-email').value = u?.email || '';
      document.getElementById('user-couleur').value = u?.couleur || '#2563EB';
      document.getElementById('user-is-admin').checked = u?.isAdmin || false;
      document.getElementById('user-password').value = '';
      document.getElementById('user-password-row').style.display = id ? 'none' : 'block';
      document.getElementById('user-pwd-change-row').style.display = id ? 'flex' : 'none';
      Modal.open('user-modal');
    },

    _editUser(id) { this._openUserForm(id); },

    _deleteUser(id) {
      const u = DB.getUserById(id);
      confirm('Supprimer', `Supprimer l'utilisateur « ${u?.prenom} ${u?.nom} » ?`, () => {
        DB.deleteUser(id);
        toast('Utilisateur supprimé', 'info');
        this._renderUsers();
      });
    },

    saveUser() {
      const id = document.getElementById('user-id').value;
      const username = document.getElementById('user-username').value.trim();
      const nom = document.getElementById('user-nom').value.trim();
      const prenom = document.getElementById('user-prenom').value.trim();
      if (!username || !nom || !prenom) { toast('Identifiant, nom et prénom obligatoires', 'error'); return; }

      const existing = DB.getUserByUsername(username);
      if (existing && existing.id !== id) { toast('Cet identifiant est déjà utilisé', 'error'); return; }

      const password = document.getElementById('user-password').value;
      if (!id && !password) { toast('Le mot de passe est obligatoire', 'error'); return; }

      const user = {
        id: id || newId(),
        username,
        nom, prenom,
        email: document.getElementById('user-email').value.trim(),
        couleur: document.getElementById('user-couleur').value,
        isAdmin: document.getElementById('user-is-admin').checked,
        isActive: true,
        passwordHash: id ? DB.getUserById(id).passwordHash : DB._hashPassword?.(password) || LocalAdapter._hashPassword(password),
      };
      if (!id) user.passwordHash = LocalAdapter._hashPassword(password);
      DB.saveUser(user);
      Modal.close('user-modal');
      toast(id ? 'Utilisateur mis à jour ✅' : 'Utilisateur créé ✅', 'success');
      this._renderUsers();
    },

    changePwd() {
      const id = document.getElementById('user-id').value;
      const pwd = prompt('Nouveau mot de passe :');
      if (pwd && pwd.length >= 4) {
        DB.changePassword(id, pwd);
        toast('Mot de passe modifié ✅', 'success');
      } else if (pwd !== null) {
        toast('Mot de passe trop court (4 caractères minimum)', 'error');
      }
    },

    _renderConfig() {
      const cfg = DB.getSupabaseConfig();
      document.getElementById('supabase-url').value = cfg.url || '';
      document.getElementById('supabase-key').value = cfg.anonKey || '';
      const status = document.getElementById('config-status');
      if (cfg.url && cfg.anonKey) {
        status.className = 'config-status connected';
        status.innerHTML = '✅ Configuration Supabase enregistrée';
      } else {
        status.className = 'config-status disconnected';
        status.innerHTML = '⚠️ Non configuré — données stockées en local (navigateur)';
      }
    },

    saveConfig() {
      const url = document.getElementById('supabase-url').value.trim();
      const key = document.getElementById('supabase-key').value.trim();
      DB.saveSupabaseConfig({ url, anonKey: key });
      toast('Configuration enregistrée ✅', 'success');
      this._renderConfig();
    },

    testConnection() {
      const cfg = DB.getSupabaseConfig();
      if (!cfg.url || !cfg.anonKey) { toast('Complétez d\'abord l\'URL et la clé', 'error'); return; }
      toast('Test de connexion...', 'info');
      fetch(`${cfg.url}/rest/v1/`, { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } })
        .then(r => {
          if (r.ok || r.status === 200) toast('✅ Connexion Supabase réussie !', 'success');
          else toast(`❌ Erreur ${r.status} — vérifiez vos paramètres`, 'error');
        })
        .catch(() => toast('❌ Connexion impossible — vérifiez l\'URL', 'error'));
    },
  },

  /* ========== MON PROFIL ========== */
  profil: {
    render() {
      const u = App.currentUser;
      const stats = DB.getUserStats(u.id);
      document.getElementById('profil-nom').value = u.nom || '';
      document.getElementById('profil-prenom').value = u.prenom || '';
      document.getElementById('profil-email').value = u.email || '';
      document.getElementById('profil-couleur').value = u.couleur || '#2563EB';
      document.getElementById('profil-stat-avenir').textContent = stats.aVenir;
      document.getElementById('profil-stat-passees').textContent = stats.passees;
      document.getElementById('profil-stat-heures').textContent = stats.heures + 'h';
      // Avatar preview
      const initials = (u.prenom?.[0]||'') + (u.nom?.[0]||'');
      document.getElementById('profil-avatar').textContent = initials.toUpperCase();
      document.getElementById('profil-avatar').style.background = u.couleur || '#2563EB';
    },

    save() {
      const u = App.currentUser;
      u.nom = document.getElementById('profil-nom').value.trim();
      u.prenom = document.getElementById('profil-prenom').value.trim();
      u.email = document.getElementById('profil-email').value.trim();
      u.couleur = document.getElementById('profil-couleur').value;
      DB.saveUser(u);
      App.currentUser = u;
      App.renderSidebar();
      toast('Profil mis à jour ✅', 'success');
      this.render();
    },

    changePwd() {
      const current = document.getElementById('profil-pwd-current').value;
      const newPwd = document.getElementById('profil-pwd-new').value;
      const confirm2 = document.getElementById('profil-pwd-confirm').value;
      if (!DB.authenticate(App.currentUser.username, current)) {
        toast('Mot de passe actuel incorrect', 'error'); return;
      }
      if (newPwd.length < 4) { toast('Nouveau mot de passe trop court', 'error'); return; }
      if (newPwd !== confirm2) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
      DB.changePassword(App.currentUser.id, newPwd);
      document.getElementById('profil-pwd-current').value = '';
      document.getElementById('profil-pwd-new').value = '';
      document.getElementById('profil-pwd-confirm').value = '';
      toast('Mot de passe modifié ✅', 'success');
    },
  },
};
