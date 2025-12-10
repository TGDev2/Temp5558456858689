# Plan d'implémentation séquentiel

### Jalon 1 : Fondations backend et base de données (Semaine 1)

**Objectif :** Backend Express fonctionnel, base PostgreSQL provisionnée, modèle de données créé, tests unitaires basiques en place.

**Tâches :**

1. Initialiser projet Node.js : `npm init`, installer dépendances (Express, Knex, Joi, Winston, dotenv)
2. Configurer ESLint + Prettier + Husky pre-commit hooks
3. Créer structure de répertoires (`src/api`, `src/domain`, `src/infrastructure`)
4. Configurer connexion PostgreSQL via Knex (`knexfile.js`, pool de connexions)
5. Créer migrations pour tables `artisans`, `services`, `opening_rules`, `break_rules` (schéma SQL § 3.1)
6. Exécuter migrations sur base de développement locale
7. Implémenter repositories basiques (`ArtisanRepository.findById()`, `ServiceRepository.listActive()`)
8. Écrire tests unitaires repositories (Jest + mocks Knex)
9. Seed base de données avec artisan démo + 4 services (diagnostic, urgence, maintenance, installation)
10. Endpoint santé : `GET /api/v1/health` retournant `{ status: 'ok', database: 'connected' }`

**Livrable :** Backend déployable localement, base de données structurée, tests unitaires verts, endpoint santé OK.

### Jalon 2 : API Services et Disponibilités (Semaine 2)

**Objectif :** Endpoints `GET /services` et `GET /availability` fonctionnels, logique métier de génération de créneaux implémentée, tests d'intégration couvrant scénarios MVP.

**Tâches :**

1. Implémenter `GET /api/v1/services` : récupération services actifs depuis base, DTO mapping (§ 4.1)
2. Implémenter `SlotAvailabilityService` (domaine) : génération créneaux en fonction horaires d'ouverture, pauses, réservations existantes
3. Implémenter `GET /api/v1/availability?serviceId=...&date=...` : appel `SlotAvailabilityService.generateSlots()`, retour JSON conforme `domain-model.md`
4. Tests unitaires `SlotAvailabilityService` : scénarios horaires normaux, pauses, débordements, edge cases (jours fériés futurs)
5. Tests d'intégration API : Supertest sur `/services` et `/availability` avec base de test (rollback transactions après chaque test)
6. Middleware validation Joi pour paramètres query `/availability` (serviceId UUID, date ISO)
7. Documentation OpenAPI/Swagger (optionnelle mais recommandée) : génération automatique depuis annotations JSDoc controllers

**Livrable :** Endpoints services et disponibilités testés et documentés, prêts pour consommation par le front.

### Jalon 3 : Création de réservations et intégration Stripe (Semaine 3-4)

**Objectif :** Endpoint `POST /bookings` fonctionnel, intégration Stripe Payment Intents complète, webhooks Stripe traités, tests de bout en bout avec paiements simulés.

**Tâches :**

1. Créer migration table `bookings` (§ 3.1)
2. Implémenter `BookingRepository` : `create()`, `findByCode()`, `findByCodeAndEmail()`, `updatePaymentStatus()`
3. Implémenter `BookingService` (domaine) : `createBooking()` avec validation créneau disponible, calcul acompte, génération code unique `AC-XXXXXX`
4. Intégrer Stripe SDK : création Payment Intent avec montant acompte, metadata (booking code, artisan ID)
5. Implémenter `POST /api/v1/bookings` : validation payload Joi, appel `BookingService.createBooking()`, retour `clientSecret` Stripe
6. Implémenter webhook Stripe `POST /api/v1/webhooks/stripe` : vérification signature, traitement `payment_intent.succeeded`, mise à jour statut réservation (§ 5.1)
7. Tests unitaires `BookingService` : création réservation valide, créneau indisponible (erreur `SLOT_UNAVAILABLE`), calcul acompte correct
8. Tests d'intégration end-to-end : création réservation → Payment Intent créé → webhook simulé → statut réservation updated → créneau bloqué pour futures requêtes `/availability`
9. Configuration Stripe webhooks en environnement de test (Stripe CLI pour forwarding local)

**Livrable :** Réservations créables avec acompte Stripe, webhooks traités, créneau correctement bloqué après confirmation paiement.

### Jalon 4 : Consultation, annulation, replanification (Semaine 5)

**Objectif :** Endpoints `GET /bookings/public`, `POST /bookings/{code}/cancel`, `POST /bookings/{code}/reschedule` fonctionnels, logique métier complète, tests couvrant scénarios nominaux et edge cases.

**Tâches :**

1. Implémenter `GET /api/v1/bookings/public?code=...&email=...` : `BookingRepository.findByCodeAndEmail()`, vérification email insensible à la casse (§ 2 `domain-model.md`)
2. Implémenter `BookingService.cancelBooking()` : mise à jour statut `cancelled`, libération créneau, politique acompte (conservé par défaut MVP)
3. Implémenter `POST /api/v1/bookings/{code}/cancel` : validation couple (code, email), appel `BookingService.cancelBooking()`
4. Implémenter `BookingService.rescheduleBooking()` : validation nouveau créneau disponible (en ignorant réservation courante), mise à jour date/heure/statut `rescheduled`
5. Implémenter `POST /api/v1/bookings/{code}/reschedule` : validation payload (newDate, newTime), appel `BookingService.rescheduleBooking()`
6. Tests unitaires `BookingService` : annulation réservation existante, annulation réservation déjà annulée (idempotence), replanification vers créneau libre, replanification vers créneau occupé (erreur `SLOT_UNAVAILABLE`)
7. Tests d'intégration : consultation réservation valide, consultation avec mauvais email (404), annulation, replanification avec validation disponibilités temps réel

**Livrable :** Cycle de vie complet des réservations implémenté (création, consultation, annulation, replanification), tests verts, API production-ready.

### Jalon 5 : Synchronisation calendriers externes (Semaine 6-7)

**Objectif :** Import automatique d'indisponibilités depuis Google Calendar (MVP prioritaire), export automatique de réservations confirmées, scheduled jobs fonctionnels.

**Tâches :**

1. Créer migrations tables `calendar_connections`, `external_busy_blocks` (§ 3.1)
2. Implémenter OAuth 2.0 flow Google Calendar : endpoints `GET /api/v1/auth/google/callback`, stockage tokens chiffrés (§ 5.2)
3. Implémenter `GoogleCalendarService.importBusyBlocks()` : liste événements Google 30 jours à l'avance, insertion table `external_busy_blocks` (source = 'external')
4. Implémenter `GoogleCalendarService.exportBooking()` : création événement Google Calendar lors de confirmation réservation, insertion `external_busy_blocks` (source = 'booking')
5. Modifier `SlotAvailabilityService.generateSlots()` : prise en compte `external_busy_blocks` dans calcul conflits créneaux
6. Scheduled job (node-cron ou Heroku Scheduler) : import calendriers externes toutes les 15 minutes, export réservations nouvelles/modifiées
7. Tests unitaires `GoogleCalendarService` : mocking API Google, vérification insertion correcte `external_busy_blocks`
8. Tests d'intégration : création réservation → export Google Calendar → vérification événement créé (via mock API ou compte Google test)
9. Extension optionnelle : Support Microsoft Graph API (Outlook) avec flow OAuth similaire

**Livrable :** Synchronisation bidirectionnelle Google Calendar fonctionnelle, indisponibilités importées bloquent créneaux, réservations exportées visibles dans Google Calendar artisan.

### Jalon 6 : Notifications email/SMS (Semaine 8)

**Objectif :** Envoi automatique de confirmations, rappels, annulations par email (SendGrid) et SMS (Twilio si plan Pro), templates personnalisables, scheduled job rappels 24h avant.

**Tâches :**

1. Implémenter `EmailService.sendBookingConfirmation()` : utilisation SendGrid SDK, template dynamique (§ 5.5)
2. Créer templates SendGrid : confirmation réservation, rappel 24h, confirmation annulation, confirmation replanification
3. Appeler `EmailService.sendBookingConfirmation()` après création réservation (dans `BookingService.createBooking()`, après capture paiement)
4. Implémenter `SMSService.sendBookingReminder()` : utilisation Twilio SDK, vérification plan artisan (Pro/Business uniquement)
5. Scheduled job (cron quotidien 18h00 timezone artisan) : sélection réservations J+1, envoi rappels email + SMS
6. Tests unitaires `EmailService` et `SMSService` : mocking SendGrid/Twilio, vérification appels API corrects
7. Tests d'intégration : création réservation → email confirmation envoyé (vérification via logs ou SendGrid Event Webhook)
8. Gestion erreurs notifications : retry automatique, logging échecs, pas de blocage réservation si notification échoue

**Livrable :** Notifications automatiques fonctionnelles, rappels programmés, expérience client complète (confirmation immédiate + rappel veille).

### Jalon 7 : Polish, sécurité, documentation (Semaine 9)

**Objectif :** Rate limiting, HTTPS obligatoire, logs structurés, documentation API complète, tests de charge basiques, préparation déploiement production.

**Tâches :**

1. Activer rate limiting (express-rate-limit) : 100 req/15min par IP endpoints publics, 10 req/min webhook Stripe
2. Configurer Helmet (sécurité headers HTTP)
3. Configurer CORS restrictif (whitelist domaine front production)
4. Audit sécurité npm (`npm audit fix`), mise à jour dépendances vulnérables
5. Compléter documentation OpenAPI/Swagger : exemples de requêtes, codes d'erreur, descriptions détaillées
6. README backend : instructions setup local, variables d'environnement, commandes npm, architecture projet
7. Tests de charge basiques (Apache Bench ou Artillery) : validation 50 req/s soutenus sur `/availability` sans dégradation
8. Revue de code : refactoring si nécessaire, amélioration lisibilité, suppression code mort
9. Configuration monitoring Sentry : capture erreurs 500, alertes email

**Livrable :** Backend production-ready, sécurisé, documenté, testé, prêt pour déploiement Heroku/Railway avec confiance.

### Jalon 8 : Déploiement production et monitoring (Semaine 10)

**Objectif :** Déploiement backend en production, configuration DNS, SSL automatique, monitoring actif, validation end-to-end avec front.

**Tâches :**

1. Créer app Heroku production : `heroku create artisanconnect-api-prod`
2. Provisionner PostgreSQL Heroku Standard (backups automatiques 30 jours)
3. Configurer toutes variables d'environnement production (secrets Stripe live, SendGrid, Twilio, clés OAuth Google)
4. Déploiement initial : `git push heroku main`
5. Exécution migrations production : `heroku run npm run migrate:latest`
6. Seed artisan démo production (optionnel, pour tests internes)
7. Configuration domaine personnalisé : `api.artisanconnect.fr` pointant vers Heroku app (CNAME DNS)
8. SSL automatique Let's Encrypt activé via Heroku (inclus gratuitement)
9. Configuration webhooks Stripe production : URL `https://api.artisanconnect.fr/api/v1/webhooks/stripe`
10. Tests end-to-end production : front pointant vers API production, création réservation réelle avec paiement test Stripe, vérification email/SMS reçus, consultation/annulation/replanification fonctionnelles
11. Activation monitoring Sentry, Heroku Metrics, vérification alertes configurées
12. Documentation post-déploiement : URLs API, credentials accès logs, procédure rollback, contacts support

**Livrable :** Backend production opérationnel, accessible depuis front, monitoring actif, prêt pour premiers utilisateurs réels.