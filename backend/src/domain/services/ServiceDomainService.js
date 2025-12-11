const { logger } = require('../../utils/logger');

/**
 * ServiceDomainService
 * Couche métier pour la gestion des services proposés par l'artisan
 *
 * Responsabilités :
 * - Orchestration de la logique métier liée aux services
 * - Appel au ServiceRepository pour l'accès aux données
 * - Application des règles métier (filtrage, validation, transformation)
 * - Abstraction de la persistance vis-à-vis de la couche API
 *
 * Pattern : Service métier avec injection de dépendances (Repository)
 */
class ServiceDomainService {
  constructor(serviceRepository) {
    if (!serviceRepository) {
      throw new Error(
        'ServiceDomainService requires a ServiceRepository instance'
      );
    }
    this.serviceRepository = serviceRepository;
  }

  /**
   * Liste tous les services actifs pour l'artisan
   * @returns {Promise<Array>} Liste des services actifs
   */
  async listActiveServices() {
    try {
      logger.info('ServiceDomainService: listing active services');
      const services = await this.serviceRepository.listActive();
      logger.info(
        `ServiceDomainService: ${services.length} active services found`
      );
      return services;
    } catch (error) {
      logger.error('ServiceDomainService: error listing active services', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Récupère un service par son identifiant
   * @param {string} serviceId - Identifiant UUID du service
   * @returns {Promise<Object|null>} Service trouvé ou null
   */
  async getServiceById(serviceId) {
    try {
      logger.info('ServiceDomainService: fetching service by ID', {
        serviceId,
      });
      const service = await this.serviceRepository.findById(serviceId);
      if (service) {
        logger.info('ServiceDomainService: service found', { serviceId });
      } else {
        logger.warn('ServiceDomainService: service not found', { serviceId });
      }
      return service;
    } catch (error) {
      logger.error('ServiceDomainService: error fetching service by ID', {
        serviceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calcule le montant de l'acompte pour un service donné
   * Règle métier : acompte = prix de base × taux d'acompte
   * @param {Object} service - Entité service
   * @returns {number} Montant de l'acompte en centimes
   */
  // eslint-disable-next-line class-methods-use-this
  calculateDepositAmount(service) {
    if (!service || !service.basePriceCents || !service.depositRate) {
      throw new Error('Invalid service data for deposit calculation');
    }
    return Math.round(service.basePriceCents * service.depositRate);
  }
}

module.exports = { ServiceDomainService };
