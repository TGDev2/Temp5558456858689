# Modèle de données et contrat fonctionnel – MVP ArtisanConnect

Ce document décrit de manière formelle et exhaustive le modèle de données métier et le contrat d'API de réservation du MVP ArtisanConnect. Il constitue la référence unique pour toute implémentation backend, évolution de l'interface utilisateur et mise en place de tests automatisés.

**Hypothèse MVP :** Une instance ArtisanConnect est utilisable par un artisan unique (gestion multi-artisans et multi-équipes réservée à l'offre Business).

---

## Principes généraux

1. Un **créneau** est défini par la combinaison d'un service, d'une date au format ISO 8601 (`YYYY-MM-DD`), d'une heure de début au format 24h (`HH:MM`) et d'une durée en minutes (multiple de 30 minutes par défaut, configurable par service).
2. Une **réservation confirmée** bloque le créneau de manière exclusive et crée automatiquement une indisponibilité dans les calendriers connectés de l'artisan (si la synchronisation bidirectionnelle est activée).
3. Une **indisponibilité externe** importée depuis un calendrier connecté (Google Calendar, Outlook, Apple Calendar) bloque également les créneaux correspondants, empêchant toute tentative de réservation client sur ces plages horaires.
4. Un **acompte** est calculé comme un pourcentage du prix total du service (taux configurable par service, par défaut 30 %) et doit être réglé ou au minimum autorisé (pre-authorization Stripe) pour que la réservation soit confirmée. L'acompte est encaissé immédiatement et reste acquis en cas d'annulation tardive (selon la politique d'annulation configurée par l'artisan).
5. Les **clients finaux** gèrent leur rendez-vous de manière autonome via un code unique de réservation (format `AC-XXXXXX`, 6 caractères alphanumériques en majuscules) et leur adresse email, sans nécessiter de création de compte ni d'authentification lourde.
6. Les **horaires d'ouverture** de l'artisan sont définis par des règles hebdomadaires (jour de la semaine, heure de début, heure de fin) et peuvent inclure des pauses (ex : pause déjeuner de 12h à 13h) qui bloquent automatiquement les créneaux sur ces plages.
7. La **génération des créneaux disponibles** respecte strictement les horaires d'ouverture, les pauses, les réservations confirmées existantes et les indisponibilités externes importées, en appliquant un pas de temps configurable (par défaut 30 minutes).

---

## Types métier (pseudo-TypeScript)

Ces types décrivent la forme des objets manipulés par l'API backend et consommés par le front. Ils ne préjugent pas du langage de programmation backend réel (Node.js, Python, Go, Ruby, PHP, etc.) ni du système de stockage (PostgreSQL, MySQL, MongoDB, DynamoDB, etc.).
```ts
// Identifiants techniques internes (UUID v4 ou CUID recommandés)
type Id = string;

type CurrencyCode = 'EUR';

type BookingStatus = 'confirmed' | 'cancelled' | 'rescheduled';

type SubscriptionPlanCode = 'starter' | 'pro' | 'business';

type CalendarProviderId = 'google' | 'outlook' | 'apple' | string;

// Artisan unique pour le MVP (multi-artisans en Business)
interface Artisan {
  id: Id;
  displayName: string;        // Ex: "Marc Dupont - Plomberie"
  email: string;               // Contact email de l'artisan (utilisé pour les notifications internes)
  phone?: string;              // Téléphone de l'artisan (optionnel, affiché sur la confirmation client)
  timezone: string;            // Fuseau horaire IANA, ex: "Europe/Paris"
  plan: SubscriptionPlanCode;  // Plan d'abonnement actif
  openingRules: OpeningRule[]; // Plages d'ouverture hebdomadaires
  breakRules: TimeRangeRule[]; // Pauses récurrentes (ex: déjeuner, pauses café)
}

// Règle d'ouverture générique (jour de la semaine, horaires)
interface OpeningRule {
  id: Id;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = dimanche, 1 = lundi, ..., 6 = samedi (norme ISO 8601)
  startMinutes: number;                 // minutes depuis 00:00, ex: 510 pour 08:30
  endMinutes: number;                   // minutes depuis 00:00, ex: 1080 pour 18:00
}

// Règle de pause récurrente (même format que OpeningRule)
interface TimeRangeRule {
  id: Id;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startMinutes: number;
  endMinutes: number;
}

// Service proposé par l'artisan (diagnostic, urgence, maintenance, installation, etc.)
interface Service {
  id: Id;
  artisanId: Id;
  name: string;               // Ex: "Diagnostic et audit complet"
  description?: string;       // Description longue affichée au client (optionnelle)
  durationMinutes: number;    // Durée de l'intervention en minutes, ex: 30, 45, 60, 90
  basePriceCents: number;     // Prix total du service en centimes d'euro, ex: 4000 pour 40,00 €
  depositRate: number;        // Taux d'acompte (de 0 à 1), ex: 0.3 pour 30 %
  isActive: boolean;          // Service proposé ou archivé (permet de masquer un service sans le supprimer)
}

// Client final (pas d'authentification, identification par code + email)
interface Customer {
  name: string;         // Nom complet du client, ex: "Jean Martin"
  email: string;        // Email du client (utilisé pour l'envoi des confirmations et le lien de gestion)
  phone?: string;       // Téléphone du client (optionnel, utilisé pour les rappels SMS si activés)
}

// Préférences de notifications du client
interface NotificationPreferences {
  email: boolean;  // Activer l'envoi d'email de confirmation et rappels
  sms: boolean;    // Activer l'envoi de SMS de rappel (si plan Pro ou Business)
}

// Statut du paiement d'acompte
type PaymentStatus =
  | 'pending'      // Demande de paiement créée mais non validée par le PSP
  | 'authorized'   // Acompte autorisé (pre-authorization) mais pas encore encaissé
  | 'captured'     // Acompte encaissé définitivement
  | 'refunded'     // Acompte remboursé partiellement ou totalement (annulation avec remboursement)
  | 'failed';      // Échec de paiement (carte refusée, fonds insuffisants, etc.)

// Informations d'acompte et de paiement
interface DepositInfo {
  amountCents: number;        // Montant de l'acompte en centimes d'euro, ex: 1200 pour 12,00 €
  currency: CurrencyCode;     // Devise, toujours 'EUR' pour le MVP
  rate: number;               // Taux d'acompte appliqué (0.3 => 30 %), copié depuis le service au moment de la création
  paymentStatus: PaymentStatus;
  paymentProvider?: 'stripe' | 'other' | null; // Prestataire de paiement utilisé
  paymentIntentId?: string | null; // Identifiant de la transaction chez le PSP (Stripe Payment Intent ID, etc.)
}

// Réservation (entité centrale du domaine métier)
interface Booking {
  id: Id;                     // Identifiant technique interne (UUID v4 recommandé)
  publicCode: string;         // Code court communiqué au client, format "AC-AB12CD" (6 caractères alphanumériques majuscules)
  artisanId: Id;              // Référence vers l'artisan (toujours le même dans le cadre du MVP mono-artisan)
  serviceId: Id;              // Référence vers le service réservé
  status: BookingStatus;      // Statut de la réservation (confirmed, cancelled, rescheduled)
  customer: Customer;         // Coordonnées du client (nom, email, téléphone)
  // Date et heure de début au format ISO 8601 avec fuseau horaire, ex: "2025-01-15T09:00:00+01:00"
  startDateTime: string;
  durationMinutes: number;    // Durée de l'intervention (copié depuis le service au moment de la création)
  priceCents: number;         // Prix total du service en centimes (copié depuis le service au moment de la création)
  deposit: DepositInfo;       // Informations complètes sur l'acompte (montant, statut de paiement, PSP)
  notifications: NotificationPreferences; // Préférences de notifications du client
  createdAt: string;          // Date/heure de création de la réservation (ISO 8601)
  updatedAt: string;          // Date/heure de dernière modification (ISO 8601)
}

// Indisponibilité externe importée depuis un calendrier connecté
interface ExternalBusyBlock {
  id: Id;
  artisanId: Id;
  providerId: CalendarProviderId;  // 'google', 'outlook', 'apple', etc.
  source: 'external' | 'booking';  // 'external' = importé du calendrier, 'booking' = exporté depuis une réservation confirmée
  summary: string;                 // Titre de l'événement, ex: "Chantier Google", "Rendez-vous médecin"
  startDateTime: string;           // Date/heure de début (ISO 8601 avec fuseau horaire)
  endDateTime: string;             // Date/heure de fin (ISO 8601 avec fuseau horaire)
  bookingId?: Id | null;           // Présent si l'indisponibilité est liée à une Booking (source = 'booking')
}

// Créneau de disponibilité calculé par le backend pour un jour donné et un service donné
interface AvailabilitySlot {
  time: string;               // Heure de début du créneau au format "HH:MM" (heure locale de l'artisan)
  available: boolean;         // true si le créneau est libre, false sinon
  blockedBy: SlotBlocker[];   // Liste des raisons pour lesquelles le créneau est bloqué (vide si available = true)
}

// Type de blocage d'un créneau
type SlotBlockerType = 'booking' | 'calendar';

// Raison de blocage d'un créneau (réservation existante ou indisponibilité externe)
interface SlotBlocker {
  type: SlotBlockerType;
  providerId?: CalendarProviderId;  // Présent si type = 'calendar', identifie le calendrier source
  bookingPublicCode?: string;       // Présent si type = 'booking', code de la réservation bloquante
  summary?: string;                 // Résumé affiché au client, ex: "Chantier Google", "Plomberie - M. Martin"
}
```

**Remarques importantes :**

* Le front actuel travaille déjà avec des champs `date` (`YYYY-MM-DD`), `time` (`HH:MM`), `depositRate`, `code`, `serviceName`, `duration`, `price`, `deposit`, `notifications`, etc. Le backend devra assurer la compatibilité en dérivant et en exposant ces structures vers les types ci-dessus, ou en maintenant un mapping clair entre les DTO (Data Transfer Objects) exposés par l'API et les entités métier internes.
* Les montants financiers sont toujours stockés et manipulés en centimes d'euro (entiers) pour éviter les problèmes de précision liés aux nombres flottants (ex : 40,00 € = 4000 centimes).
* Les dates et heures sont toujours représentées au format ISO 8601 avec fuseau horaire explicite pour éviter les ambiguïtés (ex : `2025-01-15T09:00:00+01:00`).

---

## Cas d'usage métier

Les cas d'usage clés du MVP, tels qu'implémentés dans le prototype front actuel et devant être supportés par le backend, sont les suivants :

1. **Consultation de la liste des services disponibles** pour l'artisan (services actifs uniquement).
2. **Consultation des créneaux disponibles** pour un service donné et une date donnée (en tenant compte des horaires d'ouverture, pauses, réservations confirmées et indisponibilités externes).
3. **Création d'une réservation** avec acompte obligatoire (validation côté backend, capture de paiement, génération d'un code unique, envoi des notifications).
4. **Annulation d'une réservation** par le client ou l'artisan (mise à jour du statut, libération du créneau, suppression ou marquage de l'indisponibilité dans les calendriers connectés, application de la politique de remboursement d'acompte).
5. **Replanification d'une réservation** (changement de date et/ou heure, validation de la disponibilité du nouveau créneau, mise à jour de l'indisponibilité dans les calendriers connectés, préservation du code unique de réservation pour continuité de l'expérience client).
6. **Synchronisation bidirectionnelle avec les calendriers connectés** (import automatique des indisponibilités externes pour bloquer les créneaux, export automatique des réservations confirmées pour afficher les interventions dans Google Calendar, Outlook, Apple Calendar).
7. **Consultation d'une réservation par le client** à partir de son code unique et de son email, sans authentification (lecture seule des détails, lien vers modification/annulation).

---

## Contrat d'API HTTP (première version MVP)

Les endpoints ci-dessous décrivent le contrat minimal attendu entre le front actuel et le backend. Les chemins sont donnés à titre indicatif (`/api/...`) et pourront être préfixés par un namespace de versioning (`/api/v1/...`) pour faciliter les évolutions futures.

### Liste des services actifs

**Requête :**

```http
GET /api/services
Accept: application/json
```

**Réponse 200 OK :**

```json
{
  "services": [
    {
      "id": "diag",
      "name": "Diagnostic et audit complet",
      "description": "Diagnostic plomberie avec rapport détaillé",
      "durationMinutes": 30,
      "basePriceCents": 4000,
      "depositRate": 0.3,
      "isActive": true
    },
    {
      "id": "urgence",
      "name": "Intervention urgente",
      "description": "Dépannage sous 2 heures",
      "durationMinutes": 45,
      "basePriceCents": 12000,
      "depositRate": 0.4,
      "isActive": true
    }
  ]
}
```

**Codes d'erreur :**

* 500 Internal Server Error : Erreur technique côté backend (base de données inaccessible, etc.).

---

### Disponibilités pour un service et une date

**Requête :**

```http
GET /api/availability?serviceId={serviceId}&date=YYYY-MM-DD
Accept: application/json
```

**Paramètres de requête :**

* `serviceId` (string, requis) : Identifiant du service pour lequel on veut consulter les créneaux disponibles.
* `date` (string, requis, format `YYYY-MM-DD`) : Date pour laquelle on veut consulter les créneaux.

**Réponse 200 OK :**

```json
{
  "serviceId": "diag",
  "date": "2025-01-15",
  "opening": {
    "startMinutes": 510,
    "endMinutes": 1080,
    "breakStartMinutes": 720,
    "breakEndMinutes": 780
  },
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "blockedBy": []
    },
    {
      "time": "09:30",
      "available": true,
      "blockedBy": []
    },
    {
      "time": "11:30",
      "available": false,
      "blockedBy": [
        {
          "type": "calendar",
          "providerId": "google",
          "summary": "Chantier Google"
        }
      ]
    },
    {
      "time": "14:00",
      "available": false,
      "blockedBy": [
        {
          "type": "booking",
          "bookingPublicCode": "AC-AB12CD",
          "summary": "Diagnostic - M. Martin"
        }
      ]
    }
  ]
}
```

**Codes d'erreur :**

* 400 Bad Request : Paramètres manquants ou invalides (ex : date au mauvais format, serviceId vide).
* 404 Not Found : Service inexistant ou inactif.
* 500 Internal Server Error : Erreur technique côté backend.

**Règles de génération des créneaux :**

* Les créneaux sont générés entre `opening.startMinutes` et `opening.endMinutes`, par pas de `SLOT_STEP` (par défaut 30 minutes, configurable par artisan).
* Les créneaux chevauchant la pause définie par `opening.breakStartMinutes` et `opening.breakEndMinutes` sont exclus.
* Un créneau est considéré comme indisponible (`available: false`) si au moins une réservation confirmée ou une indisponibilité externe chevauche la plage horaire `[time, time + durationMinutes]` du service.
* Le champ `blockedBy` contient la liste exhaustive des raisons de blocage (réservations existantes, indisponibilités externes) pour faciliter le debug et l'affichage client.

---

### Création d'une réservation

**Requête :**

```http
POST /api/bookings
Content-Type: application/json
Accept: application/json
```

**Corps de requête :**

```json
{
  "serviceId": "diag",
  "date": "2025-01-15",
  "time": "09:00",
  "customer": {
    "name": "Jean Martin",
    "email": "jean@example.com",
    "phone": "+33612345678"
  },
  "notifications": {
    "email": true,
    "sms": true
  }
}
```

**Comportement attendu côté backend :**

1. Valider l'entrée (service existant et actif, créneau valide au format `HH:MM`, champs requis présents et conformes).
2. Recalculer le montant de l'acompte à partir du service (`basePriceCents * depositRate`).
3. Vérifier que le créneau est toujours disponible (aucune réservation confirmée ni indisponibilité externe entrante ne chevauche la plage `[date + time, date + time + durationMinutes]`).
4. Créer une demande de paiement auprès du PSP (Stripe Payment Intent) pour le montant de l'acompte.
5. Si le paiement est autorisé ou capturé, créer une réservation avec statut `confirmed`, générer un code unique au format `AC-XXXXXX` (6 caractères alphanumériques majuscules, unicité garantie), et enregistrer les informations de paiement.
6. Créer une entrée `ExternalBusyBlock` de type `booking` pour synchronisation avec les calendriers connectés (si la synchronisation bidirectionnelle est activée pour l'artisan).
7. Envoyer les notifications email et SMS au client (confirmation immédiate avec lien de gestion du rendez-vous).
8. Renvoyer la réservation créée avec toutes les informations nécessaires.

**Réponse 201 Created :**

```json
{
  "booking": {
    "publicCode": "AC-AB12CD",
    "status": "confirmed",
    "startDateTime": "2025-01-15T09:00:00+01:00",
    "durationMinutes": 30,
    "serviceId": "diag",
    "customer": {
      "name": "Jean Martin",
      "email": "jean@example.com",
      "phone": "+33612345678"
    },
    "deposit": {
      "amountCents": 1200,
      "currency": "EUR",
      "rate": 0.3,
      "paymentStatus": "authorized"
    },
    "notifications": {
      "email": true,
      "sms": true
    }
  }
}
```

**Codes d'erreur :**

* 400 Bad Request : Données invalides (ex : email malformé, date dans le passé, champs requis manquants).
* 409 Conflict : Créneau indisponible (déjà réservé ou bloqué par une indisponibilité externe depuis la dernière consultation des disponibilités).
* 500 Internal Server Error : Erreur technique (base de données, PSP injoignable, etc.).

**Exemple de réponse 409 Conflict :**

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Le créneau sélectionné n'est plus disponible. Merci de choisir un autre horaire."
  }
}
```

---

### Consultation d'une réservation par le client

**Requête :**

```http
GET /api/bookings/public?code=AC-AB12CD&email=jean%40example.com
Accept: application/json
```

**Paramètres de requête :**

* `code` (string, requis) : Code unique de la réservation au format `AC-XXXXXX`.
* `email` (string, requis) : Adresse email du client utilisée lors de la réservation (utilisée pour authentification légère, comparaison insensible à la casse et aux espaces).

**Réponse 200 OK :**

```json
{
  "booking": {
    "publicCode": "AC-AB12CD",
    "status": "confirmed",
    "serviceId": "diag",
    "startDateTime": "2025-01-15T09:00:00+01:00",
    "durationMinutes": 30,
    "customer": {
      "name": "Jean Martin",
      "email": "jean@example.com",
      "phone": "+33612345678"
    },
    "deposit": {
      "amountCents": 1200,
      "currency": "EUR",
      "rate": 0.3,
      "paymentStatus": "authorized"
    },
    "notifications": {
      "email": true,
      "sms": true
    }
  }
}
```

**Codes d'erreur :**

* 400 Bad Request : Paramètres manquants ou invalides.
* 404 Not Found : Aucune réservation trouvée avec ce couple code/email (message générique sans divulguer d'informations sensibles).
* 500 Internal Server Error : Erreur technique.

---

### Annulation d'une réservation

**Requête :**

```http
POST /api/bookings/{publicCode}/cancel
Content-Type: application/json
Accept: application/json
```

**Corps de requête :**

```json
{
  "email": "jean@example.com"
}
```

**Comportement attendu côté backend :**

1. Vérifier que le couple `publicCode` + `email` identifie une réservation existante (même logique de comparaison insensible à la casse et aux espaces que pour la consultation).
2. Mettre à jour le statut de la réservation en `cancelled`.
3. Mettre à jour ou supprimer les indisponibilités exportées vers les calendriers connectés (marquage comme événement annulé ou suppression pure et simple selon la stratégie de synchronisation).
4. Gérer la politique d'acompte selon les règles définies par l'artisan (acompte conservé par défaut, remboursement partiel si annulation plus de X heures à l'avance, remboursement total si annulation par l'artisan, etc.).
5. Envoyer une notification de confirmation d'annulation au client par email et SMS (si activés).

**Réponse 200 OK :**

```json
{
  "booking": {
    "publicCode": "AC-AB12CD",
    "status": "cancelled"
  }
}
```

**Codes d'erreur :**

* 400 Bad Request : Paramètres manquants ou invalides.
* 404 Not Found : Réservation introuvable avec ce couple code/email.
* 409 Conflict : Réservation déjà annulée (idempotence).
* 500 Internal Server Error : Erreur technique.

---

### Replanification d'une réservation

**Requête :**

```http
POST /api/bookings/{publicCode}/reschedule
Content-Type: application/json
Accept: application/json
```

**Corps de requête :**

```json
{
  "email": "jean@example.com",
  "newDate": "2025-01-18",
  "newTime": "11:30"
}
```

**Comportement attendu côté backend :**

1. Vérifier l'identité (couple code + email, même logique que pour la consultation et l'annulation).
2. Vérifier la disponibilité du nouveau créneau en appliquant les mêmes règles que pour la création d'une réservation (horaires d'ouverture, pauses, réservations existantes, indisponibilités externes), **en ignorant la réservation courante** dans le calcul des conflits (un créneau peut être replanifié sur lui-même sans erreur).
3. Mettre à jour la réservation : `status = 'rescheduled'`, `startDateTime` modifié, `updatedAt` mis à jour.
4. Mettre à jour les indisponibilités associées dans les calendriers connectés (suppression de l'ancienne plage horaire, création d'une nouvelle plage horaire correspondant au nouveau créneau).
5. Envoyer une notification de confirmation de replanification au client par email et SMS (si activés).
6. Conserver le même `publicCode` pour assurer la continuité de l'expérience client (le client peut continuer à utiliser le même lien de gestion).

**Réponse 200 OK :**

```json
{
  "booking": {
    "publicCode": "AC-AB12CD",
    "status": "rescheduled",
    "startDateTime": "2025-01-18T11:30:00+01:00"
  }
}
```

**Codes d'erreur :**

* 400 Bad Request : Paramètres manquants ou invalides (date/heure au mauvais format, date dans le passé, etc.).
* 404 Not Found : Réservation introuvable avec ce couple code/email.
* 409 Conflict : Nouveau créneau indisponible (déjà réservé ou bloqué par une indisponibilité externe).
* 500 Internal Server Error : Erreur technique.

---

## Lien avec le front existant

Le front actuel (fichiers `booking-core.js`, `booking-ui.js`, `calendar-sync.js`, `api-client.js`) simule déjà de manière cohérente et fonctionnelle :

* Un catalogue de services avec durées, prix et taux d'acompte configurables.
* La génération de créneaux disponibles en fonction des horaires d'ouverture, pauses, réservations confirmées et indisponibilités externes.
* La création, annulation et replanification de réservations avec validation métier (unicité du code, vérification de l'email, gestion du statut).
* La synchronisation avec des calendriers fictifs (Google, Outlook, Apple) pour illustrer l'import/export d'indisponibilités.
* La simulation d'acomptes obligatoires avec formulaire de carte bancaire (validation côté client uniquement pour le moment).
* L'envoi fictif de notifications email et SMS (cases à cocher, confirmation affichée à l'écran).

**La mise en place d'un backend conforme à ce document consistera principalement à :**

1. Remplacer le stockage `localStorage` par des appels aux endpoints HTTP décrits ci-dessus, en utilisant `fetch` ou `axios` côté front.
2. Aligner le modèle de réservation front (objets JavaScript manipulés dans `booking-core.js`) sur le type `Booking` ou sur des DTO compatibles exposés par l'API (via le module `api-client.js` déjà structuré à cet effet).
3. Déléguer la logique de conflit de créneaux, de calcul d'acompte et d'import d'indisponibilités au backend, qui deviendra la source de vérité unique (le front ne fera plus de calculs métier, seulement de l'affichage et de la validation de surface).
4. Intégrer un prestataire de paiement réel (Stripe Payment Intent) pour capturer les acomptes de manière sécurisée (remplacement de la simulation de carte bancaire actuelle par Stripe Elements ou Stripe Checkout).
5. Intégrer des connecteurs réels avec les calendriers externes (Google Calendar API, Microsoft Graph API, CalDAV) pour l'import/export bidirectionnel (remplacement des données fictives actuelles dans `calendar-sync.js`).
6. Implémenter l'envoi réel de notifications email et SMS via des services tiers (SendGrid, Mailgun, Twilio, etc.).

**Ce document doit rester la référence unique lors de toute évolution de l'UI, de l'architecture backend ou de la stratégie de monétisation liée aux limites de créneaux par plan.**

---

## Règles de sécurité et de validation

* Toutes les entrées utilisateur doivent être validées côté backend (ne jamais faire confiance aux données envoyées par le front).
* Les adresses email doivent être normalisées (lowercase, trim) et validées avec une regex stricte.
* Les dates et heures doivent être validées (format ISO 8601, date non antérieure à aujourd'hui, créneau dans les horaires d'ouverture).
* Les montants financiers doivent être recalculés côté backend (ne jamais faire confiance au montant envoyé par le front).
* Les codes de réservation doivent être générés de manière aléatoire et unique (vérification d'unicité en base avant insertion).
* Les informations sensibles (numéros de carte bancaire, CVC) ne doivent jamais transiter par le backend (utilisation de Stripe Elements côté front pour tokenization sécurisée).
* Les messages d'erreur exposés au client ne doivent pas divulguer d'informations techniques (ex : « Réservation introuvable » au lieu de « Aucune ligne avec ce code dans la table bookings »).
* Rate limiting sur tous les endpoints publics (ex : maximum 10 tentatives de consultation de réservation par IP par minute) pour éviter les attaques par force brute.

---

## Extensions futures (hors MVP mais anticipées dans le modèle)

* Gestion multi-artisans et multi-équipes (ajout d'un champ `teamId` dans `Booking`, routing automatique des créneaux par zone géographique ou spécialité).
* Statistiques avancées (tableaux de bord, taux de conversion, analyse des créneaux les plus demandés, prédiction de la demande).
* Webhooks pour notifier l'artisan en temps réel des nouvelles réservations, annulations ou modifications (intégration avec des outils tiers comme Slack, Zapier, Make).
* Export ICS pour permettre au client d'ajouter le rendez-vous à son propre calendrier en un clic.
* Politique d'annulation configurable par service (remboursement total si annulation plus de 48h à l'avance, remboursement partiel entre 24h et 48h, acompte conservé en dessous de 24h).
* Gestion des récurrences (rendez-vous hebdomadaires, mensuels) pour les contrats de maintenance.
* API publique pour intégration avec des marketplaces, sites web d'artisans, CRM métier, etc.