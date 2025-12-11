const { getKnexInstance } = require('./database');
const { ServiceRepository } = require('../domain/repositories/ServiceRepository');
const { BookingRepository } = require('../domain/repositories/BookingRepository');
const { ServiceDomainService } = require('../domain/services/ServiceDomainService');

/**
 * Module d'initialisation des dépendances
 * Responsabilité : câblage des dépendances entre les couches (IoC manuel)
 *
 * Pattern Dependency Injection :
 * - Infrastructure → Repositories
 * - Repositories → Domain Services
 * - Domain Services → Controllers
 */

let dependencies = null;

/**
 * Initialise et retourne l'arbre de dépendances de l'application
 * Utilise un singleton pour éviter de réinstancier à chaque appel
 * @returns {Object} Conteneur de dépendances
 */
const initializeDependencies = () => {
  if (dependencies) {
    return dependencies;
  }

  const knex = getKnexInstance();

  const serviceRepository = new ServiceRepository(knex);
  const bookingRepository = new BookingRepository(knex);

  const serviceDomainService = new ServiceDomainService(serviceRepository);

  dependencies = {
    knex,
    repositories: {
      serviceRepository,
      bookingRepository,
    },
    services: {
      serviceDomainService,
    },
  };

  return dependencies;
};

/**
 * Récupère les dépendances initialisées
 * @returns {Object} Conteneur de dépendances
 */
const getDependencies = () => {
  if (!dependencies) {
    throw new Error(
      'Dependencies not initialized. Call initializeDependencies() first.'
    );
  }
  return dependencies;
};

module.exports = {
  initializeDependencies,
  getDependencies,
};
