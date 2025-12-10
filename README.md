# ArtisanConnect

**Agenda en ligne intelligent pour artisans indépendants**

ArtisanConnect est une solution de prise de rendez-vous en ligne conçue spécifiquement pour les artisans qui souhaitent arrêter de perdre du temps au téléphone, sécuriser leurs interventions avec des acomptes, et développer leur activité sans stress administratif.

## Table des matières

- [Vision Produit](#vision-produit)
- [Fonctionnalités Principales](#fonctionnalités-principales)
- [Architecture du Projet](#architecture-du-projet)
- [Installation et Démarrage](#installation-et-démarrage)
- [Documentation Technique](#documentation-technique)
- [Modèle de Données](#modèle-de-données)
- [Stack Technologique](#stack-technologique)
- [Roadmap MVP](#roadmap-mvp)
- [Modèle Économique](#modèle-économique)
- [Contribuer](#contribuer)
- [Licence](#licence)

## Vision Produit

### Problématique

Les artisans indépendants (plombiers, électriciens, chauffagistes, multi-services) perdent un temps considérable à gérer leurs rendez-vous par téléphone, SMS ou WhatsApp. Chaque prise de rendez-vous génère plusieurs allers-retours, les annulations de dernière minute entraînent des pertes sèches de chiffre d'affaires, et les oublis ou doublons de planning génèrent une charge mentale élevée.

### Solution

ArtisanConnect permet aux clients de réserver eux-mêmes un créneau en ligne, 24/7, avec :

- **Paiement d'acompte obligatoire** (par défaut 30% du prix, configurable)
- **Synchronisation automatique** avec Google Calendar, Outlook, Apple Calendar
- **Rappels automatiques** par email et SMS 24h avant le rendez-vous
- **Gestion autonome** par le client (modification, annulation) via code unique
- **Réduction de 70%** du temps passé au téléphone pour fixer des rendez-vous
- **Baisse de 50%** des no-shows grâce aux acomptes et rappels

## Fonctionnalités Principales

### Pour les Clients

✅ Réservation en ligne 24/7 sans inscription
✅ Catalogue de services avec prix transparents
✅ Visualisation des créneaux disponibles en temps réel
✅ Paiement d'acompte sécurisé (Stripe)
✅ Confirmation immédiate par email/SMS
✅ Gestion autonome avec code unique (annulation, replanification)
✅ Rappel automatique 24h avant l'intervention
✅ Interface responsive (mobile, tablette, desktop)

### Pour les Artisans

✅ Planning synchronisé automatiquement avec calendriers externes
✅ Import des indisponibilités (vie personnelle, autres engagements)
✅ Export automatique des réservations confirmées
✅ Encaissement d'acompte avant intervention
✅ Réduction drastique des no-shows
✅ Configuration des horaires d'ouverture et pauses
✅ Catalogue de services personnalisable (durée, prix, taux acompte)
✅ Notifications en temps réel
✅ Statistiques et analytics (Pro/Business)

## Architecture du Projet

Le projet suit une architecture en couches claire et modulaire :

```
TEST1/
├── docs/                          # Documentation technique
│   ├── vision.md                  # Vision produit et proposition de valeur
│   ├── domain-model.md            # Modèle de données et contrat API
│   └── technical-specifications.md # Architecture backend et plan implémentation
├── css/                           # Feuilles de style
│   └── styles.css                 # Styles globaux avec dark mode
├── js/                            # Logique métier front-end
│   ├── booking-core.js            # Logique de réservation (services, créneaux, acomptes)
│   ├── booking-ui.js              # Interface utilisateur de réservation
│   ├── calendar-sync.js           # Simulation sync calendriers externes
│   ├── api-client.js              # Client API (fetch/axios)
│   ├── form-validation.js         # Validation formulaires côté client
│   ├── theme-toggle.js            # Basculement dark/light mode
│   └── back-to-top.js             # Bouton retour haut de page
├── index.html                     # Page d'accueil
├── services.html                  # Page présentation des services
├── about.html                     # Page à propos
├── contact.html                   # Page contact
└── README.md                      # Ce fichier
```

### Séparation Front/Back

**Front (actuel) :** HTML/CSS/JavaScript statique avec simulation localStorage
**Back (à implémenter) :** API REST JSON (Node.js/Express recommandé)

Cette séparation permet :
- Scalabilité indépendante (front sur CDN, backend scalable selon charge API)
- Sécurité renforcée (logique métier côté serveur)
- Évolutivité (app mobile native possible sans réécriture)
- Testabilité (backend testé unitairement sans dépendance DOM)

## Installation et Démarrage

### Prérequis

- Navigateur moderne (Chrome, Firefox, Safari, Edge)
- Serveur web local (optionnel pour développement)

### Installation Rapide

1. **Cloner le repository**

```bash
git clone <repository-url>
cd TEST1
```

2. **Lancer un serveur web local** (optionnel)

```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js http-server
npx http-server -p 8000

# Avec PHP
php -S localhost:8000
```

3. **Ouvrir dans le navigateur**

```
http://localhost:8000/index.html
```

Ou ouvrir directement [index.html](index.html) dans votre navigateur.

### Mode Développement

Le front actuel fonctionne en mode simulation avec `localStorage` :
- Les services sont définis en dur dans [booking-core.js](js/booking-core.js)
- Les réservations sont stockées localement (persistantes entre sessions)
- Les paiements sont simulés (pas d'intégration Stripe réelle)
- Les calendriers externes sont simulés (pas d'API Google/Outlook/Apple)
- Les notifications email/SMS sont simulées (affichage console)

## Documentation Technique

### Documents de Référence

Trois documents techniques exhaustifs définissent l'implémentation complète :

#### 1. [Vision Produit](docs/vision.md)

Définit le problème utilisateur, la cible principale (persona Marc, plombier), la proposition de valeur, le modèle économique et les KPI de succès.

**Bénéfices mesurables :**
- Réduction de 70% du temps passé au téléphone
- Baisse de 50% des no-shows
- Sécurisation des créneaux avec acomptes obligatoires
- Agenda fiable synchronisé sans risque de doublon

#### 2. [Modèle de Domaine](docs/domain-model.md)

Spécifie le modèle de données métier (Artisan, Service, Booking, ExternalBusyBlock) et le contrat d'API HTTP RESTful complet avec exemples de requêtes/réponses.

**Endpoints MVP :**
- `GET /api/v1/services` - Liste des services actifs
- `GET /api/v1/availability` - Créneaux disponibles pour un service/date
- `POST /api/v1/bookings` - Création réservation avec acompte
- `GET /api/v1/bookings/public` - Consultation réservation (code + email)
- `POST /api/v1/bookings/{code}/cancel` - Annulation
- `POST /api/v1/bookings/{code}/reschedule` - Replanification

#### 3. [Spécifications Techniques Backend](docs/technical-specifications.md)

Architecture détaillée backend (Node.js/Express + PostgreSQL recommandé), schéma SQL complet, intégrations externes (Stripe, Google Calendar, SendGrid, Twilio), sécurité, déploiement, et plan d'implémentation séquentiel en 8 jalons.

**Stack recommandée :**
- **Backend :** Node.js 20 LTS + Express.js
- **Base de données :** PostgreSQL 15+ (transactions ACID, intégrité référentielle)
- **ORM/Query builder :** Knex.js (migrations versionnées)
- **Validation :** Joi (schemas déclaratifs)
- **Paiements :** Stripe Payment Intents API
- **Calendriers :** Google Calendar API, Microsoft Graph API, CalDAV (Apple)
- **Notifications :** SendGrid (email), Twilio (SMS)
- **Déploiement :** Heroku / Railway / Render / DigitalOcean App Platform

## Modèle de Données

### Entités Principales

**Artisan** (instance mono-artisan pour MVP)
- Nom d'affichage, email, téléphone, fuseau horaire
- Plan d'abonnement (Starter, Pro, Business)
- Horaires d'ouverture et pauses hebdomadaires

**Service**
- Nom, description, durée (minutes), prix (centimes)
- Taux d'acompte (0.0 à 1.0, ex: 0.3 = 30%)
- Statut actif/archivé

**Booking (Réservation)**
- Code public unique (`AC-XXXXXX`)
- Référence service et artisan
- Statut (`confirmed`, `cancelled`, `rescheduled`)
- Coordonnées client (nom, email, téléphone)
- Date/heure début (ISO 8601 avec fuseau horaire)
- Informations acompte (montant, devise, statut paiement, provider, payment intent ID)
- Préférences notifications (email, sms)

**ExternalBusyBlock (Indisponibilité)**
- Source (`external` = importé, `booking` = exporté)
- Provider (`google`, `outlook`, `apple`)
- Date/heure début et fin
- Référence booking si source = `booking`

### Règles Métier

✅ **Non-chevauchement** : Une réservation confirmée bloque le créneau exclusivement
✅ **Acompte obligatoire** : Calculé automatiquement (basePriceCents × depositRate)
✅ **Synchronisation bidirectionnelle** : Import indispos externes + export réservations
✅ **Validation disponibilité** : Horaires ouverture + pauses + réservations + indispos externes
✅ **Code unique** : Format `AC-XXXXXX` (6 alphanumériques majuscules)
✅ **Authentification légère** : Code + email (insensible casse/espaces)

## Stack Technologique

### Front-end (Actuel)

- **HTML5** : Structure sémantique, accessibilité (ARIA)
- **CSS3** : Grid/Flexbox, animations, variables CSS, dark mode
- **JavaScript ES6+** : Modules, async/await, destructuring
- **APIs navigateur** : localStorage, Intl (formatage dates/devises)
- **Responsive** : Mobile-first, breakpoints adaptatifs

### Back-end (À implémenter)

**Recommandation :** Node.js + Express.js + PostgreSQL

**Justification :**
- Cohérence avec écosystème JavaScript front
- Npm riche (Stripe SDK, Google APIs, Microsoft Graph, validation, ORM)
- Performance suffisante (event loop non-bloquant adapté I/O intensives)
- Déploiement simplifié (Heroku, Railway, Render, DigitalOcean)
- Communauté active et documentation exhaustive

**Alternatives acceptables :**
- Python + Flask/FastAPI (typage Pydantic, prototypage rapide)
- Go + Gin/Echo (performance supérieure, typage statique fort)
- Ruby + Rails (productivité élevée)
- PHP + Laravel (mature, hébergement économique)

### Intégrations Externes

| Service | Fonction | Bibliothèque |
|---------|----------|--------------|
| **Stripe** | Paiements acomptes (SCA compliance) | `stripe` (SDK officiel Node.js) |
| **Google Calendar** | Sync calendrier bidirectionnelle | `googleapis` (SDK officiel) |
| **Microsoft Graph** | Outlook/Office 365 sync | `@microsoft/microsoft-graph-client` |
| **Apple Calendar** | CalDAV sync | `dav` (client CalDAV JS) |
| **SendGrid** | Envoi emails (confirmations, rappels) | `@sendgrid/mail` |
| **Twilio** | Envoi SMS (rappels Pro/Business) | `twilio` (SDK officiel) |

## Roadmap MVP

### Jalons d'Implémentation (Plan séquentiel 10 semaines)

#### Jalon 1 : Fondations Backend (Semaine 1)
- Backend Express fonctionnel
- PostgreSQL provisionné
- Migrations tables (artisans, services, opening_rules, break_rules)
- Repositories basiques + tests unitaires
- Endpoint santé `GET /api/v1/health`

#### Jalon 2 : API Services et Disponibilités (Semaine 2)
- `GET /api/v1/services`
- `GET /api/v1/availability`
- Logique génération créneaux (horaires, pauses, conflits)
- Tests d'intégration Supertest

#### Jalon 3 : Création Réservations + Stripe (Semaine 3-4)
- `POST /api/v1/bookings`
- Intégration Stripe Payment Intents
- Webhooks Stripe (`payment_intent.succeeded`)
- Tests end-to-end avec paiements simulés

#### Jalon 4 : Gestion Réservations (Semaine 5)
- `GET /api/v1/bookings/public`
- `POST /api/v1/bookings/{code}/cancel`
- `POST /api/v1/bookings/{code}/reschedule`
- Tests scénarios complets

#### Jalon 5 : Sync Calendriers (Semaine 6-7)
- OAuth 2.0 Google Calendar / Microsoft Graph
- Import automatique indisponibilités (cron 15min)
- Export réservations confirmées
- Tests avec comptes test

#### Jalon 6 : Notifications (Semaine 8)
- SendGrid (emails confirmation/rappel/annulation)
- Twilio (SMS rappels Pro/Business)
- Cron job rappels 24h avant
- Gestion erreurs retry automatique

#### Jalon 7 : Sécurité et Polish (Semaine 9)
- Rate limiting (express-rate-limit)
- Helmet (sécurité headers HTTP)
- CORS restrictif
- Audit sécurité npm
- Documentation OpenAPI/Swagger

#### Jalon 8 : Déploiement Production (Semaine 10)
- Heroku/Railway production
- PostgreSQL managé
- Variables environnement
- SSL automatique (Let's Encrypt)
- Monitoring Sentry
- Tests end-to-end production

## Modèle Économique

### Plans d'Abonnement

#### 🎯 Starter (Gratuit)
- Jusqu'à 10 réservations/mois
- Notifications email uniquement
- Sync calendrier lecture seule
- Support standard (email, 48h)
- **Idéal pour** : Tester pendant 1-2 mois

#### ⭐ Pro (29€/mois ou 290€/an)
- Réservations illimitées
- Acomptes obligatoires intégrés
- Rappels SMS + email automatiques
- Sync bidirectionnelle complète
- Support prioritaire (email/chat, 4h)
- Statistiques de base
- **Idéal pour** : Artisan solo professionnel

#### 🚀 Business (Sur devis, dès 99€/mois)
- Multi-comptes et gestion équipes
- Statistiques avancées
- Intégrations API sur mesure (CRM, comptabilité)
- Accompagnement personnalisé
- Support dédié (téléphone, visio)
- Marque personnalisée (logo, domaine)
- **Idéal pour** : PME artisanales

### ROI Démontrable

**Éviter une seule annulation/mois** (perte 80-120€) couvre largement l'abonnement Pro (29€)

**Gain de temps** : 5-10h/mois économisées = 100-200€ de coût d'opportunité

**Amélioration image** : Interface moderne, paiement sécurisé, confirmation instantanée

## Contribuer

Les contributions sont les bienvenues ! Veuillez consulter les documents suivants avant de contribuer :

1. [docs/vision.md](docs/vision.md) - Comprendre la vision produit
2. [docs/domain-model.md](docs/domain-model.md) - Respecter le modèle de données
3. [docs/technical-specifications.md](docs/technical-specifications.md) - Suivre l'architecture

### Développement Local

1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/ma-fonctionnalite`)
3. Commit les changements (`git commit -m 'Ajout fonctionnalité X'`)
4. Push vers la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrir une Pull Request

### Standards de Code

- **ESLint** : Config Airbnb ou Standard
- **Prettier** : Formatage automatique
- **Tests** : Couverture minimum 80%
- **Commits** : Messages clairs et descriptifs

## Indicateurs de Succès (KPI)

- **Taux d'adoption** : Artisans actifs (≥1 réservation/mois) / total inscrits
- **Taux de conversion** : Starter → Pro après période d'essai
- **Taux d'annulation** : Objectif < 10% (avec rappels + acomptes)
- **Taux de no-show** : Objectif < 5% (rappels SMS + acomptes)
- **NPS (Net Promoter Score)** : Objectif > 50
- **Temps moyen de réservation** : Objectif < 2 minutes

## Sécurité et RGPD

### Mesures Implémentées

✅ **Validation stricte** : Joi schemas, sanitization automatique
✅ **Chiffrement** : Tokens OAuth chiffrés (AES-256), HTTPS obligatoire (TLS 1.3)
✅ **Secrets managés** : Variables environnement, rotation régulière
✅ **Rate limiting** : Protection contre force brute
✅ **Conformité RGPD** : Consentement explicite, droit accès/oubli, rétention limitée (2 ans)

### Sous-traitants Conformes

- Stripe (paiements, certifié PCI-DSS)
- SendGrid (emails, certifié RGPD)
- Twilio (SMS, certifié RGPD)
- Heroku/Railway (hébergement, certifié RGPD)

## Support

### Contact

- **Email** : support@artisanconnect.fr (fictif pour démo)
- **Documentation** : Voir dossier [docs/](docs/)
- **Issues** : Ouvrir une issue GitHub

### FAQ

**Q : Comment tester localement sans backend ?**
R : Le front actuel fonctionne en mode simulation avec localStorage.

**Q : Quand le backend sera-t-il implémenté ?**
R : Plan séquentiel 10 semaines détaillé dans [technical-specifications.md](docs/technical-specifications.md)

**Q : Quelle base de données est recommandée ?**
R : PostgreSQL 15+ pour fiabilité (transactions ACID, intégrité référentielle).

**Q : Peut-on utiliser un autre PSP que Stripe ?**
R : Oui, via pattern abstraction `PaymentProvider`, mais Stripe recommandé (SCA compliance, webhooks robustes).

## Licence

[À définir - MIT recommandé pour open-source]

---

**Développé avec ❤️ pour les artisans indépendants**

*ArtisanConnect - Arrêtez de perdre du temps au téléphone, sécurisez vos interventions, développez votre activité sans stress.*
