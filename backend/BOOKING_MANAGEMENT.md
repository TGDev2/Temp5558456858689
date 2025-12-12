# Endpoints de gestion de réservations

Ce document décrit les endpoints permettant aux clients de gérer leurs réservations de manière autonome (consultation, annulation, replanification).

## Table des matières

- [GET /api/v1/bookings/public](#get-apiv1bookingspublic) - Consulter une réservation
- [POST /api/v1/bookings/:code/cancel](#post-apiv1bookingscodecance) - Annuler une réservation
- [POST /api/v1/bookings/:code/reschedule](#post-apiv1bookingscodereschedule) - Replanifier une réservation

---

## GET /api/v1/bookings/public

Permet à un client de consulter sa réservation en fournissant le code public et son email.

### Requête

**Méthode** : `GET`
**URL** : `/api/v1/bookings/public`
**Query Parameters** :

| Paramètre | Type   | Requis | Description                                  |
|-----------|--------|--------|----------------------------------------------|
| `code`    | string | Oui    | Code de réservation (format: AC-XXXXXX)      |
| `email`   | string | Oui    | Email du client (authentification)           |

### Exemple de requête

```bash
curl -X GET "http://localhost:3000/api/v1/bookings/public?code=AC-A1B2C3&email=jean.dupont@example.com"
```

### Réponse (200 OK)

```json
{
  "booking": {
    "id": "uuid",
    "publicCode": "AC-A1B2C3",
    "status": "confirmed",
    "customerName": "Jean Dupont",
    "customerEmail": "jean.dupont@example.com",
    "customerPhone": "0612345678",
    "startDateTime": "2025-12-15T14:00:00+01:00",
    "durationMinutes": 60,
    "priceCents": 10000,
    "depositAmountCents": 3000,
    "depositPaymentStatus": "captured",
    "createdAt": "2025-12-12T10:30:00Z",
    "updatedAt": "2025-12-12T10:35:00Z"
  }
}
```

### Erreurs possibles

**404 Not Found** - Code invalide ou email ne correspondant pas
```json
{
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Réservation introuvable avec ce code et cet email."
  }
}
```

**400 Bad Request** - Paramètres invalides
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "code doit être au format AC-XXXXXX"
  }
}
```

---

## POST /api/v1/bookings/:code/cancel

Annule une réservation existante.

### Requête

**Méthode** : `POST`
**URL** : `/api/v1/bookings/:code/cancel`
**Path Parameters** :

| Paramètre | Type   | Description                     |
|-----------|--------|---------------------------------|
| `code`    | string | Code de réservation (AC-XXXXXX) |

**Body (JSON)** :

| Champ   | Type   | Requis | Description                        |
|---------|--------|--------|------------------------------------|
| `email` | string | Oui    | Email du client (authentification) |

### Exemple de requête

```bash
curl -X POST http://localhost:3000/api/v1/bookings/AC-A1B2C3/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jean.dupont@example.com"
  }'
```

### Réponse (200 OK)

```json
{
  "booking": {
    "id": "uuid",
    "publicCode": "AC-A1B2C3",
    "status": "cancelled",
    "customerName": "Jean Dupont",
    "customerEmail": "jean.dupont@example.com",
    "startDateTime": "2025-12-15T14:00:00+01:00",
    "durationMinutes": 60,
    "updatedAt": "2025-12-13T09:00:00Z"
  },
  "message": "Réservation annulée avec succès."
}
```

### Effets de bord

- Le statut de la réservation passe à `"cancelled"` en base de données
- Le créneau devient immédiatement disponible pour d'autres clients
- La réservation est visible dans `/api/v1/availability` comme créneau libre

### Erreurs possibles

**404 Not Found** - Code invalide ou email ne correspondant pas
```json
{
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Réservation introuvable avec ce code et cet email."
  }
}
```

**409 Conflict** - Réservation déjà annulée
```json
{
  "error": {
    "code": "BOOKING_ALREADY_CANCELLED",
    "message": "Cette réservation est déjà annulée."
  }
}
```

---

## POST /api/v1/bookings/:code/reschedule

Replanifie une réservation vers une nouvelle date/heure.

### Requête

**Méthode** : `POST`
**URL** : `/api/v1/bookings/:code/reschedule`
**Path Parameters** :

| Paramètre | Type   | Description                     |
|-----------|--------|---------------------------------|
| `code`    | string | Code de réservation (AC-XXXXXX) |

**Body (JSON)** :

| Champ     | Type   | Requis | Description                                 |
|-----------|--------|--------|---------------------------------------------|
| `email`   | string | Oui    | Email du client (authentification)          |
| `newDate` | string | Oui    | Nouvelle date (format: YYYY-MM-DD)          |
| `newTime` | string | Oui    | Nouvelle heure (format: HH:MM)              |

### Exemple de requête

```bash
curl -X POST http://localhost:3000/api/v1/bookings/AC-A1B2C3/reschedule \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jean.dupont@example.com",
    "newDate": "2025-12-20",
    "newTime": "16:00"
  }'
```

### Réponse (200 OK)

```json
{
  "booking": {
    "id": "uuid",
    "publicCode": "AC-A1B2C3",
    "status": "rescheduled",
    "customerName": "Jean Dupont",
    "customerEmail": "jean.dupont@example.com",
    "startDateTime": "2025-12-20T16:00:00+01:00",
    "durationMinutes": 60,
    "updatedAt": "2025-12-13T10:15:00Z"
  },
  "message": "Réservation replanifiée avec succès."
}
```

### Validations

- Le nouveau créneau doit être disponible (vérifié via `SlotAvailabilityService`)
- La date ne peut pas être dans le passé
- Le créneau doit être dans les horaires d'ouverture de l'artisan
- Le créneau ne doit pas être bloqué par une autre réservation ou un événement calendrier

### Effets de bord

- Le statut passe à `"rescheduled"` en base de données
- L'ancien créneau est libéré et devient disponible pour d'autres clients
- Le nouveau créneau est réservé et bloque la disponibilité
- La date/heure de début (`start_datetime`) est mise à jour

### Erreurs possibles

**404 Not Found** - Code invalide ou email ne correspondant pas
```json
{
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Réservation introuvable avec ce code et cet email."
  }
}
```

**409 Conflict** - Créneau indisponible
```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Le créneau 16:00 est déjà réservé ou indisponible. Raison: booking"
  }
}
```

**409 Conflict** - Réservation annulée
```json
{
  "error": {
    "code": "BOOKING_ALREADY_CANCELLED",
    "message": "Impossible de replanifier une réservation annulée."
  }
}
```

**400 Bad Request** - Paramètres invalides
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "newDate doit être au format YYYY-MM-DD"
  }
}
```

---

## Flow utilisateur complet

### 1. Consultation d'une réservation

```
Client → GET /api/v1/bookings/public?code=AC-A1B2C3&email=client@example.com
       ← 200 OK + détails de la réservation
```

### 2. Annulation

```
Client → POST /api/v1/bookings/AC-A1B2C3/cancel
       ← 200 OK + réservation avec status="cancelled"

Effet : Le créneau devient libre dans /api/v1/availability
```

### 3. Replanification

```
Client → GET /api/v1/availability?serviceId=xxx&date=2025-12-20
       ← 200 OK + liste des créneaux disponibles

Client → POST /api/v1/bookings/AC-A1B2C3/reschedule
       ← 200 OK + réservation avec status="rescheduled" et nouvelle date/heure

Effet : Ancien créneau libéré, nouveau créneau réservé
```

---

## Tests

Lancer les tests d'intégration :

```bash
cd backend
npm test __tests__/integration/booking-management.test.js
```

### Scénarios couverts

**GET /api/v1/bookings/public** :
- ✅ Consultation réussie avec code et email valides
- ✅ 404 si code invalide
- ✅ 404 si email ne correspond pas
- ✅ 400 si paramètres invalides

**POST /api/v1/bookings/:code/cancel** :
- ✅ Annulation réussie d'une réservation confirmée
- ✅ 409 si réservation déjà annulée
- ✅ 404 si code invalide

**POST /api/v1/bookings/:code/reschedule** :
- ✅ Replanification réussie vers un créneau disponible
- ✅ 409 si nouveau créneau occupé
- ✅ 409 si réservation annulée
- ✅ 404 si code invalide
- ✅ 400 si paramètres invalides

---

## Critères de succès MVP

✅ Client peut consulter sa réservation avec code AC-XXXXXX + email
✅ Client peut annuler (statut → "cancelled", créneau libéré en base)
✅ Client peut replanifier vers un nouveau créneau libre
✅ Ancien créneau libéré après replanification
✅ Validation disponibilité avant replanification
✅ Tests d'intégration couvrent les cas 200 OK, 404 Not Found, 409 Conflict

---

## Justification métier

### Produit
- Autonomie client = différenciateur clé vs Calendly
- Réduction des appels téléphone pour modifications

### UX
- Front peut basculer de localStorage vers vrais appels API
- Expérience complète validée en conditions réelles

### Tech
- Cohérence transactionnelle garantie (libération créneau après annulation)
- Validation disponibilité avant replanification
- Gestion des conflits (double booking impossible)

### Business
- Mesure du taux d'annulation réel pour ajuster politique de remboursement
- Données pour optimiser la politique d'acompte

---

## Prochaines étapes

- [ ] Implémenter les notifications email post-annulation
- [ ] Ajouter un délai minimum avant annulation (ex: 24h avant RDV)
- [ ] Gérer les remboursements d'acompte selon politique
- [ ] Ajouter un historique des modifications (audit trail)
- [ ] Implémenter un endpoint GET /api/v1/bookings/me pour lister toutes les réservations d'un email
