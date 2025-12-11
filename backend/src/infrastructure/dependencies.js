const { getKnexInstance } = require('./database');
const { ServiceRepository } = require('../domain/repositories/ServiceRepository');
const { BookingRepository } = require('../domain/repositories/BookingRepository');
const { ArtisanRepository } = require('../domain/repositories/ArtisanRepository');
const { OpeningRuleRepository } = require('../domain/repositories/OpeningRuleRepository');
const { BreakRuleRepository } = require('../domain/repositories/BreakRuleRepository');
const { ExternalBusyBlockRepository } = require('../domain/repositories/ExternalBusyBlockRepository');
const { ServiceDomainService } = require('../domain/services/ServiceDomainService');
const { SlotAvailabilityService } = require('../domain/services/SlotAvailabilityService');

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

  // Initialisation des repositories
  const serviceRepository = new ServiceRepository(knex);
  const bookingRepository = new BookingRepository(knex);
  const artisanRepository = new ArtisanRepository(knex);
  const openingRuleRepository = new OpeningRuleRepository(knex);
  const breakRuleRepository = new BreakRuleRepository(knex);
  const externalBusyBlockRepository = new ExternalBusyBlockRepository(knex);

  // Initialisation des services métier
  const serviceDomainService = new ServiceDomainService(serviceRepository);

  const slotAvailabilityService = new SlotAvailabilityService({
    openingRuleRepository,
    breakRuleRepository,
    bookingRepository,
    externalBusyBlockRepository,
  });

  dependencies = {
    knex,
    repositories: {
      serviceRepository,
      bookingRepository,
      artisanRepository,
      openingRuleRepository,
      breakRuleRepository,
      externalBusyBlockRepository,
    },
    services: {
      serviceDomainService,
      slotAvailabilityService,
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
