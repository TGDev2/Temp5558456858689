const express = require('express');
const { validate } = require('../middlewares/validate');
const {
  createBookingSchema,
  getBookingByCodeSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
} = require('../validators/bookingSchemas');
const {
  createBooking,
  getBookingByCode,
  cancelBooking,
  rescheduleBooking,
} = require('../controllers/bookingController');

/**
 * Routes pour les réservations et webhook Stripe
 *
 * POST /api/v1/bookings - Créer une réservation avec Payment Intent
 * POST /api/v1/bookings/webhook - Webhook Stripe pour payment_intent.succeeded
 */

/**
 * Crée le router pour les bookings
 * @param {Object} dependencies - Dépendances injectées (bookingService, bookingRepository, stripe, webhookSecret)
 * @returns {express.Router}
 */
const createBookingRoutes = (dependencies) => {
  const router = express.Router();

  // POST /api/v1/bookings - Créer une réservation
  router.post(
    '/',
    validate(createBookingSchema, 'body'),
    createBooking(dependencies)
  );

  // GET /api/v1/bookings/public - Consulter une réservation
  router.get(
    '/public',
    validate(getBookingByCodeSchema, 'query'),
    getBookingByCode(dependencies)
  );

  // POST /api/v1/bookings/:code/cancel - Annuler une réservation
  router.post(
    '/:code/cancel',
    validate(cancelBookingSchema, 'body'),
    cancelBooking(dependencies)
  );

  // POST /api/v1/bookings/:code/reschedule - Replanifier une réservation
  router.post(
    '/:code/reschedule',
    validate(rescheduleBookingSchema, 'body'),
    rescheduleBooking(dependencies)
  );

  // Note: Le webhook Stripe est configuré directement dans app.js
  // avant express.json() pour recevoir le raw body nécessaire
  // à la vérification de signature

  return router;
};

module.exports = {
  createBookingRoutes,
};
