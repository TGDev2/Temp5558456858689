/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function up(knex) {
  return knex.schema.createTable('artisans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('business_name', 255).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('phone', 50);
    table.text('description');
    table.string('address', 500);
    table.string('city', 100);
    table.string('postal_code', 20);
    table.string('country', 100).defaultTo('France');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index('email', 'idx_artisans_email');
    table.index('is_active', 'idx_artisans_is_active');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('artisans');
};
