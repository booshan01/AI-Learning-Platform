import { GoogleGenAI } from "@google/genai";
import {
  AskLearningCoachBody,
  AskLearningCoachResponse,
  GetLearningDashboardResponse,
  GetLearningRoadmapResponse,
  ListCompetenciesResponse,
  ListLearningActivityResponse,
  ListLearningCoursesResponse,
  UpdateCourseProgressBody,
  UpdateCourseProgressParams,
  UpdateCourseProgressResponse,
} from "@workspace/api-zod";
import {
  competenciesTable,
  courseProgressTable,
  db,
  learningActivityTable,
  learningCoursesTable,
  learningRoadmapTable,
  type LearningRole,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  requireAuth,
  requireLearningUserId,
  requireRole,
} from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

const sampleCourses = [
  {
    title: "Working Smarter with AI",
    category: "AI & Data",
    description:
      "Build practical fluency with generative AI, prompt design, and safe everyday workflows.",
    instructor: "Maya Chen",
    durationHours: 2.5,
    level: "Beginner",
    rating: 4.9,
    accent: "teal",
  },
  {
    title: "Data Storytelling for Teams",
    category: "AI & Data",
    description:
      "Turn analysis into clear narratives, useful charts, and decisions your team can act on.",
    instructor: "Jordan Lee",
    durationHours: 3,
    level: "Intermediate",
    rating: 4.8,
    accent: "blue",
  },
  {
    title: "Communicate with Clarity",
    category: "Communication",
    description:
      "Write concise updates, lead productive conversations, and make complex ideas easier to follow.",
    instructor: "Priya Shah",
    durationHours: 1.8,
    level: "All levels",
    rating: 4.9,
    accent: "coral",
  },
  {
    title: "Cloud Foundations",
    category: "Cloud & Technology",
    description:
      "Understand cloud architecture, core services, and the language behind modern platforms.",
    instructor: "Evan Brooks",
    durationHours: 4,
    level: "Beginner",
    rating: 4.7,
    accent: "violet",
  },
  {
    title: "Leading Through Change",
    category: "Leadership",
    description:
      "Help teams navigate uncertainty with stronger alignment, trust, and decision-making.",
    instructor: "Sam Rivera",
    durationHours: 2.2,
    level: "Intermediate",
    rating: 4.8,
    accent: "amber",
  },
];

const sampleCompetencies = [
  {
    name: "AI collaboration",
    category: "AI & Data",
    currentLevel: 2,
    targetLevel: 5,
    impact: "high",
  },
  {
    name: "Data storytelling",
    category: "AI & Data",
    currentLevel: 3,
    targetLevel: 5,
    impact: "high",
  },
  {
    name: "Strategic communication",
    category: "Communication",
    currentLevel: 3,
    targetLevel: 5,
    impact: "medium",
  },
  {
    name: "Cloud foundations",
    category: "Cloud & Technology",
    currentLevel: 2,
    targetLevel: 4,
    impact: "medium",
  },
  {
    name: "Change leadership",
    category: "Leadership",
    currentLevel: 4,
    targetLevel: 5,
    impact: "low",
  },
];

let catalogSeedPromise: Promise<void> | undefined;
const learnerSeedPromises = new Map<string, Promise<void>>();
const coachRequestWindows = new Map<string, { startedAt: number; count: number }>();
const coachWindowMs = 60_000;
const coachRequestLimit = 10;

function getLearnerId(req: Request): string {
  return requireLearningUserId(req);
}

function getUserRole(req: Request): LearningRole {
  if (!req.learningUserRole) {
    throw new Error("Learning route executed without a verified role.");
  }
  return req.learningUserRole;
}

async function ensureCatalogSeedData(): Promise<void> {
  if (!catalogSeedPromise) {
    catalogSeedPromise = seedCatalogData().catch((error: unknown) => {
      catalogSeedPromise = undefined;
      throw error;
    });
  }
  return catalogSeedPromise;
}

async function ensureSeedData(learnerId: string): Promise<void> {
  await ensureCatalogSeedData();
  let seedPromise = learnerSeedPromises.get(learnerId);
  if (!seedPromise) {
    seedPromise = seedLearnerData(learnerId).catch((error: unknown) => {
      learnerSeedPromises.delete(learnerId);
      throw error;
    });
    learnerSeedPromises.set(learnerId, seedPromise);
  }
  await seedPromise;
}

async function seedCatalogData(): Promise<void> {
  const existingCourses = await db
    .select({ id: learningCoursesTable.id })
    .from(learningCoursesTable)
    .limit(1);

  if (existingCourses.length === 0) {
    await db
      .insert(learningCoursesTable)
      .values(sampleCourses)
      .returning();
  }
}

async function seedLearnerData(learnerId: string): Promise<void> {
  const courses = await db.select().from(learningCoursesTable);
  const existingCompetencies = await db
    .select({ id: competenciesTable.id })
    .from(competenciesTable)
    .where(eq(competenciesTable.learnerId, learnerId))
    .limit(1);
  if (existingCompetencies.length === 0) {
    await db
      .insert(competenciesTable)
      .values(sampleCompetencies.map((competency) => ({ ...competency, learnerId })));
  }

  const existingRoadmap = await db
    .select({ id: learningRoadmapTable.id })
    .from(learningRoadmapTable)
    .where(eq(learningRoadmapTable.learnerId, learnerId))
    .limit(1);
  if (existingRoadmap.length === 0 && courses.length > 0) {
    const courseByTitle = new Map(courses.map((course) => [course.title, course]));
    const roadmap = [
      ["Working Smarter with AI", "AI & Data", 2.5, "in_progress"],
      ["Data Storytelling for Teams", "AI & Data", 3, "up_next"],
      ["Communicate with Clarity", "Communication", 1.8, "up_next"],
      ["Cloud Foundations", "Cloud & Technology", 4, "up_next"],
    ] as const;
    await db.insert(learningRoadmapTable).values(
      roadmap.flatMap(([title, category, estimatedHours, status], index) => {
        const course = courseByTitle.get(title);
        return course
          ? [
              {
                learnerId,
                courseId: course.id,
                title,
                category,
                estimatedHours,
                status,
                position: index + 1,
              },
            ]
          : [];
      }),
    );
  }

  const existingProgress = await db
    .select({ id: courseProgressTable.id })
    .from(courseProgressTable)
    .where(eq(courseProgressTable.learnerId, learnerId))
    .limit(1);
  if (existingProgress.length === 0) {
    const aiCourse = courses.find((course) => course.title === "Working Smarter with AI");
    const communicationCourse = courses.find(
      (course) => course.title === "Communicate with Clarity",
    );
    const initialProgress = [
      aiCourse && {
        learnerId,
        courseId: aiCourse.id,
        percentComplete: 42,
      },
      communicationCourse && {
        learnerId,
        courseId: communicationCourse.id,
        percentComplete: 100,
      },
    ].filter((progress) => progress !== undefined);
    if (initialProgress.length > 0) {
      await db.insert(courseProgressTable).values(initialProgress);
    }
  }

  const existingActivity = await db
    .select({ id: learningActivityTable.id })
    .from(learningActivityTable)
    .where(eq(learningActivityTable.learnerId, learnerId))
    .limit(1);
  if (existingActivity.length === 0) {
    const now = Date.now();
    await db.insert(learningActivityTable).values([
      {
        learnerId,
        title: "Completed a course",
        detail: "Communicate with Clarity",
        kind: "completion",
        durationHours: 1.8,
        occurredAt: new Date(now - 1000 * 60 * 60 * 18),
      },
      {
        learnerId,
        title: "Continued your learning path",
        detail: "Working Smarter with AI · 42% complete",
        kind: "progress",
        durationHours: 1.05,
        occurredAt: new Date(now - 1000 * 60 * 60 * 30),
      },
      {
        learnerId,
        title: "Reviewed your competency profile",
        detail: "Your AI collaboration gap is ready to work on",
        kind: "assessment",
        durationHours: 0.5,
        occurredAt: new Date(now - 1000 * 60 * 60 * 52),
      },
    ]);
  }
}

async function getCourses(learnerId: string) {
  const rows = await db
    .select({
      id: learningCoursesTable.id,
      title: learningCoursesTable.title,
      category: learningCoursesTable.category,
      description: learningCoursesTable.description,
      instructor: learningCoursesTable.instructor,
      durationHours: learningCoursesTable.durationHours,
      level: learningCoursesTable.level,
      rating: learningCoursesTable.rating,
      accent: learningCoursesTable.accent,
      userProgress: courseProgressTable.percentComplete,
    })
    .from(learningCoursesTable)
    .leftJoin(
      courseProgressTable,
      and(
        eq(courseProgressTable.courseId, learningCoursesTable.id),
        eq(courseProgressTable.learnerId, learnerId),
      ),
    )
    .orderBy(asc(learningCoursesTable.id));

  return rows.map((course) => ({
    ...course,
    userProgress: course.userProgress ?? 0,
  }));
}

router.get("/learning/dashboard", async (req, res): Promise<void> => {
  const learnerId = getLearnerId(req);
  await ensureSeedData(learnerId);
  const [courses, competencies, activities] = await Promise.all([
    getCourses(learnerId),
    db
      .select()
      .from(competenciesTable)
      .where(eq(competenciesTable.learnerId, learnerId))
      .orderBy(asc(competenciesTable.id)),
    db
      .select()
      .from(learningActivityTable)
      .where(eq(learningActivityTable.learnerId, learnerId))
      .orderBy(desc(learningActivityTable.occurredAt))
      .limit(5),
  ]);

  const totalTarget = competencies.reduce((total, item) => total + item.targetLevel, 0);
  const totalCurrent = competencies.reduce((total, item) => total + item.currentLevel, 0);
  const completedCourses = courses.filter((course) => course.userProgress >= 100).length;
  const inProgressCourses = courses.filter(
    (course) => course.userProgress > 0 && course.userProgress < 100,
  ).length;
  const learningHours =
    Math.round(
      courses.reduce(
        (total, course) =>
          total + (course.durationHours * course.userProgress) / 100,
        0,
      ) * 10,
    ) / 10;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weeklyHours = Array<number>(7).fill(0);
  const dayInMs = 24 * 60 * 60 * 1000;
  const weekActivity = await db
    .select({
      occurredAt: learningActivityTable.occurredAt,
      durationHours: learningActivityTable.durationHours,
    })
    .from(learningActivityTable)
    .where(eq(learningActivityTable.learnerId, learnerId));
  for (const activity of weekActivity) {
    if (activity.occurredAt < weekStart) continue;
    const dayIndex = Math.floor(
      (activity.occurredAt.getTime() - weekStart.getTime()) / dayInMs,
    );
    if (dayIndex >= 0 && dayIndex < weeklyHours.length) {
      weeklyHours[dayIndex] += activity.durationHours;
    }
  }

  const priorityCategories = [...competencies]
    .sort(
      (left, right) =>
        (right.targetLevel - right.currentLevel) -
        (left.targetLevel - left.currentLevel),
    )
    .map((item) => item.category);
  const recommendations = [...courses]
    .filter((course) => course.userProgress < 100)
    .sort((left, right) => {
      const leftPriority = priorityCategories.indexOf(left.category);
      const rightPriority = priorityCategories.indexOf(right.category);
      return (
        (leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority) -
        (rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority)
      );
    })
    .slice(0, 3);

  res.json(
    GetLearningDashboardResponse.parse({
      learner: {
        name: "Learner",
        role: getUserRole(req)
          .split("_")
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join(" "),
        department: "Not assigned",
        streakDays: 12,
      },
      stats: {
        learningHours,
        completedCourses,
        inProgressCourses,
        readinessScore:
          totalTarget === 0 ? 0 : Math.round((totalCurrent / totalTarget) * 100),
      },
      competencies,
      recommendedCourses: recommendations,
      activity: activities,
      weeklyHours: weeklyHours.map((hours) => Math.round(hours * 10) / 10),
    }),
  );
});

router.get("/learning/courses", async (req, res): Promise<void> => {
  const learnerId = getLearnerId(req);
  await ensureSeedData(learnerId);
  res.json(ListLearningCoursesResponse.parse(await getCourses(learnerId)));
});

router.get("/learning/competencies", async (req, res): Promise<void> => {
  const learnerId = getLearnerId(req);
  await ensureSeedData(learnerId);
  const competencies = await db
    .select()
    .from(competenciesTable)
    .where(eq(competenciesTable.learnerId, learnerId))
    .orderBy(asc(competenciesTable.id));
  res.json(ListCompetenciesResponse.parse(competencies));
});

router.get("/learning/roadmap", async (req, res): Promise<void> => {
  const learnerId = getLearnerId(req);
  await ensureSeedData(learnerId);
  const roadmap = await db
    .select()
    .from(learningRoadmapTable)
    .where(eq(learningRoadmapTable.learnerId, learnerId))
    .orderBy(asc(learningRoadmapTable.position));
  res.json(GetLearningRoadmapResponse.parse(roadmap));
});

router.get("/learning/activity", async (req, res): Promise<void> => {
  const learnerId = getLearnerId(req);
  await ensureSeedData(learnerId);
  const activity = await db
    .select()
    .from(learningActivityTable)
    .where(eq(learningActivityTable.learnerId, learnerId))
    .orderBy(desc(learningActivityTable.occurredAt))
    .limit(20);
  res.json(ListLearningActivityResponse.parse(activity));
});

router.patch(
  "/learning/courses/:courseId/progress",
  requireRole("learner"),
  async (req, res): Promise<void> => {
    const learnerId = getLearnerId(req);
    await ensureSeedData(learnerId);
    const params = UpdateCourseProgressParams.safeParse(req.params);
    const body = UpdateCourseProgressBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [course] = await db
      .select()
      .from(learningCoursesTable)
      .where(eq(learningCoursesTable.id, params.data.courseId))
      .limit(1);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const [previous] = await db
      .select()
      .from(courseProgressTable)
      .where(
        and(
          eq(courseProgressTable.courseId, course.id),
          eq(courseProgressTable.learnerId, learnerId),
        ),
      )
      .limit(1);
    const [progress] = await db
      .insert(courseProgressTable)
      .values({
        learnerId,
        courseId: course.id,
        percentComplete: body.data.percentComplete,
      })
      .onConflictDoUpdate({
        target: [courseProgressTable.learnerId, courseProgressTable.courseId],
        set: { percentComplete: body.data.percentComplete, updatedAt: new Date() },
      })
      .returning();

    const change = body.data.percentComplete - (previous?.percentComplete ?? 0);
    if (change > 0) {
      const finished = body.data.percentComplete >= 100;
      await db.insert(learningActivityTable).values({
        learnerId,
        title: finished ? "Completed a course" : "Made progress on a course",
        detail: `${course.title} · ${body.data.percentComplete}% complete`,
        kind: finished ? "completion" : "progress",
        durationHours: Math.round((course.durationHours * change) * 10) / 1000,
      });
    }

    await db
      .update(learningRoadmapTable)
      .set({
        status:
          body.data.percentComplete >= 100
            ? "completed"
            : body.data.percentComplete > 0
              ? "in_progress"
              : "up_next",
      })
      .where(
        and(
          eq(learningRoadmapTable.learnerId, learnerId),
          eq(learningRoadmapTable.courseId, course.id),
        ),
      );

    res.json(
      UpdateCourseProgressResponse.parse({
        courseId: progress.courseId,
        percentComplete: progress.percentComplete,
      }),
    );
  },
);

router.post(
  "/gemini/learning-coach",
  requireRole("learner"),
  async (req, res): Promise<void> => {
  const body = AskLearningCoachBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const now = Date.now();
  const clientId = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const window = coachRequestWindows.get(clientId);
  if (!window || now - window.startedAt >= coachWindowMs) {
    coachRequestWindows.set(clientId, { startedAt: now, count: 1 });
  } else if (window.count >= coachRequestLimit) {
    res.status(429).json({ error: "Please wait a minute before asking again." });
    return;
  } else {
    window.count += 1;
  }

  if (coachRequestWindows.size > 1000) {
    for (const [key, value] of coachRequestWindows) {
      if (now - value.startedAt >= coachWindowMs) coachRequestWindows.delete(key);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(502).json({ error: "The AI learning coach is not configured." });
    return;
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const prompt = [
      "You are an encouraging, practical workplace learning coach.",
      "Give focused, actionable guidance. Do not claim to know details that are not provided.",
      body.data.context ? `Learner context: ${body.data.context}` : "",
      `Learner question: ${body.data.question}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });
    const answer = result.text?.trim();
    if (!answer) throw new Error("Gemini returned an empty response");
    res.json(AskLearningCoachResponse.parse({ answer }));
  } catch (error) {
    req.log.error({ err: error }, "AI learning coach request failed");
    res.status(502).json({ error: "The AI learning coach is temporarily unavailable." });
  }
  },
);

export default router;