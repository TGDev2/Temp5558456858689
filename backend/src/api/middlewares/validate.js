const { logger } = require('../../utils/logger');

/**
 * Middleware générique de validation Joi
 * Valide req.query, req.body ou req.params selon le schéma fourni
 *
 * @param {Joi.Schema} schema - Schéma Joi de validation
 * @param {string} source - Source à valider ('query', 'body', 'params')
 * @returns {Function} Middleware Express
 */
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Retourner toutes les erreurs, pas seulement la première
      stripUnknown: true, // Supprimer les champs inconnus du schéma
    });

    if (error) {
      const details = error.details.map((detail) => detail.message).join(', ');

      logger.warn('Validation échouée', {
        source,
        errors: details,
        url: req.url,
        method: req.method,
      });

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Données invalides : ${details}`,
        },
      });
    }

    // Remplacer les données validées (débarrassées des champs inconnus)
    req[source] = value;

    return next();
  };

module.exports = { validate };
