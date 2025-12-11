const { logger } = require('../../utils/logger');

/**
 * ServiceRepository
 * Repository pattern pour l'accès aux services dans PostgreSQL
 *
 * Responsabilités :
 * - Abstraction au-dessus de Knex pour les requêtes sur la table 'services'
 * - Mapping entre le modèle de données PostgreSQL (snake_case) et les entités métier (camelCase)
 * - Gestion des erreurs avec logging approprié
 *
 * Pattern repository conforme aux spécifications techniques :
 * - Injection de dépendances (Knex instance)
 * - Retour d'entités métier typées
 * - Séparation claire entre couche persistance et couche domaine
 */
class ServiceRepository {
  constructor(knex) {
    if (!knex) {
      throw new Error(
        'ServiceRepository requires a Knex instance for database access'
      );
    }
    this.knex = knex;
    this.tableName = 'services';
  }

  /**
   * Liste tous les services actifs
   * @returns {Promise<Array>} Liste des services actifs
   */
  async listActive() {
    try {
      const services = await this.knex(this.tableName)
        .where({ is_active: true })
        .orderBy('price_cents', 'asc');

      logger.info('Active services retrieved', {
        count: services.length,
      });

      return services.map((service) => this.mapToEntity(service));
    } catch (error) {
      logger.error('Error listing active services', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Recherche un service par son identifiant
   * @param {string} serviceId - Identifiant UUID du service
   * @returns {Promise<Object|null>} Service trouvé ou null
   */
  async findById(serviceId) {
    try {
      const service = await this.knex(this.tableName)
        .where({ id: serviceId })
        .first();

      if (service) {
        logger.info('Service found by ID', { serviceId });
        return this.mapToEntity(service);
      }

      logger.warn('Service not found by ID', { serviceId });
      return null;
    } catch (error) {
      logger.error('Error finding service by ID', {
        serviceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mappe une ligne PostgreSQL (snake_case) vers une entité métier (camelCase)
   * @private
   * @param {Object} row - Ligne brute de la base de données
   * @returns {Object} Entité métier formatée
   */
  // eslint-disable-next-line class-methods-use-this
  mapToEntity(row) {
    if (!row) return null;

    return {
      id: row.id,
      artisanId: row.artisan_id,
      name: row.name,
      description: row.description,
      durationMinutes: row.duration_minutes,
      basePriceCents: row.price_cents,
      depositRate: parseFloat(row.deposit_rate), // PostgreSQL NUMERIC -> number
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { ServiceRepository };
