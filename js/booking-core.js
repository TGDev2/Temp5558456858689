(function(window) {
  'use strict';

  if (!window) {
    return;
  }

  const STORAGE_KEY = 'ac-bookings';

  const OPENING = {
    start: 8 * 60 + 30,
    end: 18 * 60,
    breakStart: 12 * 60,
    breakEnd: 13 * 60
  };

  const SLOT_STEP = 30; // minutes

  const services = [
    { id: 'diag', name: 'Diagnostic et audit', duration: 30, price: 40, depositRate: 0.3 },
    { id: 'urgence', name: 'Intervention urgente', duration: 45, price: 120, depositRate: 0.4 },
    { id: 'maintenance', name: 'Maintenance planifiée', duration: 60, price: 80, depositRate: 0.3 },
    { id: 'installation', name: 'Installation / mise en service', duration: 90, price: 160, depositRate: 0.35 }
  ];

  const formatTwo = (val) => String(val).padStart(2, '0');

  const formatCurrency = (val) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val);

  const toISODate = (date) => {
    const y = date.getFullYear();
    const m = formatTwo(date.getMonth() + 1);
    const d = formatTwo(date.getDate());
    return `${y}-${m}-${d}`;
  };

  const formatDateLabel = (dateStr) => {
    try {
      const date = new Date(`${dateStr}T00:00:00`);
      return new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      }).format(date);
    } catch (error) {
      return dateStr;
    }
  };

  const minutesToTime = (minutes) =>
    `${formatTwo(Math.floor(minutes / 60))}:${formatTwo(minutes % 60)}`;

  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const loadBookings = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
      return [];
    }
  };

  const saveBookings = (bookings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    } catch (error) {
      // stockage best-effort
    }
  };

  const getServiceById = (id) => services.find((s) => s.id === id);

  const computeDeposit = (service) => Math.round(service.price * service.depositRate);

  const createCode = () =>
    `AC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Intégration calendrier : fonction fournie dynamiquement par le module de sync.
  let calendarBusyProvider = null;

  const registerCalendarBusyProvider = (fn) => {
    if (typeof fn === 'function') {
      calendarBusyProvider = fn;
    } else {
      calendarBusyProvider = null;
    }
  };

  const getCalendarBusyForDate = (dateStr, ignoreCode) => {
    if (!calendarBusyProvider) return [];
    try {
      const result = calendarBusyProvider(dateStr, ignoreCode);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      return [];
    }
  };

  const getBusyWindows = (dateStr, ignoreCode) => {
    const bookings = loadBookings();
    const bookingBusy = bookings
      .filter(
        (b) =>
          b.date === dateStr &&
          b.status !== 'cancelled' &&
          b.code !== ignoreCode
      )
      .map((b) => ({
        start: timeToMinutes(b.time),
        end: timeToMinutes(b.time) + b.duration,
        source: 'booking',
        providerId: 'artisan',
        summary: b.serviceName,
        bookingCode: b.code,
        origin: 'booking'
      }));

    const calendarBusy = getCalendarBusyForDate(dateStr, ignoreCode) || [];
    return bookingBusy.concat(calendarBusy);
  };

  const generateSlots = (dateStr, duration, ignoreCode) => {
    if (!dateStr || !duration) return [];
    const busyWindows = getBusyWindows(dateStr, ignoreCode);
    const slots = [];

    for (
      let minutes = OPENING.start;
      minutes + duration <= OPENING.end;
      minutes += SLOT_STEP
    ) {
      if (minutes >= OPENING.breakStart && minutes < OPENING.breakEnd) continue;
      const start = minutes;
      const end = minutes + duration;
      const blockers = busyWindows.filter((b) => start < b.end && end > b.start);
      slots.push({
        time: minutesToTime(minutes),
        available: blockers.length === 0,
        blockedBy: blockers
      });
    }

    return slots;
  };

  const isSlotAvailable = (dateStr, timeStr, duration, ignoreCode) => {
    return generateSlots(dateStr, duration, ignoreCode).some(
      (slot) => slot.time === timeStr && slot.available
    );
  };

  window.ACBooking = {
    OPENING,
    SLOT_STEP,
    services,
    formatCurrency,
    toISODate,
    formatDateLabel,
    minutesToTime,
    timeToMinutes,
    loadBookings,
    saveBookings,
    getServiceById,
    computeDeposit,
    createCode,
    generateSlots,
    isSlotAvailable,
    registerCalendarBusyProvider
  };
})(window);
