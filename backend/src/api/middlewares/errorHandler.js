const { logger } = require('../../utils/logger');

/**
 * Middleware global de gestion des erreurs
 * Capture toutes les erreurs non gérées et renvoie une réponse JSON cohérente
 */
const errorHandler = (err, req, res, _next) => {
  // Log de l'erreur côté serveur avec stack trace complète
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Déterminer le code HTTP à renvoyer
  const statusCode = err.httpStatus || err.statusCode || err.status || 500;

  // En production, on masque les détails techniques des erreurs 500
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Une erreur interne est survenue.'
      : err.message || 'Une erreur est survenue.';

  // Réponse JSON standardisée
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
    },
  });
};

module.exports = { errorHandler };
