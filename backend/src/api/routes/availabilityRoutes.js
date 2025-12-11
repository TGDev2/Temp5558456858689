const express = require('express');
const { getAvailability } = require('../controllers/availabilityController');
const { validate } = require('../middlewares/validate');
const { getAvailabilityQuerySchema } = require('../validators/availabilitySchemas');

/**
 * Routes pour l'endpoint availability
 * Endpoint : GET /api/v1/availability
 *
 * Responsabilités :
 * - Configuration du routeur Express
 * - Application du middleware de validation Joi
 * - Liaison avec le contrôleur availabilityController
 *
 * Pattern : Injection de dépendances via factory function
 */

const createAvailabilityRoutes = (dependencies) => {
  const router = express.Router();

  /**
   * GET /api/v1/availability
   *
   * Récupère les créneaux disponibles pour un service et une date donnés
   *
   * Query params:
   *   - serviceId: UUID du service (requis)
   *   - date: Date au format YYYY-MM-DD (requis, non antérieure à aujourd'hui)
   *
   * Réponses:
   *   200 OK - Créneaux calculés avec succès
   *   400 Bad Request - Paramètres invalides
   *   404 Not Found - Service inexistant ou inactif
   *   500 Internal Server Error - Erreur serveur
   *
   * Exemple:
   *   GET /api/v1/availability?serviceId=123e4567-e89b-12d3-a456-426614174000&date=2025-01-15
   */
  router.get(
    '/',
    validate(getAvailabilityQuerySchema, 'query'),
    getAvailability(dependencies)
  );

  return router;
};

module.exports = { createAvailabilityRoutes };
