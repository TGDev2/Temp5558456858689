const { logger } = require('../../utils/logger');
const {
  generateUniqueBookingCode,
} = require('../../utils/bookingCodeGenerator');
const {
  SlotUnavailableError,
  ServiceNotFoundError,
  InvalidBookingDataError,
} = require('../errors/DomainError');

/**
 * BookingService
 * Service métier pour la gestion du cycle de vie des réservations
 *
 * Responsabilités :
 * - Création de réservations avec validation complète de disponibilité
 * - Génération de codes uniques AC-XXXXXX
 * - Calcul automatique des acomptes
 * - Validation des règles métier (créneau disponible, service actif, etc.)
 * - Orchestration entre ServiceRepository, SlotAvailabilityService et BookingRepository
 *
 * Pattern : Service métier avec injection de dépendances
 */
class BookingService {
  constructor(dependencies) {
    const { serviceRepository, bookingRepository, slotAvailabilityService } =
      dependencies;

    if (!serviceRepository || !bookingRepository || !slotAvailabilityService) {
      throw new Error(
        'BookingService requires serviceRepository, bookingRepository, and slotAvailabilityService'
      );
    }

    this.serviceRepository = serviceRepository;
    this.bookingRepository = bookingRepository;
    this.slotAvailabilityService = slotAvailabilityService;
  }

  /**
   * Crée une nouvelle réservation avec validation complète
   *
   * @param {Object} bookingData - Données de la réservation
   * @param {string} bookingData.serviceId - ID du service
   * @param {string} bookingData.date - Date au format YYYY-MM-DD
   * @param {string} bookingData.time - Heure au format HH:MM
   * @param {Object} bookingData.customer - Informations client
   * @param {string} bookingData.customer.name - Nom du client
   * @param {string} bookingData.customer.email - Email du client
   * @param {string} [bookingData.customer.phone] - Téléphone du client (optionnel)
   * @param {Object} [bookingData.notifications] - Préférences notifications
   * @param {boolean} [bookingData.notifications.email=true] - Notifications email
   * @param {boolean} [bookingData.notifications.sms=false] - Notifications SMS
   * @returns {Promise<Object>} Réservation créée
   * @throws {ServiceNotFoundError} Si le service n'existe pas ou est inactif
   * @throws {SlotUnavailableError} Si le créneau n'est pas disponible
   * @throws {InvalidBookingDataError} Si les données sont invalides
   */
  async createBooking(bookingData) {
    try {
      logger.info('BookingService: Creating new booking', {
        serviceId: bookingData.serviceId,
        date: bookingData.date,
        time: bookingData.time,
      });

      // 1. Validation des données d'entrée
      this.validateBookingData(bookingData);

      // 2. Récupérer le service et vérifier qu'il est actif
      const service = await this.serviceRepository.findById(
        bookingData.serviceId
      );

      if (!service || !service.isActive) {
        logger.warn('Service not found or inactive', {
          serviceId: bookingData.serviceId,
        });
        throw new ServiceNotFoundError();
      }

      // 3. Vérifier la disponibilité du créneau demandé
      await this.validateSlotAvailability(
        service,
        bookingData.date,
        bookingData.time
      );

      // 4. Générer un code de réservation unique
      const publicCode = await generateUniqueBookingCode(async (code) => {
        const existing = await this.bookingRepository.findByCode(code);
        return !existing;
      });

      // 5. Calculer l'acompte
      const depositAmountCents = this.calculateDepositAmount(
        service.basePriceCents,
        service.depositRate
      );

      // 6. Construire la date/heure de début ISO 8601
      const startDateTime = this.buildStartDateTime(
        bookingData.date,
        bookingData.time
      );

      // 7. Créer la réservation en base
      const booking = await this.bookingRepository.create({
        publicCode,
        artisanId: service.artisanId,
        serviceId: service.id,
        status: 'confirmed',
        customerName: bookingData.customer.name,
        customerEmail: bookingData.customer.email,
        customerPhone: bookingData.customer.phone || null,
        startDateTime,
        durationMinutes: service.durationMinutes,
        priceCents: service.basePriceCents,
        depositAmountCents,
        depositRate: service.depositRate,
        depositPaymentStatus: 'pending',
        depositPaymentProvider: null,
        depositPaymentIntentId: null,
        notificationsEmail: bookingData.notifications?.email ?? true,
        notificationsSms: bookingData.notifications?.sms ?? false,
      });

      logger.info('BookingService: Booking created successfully', {
        bookingId: booking.id,
        publicCode: booking.publicCode,
        serviceId: service.id,
        startDateTime,
      });

      return booking;
    } catch (error) {
      logger.error('BookingService: Error creating booking', {
        error: error.message,
        stack: error.stack,
        bookingData,
      });
      throw error;
    }
  }

  /**
   * Valide les données de réservation
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  validateBookingData(bookingData) {
    if (!bookingData.serviceId) {
      throw new InvalidBookingDataError('serviceId est requis');
    }

    if (!bookingData.date) {
      throw new InvalidBookingDataError('date est requise');
    }

    if (!bookingData.time) {
      throw new InvalidBookingDataError('time est requis');
    }

    if (!bookingData.customer) {
      throw new InvalidBookingDataError('customer est requis');
    }

    if (!bookingData.customer.name) {
      throw new InvalidBookingDataError('customer.name est requis');
    }

    if (!bookingData.customer.email) {
      throw new InvalidBookingDataError('customer.email est requis');
    }

    // Validation format email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(bookingData.customer.email)) {
      throw new InvalidBookingDataError('customer.email invalide');
    }

    // Validation format date YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(bookingData.date)) {
      throw new InvalidBookingDataError('date doit être au format YYYY-MM-DD');
    }

    // Validation format time HH:MM
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(bookingData.time)) {
      throw new InvalidBookingDataError('time doit être au format HH:MM');
    }

    // Validation date non antérieure à aujourd'hui
    const requestedDate = new Date(bookingData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      throw new InvalidBookingDataError('date ne peut pas être dans le passé');
    }
  }

  /**
   * Vérifie qu'un créneau est disponible en appelant SlotAvailabilityService
   * @private
   */
  async validateSlotAvailability(service, date, time) {
    const availability =
      await this.slotAvailabilityService.generateAvailableSlots(
        service.artisanId,
        service.id,
        service.durationMinutes,
        date
      );

    // Vérifier que le jour est ouvert
    if (!availability.opening) {
      logger.warn('No opening hours for requested date', {
        serviceId: service.id,
        date,
      });
      throw new SlotUnavailableError(
        "Aucun horaire d'ouverture configuré pour cette date."
      );
    }

    // Rechercher le créneau demandé dans la liste des créneaux générés
    const requestedSlot = availability.slots.find((slot) => slot.time === time);

    if (!requestedSlot) {
      logger.warn('Requested slot not in available slots list', {
        serviceId: service.id,
        date,
        time,
      });
      throw new SlotUnavailableError(
        "Le créneau demandé est en dehors des horaires d'ouverture."
      );
    }

    // Vérifier que le créneau est disponible
    if (!requestedSlot.available) {
      const blockers = requestedSlot.blockedBy
        .map((b) => b.summary || b.type)
        .join(', ');

      logger.warn('Requested slot is not available', {
        serviceId: service.id,
        date,
        time,
        blockedBy: requestedSlot.blockedBy,
      });

      throw new SlotUnavailableError(
        `Le créneau ${time} est déjà réservé ou indisponible. Raison: ${blockers}`
      );
    }

    logger.info('Slot availability validated', {
      serviceId: service.id,
      date,
      time,
    });
  }

  /**
   * Calcule le montant de l'acompte en centimes
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  calculateDepositAmount(basePriceCents, depositRate) {
    return Math.round(basePriceCents * depositRate);
  }

  /**
   * Construit une date/heure ISO 8601 à partir d'une date et d'une heure
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  buildStartDateTime(date, time) {
    // Fuseau horaire Europe/Paris (CET/CEST)
    // Pour le MVP, on suppose que toutes les dates sont en heure locale française
    // Dans une version future, utiliser le timezone de l'artisan depuis la BDD
    return `${date}T${time}:00+01:00`;
  }
}

module.exports = { BookingService };
