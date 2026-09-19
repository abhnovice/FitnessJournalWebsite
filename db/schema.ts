import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userProgress = sqliteTable("user_progress", {
  userId: text("user_id").primaryKey(),
  record: text("record").notNull(),
  updatedAt: text("updated_at").notNull(),
});
