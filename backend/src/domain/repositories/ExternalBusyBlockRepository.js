const { logger } = require('../../utils/logger');

/**
 * ExternalBusyBlockRepository
 * Repository pour l'accès aux indisponibilités externes (calendriers) et internes (réservations)
 */
class ExternalBusyBlockRepository {
  constructor(knex) {
    if (!knex) {
      throw new Error(
        'ExternalBusyBlockRepository requires a Knex instance for database access'
      );
    }
    this.knex = knex;
    this.tableName = 'external_busy_blocks';
  }

  /**
   * Récupère toutes les indisponibilités d'un artisan pour une plage de dates
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @param {Date} startDate - Date de début de la plage
   * @param {Date} endDate - Date de fin de la plage
   * @returns {Promise<Array>} Liste des indisponibilités
   */
  async findByArtisanAndDateRange(artisanId, startDate, endDate) {
    try {
      const blocks = await this.knex(this.tableName)
        .where({ artisan_id: artisanId })
        .where((builder) => {
          // Récupère les blocs qui chevauchent la plage [startDate, endDate]
          builder
            .where('start_datetime', '<', endDate)
            .andWhere('end_datetime', '>', startDate);
        })
        .orderBy('start_datetime', 'asc');

      logger.info('External busy blocks retrieved', {
        artisanId,
        startDate,
        endDate,
        count: blocks.length,
      });

      return blocks.map((block) => this.mapToEntity(block));
    } catch (error) {
      logger.error('Error finding external busy blocks by date range', {
        artisanId,
        startDate,
        endDate,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Récupère les indisponibilités externes (importées depuis calendriers) pour une plage de dates
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @param {Date} startDate - Date de début de la plage
   * @param {Date} endDate - Date de fin de la plage
   * @returns {Promise<Array>} Liste des indisponibilités externes
   */
  async findExternalByArtisanAndDateRange(artisanId, startDate, endDate) {
    try {
      const blocks = await this.knex(this.tableName)
        .where({ artisan_id: artisanId, source: 'external' })
        .where((builder) => {
          builder
            .where('start_datetime', '<', endDate)
            .andWhere('end_datetime', '>', startDate);
        })
        .orderBy('start_datetime', 'asc');

      return blocks.map((block) => this.mapToEntity(block));
    } catch (error) {
      logger.error('Error finding external busy blocks', {
        artisanId,
        startDate,
        endDate,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Crée une nouvelle indisponibilité
   * @param {Object} blockData - Données de l'indisponibilité
   * @returns {Promise<Object>} Indisponibilité créée
   */
  async create(blockData) {
    try {
      const [block] = await this.knex(this.tableName)
        .insert({
          artisan_id: blockData.artisanId,
          provider_id: blockData.providerId,
          source: blockData.source,
          summary: blockData.summary || null,
          start_datetime: blockData.startDateTime,
          end_datetime: blockData.endDateTime,
          booking_id: blockData.bookingId || null,
          external_event_id: blockData.externalEventId || null,
        })
        .returning('*');

      logger.info('External busy block created', {
        blockId: block.id,
        artisanId: blockData.artisanId,
        source: blockData.source,
      });

      return this.mapToEntity(block);
    } catch (error) {
      logger.error('Error creating external busy block', {
        error: error.message,
        blockData,
      });
      throw error;
    }
  }

  /**
   * Supprime les indisponibilités externes d'un artisan pour un provider donné
   * Utilisé lors de la synchronisation pour nettoyer les anciennes données avant réimport
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @param {string} providerId - Identifiant du provider (google, outlook, apple)
   * @param {string} source - Type de source ('external' ou 'booking')
   * @returns {Promise<number>} Nombre de lignes supprimées
   */
  async deleteByArtisanAndProvider(artisanId, providerId, source) {
    try {
      const deletedCount = await this.knex(this.tableName)
        .where({
          artisan_id: artisanId,
          provider_id: providerId,
          source,
        })
        .delete();

      logger.info('External busy blocks deleted', {
        artisanId,
        providerId,
        source,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Error deleting external busy blocks', {
        artisanId,
        providerId,
        source,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Supprime une indisponibilité par son ID de réservation
   * @param {string} bookingId - Identifiant UUID de la réservation
   * @returns {Promise<number>} Nombre de lignes supprimées
   */
  async deleteByBookingId(bookingId) {
    try {
      const deletedCount = await this.knex(this.tableName)
        .where({ booking_id: bookingId })
        .delete();

      logger.info('External busy blocks deleted by booking ID', {
        bookingId,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Error deleting external busy blocks by booking ID', {
        bookingId,
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
      artisanId: row.artisan_id,
      providerId: row.provider_id,
      source: row.source,
      summary: row.summary,
      startDateTime: row.start_datetime,
      endDateTime: row.end_datetime,
      bookingId: row.booking_id,
      externalEventId: row.external_event_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { ExternalBusyBlockRepository };
