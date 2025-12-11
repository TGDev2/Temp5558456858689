const { logger } = require('../../utils/logger');

/**
 * BreakRuleRepository
 * Repository pour l'accès aux règles de pauses récurrentes des artisans
 */
class BreakRuleRepository {
  constructor(knex) {
    if (!knex) {
      throw new Error(
        'BreakRuleRepository requires a Knex instance for database access'
      );
    }
    this.knex = knex;
    this.tableName = 'break_rules';
  }

  /**
   * Récupère toutes les règles de pause d'un artisan
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @returns {Promise<Array>} Liste des règles de pause
   */
  async findByArtisan(artisanId) {
    try {
      const rules = await this.knex(this.tableName)
        .where({ artisan_id: artisanId })
        .orderBy(['day_of_week', 'start_minutes'], 'asc');

      logger.info('Break rules retrieved', {
        artisanId,
        count: rules.length,
      });

      return rules.map((rule) => this.mapToEntity(rule));
    } catch (error) {
      logger.error('Error finding break rules by artisan', {
        artisanId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Récupère les règles de pause pour un jour spécifique
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @param {number} dayOfWeek - Jour de la semaine (0=dimanche, 6=samedi)
   * @returns {Promise<Array>} Liste des règles de pause pour ce jour
   */
  async findByArtisanAndDay(artisanId, dayOfWeek) {
    try {
      const rules = await this.knex(this.tableName)
        .where({ artisan_id: artisanId, day_of_week: dayOfWeek })
        .orderBy('start_minutes', 'asc');

      return rules.map((rule) => this.mapToEntity(rule));
    } catch (error) {
      logger.error('Error finding break rules by artisan and day', {
        artisanId,
        dayOfWeek,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Crée une nouvelle règle de pause
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

      logger.info('Break rule created', {
        ruleId: rule.id,
        artisanId: ruleData.artisanId,
        dayOfWeek: ruleData.dayOfWeek,
      });

      return this.mapToEntity(rule);
    } catch (error) {
      logger.error('Error creating break rule', {
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

module.exports = { BreakRuleRepository };
