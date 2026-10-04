import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { learningUsersTable } from "./learning";

export const learningPersonalProfilesTable = pgTable("learning_personal_profiles", {
  learnerId: text("learner_id")
    .primaryKey()
    .references(() => learningUsersTable.id, { onDelete: "cascade" }),
  encryptedProfile: text("encrypted_profile").notNull(),
  encryptionVersion: integer("encryption_version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertLearningPersonalProfileSchema = createInsertSchema(
  learningPersonalProfilesTable,
).omit({ updatedAt: true });

export type InsertLearningPersonalProfile = z.infer<
  typeof insertLearningPersonalProfileSchema
>;
export type LearningPersonalProfileRecord =
  typeof learningPersonalProfilesTable.$inferSelect;