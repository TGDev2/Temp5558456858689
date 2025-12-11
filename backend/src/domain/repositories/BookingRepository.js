const { logger } = require('../../utils/logger');

class BookingRepository {
  constructor(knex) {
    if (!knex) {
      throw new Error(
        'BookingRepository requires a Knex instance for database access'
      );
    }
    this.knex = knex;
    this.tableName = 'bookings';
  }

  async create(bookingData) {
    try {
      const [booking] = await this.knex(this.tableName)
        .insert({
          public_code: bookingData.publicCode,
          artisan_id: bookingData.artisanId,
          service_id: bookingData.serviceId,
          status: bookingData.status || 'confirmed',
          customer_name: bookingData.customerName,
          customer_email: bookingData.customerEmail,
          customer_phone: bookingData.customerPhone || null,
          start_datetime: bookingData.startDateTime,
          duration_minutes: bookingData.durationMinutes,
          price_cents: bookingData.priceCents,
          deposit_amount_cents: bookingData.depositAmountCents,
          deposit_rate: bookingData.depositRate,
          deposit_payment_status: bookingData.depositPaymentStatus || 'pending',
          deposit_payment_provider: bookingData.depositPaymentProvider || null,
          deposit_payment_intent_id:
            bookingData.depositPaymentIntentId || null,
          notifications_email: bookingData.notificationsEmail ?? true,
          notifications_sms: bookingData.notificationsSms ?? false,
        })
        .returning('*');

      logger.info('Booking created successfully', {
        bookingId: booking.id,
        publicCode: booking.public_code,
      });

      return this.mapToEntity(booking);
    } catch (error) {
      logger.error('Error creating booking', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async findById(id) {
    try {
      const booking = await this.knex(this.tableName).where({ id }).first();
      return booking ? this.mapToEntity(booking) : null;
    } catch (error) {
      logger.error('Error finding booking by ID', {
        id,
        error: error.message,
      });
      throw error;
    }
  }

  async findByCode(publicCode) {
    try {
      const booking = await this.knex(this.tableName)
        .where({ public_code: publicCode })
        .first();
      return booking ? this.mapToEntity(booking) : null;
    } catch (error) {
      logger.error('Error finding booking by code', {
        publicCode,
        error: error.message,
      });
      throw error;
    }
  }

  async findByCodeAndEmail(publicCode, email) {
    try {
      const normalizedEmail = (email || '').toLowerCase().trim();
      const booking = await this.knex(this.tableName)
        .where({ public_code: publicCode })
        .whereRaw('LOWER(TRIM(customer_email)) = ?', [normalizedEmail])
        .first();
      return booking ? this.mapToEntity(booking) : null;
    } catch (error) {
      logger.error('Error finding booking by code and email', {
        publicCode,
        error: error.message,
      });
      throw error;
    }
  }

  async updateStatus(id, status) {
    try {
      const [booking] = await this.knex(this.tableName)
        .where({ id })
        .update({ status, updated_at: this.knex.fn.now() })
        .returning('*');
      return booking ? this.mapToEntity(booking) : null;
    } catch (error) {
      logger.error('Error updating booking status', {
        id,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  async updatePaymentStatus(paymentIntentId, paymentStatus) {
    try {
      const [booking] = await this.knex(this.tableName)
        .where({ deposit_payment_intent_id: paymentIntentId })
        .update({
          deposit_payment_status: paymentStatus,
          updated_at: this.knex.fn.now(),
        })
        .returning('*');
      return booking ? this.mapToEntity(booking) : null;
    } catch (error) {
      logger.error('Error updating payment status', {
        paymentIntentId,
        paymentStatus,
        error: error.message,
      });
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const updateData = { ...updates, updated_at: this.knex.fn.now() };
      const [booking] = await this.knex(this.tableName)
        .where({ id })
        .update(updateData)
        .returning('*');
      return booking ? this.mapToEntity(booking) : null;
    } catch (error) {
      logger.error('Error updating booking', {
        id,
        error: error.message,
      });
      throw error;
    }
  }

  async findByArtisanAndDateRange(artisanId, startDate, endDate) {
    try {
      const bookings = await this.knex(this.tableName)
        .where({ artisan_id: artisanId })
        .whereBetween('start_datetime', [startDate, endDate])
        .whereIn('status', ['confirmed', 'rescheduled'])
        .orderBy('start_datetime', 'asc');
      return bookings.map((b) => this.mapToEntity(b));
    } catch (error) {
      logger.error('Error finding bookings by date range', {
        artisanId,
        startDate,
        endDate,
        error: error.message,
      });
      throw error;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  mapToEntity(row) {
    if (!row) return null;
    return {
      id: row.id,
      publicCode: row.public_code,
      artisanId: row.artisan_id,
      serviceId: row.service_id,
      status: row.status,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      startDateTime: row.start_datetime,
      durationMinutes: row.duration_minutes,
      priceCents: row.price_cents,
      depositAmountCents: row.deposit_amount_cents,
      depositRate: row.deposit_rate,
      depositPaymentStatus: row.deposit_payment_status,
      depositPaymentProvider: row.deposit_payment_provider,
      depositPaymentIntentId: row.deposit_payment_intent_id,
      notificationsEmail: row.notifications_email,
      notificationsSms: row.notifications_sms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { BookingRepository };