import { Global, Logger, Module } from '@nestjs/common';
import { DEV_SQL_POOL, SQL_POOL } from './database.constants';
import * as mssql from 'mssql';

const dbLogger = new Logger('DatabaseModule');

async function buildPool(config: {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  trustCert: boolean;
}): Promise<mssql.ConnectionPool> {
  const pool = new mssql.ConnectionPool({
    server: config.server,
    database: config.database,
    user: config.user,
    password: config.password,
    port: config.port,
    options: {
      trustServerCertificate: config.trustCert,
      encrypt: true,
      connectTimeout: 8000,
    },
    pool: {
      min: 0,
      max: 10,
      idleTimeoutMillis: 30000,
    },
  });
  // Attach before connect so the handler is in place for any error event that
  // fires during or immediately after the initial handshake.
  pool.on('error', (err) => dbLogger.warn(`Pool error (auto-recovering): ${err?.message}`));
  await pool.connect();
  return pool;
}

@Global()
@Module({
  providers: [
    {
      provide: SQL_POOL,
      useFactory: async (): Promise<mssql.ConnectionPool> => {
        const server   = process.env.DB_SERVER;
        const database = process.env.DB_NAME;
        const user     = process.env.DB_USER;
        const password = process.env.DB_PASSWORD;
        const port     = Number(process.env.DB_PORT ?? 1433);
        const trustCert = (process.env.DB_TRUST_CERT ?? 'yes').toLowerCase() === 'yes';

        if (server && database && user && password) {
          try {
            const pool = await buildPool({ server, database, user, password, port, trustCert });
            dbLogger.log(`SQL_POOL connected → ${server}/${database}`);
            return pool;
          } catch (err) {
            dbLogger.warn(`SQL_POOL live DB unreachable (${server}): ${(err as Error).message} — falling back to dev DB`);
          }
        }

        // Fallback: dev DB
        const devServer   = process.env.DEV_DB_SERVER;
        const devDatabase = process.env.DEV_DB_NAME;
        const devUser     = process.env.DEV_DB_USER;
        const devPassword = process.env.DEV_DB_PASSWORD;
        const devPort     = Number(process.env.DEV_DB_PORT ?? 1433);
        const devTrustCert = (process.env.DEV_DB_TRUST_CERT ?? 'yes').toLowerCase() === 'yes';

        if (!devServer || !devDatabase || !devUser || !devPassword) {
          throw new Error('Live DB unreachable and no fallback dev DB config found.');
        }

        const pool = await buildPool({ server: devServer, database: devDatabase, user: devUser, password: devPassword, port: devPort, trustCert: devTrustCert });
        dbLogger.log(`SQL_POOL connected (fallback) → ${devServer}/${devDatabase}`);
        return pool;
      },
    },
    {
      provide: DEV_SQL_POOL,
      useFactory: async (): Promise<mssql.ConnectionPool> => {
        const server = process.env.DEV_DB_SERVER;
        const database = process.env.DEV_DB_NAME;
        const user = process.env.DEV_DB_USER;
        const password = process.env.DEV_DB_PASSWORD;
        const port = Number(process.env.DEV_DB_PORT ?? 1433);
        const trustCert = (process.env.DEV_DB_TRUST_CERT ?? 'yes').toLowerCase() === 'yes';

        if (!server || !database || !user || !password) {
          throw new Error('Missing dev DB config. Required: DEV_DB_SERVER, DEV_DB_NAME, DEV_DB_USER, DEV_DB_PASSWORD');
        }

        return buildPool({ server, database, user, password, port, trustCert });
      },
    },
  ],
  exports: [SQL_POOL, DEV_SQL_POOL],
})
export class DatabaseModule {}
