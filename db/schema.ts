import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const userProgress = sqliteTable("user_progress", {
  userId: text("user_id").primaryKey(),
  record: text("record").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const nutritionEntries = sqliteTable("nutrition_entries", {
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  id: text("id").notNull(),
  entry: text("entry").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.id] }),
  index("nutrition_entries_user_day").on(table.userId, table.day),
]);

export const medicalDocuments = sqliteTable("medical_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  category: text("category").notNull(),
  objectKey: text("object_key").notNull(),
  sizeBytes: text("size_bytes").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
});
