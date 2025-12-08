(function() {
  'use strict';

  const bookingForm = document.getElementById('bookingForm');
  if (!bookingForm) return;

  const serviceSelect = document.getElementById('serviceSelect');
  const serviceDetails = document.getElementById('serviceDetails');
  const dateInput = document.getElementById('dateInput');
  const slotList = document.getElementById('slotList');
  const slotError = document.getElementById('slotError');
  const slotHint = document.getElementById('slotHint');
  const refreshSlotsBtn = document.getElementById('refreshSlots');

  const nameInput = document.getElementById('nameInput');
  const emailInput = document.getElementById('emailInput');
  const phoneInput = document.getElementById('phoneInput');
  const cardNumber = document.getElementById('cardNumber');
  const cardExpiry = document.getElementById('cardExpiry');
  const cardCvc = document.getElementById('cardCvc');
  const emailNotif = document.getElementById('emailNotif');
  const smsNotif = document.getElementById('smsNotif');

  const depositAmount = document.getElementById('depositAmount');
  const depositAmountInline = document.getElementById('depositAmountInline');
  const depositLabel = document.getElementById('depositLabel');

  const liveSummary = document.getElementById('liveSummary');
  const weeklySlots = document.getElementById('weeklySlots');

  const bookingConfirmation = document.getElementById('bookingConfirmation');
  const confirmationDetails = document.getElementById('confirmationDetails');

  const manageForm = document.getElementById('manageForm');
  const manageCode = document.getElementById('manageCode');
  const manageEmail = document.getElementById('manageEmail');
  const manageResult = document.getElementById('manageResult');
  const bookingStatusBadge = document.getElementById('bookingStatusBadge');
  const bookingDetails = document.getElementById('bookingDetails');
  const rescheduleBtn = document.getElementById('rescheduleBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const reschedulePanel = document.getElementById('reschedulePanel');
  const reschedulePlaceholder = document.getElementById('reschedulePlaceholder');
  const rescheduleDate = document.getElementById('rescheduleDate');
  const rescheduleSlots = document.getElementById('rescheduleSlots');
  const refreshReschedule = document.getElementById('refreshReschedule');
  const confirmReschedule = document.getElementById('confirmReschedule');

  const calendarProvidersContainer = document.getElementById('calendarProviders');
  const calendarBusyList = document.getElementById('calendarBusyList');
  const calendarBusyCount = document.getElementById('busyCountBadge');
  const calendarSyncStatus = document.getElementById('calendarSyncStatus');
  const syncCalendarsBtn = document.getElementById('syncCalendarsBtn');

  const STORAGE_KEY = 'ac-bookings';
  const OPENING = { start: 8 * 60 + 30, end: 18 * 60, breakStart: 12 * 60, breakEnd: 13 * 60 };
  const SLOT_STEP = 30; // minutes
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

  const services = [
    { id: 'diag', name: 'Diagnostic et audit', duration: 30, price: 40, depositRate: 0.3 },
    { id: 'urgence', name: 'Intervention urgente', duration: 45, price: 120, depositRate: 0.4 },
    { id: 'maintenance', name: 'Maintenance planifiée', duration: 60, price: 80, depositRate: 0.3 },
    { id: 'installation', name: 'Installation / mise en service', duration: 90, price: 160, depositRate: 0.35 }
  ];

  let selectedTime = null;
  let selectedRescheduleTime = null;
  let currentBooking = null;
  let calendarState = null;

  const formatTwo = (val) => val.toString().padStart(2, '0');
  const formatCurrency = (val) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  const toISODate = (date) => {
    const y = date.getFullYear();
    const m = formatTwo(date.getMonth() + 1);
    const d = formatTwo(date.getDate());
    return `${y}-${m}-${d}`;
  };

  const formatDateLabel = (dateStr) => {
    try {
      const date = new Date(`${dateStr}T00:00:00`);
      return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }).format(date);
    } catch (error) {
      return dateStr;
    }
  };

  const minutesToTime = (minutes) => `${formatTwo(Math.floor(minutes / 60))}:${formatTwo(minutes % 60)}`;
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

  const defaultCalendarState = () => ({
    providers: CALENDAR_PROVIDERS.reduce((acc, provider) => {
      acc[provider.id] = { connected: false, busy: [], lastSync: null, autoPush: true, autoPull: true };
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

  const getProviderMeta = (id) => CALENDAR_PROVIDERS.find((p) => p.id === id) || { label: id, accent: '#94a3b8', icon: 'fas fa-calendar' };

  const formatLastSync = (iso) => {
    if (!iso) return 'Jamais synchronisé';
    try {
      return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch (error) {
      return 'Jamais synchronisé';
    }
  };

  const buildBusyFromTemplate = (providerId, template, index) => {
    const base = new Date();
    const day = new Date(base);
    day.setDate(base.getDate() + template.dayOffset);
    const startTime = template.start || '09:00';
    const endTime = minutesToTime(timeToMinutes(startTime) + (template.duration || 60));
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

  calendarState = loadCalendarState();

  const refreshProviderBusy = (providerId) => {
    const providerState = calendarState.providers[providerId];
    if (!providerState) return;
    const templates = SAMPLE_BUSY[providerId] || [];
    const imported = templates.map((tpl, idx) => buildBusyFromTemplate(providerId, tpl, idx));
    providerState.connected = true;
    providerState.busy = [
      ...providerState.busy.filter((evt) => evt.origin === 'booking'),
      ...imported
    ];
    providerState.lastSync = new Date().toISOString();
    calendarState.lastFullSync = providerState.lastSync;
    saveCalendarState(calendarState);
  };

  const pushBookingToProviders = (booking) => {
    CALENDAR_PROVIDERS.forEach(({ id }) => {
      const providerState = calendarState.providers[id];
      if (!providerState || !providerState.connected || providerState.autoPush === false) return;
      providerState.busy = providerState.busy.filter((evt) => evt.bookingCode !== booking.code);
      const endTime = minutesToTime(timeToMinutes(booking.time) + booking.duration);
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

  const removeBookingFromProviders = (booking) => {
    CALENDAR_PROVIDERS.forEach(({ id }) => {
      const providerState = calendarState.providers[id];
      if (!providerState) return;
      providerState.busy = providerState.busy.filter((evt) => evt.bookingCode !== booking.code);
      if (providerState.connected) {
        providerState.lastSync = new Date().toISOString();
        calendarState.lastFullSync = providerState.lastSync;
      }
    });
    saveCalendarState(calendarState);
  };

  const pushExistingBookings = () => {
    const bookings = loadBookings().filter((b) => b.status !== 'cancelled');
    bookings.forEach((booking) => pushBookingToProviders(booking));
  };

  const getCalendarBusyForDate = (dateStr, ignoreCode) => {
    const busy = [];
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);
    Object.entries(calendarState.providers || {}).forEach(([providerId, providerState]) => {
      if (!providerState || !providerState.connected || providerState.autoPull === false) return;
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
    });
    return busy;
  };

  const getServiceById = (id) => services.find((s) => s.id === id);

  const computeDeposit = (service) => Math.round(service.price * service.depositRate);

  const statusLabel = (status) => {
    if (status === 'cancelled') return 'Annulé';
    if (status === 'rescheduled') return 'Modifié';
    return 'Confirmé';
  };

  const statusClass = (status) => {
    if (status === 'cancelled') return 'badge status-cancelled';
    if (status === 'rescheduled') return 'badge status-rescheduled';
    return 'badge status-confirmed';
  };

  const notify = (message) => {
    if (!bookingConfirmation || !confirmationDetails) return;
    bookingConfirmation.classList.remove('d-none');
    confirmationDetails.textContent = message;
  };

  const setMinDate = (input) => {
    if (!input) return;
    const today = new Date();
    const iso = toISODate(today);
    input.min = iso;
    if (!input.value) input.value = iso;
  };

  const getBusyWindows = (dateStr, ignoreCode) => {
    const bookingBusy = loadBookings()
      .filter((b) => b.date === dateStr && b.status !== 'cancelled' && b.code !== ignoreCode)
      .map((b) => ({
        start: timeToMinutes(b.time),
        end: timeToMinutes(b.time) + b.duration,
        source: 'booking',
        providerId: 'artisan',
        summary: b.serviceName,
        bookingCode: b.code,
        origin: 'booking'
      }));
    const calendarBusy = getCalendarBusyForDate(dateStr, ignoreCode);
    return [...bookingBusy, ...calendarBusy];
  };

  const generateSlots = (dateStr, duration, ignoreCode) => {
    if (!dateStr || !duration) return [];
    const busyWindows = getBusyWindows(dateStr, ignoreCode);
    const slots = [];
    for (let minutes = OPENING.start; minutes + duration <= OPENING.end; minutes += SLOT_STEP) {
      if (minutes >= OPENING.breakStart && minutes < OPENING.breakEnd) continue;
      const start = minutes;
      const end = minutes + duration;
      const blockers = busyWindows.filter((b) => start < b.end && end > b.start);
      slots.push({ time: minutesToTime(minutes), available: !blockers.length, blockedBy: blockers });
    }
    return slots;
  };

  const isSlotAvailable = (dateStr, timeStr, duration, ignoreCode) => {
    const slots = generateSlots(dateStr, duration, ignoreCode);
    return slots.some((slot) => slot.time === timeStr && slot.available);
  };

  const updateServiceDisplay = () => {
    const service = getServiceById(serviceSelect.value);
    if (!service) return;
    const deposit = computeDeposit(service);
    const percent = Math.round(service.depositRate * 100);
    depositAmount.textContent = formatCurrency(deposit);
    depositAmountInline.textContent = `${formatCurrency(deposit)} (${percent}%)`;
    depositLabel.textContent = `${percent}%`;
    if (serviceDetails) {
      serviceDetails.textContent = `Durée ${service.duration} min - ${service.price} €`;
    }
    updateLiveSummary();
  };

  const updateLiveSummary = () => {
    if (!liveSummary) return;
    const service = getServiceById(serviceSelect.value);
    const values = liveSummary.querySelectorAll('strong');
    const deposit = service ? computeDeposit(service) : null;
    if (values[0]) values[0].textContent = service ? service.name : '--';
    if (values[1]) values[1].textContent = service ? `${service.duration} min` : '--';
    if (values[2]) values[2].textContent = selectedTime ? `${formatDateLabel(dateInput.value)} - ${selectedTime}` : '--';
    if (values[3]) values[3].textContent = deposit ? formatCurrency(deposit) : '--';
  };

  const renderSlots = (container, dateStr, duration, selectedValue, ignoreCode, onSelect) => {
    if (!container) return [];
    container.innerHTML = '';
    const slots = generateSlots(dateStr, duration, ignoreCode);
    if (!slots.length) {
      container.innerHTML = '<span class="text-muted small">Aucun créneau ouvert pour cette date.</span>';
      return slots;
    }
    slots.forEach((slot) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = slot.time;
      btn.className = 'slot-button';
      if (!slot.available) {
        btn.classList.add('disabled');
        btn.disabled = true;
        if (slot.blockedBy && slot.blockedBy.length) {
          const sources = [...new Set(slot.blockedBy.map((b) => (getProviderMeta(b.providerId || b.source)).label || b.source))];
          btn.title = `Indisponible (${sources.join(' / ')})`;
        }
      }
      if (slot.time === selectedValue) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        if (typeof onSelect === 'function') onSelect(slot.time);
        container.querySelectorAll('.slot-button').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      container.appendChild(btn);
    });
    return slots;
  };

  const renderWeeklySlots = () => {
    if (!weeklySlots) return;
    const service = getServiceById(serviceSelect.value) || services[0];
    const today = new Date();
    weeklySlots.innerHTML = '';

    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      const dateStr = toISODate(day);
      const slots = generateSlots(dateStr, service.duration);
      const card = document.createElement('div');
      card.className = 'weekly-day';

      const title = document.createElement('h6');
      title.textContent = `${formatDateLabel(dateStr)}`;
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'small text-muted mb-1';
      meta.textContent = `${slots.filter((s) => s.available).length} créneaux libres`;
      card.appendChild(meta);

      if (!slots.length) {
        const empty = document.createElement('div');
        empty.className = 'text-muted small';
        empty.textContent = 'Complet ou fermé';
        card.appendChild(empty);
      } else {
        const topSlots = slots.filter((s) => s.available).slice(0, 3);
        if (!topSlots.length) {
          const noSlot = document.createElement('div');
          noSlot.className = 'text-muted small';
          noSlot.textContent = 'Déjà réservé';
          card.appendChild(noSlot);
        } else {
          topSlots.forEach((slot) => {
            const chip = document.createElement('span');
            chip.className = 'slot-chip';
            chip.innerHTML = `<i class="fas fa-clock"></i> ${slot.time}`;
            card.appendChild(chip);
          });
        }
      }
      weeklySlots.appendChild(card);
    }
  };

  const renderBusyListForDate = (dateStr) => {
    if (!calendarBusyList) return;
    const busyEvents = getCalendarBusyForDate(dateStr).sort((a, b) => a.start - b.start);
    if (calendarBusyCount) {
      calendarBusyCount.textContent = busyEvents.length.toString();
    }
    if (!busyEvents.length) {
      calendarBusyList.innerHTML = '<div class="text-muted small">Aucune indisponibilité importée.</div>';
      return;
    }
    calendarBusyList.innerHTML = '';
    busyEvents.forEach((evt) => {
      const meta = getProviderMeta(evt.providerId || evt.source);
      const row = document.createElement('div');
      row.className = 'busy-pill';
      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="fw-semibold">${evt.summary}</div>
            <div class="small text-muted"><span class="busy-time">${minutesToTime(evt.start)} - ${minutesToTime(evt.end)}</span> · ${meta.label}</div>
          </div>
          <span class="provider-dot" style="background:${meta.accent}"></span>
        </div>
      `;
      calendarBusyList.appendChild(row);
    });
  };

  const renderSlotsForBooking = () => {
    const service = getServiceById(serviceSelect.value);
    if (!service) return;
    const slots = renderSlots(
      slotList,
      dateInput.value,
      service.duration,
      selectedTime,
      undefined,
      (time) => {
        selectedTime = time;
        slotError.style.display = 'none';
        slotError.textContent = 'Veuillez choisir un créneau libre.';
        updateLiveSummary();
      }
    );
    if (slotHint) {
      const available = slots.filter((s) => s.available).length;
      const busyCount = getCalendarBusyForDate(dateInput.value).length;
      const extra = busyCount ? ` · ${busyCount} indispos importées` : '';
      slotHint.textContent = available > 0 ? `${available} créneaux ouverts${extra}` : 'Aucun créneau libre ce jour';
    }
    renderBusyListForDate(dateInput.value);
  };

  const updateCalendarSyncStatus = () => {
    if (!calendarSyncStatus) return;
    const connected = CALENDAR_PROVIDERS.filter(({ id }) => {
      const provider = calendarState.providers[id];
      return provider && provider.connected;
    });
    if (!connected.length) {
      calendarSyncStatus.textContent = 'Aucun calendrier connecté. Activez Google, Outlook ou Apple pour bloquer les indispos.';
      return;
    }
    const labels = connected.map((p) => p.label).join(' · ');
    const last = calendarState.lastFullSync ? `Dern. sync ${formatLastSync(calendarState.lastFullSync)}` : 'Sync en attente';
    calendarSyncStatus.textContent = `${labels} connectés. ${last}.`;
  };

  const connectProvider = (providerId) => {
    refreshProviderBusy(providerId);
    pushExistingBookings();
    renderCalendarSyncUI();
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
  };

  const disconnectProvider = (providerId) => {
    const provider = calendarState.providers[providerId];
    if (!provider) return;
    provider.connected = false;
    saveCalendarState(calendarState);
    renderCalendarSyncUI();
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
  };

  const syncAllProviders = () => {
    CALENDAR_PROVIDERS.forEach(({ id }) => {
      const provider = calendarState.providers[id];
      if (provider && provider.connected) {
        refreshProviderBusy(id);
      }
    });
    pushExistingBookings();
    renderCalendarSyncUI();
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
  };

  const renderCalendarSyncUI = () => {
    if (!calendarProvidersContainer) return;
    calendarProvidersContainer.innerHTML = '';
    CALENDAR_PROVIDERS.forEach((provider) => {
      const state = calendarState.providers[provider.id];
      const row = document.createElement('div');
      row.className = 'calendar-provider';
      row.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="provider-dot" style="background:${provider.accent}"></span>
          <div>
            <div class="fw-semibold">${provider.label}</div>
            <div class="small text-muted">${state.connected ? `Connecté · ${formatLastSync(state.lastSync)}` : 'Non connecté'}</div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <div class="form-check form-switch mb-0">
            <input class="form-check-input provider-toggle" type="checkbox" role="switch" data-provider="${provider.id}" ${state.connected ? 'checked' : ''} aria-label="Activer ${provider.label}">
          </div>
          <button class="btn btn-light btn-sm provider-resync" data-provider="${provider.id}" title="Resynchroniser ${provider.label}"><i class="fas fa-rotate"></i></button>
        </div>
      `;
      calendarProvidersContainer.appendChild(row);
    });
    calendarProvidersContainer.querySelectorAll('.provider-toggle').forEach((input) => {
      input.addEventListener('change', (event) => {
        const id = event.target.getAttribute('data-provider');
        if (event.target.checked) {
          connectProvider(id);
        } else {
          disconnectProvider(id);
        }
      });
    });
    calendarProvidersContainer.querySelectorAll('.provider-resync').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-provider');
        connectProvider(id);
        refreshProviderBusy(id);
        renderSlotsForBooking();
        renderBusyListForDate(dateInput.value);
        renderWeeklySlots();
      });
    });
    updateCalendarSyncStatus();
  };

  const resetFormState = () => {
    bookingForm.classList.remove('was-validated');
    selectedTime = null;
    bookingForm.reset();
    serviceSelect.value = services[0].id;
    emailNotif.checked = true;
    smsNotif.checked = true;
    slotError.style.display = 'none';
    slotError.textContent = 'Veuillez choisir un créneau libre.';
    setMinDate(dateInput);
    updateServiceDisplay();
    renderSlotsForBooking();
    updateLiveSummary();
  };

  const isPaymentValid = () => {
    const number = cardNumber.value.replace(/\s+/g, '');
    const expiry = cardExpiry.value.trim();
    const cvc = cardCvc.value.trim();
    const numberOk = number.length >= 12;
    const expiryOk = /^\d{2}\/?\d{2}$/.test(expiry);
    const cvcOk = cvc.length >= 3;
    cardNumber.classList.toggle('is-invalid', !numberOk);
    cardExpiry.classList.toggle('is-invalid', !expiryOk);
    cardCvc.classList.toggle('is-invalid', !cvcOk);
    return numberOk && expiryOk && cvcOk;
  };

  const createCode = () => `AC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const joinNotifications = (notif) => {
    const parts = [];
    if (notif.email) parts.push('Email');
    if (notif.sms) parts.push('SMS');
    return parts.length ? parts.join(' + ') : 'Aucune';
  };

  // Booking submission
  bookingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const service = getServiceById(serviceSelect.value);
    if (!service) return;

    bookingConfirmation.classList.add('d-none');
    bookingForm.classList.add('was-validated');

    if (!selectedTime) {
      slotError.style.display = 'block';
      slotError.textContent = 'Veuillez choisir un créneau libre.';
      return;
    }

    if (!bookingForm.checkValidity() || !isPaymentValid()) {
      return;
    }

    const date = dateInput.value;
    if (!isSlotAvailable(date, selectedTime, service.duration)) {
      slotError.textContent = 'Créneau déjà réservé, choisissez-en un autre.';
      slotError.style.display = 'block';
      renderSlotsForBooking();
      return;
    }

    const booking = {
      code: createCode(),
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration,
      price: service.price,
      deposit: computeDeposit(service),
      depositRate: service.depositRate,
      date,
      time: selectedTime,
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      notifications: { email: emailNotif.checked, sms: smsNotif.checked },
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    const bookings = loadBookings();
    bookings.push(booking);
    saveBookings(bookings);
    pushBookingToProviders(booking);

    notify(
      `${booking.name} - ${booking.serviceName} le ${formatDateLabel(booking.date)} à ${booking.time}. Acompte de ${formatCurrency(booking.deposit)} enregistré. Code : ${booking.code}.`
    );
    manageCode.value = booking.code;
    manageEmail.value = booking.email;

    resetFormState();
    renderWeeklySlots();
  });

  // Manage section
  const renderBookingDetails = (booking) => {
    bookingDetails.innerHTML = `
      <li><strong>Service</strong> : ${booking.serviceName}</li>
      <li><strong>Créneau</strong> : ${formatDateLabel(booking.date)} - ${booking.time}</li>
      <li><strong>Acompte</strong> : ${formatCurrency(booking.deposit)} (${Math.round(booking.depositRate * 100)}%)</li>
      <li><strong>Notifications</strong> : ${joinNotifications(booking.notifications)}</li>
      <li><strong>Code</strong> : ${booking.code}</li>
    `;
  };

  const showBooking = (booking) => {
    currentBooking = booking;
    manageResult.classList.remove('d-none');
    bookingStatusBadge.className = statusClass(booking.status);
    bookingStatusBadge.textContent = statusLabel(booking.status);
    renderBookingDetails(booking);
    rescheduleBtn.disabled = booking.status === 'cancelled';
    cancelBtn.disabled = booking.status === 'cancelled';
    reschedulePanel.classList.add('d-none');
    reschedulePlaceholder.classList.remove('d-none');
    selectedRescheduleTime = null;
    rescheduleDate.value = booking.date;
  };

  manageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = manageCode.value.trim().toUpperCase();
    const email = manageEmail.value.trim().toLowerCase();
    const bookings = loadBookings();
    const booking = bookings.find(
      (b) => b.code === code && b.email.toLowerCase() === email
    );

    if (!booking) {
      manageResult.classList.remove('d-none');
      bookingStatusBadge.className = 'badge status-cancelled';
      bookingStatusBadge.textContent = 'Introuvable';
      bookingDetails.innerHTML = '<li class="text-danger">Aucune réservation trouvée.</li>';
      reschedulePanel.classList.add('d-none');
      return;
    }

    showBooking(booking);
  });

  cancelBtn.addEventListener('click', () => {
    if (!currentBooking) return;
    const bookings = loadBookings();
    const idx = bookings.findIndex((b) => b.code === currentBooking.code);
    if (idx === -1) return;
    bookings[idx].status = 'cancelled';
    bookings[idx].updatedAt = new Date().toISOString();
    currentBooking = bookings[idx];
    saveBookings(bookings);
    removeBookingFromProviders(currentBooking);
    pushBookingToProviders(currentBooking);
    showBooking(currentBooking);
    notify(`Rendez-vous ${currentBooking.code} annulé. Le créneau est libéré.`);
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
  });

  const renderRescheduleWarning = (text) => {
    const existing = rescheduleSlots.querySelector('.reschedule-warning');
    if (existing) existing.remove();
    rescheduleSlots.insertAdjacentHTML('beforeend', `<div class="text-danger small reschedule-warning">${text}</div>`);
  };

  const renderReschedule = () => {
    if (!currentBooking) return;
    setMinDate(rescheduleDate);
    renderSlots(
      rescheduleSlots,
      rescheduleDate.value || currentBooking.date,
      currentBooking.duration,
      selectedRescheduleTime,
      currentBooking.code,
      (time) => {
        selectedRescheduleTime = time;
        const warn = rescheduleSlots.querySelector('.reschedule-warning');
        if (warn) warn.remove();
      }
    );
  };

  rescheduleBtn.addEventListener('click', () => {
    if (!currentBooking) return;
    reschedulePanel.classList.remove('d-none');
    reschedulePlaceholder.classList.add('d-none');
    rescheduleDate.value = currentBooking.date;
    selectedRescheduleTime = null;
    renderReschedule();
  });

  refreshReschedule.addEventListener('click', renderReschedule);

  confirmReschedule.addEventListener('click', () => {
    if (!currentBooking) return;
    const newDate = rescheduleDate.value || currentBooking.date;
    if (!selectedRescheduleTime) {
      renderRescheduleWarning('Choisissez un créneau.');
      return;
    }

    if (!isSlotAvailable(newDate, selectedRescheduleTime, currentBooking.duration, currentBooking.code)) {
      renderRescheduleWarning('Créneau indisponible.');
      renderReschedule();
      return;
    }

    const bookings = loadBookings();
    const idx = bookings.findIndex((b) => b.code === currentBooking.code);
    if (idx === -1) return;

    bookings[idx].date = newDate;
    bookings[idx].time = selectedRescheduleTime;
    bookings[idx].status = 'rescheduled';
    bookings[idx].updatedAt = new Date().toISOString();
    currentBooking = bookings[idx];
    saveBookings(bookings);
    removeBookingFromProviders(currentBooking);
    pushBookingToProviders(currentBooking);
    showBooking(currentBooking);
    notify(`Rendez-vous ${currentBooking.code} déplacé au ${formatDateLabel(newDate)} à ${selectedRescheduleTime}.`);
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
    reschedulePanel.classList.add('d-none');
    reschedulePlaceholder.classList.remove('d-none');
  });

  // Events
  serviceSelect.addEventListener('change', () => {
    updateServiceDisplay();
    selectedTime = null;
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
  });

  dateInput.addEventListener('change', () => {
    selectedTime = null;
    renderSlotsForBooking();
  });

  refreshSlotsBtn.addEventListener('click', () => {
    selectedTime = null;
    renderSlotsForBooking();
  });

  if (syncCalendarsBtn) {
    syncCalendarsBtn.addEventListener('click', () => {
      syncAllProviders();
    });
  }

  // Init
  services.forEach((service) => {
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.name} - ${service.duration} min - ${service.price} €`;
    serviceSelect.appendChild(option);
  });

  serviceSelect.value = services[0].id;
  setMinDate(dateInput);
  setMinDate(rescheduleDate);
  pushExistingBookings();
  renderCalendarSyncUI();
  syncAllProviders();
  updateServiceDisplay();
  renderSlotsForBooking();
  renderWeeklySlots();
  updateLiveSummary();
})();
