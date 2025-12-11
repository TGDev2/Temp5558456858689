/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function up(knex) {
  return knex.schema.createTable('bookings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('public_code', 10).notNullable().unique();
    table
      .uuid('artisan_id')
      .notNullable()
      .references('id')
      .inTable('artisans')
      .onDelete('RESTRICT');
    table
      .uuid('service_id')
      .notNullable()
      .references('id')
      .inTable('services')
      .onDelete('RESTRICT');
    table
      .string('status', 20)
      .notNullable()
      .defaultTo('confirmed')
      .checkIn(['confirmed', 'cancelled', 'rescheduled']);
    table.string('customer_name', 255).notNullable();
    table.string('customer_email', 255).notNullable();
    table.string('customer_phone', 50);
    table.timestamp('start_datetime', { useTz: true }).notNullable();
    table.integer('duration_minutes').notNullable().checkPositive();
    table.integer('price_cents').notNullable().checkPositive();
    table.integer('deposit_amount_cents').notNullable().checkPositive();
    table.decimal('deposit_rate', 3, 2).notNullable();
    table
      .string('deposit_payment_status', 20)
      .notNullable()
      .defaultTo('pending')
      .checkIn(['pending', 'authorized', 'captured', 'refunded', 'failed']);
    table.string('deposit_payment_provider', 50);
    table.string('deposit_payment_intent_id', 255);
    table.boolean('notifications_email').notNullable().defaultTo(true);
    table.boolean('notifications_sms').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.index(['artisan_id', 'status'], 'idx_bookings_artisan_status');
    table.index('customer_email', 'idx_bookings_customer_email');
    table.index(
      ['artisan_id', 'start_datetime'],
      'idx_bookings_start_datetime'
    );
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('bookings');
};
