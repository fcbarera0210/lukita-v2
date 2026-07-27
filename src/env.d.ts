/// <reference types="astro/client" />
import type { User } from './db/schema';

declare namespace App {
  interface Locals {
    user: User | null;
  }
}

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly SESSION_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
