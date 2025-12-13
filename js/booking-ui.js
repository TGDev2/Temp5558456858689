(function (window) {
  'use strict';

  const bookingForm = document.getElementById('bookingForm');
  if (!bookingForm) return;

  const ACBooking = window.ACBooking;
  const ACApi = window.ACApi;

  if (!ACBooking) {
    console.error('ACBooking non initialisé');
    return;
  }

  if (!ACApi) {
    console.error('ACApi non initialisé');
    return;
  }

  const ACCalendarSync = window.ACCalendarSync || null;

  const {
    formatCurrency,
    toISODate,
    formatDateLabel,
    minutesToTime,
    timeToMinutes
  } = ACBooking;

  // Elements du DOM
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

  const calendarProvidersContainer = document.getElementById(
    'calendarProviders'
  );
  const calendarBusyList = document.getElementById('calendarBusyList');
  const calendarBusyCount = document.getElementById('busyCountBadge');
  const calendarSyncStatus = document.getElementById('calendarSyncStatus');
  const syncCalendarsBtn = document.getElementById('syncCalendarsBtn');

  // État local
  let services = [];
  let selectedTime = null;
  let selectedRescheduleTime = null;
  let currentBooking = null;

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

  const getServiceById = (id) =>
    services.find((service) => service.id === id) || null;

  const computeDeposit = (service) => {
    if (!service) return 0;
    const price =
      typeof service.price === 'number'
        ? service.price
        : (service.basePriceCents || 0) / 100;
    return Math.round(price * (service.depositRate || 0));
  };

  const updateServiceDisplay = () => {
    const service = getServiceById(serviceSelect.value);
    if (!service) {
      depositAmount.textContent = '-- €';
      depositAmountInline.textContent = '-- €';
      depositLabel.textContent = '--';
      if (serviceDetails) {
        serviceDetails.textContent = '';
      }
      return;
    }

    const deposit = computeDeposit(service);
    const percent = Math.round((service.depositRate || 0) * 100);

    depositAmount.textContent = formatCurrency(deposit);
    depositAmountInline.textContent = `${formatCurrency(
      deposit
    )} (${percent}%)`;
    depositLabel.textContent = `${percent}%`;

    if (serviceDetails) {
      const price =
        typeof service.price === 'number'
          ? service.price
          : (service.basePriceCents || 0) / 100;
      const duration =
        typeof service.duration === 'number'
          ? service.duration
          : service.durationMinutes;
      serviceDetails.textContent = `Durée ${duration} min - ${price} €`;
    }

    updateLiveSummary();
  };

  const updateLiveSummary = () => {
    if (!liveSummary) return;
    const service = getServiceById(serviceSelect.value);
    const values = liveSummary.querySelectorAll('strong');
    const deposit = service ? computeDeposit(service) : null;

    if (values[0]) values[0].textContent = service ? service.name : '--';
    if (values[1]) {
      const duration =
        service && (service.duration || service.durationMinutes)
          ? service.duration || service.durationMinutes
          : null;
      values[1].textContent = duration ? `${duration} min` : '--';
    }
    if (values[2]) {
      values[2].textContent = selectedTime
        ? `${formatDateLabel(dateInput.value)} - ${selectedTime}`
        : '--';
    }
    if (values[3]) {
      values[3].textContent = deposit ? formatCurrency(deposit) : '--';
    }
  };

  const renderSlots = (container, slots, selectedValue, onSelect) => {
    if (!container) return [];
    container.innerHTML = '';

    if (!slots || !slots.length) {
      container.innerHTML =
        '<span class="text-muted small">Aucun créneau ouvert pour cette date.</span>';
      return [];
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
          const sources = [
            ...new Set(
              slot.blockedBy.map((b) => {
                if (
                  ACCalendarSync &&
                  typeof ACCalendarSync.getProviderMeta === 'function' &&
                  b.providerId
                ) {
                  const meta = ACCalendarSync.getProviderMeta(b.providerId);
                  return meta.label || b.providerId;
                }
                if (b.summary) return b.summary;
                return 'Indisponible';
              })
            )
          ];
          btn.title = `Indisponible (${sources.join(' / ')})`;
        }
      }

      if (slot.time === selectedValue) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        if (typeof onSelect === 'function' && slot.available) {
          onSelect(slot.time);
        }
        container
          .querySelectorAll('.slot-button')
          .forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });

      container.appendChild(btn);
    });

    return slots;
  };

  const renderBusyListForDate = (dateStr) => {
    if (!calendarBusyList) return;

    if (!ACCalendarSync) {
      calendarBusyList.innerHTML =
        '<div class="text-muted small">Synchronisation calendrier non activée.</div>';
      if (calendarBusyCount) {
        calendarBusyCount.textContent = '0';
      }
      return;
    }

    const busyEvents = ACCalendarSync.getBusyForDate(dateStr)
      .slice()
      .sort((a, b) => a.start - b.start);

    if (calendarBusyCount) {
      calendarBusyCount.textContent = busyEvents.length.toString();
    }

    if (!busyEvents.length) {
      calendarBusyList.innerHTML =
        '<div class="text-muted small">Aucune indisponibilité importée.</div>';
      return;
    }

    calendarBusyList.innerHTML = '';
    busyEvents.forEach((evt) => {
      const meta = ACCalendarSync.getProviderMeta(evt.providerId || evt.source);
      const row = document.createElement('div');
      row.className = 'busy-pill';
      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="fw-semibold">${evt.summary}</div>
            <div class="small text-muted">
              <span class="busy-time">${minutesToTime(
                evt.start
              )} - ${minutesToTime(evt.end)}</span> · ${meta.label}
            </div>
          </div>
          <span class="provider-dot" style="background:${meta.accent}"></span>
        </div>
      `;
      calendarBusyList.appendChild(row);
    });
  };

  const renderWeeklySlots = async () => {
    if (!weeklySlots || !services.length) return;

    const service = getServiceById(serviceSelect.value) || services[0];
    const today = new Date();
    weeklySlots.innerHTML = '';

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      const dateStr = toISODate(day);

      const card = document.createElement('div');
      card.className = 'weekly-day';

      const title = document.createElement('h6');
      title.textContent = `${formatDateLabel(dateStr)}`;
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'small text-muted mb-1';
      meta.textContent = 'Chargement des créneaux...';
      card.appendChild(meta);

      weeklySlots.appendChild(card);

      try {
        const { slots } = await ACApi.getAvailability({
          serviceId: service.id,
          date: dateStr
        });

        const availableSlots = (slots || []).filter((s) => s.available);
        meta.textContent = `${availableSlots.length} créneaux libres`;

        if (!slots || !slots.length) {
          const empty = document.createElement('div');
          empty.className = 'text-muted small';
          empty.textContent = 'Complet ou fermé';
          card.appendChild(empty);
        } else {
          const topSlots = availableSlots.slice(0, 3);
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
      } catch (error) {
        console.error('Erreur lors du chargement des créneaux hebdomadaires', error);
        meta.textContent = 'Erreur de chargement.';
      }
    }
  };

  const updateCalendarSyncStatus = () => {
    if (!calendarSyncStatus) return;

    if (!ACCalendarSync) {
      calendarSyncStatus.textContent =
        'Synchronisation calendrier non disponible.';
      return;
    }

    const state = ACCalendarSync.getState();
    const providers = ACCalendarSync.CALENDAR_PROVIDERS || [];
    const connected = providers.filter(({ id }) => {
      const provider = state.providers && state.providers[id];
      return provider && provider.connected;
    });

    if (!connected.length) {
      calendarSyncStatus.textContent =
        'Aucun calendrier connecté. Activez Google, Outlook ou Apple pour bloquer les indispos.';
      return;
    }

    const labels = connected.map((p) => p.label).join(' · ');
    const last = state.lastFullSync
      ? `Dern. sync ${ACCalendarSync.formatLastSync(state.lastFullSync)}`
      : 'Sync en attente';
    calendarSyncStatus.textContent = `${labels} connectés. ${last}.`;
  };

  const renderCalendarSyncUI = () => {
    if (!calendarProvidersContainer) return;

    if (!ACCalendarSync) {
      calendarProvidersContainer.innerHTML =
        '<div class="small text-muted">Synchronisation calendrier non disponible.</div>';
      updateCalendarSyncStatus();
      return;
    }

    const state = ACCalendarSync.getState();
    const providers = ACCalendarSync.CALENDAR_PROVIDERS || [];

    calendarProvidersContainer.innerHTML = '';

    providers.forEach((provider) => {
      const providerState = state.providers[provider.id] || {
        connected: false,
        lastSync: null
      };

      const row = document.createElement('div');
      row.className = 'calendar-provider';
      row.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="provider-dot" style="background:${provider.accent}"></span>
          <div>
            <div class="fw-semibold">${provider.label}</div>
            <div class="small text-muted">${
              providerState.connected
                ? `Connecté · ${ACCalendarSync.formatLastSync(
                    providerState.lastSync
                  )}`
                : 'Non connecté'
            }</div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <div class="form-check form-switch mb-0">
            <input class="form-check-input provider-toggle" type="checkbox" role="switch"
              data-provider="${provider.id}" ${
        providerState.connected ? 'checked' : ''
      }
              aria-label="Activer ${provider.label}">
          </div>
          <button class="btn btn-light btn-sm provider-resync" data-provider="${
            provider.id
          }"
            title="Resynchroniser ${provider.label}">
            <i class="fas fa-rotate"></i>
          </button>
        </div>
      `;

      calendarProvidersContainer.appendChild(row);
    });

    calendarProvidersContainer
      .querySelectorAll('.provider-toggle')
      .forEach((input) => {
        input.addEventListener('change', (event) => {
          const id = event.target.getAttribute('data-provider');
          if (!ACCalendarSync) return;
          if (event.target.checked) {
            ACCalendarSync.connectProvider(id);
          } else {
            ACCalendarSync.disconnectProvider(id);
          }
          renderCalendarSyncUI();
          renderSlotsForBooking();
          renderWeeklySlots();
          renderBusyListForDate(dateInput.value);
        });
      });

    calendarProvidersContainer
      .querySelectorAll('.provider-resync')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!ACCalendarSync) return;
          const id = btn.getAttribute('data-provider');
          ACCalendarSync.connectProvider(id);
          renderCalendarSyncUI();
          renderSlotsForBooking();
          renderBusyListForDate(dateInput.value);
          renderWeeklySlots();
        });
      });

    updateCalendarSyncStatus();
  };

  const renderSlotsForBooking = async () => {
    if (!slotList || !services.length) return;

    const service = getServiceById(serviceSelect.value) || services[0];

    if (!service || !dateInput.value) {
      slotList.innerHTML =
        '<span class="text-muted small">Sélectionnez un service et une date.</span>';
      return;
    }

    try {
      const response = await ACApi.getAvailability({
        serviceId: service.id,
        date: dateInput.value
      });

      const slots = renderSlots(
        slotList,
        response.slots || [],
        selectedTime,
        (time) => {
          selectedTime = time;
          if (slotError) {
            slotError.style.display = 'none';
            slotError.textContent = 'Veuillez choisir un créneau libre.';
          }
          updateLiveSummary();
        }
      );

      if (slotHint) {
        const available = (slots || []).filter((s) => s.available).length;
        const busyCount =
          ACCalendarSync &&
          typeof ACCalendarSync.getBusyForDate === 'function'
            ? ACCalendarSync.getBusyForDate(dateInput.value).length
            : 0;
        const extra = busyCount ? ` · ${busyCount} indispos importées` : '';
        slotHint.textContent = available
          ? `${available} créneaux ouverts${extra}`
          : 'Aucun créneau libre ce jour';
      }

      renderBusyListForDate(dateInput.value);
    } catch (error) {
      console.error('Erreur lors du chargement des créneaux', error);
      slotList.innerHTML =
        '<span class="text-danger small">Impossible de charger les créneaux pour cette date.</span>';
      if (slotHint) {
        slotHint.textContent =
          'Erreur de chargement des créneaux. Merci de réessayer.';
      }
    }
  };

  const resetFormState = () => {
    bookingForm.classList.remove('was-validated');
    selectedTime = null;
    bookingForm.reset();

    if (services.length) {
      serviceSelect.value = services[0].id;
    }

    emailNotif.checked = true;
    smsNotif.checked = true;

    if (slotError) {
      slotError.style.display = 'none';
      slotError.textContent = 'Veuillez choisir un créneau libre.';
    }

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

  const joinNotifications = (notif) => {
    const parts = [];
    if (notif.email) parts.push('Email');
    if (notif.sms) parts.push('SMS');
    return parts.length ? parts.join(' + ') : 'Aucune';
  };

  bookingForm.addEventListener('submit', async (event) => {
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

    let bookingResponse;
    try {
      bookingResponse = await ACApi.createBooking({
        serviceId: service.id,
        date,
        time: selectedTime,
        customer: {
          name: nameInput.value.trim(),
          email: emailInput.value.trim(),
          phone: phoneInput.value.trim()
        },
        notifications: { email: emailNotif.checked, sms: smsNotif.checked }
      });
    } catch (error) {
      if (error && error.code === 'SLOT_UNAVAILABLE') {
        slotError.textContent =
          'Créneau déjà réservé, choisissez-en un autre.';
        slotError.style.display = 'block';
        renderSlotsForBooking();
        return;
      }

      console.error('Erreur lors de la création de la réservation', error);
      slotError.textContent =
        'Impossible de valider ce créneau. Merci de réessayer ou de choisir un autre horaire.';
      slotError.style.display = 'block';
      return;
    }

    const booking = bookingResponse && bookingResponse.booking;
    if (!booking) {
      slotError.textContent =
        'La réservation a échoué pour une raison inconnue. Merci de réessayer.';
      slotError.style.display = 'block';
      return;
    }

    notify(
      `${booking.name} - ${booking.serviceName} le ${formatDateLabel(
        booking.date
      )} à ${booking.time}. Acompte de ${formatCurrency(
        booking.deposit
      )} enregistré. Code : ${booking.code}.`
    );
    manageCode.value = booking.code;
    manageEmail.value = booking.email;

    resetFormState();
    renderWeeklySlots();
  });

  const renderBookingDetails = (booking) => {
    bookingDetails.innerHTML = `
      <li><strong>Service</strong> : ${booking.serviceName}</li>
      <li><strong>Créneau</strong> : ${formatDateLabel(booking.date)} - ${
      booking.time
    }</li>
      <li><strong>Acompte</strong> : ${formatCurrency(
        booking.deposit
      )} (${Math.round(booking.depositRate * 100)}%)</li>
      <li><strong>Notifications</strong> : ${joinNotifications(
        booking.notifications
      )}</li>
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

  manageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = manageCode.value.trim();
    const email = manageEmail.value.trim();

    // Stocker l'email pour les appels cancel/reschedule
    window.lastManageEmail = email;

    let bookingResponse = null;
    try {
      bookingResponse = await ACApi.getBookingPublic({ code, email });
    } catch (error) {
      console.error('Erreur lors de la recherche de réservation', error);

      manageResult.classList.remove('d-none');
      bookingStatusBadge.className = 'badge status-cancelled';

      if (error && error.code === 'BOOKING_NOT_FOUND') {
        bookingStatusBadge.textContent = 'Introuvable';
        bookingDetails.innerHTML =
          '<li class="text-danger">Aucune réservation trouvée.</li>';
      } else {
        bookingStatusBadge.textContent = 'Erreur';
        bookingDetails.innerHTML =
          '<li class="text-danger">Une erreur est survenue. Merci de réessayer.</li>';
      }

      reschedulePanel.classList.add('d-none');
      reschedulePlaceholder.classList.remove('d-none');
      currentBooking = null;
      return;
    }

    const booking = bookingResponse && bookingResponse.booking;
    if (!booking) {
      manageResult.classList.remove('d-none');
      bookingStatusBadge.className = 'badge status-cancelled';
      bookingStatusBadge.textContent = 'Introuvable';
      bookingDetails.innerHTML =
        '<li class="text-danger">Aucune réservation trouvée.</li>';
      reschedulePanel.classList.add('d-none');
      reschedulePlaceholder.classList.remove('d-none');
      currentBooking = null;
      return;
    }

    showBooking(booking);
  });

  cancelBtn.addEventListener('click', async () => {
    if (!currentBooking) return;

    let response;
    try {
      response = await ACApi.cancelBooking({
        code: currentBooking.code,
        email: currentBooking.email
      });
    } catch (error) {
      console.error("Erreur lors de l’annulation de la réservation", error);
      notify(
        'Impossible d’annuler ce rendez-vous pour le moment. Merci de réessayer.'
      );
      return;
    }

    if (!response || !response.booking) {
      notify(
        'Impossible d’annuler ce rendez-vous pour le moment. Merci de réessayer.'
      );
      return;
    }

    currentBooking = response.booking;

    showBooking(currentBooking);
    notify(
      `Rendez-vous ${currentBooking.code} annulé. Le créneau est libéré.`
    );
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
  });

  const renderRescheduleWarning = (text) => {
    const existing = rescheduleSlots.querySelector('.reschedule-warning');
    if (existing) existing.remove();
    rescheduleSlots.insertAdjacentHTML(
      'beforeend',
      `<div class="text-danger small reschedule-warning">${text}</div>`
    );
  };

  const renderReschedule = async () => {
    if (!currentBooking) return;
    setMinDate(rescheduleDate);

    const targetDate = rescheduleDate.value || currentBooking.date;

    try {
      const response = await ACApi.getAvailability({
        serviceId: currentBooking.serviceId,
        date: targetDate,
        ignoreCode: currentBooking.code
      });

      renderSlots(
        rescheduleSlots,
        response.slots || [],
        selectedRescheduleTime,
        (time) => {
          selectedRescheduleTime = time;
          const warn = rescheduleSlots.querySelector('.reschedule-warning');
          if (warn) warn.remove();
        }
      );
    } catch (error) {
      console.error(
        'Erreur lors du chargement des créneaux pour la replanification',
        error
      );
      rescheduleSlots.innerHTML =
        '<div class="text-danger small">Impossible de charger les créneaux pour cette date.</div>';
    }
  };

  rescheduleBtn.addEventListener('click', () => {
    if (!currentBooking) return;
    reschedulePanel.classList.remove('d-none');
    reschedulePlaceholder.classList.add('d-none');
    rescheduleDate.value = currentBooking.date;
    selectedRescheduleTime = null;
    renderReschedule();
  });

  refreshReschedule.addEventListener('click', () => {
    renderReschedule();
  });

  confirmReschedule.addEventListener('click', async () => {
    if (!currentBooking) return;
    const newDate = rescheduleDate.value || currentBooking.date;
    if (!selectedRescheduleTime) {
      renderRescheduleWarning('Choisissez un créneau.');
      return;
    }

    let response;
    try {
      response = await ACApi.rescheduleBooking({
        code: currentBooking.code,
        email: currentBooking.email,
        newDate,
        newTime: selectedRescheduleTime
      });
    } catch (error) {
      if (error && error.code === 'SLOT_UNAVAILABLE') {
        renderRescheduleWarning('Créneau indisponible.');
        renderReschedule();
        return;
      }
      console.error('Erreur lors du changement de créneau', error);
      renderRescheduleWarning(
        'Impossible de modifier ce rendez-vous pour le moment.'
      );
      return;
    }

    if (!response || !response.booking) {
      renderRescheduleWarning(
        'Impossible de modifier ce rendez-vous pour le moment.'
      );
      return;
    }

    currentBooking = response.booking;

    showBooking(currentBooking);
    notify(
      `Rendez-vous ${currentBooking.code} déplacé au ${formatDateLabel(
        newDate
      )} à ${selectedRescheduleTime}.`
    );
    renderSlotsForBooking();
    renderWeeklySlots();
    renderBusyListForDate(dateInput.value);
    reschedulePanel.classList.add('d-none');
    reschedulePlaceholder.classList.remove('d-none');
  });

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

  if (refreshSlotsBtn) {
    refreshSlotsBtn.addEventListener('click', () => {
      selectedTime = null;
      renderSlotsForBooking();
    });
  }

  if (syncCalendarsBtn) {
    syncCalendarsBtn.addEventListener('click', () => {
      if (!ACCalendarSync) return;
      ACCalendarSync.syncAllProviders();
      renderCalendarSyncUI();
      renderSlotsForBooking();
      renderWeeklySlots();
      renderBusyListForDate(dateInput.value);
    });
  }

  async function loadServices() {
    try {
      const response = await ACApi.listServices();
      const fetched = Array.isArray(response && response.services)
        ? response.services
        : [];

      services = fetched.filter((s) => s.isActive !== false);

      if (!services.length) {
        throw new Error('Aucun service disponible');
      }

      // Stocker les services en cache global pour api-client.js
      window.cachedServices = services;

      serviceSelect.innerHTML = '';

      services.forEach((service) => {
        const price =
          typeof service.price === 'number'
            ? service.price
            : (service.basePriceCents || 0) / 100;
        const duration =
          typeof service.duration === 'number'
            ? service.duration
            : service.durationMinutes;
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = `${service.name} - ${duration} min - ${price} €`;
        serviceSelect.appendChild(option);
      });

      serviceSelect.value = services[0].id;
    } catch (error) {
      console.error('Erreur lors du chargement des services', error);
      services = [];
      if (serviceSelect) {
        serviceSelect.innerHTML =
          '<option value="">Aucun service disponible</option>';
      }
      bookingForm
        .querySelectorAll('button, input, select, textarea')
        .forEach((el) => {
          if (el !== serviceSelect) el.disabled = true;
        });
      if (slotHint) {
        slotHint.textContent =
          'Impossible de charger les services pour le moment. Merci de réessayer plus tard.';
      }
    }
  }

  async function init() {
    await loadServices();
    if (!services.length) return;

    setMinDate(dateInput);
    setMinDate(rescheduleDate);

    if (ACCalendarSync) {
      ACCalendarSync.pushExistingBookings();
      ACCalendarSync.syncAllProviders();
      renderCalendarSyncUI();
    } else if (calendarProvidersContainer) {
      calendarProvidersContainer.innerHTML =
        '<div class="small text-muted">Synchronisation calendrier non disponible.</div>';
    }

    updateServiceDisplay();
    await renderSlotsForBooking();
    await renderWeeklySlots();
    updateLiveSummary();
  }

  init().catch((error) => {
    console.error(
      "Erreur lors de l’initialisation du module de réservation",
      error
    );
  });
})(window);
