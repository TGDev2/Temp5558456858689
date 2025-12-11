/**
 * DomainError - Classe de base pour les erreurs métier
 *
 * Permet de distinguer les erreurs métier (attendues, gérables)
 * des erreurs techniques (bugs, pannes infrastructure)
 */
class DomainError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * SlotUnavailableError
 * Levée lorsqu'un créneau demandé est déjà réservé ou bloqué
 */
class SlotUnavailableError extends DomainError {
  constructor(message = 'Le créneau sélectionné n\'est plus disponible.') {
    super('SLOT_UNAVAILABLE', message, 409);
  }
}

/**
 * BookingNotFoundError
 * Levée lorsqu'une réservation demandée n'existe pas
 */
class BookingNotFoundError extends DomainError {
  constructor(message = 'Réservation introuvable.') {
    super('BOOKING_NOT_FOUND', message, 404);
  }
}

/**
 * ServiceNotFoundError
 * Levée lorsqu'un service demandé n'existe pas ou est inactif
 */
class ServiceNotFoundError extends DomainError {
  constructor(message = 'Service introuvable ou inactif.') {
    super('SERVICE_NOT_FOUND', message, 404);
  }
}

/**
 * InvalidBookingDataError
 * Levée lorsque les données de réservation sont invalides
 */
class InvalidBookingDataError extends DomainError {
  constructor(message = 'Données de réservation invalides.') {
    super('INVALID_BOOKING_DATA', message, 400);
  }
}

/**
 * BookingAlreadyCancelledError
 * Levée lorsqu'on tente d'annuler une réservation déjà annulée
 */
class BookingAlreadyCancelledError extends DomainError {
  constructor(message = 'Cette réservation est déjà annulée.') {
    super('BOOKING_ALREADY_CANCELLED', message, 409);
  }
}

module.exports = {
  DomainError,
  SlotUnavailableError,
  BookingNotFoundError,
  ServiceNotFoundError,
  InvalidBookingDataError,
  BookingAlreadyCancelledError,
};
