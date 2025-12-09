(function (window) {
  'use strict';

  if (!window) {
    return;
  }

  const ACBooking = window.ACBooking;
  if (!ACBooking) {
    console.error(
      'ACApi: ACBooking non disponible, initialisation de la façade API annulée.'
    );
    return;
  }

  const ACCalendarSync = window.ACCalendarSync || null;

  const { services, OPENING, generateSlots, getServiceById } = ACBooking;

  const ARTISAN_ID = 'artisan-demo-1';

  const createDomainError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
  };

  const toServiceDto = (service) => ({
    id: service.id,
    name: service.name,
    description: service.description || '',
    durationMinutes: service.duration,
    duration: service.duration, // alias pour le front actuel
    basePriceCents: Math.round(service.price * 100),
    price: service.price, // alias pour le front actuel
    depositRate: service.depositRate,
    isActive: true
  });

  const toSlotBlockerDto = (blocker) => ({
    type: blocker.origin === 'booking' ? 'booking' : 'calendar',
    providerId: blocker.providerId || null,
    bookingPublicCode: blocker.bookingCode || null,
    summary: blocker.summary || ''
  });

  const toSlotDto = (slot) => ({
    time: slot.time,
    available: slot.available,
    blockedBy: Array.isArray(slot.blockedBy)
      ? slot.blockedBy.map(toSlotBlockerDto)
      : []
  });

  const buildStartDateTime = (date, time) => `${date}T${time}:00+01:00`;

  // On renvoie un "booking DTO" qui :
  // - conserve toutes les propriétés déjà utilisées par l'UI (code, date, time, deposit, depositRate, serviceName, notifications, etc.)
  // - ajoute des champs alignés avec le contrat d’API (publicCode, startDateTime, priceCents, depositInfo, artisanId, customer...)
  const toBookingDto = (booking) => {
    if (!booking) return null;

    const cloned = { ...booking };

    cloned.id = booking.id || booking.code;
    cloned.publicCode = booking.code;
    cloned.durationMinutes = booking.duration;
    cloned.priceCents = Math.round((booking.price || 0) * 100);
    cloned.depositInfo = {
      amountCents: Math.round((booking.deposit || 0) * 100),
      currency: 'EUR',
      rate: booking.depositRate,
      paymentStatus: 'authorized',
      paymentProvider: 'other',
      paymentIntentId: null
    };
    cloned.startDateTime = buildStartDateTime(booking.date, booking.time);
    cloned.artisanId = ARTISAN_ID;
    cloned.customer = {
      name: booking.name,
      email: booking.email,
      phone: booking.phone || null
    };

    return cloned;
  };

  // GET /api/services
  const listServices = async () => {
    return {
      services: services.map(toServiceDto)
    };
  };

  // GET /api/availability?serviceId=...&date=...
  // Extension interne : support d’un paramètre optionnel ignoreCode pour la replanification
  const getAvailability = async (params) => {
    const { serviceId, date, ignoreCode } = params || {};

    if (!serviceId || !date) {
      throw createDomainError(
        'INVALID_AVAILABILITY_PARAMS',
        'serviceId et date sont requis pour consulter les créneaux.'
      );
    }

    const service = getServiceById(serviceId);
    if (!service) {
      throw createDomainError('UNKNOWN_SERVICE', 'Service inconnu.');
    }

    const slotsRaw = generateSlots(date, service.duration, ignoreCode);

    return {
      serviceId,
      date,
      opening: {
        startMinutes: OPENING.start,
        endMinutes: OPENING.end,
        breakStartMinutes: OPENING.breakStart,
        breakEndMinutes: OPENING.breakEnd
      },
      slots: slotsRaw.map(toSlotDto)
    };
  };

  // POST /api/bookings
  const createBookingApi = async (payload) => {
    if (!payload) {
      throw createDomainError(
        'INVALID_PAYLOAD',
        'Données de réservation manquantes.'
      );
    }

    const { serviceId, date, time, customer, notifications } = payload;
    const name = customer && customer.name ? customer.name : '';
    const email = customer && customer.email ? customer.email : '';
    const phone = customer && customer.phone ? customer.phone : '';

    try {
      const booking = ACBooking.createBooking({
        serviceId,
        date,
        time,
        name,
        email,
        phone,
        notifications
      });

      if (ACCalendarSync && typeof ACCalendarSync.pushBooking === 'function') {
        ACCalendarSync.pushBooking(booking);
      }

      return { booking: toBookingDto(booking) };
    } catch (error) {
      // On laisse remonter les erreurs métier d’ACBooking (SLOT_UNAVAILABLE, etc.)
      throw error;
    }
  };

  // GET /api/bookings/public?code=...&email=...
  const getBookingPublic = async (params) => {
    const { code, email } = params || {};
    if (!code || !email) {
      throw createDomainError(
        'INVALID_LOOKUP',
        'Code et email sont requis pour retrouver une réservation.'
      );
    }

    const booking = ACBooking.findBookingByCodeAndEmail(code, email);
    if (!booking) {
      throw createDomainError('BOOKING_NOT_FOUND', 'Réservation introuvable.');
    }

    return { booking: toBookingDto(booking) };
  };

  // POST /api/bookings/{publicCode}/cancel
  const cancelBookingApi = async (params) => {
    const { code } = params || {};
    if (!code) {
      throw createDomainError(
        'INVALID_CODE',
        'Code de réservation requis pour annuler.'
      );
    }

    const booking = ACBooking.cancelBooking(code);

    if (ACCalendarSync && typeof ACCalendarSync.removeBooking === 'function') {
      ACCalendarSync.removeBooking(booking);
    }

    return { booking: toBookingDto(booking) };
  };

  // POST /api/bookings/{publicCode}/reschedule
  const rescheduleBookingApi = async (params) => {
    const { code, newDate, newTime } = params || {};
    if (!code || !newDate || !newTime) {
      throw createDomainError(
        'INVALID_RESCHEDULE',
        'Code, nouvelle date et nouvel horaire sont requis.'
      );
    }

    const booking = ACBooking.rescheduleBooking(code, newDate, newTime);

    if (ACCalendarSync) {
      if (typeof ACCalendarSync.removeBooking === 'function') {
        ACCalendarSync.removeBooking(booking);
      }
      if (typeof ACCalendarSync.pushBooking === 'function') {
        ACCalendarSync.pushBooking(booking);
      }
    }

    return { booking: toBookingDto(booking) };
  };

  window.ACApi = {
    listServices,
    getAvailability,
    createBooking: createBookingApi,
    getBookingPublic,
    cancelBooking: cancelBookingApi,
    rescheduleBooking: rescheduleBookingApi
  };
})(window);
