const { logger } = require('../../utils/logger');

/**
 * ArtisanRepository
 * Repository pour l'accès aux données des artisans
 */
class ArtisanRepository {
  constructor(knex) {
    if (!knex) {
      throw new Error(
        'ArtisanRepository requires a Knex instance for database access'
      );
    }
    this.knex = knex;
    this.tableName = 'artisans';
  }

  /**
   * Recherche un artisan par son identifiant
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @returns {Promise<Object|null>} Artisan trouvé ou null
   */
  async findById(artisanId) {
    try {
      const artisan = await this.knex(this.tableName)
        .where({ id: artisanId })
        .first();

      if (artisan) {
        logger.info('Artisan found by ID', { artisanId });
        return this.mapToEntity(artisan);
      }

      logger.warn('Artisan not found by ID', { artisanId });
      return null;
    } catch (error) {
      logger.error('Error finding artisan by ID', {
        artisanId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Liste tous les artisans actifs
   * @returns {Promise<Array>} Liste des artisans actifs
   */
  async listActive() {
    try {
      const artisans = await this.knex(this.tableName).where({
        is_active: true,
      });

      logger.info('Active artisans retrieved', {
        count: artisans.length,
      });

      return artisans.map((artisan) => this.mapToEntity(artisan));
    } catch (error) {
      logger.error('Error listing active artisans', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mappe une ligne PostgreSQL vers une entité métier
   * @private
   * @param {Object} row - Ligne brute de la base de données
   * @returns {Object} Entité métier formatée
   */
  // eslint-disable-next-line class-methods-use-this
  mapToEntity(row) {
    if (!row) return null;

    return {
      id: row.id,
      businessName: row.business_name,
      email: row.email,
      phone: row.phone,
      description: row.description,
      address: row.address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { ArtisanRepository };
