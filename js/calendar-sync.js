(function(window) {
  'use strict';

  const ACBooking = window.ACBooking;
  if (!ACBooking) {
    return;
  }

  const {
    toISODate,
    minutesToTime,
    timeToMinutes,
    loadBookings,
    registerCalendarBusyProvider
  } = ACBooking;

  const CALENDAR_STORAGE_KEY = 'ac-calendar-sync';

  const CALENDAR_PROVIDERS = [
    { id: 'google', label: 'Google Calendar', accent: '#ea4335', icon: 'fab fa-google' },
    { id: 'outlook', label: 'Outlook / Office 365', accent: '#0a64ad', icon: 'fab fa-microsoft' },
    { id: 'apple', label: 'Apple Calendar', accent: '#111827', icon: 'fab fa-apple' }
  ];

  const SAMPLE_BUSY = {
    google: [
      { dayOffset: 1, start: '09:00', duration: 90, summary: 'Chantier Google' },
      { dayOffset: 2, start: '15:00', duration: 60, summary: 'Visio client' },
      { dayOffset: 5, start: '10:30', duration: 120, summary: 'Livraison matériel' }
    ],
    outlook: [
      { dayOffset: 0, start: '14:00', duration: 60, summary: 'Rdv bureau' },
      { dayOffset: 3, start: '08:30', duration: 60, summary: 'Planning équipe' },
      { dayOffset: 7, start: '16:00', duration: 90, summary: 'Rappel maintenance' }
    ],
    apple: [
      { dayOffset: 1, start: '07:30', duration: 60, summary: 'Bloc perso' },
      { dayOffset: 4, start: '13:00', duration: 120, summary: 'Livraison atelier' }
    ]
  };

  const defaultCalendarState = () => ({
    providers: CALENDAR_PROVIDERS.reduce((acc, provider) => {
      acc[provider.id] = {
        connected: false,
        busy: [],
        lastSync: null,
        autoPush: true,
        autoPull: true
      };
      return acc;
    }, {}),
    lastFullSync: null
  });

  const loadCalendarState = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(CALENDAR_STORAGE_KEY));
      const base = defaultCalendarState();
      if (!raw) return base;
      const merged = {
        ...base,
        ...raw,
        providers: { ...base.providers, ...(raw.providers || {}) }
      };
      CALENDAR_PROVIDERS.forEach((provider) => {
        merged.providers[provider.id] = {
          ...base.providers[provider.id],
          ...(merged.providers[provider.id] || {})
        };
      });
      return merged;
    } catch (error) {
      return defaultCalendarState();
    }
  };

  const saveCalendarState = (state) => {
    try {
      localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // stockage best-effort
    }
  };

  const getProviderMeta = (id) =>
    CALENDAR_PROVIDERS.find((p) => p.id === id) || {
      label: id,
      accent: '#94a3b8',
      icon: 'fas fa-calendar'
    };

  const formatLastSync = (iso) => {
    if (!iso) return 'Jamais synchronisé';
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(iso));
    } catch (error) {
      return 'Jamais synchronisé';
    }
  };

  const buildBusyFromTemplate = (providerId, template, index) => {
    const base = new Date();
    const day = new Date(base);
    day.setDate(base.getDate() + template.dayOffset);
    const startTime = template.start || '09:00';
    const endTime = minutesToTime(
      timeToMinutes(startTime) + (template.duration || 60)
    );
    const dateStr = toISODate(day);
    return {
      id: `${providerId}-ext-${index}`,
      start: `${dateStr}T${startTime}:00`,
      end: `${dateStr}T${endTime}:00`,
      summary: template.summary || 'Indispo externe',
      source: providerId,
      providerId,
      origin: 'external'
    };
  };

  let calendarState = loadCalendarState();

  const refreshProviderBusy = (providerId) => {
    const providerState = calendarState.providers[providerId];
    if (!providerState) return;
    const templates = SAMPLE_BUSY[providerId] || [];
    const imported = templates.map((tpl, idx) =>
      buildBusyFromTemplate(providerId, tpl, idx)
    );
    providerState.connected = true;
    providerState.busy = [
      ...providerState.busy.filter((evt) => evt.origin === 'booking'),
      ...imported
    ];
    providerState.lastSync = new Date().toISOString();
    calendarState.lastFullSync = providerState.lastSync;
    saveCalendarState(calendarState);
  };

  const getBusyForDate = (dateStr, ignoreCode) => {
    const busy = [];
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);

    Object.entries(calendarState.providers || {}).forEach(
      ([providerId, providerState]) => {
        if (
          !providerState ||
          !providerState.connected ||
          providerState.autoPull === false
        ) {
          return;
        }
        providerState.busy.forEach((evt) => {
          if (ignoreCode && evt.bookingCode === ignoreCode) return;
          const start = new Date(evt.start);
          const end = new Date(evt.end);
          if (isNaN(start) || isNaN(end)) return;
          if (end < dayStart || start > dayEnd) return;
          busy.push({
            start: Math.max(0, start.getHours() * 60 + start.getMinutes()),
            end: Math.min(24 * 60, end.getHours() * 60 + end.getMinutes()),
            source: evt.source || providerId,
            providerId,
            summary: evt.summary || 'Indispo externe',
            bookingCode: evt.bookingCode || null,
            origin: evt.origin || 'external'
          });
        });
      }
    );

    return busy;
  };

  const pushBooking = (booking) => {
    if (!booking || booking.status === 'cancelled') {
      return;
    }

    CALENDAR_PROVIDERS.forEach(({ id }) => {
      const providerState = calendarState.providers[id];
      if (!providerState || !providerState.connected || providerState.autoPush === false) {
        return;
      }

      providerState.busy = providerState.busy.filter(
        (evt) => evt.bookingCode !== booking.code
      );

      const endTime = minutesToTime(
        timeToMinutes(booking.time) + booking.duration
      );
      providerState.busy.push({
        id: `${booking.code}-${id}`,
        bookingCode: booking.code,
        start: `${booking.date}T${booking.time}:00`,
        end: `${booking.date}T${endTime}:00`,
        summary: `${booking.serviceName} - ${booking.name}`,
        source: id,
        providerId: id,
        origin: 'booking'
      });
      providerState.lastSync = new Date().toISOString();
      calendarState.lastFullSync = providerState.lastSync;
    });

    saveCalendarState(calendarState);
  };

  const removeBooking = (booking) => {
    CALENDAR_PROVIDERS.forEach(({ id }) => {
      const providerState = calendarState.providers[id];
      if (!providerState) return;
      providerState.busy = providerState.busy.filter(
        (evt) => evt.bookingCode !== booking.code
      );
      if (providerState.connected) {
        providerState.lastSync = new Date().toISOString();
        calendarState.lastFullSync = providerState.lastSync;
      }
    });
    saveCalendarState(calendarState);
  };

  const pushExistingBookings = () => {
    const bookings = loadBookings().filter((b) => b.status !== 'cancelled');
    bookings.forEach((booking) => pushBooking(booking));
  };

  const connectProvider = (providerId) => {
    refreshProviderBusy(providerId);
    pushExistingBookings();
  };

  const disconnectProvider = (providerId) => {
    const providerState = calendarState.providers[providerId];
    if (!providerState) return;
    providerState.connected = false;
    saveCalendarState(calendarState);
  };

  const syncAllProviders = () => {
    CALENDAR_PROVIDERS.forEach(({ id }) => {
      const providerState = calendarState.providers[id];
      if (providerState && providerState.connected) {
        refreshProviderBusy(id);
      }
    });
    pushExistingBookings();
  };

  const getState = () => calendarState;

  window.ACCalendarSync = {
    CALENDAR_PROVIDERS,
    getState,
    getBusyForDate,
    pushBooking,
    removeBooking,
    pushExistingBookings,
    connectProvider,
    disconnectProvider,
    syncAllProviders,
    refreshProviderBusy,
    getProviderMeta,
    formatLastSync
  };

  registerCalendarBusyProvider(getBusyForDate);
})(window);
