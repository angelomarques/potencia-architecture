import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * better-auth tables shared with potencia-dashboard and potencia-products.
 * SQL column names are the deployed D1 contract — do not rename them.
 * Property names stay camelCase so the Drizzle adapter can address them.
 * Relations only teach the adapter how to join; they do not change columns.
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // SQL default is 0. SQLite would store the token `false` as text.
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(sql`0`),
  image: text("image"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("idx_session_user").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "number" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "number",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("idx_account_user").on(table.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "number" }).notNull(),
  createdAt: integer("created_at", { mode: "number" }),
  updatedAt: integer("updated_at", { mode: "number" }),
});

/** Session → user is the join better-auth uses for getSession. */
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type SessionRecord = typeof session.$inferSelect;
export type NewSessionRecord = typeof session.$inferInsert;
export type AccountRecord = typeof account.$inferSelect;
export type NewAccountRecord = typeof account.$inferInsert;
export type VerificationRecord = typeof verification.$inferSelect;
export type NewVerificationRecord = typeof verification.$inferInsert;
