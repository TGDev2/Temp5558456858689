const express = require('express');
const {
  createListServicesHandler,
} = require('../controllers/serviceController');

/**
 * Crée le routeur pour les endpoints liés aux services
 * @param {Object} serviceDomainService - Instance du service métier ServiceDomainService
 * @returns {express.Router} Routeur Express configuré
 */
const createServiceRouter = (serviceDomainService) => {
  const router = express.Router();

  const listServicesHandler = createListServicesHandler(serviceDomainService);

  router.get('/', listServicesHandler);

  return router;
};

module.exports = { createServiceRouter };
