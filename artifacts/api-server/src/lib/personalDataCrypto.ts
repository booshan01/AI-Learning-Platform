import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod/v4";

const proofDocumentSchema = z
  .object({
    fileName: z.string().min(1).max(160),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
  })
  .nullable();

export const personalProfileDataSchema = z.object({
  fullLegalName: z.string().max(150).nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  placeOfBirth: z.string().max(150).nullable(),
  genderSex: z.string().max(80).nullable(),
  nationalityCitizenship: z.string().max(120).nullable(),
  permanentAddress: z.string().max(2000).nullable(),
  currentResidentialAddress: z.string().max(2000).nullable(),
  maritalStatus: z
    .enum([
      "single",
      "married",
      "separated",
      "divorced",
      "widowed",
      "other",
      "prefer_not_to_say",
    ])
    .nullable(),
  educationalQualifications: z.string().max(2000).nullable(),
  proofOfAddressDocument: proofDocumentSchema,
  proofObjectPath: z.string().max(500).nullable(),
});

export type PersonalProfileData = z.infer<typeof personalProfileDataSchema>;

export class PersonalDataEncryptionUnavailableError extends Error {
  constructor() {
    super("Personal-data encryption is unavailable.");
    this.name = "PersonalDataEncryptionUnavailableError";
  }
}

function getEncryptionKey(): Buffer {
  const encoded = process.env.PERSONAL_DATA_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new PersonalDataEncryptionUnavailableError();

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new PersonalDataEncryptionUnavailableError();
  }
  return key;
}

export function encryptPersonalProfile(
  value: PersonalProfileData,
): { encryptedProfile: string; encryptionVersion: 1 } {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    encryptedProfile: `v1:${Buffer.concat([iv, tag, encrypted]).toString("base64")}`,
    encryptionVersion: 1,
  };
}

export function decryptPersonalProfile(encryptedProfile: string): PersonalProfileData {
  const [version, encoded] = encryptedProfile.split(":");
  if (version !== "v1" || !encoded) {
    throw new Error("Unsupported encrypted personal profile version.");
  }

  const payload = Buffer.from(encoded, "base64");
  if (payload.length < 29) {
    throw new Error("Encrypted personal profile is incomplete.");
  }
  const key = getEncryptionKey();
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return personalProfileDataSchema.parse(JSON.parse(plaintext));
}

export function emptyPersonalProfile(): PersonalProfileData {
  return {
    fullLegalName: null,
    dateOfBirth: null,
    placeOfBirth: null,
    genderSex: null,
    nationalityCitizenship: null,
    permanentAddress: null,
    currentResidentialAddress: null,
    maritalStatus: null,
    educationalQualifications: null,
    proofOfAddressDocument: null,
    proofObjectPath: null,
  };
}