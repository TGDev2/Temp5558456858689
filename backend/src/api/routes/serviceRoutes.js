const express = require('express');
const { listServices } = require('../controllers/serviceController');
const { validate } = require('../middlewares/validate');
const { listServicesQuerySchema } = require('../validators/serviceSchemas');

const router = express.Router();

/**
 * GET /api/v1/services
 * Liste tous les services actifs proposés par l'artisan
 *
 * Query params: aucun pour le MVP
 *
 * Réponse 200 OK:
 * {
 *   "services": [
 *     {
 *       "id": "diag",
 *       "name": "Diagnostic et audit complet",
 *       "description": "...",
 *       "durationMinutes": 30,
 *       "basePriceCents": 4000,
 *       "depositRate": 0.3,
 *       "isActive": true
 *     }
 *   ]
 * }
 *
 * Réponse 500 Internal Server Error:
 * {
 *   "error": {
 *     "code": "INTERNAL_ERROR",
 *     "message": "Une erreur est survenue."
 *   }
 * }
 */
router.get('/', validate(listServicesQuerySchema, 'query'), listServices);

module.exports = router;
