const { logger } = require('../../utils/logger');

/**
 * BookingController
 * Contrôleur HTTP pour l'endpoint POST /api/v1/bookings
 *
 * Responsabilités :
 * - Orchestration de BookingService.createBooking pour créer la réservation
 * - Génération du Payment Intent Stripe pour l'acompte
 * - Retour du clientSecret au front pour finalisation du paiement
 * - Gestion des erreurs HTTP (400, 404, 500)
 *
 * Flow :
 * 1. Créer la réservation en statut "confirmed" avec depositPaymentStatus "pending"
 * 2. Créer un Payment Intent Stripe pour le montant d'acompte
 * 3. Mettre à jour la réservation avec le depositPaymentIntentId
 * 4. Retourner la réservation + clientSecret au front
 */

/**
 * Crée une nouvelle réservation avec Payment Intent Stripe
 *
 * @param {Object} req - Requête Express
 * @param {Object} req.body - Corps de la requête
 * @param {string} req.body.serviceId - UUID du service
 * @param {string} req.body.date - Date au format YYYY-MM-DD
 * @param {string} req.body.time - Heure au format HH:MM
 * @param {Object} req.body.customer - Infos client (name, email, phone?)
 * @param {Object} [req.body.notifications] - Préférences notifications
 * @param {Object} res - Réponse Express
 * @param {Function} next - Middleware suivant
 * @returns {Promise<void>}
 */
const createBooking = (dependencies) => async (req, res, next) => {
    try {
      const { serviceId, date, time, customer, notifications } = req.body;

      logger.info('POST /api/v1/bookings - Request received', {
        serviceId,
        date,
        time,
        customerEmail: customer.email,
      });

      const { bookingService, bookingRepository, stripe } = dependencies;

      // 1. Créer la réservation via BookingService
      const booking = await bookingService.createBooking({
        serviceId,
        date,
        time,
        customer,
        notifications,
      });

      logger.info('Booking created, creating Stripe Payment Intent', {
        bookingId: booking.id,
        publicCode: booking.publicCode,
        depositAmountCents: booking.depositAmountCents,
      });

      // 2. Créer le Payment Intent Stripe pour l'acompte
      const paymentIntent = await stripe.paymentIntents.create({
        amount: booking.depositAmountCents,
        currency: 'eur',
        metadata: {
          bookingId: booking.id.toString(),
          bookingCode: booking.publicCode,
          customerEmail: customer.email,
          customerName: customer.name,
        },
        description: `Acompte pour réservation ${booking.publicCode}`,
        receipt_email: customer.email,
      });

      logger.info('Stripe Payment Intent created', {
        bookingId: booking.id,
        paymentIntentId: paymentIntent.id,
      });

      // 3. Mettre à jour la réservation avec le Payment Intent ID
      const updatedBooking = await bookingRepository.update(booking.id, {
        deposit_payment_intent_id: paymentIntent.id,
        deposit_payment_provider: 'stripe',
      });

      logger.info('Booking updated with Payment Intent ID', {
        bookingId: booking.id,
        paymentIntentId: paymentIntent.id,
      });

      // 4. Retourner la réservation + clientSecret
      return res.status(201).json({
        booking: {
          id: updatedBooking.id,
          publicCode: updatedBooking.publicCode,
          serviceId: updatedBooking.serviceId,
          status: updatedBooking.status,
          customerName: updatedBooking.customerName,
          customerEmail: updatedBooking.customerEmail,
          startDateTime: updatedBooking.startDateTime,
          durationMinutes: updatedBooking.durationMinutes,
          priceCents: updatedBooking.priceCents,
          depositAmountCents: updatedBooking.depositAmountCents,
          depositPaymentStatus: updatedBooking.depositPaymentStatus,
          createdAt: updatedBooking.createdAt,
        },
        payment: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        },
      });
    } catch (error) {
      logger.error('Error in createBooking controller', {
        serviceId: req.body?.serviceId,
        date: req.body?.date,
        time: req.body?.time,
        error: error.message,
        stack: error.stack,
      });

      // Passer l'erreur au middleware de gestion d'erreurs global
      return next(error);
    }
  };

/**
 * Webhook handler pour les événements Stripe
 * Gère spécifiquement payment_intent.succeeded pour mettre à jour le statut de paiement
 *
 * @param {Object} req - Requête Express
 * @param {Object} req.body - Corps de la requête (payload Stripe)
 * @param {string} req.headers['stripe-signature'] - Signature Stripe pour vérification
 * @param {Object} res - Réponse Express
 * @param {Function} next - Middleware suivant
 * @returns {Promise<void>}
 */
const handleStripeWebhook = (dependencies) => async (req, res, next) => {
    const signature = req.headers['stripe-signature'];

    try {
      const { stripe, bookingRepository, webhookSecret } = dependencies;

      logger.info('Stripe webhook received', {
        signature: signature ? 'present' : 'missing',
      });

      // 1. Vérifier la signature Stripe pour sécuriser le webhook
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          webhookSecret
        );
      } catch (err) {
        logger.error('Stripe webhook signature verification failed', {
          error: err.message,
        });
        return res.status(400).json({
          error: {
            code: 'WEBHOOK_SIGNATURE_INVALID',
            message: 'Invalid webhook signature',
          },
        });
      }

      logger.info('Stripe webhook verified', {
        eventType: event.type,
        eventId: event.id,
      });

      // 2. Traiter l'événement payment_intent.succeeded
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        logger.info('Processing payment_intent.succeeded', {
          paymentIntentId: paymentIntent.id,
          bookingCode: paymentIntent.metadata.bookingCode,
        });

        // 3. Mettre à jour le statut de paiement de la réservation
        const updatedBooking = await bookingRepository.updatePaymentStatus(
          paymentIntent.id,
          'captured'
        );

        if (!updatedBooking) {
          logger.warn('Booking not found for payment intent', {
            paymentIntentId: paymentIntent.id,
          });
          return res.status(404).json({
            error: {
              code: 'BOOKING_NOT_FOUND',
              message: 'Booking not found for this payment intent',
            },
          });
        }

        logger.info('Booking payment status updated to captured', {
          bookingId: updatedBooking.id,
          publicCode: updatedBooking.publicCode,
          paymentIntentId: paymentIntent.id,
        });

        return res.status(200).json({ received: true });
      }

      // 4. Ignorer les autres types d'événements
      logger.info('Unhandled webhook event type', {
        eventType: event.type,
      });

      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Error in handleStripeWebhook', {
        error: error.message,
        stack: error.stack,
      });

      return next(error);
    }
  };

/**
 * Récupère une réservation par son code public et l'email du client
 *
 * @param {Object} req - Requête Express
 * @param {Object} req.query - Paramètres de requête
 * @param {string} req.query.code - Code public de la réservation (AC-XXXXXX)
 * @param {string} req.query.email - Email du client
 * @param {Object} res - Réponse Express
 * @param {Function} next - Middleware suivant
 * @returns {Promise<void>}
 */
const getBookingByCode = (dependencies) => async (req, res, next) => {
    try {
      const { code, email } = req.query;

      logger.info('GET /api/v1/bookings/public - Request received', {
        code,
        email,
      });

      const { bookingService } = dependencies;

      // Récupérer la réservation via BookingService
      const booking = await bookingService.findByCodeAndEmail(code, email);

      logger.info('Booking retrieved successfully', {
        bookingId: booking.id,
        publicCode: booking.publicCode,
      });

      // Retourner la réservation
      return res.status(200).json({
        booking: {
          id: booking.id,
          publicCode: booking.publicCode,
          status: booking.status,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          startDateTime: booking.startDateTime,
          durationMinutes: booking.durationMinutes,
          priceCents: booking.priceCents,
          depositAmountCents: booking.depositAmountCents,
          depositPaymentStatus: booking.depositPaymentStatus,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error in getBookingByCode controller', {
        code: req.query?.code,
        error: error.message,
        stack: error.stack,
      });

      return next(error);
    }
  };

/**
 * Annule une réservation
 *
 * @param {Object} req - Requête Express
 * @param {Object} req.params - Paramètres de route
 * @param {string} req.params.code - Code public de la réservation
 * @param {Object} req.body - Corps de la requête
 * @param {string} req.body.email - Email du client pour authentification
 * @param {Object} res - Réponse Express
 * @param {Function} next - Middleware suivant
 * @returns {Promise<void>}
 */
const cancelBooking = (dependencies) => async (req, res, next) => {
    try {
      const { code } = req.params;
      const { email } = req.body;

      logger.info('POST /api/v1/bookings/:code/cancel - Request received', {
        code,
        email,
      });

      const { bookingService } = dependencies;

      // Annuler la réservation via BookingService
      const cancelledBooking = await bookingService.cancelBooking(code, email);

      logger.info('Booking cancelled successfully', {
        bookingId: cancelledBooking.id,
        publicCode: cancelledBooking.publicCode,
      });

      // Retourner la réservation annulée
      return res.status(200).json({
        booking: {
          id: cancelledBooking.id,
          publicCode: cancelledBooking.publicCode,
          status: cancelledBooking.status,
          customerName: cancelledBooking.customerName,
          customerEmail: cancelledBooking.customerEmail,
          startDateTime: cancelledBooking.startDateTime,
          durationMinutes: cancelledBooking.durationMinutes,
          updatedAt: cancelledBooking.updatedAt,
        },
        message: 'Réservation annulée avec succès.',
      });
    } catch (error) {
      logger.error('Error in cancelBooking controller', {
        code: req.params?.code,
        error: error.message,
        stack: error.stack,
      });

      return next(error);
    }
  };

/**
 * Replanifie une réservation vers une nouvelle date/heure
 *
 * @param {Object} req - Requête Express
 * @param {Object} req.params - Paramètres de route
 * @param {string} req.params.code - Code public de la réservation
 * @param {Object} req.body - Corps de la requête
 * @param {string} req.body.email - Email du client pour authentification
 * @param {string} req.body.newDate - Nouvelle date (YYYY-MM-DD)
 * @param {string} req.body.newTime - Nouvelle heure (HH:MM)
 * @param {Object} res - Réponse Express
 * @param {Function} next - Middleware suivant
 * @returns {Promise<void>}
 */
const rescheduleBooking = (dependencies) => async (req, res, next) => {
    try {
      const { code } = req.params;
      const { email, newDate, newTime } = req.body;

      logger.info('POST /api/v1/bookings/:code/reschedule - Request received', {
        code,
        email,
        newDate,
        newTime,
      });

      const { bookingService } = dependencies;

      // Replanifier la réservation via BookingService
      const rescheduledBooking = await bookingService.rescheduleBooking(
        code,
        email,
        { newDate, newTime }
      );

      logger.info('Booking rescheduled successfully', {
        bookingId: rescheduledBooking.id,
        publicCode: rescheduledBooking.publicCode,
        newStartDateTime: rescheduledBooking.startDateTime,
      });

      // Retourner la réservation replanifiée
      return res.status(200).json({
        booking: {
          id: rescheduledBooking.id,
          publicCode: rescheduledBooking.publicCode,
          status: rescheduledBooking.status,
          customerName: rescheduledBooking.customerName,
          customerEmail: rescheduledBooking.customerEmail,
          startDateTime: rescheduledBooking.startDateTime,
          durationMinutes: rescheduledBooking.durationMinutes,
          updatedAt: rescheduledBooking.updatedAt,
        },
        message: 'Réservation replanifiée avec succès.',
      });
    } catch (error) {
      logger.error('Error in rescheduleBooking controller', {
        code: req.params?.code,
        newDate: req.body?.newDate,
        newTime: req.body?.newTime,
        error: error.message,
        stack: error.stack,
      });

      return next(error);
    }
  };

module.exports = {
  createBooking,
  handleStripeWebhook,
  getBookingByCode,
  cancelBooking,
  rescheduleBooking,
};
