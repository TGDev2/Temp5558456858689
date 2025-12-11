/* eslint-disable no-await-in-loop */
const { BookingService } = require('../../src/domain/services/BookingService');
const {
  SlotUnavailableError,
  ServiceNotFoundError,
  InvalidBookingDataError,
} = require('../../src/domain/errors/DomainError');
const {
  generateBookingCode,
  generateUniqueBookingCode,
  isValidBookingCode,
} = require('../../src/utils/bookingCodeGenerator');

describe('BookingService', () => {
  let bookingService;
  let mockServiceRepository;
  let mockBookingRepository;
  let mockSlotAvailabilityService;

  beforeEach(() => {
    // Mock des repositories et services
    mockServiceRepository = {
      findById: jest.fn(),
    };

    mockBookingRepository = {
      create: jest.fn(),
      findByCode: jest.fn(),
    };

    mockSlotAvailabilityService = {
      generateAvailableSlots: jest.fn(),
    };

    bookingService = new BookingService({
      serviceRepository: mockServiceRepository,
      bookingRepository: mockBookingRepository,
      slotAvailabilityService: mockSlotAvailabilityService,
    });
  });

  describe('createBooking', () => {
    const validBookingData = {
      serviceId: 'service-uuid-123',
      date: '2025-12-20',
      time: '10:00',
      customer: {
        name: 'Jean Test',
        email: 'jean.test@example.com',
        phone: '+33612345678',
      },
      notifications: {
        email: true,
        sms: false,
      },
    };

    const mockService = {
      id: 'service-uuid-123',
      artisanId: 'artisan-uuid-456',
      name: 'Diagnostic',
      durationMinutes: 30,
      basePriceCents: 4000,
      depositRate: 0.3,
      isActive: true,
    };

    it('devrait créer une réservation avec succès', async () => {
      // Arrange
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockSlotAvailabilityService.generateAvailableSlots.mockResolvedValue({
        opening: { startMinutes: 510, endMinutes: 1080 },
        slots: [
          { time: '10:00', available: true, blockedBy: [] },
          { time: '10:30', available: true, blockedBy: [] },
        ],
      });
      mockBookingRepository.findByCode.mockResolvedValue(null); // Code unique
      mockBookingRepository.create.mockResolvedValue({
        id: 'booking-uuid-789',
        publicCode: 'AC-ABC123',
        status: 'confirmed',
        customerName: 'Jean Test',
        customerEmail: 'jean.test@example.com',
        depositAmountCents: 1200,
      });

      // Act
      const booking = await bookingService.createBooking(validBookingData);

      // Assert
      expect(booking).toBeDefined();
      expect(booking.publicCode).toMatch(/^AC-[A-Z2-9]{6}$/);
      expect(mockServiceRepository.findById).toHaveBeenCalledWith(
        validBookingData.serviceId
      );
      expect(mockSlotAvailabilityService.generateAvailableSlots).toHaveBeenCalled();
      expect(mockBookingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          artisanId: mockService.artisanId,
          serviceId: mockService.id,
          status: 'confirmed',
          customerName: 'Jean Test',
          customerEmail: 'jean.test@example.com',
          depositAmountCents: 1200, // 4000 * 0.3
          depositPaymentStatus: 'pending',
        })
      );
    });

    it('devrait lever ServiceNotFoundError si le service n\'existe pas', async () => {
      // Arrange
      mockServiceRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        bookingService.createBooking(validBookingData)
      ).rejects.toThrow(ServiceNotFoundError);
    });

    it('devrait lever ServiceNotFoundError si le service est inactif', async () => {
      // Arrange
      mockServiceRepository.findById.mockResolvedValue({
        ...mockService,
        isActive: false,
      });

      // Act & Assert
      await expect(
        bookingService.createBooking(validBookingData)
      ).rejects.toThrow(ServiceNotFoundError);
    });

    it('devrait lever SlotUnavailableError si le créneau est déjà réservé', async () => {
      // Arrange
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockSlotAvailabilityService.generateAvailableSlots.mockResolvedValue({
        opening: { startMinutes: 510, endMinutes: 1080 },
        slots: [
          {
            time: '10:00',
            available: false,
            blockedBy: [
              {
                type: 'booking',
                bookingPublicCode: 'AC-XYZ789',
                summary: 'Réservation existante',
              },
            ],
          },
        ],
      });

      // Act & Assert
      await expect(
        bookingService.createBooking(validBookingData)
      ).rejects.toThrow(SlotUnavailableError);
    });

    it('devrait lever SlotUnavailableError si pas d\'horaires d\'ouverture', async () => {
      // Arrange
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockSlotAvailabilityService.generateAvailableSlots.mockResolvedValue({
        opening: null,
        slots: [],
      });

      // Act & Assert
      await expect(
        bookingService.createBooking(validBookingData)
      ).rejects.toThrow(SlotUnavailableError);
    });

    it('devrait lever InvalidBookingDataError si données manquantes', async () => {
      // Arrange
      const invalidData = { ...validBookingData };
      delete invalidData.customer;

      // Act & Assert
      await expect(bookingService.createBooking(invalidData)).rejects.toThrow(
        InvalidBookingDataError
      );
    });

    it('devrait lever InvalidBookingDataError si email invalide', async () => {
      // Arrange
      const invalidData = {
        ...validBookingData,
        customer: {
          ...validBookingData.customer,
          email: 'email-invalide',
        },
      };

      // Act & Assert
      await expect(bookingService.createBooking(invalidData)).rejects.toThrow(
        InvalidBookingDataError
      );
    });

    it('devrait lever InvalidBookingDataError si date dans le passé', async () => {
      // Arrange
      const invalidData = {
        ...validBookingData,
        date: '2020-01-01',
      };

      // Act & Assert
      await expect(bookingService.createBooking(invalidData)).rejects.toThrow(
        InvalidBookingDataError
      );
    });
  });

  describe('calculateDepositAmount', () => {
    it('devrait calculer correctement l\'acompte à 30%', () => {
      // Arrange
      const basePriceCents = 4000;
      const depositRate = 0.3;

      // Act
      const depositAmount = bookingService.calculateDepositAmount(
        basePriceCents,
        depositRate
      );

      // Assert
      expect(depositAmount).toBe(1200); // 4000 * 0.3 = 1200
    });

    it('devrait calculer correctement l\'acompte à 35%', () => {
      // Arrange
      const basePriceCents = 16000;
      const depositRate = 0.35;

      // Act
      const depositAmount = bookingService.calculateDepositAmount(
        basePriceCents,
        depositRate
      );

      // Assert
      expect(depositAmount).toBe(5600); // 16000 * 0.35 = 5600
    });

    it('devrait calculer correctement l\'acompte à 40%', () => {
      // Arrange
      const basePriceCents = 12000;
      const depositRate = 0.4;

      // Act
      const depositAmount = bookingService.calculateDepositAmount(
        basePriceCents,
        depositRate
      );

      // Assert
      expect(depositAmount).toBe(4800); // 12000 * 0.4 = 4800
    });

    it('devrait arrondir l\'acompte si nécessaire', () => {
      // Arrange
      const basePriceCents = 4567; // Prix avec centimes impairs
      const depositRate = 0.33; // Taux avec décimales

      // Act
      const depositAmount = bookingService.calculateDepositAmount(
        basePriceCents,
        depositRate
      );

      // Assert
      expect(depositAmount).toBe(1507); // Math.round(4567 * 0.33) = 1507
      expect(Number.isInteger(depositAmount)).toBe(true);
    });
  });
});

describe('bookingCodeGenerator', () => {
  describe('generateBookingCode', () => {
    it('devrait générer un code au format AC-XXXXXX', () => {
      // Act
      const code = generateBookingCode();

      // Assert
      expect(code).toMatch(/^AC-[A-Z2-9]{6}$/);
    });

    it('ne devrait pas contenir de caractères ambigus (I, O, 1, 0)', () => {
      // Act
      const codes = Array.from({ length: 100 }, () => generateBookingCode());

      // Assert
      codes.forEach((code) => {
        expect(code).not.toContain('I');
        expect(code).not.toContain('O');
        expect(code).not.toContain('1');
        expect(code).not.toContain('0');
      });
    });

    it('devrait générer des codes différents (probabilité de collision faible)', () => {
      // Act
      const codes = new Set(
        Array.from({ length: 1000 }, () => generateBookingCode())
      );

      // Assert - Aucune collision sur 1000 tentatives
      expect(codes.size).toBe(1000);
    });
  });

  describe('generateUniqueBookingCode', () => {
    it('devrait générer un code unique après vérification', async () => {
      // Arrange
      let callCount = 0;
      const checkUniqueness = jest.fn(async () => {
        callCount += 1;
        return callCount > 2; // Simule 2 collisions puis succès
      });

      // Act
      const code = await generateUniqueBookingCode(checkUniqueness);

      // Assert
      expect(code).toMatch(/^AC-[A-Z2-9]{6}$/);
      expect(checkUniqueness).toHaveBeenCalledTimes(3);
    });

    it('devrait lever une erreur après 10 tentatives échouées', async () => {
      // Arrange
      const checkUniqueness = jest.fn(async () => false); // Toujours collision

      // Act & Assert
      await expect(generateUniqueBookingCode(checkUniqueness)).rejects.toThrow(
        'Failed to generate unique booking code after 10 attempts'
      );
      expect(checkUniqueness).toHaveBeenCalledTimes(10);
    });
  });

  describe('isValidBookingCode', () => {
    it('devrait valider un code valide', () => {
      // Act & Assert
      expect(isValidBookingCode('AC-ABC123')).toBe(true);
      expect(isValidBookingCode('AC-XYZ789')).toBe(true);
      expect(isValidBookingCode('AC-A2B3C4')).toBe(true);
    });

    it('devrait rejeter un code invalide', () => {
      // Act & Assert
      expect(isValidBookingCode('AC-ABCD')).toBe(false); // Trop court
      expect(isValidBookingCode('AC-ABCDEFG')).toBe(false); // Trop long
      expect(isValidBookingCode('XY-ABC123')).toBe(false); // Mauvais préfixe
      expect(isValidBookingCode('AC-ABC12I')).toBe(false); // Contient I
      expect(isValidBookingCode('AC-ABC12O')).toBe(false); // Contient O
      expect(isValidBookingCode('AC-ABC121')).toBe(false); // Contient 1
      expect(isValidBookingCode('AC-ABC120')).toBe(false); // Contient 0
      expect(isValidBookingCode('')).toBe(false); // Vide
      expect(isValidBookingCode(null)).toBe(false); // null
      expect(isValidBookingCode(undefined)).toBe(false); // undefined
    });
  });
});
