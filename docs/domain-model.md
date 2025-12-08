# Modèle de données et contrat fonctionnel – MVP ArtisanConnect

Ce document décrit le modèle de données et le contrat de réservation du MVP tel qu’il doit être implémenté côté backend et consommé par le front actuel.  
Hypothèse MVP : une instance ArtisanConnect est utilisable par un artisan unique (multi-artisans réservé à l’offre Business).

---

## Principes généraux

1. Un **créneau** est défini par la combinaison d’un service, d’une date (`YYYY-MM-DD`), d’une heure de début (`HH:MM`) et d’une durée en minutes.
2. Une **réservation confirmée** bloque le créneau et crée une indisponibilité dans les calendriers connectés.
3. Une **indisponibilité externe** (Google/Outlook/Apple) bloque également les créneaux correspondants.
4. Un **acompte** est calculé comme un pourcentage du prix du service et doit être réglé ou au minimum autorisé pour que la réservation soit confirmée.
5. Les **clients** gèrent leur rendez-vous via un code public de réservation et leur email, sans authentification.

---

## Types métier (pseudo-TypeScript)

Ces types décrivent la forme des objets manipulés par l’API. Ils ne préjugent pas du langage backend réel.

```ts
// Identifiants techniques internes
type Id = string;

type CurrencyCode = 'EUR';

type BookingStatus = 'confirmed' | 'cancelled' | 'rescheduled';

type SubscriptionPlanCode = 'starter' | 'pro' | 'business';

type CalendarProviderId = 'google' | 'outlook' | 'apple' | string;

// Artisan unique pour le MVP (multi-artisans en Business)
interface Artisan {
  id: Id;
  displayName: string;        // Ex: "Marc Dupont - Plomberie"
  email: string;
  phone?: string;
  timezone: string;           // Ex: "Europe/Paris"
  plan: SubscriptionPlanCode;
  openingRules: OpeningRule[];    // Plages d’ouverture
  breakRules: TimeRangeRule[];    // Pauses de déjeuner, etc.
}

// Règle d’ouverture générique (jour, horaire)
interface OpeningRule {
  id: Id;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = dimanche
  startMinutes: number;                 // minutes depuis 00:00
  endMinutes: number;                   // minutes depuis 00:00
}

interface TimeRangeRule {
  id: Id;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startMinutes: number;
  endMinutes: number;
}

// Service proposé par l’artisan (plomberie, diagnostic, etc.)
interface Service {
  id: Id;
  artisanId: Id;
  name: string;               // Ex: "Diagnostic et audit"
  description?: string;
  durationMinutes: number;    // Ex: 30
  basePriceCents: number;     // Ex: 4000 pour 40 €
  depositRate: number;        // 0.3 pour 30 %
  isActive: boolean;
}

// Client final
interface Customer {
  name: string;
  email: string;
  phone?: string;
}

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
}

// Informations d’acompte et de paiement
type PaymentStatus =
  | 'pending'      // demande de paiement créée mais non validée
  | 'authorized'   // acompte autorisé
  | 'captured'     // acompte encaissé
  | 'refunded'     // acompte remboursé partiellement ou totalement
  | 'failed';      // échec de paiement

interface DepositInfo {
  amountCents: number;        // montant d’acompte à payer
  currency: CurrencyCode;     // 'EUR'
  rate: number;               // 0.3 => 30 %
  paymentStatus: PaymentStatus;
  paymentProvider?: 'stripe' | 'other' | null;
  paymentIntentId?: string | null; // identifiant chez le PSP
}

// Réservation (entité centrale)
interface Booking {
  id: Id;                     // identifiant interne (UUID)
  publicCode: string;         // code court communiqué au client (ex: "AC-AB12CD")
  artisanId: Id;
  serviceId: Id;
  status: BookingStatus;
  customer: Customer;
  // Date de début au format ISO 8601, dans le fuseau de l’artisan
  startDateTime: string;      // ex: "2025-01-15T09:00:00+01:00"
  durationMinutes: number;
  priceCents: number;         // prix total du service
  deposit: DepositInfo;
  notifications: NotificationPreferences;
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}

// Indisponibilité externe importée depuis un calendrier connecté
interface ExternalBusyBlock {
  id: Id;
  artisanId: Id;
  providerId: CalendarProviderId;
  source: 'external' | 'booking';
  summary: string;            // Ex: "Chantier Google"
  startDateTime: string;      // ISO 8601
  endDateTime: string;        // ISO 8601
  bookingId?: Id | null;      // présent si lié à une Booking
}

// Slot de disponibilité calculé par le backend pour un jour & un service
interface AvailabilitySlot {
  time: string;               // "HH:MM" heure de début locale
  available: boolean;
  blockedBy: SlotBlocker[];
}

type SlotBlockerType = 'booking' | 'calendar';

interface SlotBlocker {
  type: SlotBlockerType;
  providerId?: CalendarProviderId;
  bookingPublicCode?: string;
  summary?: string;
}
````

Remarque : le front actuel travaille déjà avec des `date` (`YYYY-MM-DD`), `time` (`HH:MM`), un `depositRate` et un `code` de réservation. Le backend devra assurer la compatibilité en dérivant ces structures vers les types ci-dessus.

---

## Cas d’usage métier

Les cas d’usage clés du MVP sont les suivants :

1. Consultation de la liste des services disponibles pour l’artisan.
2. Consultation des créneaux disponibles pour un service et une date donnée.
3. Création d’une réservation avec acompte obligatoire.
4. Annulation d’une réservation par le client ou l’artisan.
5. Replanification d’une réservation (changement de date/heure).
6. Synchronisation des réservations confirmées/annulées avec les calendriers connectés.
7. Consultation d’une réservation par le client à partir de son code et de son email.

---

## Contrat d’API HTTP (première version MVP)

Les endpoints ci-dessous décrivent le contrat minimal attendu entre le front actuel et le backend.
Les chemins sont donnés à titre indicatif (`/api/...`) et pourront être préfixés.

### Liste des services

```http
GET /api/services
```

Réponse 200 :

```json
{
  "services": [
    {
      "id": "diag",
      "name": "Diagnostic et audit",
      "description": "Diagnostic plomberie",
      "durationMinutes": 30,
      "basePriceCents": 4000,
      "depositRate": 0.3,
      "isActive": true
    }
  ]
}
```

### Disponibilités pour un service et une date

```http
GET /api/availability?serviceId={serviceId}&date=YYYY-MM-DD
```

Réponse 200 :

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
      "time": "11:30",
      "available": false,
      "blockedBy": [
        {
          "type": "calendar",
          "providerId": "google",
          "summary": "Chantier Google"
        }
      ]
    }
  ]
}
```

Les règles de génération des créneaux doivent être cohérentes avec celles déjà codées dans `ACBooking.generateSlots` (plage d’ouverture, pause déjeuner, pas de chevauchement avec les réservations et les indisponibilités externes).

### Création d’une réservation

```http
POST /api/bookings
Content-Type: application/json
```

Corps de requête :

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

Comportement attendu :

* Valider l’entrée (service existant, créneau valide, champ requis).
* Recalculer le montant de l’acompte à partir du service (`basePriceCents * depositRate`).
* Vérifier que le créneau est toujours disponible (aucune réservation confirmée ni indisponibilité externe entrante).
* Créer une réservation avec statut `confirmed` ou `pending` selon l’intégration paiement choisie.
* Créer une entrée de type `ExternalBusyBlock` d’origine `booking` pour les calendriers connectés (selon la configuration).

Réponse 201 :

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
    }
  }
}
```

En cas de créneau indisponible, renvoyer un code 409 avec un message explicite.

### Consultation d’une réservation par le client

```http
GET /api/bookings/public?code=AC-AB12CD&email=jean%40example.com
```

Réponse 200 :

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

En cas d’erreur de code ou d’email, renvoyer 404 sans divulguer d’informations sensibles.

### Annulation d’une réservation

```http
POST /api/bookings/{publicCode}/cancel
Content-Type: application/json
```

Corps de requête :

```json
{
  "email": "jean@example.com"
}
```

Comportement :

* Vérifier que le couple `publicCode` + `email` identifie une réservation existante.
* Mettre à jour le statut en `cancelled`.
* Mettre à jour les indisponibilités exportées vers les calendriers (suppression ou marquage comme annulées).
* Gérer la politique d’acompte (conservé, remboursé partiellement, etc.) selon la stratégie métier configurée (à définir par plan).

Réponse 200 :

```json
{
  "booking": {
    "publicCode": "AC-AB12CD",
    "status": "cancelled"
  }
}
```

### Replanification d’une réservation

```http
POST /api/bookings/{publicCode}/reschedule
Content-Type: application/json
```

Corps de requête :

```json
{
  "email": "jean@example.com",
  "newDate": "2025-01-18",
  "newTime": "11:30"
}
```

Comportement :

* Vérifier l’identité (code + email).
* Vérifier la disponibilité du nouveau créneau (mêmes règles que pour la création).
* Mettre à jour la réservation (`status = 'rescheduled'`, `startDateTime` modifié).
* Mettre à jour les indisponibilités associées dans les calendriers connectés.

Réponse 200 :

```json
{
  "booking": {
    "publicCode": "AC-AB12CD",
    "status": "rescheduled",
    "startDateTime": "2025-01-18T11:30:00+01:00"
  }
}
```

---

## Lien avec le front existant

Le front actuel (fichiers `booking-core.js`, `booking-ui.js`, `calendar-sync.js`) simule déjà :

* un catalogue de services (tableau `services`)
* la génération de créneaux (`generateSlots`)
* la création/annulation/replanification de réservations (`createBooking`, `cancelBooking`, `rescheduleBooking`)
* la synchronisation avec des calendriers fictifs.

La mise en place d’un backend conforme à ce document consistera principalement à :

1. Remplacer le stockage `localStorage` par des appels aux endpoints décrits ci-dessus.
2. Aligner le modèle de réservation front sur le type `Booking` (ou sur un DTO compatible).
3. Déléguer la logique de conflit de créneaux et d’import d’indisponibilités au backend, qui deviendra la source de vérité.

Ce document doit rester la référence lors de toute évolution de l’UI, de l’architecture backend ou de la stratégie de monétisation liée aux limites de créneaux par plan.