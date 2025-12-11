const { logger } = require('../../utils/logger');

/**
 * SlotAvailabilityService
 * Service métier pour la génération des créneaux disponibles
 *
 * Responsabilités :
 * - Calculer les créneaux disponibles pour un service donné et une date donnée
 * - Prendre en compte les horaires d'ouverture, pauses, réservations et indisponibilités externes
 * - Retourner les créneaux avec leur statut de disponibilité et les raisons de blocage
 *
 * Règles métier :
 * - Un créneau est disponible si aucune réservation confirmée/replanifiée ne le chevauche
 * - Un créneau est bloqué s'il chevauche une pause ou une indisponibilité externe
 * - Les créneaux sont générés par pas de SLOT_STEP minutes (par défaut 30 minutes)
 * - Les créneaux doivent être entièrement contenus dans les horaires d'ouverture
 */
class SlotAvailabilityService {
  constructor(dependencies) {
    const {
      openingRuleRepository,
      breakRuleRepository,
      bookingRepository,
      externalBusyBlockRepository,
    } = dependencies;

    if (
      !openingRuleRepository ||
      !breakRuleRepository ||
      !bookingRepository ||
      !externalBusyBlockRepository
    ) {
      throw new Error(
        'SlotAvailabilityService requires all repositories (openingRuleRepository, breakRuleRepository, bookingRepository, externalBusyBlockRepository)'
      );
    }

    this.openingRuleRepository = openingRuleRepository;
    this.breakRuleRepository = breakRuleRepository;
    this.bookingRepository = bookingRepository;
    this.externalBusyBlockRepository = externalBusyBlockRepository;

    // Constantes de configuration
    this.SLOT_STEP_MINUTES = 30; // Pas de temps pour la génération des créneaux
  }

  /**
   * Génère les créneaux disponibles pour un service et une date donnés
   * @param {string} artisanId - Identifiant UUID de l'artisan
   * @param {string} serviceId - Identifiant UUID du service
   * @param {number} serviceDurationMinutes - Durée du service en minutes
   * @param {string} dateStr - Date au format YYYY-MM-DD
   * @returns {Promise<Object>} Objet contenant les informations d'ouverture et les créneaux
   */
  async generateAvailableSlots(
    artisanId,
    serviceId,
    serviceDurationMinutes,
    dateStr
  ) {
    try {
      logger.info('Generating available slots', {
        artisanId,
        serviceId,
        serviceDurationMinutes,
        date: dateStr,
      });

      // 1. Parser la date et déterminer le jour de la semaine
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay(); // 0 = dimanche, 6 = samedi

      // 2. Récupérer la règle d'ouverture pour ce jour
      const openingRule =
        await this.openingRuleRepository.findByArtisanAndDay(
          artisanId,
          dayOfWeek
        );

      if (!openingRule) {
        logger.warn('No opening rule found for this day', {
          artisanId,
          dayOfWeek,
          date: dateStr,
        });
        return {
          serviceId,
          date: dateStr,
          opening: null,
          slots: [],
        };
      }

      // 3. Récupérer les pauses pour ce jour
      const breakRules =
        await this.breakRuleRepository.findByArtisanAndDay(
          artisanId,
          dayOfWeek
        );

      // 4. Récupérer les réservations confirmées pour cette date
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      const bookings =
        await this.bookingRepository.findByArtisanAndDateRange(
          artisanId,
          startOfDay.toISOString(),
          endOfDay.toISOString()
        );

      // 5. Récupérer les indisponibilités externes pour cette date
      const externalBusyBlocks =
        await this.externalBusyBlockRepository.findExternalByArtisanAndDateRange(
          artisanId,
          startOfDay.toISOString(),
          endOfDay.toISOString()
        );

      // 6. Générer tous les créneaux possibles
      const allSlots = this.generateAllPossibleSlots(
        openingRule,
        breakRules,
        this.SLOT_STEP_MINUTES
      );

      // 7. Vérifier la disponibilité de chaque créneau
      const slotsWithAvailability = allSlots.map((slotTime) => {
        return this.checkSlotAvailability(
          dateStr,
          slotTime,
          serviceDurationMinutes,
          breakRules,
          bookings,
          externalBusyBlocks
        );
      });

      logger.info('Slots generated successfully', {
        artisanId,
        serviceId,
        date: dateStr,
        totalSlots: slotsWithAvailability.length,
        availableSlots: slotsWithAvailability.filter((s) => s.available)
          .length,
      });

      return {
        serviceId,
        date: dateStr,
        opening: {
          startMinutes: openingRule.startMinutes,
          endMinutes: openingRule.endMinutes,
          breakStartMinutes: breakRules[0]?.startMinutes || null,
          breakEndMinutes: breakRules[0]?.endMinutes || null,
        },
        slots: slotsWithAvailability,
      };
    } catch (error) {
      logger.error('Error generating available slots', {
        artisanId,
        serviceId,
        date: dateStr,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Génère tous les créneaux possibles en fonction des horaires d'ouverture et des pauses
   * @private
   * @param {Object} openingRule - Règle d'ouverture du jour
   * @param {Array} breakRules - Liste des règles de pause
   * @param {number} stepMinutes - Pas de temps en minutes
   * @returns {Array<string>} Liste des heures de créneaux au format "HH:MM"
   */
  // eslint-disable-next-line class-methods-use-this
  generateAllPossibleSlots(openingRule, breakRules, stepMinutes) {
    const slots = [];
    const { startMinutes, endMinutes } = openingRule;

    for (
      let currentMinutes = startMinutes;
      currentMinutes < endMinutes;
      currentMinutes += stepMinutes
    ) {
      // Vérifier que ce créneau n'est pas pendant une pause
      const isDuringBreak = breakRules.some((breakRule) => {
        return (
          currentMinutes >= breakRule.startMinutes &&
          currentMinutes < breakRule.endMinutes
        );
      });

      if (!isDuringBreak) {
        slots.push(this.minutesToTimeString(currentMinutes));
      }
    }

    return slots;
  }

  /**
   * Vérifie la disponibilité d'un créneau spécifique
   * @private
   * @param {string} dateStr - Date au format YYYY-MM-DD
   * @param {string} slotTime - Heure au format "HH:MM"
   * @param {number} durationMinutes - Durée du service en minutes
   * @param {Array} breakRules - Liste des règles de pause
   * @param {Array} bookings - Liste des réservations confirmées
   * @param {Array} externalBusyBlocks - Liste des indisponibilités externes
   * @returns {Object} Objet avec disponibilité et raisons de blocage
   */
  // eslint-disable-next-line class-methods-use-this
  checkSlotAvailability(
    dateStr,
    slotTime,
    durationMinutes,
    breakRules,
    bookings,
    externalBusyBlocks
  ) {
    const blockedBy = [];

    // Calculer les timestamps de début et fin du créneau
    const slotStart = new Date(`${dateStr}T${slotTime}:00`);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

    // Vérifier les chevauchements avec les pauses
    const breakOverlaps = breakRules.filter((breakRule) => {
      const breakStart = new Date(dateStr);
      breakStart.setHours(0, 0, 0, 0);
      breakStart.setMinutes(breakRule.startMinutes);

      const breakEnd = new Date(dateStr);
      breakEnd.setHours(0, 0, 0, 0);
      breakEnd.setMinutes(breakRule.endMinutes);

      return this.dateRangesOverlap(
        slotStart,
        slotEnd,
        breakStart,
        breakEnd
      );
    });

    breakOverlaps.forEach(() => {
      blockedBy.push({
        type: 'break',
        summary: 'Pause',
      });
    });

    // Vérifier les chevauchements avec les réservations confirmées
    const bookingOverlaps = bookings.filter((booking) => {
      const bookingStart = new Date(booking.startDateTime);
      const bookingEnd = new Date(
        bookingStart.getTime() + booking.durationMinutes * 60000
      );

      return this.dateRangesOverlap(
        slotStart,
        slotEnd,
        bookingStart,
        bookingEnd
      );
    });

    bookingOverlaps.forEach((booking) => {
      blockedBy.push({
        type: 'booking',
        bookingPublicCode: booking.publicCode,
        summary: `Réservation - ${booking.customerName}`,
      });
    });

    // Vérifier les chevauchements avec les indisponibilités externes
    const externalOverlaps = externalBusyBlocks.filter((block) => {
      const blockStart = new Date(block.startDateTime);
      const blockEnd = new Date(block.endDateTime);

      return this.dateRangesOverlap(
        slotStart,
        slotEnd,
        blockStart,
        blockEnd
      );
    });

    externalOverlaps.forEach((block) => {
      blockedBy.push({
        type: 'calendar',
        providerId: block.providerId,
        summary: block.summary || 'Indisponibilité externe',
      });
    });

    return {
      time: slotTime,
      available: blockedBy.length === 0,
      blockedBy,
    };
  }

  /**
   * Vérifie si deux plages horaires se chevauchent
   * @private
   * @param {Date} start1 - Début de la première plage
   * @param {Date} end1 - Fin de la première plage
   * @param {Date} start2 - Début de la deuxième plage
   * @param {Date} end2 - Fin de la deuxième plage
   * @returns {boolean} true si les plages se chevauchent
   */
  // eslint-disable-next-line class-methods-use-this
  dateRangesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && end1 > start2;
  }

  /**
   * Convertit un nombre de minutes depuis minuit en chaîne "HH:MM"
   * @private
   * @param {number} minutes - Minutes depuis 00:00
   * @returns {string} Heure au format "HH:MM"
   */
  // eslint-disable-next-line class-methods-use-this
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Convertit une chaîne "HH:MM" en nombre de minutes depuis minuit
   * @private
   * @param {string} timeStr - Heure au format "HH:MM"
   * @returns {number} Minutes depuis 00:00
   */
  // eslint-disable-next-line class-methods-use-this
  timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

module.exports = { SlotAvailabilityService };
