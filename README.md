# Gabreal Estate — Automatisation Instagram → WhatsApp

Petit serveur qui fait le lien entre tes Reels Instagram et toi :

1. Quelqu'un commente ton Reel.
2. Le serveur reçoit l'événement (webhook Meta), répond publiquement sous le
   commentaire, et envoie un message privé avec un lien vers la page de contact.
3. La personne remplit le formulaire (nom, téléphone, e-mail).
4. Tu reçois une notification WhatsApp avec ses coordonnées, et la demande
   est enregistrée dans le tableau de bord.

Ce dossier est prêt à être déployé. Il reste à faire les réglages côté
Meta et WhatsApp, puis à le mettre en ligne. Voici les étapes dans l'ordre.

## Étape 0 — Vérifier ton compte Instagram

Il doit être en compte **Professionnel (catégorie Entreprise)**, lié à une
Page Facebook — c'est obligatoire pour utiliser l'API.

- Instagram → ton profil → menu ☰ → *Paramètres et confidentialité* →
  *Compte* → en bas, vérifie le type de compte.
- S'il est en "Créateur", tu peux le passer en "Entreprise" depuis le même
  écran. Si Instagram ne te propose pas de le lier à une Page Facebook,
  crée d'abord une Page Facebook (gratuite, 2 minutes), puis relie le compte.

## Étape 1 — Créer l'App Meta Developer

1. Va sur [developers.facebook.com](https://developers.facebook.com) →
   *Mes Apps* → *Créer une app* → type "Entreprise".
2. Dans l'App, ajoute le produit **Webhooks** et le produit
   **Instagram** (ou *Messenger* selon la version affichée — cherche
   "Instagram Graph API").
3. Onglet *Paramètres de base* : note l'**App ID** et l'**App Secret**
   (→ `META_APP_SECRET` dans `.env`).
4. Relie ta Page Facebook (et donc ton compte Instagram) à l'App dans les
   réglages du produit Instagram.
5. Génère un **jeton d'accès Page** avec les permissions :
   `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`,
   `pages_manage_metadata`, `pages_messaging`.
   → copie ce jeton dans `META_PAGE_ACCESS_TOKEN`.

   Tant que l'App n'est pas validée par Meta (*App Review*), elle tourne en
   mode développement : seuls les comptes Instagram ajoutés comme
   "testeurs" dans l'App peuvent déclencher le webhook. C'est suffisant
   pour tout tester toi-même avant de demander la validation pour que ça
   marche avec tous tes commentateurs.

## Étape 2 — Déployer le serveur (pour avoir une URL publique HTTPS)

Le webhook Meta a besoin d'une URL publique joignable en HTTPS. Option la
plus simple et gratuite pour démarrer : **Render**.

1. Pousse ce dossier sur un dépôt GitHub.
2. Sur [render.com](https://render.com) → *New* → *Web Service* → connecte
   le dépôt.
3. Build command : `npm install` — Start command : `npm start`.
4. Dans *Environment*, ajoute toutes les variables de `.env.example` avec
   tes vraies valeurs (sauf `PUBLIC_BASE_URL` que tu rempliras après avoir
   l'URL Render, ex. `https://gabreal-automation.onrender.com`).
5. Ajoute un **disque persistant** (Render → *Disks*) monté sur `/data` si
   tu veux que `data/leads.json` survive aux redéploiements (sinon les
   prospects sont perdus à chaque déploiement — pour un usage sérieux,
   remplace `src/store.js` par une vraie base comme Supabase, cf. plus bas).
6. Déploie, récupère l'URL, mets-la dans `PUBLIC_BASE_URL` et redéploie.

## Étape 3 — Configurer le webhook dans l'App Meta

1. App Meta → *Webhooks* → objet **Instagram** → *Add Subscription*.
2. URL de rappel : `https://TON-DOMAINE/webhook/instagram`
3. Jeton de vérification : la même valeur que `META_VERIFY_TOKEN` dans `.env`.
4. Abonne-toi au champ **comments**.
5. Meta appelle automatiquement ton URL en GET pour vérifier — si tout est
   bien configuré, ça passe au vert.

## Étape 4 — Configurer WhatsApp Cloud API

1. Dans l'App Meta Developer, ajoute le produit **WhatsApp**.
2. Meta te donne un numéro de test gratuit, ou tu peux ajouter ton propre
   numéro professionnel (vérification par SMS).
3. Récupère le **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
4. Génère un jeton d'accès (temporaire pour tester, permanent via un
   *System User* pour la prod) → `WHATSAPP_ACCESS_TOKEN`.
5. `GABRIEL_WHATSAPP_NUMBER` = ton numéro, celui qui doit RECEVOIR les
   notifications (format international sans + : `33600000000`).

En mode test, WhatsApp exige que le numéro destinataire soit ajouté comme
testeur — ajoute ton propre numéro dans *WhatsApp → API Setup → To*.

## Étape 5 — Tester en local avant de déployer (optionnel)

```bash
npm install
cp .env.example .env
# remplis .env avec tes vraies valeurs
npm start
```

Le serveur tourne sur `http://localhost:3000`. Pour que Meta puisse
atteindre ton webhook local le temps des tests, utilise un tunnel comme
[ngrok](https://ngrok.com) (`ngrok http 3000`) et mets l'URL ngrok comme
`PUBLIC_BASE_URL` et comme URL de webhook dans l'App Meta.

## Étape 6 — Vérifier le tableau de bord

`https://TON-DOMAINE/dashboard` — identifiants définis par
`DASHBOARD_USER` / `DASHBOARD_PASSWORD` dans `.env`.

## Limites à connaître (importantes)

- **Une seule réponse privée par commentaire**, à envoyer dans les 7 jours
  qui suivent — passé ce délai ou après un premier envoi, impossible d'en
  renvoyer une deuxième pour le même commentaire.
- **Pas de second DM automatique garanti** après la validation du
  formulaire si la personne n'a jamais répondu au premier message privé :
  la fenêtre de conversation Instagram se referme. C'est pour ça que la
  confirmation se fait via la notification WhatsApp à toi + le bouton
  WhatsApp affiché à la personne, plutôt que de promettre un DM retour.
- Le stockage des prospects (`data/leads.json`) est un fichier simple,
  parfait pour démarrer. Pour un usage en production avec plusieurs
  centaines de leads, remplace `src/store.js` par une vraie base de
  données (Supabase, par exemple) en gardant les mêmes fonctions
  `addLead` / `getLeads`.
