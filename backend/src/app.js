require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./api/middlewares/errorHandler');
const healthRoutes = require('./api/routes/healthRoutes');
const { createServiceRouter } = require('./api/routes/serviceRoutes');
const { createAvailabilityRoutes } = require('./api/routes/availabilityRoutes');
const { createBookingRoutes } = require('./api/routes/bookingRoutes');
const { initializeDependencies } = require('./infrastructure/dependencies');

const app = express();

// Middleware de sécurité HTTP headers
app.use(helmet());

// Configuration CORS
const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : [
          'http://localhost:8000',
          'http://127.0.0.1:8000',
          'http://localhost:5500',
          'http://127.0.0.1:5500',
        ],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Initialisation des dépendances (avant les middlewares pour le webhook)
const deps = initializeDependencies();

// Webhook Stripe - DOIT être avant express.json() pour recevoir le raw body
const { handleStripeWebhook } = require('./api/controllers/bookingController');

app.post(
  '/api/v1/bookings/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook({
    stripe: deps.stripe,
    bookingRepository: deps.repositories.bookingRepository,
    webhookSecret: deps.webhookSecret,
  })
);

// Body parsing middleware (après le webhook)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging HTTP requests
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

// Routes API v1
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/services', createServiceRouter(deps.services.serviceDomainService));
app.use(
  '/api/v1/availability',
  createAvailabilityRoutes({
    serviceRepository: deps.repositories.serviceRepository,
    slotAvailabilityService: deps.services.slotAvailabilityService,
  })
);
app.use(
  '/api/v1/bookings',
  createBookingRoutes({
    bookingService: deps.services.bookingService,
    bookingRepository: deps.repositories.bookingRepository,
    stripe: deps.stripe,
    webhookSecret: deps.webhookSecret,
  })
);

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'ArtisanConnect API',
    version: '1.0.0',
    documentation: '/api/v1/health',
    endpoints: {
      health: 'GET /api/v1/health',
      services: 'GET /api/v1/services',
      availability: 'GET /api/v1/availability?serviceId={uuid}&date={YYYY-MM-DD}',
      bookings: 'POST /api/v1/bookings',
    },
  });
});

// Gestion des routes non trouvées (404)
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} non trouvée.`,
    },
  });
});

// Middleware global de gestion des erreurs (doit être en dernier)
app.use(errorHandler);

module.exports = app;
