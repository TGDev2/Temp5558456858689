/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function up(knex) {
  return knex.schema.createTable('services', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('artisan_id')
      .notNullable()
      .references('id')
      .inTable('artisans')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.integer('duration_minutes').notNullable().checkPositive();
    table.integer('price_cents').notNullable().checkPositive();
    table.decimal('deposit_rate', 3, 2).notNullable().defaultTo(0.3);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index('artisan_id', 'idx_services_artisan_id');
    table.index(['artisan_id', 'is_active'], 'idx_services_artisan_active');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('services');
};
