import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  monthCutoffDay: integer('month_cutoff_day').notNull().default(1),
  theme: text('theme').notNull().default('dark'), // dark | light | system
  dashboardRecentCount: integer('dashboard_recent_count').notNull().default(5), // 5 | 10
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // efectivo | cuenta_corriente | tarjeta | ahorro | otro
    initialBalance: integer('initial_balance').notNull().default(0),
    colorId: text('color_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('accounts_user_idx').on(t.userId),
    uniqueIndex('accounts_user_color_uidx').on(t.userId, t.colorId),
  ]
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('categories_user_idx').on(t.userId)]
);

export const savings = pgTable(
  'savings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    baseAmount: integer('base_amount').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('savings_user_name_uidx').on(t.userId, t.nameNormalized),
    index('savings_user_idx').on(t.userId),
  ]
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // ingreso | gasto
    amount: integer('amount').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    note: text('note'),
    savingsId: uuid('savings_id').references(() => savings.id, { onDelete: 'set null' }),
    transferId: uuid('transfer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.date),
    index('transactions_account_idx').on(t.accountId),
    index('transactions_savings_idx').on(t.savingsId),
  ]
);

export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fromAccountId: uuid('from_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    toAccountId: uuid('to_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    amount: integer('amount').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('transfers_user_idx').on(t.userId)]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  categories: many(categories),
  savings: many(savings),
  transactions: many(transactions),
  transfers: many(transfers),
}));

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Saving = typeof savings.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
