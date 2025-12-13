/**
 * ACApi - Client API pour communiquer avec le backend ArtisanConnect
 *
 * Ce module remplace les appels simulés (booking-core.js) par de vrais appels HTTP
 * vers les endpoints backend.
 */
(function (window) {
  'use strict';

  if (!window) {
    return;
  }

  // Configuration de l'API
  const API_CONFIG = {
    baseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api/v1'
      : '/api/v1', // En production, utiliser le même domaine
    timeout: 30000, // 30 secondes
  };

  /**
   * Crée une erreur métier avec un code
   */
  const createDomainError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
  };

  /**
   * Fonction utilitaire pour faire des appels fetch avec gestion d'erreurs
   */
  const apiFetch = async (endpoint, options = {}) => {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    const fetchOptions = { ...defaultOptions, ...options };

    // Merge headers
    if (options.headers) {
      fetchOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Lire le corps de la réponse
      let data = null;
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = text ? { message: text } : null;
      }

      // Gérer les erreurs HTTP
      if (!response.ok) {
        const errorMessage = data && data.error && data.error.message
          ? data.error.message
          : `Erreur HTTP ${response.status}`;
        const errorCode = data && data.error && data.error.code
          ? data.error.code
          : `HTTP_${response.status}`;

        throw createDomainError(errorCode, errorMessage);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Gérer les timeout
      if (error.name === 'AbortError') {
        throw createDomainError(
          'TIMEOUT',
          'La requête a pris trop de temps. Vérifiez votre connexion et réessayez.'
        );
      }

      // Gérer les erreurs réseau
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw createDomainError(
          'NETWORK_ERROR',
          'Impossible de contacter le serveur. Vérifiez que le backend est démarré sur http://localhost:3000'
        );
      }

      // Rethrow les erreurs métier
      throw error;
    }
  };

  /**
   * GET /api/v1/services
   * Liste tous les services disponibles
   */
  const listServices = async () => {
    const data = await apiFetch('/services', { method: 'GET' });
    return {
      services: Array.isArray(data && data.services) ? data.services : [],
    };
  };

  /**
   * GET /api/v1/availability?serviceId=...&date=...
   * Récupère les créneaux disponibles pour un service et une date
   */
  const getAvailability = async (params) => {
    const { serviceId, date } = params || {};

    if (!serviceId || !date) {
      throw createDomainError(
        'INVALID_PARAMS',
        'serviceId et date sont requis pour consulter les créneaux.'
      );
    }

    const queryParams = new URLSearchParams({
      serviceId,
      date,
    });

    const data = await apiFetch(`/availability?${queryParams}`, { method: 'GET' });

    return {
      serviceId: data.serviceId,
      date: data.date,
      opening: data.opening || null,
      slots: Array.isArray(data.slots) ? data.slots : [],
    };
  };

  /**
   * POST /api/v1/bookings
   * Crée une nouvelle réservation avec Payment Intent Stripe
   */
  const createBooking = async (payload) => {
    if (!payload) {
      throw createDomainError(
        'INVALID_PAYLOAD',
        'Données de réservation manquantes.'
      );
    }

    const data = await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!data || !data.booking) {
      throw createDomainError(
        'INVALID_RESPONSE',
        'Réponse invalide du serveur.'
      );
    }

    // Stocker le payment.clientSecret pour Stripe Elements
    if (data.payment && data.payment.clientSecret) {
      window.lastBookingPayment = data.payment;
    }

    // Mapper la réponse backend vers le format attendu par le front
    return {
      booking: mapBookingFromBackend(data.booking),
    };
  };

  /**
   * GET /api/v1/bookings/public?code=...&email=...
   * Récupère une réservation par code public et email
   */
  const getBookingPublic = async (params) => {
    const { code, email } = params || {};

    if (!code || !email) {
      throw createDomainError(
        'INVALID_PARAMS',
        'Code et email sont requis pour retrouver une réservation.'
      );
    }

    const queryParams = new URLSearchParams({ code, email });
    const data = await apiFetch(`/bookings/public?${queryParams}`, { method: 'GET' });

    if (!data || !data.booking) {
      throw createDomainError(
        'BOOKING_NOT_FOUND',
        'Réservation introuvable.'
      );
    }

    return {
      booking: mapBookingFromBackend(data.booking),
    };
  };

  /**
   * POST /api/v1/bookings/:code/cancel
   * Annule une réservation
   */
  const cancelBooking = async (params) => {
    const { code, email } = params || {};

    if (!code) {
      throw createDomainError(
        'INVALID_PARAMS',
        'Code de réservation requis pour annuler.'
      );
    }

    // Le backend requiert l'email dans le body pour authentification
    const emailToUse = email || window.lastManageEmail || '';

    const data = await apiFetch(`/bookings/${code}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ email: emailToUse }),
    });

    if (!data || !data.booking) {
      throw createDomainError(
        'INVALID_RESPONSE',
        'Réponse invalide du serveur.'
      );
    }

    return {
      booking: mapBookingFromBackend(data.booking),
    };
  };

  /**
   * POST /api/v1/bookings/:code/reschedule
   * Replanifie une réservation vers une nouvelle date/heure
   */
  const rescheduleBooking = async (params) => {
    const { code, email, newDate, newTime } = params || {};

    if (!code || !newDate || !newTime) {
      throw createDomainError(
        'INVALID_PARAMS',
        'Code, nouvelle date et nouvel horaire sont requis.'
      );
    }

    // Le backend requiert l'email dans le body pour authentification
    const emailToUse = email || window.lastManageEmail || '';

    const data = await apiFetch(`/bookings/${code}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        email: emailToUse,
        newDate,
        newTime,
      }),
    });

    if (!data || !data.booking) {
      throw createDomainError(
        'INVALID_RESPONSE',
        'Réponse invalide du serveur.'
      );
    }

    return {
      booking: mapBookingFromBackend(data.booking),
    };
  };

  /**
   * Mappe un booking du backend vers le format attendu par le front
   * Le front attend: { code, serviceName, duration, deposit, date, time, ... }
   * Le backend retourne: { publicCode, startDateTime, depositAmountCents, durationMinutes, ... }
   */
  const mapBookingFromBackend = (backendBooking) => {
    if (!backendBooking) return null;

    // Extraire date et time depuis startDateTime (format: "2025-12-15T14:00:00+01:00")
    const startDateTime = backendBooking.startDateTime || '';
    const [datePart, timePart] = startDateTime.split('T');
    const time = timePart ? timePart.substring(0, 5) : ''; // Extraire HH:MM

    return {
      // Champs utilisés par le front (compatibilité)
      code: backendBooking.publicCode,
      serviceId: backendBooking.serviceId,
      serviceName: getServiceNameFromId(backendBooking.serviceId),
      duration: backendBooking.durationMinutes,
      price: backendBooking.priceCents / 100,
      deposit: backendBooking.depositAmountCents / 100,
      depositRate: backendBooking.depositRate || 0.3,
      date: datePart,
      time: time,
      name: backendBooking.customerName,
      email: backendBooking.customerEmail,
      phone: backendBooking.customerPhone || '',
      notifications: {
        email: true, // Le backend ne retourne pas ce champ actuellement
        sms: false,
      },
      status: backendBooking.status,
      createdAt: backendBooking.createdAt,
      updatedAt: backendBooking.updatedAt,

      // Champs backend (pour compatibilité future)
      id: backendBooking.id,
      publicCode: backendBooking.publicCode,
      depositPaymentStatus: backendBooking.depositPaymentStatus,
      depositInfo: {
        amountCents: backendBooking.depositAmountCents,
        currency: 'EUR',
        paymentStatus: backendBooking.depositPaymentStatus,
      },
    };
  };

  /**
   * Récupère le nom du service depuis l'ID
   * Note: Cette fonction nécessite que les services soient chargés
   */
  const getServiceNameFromId = (serviceId) => {
    // Essayer de trouver le service dans le cache local
    if (window.cachedServices) {
      const service = window.cachedServices.find(s => s.id === serviceId);
      if (service) return service.name;
    }
    return 'Service'; // Fallback
  };

  // Exposer l'API globalement
  window.ACApi = {
    listServices,
    getAvailability,
    createBooking,
    getBookingPublic,
    cancelBooking,
    rescheduleBooking,
    config: API_CONFIG,
  };

  console.log('ACApi initialisé avec backend:', API_CONFIG.baseUrl);
})(window);
