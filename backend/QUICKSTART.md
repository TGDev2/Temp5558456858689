# Guide de démarrage rapide - Endpoint POST /bookings

## Prérequis

1. **PostgreSQL 14+** en cours d'exécution
2. **Node.js 20+** et npm installés
3. **Compte Stripe** (mode test) - https://dashboard.stripe.com/register

## Installation

```bash
cd backend

# Installer les dépendances
npm install

# Copier le fichier .env et configurer les clés Stripe
# STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET sont déjà configurés avec des valeurs placeholder
# Vous devez les remplacer par vos vraies clés de test Stripe

# Créer la base de données PostgreSQL
createdb artisanconnect

# Lancer les migrations et seeds
npm run db:setup
```

## Configuration Stripe

### 1. Obtenir les clés API

1. Connectez-vous à https://dashboard.stripe.com
2. Allez dans **Developers** → **API keys**
3. Mode **Test** activé (toggle en haut à droite)
4. Copiez la **Secret key** (commence par `sk_test_`)
5. Mettez à jour `STRIPE_SECRET_KEY` dans `.env`

### 2. Configurer le webhook

**Option A : Développement local avec Stripe CLI (recommandé)**

```bash
# Installer Stripe CLI
# Windows: https://github.com/stripe/stripe-cli/releases
# Mac: brew install stripe/stripe-cli/stripe
# Linux: Voir https://stripe.com/docs/stripe-cli

# Se connecter à Stripe
stripe login

# Lancer l'écoute des webhooks
stripe listen --forward-to localhost:3000/api/v1/bookings/webhook

# Le webhook secret sera affiché dans la console (commence par whsec_)
# Copiez-le dans .env → STRIPE_WEBHOOK_SECRET
```

**Option B : Webhook distant (pour serveur déployé)**

1. Dashboard Stripe → **Developers** → **Webhooks**
2. Cliquez sur **Add endpoint**
3. URL : `https://votre-domaine.com/api/v1/bookings/webhook`
4. Événements à écouter : `payment_intent.succeeded`
5. Copiez le **Signing secret** dans `.env` → `STRIPE_WEBHOOK_SECRET`

## Lancer le serveur

```bash
# Mode développement avec auto-reload
npm run dev

# Le serveur démarre sur http://localhost:3000
```

## Tester l'endpoint

### 1. Lister les services disponibles

```bash
curl http://localhost:3000/api/v1/services
```

Copiez un `serviceId` depuis la réponse.

### 2. Vérifier les créneaux disponibles

```bash
curl "http://localhost:3000/api/v1/availability?serviceId=VOTRE_SERVICE_ID&date=2025-12-15"
```

### 3. Créer une réservation

```bash
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "VOTRE_SERVICE_ID",
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
  }'
```

**Réponse attendue** :
```json
{
  "booking": {
    "id": "...",
    "publicCode": "AC-A1B2C3",
    "depositPaymentStatus": "pending",
    ...
  },
  "payment": {
    "clientSecret": "pi_..._secret_...",
    "paymentIntentId": "pi_..."
  }
}
```

### 4. Simuler un paiement réussi

**Option A : Avec Stripe CLI** (recommandé)

```bash
# Dans un terminal où Stripe CLI écoute
stripe trigger payment_intent.succeeded
```

**Option B : Manuellement**

```bash
curl -X POST http://localhost:3000/api/v1/bookings/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: VOTRE_WEBHOOK_SECRET" \
  -d '{
    "id": "evt_test",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "VOTRE_PAYMENT_INTENT_ID",
        "status": "succeeded"
      }
    }
  }'
```

### 5. Vérifier le statut de paiement en base

```bash
# Se connecter à PostgreSQL
psql artisanconnect

# Vérifier le statut
SELECT public_code, customer_name, deposit_payment_status
FROM bookings
WHERE public_code = 'AC-A1B2C3';

# Résultat attendu : deposit_payment_status = 'captured'
```

## Lancer les tests

```bash
# Lancer tous les tests
npm test

# Lancer les tests en mode watch
npm run test:watch

# Générer un rapport de couverture
npm run test:coverage
```

**Note** : Les tests utilisent des mocks de Stripe et ne nécessitent pas de vraies clés API.

## Test avec le front-end

Pour intégrer avec Stripe Elements côté front :

```javascript
// 1. Créer la réservation
const response = await fetch('http://localhost:3000/api/v1/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId: '...',
    date: '2025-12-15',
    time: '14:00',
    customer: {
      name: 'Jean Dupont',
      email: 'jean.dupont@example.com',
      phone: '0612345678'
    }
  })
});

const { booking, payment } = await response.json();

// 2. Confirmer le paiement avec Stripe
const stripe = Stripe('pk_test_...');  // Clé publique Stripe
const { error, paymentIntent } = await stripe.confirmCardPayment(
  payment.clientSecret,
  {
    payment_method: {
      card: cardElement,  // Stripe Elements card
      billing_details: {
        name: 'Jean Dupont',
        email: 'jean.dupont@example.com'
      }
    }
  }
);

if (paymentIntent?.status === 'succeeded') {
  console.log('✅ Réservation confirmée :', booking.publicCode);
}
```

## Cartes de test Stripe

- **Succès** : `4242 4242 4242 4242`
- **Authentification requise** : `4000 0025 0000 3155`
- **Échec** : `4000 0000 0000 0002`
- **Débit insuffisant** : `4000 0000 0000 9995`

Date : n'importe quelle date future
CVC : n'importe quel 3 chiffres
Code postal : n'importe lequel

## Dépannage

### Erreur : "STRIPE_SECRET_KEY is required"

➜ Vérifiez que votre fichier `.env` contient une clé Stripe valide commençant par `sk_test_`

### Erreur : "ECONNREFUSED" lors des migrations

➜ PostgreSQL n'est pas démarré. Lancez-le avec :
```bash
# Windows
net start postgresql

# Mac
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### Webhook non reçu

➜ Utilisez Stripe CLI avec `stripe listen` pour tester localement

### Tests échouent

➜ Vérifiez que la base de données a bien les seeds :
```bash
npm run db:setup
npm test
```

## Fichiers créés

- ✅ [src/api/controllers/bookingController.js](src/api/controllers/bookingController.js) - Controller avec Payment Intent
- ✅ [src/api/routes/bookingRoutes.js](src/api/routes/bookingRoutes.js) - Routes POST /bookings
- ✅ [src/api/validators/bookingSchemas.js](src/api/validators/bookingSchemas.js) - Validation Joi
- ✅ [__tests__/integration/booking.test.js](__tests__/integration/booking.test.js) - Tests E2E
- ✅ [BOOKING_ENDPOINT.md](BOOKING_ENDPOINT.md) - Documentation complète
- ✅ [QUICKSTART.md](QUICKSTART.md) - Ce guide

## Ressources

- [Documentation Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
