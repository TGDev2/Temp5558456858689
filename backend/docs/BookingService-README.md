# BookingService - Documentation technique

## Vue d'ensemble

Le `BookingService` est le service métier central pour la gestion du cycle de vie des réservations dans ArtisanConnect. Il orchestre toute la logique complexe de création de réservations en garantissant :

1. **Validation stricte des données** - Format, cohérence, règles métier
2. **Génération de codes uniques** - Format `AC-XXXXXX` avec vérification d'unicité
3. **Vérification de disponibilité** - Appel à SlotAvailabilityService pour éviter les conflits
4. **Calcul automatique d'acompte** - basePriceCents × depositRate arrondi
5. **Persistance transactionnelle** - Création via BookingRepository

---

## Architecture et dépendances

### Dépendances requises

Le service nécessite l'injection de 3 dépendances :

```javascript
const bookingService = new BookingService({
  serviceRepository,        // Accès aux services proposés
  bookingRepository,        // Accès aux réservations
  slotAvailabilityService   // Validation de disponibilité
});
```

### Initialisation automatique

Le service est automatiquement initialisé dans [dependencies.js](../src/infrastructure/dependencies.js) :

```javascript
const { getDependencies } = require('./infrastructure/dependencies');
const { bookingService } = getDependencies().services;
```

---

## Méthode principale : `createBooking()`

### Signature

```javascript
async createBooking(bookingData)
```

### Paramètres

```javascript
{
  serviceId: string,        // UUID du service (requis)
  date: string,             // Format YYYY-MM-DD (requis, non antérieure à aujourd'hui)
  time: string,             // Format HH:MM (requis)
  customer: {
    name: string,           // Nom complet (requis, min 2 car)
    email: string,          // Email valide (requis)
    phone: string           // Téléphone (optionnel)
  },
  notifications: {
    email: boolean,         // Notifications email (défaut: true)
    sms: boolean            // Notifications SMS (défaut: false)
  }
}
```

### Exemple d'utilisation

```javascript
const booking = await bookingService.createBooking({
  serviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  date: '2025-12-20',
  time: '10:00',
  customer: {
    name: 'Jean Martin',
    email: 'jean.martin@example.com',
    phone: '+33612345678'
  },
  notifications: {
    email: true,
    sms: true
  }
});

console.log(booking.publicCode); // "AC-A3B7K9"
console.log(booking.depositAmountCents); // 1200 (si service à 40€ avec 30% d'acompte)
```

### Valeur de retour

```javascript
{
  id: string,                    // UUID interne
  publicCode: string,            // Code unique AC-XXXXXX
  artisanId: string,             // UUID de l'artisan
  serviceId: string,             // UUID du service
  status: 'confirmed',           // Statut initial
  customerName: string,
  customerEmail: string,
  customerPhone: string | null,
  startDateTime: string,         // ISO 8601 avec timezone
  durationMinutes: number,
  priceCents: number,
  depositAmountCents: number,
  depositRate: number,
  depositPaymentStatus: 'pending',
  depositPaymentProvider: null,
  depositPaymentIntentId: null,
  notificationsEmail: boolean,
  notificationsSms: boolean,
  createdAt: string,
  updatedAt: string
}
```

---

## Erreurs métier levées

### `ServiceNotFoundError` (404)

**Levée si** :
- Le service n'existe pas en base
- Le service existe mais est inactif (`isActive = false`)

**Message** : `"Service introuvable ou inactif."`

**Gestion** :
```javascript
try {
  await bookingService.createBooking(data);
} catch (error) {
  if (error instanceof ServiceNotFoundError) {
    return res.status(404).json({
      error: { code: 'SERVICE_NOT_FOUND', message: error.message }
    });
  }
}
```

### `SlotUnavailableError` (409)

**Levée si** :
- Le créneau est déjà réservé (autre réservation confirmée)
- Le créneau chevauche une indisponibilité externe
- Aucun horaire d'ouverture configuré pour ce jour
- Le créneau est en dehors des horaires d'ouverture

**Message** : `"Le créneau 10:00 est déjà réservé ou indisponible. Raison: Réservation - M. Dupont"`

**Gestion** :
```javascript
try {
  await bookingService.createBooking(data);
} catch (error) {
  if (error instanceof SlotUnavailableError) {
    return res.status(409).json({
      error: { code: 'SLOT_UNAVAILABLE', message: error.message }
    });
  }
}
```

### `InvalidBookingDataError` (400)

**Levée si** :
- Champs requis manquants (`serviceId`, `date`, `time`, `customer.name`, `customer.email`)
- Format invalide (date pas `YYYY-MM-DD`, time pas `HH:MM`, email malformé)
- Date antérieure à aujourd'hui

**Messages possibles** :
- `"serviceId est requis"`
- `"customer.email invalide"`
- `"date doit être au format YYYY-MM-DD"`
- `"date ne peut pas être dans le passé"`

**Gestion** :
```javascript
try {
  await bookingService.createBooking(data);
} catch (error) {
  if (error instanceof InvalidBookingDataError) {
    return res.status(400).json({
      error: { code: 'INVALID_BOOKING_DATA', message: error.message }
    });
  }
}
```

---

## Processus de création étape par étape

### 1. Validation des données d'entrée

```javascript
validateBookingData(bookingData)
```

**Vérifie** :
- ✅ Présence de tous les champs requis
- ✅ Format email (regex basique)
- ✅ Format date YYYY-MM-DD
- ✅ Format time HH:MM
- ✅ Date non antérieure à aujourd'hui

### 2. Récupération et validation du service

```javascript
const service = await this.serviceRepository.findById(serviceId);
if (!service || !service.isActive) {
  throw new ServiceNotFoundError();
}
```

### 3. Validation de la disponibilité du créneau

```javascript
await this.validateSlotAvailability(service, date, time);
```

**Appelle** `SlotAvailabilityService.generateAvailableSlots()` et vérifie que :
- ✅ Le jour a des horaires d'ouverture configurés
- ✅ Le créneau demandé existe dans la liste générée
- ✅ Le créneau est marqué `available: true`

### 4. Génération du code unique

```javascript
const publicCode = await generateUniqueBookingCode(async (code) => {
  const existing = await this.bookingRepository.findByCode(code);
  return !existing;
});
```

**Format** : `AC-XXXXXX` (6 caractères alphanumériques sans I, O, 1, 0)
**Tentatives max** : 10 avant erreur (probabilité collision < 0.0001%)

### 5. Calcul de l'acompte

```javascript
const depositAmountCents = Math.round(basePriceCents * depositRate);
```

**Exemples** :
- Service 40,00 € (4000 centimes) × 30% = 1200 centimes (12,00 €)
- Service 120,00 € (12000 centimes) × 40% = 4800 centimes (48,00 €)
- Service 45,67 € (4567 centimes) × 33% = 1507 centimes (15,07 €) ← arrondi

### 6. Construction de la date/heure ISO 8601

```javascript
const startDateTime = `${date}T${time}:00+01:00`;
```

**Format retourné** : `2025-12-20T10:00:00+01:00`
**Timezone** : Europe/Paris (CET/CEST) hardcodé pour MVP

⚠️ **Note future** : Récupérer le timezone depuis `artisan.timezone` en base

### 7. Création en base de données

```javascript
const booking = await this.bookingRepository.create({
  publicCode,
  artisanId: service.artisanId,
  serviceId: service.id,
  status: 'confirmed',
  // ... autres champs
  depositPaymentStatus: 'pending',
  depositPaymentProvider: null,
  depositPaymentIntentId: null
});
```

**Statut initial** : `confirmed` (même si paiement `pending`)
**Logique future** : Stripe webhook mettra à jour `depositPaymentStatus` → `captured`

---

## Génération de codes uniques

### Format AC-XXXXXX

- **Préfixe** : `AC-` (ArtisanConnect)
- **Longueur** : 6 caractères
- **Caractères autorisés** : `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 caractères)
- **Caractères exclus** : `I`, `O`, `1`, `0` (éviter confusion)

### Espace de codes possibles

```
32^6 = 1,073,741,824 combinaisons
```

**À 10 000 réservations/jour** : Espace saturé dans **294 ans** (sans réutilisation)

### Algorithme de génération

```javascript
function generateBookingCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * 32);
    code += ALLOWED_CHARS[randomIndex];
  }
  return 'AC-' + code;
}
```

### Gestion des collisions

```javascript
async function generateUniqueBookingCode(checkUniqueness) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const code = generateBookingCode();
    if (await checkUniqueness(code)) {
      return code;
    }
    console.warn(`Collision détectée: ${code}`);
  }
  throw new Error('Impossible de générer un code unique');
}
```

**Probabilité de collision** (avec 10 000 codes existants) :
```
P(collision) = 10,000 / 1,073,741,824 ≈ 0.00093%
```

---

## Tests unitaires

Les tests unitaires sont disponibles dans [tests/unit/BookingService.test.js](../tests/unit/BookingService.test.js).

### Scénarios couverts

#### ✅ Création réservation valide

```javascript
it('devrait créer une réservation avec succès', async () => {
  const booking = await bookingService.createBooking(validData);
  expect(booking.publicCode).toMatch(/^AC-[A-Z2-9]{6}$/);
  expect(booking.depositAmountCents).toBe(1200);
});
```

#### ❌ Service inexistant ou inactif

```javascript
it('devrait lever ServiceNotFoundError', async () => {
  await expect(bookingService.createBooking(data)).rejects.toThrow(
    ServiceNotFoundError
  );
});
```

#### ❌ Créneau déjà réservé

```javascript
it('devrait lever SlotUnavailableError si créneau bloqué', async () => {
  mockSlotAvailabilityService.generateAvailableSlots.mockResolvedValue({
    slots: [{ time: '10:00', available: false, blockedBy: [...] }]
  });

  await expect(bookingService.createBooking(data)).rejects.toThrow(
    SlotUnavailableError
  );
});
```

#### ✅ Calcul acompte pour différents taux

```javascript
it('devrait calculer l\'acompte à 30%', () => {
  expect(calculateDepositAmount(4000, 0.3)).toBe(1200);
});

it('devrait calculer l\'acompte à 35%', () => {
  expect(calculateDepositAmount(16000, 0.35)).toBe(5600);
});

it('devrait calculer l\'acompte à 40%', () => {
  expect(calculateDepositAmount(12000, 0.4)).toBe(4800);
});
```

#### ✅ Génération codes uniques sans collision

```javascript
it('devrait générer 1000 codes différents', () => {
  const codes = new Set(
    Array.from({ length: 1000 }, () => generateBookingCode())
  );
  expect(codes.size).toBe(1000); // Aucune collision
});
```

### Lancer les tests

```bash
npm test BookingService
```

Résultat attendu :
```
 PASS  tests/unit/BookingService.test.js
  BookingService
    createBooking
      ✓ devrait créer une réservation avec succès (15 ms)
      ✓ devrait lever ServiceNotFoundError si service n'existe pas (3 ms)
      ✓ devrait lever SlotUnavailableError si créneau réservé (5 ms)
      ...
  bookingCodeGenerator
    generateBookingCode
      ✓ devrait générer un code au format AC-XXXXXX (2 ms)
      ✓ devrait générer 1000 codes différents (45 ms)
      ...

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

---

## Intégration avec Stripe (future étape 4)

Le BookingService pose les fondations pour l'intégration Stripe :

### Flow de paiement envisagé

1. **Front** : Appelle `POST /api/v1/bookings` avec données réservation
2. **Controller** : Appelle `bookingService.createBooking()` → réservation créée avec `depositPaymentStatus: 'pending'`
3. **Controller** : Crée Stripe Payment Intent pour `depositAmountCents`
4. **Front** : Affiche Stripe Elements, client paie
5. **Stripe webhook** : Notifie backend `payment_intent.succeeded`
6. **Webhook handler** : Met à jour `depositPaymentStatus: 'captured'` + `depositPaymentIntentId`

### Avantage de cette architecture

✅ **Logique métier isolée** - BookingService ne connaît pas Stripe
✅ **Testabilité** - BookingService testable unitairement sans mock Stripe
✅ **Réutilisabilité** - Même service utilisable pour paiements cash, chèques, virements
✅ **Maintenabilité** - Changement de PSP n'impacte pas la logique métier

---

## Évolutions futures possibles

### Gestion de la timezone dynamique

Actuellement hardcodé `+01:00` (Europe/Paris).
Future : Récupérer depuis `artisan.timezone` :

```javascript
const artisan = await artisanRepository.findById(service.artisanId);
const startDateTime = moment.tz(`${date} ${time}`, artisan.timezone).toISOString();
```

### Validation téléphone internationale

Actuellement aucune validation du champ `phone`.
Future : Utiliser `libphonenumber-js` :

```javascript
import parsePhoneNumber from 'libphonenumber-js';

const phoneNumber = parsePhoneNumber(bookingData.customer.phone, 'FR');
if (!phoneNumber || !phoneNumber.isValid()) {
  throw new InvalidBookingDataError('customer.phone invalide');
}
```

### Support réservations récurrentes

Pour contrats de maintenance mensuels :

```javascript
await bookingService.createRecurringBooking({
  ...bookingData,
  recurrence: {
    frequency: 'monthly',
    dayOfMonth: 15,
    occurrences: 12
  }
});
```

---

## Résumé : Étape 3 validée ✅

Le **BookingService** est maintenant opérationnel avec :

- ✅ Génération codes uniques AC-XXXXXX avec collision < 0.001%
- ✅ Validation stricte (formats, règles métier, disponibilité)
- ✅ Calcul automatique acompte (30%, 35%, 40% testés)
- ✅ Orchestration ServiceRepository + SlotAvailabilityService + BookingRepository
- ✅ 17 tests unitaires couvrant tous les scénarios
- ✅ Erreurs métier typées (ServiceNotFoundError, SlotUnavailableError, InvalidBookingDataError)
- ✅ Architecture découplée prête pour intégration Stripe

**Prochaine étape** : Créer l'endpoint `POST /api/v1/bookings` qui utilisera ce service ! 🚀
