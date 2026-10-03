import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const learningRoleEnum = pgEnum("learning_role", [
  "learner",
  "trainer",
  "department_head",
  "admin",
]);

export const learningUsersTable = pgTable("learning_users", {
  id: text("id").primaryKey(),
  role: learningRoleEnum("role").notNull().default("learner"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const learningCoursesTable = pgTable("learning_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  instructor: text("instructor").notNull(),
  durationHours: real("duration_hours").notNull(),
  level: text("level").notNull(),
  rating: real("rating").notNull().default(0),
  accent: text("accent").notNull().default("teal"),
});

export const competenciesTable = pgTable("learning_competencies", {
  id: serial("id").primaryKey(),
  learnerId: text("learner_id").notNull().default("demo-learner"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  currentLevel: integer("current_level").notNull(),
  targetLevel: integer("target_level").notNull(),
  impact: text("impact").notNull().default("medium"),
}, (table) => [
  index("learning_competencies_learner_idx").on(table.learnerId),
]);

export const courseProgressTable = pgTable(
  "course_progress",
  {
    id: serial("id").primaryKey(),
    learnerId: text("learner_id").notNull().default("demo-learner"),
    courseId: integer("course_id")
      .notNull()
      .references(() => learningCoursesTable.id, { onDelete: "cascade" }),
    percentComplete: integer("percent_complete").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("course_progress_learner_course_unique").on(
      table.learnerId,
      table.courseId,
    ),
  ],
);

export const learningRoadmapTable = pgTable(
  "learning_roadmap",
  {
    id: serial("id").primaryKey(),
    learnerId: text("learner_id").notNull().default("demo-learner"),
    courseId: integer("course_id")
      .notNull()
      .references(() => learningCoursesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    estimatedHours: real("estimated_hours").notNull(),
    status: text("status").notNull().default("up_next"),
    position: integer("position").notNull(),
  },
  (table) => [
    index("learning_roadmap_learner_position_idx").on(
      table.learnerId,
      table.position,
    ),
  ],
);

export const learningActivityTable = pgTable(
  "learning_activity",
  {
    id: serial("id").primaryKey(),
    learnerId: text("learner_id").notNull().default("demo-learner"),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    kind: text("kind").notNull(),
    durationHours: real("duration_hours").notNull().default(0),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("learning_activity_learner_occurred_idx").on(
      table.learnerId,
      table.occurredAt,
    ),
  ],
);

export type LearningCourse = typeof learningCoursesTable.$inferSelect;
export type Competency = typeof competenciesTable.$inferSelect;
export type CourseProgress = typeof courseProgressTable.$inferSelect;
export type LearningRoadmapStep = typeof learningRoadmapTable.$inferSelect;
export type LearningActivity = typeof learningActivityTable.$inferSelect;
export type LearningRole = (typeof learningRoleEnum.enumValues)[number];