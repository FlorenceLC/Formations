# Formations FTSI — Planning

Application web de planning partagé des formations, **sans connexion ni mot de passe**.
Tout le monde dans l'équipe voit le même planning en temps réel via Supabase.

---

## 🚀 Installation (10 minutes, une seule fois)

### 1. Créer le projet Supabase

1. **[supabase.com](https://supabase.com)** → compte gratuit → **New project**
2. Attendez ~2 minutes que le projet soit prêt

### 2. Créer les tables

1. Dans Supabase : **SQL Editor** → **New query**
2. Copiez tout le contenu de `sql/schema.sql`, collez-le, cliquez **Run**
3. Les tables et les 43 catégories FTSI sont créées automatiquement

### 3. Récupérer les clés

1. **Settings** (roue dentée) → **API**
2. Notez la **Project URL** et la clé **anon public**

### 4. Connecter l'application

1. Ouvrez `index.html` dans un navigateur (ou hébergez le dossier sur un serveur web interne)
2. Au premier lancement, collez l'URL et la clé anon, cliquez **Se connecter à Supabase**
3. C'est prêt — le planning s'affiche directement, sans identifiant ni mot de passe

### 5. Partager

Chaque appareil de l'équipe doit ouvrir la même `index.html` et saisir une fois
l'URL/clé Supabase (étape 4). Ensuite tout est synchronisé automatiquement.

---

## 🔧 Dépannage erreur 401

| Cause | Solution |
|---|---|
| Le schéma SQL n'a pas été exécuté | Re-exécutez `sql/schema.sql` dans SQL Editor |
| Clé anon mal copiée | Recopiez-la depuis Settings → API |
| URL incorrecte | Format exact : `https://xxxx.supabase.co` (sans slash final) |

Pour changer de base Supabase plus tard : ouvrir le panneau notifications (🔔) →
**Changer la connexion Supabase** en bas du panneau.

---

## 📅 Fonctionnement du planning

- **Vue Mois** : calendrier du lundi au vendredi uniquement (pas de week-end), avec le numéro de semaine (S+numéro) affiché sur chaque ligne
- **Vue Semaine** : 5 colonnes lundi→vendredi, numéro de semaine affiché en haut
- Chaque formation affiche dans l'ordre : **catégorie**, **horaire**, **formateurs**
- Clic sur une formation → détail complet, modification, annulation ou suppression
- **🔔 Notifications** : toute création, modification, annulation ou suppression
  de formation génère une notification visible par tous via la cloche en haut à droite

---

## 📁 Structure

```
ftsi/
├── index.html          → page unique de l'application
├── css/theme.css        → styles (thème clair, responsive mobile/PC)
├── js/
│   ├── db.js             → couche Supabase (REST API)
│   ├── app.js             → init, toast, modal, formatage dates/semaines
│   └── pages.js           → logique Planning + Notifications
└── sql/
    └── schema.sql          → tables + 43 catégories FTSI
```

---

## 📌 Notes

- Aucune authentification : toute personne ayant le lien et la config Supabase
  peut consulter et modifier le planning. Adapté à un usage en équipe restreinte
  et de confiance.
- Aucune donnée métier n'est stockée dans le navigateur — uniquement l'URL et la
  clé Supabase, nécessaires pour savoir à quelle base se connecter.
