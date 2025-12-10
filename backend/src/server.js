const app = require('./app');
const { logger } = require('./utils/logger');

const PORT = process.env.PORT || 3000;

let server;

// Démarrage du serveur
const startServer = () => {
  server = app.listen(PORT, () => {
    logger.info(`ArtisanConnect API démarrée sur le port ${PORT}`);
    logger.info(`Environnement: ${process.env.NODE_ENV || 'development'}`);
    logger.info(
      `Health check disponible sur: http://localhost:${PORT}/api/v1/health`
    );
    logger.info(
      `Services disponibles sur: http://localhost:${PORT}/api/v1/services`
    );
  });
};

// Arrêt graceful du serveur
const gracefulShutdown = (signal) => {
  logger.info(`Signal ${signal} reçu, arrêt graceful du serveur...`);

  if (server) {
    server.close(() => {
      logger.info('Serveur HTTP fermé proprement.');
      process.exit(0);
    });

    // Forcer l'arrêt après 10 secondes si les connexions ne se ferment pas
    setTimeout(() => {
      logger.error('Arrêt forcé après timeout.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Gestion des signaux d'arrêt
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Démarrer le serveur
startServer();
