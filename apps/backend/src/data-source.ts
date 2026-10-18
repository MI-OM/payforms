import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ path: '.env' });

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'payforms',
  // TLS: see app.module.ts for the full rationale on rejectUnauthorized.
  // Set DB_SSL_REJECT_UNAUTHORIZED=true and DB_SSL_CA=<pem> for direct
  // (non-pooled) connections that can present a verifiable certificate chain.
  ssl: process.env.DB_SSL === 'true'
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
        ca: process.env.DB_SSL_CA || undefined,
      }
    : false,
  entities: [__dirname + '/modules/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
  migrationsRun: false,
  // TypeORM schema synchronization is dangerous in non-development
  // environments: it auto-alters tables to match entity definitions and
  // can silently drop columns. It is strictly limited to NODE_ENV=development
  // and is always disabled in production. Never set NODE_ENV=development
  // on a database with real customer data.
  synchronize: process.env.NODE_ENV === 'development',
  extra: {
    max: Number(process.env.DB_POOL_MAX ?? 50),
    min: Number(process.env.DB_POOL_MIN ?? 5),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 5000),
    // Migrations run as the table owner and are trusted system code, so they
    // opt out of the tenant RLS policies explicitly. Without this, any future
    // data migration that touches a tenant table would be silently filtered out
    // (or rejected) once Row Level Security is enforced.
    options: '-c app.rls_bypass=on',
  },
  logging: process.env.NODE_ENV === 'development',
});

export default AppDataSource;
