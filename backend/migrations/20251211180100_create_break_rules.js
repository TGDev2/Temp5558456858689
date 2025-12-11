/**
 * Migration : Création de la table break_rules
 * Stocke les règles de pauses récurrentes de l'artisan (déjeuner, pauses café, etc.)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function up(knex) {
  return knex.schema.createTable('break_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('artisan_id')
      .notNullable()
      .references('id')
      .inTable('artisans')
      .onDelete('CASCADE');
    // day_of_week : 0 = dimanche, 1 = lundi, ..., 6 = samedi (norme ISO 8601)
    table
      .integer('day_of_week')
      .notNullable()
      .checkBetween([0, 6], 'day_of_week_range');
    // start_minutes : minutes depuis 00:00 (ex: 720 = 12:00)
    table
      .integer('start_minutes')
      .notNullable()
      .checkBetween([0, 1439], 'start_minutes_range');
    // end_minutes : minutes depuis 00:00 (ex: 780 = 13:00)
    table
      .integer('end_minutes')
      .notNullable()
      .checkBetween([0, 1440], 'end_minutes_range');
    table.timestamps(true, true);

    // Contraintes
    table.check(
      'end_minutes > start_minutes',
      {},
      'check_end_after_start'
    );

    // Index pour requêtes fréquentes
    table.index('artisan_id', 'idx_break_rules_artisan');
    table.index(['artisan_id', 'day_of_week'], 'idx_break_rules_artisan_day');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('break_rules');
};
