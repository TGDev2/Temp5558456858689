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
 * Tests end-to-end pour les endpoints de gestion de réservation
 *
 * Scénarios testés :
 * 1. GET /api/v1/bookings/public - Consultation avec code et email
 * 2. POST /api/v1/bookings/:code/cancel - Annulation
 * 3. POST /api/v1/bookings/:code/reschedule - Replanification
 *
 * Cas de test :
 * - 200 OK : Consultation, annulation et replanification réussies
 * - 404 Not Found : Code invalide ou email erroné
 * - 409 Conflict : Créneau occupé pour reschedule, réservation déjà annulée
 */

describe('Gestion des réservations - GET, Cancel, Reschedule', () => {
  let app;
  let knex;
  let testServiceId;
  let testArtisanId;
  let testBookingCode;
  let testBookingEmail;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    knex = getKnexInstance();

    // Récupérer un service et artisan de test
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

    app = require('../../src/app');
  });

  afterAll(async () => {
    // Nettoyer les données de test
    await knex('bookings')
      .where({ customer_email: 'test-management@example.com' })
      .del();
    await knex.destroy();
  });

  beforeEach(async () => {
    // Nettoyer avant chaque test
    await knex('bookings')
      .where({ customer_email: 'test-management@example.com' })
      .del();
  });

  describe('GET /api/v1/bookings/public - Consultation', () => {
    it('devrait retourner une réservation existante avec le bon code et email', async () => {
      // Créer une réservation d'abord
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dateStr,
          time: '10:00',
          customer: {
            name: 'Test User',
            email: 'test-management@example.com',
            phone: '0612345678',
          },
        })
        .expect(201);

      const { booking } = createResponse.body;
      testBookingCode = booking.publicCode;
      testBookingEmail = booking.customerEmail;

      // Consulter la réservation
      const response = await request(app)
        .get('/api/v1/bookings/public')
        .query({
          code: testBookingCode,
          email: testBookingEmail,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('booking');
      expect(response.body.booking.publicCode).toBe(testBookingCode);
      expect(response.body.booking.customerEmail).toBe(testBookingEmail);
      expect(response.body.booking.status).toBe('confirmed');
    });

    it('devrait retourner 404 si le code est invalide', async () => {
      const response = await request(app)
        .get('/api/v1/bookings/public')
        .query({
          code: 'AC-XXXXXX',
          email: 'test@example.com',
        })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner 404 si l\'email ne correspond pas', async () => {
      // Créer une réservation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dateStr,
          time: '11:00',
          customer: {
            name: 'Test User',
            email: 'test-management@example.com',
          },
        })
        .expect(201);

      const { booking } = createResponse.body;

      // Essayer de consulter avec un mauvais email
      const response = await request(app)
        .get('/api/v1/bookings/public')
        .query({
          code: booking.publicCode,
          email: 'wrong-email@example.com',
        })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner 400 si les paramètres sont invalides', async () => {
      const response = await request(app)
        .get('/api/v1/bookings/public')
        .query({
          code: 'invalid-format',
          email: 'not-an-email',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/bookings/:code/cancel - Annulation', () => {
    it('devrait annuler une réservation confirmée', async () => {
      // Créer une réservation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dateStr,
          time: '14:00',
          customer: {
            name: 'Test User Cancel',
            email: 'test-management@example.com',
          },
        })
        .expect(201);

      const { booking } = createResponse.body;

      // Annuler la réservation
      const response = await request(app)
        .post(`/api/v1/bookings/${booking.publicCode}/cancel`)
        .send({
          email: booking.customerEmail,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('booking');
      expect(response.body.booking.status).toBe('cancelled');
      expect(response.body).toHaveProperty('message');

      // Vérifier en base
      const bookingInDb = await knex('bookings')
        .where({ id: booking.id })
        .first();
      expect(bookingInDb.status).toBe('cancelled');
    });

    it('devrait retourner 409 si la réservation est déjà annulée', async () => {
      // Créer et annuler une réservation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dateStr,
          time: '15:00',
          customer: {
            name: 'Test User',
            email: 'test-management@example.com',
          },
        })
        .expect(201);

      const { booking } = createResponse.body;

      // Première annulation
      await request(app)
        .post(`/api/v1/bookings/${booking.publicCode}/cancel`)
        .send({ email: booking.customerEmail })
        .expect(200);

      // Deuxième annulation (doit échouer)
      const response = await request(app)
        .post(`/api/v1/bookings/${booking.publicCode}/cancel`)
        .send({ email: booking.customerEmail })
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner 404 si le code est invalide', async () => {
      const response = await request(app)
        .post('/api/v1/bookings/AC-XXXXXX/cancel')
        .send({ email: 'test@example.com' })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/bookings/:code/reschedule - Replanification', () => {
    it('devrait replanifier une réservation vers un nouveau créneau disponible', async () => {
      // Créer une réservation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dateStr,
          time: '09:00',
          customer: {
            name: 'Test User Reschedule',
            email: 'test-management@example.com',
          },
        })
        .expect(201);

      const { booking } = createResponse.body;
      const oldStartDateTime = booking.startDateTime;

      // Replanifier vers un nouveau créneau
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      const newDateStr = dayAfterTomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post(`/api/v1/bookings/${booking.publicCode}/reschedule`)
        .send({
          email: booking.customerEmail,
          newDate: newDateStr,
          newTime: '10:00',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('booking');
      expect(response.body.booking.status).toBe('rescheduled');
      expect(response.body.booking.startDateTime).not.toBe(oldStartDateTime);
      expect(response.body).toHaveProperty('message');

      // Vérifier en base
      const bookingInDb = await knex('bookings')
        .where({ id: booking.id })
        .first();
      expect(bookingInDb.status).toBe('rescheduled');
      expect(bookingInDb.start_datetime).toContain(newDateStr);
      expect(bookingInDb.start_datetime).toContain('10:00');
    });

    it('devrait retourner 409 si le nouveau créneau est déjà occupé', async () => {
      // Créer deux réservations pour occuper un créneau
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Première réservation sur le créneau cible
      await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dateStr,
          time: '14:00',
          customer: {
            name: 'Occupant',
            email: 'occupant@example.com',
          },
        })
        .expect(201);

      // Deuxième réservation à replanifier
      const dayBefore = new Date(tomorrow);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayBeforeStr = dayBefore.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dayBeforeStr,
          time: '10:00',
          customer: {
            name: 'Test User',
            email: 'test-management@example.com',
          },
        })
        .expect(201);

      const { booking } = createResponse.body;

      // Essayer de replanifier vers le créneau occupé
      const response = await request(app)
        .post(`/api/v1/bookings/${booking.publicCode}/reschedule`)
        .send({
          email: booking.customerEmail,
          newDate: dateStr,
          newTime: '14:00', // Créneau déjà pris
        })
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('error');

      // Nettoyer
      await knex('bookings').where({ customer_email: 'occupant@example.com' }).del();
    });

    it('devrait retourner 409 si on essaie de replanifier une réservation annulée', async () => {
      // Créer et annuler une réservation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/v1/bookings')
        .send({
          serviceId: testServiceId,
          date: dateStr,
          time: '16:00',
          customer: {
            name: 'Test User',
            email: 'test-management@example.com',
          },
        })
        .expect(201);

      const { booking } = createResponse.body;

      // Annuler la réservation
      await request(app)
        .post(`/api/v1/bookings/${booking.publicCode}/cancel`)
        .send({ email: booking.customerEmail })
        .expect(200);

      // Essayer de replanifier (doit échouer)
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      const newDateStr = dayAfterTomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post(`/api/v1/bookings/${booking.publicCode}/reschedule`)
        .send({
          email: booking.customerEmail,
          newDate: newDateStr,
          newTime: '11:00',
        })
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner 404 si le code est invalide', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/v1/bookings/AC-XXXXXX/reschedule')
        .send({
          email: 'test@example.com',
          newDate: dateStr,
          newTime: '10:00',
        })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner 400 si les paramètres sont invalides', async () => {
      const response = await request(app)
        .post('/api/v1/bookings/AC-123456/reschedule')
        .send({
          email: 'test@example.com',
          newDate: 'invalid-date',
          newTime: 'invalid-time',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
