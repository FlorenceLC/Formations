# 🦅 Formations — Planning

Application web de planning partagé des formations.
Base de données **Firebase Firestore** — gratuite, sans mise en pause, données persistantes indéfiniment.

---

## 🚀 Installation (10 minutes, une seule fois)

### 1. Créer le projet Firebase

1. Allez sur **firebase.google.com** → Se connecter avec Google → Créer un projet
2. Nom : `formations` → désactivez Google Analytics → Créer

### 2. Activer Firestore

1. Menu gauche → **Firestore Database** → Créer une base de données
2. **"Démarrer en mode test"** → Région **eur3** (Europe) → Activer

### 3. Créer l'application Web

1. Roue dentée ⚙️ → **Paramètres du projet** → Général
2. **"Vos applications"** → icône **</>** (Web) → Surnom : `formations` → Enregistrer
3. Copiez `apiKey`, `projectId` et `appId` du bloc `firebaseConfig`

### 4. Connecter l'application

1. Ouvrez `index.html` dans un navigateur
2. Collez les 3 valeurs → **Se connecter à Firebase**

### 5. Partager

Chaque membre ouvre `index.html` et saisit les 3 valeurs une fois.
Tout est synchronisé via Firestore.

---

## 📁 Structure

```
ftsi/
├── index.html
├── css/theme.css
└── js/
    ├── db.js       — couche Firestore (Firebase v10)
    ├── app.js      — init, navigation, utilitaires
    └── pages.js    — Planning + Notifications + Paramètres
```
