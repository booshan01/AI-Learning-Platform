import { getAuth } from "@clerk/express";
import {
  db,
  learningRoleEnum,
  learningUsersTable,
  type LearningRole,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      learningUserId?: string;
      learningUserRole?: LearningRole;
    }
  }
}

const learningRoles: readonly LearningRole[] = learningRoleEnum.enumValues;
const roleAssignments = new Map<string, LearningRole>();

for (const assignment of (process.env.LEARNING_ROLE_ASSIGNMENTS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)) {
  const [rawUserId, rawRole, ...extra] = assignment.split("=");
  const userId = rawUserId?.trim();
  const role = rawRole?.trim() as LearningRole | undefined;

  if (!userId || !role || extra.length > 0 || !learningRoles.includes(role)) {
    throw new Error(
      "LEARNING_ROLE_ASSIGNMENTS must be comma-separated Clerk userId=role pairs using learner, trainer, department_head, or admin.",
    );
  }

  roleAssignments.set(userId, role);
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const configuredRole = roleAssignments.get(userId);
    const [inserted] = await db
      .insert(learningUsersTable)
      .values({ id: userId, role: configuredRole ?? "learner" })
      .onConflictDoNothing()
      .returning();

    const [existing] = inserted
      ? [inserted]
      : await db
          .select()
          .from(learningUsersTable)
          .where(eq(learningUsersTable.id, userId))
          .limit(1);

    if (!existing) {
      throw new Error("Could not create or load the authenticated learning account.");
    }

    let role = existing.role;
    if (configuredRole && configuredRole !== existing.role) {
      await db
        .update(learningUsersTable)
        .set({ role: configuredRole, updatedAt: new Date() })
        .where(eq(learningUsersTable.id, userId));
      role = configuredRole;
    }

    req.learningUserId = userId;
    req.learningUserRole = role;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...allowedRoles: LearningRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.learningUserId || !req.learningUserRole) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    if (!allowedRoles.includes(req.learningUserRole)) {
      res.status(403).json({ error: "You do not have permission to do this." });
      return;
    }

    next();
  };
}

export function requireLearningUserId(req: Request): string {
  if (!req.learningUserId) {
    throw new Error("Learning route executed without a verified user.");
  }
  return req.learningUserId;
}