const { logger } = require('../../utils/logger');

/**
 * AvailabilityController
 * Contrôleur HTTP pour l'endpoint GET /api/v1/availability
 *
 * Responsabilités :
 * - Validation des paramètres de requête (serviceId, date)
 * - Orchestration des services métier (ServiceRepository, SlotAvailabilityService)
 * - Sérialisation de la réponse JSON conforme au contrat domain-model.md
 * - Gestion des erreurs HTTP (400, 404, 500)
 *
 * Endpoint : GET /api/v1/availability?serviceId={uuid}&date={YYYY-MM-DD}
 */

/**
 * Récupère les créneaux disponibles pour un service et une date donnés
 *
 * @param {Object} req - Requête Express
 * @param {Object} req.query - Paramètres de requête
 * @param {string} req.query.serviceId - Identifiant UUID du service
 * @param {string} req.query.date - Date au format YYYY-MM-DD
 * @param {Object} res - Réponse Express
 * @param {Function} next - Middleware suivant
 * @returns {Promise<void>}
 */
const getAvailability = (dependencies) => async (req, res, next) => {
    try {
      const { serviceId, date } = req.query;

      logger.info('GET /api/v1/availability - Request received', {
        serviceId,
        date,
      });

      const { serviceRepository, slotAvailabilityService } = dependencies;

      // 1. Vérifier que le service existe et est actif
      const service = await serviceRepository.findById(serviceId);

      if (!service) {
        logger.warn('Service not found', { serviceId });
        return res.status(404).json({
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: 'Le service demandé n\'existe pas ou n\'est pas actif.',
          },
        });
      }

      if (!service.isActive) {
        logger.warn('Service is inactive', { serviceId });
        return res.status(404).json({
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: 'Le service demandé n\'existe pas ou n\'est pas actif.',
          },
        });
      }

      // 2. Générer les créneaux disponibles via le service métier
      const availability =
        await slotAvailabilityService.generateAvailableSlots(
          service.artisanId,
          serviceId,
          service.durationMinutes,
          date
        );

      // 3. Vérifier si des horaires d'ouverture existent pour ce jour
      if (!availability.opening) {
        logger.info('No opening hours for this day', {
          serviceId,
          date,
          artisanId: service.artisanId,
        });
        return res.status(200).json({
          serviceId,
          date,
          opening: null,
          slots: [],
        });
      }

      // 4. Retourner la réponse conforme au contrat domain-model.md
      logger.info('Availability calculated successfully', {
        serviceId,
        date,
        totalSlots: availability.slots.length,
        availableSlots: availability.slots.filter((s) => s.available).length,
      });

      return res.status(200).json({
        serviceId: availability.serviceId,
        date: availability.date,
        opening: {
          startMinutes: availability.opening.startMinutes,
          endMinutes: availability.opening.endMinutes,
          breakStartMinutes: availability.opening.breakStartMinutes,
          breakEndMinutes: availability.opening.breakEndMinutes,
        },
        slots: availability.slots.map((slot) => ({
          time: slot.time,
          available: slot.available,
          blockedBy: slot.blockedBy.map((blocker) => {
            // Normaliser la structure des blockers selon le contrat
            const normalized = {
              type: blocker.type,
            };

            if (blocker.type === 'calendar') {
              normalized.providerId = blocker.providerId;
              normalized.summary = blocker.summary;
            } else if (blocker.type === 'booking') {
              normalized.bookingPublicCode = blocker.bookingPublicCode;
              normalized.summary = blocker.summary;
            } else if (blocker.type === 'break') {
              normalized.summary = blocker.summary;
            }

            return normalized;
          }),
        })),
      });
    } catch (error) {
      logger.error('Error in getAvailability controller', {
        serviceId: req.query.serviceId,
        date: req.query.date,
        error: error.message,
        stack: error.stack,
      });

      // Passer l'erreur au middleware de gestion d'erreurs global
      return next(error);
    }
  };

module.exports = {
  getAvailability,
};
