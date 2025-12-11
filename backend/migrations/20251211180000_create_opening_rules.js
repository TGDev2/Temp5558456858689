/**
 * Migration : Création de la table opening_rules
 * Stocke les règles d'horaires d'ouverture hebdomadaires de l'artisan
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function up(knex) {
  return knex.schema.createTable('opening_rules', (table) => {
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
    // start_minutes : minutes depuis 00:00 (ex: 510 = 08:30)
    table
      .integer('start_minutes')
      .notNullable()
      .checkBetween([0, 1439], 'start_minutes_range');
    // end_minutes : minutes depuis 00:00 (ex: 1080 = 18:00)
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
    // Une seule règle par jour par artisan (simplification MVP)
    table.unique(['artisan_id', 'day_of_week'], {
      indexName: 'uq_opening_rules_artisan_day',
    });

    // Index pour requêtes fréquentes
    table.index('artisan_id', 'idx_opening_rules_artisan');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('opening_rules');
};
