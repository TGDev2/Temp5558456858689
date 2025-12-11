require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection:
      process.env.DATABASE_URL ||
      'postgresql://localhost:5432/artisanconnect',
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },

  test: {
    client: 'pg',
    connection:
      process.env.DATABASE_URL ||
      'postgresql://localhost:5432/artisanconnect_test',
    pool: {
      min: 1,
      max: 5,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },

  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 20,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },
};