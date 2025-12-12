// Mock Stripe AVANT de charger les dépendances
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_mock_test_123456',
        client_secret: 'pi_mock_test_123456_secret_abcdef',
        amount: 3000,
        currency: 'eur',
        metadata: {},
      }),
    },
    webhooks: {
      constructEvent: jest.fn((body, signature) => {
        // Simuler la vérification de signature Stripe
        if (!signature || signature !== 'valid_stripe_signature') {
          const error = new Error('Invalid signature');
          error.type = 'StripeSignatureVerificationError';
          throw error;
        }
        return JSON.parse(body.toString());
      }),
    },
  }));
});

const request = require('supertest');
const { getKnexInstance } = require('../../src/infrastructure/database');

/**
 * Test end-to-end pour le cycle complet de réservation avec paiement Stripe
 *
 * Scénario testé :
 * 1. Créer une réservation via POST /api/v1/bookings
 * 2. Vérifier que la réponse contient le clientSecret Stripe et les données de booking
 * 3. Simuler le webhook payment_intent.succeeded de Stripe
 * 4. Vérifier que le statut de paiement est passé à "captured" en base PostgreSQL
 *
 * Critères de succès :
 * - Réservation créée avec code AC-XXXXXX
 * - Payment Intent Stripe créé avec clientSecret retourné
 * - Webhook déclenché sans erreur 500 ni timeout
 * - Statut depositPaymentStatus = "captured" en base après webhook
 */

describe('POST /api/v1/bookings - Cycle complet réservation + paiement Stripe', () => {
  let app;
  let knex;
  let testServiceId;
  let testArtisanId;

  beforeAll(async () => {
    // Charger les variables d'environnement de test
    process.env.NODE_ENV = 'test';

    // Initialiser la connexion à la base de données
    knex = getKnexInstance();

    // Récupérer un service et artisan de test depuis la base
    const artisan = await knex('artisans').first();
    if (!artisan) {
      throw new Error('Aucun artisan trouvé en base. Exécutez les seeds avant les tests.');
    }
    testArtisanId = artisan.id;

    const service = await knex('services')
      .where({ artisan_id: testArtisanId, is_active: true })
      .first();
    if (!service) {
      throw new Error('Aucun service actif trouvé en base. Exécutez les seeds avant les tests.');
    }
    testServiceId = service.id;

    // Charger l'app après la configuration
    app = require('../../src/app');
  });

  afterAll(async () => {
    // Nettoyer les données de test
    await knex('bookings').where({ customer_email: 'test-e2e@example.com' }).del();
    await knex.destroy();
  });

  it('devrait créer une réservation, générer un Payment Intent Stripe, et mettre à jour le statut après webhook', async () => {
    // Étape 1 : Créer une réservation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    const bookingPayload = {
      serviceId: testServiceId,
      date: dateStr,
      time: '14:00',
      customer: {
        name: 'Jean Dupont',
        email: 'test-e2e@example.com',
        phone: '0612345678',
      },
      notifications: {
        email: true,
        sms: false,
      },
    };

    const createResponse = await request(app)
      .post('/api/v1/bookings')
      .send(bookingPayload)
      .expect('Content-Type', /json/)
      .expect(201);

    // Vérifications de la réponse de création
    expect(createResponse.body).toHaveProperty('booking');
    expect(createResponse.body).toHaveProperty('payment');

    const { booking, payment } = createResponse.body;

    // Vérifier les données du booking
    expect(booking.publicCode).toMatch(/^AC-[A-Z0-9]{6}$/); // Format AC-XXXXXX
    expect(booking.customerName).toBe('Jean Dupont');
    expect(booking.customerEmail).toBe('test-e2e@example.com');
    expect(booking.depositPaymentStatus).toBe('pending');
    expect(booking.serviceId).toBe(testServiceId);
    expect(booking.status).toBe('confirmed');

    // Vérifier les données du paiement
    expect(payment.clientSecret).toBeDefined();
    expect(payment.clientSecret).toContain('pi_mock_test_123456_secret');
    expect(payment.paymentIntentId).toBe('pi_mock_test_123456');

    const { id: bookingId } = booking;
    const { paymentIntentId } = payment;

    // Vérifier la persistance en base - statut initial "pending"
    const bookingInDb = await knex('bookings').where({ id: bookingId }).first();
    expect(bookingInDb).toBeDefined();
    expect(bookingInDb.deposit_payment_status).toBe('pending');
    expect(bookingInDb.deposit_payment_intent_id).toBe(paymentIntentId);
    expect(bookingInDb.deposit_payment_provider).toBe('stripe');

    // Étape 2 : Simuler le webhook Stripe payment_intent.succeeded
    const webhookPayload = {
      id: 'evt_test_webhook_12345',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentId,
          object: 'payment_intent',
          amount: booking.depositAmountCents,
          currency: 'eur',
          status: 'succeeded',
          metadata: {
            bookingId: bookingId.toString(),
            bookingCode: booking.publicCode,
            customerEmail: booking.customerEmail,
            customerName: booking.customerName,
          },
        },
      },
    };

    const webhookResponse = await request(app)
      .post('/api/v1/bookings/webhook')
      .set('stripe-signature', 'valid_stripe_signature')
      .send(Buffer.from(JSON.stringify(webhookPayload)))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(webhookResponse.body).toEqual({ received: true });

    // Étape 3 : Vérifier que le statut de paiement est passé à "captured" en base
    const updatedBookingInDb = await knex('bookings')
      .where({ id: bookingId })
      .first();

    expect(updatedBookingInDb.deposit_payment_status).toBe('captured');
    expect(updatedBookingInDb.deposit_payment_intent_id).toBe(paymentIntentId);

    // Vérifier que updated_at a été mis à jour
    expect(new Date(updatedBookingInDb.updated_at).getTime()).toBeGreaterThan(
      new Date(bookingInDb.updated_at).getTime()
    );
  });

  it('devrait retourner une erreur 400 si les données de réservation sont invalides', async () => {
    const invalidPayload = {
      serviceId: 'invalid-uuid',
      date: '2024-01-01', // Date passée
      time: '14:00',
      customer: {
        name: 'Test',
        email: 'invalid-email',
      },
    };

    const response = await request(app)
      .post('/api/v1/bookings')
      .send(invalidPayload)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('devrait retourner une erreur 400 si la signature webhook Stripe est invalide', async () => {
    const webhookPayload = {
      id: 'evt_test_invalid',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_invalid',
        },
      },
    };

    const response = await request(app)
      .post('/api/v1/bookings/webhook')
      .set('stripe-signature', 'invalid_signature')
      .send(Buffer.from(JSON.stringify(webhookPayload)))
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});
