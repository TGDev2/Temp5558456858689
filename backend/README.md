# ArtisanConnect Backend

Backend API REST pour ArtisanConnect - Solution de gestion de rendez-vous pour artisans indépendants.

## Stack Technique

- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js 4.x
- **Base de données:** PostgreSQL 15+ (à configurer)
- **Validation:** Joi (à installer)
- **ORM/Query builder:** Knex.js (à installer)
- **Logging:** Winston
- **Sécurité:** Helmet, CORS

## Installation

### Prérequis

- Node.js 20.x ou supérieur
- npm 10.x ou supérieur
- PostgreSQL 15+ (pour étapes ultérieures)

### Setup local

1. **Installer les dépendances**
```bash
cd backend
npm install
```

2. **Configurer les variables d'environnement**
```bash
cp .env.example .env
```

Éditer `.env` et configurer au minimum :
- `PORT` (par défaut 3000)
- `FRONTEND_URL` (URL du front pour CORS)
- `LOG_LEVEL` (info recommandé)

3. **Démarrer le serveur en mode développement**
```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

4. **Vérifier que le serveur fonctionne**
```bash
curl http://localhost:3000/api/v1/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "uptime": 1.234,
  "environment": "development"
}
```

## Scripts disponibles

- `npm start` : Démarrer le serveur en production
- `npm run dev` : Démarrer en mode développement avec auto-reload (nodemon)
- `npm run lint` : Vérifier la qualité du code (ESLint)
- `npm run lint:fix` : Corriger automatiquement les erreurs ESLint
- `npm run format` : Formater le code (Prettier)
- `npm run format:check` : Vérifier le formatage sans modification

## Structure du projet
```
backend/
├── src/
│   ├── api/              # Couche présentation (routes, controllers, middlewares)
│   │   ├── middlewares/  # Middlewares Express (errorHandler, validation...)
│   │   └── routes/       # Définition des routes API
│   ├── domain/           # Couche métier (services, entités, règles - à venir)
│   ├── infrastructure/   # Couche infrastructure (DB, intégrations - à venir)
│   ├── utils/            # Utilitaires transverses (logger, helpers)
│   ├── app.js            # Configuration Express (middleware, routes)
│   └── server.js         # Point d'entrée HTTP
├── .env.example          # Template variables d'environnement
├── .eslintrc.js          # Configuration ESLint
├── .prettierrc           # Configuration Prettier
├── package.json          # Dépendances et scripts npm
└── README.md             # Ce fichier
```

## Endpoints API disponibles

### Health Check

**GET /api/v1/health**

Vérifie que le serveur répond correctement.

**Réponse 200 OK :**
```json
{
  "status": "ok",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "uptime": 1.234,
  "environment": "development"
}
```

## Prochaines étapes

1. **Configuration PostgreSQL** : Installer Knex, créer migrations pour tables `artisans`, `services`, `bookings`
2. **Repositories** : Implémenter couche d'accès données avec repositories métier
3. **Endpoints services** : `GET /api/v1/services` pour liste des services actifs
4. **Endpoints disponibilités** : `GET /api/v1/availability` avec génération de créneaux
5. **Intégration Stripe** : `POST /api/v1/bookings` avec Payment Intents
6. **Webhooks** : Écoute événements Stripe pour mise à jour statuts paiements
7. **Calendriers externes** : OAuth Google/Microsoft, import/export indisponibilités
8. **Notifications** : SendGrid (email), Twilio (SMS)

## Documentation technique complète

Voir les documents de référence dans le répertoire `docs/` du projet parent :
- `docs/vision.md` : Vision produit et proposition de valeur
- `docs/domain-model.md` : Modèle de données et contrat d'API complet
- `docs/technical-specifications.md` : Architecture backend détaillée
- `docs/stage.md` : Plan d'implémentation séquentiel en 8 jalons

## Qualité de code

Le projet utilise ESLint (config Airbnb) et Prettier pour garantir la cohérence et la qualité du code.

**Avant chaque commit :**
```bash
npm run lint:fix
npm run format
```

## Licence

MIT