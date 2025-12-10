require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./api/middlewares/errorHandler');
const healthRoutes = require('./api/routes/healthRoutes');

const app = express();

// Middleware de sécurité HTTP headers
app.use(helmet());

// Configuration CORS
const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : ['http://localhost:8000', 'http://127.0.0.1:8000'],
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

// Routes API
app.use('/api/v1', healthRoutes);

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'ArtisanConnect API',
    version: '1.0.0',
    documentation: '/api/v1/health',
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
