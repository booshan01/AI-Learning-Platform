import {
  DeleteLearningPersonalProfileResponse,
  GetLearningPersonalProfileResponse,
  RequestAddressProofUploadBody,
  RequestAddressProofUploadResponse,
  UpdateLearningPersonalProfileBody,
  UpdateLearningPersonalProfileResponse,
} from "@workspace/api-zod";
import {
  db,
  learningPersonalProfilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  decryptPersonalProfile,
  emptyPersonalProfile,
  encryptPersonalProfile,
  PersonalDataEncryptionUnavailableError,
  personalProfileDataSchema,
} from "../lib/personalDataCrypto";
import {
  createAddressProofUpload,
  deletePrivateObject,
  getAddressProofOwnerPrefix,
  getPrivateObjectFile,
  setPrivateObjectOwner,
} from "../lib/privateObjectStorage";
import {
  requireAuth,
  requireLearningUserId,
  requireRole,
} from "../middlewares/requireAuth";

const router: IRouter = Router();
const allowedProofTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const maxProofBytes = 10 * 1024 * 1024;

class InvalidAddressProofError extends Error {
  constructor() {
    super("Invalid proof-of-address document.");
    this.name = "InvalidAddressProofError";
  }
}

router.use(requireAuth);

function currentLearnerId(req: Request): string {
  return requireLearningUserId(req);
}

async function getEncryptedProfile(learnerId: string) {
  const [row] = await db
    .select()
    .from(learningPersonalProfilesTable)
    .where(eq(learningPersonalProfilesTable.learnerId, learnerId))
    .limit(1);
  return row;
}

function publicProfile(
  profile: ReturnType<typeof emptyPersonalProfile>,
) {
  return {
    fullLegalName: profile.fullLegalName,
    dateOfBirth: profile.dateOfBirth,
    placeOfBirth: profile.placeOfBirth,
    genderSex: profile.genderSex,
    nationalityCitizenship: profile.nationalityCitizenship,
    permanentAddress: profile.permanentAddress,
    currentResidentialAddress: profile.currentResidentialAddress,
    maritalStatus: profile.maritalStatus,
    educationalQualifications: profile.educationalQualifications,
    proofOfAddressDocument: profile.proofOfAddressDocument,
  };
}

function hasValidDateOfBirth(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return false;
  }
  return value <= new Date().toISOString().slice(0, 10);
}

function cleanText(value: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned || null;
}

function isValidAddressProofBytes(
  contentType: string,
  bytes: Buffer,
): boolean {
  if (contentType === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return false;
}

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\/\\]/g, "_")
    .replace(/[\r\n"]/g, "")
    .trim()
    .slice(0, 160);
  return cleaned || "proof-of-address";
}

function contentDisposition(name: string): string {
  const safeName = safeFileName(name);
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

function logEncryptionFailure(req: Request, error: unknown): void {
  if (error instanceof PersonalDataEncryptionUnavailableError) {
    req.log.error("Personal-data encryption key is missing or invalid.");
  } else {
    req.log.error(
      {
        errorName:
          error && typeof error === "object" && "name" in error
            ? String((error as { name: unknown }).name)
            : "UnknownError",
      },
      "Could not process encrypted learner profile.",
    );
  }
}

router.get(
  "/learning/personal-profile",
  requireRole("learner"),
  async (req, res): Promise<void> => {
    try {
      const row = await getEncryptedProfile(currentLearnerId(req));
      const data = row
        ? decryptPersonalProfile(row.encryptedProfile)
        : emptyPersonalProfile();
      res.json(GetLearningPersonalProfileResponse.parse(publicProfile(data)));
    } catch (error) {
      logEncryptionFailure(req, error);
      res.status(
        error instanceof PersonalDataEncryptionUnavailableError ? 503 : 500,
      ).json({
        error:
          error instanceof PersonalDataEncryptionUnavailableError
            ? "Personal-data encryption is unavailable."
            : "Could not load your personal profile.",
      });
    }
  },
);

router.patch(
  "/learning/personal-profile",
  requireRole("learner"),
  async (req, res): Promise<void> => {
    const rawDateOfBirth = req.body?.dateOfBirth;
    if (!hasValidDateOfBirth(rawDateOfBirth)) {
      res.status(400).json({
        error: "Date of birth must be a real calendar date in YYYY-MM-DD format and cannot be in the future.",
      });
      return;
    }

    const parsed = UpdateLearningPersonalProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Some personal profile fields are invalid." });
      return;
    }

    const learnerId = currentLearnerId(req);
    let oldProfile:
      | ReturnType<typeof emptyPersonalProfile>
      | undefined;
    try {
      const currentRow = await getEncryptedProfile(learnerId);
      oldProfile = currentRow
        ? decryptPersonalProfile(currentRow.encryptedProfile)
        : emptyPersonalProfile();

      const dateValue = parsed.data.dateOfBirth
        ? parsed.data.dateOfBirth.toISOString().slice(0, 10)
        : null;
      const nextProfile = {
        fullLegalName: cleanText(parsed.data.fullLegalName),
        dateOfBirth: dateValue,
        placeOfBirth: cleanText(parsed.data.placeOfBirth),
        genderSex: cleanText(parsed.data.genderSex),
        nationalityCitizenship: cleanText(parsed.data.nationalityCitizenship),
        permanentAddress: cleanText(parsed.data.permanentAddress),
        currentResidentialAddress: cleanText(
          parsed.data.currentResidentialAddress,
        ),
        maritalStatus: parsed.data.maritalStatus,
        educationalQualifications: cleanText(
          parsed.data.educationalQualifications,
        ),
        proofOfAddressDocument: oldProfile.proofOfAddressDocument,
        proofObjectPath: oldProfile.proofObjectPath,
      };

      if (Object.hasOwn(parsed.data, "addressProofObjectPath")) {
        const nextObjectPath = parsed.data.addressProofObjectPath ?? null;
        if (nextObjectPath === null) {
          nextProfile.proofOfAddressDocument = null;
          nextProfile.proofObjectPath = null;
        } else {
          const ownerPrefix = getAddressProofOwnerPrefix(learnerId);
          if (!nextObjectPath.startsWith(ownerPrefix)) {
            throw new InvalidAddressProofError();
          }
          let file;
          try {
            file = await getPrivateObjectFile(nextObjectPath);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "Private object not found."
            ) {
              throw new InvalidAddressProofError();
            }
            throw error;
          }
          const [metadata] = await file.getMetadata();
          const sizeBytes = Number(metadata.size);
          const contentType = String(metadata.contentType ?? "");
          if (
            !Number.isInteger(sizeBytes) ||
            sizeBytes < 1 ||
            sizeBytes > maxProofBytes ||
            !allowedProofTypes.has(contentType)
          ) {
            throw new InvalidAddressProofError();
          }
          const [fileBytes] = await file.download();
          if (!isValidAddressProofBytes(contentType, fileBytes)) {
            throw new InvalidAddressProofError();
          }
          await setPrivateObjectOwner(file, learnerId);
          nextProfile.proofOfAddressDocument = {
            fileName: safeFileName(
              parsed.data.addressProofFileName ?? "proof-of-address",
            ),
            contentType: contentType as
              | "application/pdf"
              | "image/jpeg"
              | "image/png",
            sizeBytes,
          };
          nextProfile.proofObjectPath = nextObjectPath;
        }
      }

      const validatedProfile = personalProfileDataSchema.parse(nextProfile);
      const encrypted = encryptPersonalProfile(validatedProfile);
      const [saved] = await db
        .insert(learningPersonalProfilesTable)
        .values({ learnerId, ...encrypted })
        .onConflictDoUpdate({
          target: learningPersonalProfilesTable.learnerId,
          set: { ...encrypted, updatedAt: new Date() },
        })
        .returning();
      if (!saved) throw new Error("Profile save did not return a row.");

      if (
        oldProfile.proofObjectPath &&
        oldProfile.proofObjectPath !== validatedProfile.proofObjectPath
      ) {
        try {
          await deletePrivateObject(oldProfile.proofObjectPath);
        } catch {
          req.log.warn("Could not remove a replaced proof document.");
        }
      }

      res.json(
        UpdateLearningPersonalProfileResponse.parse(
          publicProfile(validatedProfile),
        ),
      );
    } catch (error) {
      if (error instanceof InvalidAddressProofError) {
        res.status(400).json({
          error: "The proof document is invalid, expired, too large, or does not belong to this account.",
        });
        return;
      }
      logEncryptionFailure(req, error);
      res.status(
        error instanceof PersonalDataEncryptionUnavailableError ? 503 : 500,
      ).json({
        error:
          error instanceof PersonalDataEncryptionUnavailableError
            ? "Personal-data encryption is unavailable."
            : "Could not save your personal profile.",
      });
    }
  },
);

router.delete(
  "/learning/personal-profile",
  requireRole("learner"),
  async (req, res): Promise<void> => {
    const learnerId = currentLearnerId(req);
    let oldProfile:
      | ReturnType<typeof emptyPersonalProfile>
      | undefined;
    try {
      const row = await getEncryptedProfile(learnerId);
      oldProfile = row
        ? decryptPersonalProfile(row.encryptedProfile)
        : emptyPersonalProfile();
    } catch (error) {
      logEncryptionFailure(req, error);
      res.status(
        error instanceof PersonalDataEncryptionUnavailableError ? 503 : 500,
      ).json({ error: "Could not delete your personal profile." });
      return;
    }

    await db
      .delete(learningPersonalProfilesTable)
      .where(eq(learningPersonalProfilesTable.learnerId, learnerId));

    if (oldProfile.proofObjectPath) {
      try {
        await deletePrivateObject(oldProfile.proofObjectPath);
      } catch {
        req.log.warn("Could not remove a deleted proof document.");
      }
    }
    res.status(204).json(DeleteLearningPersonalProfileResponse.parse(undefined));
  },
);

router.post(
  "/learning/personal-profile/address-proof/upload-url",
  requireRole("learner"),
  async (req, res): Promise<void> => {
    const parsed = RequestAddressProofUploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a PDF, JPEG, or PNG file up to 10 MB." });
      return;
    }

    try {
      const upload = await createAddressProofUpload(currentLearnerId(req));
      res.json(RequestAddressProofUploadResponse.parse(upload));
    } catch (error) {
      req.log.error(
        {
          errorName:
            error && typeof error === "object" && "name" in error
              ? String((error as { name: unknown }).name)
              : "UnknownError",
        },
        "Could not create a private address-proof upload.",
      );
      res.status(503).json({ error: "Private document storage is unavailable." });
    }
  },
);

router.get(
  "/learning/personal-profile/address-proof",
  requireRole("learner"),
  async (req, res): Promise<void> => {
    try {
      const row = await getEncryptedProfile(currentLearnerId(req));
      if (!row) {
        res.status(404).json({ error: "No proof-of-address document is saved." });
        return;
      }
      const profile = decryptPersonalProfile(row.encryptedProfile);
      if (!profile.proofObjectPath || !profile.proofOfAddressDocument) {
        res.status(404).json({ error: "No proof-of-address document is saved." });
        return;
      }
      if (
        !profile.proofObjectPath.startsWith(
          getAddressProofOwnerPrefix(currentLearnerId(req)),
        )
      ) {
        res.status(404).json({ error: "No proof-of-address document is saved." });
        return;
      }

      const file = await getPrivateObjectFile(profile.proofObjectPath);
      res.setHeader("Content-Type", profile.proofOfAddressDocument.contentType);
      res.setHeader("Content-Length", String(profile.proofOfAddressDocument.sizeBytes));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader(
        "Content-Disposition",
        contentDisposition(profile.proofOfAddressDocument.fileName),
      );
      file.createReadStream().on("error", () => {
        if (!res.headersSent) {
          res.status(500).json({ error: "Could not download the proof document." });
        } else {
          res.destroy();
        }
      }).pipe(res);
    } catch (error) {
      logEncryptionFailure(req, error);
      if (!res.headersSent) {
        res.status(
          error instanceof PersonalDataEncryptionUnavailableError ? 503 : 500,
        ).json({ error: "Could not download the proof document." });
      }
    }
  },
);

export default router;