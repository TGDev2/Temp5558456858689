const Joi = require('joi');

/**
 * Schéma de validation pour les paramètres de requête de l'endpoint GET /services
 * Pour le MVP, aucun paramètre n'est requis (liste complète des services actifs)
 */
const listServicesQuerySchema = Joi.object({
  // Réservé pour extensions futures (filtrage par catégorie, pagination, etc.)
}).unknown(false);

module.exports = {
  listServicesQuerySchema,
};
