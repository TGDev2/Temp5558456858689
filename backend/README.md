# ArtisanConnect Backend

Backend API REST pour ArtisanConnect - Solution de gestion de rendez-vous pour artisans indépendants.

## État actuel

✅ **Endpoint health check** : `GET /api/v1/health` opérationnel  
✅ **Endpoint services** : `GET /api/v1/services` opérationnel (données en mémoire)  
⏳ Base de données PostgreSQL : à configurer (Jalon 1 complet)  
⏳ Endpoints disponibilités et réservations : à implémenter (Jalons 2-4)

## Stack Technique

- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js 4.x
- **Validation:** Joi
- **Logging:** Winston
- **Sécurité:** Helmet, CORS

## Installation

### Prérequis

- Node.js 20.x ou supérieur
- npm 10.x ou supérieur

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

Le fichier `.env` contient déjà les valeurs par défaut pour le développement local.

3. **Démarrer le serveur en mode développement**
```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

4. **Vérifier que le serveur fonctionne**
```bash
# Health check
curl http://localhost:3000/api/v1/health

# Liste des services
curl http://localhost:3000/api/v1/services
```

## Endpoints disponibles

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

### Services

**GET /api/v1/services**

Liste tous les services actifs proposés par l'artisan.

**Réponse 200 OK :**
```json
{
  "services": [
    {
      "id": "diag",
      "name": "Diagnostic et audit complet",
      "description": "Diagnostic plomberie avec rapport détaillé et recommandations",
      "durationMinutes": 30,
      "basePriceCents": 4000,
      "depositRate": 0.3,
      "isActive": true
    },
    {
      "id": "urgence",
      "name": "Intervention urgente",
      "description": "Dépannage sous 2 heures, disponible 24/7",
      "durationMinutes": 45,
      "basePriceCents": 12000,
      "depositRate": 0.4,
      "isActive": true
    },
    {
      "id": "maintenance",
      "name": "Maintenance planifiée",
      "description": "Entretien préventif avec créneaux réguliers",
      "durationMinutes": 60,
      "basePriceCents": 8000,
      "depositRate": 0.3,
      "isActive": true
    },
    {
      "id": "installation",
      "name": "Installation / mise en service",
      "description": "Installation complète avec garantie et suivi",
      "durationMinutes": 90,
      "basePriceCents": 16000,
      "depositRate": 0.35,
      "isActive": true
    }
  ]
}
```

## Scripts disponibles

- `npm start` : Démarrer le serveur en production
- `npm run dev` : Démarrer en mode développement avec auto-reload (nodemon)
- `npm run lint` : Vérifier la qualité du code (ESLint)
- `npm run lint:fix` : Corriger automatiquement les erreurs ESLint
- `npm run format` : Formater le code (Prettier)
- `npm run format:check` : Vérifier le formatage sans modification

## Architecture

```
backend/
├── src/
│   ├── api/              # Couche présentation (routes, controllers, middlewares)
│   │   ├── controllers/  # Logique HTTP, transformation DTO
│   │   │   └── serviceController.js
│   │   ├── middlewares/  # Middlewares Express
│   │   │   ├── errorHandler.js
│   │   │   └── validate.js
│   │   ├── routes/       # Définition des routes API
│   │   │   ├── healthRoutes.js
│   │   │   └── serviceRoutes.js
│   │   └── validators/   # Schémas Joi de validation
│   │       └── serviceSchemas.js
│   ├── domain/           # Couche métier (services, entités, règles)
│   │   └── services/
│   │       └── ServiceDomainService.js
│   ├── utils/            # Utilitaires transverses
│   │   └── logger.js
│   ├── app.js            # Configuration Express
│   └── server.js         # Point d'entrée HTTP
├── .env                  # Variables d'environnement locales
├── .env.example          # Template variables d'environnement
├── .eslintrc.js          # Configuration ESLint
├── .prettierrc           # Configuration Prettier
├── package.json          # Dépendances et scripts
└── README.md             # Ce fichier
```

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