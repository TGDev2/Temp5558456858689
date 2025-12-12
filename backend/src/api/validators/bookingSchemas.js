const Joi = require('joi');

/**
 * Schémas de validation pour l'endpoint POST /api/v1/bookings
 *
 * Règles de validation :
 * - serviceId : UUID v4 valide requis
 * - date : Date au format ISO 8601 (YYYY-MM-DD) requise et non antérieure à aujourd'hui
 * - time : Heure au format HH:MM requise
 * - customer : Objet requis contenant name et email
 * - notifications : Objet optionnel pour les préférences de notifications
 */

const createBookingSchema = Joi.object({
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
      today.setHours(0, 0, 0, 0);

      if (requestedDate < today) {
        return helpers.error('date.past');
      }

      return value;
    })
    .messages({
      'string.isoDate': 'date doit être au format YYYY-MM-DD',
      'any.required': 'date est requise',
      'date.past': 'date ne peut pas être antérieure à aujourd\'hui',
    }),

  time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'time doit être au format HH:MM',
      'any.required': 'time est requis',
    }),

  customer: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'customer.name doit contenir au moins 2 caractères',
        'string.max': 'customer.name ne peut pas dépasser 100 caractères',
        'any.required': 'customer.name est requis',
      }),

    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'customer.email doit être une adresse email valide',
        'any.required': 'customer.email est requis',
      }),

    phone: Joi.string()
      .pattern(/^(\+33|0)[1-9](\d{2}){4}$/)
      .optional()
      .allow(null, '')
      .messages({
        'string.pattern.base': 'customer.phone doit être un numéro de téléphone français valide',
      }),
  }).required()
    .messages({
      'any.required': 'customer est requis',
    }),

  notifications: Joi.object({
    email: Joi.boolean()
      .optional()
      .default(true),

    sms: Joi.boolean()
      .optional()
      .default(false),
  }).optional(),
});

module.exports = {
  createBookingSchema,
};
