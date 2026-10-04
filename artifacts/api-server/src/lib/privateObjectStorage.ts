import { createHash, randomUUID } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";
const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateDirectory(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("Private object storage is not configured.");
  return dir.replace(/\/+$/, "");
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const parts = path.replace(/^\/+/, "").split("/");
  const bucketName = parts.shift();
  const objectName = parts.join("/");
  if (!bucketName || !objectName) throw new Error("Invalid private object path.");
  return { bucketName, objectName };
}

async function signUploadUrl(
  bucketName: string,
  objectName: string,
): Promise<string> {
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to create a private upload URL (${response.status}).`);
  }
  const result = (await response.json()) as { signed_url?: unknown };
  if (typeof result.signed_url !== "string") {
    throw new Error("Storage returned an invalid upload URL.");
  }
  return result.signed_url;
}

export function getAddressProofOwnerPrefix(ownerId: string): string {
  const ownerHash = createHash("sha256").update(ownerId).digest("hex");
  return `/objects/address-proof/${ownerHash}/`;
}

export async function createAddressProofUpload(ownerId: string): Promise<{
  uploadUrl: string;
  objectPath: string;
}> {
  const ownerHash = createHash("sha256").update(ownerId).digest("hex");
  const fullPath = `${privateDirectory()}/address-proof/${ownerHash}/${randomUUID()}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const uploadUrl = await signUploadUrl(bucketName, objectName);
  return {
    uploadUrl,
    objectPath: `/objects/address-proof/${ownerHash}/${objectName.split("/").at(-1)}`,
  };
}

export async function getPrivateObjectFile(objectPath: string): Promise<File> {
  if (!objectPath.startsWith("/objects/")) {
    throw new Error("Invalid private object path.");
  }
  const relativePath = objectPath.slice("/objects/".length);
  const { bucketName, objectName } = parseObjectPath(
    `${privateDirectory()}/${relativePath}`,
  );
  const file = storageClient.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Private object not found.");
  return file;
}

export async function setPrivateObjectOwner(
  file: File,
  ownerId: string,
): Promise<void> {
  await file.setMetadata({
    metadata: {
      "custom:aclPolicy": JSON.stringify({
        owner: ownerId,
        visibility: "private",
      }),
    },
  });
}

export async function deletePrivateObject(objectPath: string): Promise<void> {
  const file = await getPrivateObjectFile(objectPath);
  await file.delete();
}