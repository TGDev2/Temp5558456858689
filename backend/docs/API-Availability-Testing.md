# Testing Guide: GET /api/v1/availability

## Guide complet de test de l'endpoint de disponibilités

Ce document explique comment tester l'endpoint `GET /api/v1/availability` qui expose le service `SlotAvailabilityService`.

---

## Prérequis

### 1. Base de données configurée

```bash
# Créer/réinitialiser la base de données
npm run db:reset

# Ou manuellement :
npm run migrate:latest
npm run seed:run
```

### 2. Serveur de développement lancé

```bash
npm run dev
```

Le serveur devrait démarrer sur `http://localhost:3000` (ou le port configuré dans `.env`).

---

## Structure de la requête

### Endpoint

```
GET /api/v1/availability
```

### Paramètres de requête (query params)

| Paramètre | Type | Requis | Format | Description |
|-----------|------|--------|--------|-------------|
| `serviceId` | string | ✅ Oui | UUID v4 | Identifiant du service |
| `date` | string | ✅ Oui | `YYYY-MM-DD` | Date de consultation (non antérieure à aujourd'hui) |

### Exemple de requête

```bash
GET /api/v1/availability?serviceId=123e4567-e89b-12d3-a456-426614174000&date=2025-12-15
```

---

## Scénarios de test

### ✅ Scénario 1 : Service existant avec créneaux disponibles

**Contexte** : Jour ouvrable (lundi-vendredi), aucune réservation existante

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId={SERVICE_UUID}&date=2025-12-15" \
  -H "Accept: application/json"
```

**Réponse attendue** : `200 OK`

```json
{
  "serviceId": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2025-12-15",
  "opening": {
    "startMinutes": 510,
    "endMinutes": 1080,
    "breakStartMinutes": 720,
    "breakEndMinutes": 780
  },
  "slots": [
    {
      "time": "08:30",
      "available": true,
      "blockedBy": []
    },
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
    ...
    {
      "time": "13:00",
      "available": true,
      "blockedBy": []
    },
    ...
    {
      "time": "17:30",
      "available": true,
      "blockedBy": []
    }
  ]
}
```

**Vérifications** :
- ✅ Les créneaux sont générés par pas de 30 minutes
- ✅ Pas de créneaux entre 12:00 et 13:00 (pause déjeuner)
- ✅ Les créneaux commencent à 08:30 et se terminent avant 18:00
- ✅ Tous les créneaux sont `available: true` (aucune réservation)

---

### ✅ Scénario 2 : Samedi (horaires réduits, sans pause)

**Contexte** : Samedi 09:00-13:00, sans pause déjeuner

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId={SERVICE_UUID}&date=2025-12-13" \
  -H "Accept: application/json"
```

**Réponse attendue** : `200 OK`

```json
{
  "serviceId": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2025-12-13",
  "opening": {
    "startMinutes": 540,
    "endMinutes": 780,
    "breakStartMinutes": null,
    "breakEndMinutes": null
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
      "time": "10:00",
      "available": true,
      "blockedBy": []
    },
    {
      "time": "10:30",
      "available": true,
      "blockedBy": []
    },
    {
      "time": "11:00",
      "available": true,
      "blockedBy": []
    },
    {
      "time": "11:30",
      "available": true,
      "blockedBy": []
    },
    {
      "time": "12:00",
      "available": true,
      "blockedBy": []
    },
    {
      "time": "12:30",
      "available": true,
      "blockedBy": []
    }
  ]
}
```

**Vérifications** :
- ✅ Horaires 09:00-13:00 uniquement
- ✅ `breakStartMinutes` et `breakEndMinutes` sont `null` (pas de pause le samedi)
- ✅ 8 créneaux disponibles (4 heures × 2 créneaux/heure)

---

### ✅ Scénario 3 : Dimanche (fermé)

**Contexte** : Aucun horaire d'ouverture configuré pour le dimanche

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId={SERVICE_UUID}&date=2025-12-14" \
  -H "Accept: application/json"
```

**Réponse attendue** : `200 OK`

```json
{
  "serviceId": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2025-12-14",
  "opening": null,
  "slots": []
}
```

**Vérifications** :
- ✅ `opening` est `null` (pas d'horaires configurés)
- ✅ `slots` est un tableau vide
- ✅ Status HTTP 200 (ce n'est pas une erreur, c'est un jour fermé)

---

### ❌ Scénario 4 : Service inexistant (404)

**Contexte** : UUID de service invalide ou inexistant

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId=00000000-0000-0000-0000-000000000000&date=2025-12-15" \
  -H "Accept: application/json"
```

**Réponse attendue** : `404 Not Found`

```json
{
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "Le service demandé n'existe pas ou n'est pas actif."
  }
}
```

---

### ❌ Scénario 5 : Paramètres invalides (400)

#### 5a. Date dans le passé

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId={SERVICE_UUID}&date=2020-01-01" \
  -H "Accept: application/json"
```

**Réponse attendue** : `400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides : date ne peut pas être antérieure à aujourd'hui"
  }
}
```

#### 5b. Format de date invalide

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId={SERVICE_UUID}&date=15/12/2025" \
  -H "Accept: application/json"
```

**Réponse attendue** : `400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides : date doit être au format YYYY-MM-DD"
  }
}
```

#### 5c. serviceId invalide (non-UUID)

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId=invalid-uuid&date=2025-12-15" \
  -H "Accept: application/json"
```

**Réponse attendue** : `400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides : serviceId doit être un UUID valide"
  }
}
```

#### 5d. Paramètres manquants

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?date=2025-12-15" \
  -H "Accept: application/json"
```

**Réponse attendue** : `400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides : serviceId est requis"
  }
}
```

---

## Test avec créneaux bloqués

Pour tester les scénarios avec créneaux indisponibles, vous devez d'abord créer des réservations ou des indisponibilités externes.

### Créer une réservation de test (via SQL)

```sql
-- Récupérer l'artisan et le service
SELECT id, business_name FROM artisans LIMIT 1;
SELECT id, name, duration_minutes FROM services LIMIT 1;

-- Insérer une réservation confirmée pour le 15 décembre 2025 à 10:00
INSERT INTO bookings (
  public_code,
  artisan_id,
  service_id,
  status,
  customer_name,
  customer_email,
  start_datetime,
  duration_minutes,
  price_cents,
  deposit_amount_cents,
  deposit_rate,
  deposit_payment_status
) VALUES (
  'AC-TEST01',
  '{ARTISAN_UUID}',
  '{SERVICE_UUID}',
  'confirmed',
  'Jean Test',
  'jean.test@example.com',
  '2025-12-15T10:00:00+01:00',
  30,
  4000,
  1200,
  0.3,
  'captured'
);
```

### Tester avec la réservation existante

**Requête** :
```bash
curl -X GET "http://localhost:3000/api/v1/availability?serviceId={SERVICE_UUID}&date=2025-12-15" \
  -H "Accept: application/json"
```

**Réponse attendue** : Le créneau 10:00 devrait être bloqué

```json
{
  "serviceId": "...",
  "date": "2025-12-15",
  "opening": { ... },
  "slots": [
    ...
    {
      "time": "10:00",
      "available": false,
      "blockedBy": [
        {
          "type": "booking",
          "bookingPublicCode": "AC-TEST01",
          "summary": "Réservation - Jean Test"
        }
      ]
    },
    ...
  ]
}
```

---

## Tests avec Postman

### Collection Postman

Créez une collection avec les tests suivants :

1. **GET Availability - Success**
   - URL: `{{baseUrl}}/api/v1/availability?serviceId={{serviceId}}&date=2025-12-15`
   - Tests:
     ```javascript
     pm.test("Status code is 200", function () {
         pm.response.to.have.status(200);
     });
     pm.test("Response has slots array", function () {
         var jsonData = pm.response.json();
         pm.expect(jsonData.slots).to.be.an('array');
     });
     pm.test("Response has opening object", function () {
         var jsonData = pm.response.json();
         pm.expect(jsonData.opening).to.be.an('object');
     });
     ```

2. **GET Availability - Service Not Found**
   - URL: `{{baseUrl}}/api/v1/availability?serviceId=00000000-0000-0000-0000-000000000000&date=2025-12-15`
   - Tests:
     ```javascript
     pm.test("Status code is 404", function () {
         pm.response.to.have.status(404);
     });
     pm.test("Error code is SERVICE_NOT_FOUND", function () {
         var jsonData = pm.response.json();
         pm.expect(jsonData.error.code).to.eql('SERVICE_NOT_FOUND');
     });
     ```

3. **GET Availability - Invalid Date**
   - URL: `{{baseUrl}}/api/v1/availability?serviceId={{serviceId}}&date=2020-01-01`
   - Tests:
     ```javascript
     pm.test("Status code is 400", function () {
         pm.response.to.have.status(400);
     });
     pm.test("Error code is VALIDATION_ERROR", function () {
         var jsonData = pm.response.json();
         pm.expect(jsonData.error.code).to.eql('VALIDATION_ERROR');
     });
     ```

### Variables d'environnement Postman

```json
{
  "baseUrl": "http://localhost:3000/api/v1",
  "serviceId": "obtenir depuis GET /api/v1/services"
}
```

---

## Récupérer un serviceId valide

Avant de tester l'endpoint availability, récupérez un UUID de service valide :

```bash
curl -X GET "http://localhost:3000/api/v1/services" \
  -H "Accept: application/json"
```

Réponse :
```json
{
  "services": [
    {
      "id": "a1b2c3d4-...",
      "name": "Diagnostic et audit complet",
      ...
    }
  ]
}
```

Copiez l'`id` du premier service et utilisez-le dans vos tests.

---

## Commandes de test automatisé

### Script de test rapide (bash)

Créer un fichier `test-availability.sh` :

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"

# 1. Récupérer le premier service
echo "📋 Récupération d'un service valide..."
SERVICE_ID=$(curl -s "$BASE_URL/services" | jq -r '.services[0].id')
echo "   Service ID: $SERVICE_ID"

# 2. Tester disponibilités pour aujourd'hui + 7 jours
FUTURE_DATE=$(date -d "+7 days" +%Y-%m-%d)
echo ""
echo "🔍 Test GET /api/v1/availability"
echo "   Date: $FUTURE_DATE"

curl -s "$BASE_URL/availability?serviceId=$SERVICE_ID&date=$FUTURE_DATE" | jq '.'

# 3. Tester cas d'erreur (service inexistant)
echo ""
echo "❌ Test 404 (service inexistant)"
curl -s "$BASE_URL/availability?serviceId=00000000-0000-0000-0000-000000000000&date=$FUTURE_DATE" | jq '.'

# 4. Tester validation (date passée)
echo ""
echo "❌ Test 400 (date passée)"
curl -s "$BASE_URL/availability?serviceId=$SERVICE_ID&date=2020-01-01" | jq '.'
```

Rendre exécutable et lancer :
```bash
chmod +x test-availability.sh
./test-availability.sh
```

---

## Checklist de validation

Avant de considérer l'endpoint comme validé, vérifier :

- ✅ Status 200 pour un service existant avec date future valide
- ✅ Status 404 pour un service inexistant
- ✅ Status 400 pour une date passée
- ✅ Status 400 pour un format de date invalide
- ✅ Status 400 pour un UUID invalide
- ✅ Status 400 pour des paramètres manquants
- ✅ `slots` contient les créneaux par pas de 30 minutes
- ✅ `blockedBy` est vide pour les créneaux disponibles
- ✅ `blockedBy` contient les raisons de blocage pour les créneaux indisponibles
- ✅ Pas de créneaux pendant la pause déjeuner (12:00-13:00)
- ✅ Horaires réduits le samedi (09:00-13:00)
- ✅ `opening: null` et `slots: []` pour le dimanche
- ✅ Logs Winston corrects (info, warn, error)

---

## Dépannage

### Le serveur ne démarre pas

```bash
# Vérifier les logs
npm run dev

# Vérifier que PostgreSQL est lancé
pg_isready

# Vérifier la connexion à la base
psql -U postgres -d artisanconnect -c "SELECT 1"
```

### Les slots sont vides alors qu'il devrait y en avoir

```bash
# Vérifier que les seeds ont bien été exécutés
npm run seed:run

# Vérifier les horaires d'ouverture en base
psql -U postgres -d artisanconnect -c "SELECT * FROM opening_rules"
```

### Erreur 500 Internal Server Error

Consulter les logs backend :
```bash
tail -f backend/logs/combined.log
# ou
tail -f backend/logs/error.log
```

---

## Résumé : Étape 2 validée ✅

L'endpoint `GET /api/v1/availability` est maintenant opérationnel et conforme au contrat `domain-model.md`. Il expose le service métier `SlotAvailabilityService` avec :

- ✅ Validation complète des paramètres (Joi)
- ✅ Gestion d'erreurs HTTP appropriée (400, 404, 500)
- ✅ Sérialisation JSON conforme au contrat
- ✅ Logs structurés Winston
- ✅ Architecture en couches respectée (controller → service → repositories)

**Le front peut maintenant remplacer sa logique client par des appels API réels !** 🎉
