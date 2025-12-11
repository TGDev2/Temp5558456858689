const Joi = require('joi');

/**
 * Schéma de validation pour les paramètres de requête de l'endpoint availability
 *
 * Règles de validation :
 * - serviceId : UUID v4 valide requis
 * - date : Date au format ISO 8601 (YYYY-MM-DD) requise et non antérieure à aujourd'hui
 *
 * Conformité : domain-model.md - Section "Disponibilités pour un service et une date"
 */
const getAvailabilityQuerySchema = Joi.object({
  serviceId: Joi.string()
    .uuid({ version: 'uuidv4' })
    .required()
    .messages({
      'string.guid': 'serviceId doit être un UUID valide',
      'any.required': 'serviceId est requis',
    }),

  date: Joi.string()
    .isoDate()
    .required()
    .custom((value, helpers) => {
      // Vérifier que la date n'est pas dans le passé
      const requestedDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Début de la journée

      if (requestedDate < today) {
        return helpers.error('date.past');
      }

      return value;
    })
    .messages({
      'string.isoDate': 'date doit être au format YYYY-MM-DD',
      'any.required': 'date est requise',
      'date.past':
        'date ne peut pas être antérieure à aujourd\'hui',
    }),
});

module.exports = {
  getAvailabilityQuerySchema,
};
