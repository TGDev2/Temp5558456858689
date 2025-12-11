const knex = require('knex');
const { logger } = require('../../utils/logger');

let knexInstance = null;

const getKnexInstance = () => {
  if (knexInstance) {
    return knexInstance;
  }

  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://localhost:5432/artisanconnect';

  const config = {
    client: 'pg',
    connection: databaseUrl,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  };

  knexInstance = knex(config);

  logger.info('Knex instance initialized', {
    database: databaseUrl.split('@')[1] || 'local',
  });

  return knexInstance;
};

const closeDatabase = async () => {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
    logger.info('Database connection closed');
  }
};

module.exports = { getKnexInstance, closeDatabase };