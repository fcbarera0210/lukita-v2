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
    type: text('type').notNull(), // corriente | credito
    initialBalance: integer('initial_balance').notNull().default(0), // saldo (corriente) o gastado inicial (credito)
    creditLimit: integer('credit_limit'), // cupo; solo credito
    isFavorite: boolean('is_favorite').notNull().default(false),
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
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    baseAmount: integer('base_amount').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('savings_user_account_name_uidx').on(t.userId, t.accountId, t.nameNormalized),
    index('savings_user_idx').on(t.userId),
    index('savings_account_idx').on(t.accountId),
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
    installmentPlanId: uuid('installment_plan_id'),
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

export const installmentPlans = pgTable(
  'installment_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    creditAccountId: uuid('credit_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    totalAmount: integer('total_amount').notNull(),
    installmentCount: integer('installment_count').notNull(),
    scheduleMode: text('schedule_mode').notNull(), // consecutive | billing_day
    firstDueDate: timestamp('first_due_date', { withTimezone: true }).notNull(),
    billingDay: integer('billing_day'),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    note: text('note'),
    purchaseTransactionId: uuid('purchase_transaction_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('installment_plans_user_idx').on(t.userId),
    index('installment_plans_account_idx').on(t.creditAccountId),
  ]
);

export const installments = pgTable(
  'installments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => installmentPlans.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    plannedAmount: integer('planned_amount').notNull(),
    status: text('status').notNull().default('pending'), // pending | paid
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paymentTransferId: uuid('payment_transfer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('installments_user_idx').on(t.userId),
    index('installments_plan_idx').on(t.planId),
    index('installments_due_idx').on(t.dueDate),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  categories: many(categories),
  savings: many(savings),
  transactions: many(transactions),
  transfers: many(transfers),
  installmentPlans: many(installmentPlans),
  installments: many(installments),
}));

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Saving = typeof savings.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type InstallmentPlan = typeof installmentPlans.$inferSelect;
export type Installment = typeof installments.$inferSelect;
