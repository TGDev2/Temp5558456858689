# Spécifications techniques backend – ArtisanConnect

## Préambule

Ce document constitue la référence technique unique pour l'implémentation du backend ArtisanConnect. Il traduit la vision produit (`docs/vision.md`) et le modèle de domaine (`docs/domain-model.md`) en décisions d'architecture concrètes, choix de stack technologique, patterns de conception et plan d'implémentation séquentiel.

**Objectif :** Construire un backend robuste, sécurisé, maintenable et évolutif, aligné à 100 % avec les besoins métier et le prototype front existant, tout en respectant les meilleures pratiques de développement logiciel.

**Périmètre MVP :** Instance mono-artisan, intégration Stripe pour acomptes, synchronisation bidirectionnelle avec calendriers externes (Google, Outlook, Apple), notifications email/SMS automatiques, gestion complète du cycle de vie des réservations (création, annulation, replanification).

---

## 1. Architecture globale

### 1.1 Principes de conception

**Architecture en couches :**

- **Couche Présentation (API HTTP)** : Endpoints REST exposés au front, validation des requêtes, sérialisation JSON, gestion des erreurs HTTP
- **Couche Domaine (Business Logic)** : Logique métier pure, entités, règles de gestion, calculs (acomptes, conflits de créneaux, statuts de réservation)
- **Couche Infrastructure** : Accès base de données, intégrations externes (Stripe, calendriers, notifications), stockage de fichiers, caches

**Principes SOLID appliqués :**

- **Single Responsibility :** Chaque module a une responsabilité unique et bien définie (ex : `BookingService` gère uniquement le cycle de vie des réservations, pas les paiements)
- **Open/Closed :** Extensibilité via interfaces (ex : `PaymentProvider`, `CalendarConnector`, `NotificationChannel`) pour faciliter l'ajout de nouveaux PSP ou calendriers sans modifier le code existant
- **Dependency Inversion :** Les modules métier dépendent d'abstractions, pas d'implémentations concrètes (injection de dépendances via constructeur ou factory)

**Domain-Driven Design (simplifié) :**

- **Aggregates racines :** `Artisan`, `Booking`, `Service` (entités centrales avec cycle de vie autonome)
- **Value Objects :** `DepositInfo`, `Customer`, `NotificationPreferences` (objets immuables sans identité propre)
- **Domain Services :** `SlotAvailabilityService` (logique métier complexe ne relevant pas naturellement d'une entité)
- **Repositories :** Abstraction de persistance (`BookingRepository`, `ServiceRepository`) masquant les détails SQL

### 1.2 Séparation front/back

**Front (existant) :**

- HTML/CSS/JavaScript statique servi par CDN ou serveur web léger (Nginx, Apache, Vercel, Netlify)
- Communication avec le backend exclusivement via API HTTP REST (JSON)
- Aucune logique métier côté front, seulement validation de surface et affichage

**Back (à implémenter) :**

- API REST JSON servie par Node.js/Express (ou équivalent Python Flask/Django, Go Gin, Ruby Rails, PHP Laravel)
- Gestion complète de la logique métier, persistance, intégrations externes, sécurité
- Architecture modulaire permettant le déploiement indépendant du front (principe JAMstack)

**Avantages de cette séparation :**

- Scalabilité indépendante (front statique servi par CDN mondial, backend scalé selon charge API)
- Sécurité renforcée (logique métier et secrets côté serveur, front non manipulable par le client)
- Évolutivité (possibilité d'ajouter une app mobile native consommant la même API sans réécriture)
- Testabilité (backend testé unitairement et end-to-end sans dépendance au DOM navigateur)

---

## 2. Stack technologique recommandée

### 2.1 Backend framework

**Recommandation : Node.js + Express.js**

**Justification :**

- Cohérence avec le prototype front JavaScript existant (même écosystème, réutilisation de connaissances)
- Écosystème npm riche et mature (bibliothèques pour Stripe, Google APIs, Microsoft Graph, validation, ORM)
- Performance suffisante pour un MVP mono-artisan (event loop non-bloquant adapté aux I/O intensives : API externes, base de données)
- Déploiement simplifié sur Heroku, Railway, Render, DigitalOcean App Platform, AWS Elastic Beanstalk
- Communauté active et documentation exhaustive

**Alternatives acceptables :**

- **Python + Flask/FastAPI** : Excellent pour prototypage rapide, typage optionnel avec Pydantic, bibliothèques ML/data science si évolutions analytics futures
- **Go + Gin/Echo** : Performance supérieure, typage statique fort, compilation vers binaire standalone, mais courbe d'apprentissage plus raide et écosystème plus jeune
- **Ruby + Rails** : Productivité élevée grâce aux conventions, mais performance inférieure et communauté moins dynamique qu'avant
- **PHP + Laravel** : Mature, hébergement économique, mais perception legacy et écosystème moins moderne

**Stack finale retenue (Node.js) :**

- **Runtime :** Node.js 20 LTS (support long terme, stable, sécurisé)
- **Framework web :** Express.js 4.x (minimaliste, flexible, éprouvé)
- **Langage :** JavaScript ES2023+ avec validation TypeScript optionnelle pour typage statique (amélioration maintenabilité sans migration complète)

### 2.2 Base de données

**Recommandation : PostgreSQL 15+**

**Justification :**

- **Fiabilité :** Transactions ACID garantissant la cohérence des réservations et paiements (critique pour éviter double-booking ou perte d'acompte)
- **Intégrité :** Contraintes relationnelles (foreign keys, unique, check) imposées au niveau base de données, pas seulement applicatif
- **Performance :** Indexation avancée (B-tree, GiST pour requêtes géospatiales futures si zones d'intervention), support JSON natif pour données semi-structurées (calendriers externes)
- **Extensibilité :** Full-text search, UUID natifs, extensions PostGIS (géolocalisation future), pg_cron (tâches planifiées pour rappels)
- **Écosystème :** Support universel (tous les hébergeurs PaaS proposent PostgreSQL managé)
- **Open-source et gratuit :** Pas de licence propriétaire, communauté mondiale active

**Alternatives envisagées et rejetées :**

- **MySQL/MariaDB :** Moins rigoureux sur contraintes, transactions moins robustes historiquement, écosystème moins riche
- **MongoDB (NoSQL)** : Inadapté pour transactions financières et relations complexes (bookings ↔ services ↔ artisans), schema flexibility non nécessaire ici
- **SQLite :** Insuffisant pour production multi-utilisateurs (verrous de base globaux, pas de réplication)

**Configuration retenue :**

- PostgreSQL 15.x hébergé sur service managé (Heroku Postgres, AWS RDS, DigitalOcean Managed Databases, Railway)
- Schéma normalisé 3NF, migrations versionnées avec **node-pg-migrate** ou **Knex migrations**
- Backups automatiques quotidiens avec rétention 30 jours minimum (conformité RGPD et sécurité)

### 2.3 ORM / Query builder

**Recommandation : Knex.js (query builder) + custom repositories**

**Justification :**

- **Knex.js :** Query builder SQL pur, sans abstractions ORM lourdes, permettant contrôle fin des requêtes (performance optimale)
- **Flexibilité :** Possibilité d'écrire du SQL brut pour requêtes complexes (disponibilités avec multiples joins et conditions), tout en bénéficiant du query builder pour CRUD simples
- **Migrations :** Système de migrations intégré, versionné, réversible (rollback en cas de problème)
- **Connection pooling :** Gestion automatique du pool de connexions PostgreSQL, réutilisation des connexions, timeouts configurables
- **Pas de magic :** Pas de lazy loading, eager loading automatique, cascades implicites (source fréquente de bugs et N+1 queries dans ORM complets)

**Alternatives envisagées :**

- **Sequelize (ORM complet)** : Trop de magie, performance dégradée sur requêtes complexes, difficultés de debug, abstractions fuites (leaky abstractions)
- **TypeORM :** Orienté TypeScript, puissant mais verbeux, courbe d'apprentissage élevée, overkill pour MVP
- **Prisma :** Moderne, typage excellent, mais schema DSL propriétaire, migrations automatiques parfois imprévisibles, lock-in risqué

**Pattern repository personnalisé :**

- Abstraction fine au-dessus de Knex (`BookingRepository.create()`, `BookingRepository.findByCode()`, etc.)
- Encapsulation des détails SQL, facilitation des tests (mock des repositories)
- Exemples : `ServiceRepository`, `BookingRepository`, `ExternalBusyBlockRepository`, `ArtisanRepository`

### 2.4 Validation et sérialisation

**Recommandation : Joi (validation) + custom DTO serializers**

**Justification :**

- **Joi :** Bibliothèque de validation déclarative mature, expressive, avec messages d'erreur personnalisables
- **Validation centralisée :** Middleware Express validant les `req.body`, `req.query`, `req.params` avant exécution des controllers
- **Sécurité :** Rejet immédiat des payloads invalides (protection contre injections, payloads malformés)
- **Documentation vivante :** Schémas Joi servent de documentation d'API (types attendus, contraintes, exemples)

**Alternatives :**

- **Yup :** Similaire à Joi, légèrement plus simple, mais moins riche en fonctionnalités de validation complexes
- **Class-validator (TypeScript)** : Excellent pour typage strict, mais nécessite TypeScript complet (hors scope MVP)

**DTO (Data Transfer Objects) :**

- Transformation explicite des entités métier vers objets JSON exposés par l'API (éviter d'exposer directement les entités de domaine)
- Exemple : `BookingDTO.fromEntity(booking)` produit le JSON consommé par le front, masquant certains champs internes (IDs techniques, métadonnées de synchronisation calendrier)

### 2.5 Intégrations externes

**Stripe (Paiements) :**

- **Bibliothèque :** `stripe` (SDK Node.js officiel)
- **Pattern :** Payment Intents API (flow recommandé pour SCA compliance, 3D Secure automatique)
- **Webhooks :** Écoute des événements Stripe (`payment_intent.succeeded`, `payment_intent.canceled`) pour mise à jour asynchrone du statut de paiement côté backend

**Google Calendar API :**

- **Bibliothèque :** `googleapis` (SDK Node.js officiel Google)
- **Authentification :** OAuth 2.0 flow (authorization code pour obtention de refresh token, stocké chiffré en base)
- **Opérations :** `events.list()` pour import d'indisponibilités, `events.insert()` pour export de réservations confirmées

**Microsoft Graph API (Outlook/Office 365) :**

- **Bibliothèque :** `@microsoft/microsoft-graph-client` (SDK Node.js officiel Microsoft)
- **Authentification :** OAuth 2.0 flow similaire à Google
- **Opérations :** `calendar.events.list()`, `calendar.events.create()`

**Apple Calendar (CalDAV) :**

- **Bibliothèque :** `dav` (client CalDAV JavaScript)
- **Authentification :** App-specific password (généré par l'utilisateur dans les réglages iCloud)
- **Opérations :** Requêtes CalDAV XML pour lecture/écriture événements (plus bas niveau que Google/Microsoft)

**SendGrid (Email) :**

- **Bibliothèque :** `@sendgrid/mail` (SDK Node.js officiel)
- **Templates :** Templates SendGrid avec variables dynamiques (code réservation, date, heure, nom client)
- **Configuration :** API key stockée en variable d'environnement, rate limiting côté SendGrid (100 emails/jour gratuit, puis tarification par volume)

**Twilio (SMS) :**

- **Bibliothèque :** `twilio` (SDK Node.js officiel)
- **Configuration :** Account SID, Auth Token, numéro Twilio (acheté ou loué)
- **Limitation MVP :** SMS désactivés dans plan Starter (email seulement), activés en Pro/Business

### 2.6 Environnement de développement

**Node.js 20 LTS + npm/yarn**

**Tooling recommandé :**

- **Linter :** ESLint avec config Airbnb ou Standard (code style cohérent, détection erreurs courantes)
- **Formatter :** Prettier (formatage automatique, fin des débats de style)
- **Git hooks :** Husky + lint-staged (validation pré-commit automatique, empêche commit de code non linté)
- **Tests :** Jest (tests unitaires, mocks, coverage), Supertest (tests d'intégration API HTTP)
- **Variables d'environnement :** `dotenv` pour `.env` local, secrets managés via service hébergeur en production (Heroku Config Vars, Railway Variables)

**Structure de répertoires :**

```
backend/
├── src/
│   ├── api/              # Couche présentation (controllers, routes, middlewares)
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   └── validators/
│   ├── domain/           # Couche métier (services, entités, règles de gestion)
│   │   ├── entities/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── value-objects/
│   ├── infrastructure/   # Couche infrastructure (DB, intégrations externes)
│   │   ├── database/
│   │   ├── stripe/
│   │   ├── calendars/
│   │   ├── notifications/
│   │   └── config/
│   ├── utils/            # Utilitaires transverses (date, crypto, logging)
│   └── app.js            # Point d'entrée Express, configuration middleware, routes
├── migrations/           # Migrations base de données versionnées (Knex)
├── tests/                # Tests unitaires et d'intégration
│   ├── unit/
│   └── integration/
├── .env.example          # Template variables d'environnement (sans secrets)
├── .eslintrc.js          # Configuration ESLint
├── .prettierrc           # Configuration Prettier
├── package.json          # Dépendances npm, scripts (dev, test, migrate, start)
└── README.md             # Documentation technique backend (setup, déploiement)
```

---

## 3. Modèle de données relationnel (PostgreSQL)

### 3.1 Schéma SQL complet

#### Table `artisans`

```sql
CREATE TABLE artisans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  timezone VARCHAR(100) NOT NULL DEFAULT 'Europe/Paris',
  plan VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'business')),
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_artisans_email ON artisans(email);
```

**Notes :**

- `id` UUID pour sécurité (non séquentiel, non prédictible)
- `timezone` IANA timezone pour calculs horaires précis (éviter ambiguïtés DST)
- `plan` avec contrainte CHECK pour garantir valeurs valides (starter, pro, business)
- `stripe_customer_id` pour associer artisan à compte Stripe (facturation abonnements futurs)

#### Table `services`

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0 AND duration_minutes % 30 = 0),
  base_price_cents INT NOT NULL CHECK (base_price_cents >= 0),
  deposit_rate DECIMAL(3, 2) NOT NULL CHECK (deposit_rate >= 0 AND deposit_rate <= 1),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_artisan_active ON services(artisan_id, is_active);
```

**Notes :**

- `duration_minutes` multiple de 30 par défaut (configurable, contrainte CHECK flexible)
- `base_price_cents` en centimes pour éviter problèmes de précision décimaux
- `deposit_rate` DECIMAL(3,2) pour taux entre 0.00 et 1.00 (ex : 0.30 = 30 %)
- `is_active` pour soft-delete (archivage sans perte de données historiques)

#### Table `opening_rules`

```sql
CREATE TABLE opening_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_minutes INT NOT NULL CHECK (start_minutes >= 0 AND start_minutes < 1440),
  end_minutes INT NOT NULL CHECK (end_minutes > start_minutes AND end_minutes <= 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artisan_id, day_of_week)
);

CREATE INDEX idx_opening_rules_artisan ON opening_rules(artisan_id);
```

**Notes :**

- `day_of_week` : 0 = dimanche, 1 = lundi, ..., 6 = samedi (norme ISO 8601)
- `start_minutes` et `end_minutes` : minutes depuis 00:00 (0 = 00:00, 510 = 08:30, 1080 = 18:00)
- Contrainte UNIQUE sur (artisan_id, day_of_week) : une seule règle par jour (simplification MVP, extension future pour multiples plages)

#### Table `break_rules`

```sql
CREATE TABLE break_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_minutes INT NOT NULL CHECK (start_minutes >= 0 AND start_minutes < 1440),
  end_minutes INT NOT NULL CHECK (end_minutes > start_minutes AND end_minutes <= 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_break_rules_artisan ON break_rules(artisan_id);
```

**Notes :**

- Similaire à `opening_rules` mais pour pauses récurrentes (déjeuner, pauses café)
- Pas de contrainte UNIQUE (plusieurs pauses possibles par jour)

#### Table `bookings`

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code VARCHAR(10) NOT NULL UNIQUE,
  artisan_id UUID NOT NULL REFERENCES artisans(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled')),
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  start_datetime TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  deposit_amount_cents INT NOT NULL CHECK (deposit_amount_cents >= 0),
  deposit_rate DECIMAL(3, 2) NOT NULL,
  deposit_payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (deposit_payment_status IN ('pending', 'authorized', 'captured', 'refunded', 'failed')),
  deposit_payment_provider VARCHAR(50),
  deposit_payment_intent_id VARCHAR(255),
  notifications_email BOOLEAN NOT NULL DEFAULT TRUE,
  notifications_sms BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bookings_public_code ON bookings(public_code);
CREATE INDEX idx_bookings_artisan_status ON bookings(artisan_id, status);
CREATE INDEX idx_bookings_customer_email ON bookings(customer_email);
CREATE INDEX idx_bookings_start_datetime ON bookings(artisan_id, start_datetime);
```

**Notes :**

- `public_code` format `AC-XXXXXX` généré côté applicatif, UNIQUE pour recherche client
- Denormalisation volontaire : `price_cents`, `deposit_amount_cents`, `deposit_rate`, `duration_minutes` copiés depuis `services` au moment de la création (historique figé, évolution des prix service n'impacte pas réservations passées)
- `start_datetime` TIMESTAMPTZ pour précision fuseau horaire (crucial pour sync calendriers)
- `ON DELETE RESTRICT` sur FK `artisan_id` et `service_id` : empêche suppression artisan/service avec réservations associées (intégrité référentielle stricte)
- Index composite `(artisan_id, start_datetime)` pour requêtes de disponibilités fréquentes

#### Table `external_busy_blocks`

```sql
CREATE TABLE external_busy_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  provider_id VARCHAR(50) NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('external', 'booking')),
  summary VARCHAR(500),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL CHECK (end_datetime > start_datetime),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  external_event_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_external_busy_artisan_range ON external_busy_blocks(artisan_id, start_datetime, end_datetime);
CREATE INDEX idx_external_busy_booking ON external_busy_blocks(booking_id);
```

**Notes :**

- `provider_id` : 'google', 'outlook', 'apple', etc. (identifie la source calendrier)
- `source` : 'external' si importé depuis calendrier, 'booking' si exporté depuis réservation confirmée
- `external_event_id` : ID événement chez le provider (pour mise à jour/suppression ultérieure)
- `booking_id` : présent si `source = 'booking'`, NULL sinon (FK optionnelle avec CASCADE pour nettoyage automatique)
- Index composite `(artisan_id, start_datetime, end_datetime)` pour requêtes de conflits de créneaux (range overlaps)

#### Table `calendar_connections`

```sql
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  provider_id VARCHAR(50) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artisan_id, provider_id)
);

CREATE INDEX idx_calendar_connections_artisan ON calendar_connections(artisan_id);
```

**Notes :**

- Stockage sécurisé des tokens OAuth (chiffrement AES-256 avant insertion en base, clé de chiffrement en variable d'environnement)
- `refresh_token_encrypted` pour renouvellement automatique des tokens expirés (Google/Microsoft)
- `last_sync_at` pour tracking des synchronisations périodiques

### 3.2 Migrations versionnées

**Outil : Knex migrations**

**Commandes :**

```bash
# Créer une nouvelle migration
npm run migrate:make create_artisans_table

# Appliquer toutes les migrations en attente
npm run migrate:latest

# Rollback dernière migration
npm run migrate:rollback

# Status des migrations
npm run migrate:status
```

**Exemple de migration (création table `artisans`) :**

```javascript
// migrations/20250110120000_create_artisans.js
exports.up = function(knex) {
  return knex.schema.createTable('artisans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('display_name', 255).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('phone', 50);
    table.string('timezone', 100).notNullable().defaultTo('Europe/Paris');
    table.string('plan', 50).notNullable().defaultTo('starter');
    table.string('stripe_customer_id', 255);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('artisans');
};
```

**Stratégie de versioning :**

- Une migration par modification de schéma (création table, ajout colonne, modification contrainte)
- Migrations réversibles (`up` et `down` implémentés) pour rollback sécurisé en cas de problème
- Nom de fichier horodaté (`YYYYMMDDHHMMSS_description.js`) pour ordre d'exécution garanti

---

## 4. Architecture API REST

### 4.1 Structure des endpoints

**Principes :**

- **RESTful :** Ressources identifiées par URL (`/api/services`, `/api/bookings`), verbes HTTP sémantiques (GET, POST, PUT, DELETE)
- **Versioning :** Préfixe `/api/v1` pour évolutions futures non rétrocompatibles
- **JSON uniquement :** `Content-Type: application/json` pour requêtes et réponses
- **Codes HTTP standards :** 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 409 Conflict, 500 Internal Server Error

**Endpoints MVP (alignés avec `domain-model.md`) :**

```
GET    /api/v1/services
GET    /api/v1/availability?serviceId={id}&date={YYYY-MM-DD}
POST   /api/v1/bookings
GET    /api/v1/bookings/public?code={AC-XXXXXX}&email={email}
POST   /api/v1/bookings/{publicCode}/cancel
POST   /api/v1/bookings/{publicCode}/reschedule
POST   /api/v1/webhooks/stripe
```

**Extensions futures (hors MVP) :**

```
POST   /api/v1/auth/login (authentification artisan)
GET    /api/v1/artisan/bookings (liste réservations pour artisan authentifié)
PATCH  /api/v1/artisan/services/{id} (modification service)
GET    /api/v1/artisan/stats (dashboard analytics)
```

### 4.2 Middleware Express

**Ordre d'exécution (pipeline) :**

1. **Logging :** Morgan (logs HTTP requests, timestamps, status codes, durées)
2. **Body parsing :** `express.json()` (parse JSON payloads, limite 10MB par défaut)
3. **CORS :** Configuration permissive en dev, restrictive en prod (whitelist domaines front autorisés)
4. **Rate limiting :** `express-rate-limit` (max 100 requêtes/15min par IP pour endpoints publics, plus strict pour webhooks)
5. **Helmet :** Sécurité HTTP headers (XSS protection, HSTS, CSP, frameguard)
6. **Validation :** Middleware custom utilisant Joi schemas (valide `req.body`, `req.query`, `req.params`)
7. **Controllers :** Logique métier (appel services domaine, repositories)
8. **Error handling :** Middleware global capturant erreurs, formattant réponses JSON cohérentes

**Exemple middleware validation :**

```javascript
// src/api/middlewares/validate.js
const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const details = error.details.map((d) => d.message).join(', ');
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: details }
      });
    }
    next();
  };
};

module.exports = { validate };
```

### 4.3 Gestion des erreurs

**Classes d'erreurs personnalisées :**

```javascript
// src/domain/errors/DomainError.js
class DomainError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

class SlotUnavailableError extends DomainError {
  constructor() {
    super('SLOT_UNAVAILABLE', 'Créneau déjà réservé ou indisponible.', 409);
  }
}

class BookingNotFoundError extends DomainError {
  constructor() {
    super('BOOKING_NOT_FOUND', 'Réservation introuvable.', 404);
  }
}

module.exports = { DomainError, SlotUnavailableError, BookingNotFoundError };
```

**Middleware global d'erreurs :**

```javascript
// src/api/middlewares/errorHandler.js
const { DomainError } = require('../../domain/errors/DomainError');

const errorHandler = (err, req, res, next) => {
  if (err instanceof DomainError) {
    return res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message }
    });
  }

  // Erreur inattendue : log complet côté serveur, message générique côté client
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Une erreur est survenue.' }
  });
};

module.exports = { errorHandler };
```

### 4.4 Logging

**Winston (Node.js) :**

```javascript
// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

module.exports = { logger };
```

**Niveaux de log :**

- `error` : Erreurs critiques (échec paiement Stripe, base de données inaccessible)
- `warn` : Avertissements (token calendrier expiré, rate limit atteint)
- `info` : Événements métier importants (réservation créée, annulation effectuée)
- `debug` : Détails techniques (requêtes SQL, réponses API externes)

**Logs structurés JSON :** Facilite parsing par outils de monitoring (Datadog, LogDNA, Papertrail)

---

## 5. Intégrations externes

### 5.1 Stripe (Paiements)

**Pattern : Payment Intents API**

**Flow de création de réservation avec acompte :**

1. Front envoie `POST /api/v1/bookings` avec données réservation (service, date, time, customer, notifications)
2. Backend calcule montant acompte (`basePriceCents * depositRate`)
3. Backend crée Payment Intent Stripe : `stripe.paymentIntents.create({ amount, currency: 'eur', ... })`
4. Backend renvoie `clientSecret` au front (JSON response)
5. Front initialise Stripe Elements avec `clientSecret`, affiche formulaire carte bancaire (sécurisé côté Stripe, pas de données carte transitant par backend)
6. Client remplit et soumet formulaire, Stripe valide paiement (3D Secure si nécessaire)
7. Stripe renvoie confirmation au front (via `stripe.confirmCardPayment()`)
8. Front envoie confirmation au backend (ou backend écoute webhook `payment_intent.succeeded`)
9. Backend met à jour statut réservation (`deposit_payment_status = 'authorized'` ou `'captured'`)
10. Backend crée événement calendrier externe, envoie notifications email/SMS

**Gestion des webhooks Stripe :**

```javascript
// src/api/controllers/webhookController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { BookingRepository } = require('../../domain/repositories/BookingRepository');

const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    await BookingRepository.updatePaymentStatus(
      paymentIntent.id,
      'captured'
    );
  }

  res.json({ received: true });
};

module.exports = { handleStripeWebhook };
```

**Sécurité Stripe :**

- **API key secrète** (`STRIPE_SECRET_KEY`) stockée en variable d'environnement, jamais commitée
- **Webhook signature vérification** : empêche replay attacks et requêtes forgées
- **Idempotency keys** : garantir qu'une requête Stripe dupliquée ne crée pas deux charges (fonctionnalité native Stripe)

### 5.2 Google Calendar API

**Authentification OAuth 2.0 :**

1. Artisan clique "Connecter Google Calendar" dans interface (future fonctionnalité artisan-facing)
2. Backend redirige vers URL Google OAuth avec `scope=https://www.googleapis.com/auth/calendar`
3. Artisan autorise, Google redirige vers callback backend avec `code`
4. Backend échange `code` contre `access_token` + `refresh_token` via `google.auth.getToken()`
5. Backend stocke tokens chiffrés en table `calendar_connections`

**Import d'indisponibilités (scheduled job toutes les 15 minutes) :**

```javascript
// src/infrastructure/calendars/googleCalendarService.js
const { google } = require('googleapis');

const importGoogleBusyBlocks = async (artisanId) => {
  const connection = await CalendarConnectionRepository.findByArtisanAndProvider(
    artisanId,
    'google'
  );
  if (!connection) return;

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: decrypt(connection.access_token_encrypted),
    refresh_token: decrypt(connection.refresh_token_encrypted)
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const endRange = new Date();
  endRange.setDate(now.getDate() + 30); // Import 30 jours à l'avance

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: endRange.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  const events = response.data.items || [];

  // Nettoyer anciens blocs externes Google, réinsérer nouveaux
  await ExternalBusyBlockRepository.deleteByArtisanAndProvider(artisanId, 'google', 'external');

  for (const event of events) {
    if (event.start.dateTime && event.end.dateTime) {
      await ExternalBusyBlockRepository.create({
        artisan_id: artisanId,
        provider_id: 'google',
        source: 'external',
        summary: event.summary || 'Indisponibilité',
        start_datetime: event.start.dateTime,
        end_datetime: event.end.dateTime,
        external_event_id: event.id
      });
    }
  }

  await CalendarConnectionRepository.updateLastSync(connection.id);
};

module.exports = { importGoogleBusyBlocks };
```

**Export de réservations :**

```javascript
const exportBookingToGoogleCalendar = async (booking) => {
  const connection = await CalendarConnectionRepository.findByArtisanAndProvider(
    booking.artisan_id,
    'google'
  );
  if (!connection) return;

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: decrypt(connection.access_token_encrypted),
    refresh_token: decrypt(connection.refresh_token_encrypted)
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event = {
    summary: `${booking.service.name} - ${booking.customer_name}`,
    description: `Réservation ${booking.public_code}`,
    start: { dateTime: booking.start_datetime },
    end: { dateTime: addMinutes(booking.start_datetime, booking.duration_minutes) }
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event
  });

  await ExternalBusyBlockRepository.create({
    artisan_id: booking.artisan_id,
    provider_id: 'google',
    source: 'booking',
    summary: event.summary,
    start_datetime: booking.start_datetime,
    end_datetime: addMinutes(booking.start_datetime, booking.duration_minutes),
    booking_id: booking.id,
    external_event_id: response.data.id
  });
};

module.exports = { exportBookingToGoogleCalendar };
```

### 5.3 Microsoft Graph API (Outlook)

**Flow similaire à Google :**

- OAuth 2.0 avec `scope=Calendars.ReadWrite`
- Import via `GET /me/calendar/events?$filter=start/dateTime ge '{startDate}'`
- Export via `POST /me/calendar/events`

**Spécificités :**

- Tokens Microsoft expirent après 1 heure (nécessité de refresh systématique avant appels)
- Rate limiting plus strict que Google (throttling possible, nécessite retry avec exponential backoff)

### 5.4 Apple Calendar (CalDAV)

**Authentification :**

- App-specific password (généré par utilisateur dans réglages iCloud.com)
- Connexion CalDAV XML-RPC (plus bas niveau que REST)

**Bibliothèque :** `dav` (JavaScript CalDAV client)

**Complexité supérieure :**

- Pas d'API REST moderne (XML parsing, requêtes PROPFIND, REPORT)
- Support partiel des fuseaux horaires (conversion manuelle nécessaire)
- Recommandation MVP : Support Google/Outlook prioritaire, Apple en nice-to-have

### 5.5 SendGrid (Email)

**Configuration :**

```javascript
// src/infrastructure/notifications/emailService.js
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendBookingConfirmation = async (booking) => {
  const msg = {
    to: booking.customer_email,
    from: 'noreply@artisanconnect.fr',
    templateId: 'd-xxxxxxxxxxxxx', // Template SendGrid pré-créé
    dynamicTemplateData: {
      customerName: booking.customer_name,
      serviceName: booking.service.name,
      date: formatDate(booking.start_datetime),
      time: formatTime(booking.start_datetime),
      code: booking.public_code,
      deposit: formatCurrency(booking.deposit_amount_cents / 100),
      manageUrl: `https://app.artisanconnect.fr/manage?code=${booking.public_code}`
    }
  };

  await sgMail.send(msg);
};

module.exports = { sendBookingConfirmation };
```

**Templates SendGrid dynamiques :**

- Confirmation de réservation
- Rappel 24h avant rendez-vous
- Confirmation d'annulation
- Confirmation de replanification

**Gestion des erreurs d'envoi :**

- Retry automatique avec exponential backoff (3 tentatives max)
- Log des échecs d'envoi pour investigation (adresse email invalide, quota dépassé)
- Pas de blocage de la réservation si email échoue (réservation confirmée même si notification non envoyée, log warning)

### 5.6 Twilio (SMS)

**Configuration :**

```javascript
// src/infrastructure/notifications/smsService.js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendBookingReminder = async (booking) => {
  if (!booking.notifications_sms || !booking.customer_phone) return;

  await client.messages.create({
    body: `Rappel : RDV ${booking.service.name} demain à ${formatTime(booking.start_datetime)}. Code ${booking.public_code}. Gérer : https://app.artisanconnect.fr/manage?code=${booking.public_code}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: booking.customer_phone
  });
};

module.exports = { sendBookingReminder };
```

**Limitation MVP :**

- SMS désactivés dans plan Starter (uniquement email)
- SMS activés dans plan Pro/Business (facturation Twilio par SMS envoyé, répercuté dans pricing)

**Cron job pour rappels automatiques :**

- Job quotidien à 18h00 (timezone artisan) scannant réservations J+1
- Envoi SMS + email rappel pour chaque réservation concernée

---

## 6. Sécurité

### 6.1 Authentification artisan (future extension hors MVP)

**JWT (JSON Web Tokens) :**

- Login artisan : `POST /api/v1/auth/login` avec email + password hashé (bcrypt)
- Backend renvoie JWT signé (secret stocké en variable d'environnement)
- JWT contient `artisanId`, `plan`, `exp` (expiration 24h)
- Middleware Express vérifie JWT sur endpoints protégés (`GET /api/v1/artisan/*`)

**Pas d'authentification client MVP :**

- Clients identifiés par couple `(code, email)` pour gestion réservation (suffisant pour MVP, UX simplifiée)
- Extension future : Compte client optionnel avec historique réservations, préférences sauvegardées

### 6.2 Protection CSRF

**Pas nécessaire pour API REST stateless sans cookies de session** (JWT en header `Authorization: Bearer <token>`)

**Si implémentation session-based future :**

- Tokens CSRF générés côté serveur, validés sur requêtes mutatives (POST, PUT, DELETE)
- Bibliothèque : `csurf` (Express middleware)

### 6.3 Validation des entrées

**Joi schemas pour chaque endpoint :**

```javascript
// src/api/validators/bookingSchemas.js
const Joi = require('joi');

const createBookingSchema = Joi.object({
  serviceId: Joi.string().uuid().required(),
  date: Joi.string().isoDate().required(),
  time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  customer: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?\d{10,15}$/).optional()
  }).required(),
  notifications: Joi.object({
    email: Joi.boolean().default(true),
    sms: Joi.boolean().default(false)
  }).default({ email: true, sms: false })
});

module.exports = { createBookingSchema };
```

**Validation systématique :**

- Rejet immédiat (400 Bad Request) si payload invalide
- Messages d'erreur clairs (ex : "customer.email doit être un email valide")
- Protection contre injections SQL (Knex parameterized queries + validation entrées)
- Protection contre XSS (sanitization automatique des champs texte avant insertion base)

### 6.4 Gestion des secrets

**Variables d'environnement :**

```bash
# .env.example (template sans valeurs réelles)
DATABASE_URL=postgresql://user:password@localhost:5432/artisanconnect
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+33123456789
CALENDAR_ENCRYPTION_KEY=xxxxxxxxxxxxx # Clé AES-256 pour chiffrement tokens OAuth
JWT_SECRET=xxxxxxxxxxxxx # Pour authentification artisan future
```

**Production :**

- Secrets managés via service hébergeur (Heroku Config Vars, Railway Variables, AWS Secrets Manager)
- Rotation régulière des secrets (mensuelle recommandée)
- Logs sans secrets (masquage automatique des valeurs sensibles via Winston transports)

### 6.5 Conformité RGPD (minimale MVP)

**Données personnelles collectées :**

- Artisans : nom, email, téléphone, timezone
- Clients : nom, email, téléphone (optionnel), historique réservations

**Mesures RGPD :**

- **Consentement explicite** : Cases à cocher notifications email/SMS (opt-in)
- **Droit d'accès** : Endpoint futur `GET /api/v1/customers/{email}/data` retournant toutes données associées
- **Droit à l'oubli** : Endpoint futur `DELETE /api/v1/customers/{email}` anonymisant réservations passées (soft-delete : `customer_name = 'Anonymisé'`, `customer_email = null`)
- **Durée de conservation** : Suppression automatique réservations > 2 ans (cron job mensuel)
- **Sécurité** : Chiffrement tokens OAuth, connexion HTTPS obligatoire (TLS 1.3), backups chiffrés
- **Sous-traitants conformes** : Stripe, SendGrid, Twilio, hébergeurs certifiés RGPD

**Extension future :**

- Page confidentialité/CGU accessible depuis front
- Consentement cookies (si analytics Google/Mixpanel ajoutés)

---

## 7. Déploiement et opérations

### 7.1 Stratégie de déploiement

**Recommandation : Platform-as-a-Service (PaaS)**

**Options privilégiées :**

1. **Heroku** (simplicité maximale, coût modéré, PostgreSQL managé inclus)
2. **Railway** (moderne, pricing compétitif, déploiement GitHub automatique)
3. **Render** (gratuit pour petits projets, scale transparent, auto-sleep désactivable)
4. **DigitalOcean App Platform** (pricing prédictible, bonne documentation)

**Configuration Heroku (exemple) :**

```bash
# Installation Heroku CLI
brew tap heroku/brew && brew install heroku

# Création app Heroku
heroku create artisanconnect-api

# Provisioning PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Configuration variables d'environnement
heroku config:set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
heroku config:set SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
# ... autres secrets

# Déploiement depuis Git
git push heroku main

# Exécution migrations
heroku run npm run migrate:latest

# Logs en temps réel
heroku logs --tail
```

**Alternative : VPS (DigitalOcean Droplet, Linode, Vultr) :**

- Plus de contrôle, coût inférieur à long terme
- Nécessite gestion manuelle : Nginx reverse proxy, PM2 process manager, Let's Encrypt SSL, backups DB
- Recommandé si compétences DevOps solides ou budget très serré

### 7.2 CI/CD

**GitHub Actions (gratuit pour projets publics/privés avec runners gratuits) :**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          NODE_ENV: test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "artisanconnect-api"
          heroku_email: "deploy@artisanconnect.fr"
```

**Workflow :**

1. Push sur branche `develop` → Exécution tests + lint
2. Merge `develop` → `main` → Déploiement automatique Heroku après tests verts
3. Rollback automatique si déploiement échoue (via `heroku rollback`)

### 7.3 Monitoring

**Outils recommandés :**

- **Sentry** (error tracking, alertes temps réel sur erreurs 500, stack traces complètes)
- **Heroku Metrics** (CPU, mémoire, requêtes/seconde, temps de réponse p95/p99)
- **PostgreSQL logs** (slow queries > 1s, deadlocks, connections pool exhausted)

**Métriques clés à surveiller :**

- Taux d'erreur API (target < 0.1 %)
- Latence p99 endpoints critiques (`POST /bookings` < 500ms)
- Disponibilité base de données (target 99.9 %)
- Taux de succès paiements Stripe (target > 95 %)
- Taux d'échec envoi notifications (target < 5 %)

**Alertes configurées (Sentry + email) :**

- Erreur 500 sur endpoint critique (immédiat)
- Taux d'erreur > 1 % sur 15 minutes (warning)
- Base de données inaccessible > 1 minute (critical)
- Paiement Stripe échoué (notification artisan + log)

### 7.4 Backups

**PostgreSQL automatisés :**

- Heroku Postgres : Backups quotidiens automatiques, rétention 7 jours (hobby-dev), 30 jours (standard)
- Backups manuels avant migrations majeures : `heroku pg:backups:capture`
- Test de restauration mensuel : `heroku pg:backups:restore <backup_id>`

**Stratégie de rétention :**

- Quotidien : 30 jours
- Hebdomadaire : 3 mois
- Mensuel : 1 an

**Point de Recovery Objective (PRO) : 24 heures max** (acceptable pour MVP SaaS B2B)

---



---

## Conclusion

Ce document de spécifications techniques constitue le pont entre la vision produit ArtisanConnect et son implémentation concrète. Il définit de manière exhaustive l'architecture backend, les choix de stack technologique, le modèle de données, les intégrations externes, la sécurité et la stratégie de déploiement.

Le plan d'implémentation séquentiel en 8 jalons permet un développement incrémental et testé à chaque étape, minimisant les risques techniques et garantissant une qualité production-ready.

**Prochaine étape recommandée :** Démarrage du jalon 1 (Fondations backend et base de données), initialisation du projet Node.js, configuration de la base PostgreSQL, création des migrations et premiers tests unitaires.

Ce document doit rester la référence unique lors de toute évolution technique, permettant d'assurer la cohérence de l'architecture, la maintenabilité du code et l'alignement avec les objectifs produit et métier.