/**
 * Migration : Création de la table external_busy_blocks
 * Stocke les indisponibilités importées depuis les calendriers externes
 * et les indisponibilités créées par les réservations confirmées
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function up(knex) {
  return knex.schema.createTable('external_busy_blocks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('artisan_id')
      .notNullable()
      .references('id')
      .inTable('artisans')
      .onDelete('CASCADE');
    // provider_id : 'google', 'outlook', 'apple', etc.
    table.string('provider_id', 50).notNullable();
    // source : 'external' si importé depuis calendrier, 'booking' si exporté depuis réservation
    table
      .string('source', 20)
      .notNullable()
      .checkIn(['external', 'booking'], 'source_type');
    // summary : titre de l'événement (ex: "Chantier Google", "Diagnostic - M. Martin")
    table.string('summary', 500);
    // start_datetime et end_datetime : plage horaire de l'indisponibilité
    table.timestamp('start_datetime', { useTz: true }).notNullable();
    table.timestamp('end_datetime', { useTz: true }).notNullable();
    // booking_id : présent si source = 'booking', NULL sinon
    table
      .uuid('booking_id')
      .references('id')
      .inTable('bookings')
      .onDelete('CASCADE');
    // external_event_id : ID événement chez le provider (pour mise à jour/suppression ultérieure)
    table.string('external_event_id', 255);
    table.timestamps(true, true);

    // Contraintes
    table.check(
      'end_datetime > start_datetime',
      {},
      'check_end_after_start'
    );

    // Index pour requêtes de conflits de créneaux (range overlaps)
    table.index(
      ['artisan_id', 'start_datetime', 'end_datetime'],
      'idx_external_busy_artisan_range'
    );
    table.index('booking_id', 'idx_external_busy_booking');
    table.index(['artisan_id', 'provider_id', 'source'], 'idx_external_busy_provider_source');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('external_busy_blocks');
};
