const { logger } = require('../../utils/logger');

/**
 * ServiceController
 * Contrôleur HTTP pour les endpoints liés aux services
 * Responsabilité : validation requête, appel service métier, sérialisation réponse
 */

/**
 * Transforme une entité Service métier en DTO exposé par l'API
 * Conforme au contrat défini dans domain-model.md
 * @param {Object} service - Entité service métier
 * @returns {Object} DTO service pour l'API
 */
const toServiceDTO = (service) => ({
  id: service.id,
  name: service.name,
  description: service.description || '',
  durationMinutes: service.durationMinutes,
  basePriceCents: service.basePriceCents,
  depositRate: service.depositRate,
  isActive: service.isActive,
});

/**
 * GET /api/v1/services
 * Liste tous les services actifs proposés par l'artisan
 *
 * Réponse 200 OK :
 * {
 *   "services": [
 *     {
 *       "id": "uuid-service-1",
 *       "name": "Diagnostic et audit complet",
 *       "description": "...",
 *       "durationMinutes": 30,
 *       "basePriceCents": 4000,
 *       "depositRate": 0.3,
 *       "isActive": true
 *     }
 *   ]
 * }
 */
const createListServicesHandler = (serviceDomainService) => async (_req, res, next) => {
  try {
    logger.info('GET /api/v1/services - Consultation des services actifs');

    const services = await serviceDomainService.listActiveServices();

    const response = {
      services: services.map(toServiceDTO),
    };

    logger.info(
      `GET /api/v1/services - ${services.length} services retournés`
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error('Erreur lors de la liste des services', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

module.exports = {
  createListServicesHandler,
};
