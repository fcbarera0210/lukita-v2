import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export function getDb() {
  const url = import.meta.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está configurada');
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof getDb>;
