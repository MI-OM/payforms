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
  // Supabase (and most managed Postgres) require TLS. Set DB_SSL=true in the
  // environment; rejectUnauthorized is disabled because the pooler presents a
  // certificate chain node does not have in its default trust store.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/modules/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
  migrationsRun: false,
  synchronize: process.env.NODE_ENV !== 'production',
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
