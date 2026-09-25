import { S3Client } from "bun";
import { z } from "zod";

const config = z
  .object({
    S3_ENDPOINT: z.url(),
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
  })
  .parse(process.env);
const options = {
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  bucket: config.S3_BUCKET,
  accessKeyId: config.S3_ACCESS_KEY_ID,
  secretAccessKey: config.S3_SECRET_ACCESS_KEY,
};
export const objectStore = new S3Client(options);
const publicStore = new S3Client({
  ...options,
  endpoint: config.S3_PUBLIC_ENDPOINT ?? config.S3_ENDPOINT,
});
export const objectKey = (project: string, name: string) =>
  `projects/${project}/${name}`;
export function objectAccess(project: string, name: string) {
  return {
    url: publicStore.presign(objectKey(project, name), {
      method: "GET",
      expiresIn: 3600,
    }),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };
}

export const storageIdentity = JSON.stringify([
  config.S3_ENDPOINT,
  config.S3_BUCKET,
]);
