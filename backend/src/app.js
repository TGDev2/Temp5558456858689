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

// Body parsing middleware
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

// Initialisation des dépendances
const deps = initializeDependencies();

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
