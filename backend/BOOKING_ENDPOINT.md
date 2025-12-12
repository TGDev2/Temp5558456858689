# Endpoint POST /api/v1/bookings - Documentation

## Vue d'ensemble

L'endpoint `POST /api/v1/bookings` permet de créer une réservation avec intégration Stripe Payment Intent pour le paiement de l'acompte.

## Architecture

### Flow complet

```
Client → POST /bookings → BookingController → BookingService → DB
                            ↓
                      Stripe Payment Intent
                            ↓
                      Return clientSecret
                            ↓
Client utilise clientSecret → Stripe Elements → Payment succeeded
                                                        ↓
                                                Webhook Stripe
                                                        ↓
                                            Update payment status → "captured"
```

### Fichiers créés

- **Controllers**: [src/api/controllers/bookingController.js](src/api/controllers/bookingController.js)
- **Routes**: [src/api/routes/bookingRoutes.js](src/api/routes/bookingRoutes.js)
- **Validators**: [src/api/validators/bookingSchemas.js](src/api/validators/bookingSchemas.js)
- **Tests**: [__tests__/integration/booking.test.js](__tests__/integration/booking.test.js)

## Utilisation

### 1. Créer une réservation

**Endpoint**: `POST /api/v1/bookings`

**Request Body**:
```json
{
  "serviceId": "uuid-du-service",
  "date": "2025-12-15",
  "time": "14:00",
  "customer": {
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "phone": "0612345678"
  },
  "notifications": {
    "email": true,
    "sms": false
  }
}
```

**Response** (201 Created):
```json
{
  "booking": {
    "id": "uuid",
    "publicCode": "AC-A1B2C3",
    "serviceId": "uuid",
    "status": "confirmed",
    "customerName": "Jean Dupont",
    "customerEmail": "jean.dupont@example.com",
    "startDateTime": "2025-12-15T14:00:00+01:00",
    "durationMinutes": 60,
    "priceCents": 10000,
    "depositAmountCents": 3000,
    "depositPaymentStatus": "pending",
    "createdAt": "2025-12-12T10:30:00Z"
  },
  "payment": {
    "clientSecret": "pi_xxx_secret_yyy",
    "paymentIntentId": "pi_xxx"
  }
}
```

### 2. Finaliser le paiement (côté front)

Utiliser Stripe Elements avec le `clientSecret` reçu :

```javascript
const stripe = Stripe('pk_test_...');
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: 'Jean Dupont',
      email: 'jean.dupont@example.com'
    }
  }
});

if (error) {
  // Gérer l'erreur
} else if (paymentIntent.status === 'succeeded') {
  // Paiement réussi !
  console.log('Réservation confirmée avec code', booking.publicCode);
}
```

### 3. Webhook Stripe

**Endpoint**: `POST /api/v1/bookings/webhook`

Stripe enverra automatiquement un événement `payment_intent.succeeded` lorsque le paiement est confirmé. Le webhook met à jour le statut de paiement de la réservation à `"captured"`.

**Configuration Stripe**:
1. Aller dans le Dashboard Stripe → Developers → Webhooks
2. Ajouter un endpoint : `https://votre-domaine.com/api/v1/bookings/webhook`
3. Sélectionner l'événement : `payment_intent.succeeded`
4. Copier le signing secret dans `.env` → `STRIPE_WEBHOOK_SECRET`

## Configuration

### Variables d'environnement

Ajouter dans `.env` :

```bash
# Stripe (clés de test pour développement)
STRIPE_SECRET_KEY=sk_test_51QYourTestKeyHere
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret_here
```

Pour obtenir ces clés :
1. Créer un compte Stripe : https://dashboard.stripe.com/register
2. Mode Test : Dashboard → Developers → API keys
3. Webhook Secret : Dashboard → Developers → Webhooks → Add endpoint

### Carte bancaire de test

Pour tester les paiements en mode test Stripe :

- **Succès** : `4242 4242 4242 4242`
- **Échec** : `4000 0000 0000 0002`
- Date d'expiration : toute date future
- CVC : n'importe quel 3 chiffres
- Code postal : n'importe lequel

## Tests

### Lancer les tests end-to-end

```bash
cd backend

# Préparer la base de données
npm run db:setup

# Lancer les tests
npm test

# Lancer les tests en mode watch
npm run test:watch

# Générer un rapport de couverture
npm run test:coverage
```

### Test manuel avec cURL

```bash
# 1. Créer une réservation
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "votre-service-id",
    "date": "2025-12-15",
    "time": "14:00",
    "customer": {
      "name": "Jean Dupont",
      "email": "jean.dupont@example.com",
      "phone": "0612345678"
    }
  }'

# 2. Simuler un webhook Stripe (pour tests locaux)
curl -X POST http://localhost:3000/api/v1/bookings/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: whsec_test..." \
  -d '{
    "id": "evt_test",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_xxx",
        "status": "succeeded"
      }
    }
  }'
```

### Test avec Stripe CLI (recommandé)

```bash
# Installer Stripe CLI
# https://stripe.com/docs/stripe-cli

# Écouter les webhooks localement
stripe listen --forward-to localhost:3000/api/v1/bookings/webhook

# Dans un autre terminal, déclencher un événement test
stripe trigger payment_intent.succeeded
```

## Validation des données

Le schéma de validation Joi applique les règles suivantes :

- `serviceId` : UUID v4 valide requis
- `date` : Format YYYY-MM-DD, non antérieure à aujourd'hui
- `time` : Format HH:MM (ex: 14:30)
- `customer.name` : 2-100 caractères
- `customer.email` : Format email valide
- `customer.phone` : Numéro français optionnel (format +33... ou 0...)
- `notifications` : Objet optionnel avec `email` (défaut: true) et `sms` (défaut: false)

## Erreurs possibles

### 400 Bad Request
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "serviceId doit être un UUID valide"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "Le service demandé n'existe pas ou n'est pas actif."
  }
}
```

### 409 Conflict
```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Le créneau 14:00 est déjà réservé ou indisponible."
  }
}
```

## Critères de succès (MVP)

✅ Un utilisateur peut créer une réservation depuis le front
✅ Saisir une carte bancaire test Stripe (4242 4242 4242 4242)
✅ Recevoir une confirmation avec code AC-XXXXXX
✅ Voir le statut paiement passer à "captured" dans PostgreSQL
✅ Aucune erreur 500 ni timeout
✅ Test end-to-end Supertest valide le flow complet

## Prochaines étapes

- [ ] Ajouter la gestion des erreurs de paiement (payment_intent.failed)
- [ ] Implémenter les notifications email post-réservation
- [ ] Ajouter la gestion des remboursements (refund)
- [ ] Créer un endpoint GET /bookings/:code pour consulter une réservation
- [ ] Implémenter la gestion des réservations multiples (prévention double booking)
