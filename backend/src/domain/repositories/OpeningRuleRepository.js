const { logger } = require('../../utils/logger');

/**
 * OpeningRuleRepository
 * Repository pour l'accès aux règles d'horaires d'ouverture des artisans
 */
class OpeningRuleRepository {
  constructor(knex) {
    if (!knex) {
      throw new Error(
        'OpeningRuleRepository requires a Knex instance for database access'
      );
    }
    this.knex = knex;
    this.tableName = 'opening_rules';
  }

  /**
   * Récupère toutes les règles d'ouverture d'un artisan
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @returns {Promise<Array>} Liste des règles d'ouverture
   */
  async findByArtisan(artisanId) {
    try {
      const rules = await this.knex(this.tableName)
        .where({ artisan_id: artisanId })
        .orderBy('day_of_week', 'asc');

      logger.info('Opening rules retrieved', {
        artisanId,
        count: rules.length,
      });

      return rules.map((rule) => this.mapToEntity(rule));
    } catch (error) {
      logger.error('Error finding opening rules by artisan', {
        artisanId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Récupère la règle d'ouverture pour un jour spécifique
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @param {number} dayOfWeek - Jour de la semaine (0=dimanche, 6=samedi)
   * @returns {Promise<Object|null>} Règle d'ouverture ou null
   */
  async findByArtisanAndDay(artisanId, dayOfWeek) {
    try {
      const rule = await this.knex(this.tableName)
        .where({ artisan_id: artisanId, day_of_week: dayOfWeek })
        .first();

      return rule ? this.mapToEntity(rule) : null;
    } catch (error) {
      logger.error('Error finding opening rule by artisan and day', {
        artisanId,
        dayOfWeek,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Crée une nouvelle règle d'ouverture
   * @param {Object} ruleData - Données de la règle
   * @returns {Promise<Object>} Règle créée
   */
  async create(ruleData) {
    try {
      const [rule] = await this.knex(this.tableName)
        .insert({
          artisan_id: ruleData.artisanId,
          day_of_week: ruleData.dayOfWeek,
          start_minutes: ruleData.startMinutes,
          end_minutes: ruleData.endMinutes,
        })
        .returning('*');

      logger.info('Opening rule created', {
        ruleId: rule.id,
        artisanId: ruleData.artisanId,
        dayOfWeek: ruleData.dayOfWeek,
      });

      return this.mapToEntity(rule);
    } catch (error) {
      logger.error('Error creating opening rule', {
        error: error.message,
        ruleData,
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
      dayOfWeek: row.day_of_week,
      startMinutes: row.start_minutes,
      endMinutes: row.end_minutes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { OpeningRuleRepository };
