import "server-only";

import { z } from "zod";

const optionalEnvironmentValue = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const serverEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          ["postgres:", "postgresql:"].includes(new URL(value).protocol),
        "must be a PostgreSQL connection URL",
      ),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    OPENAI_API_KEY: optionalEnvironmentValue,
    // Optional: point the OpenAI SDK at another OpenAI-compatible provider (e.g. Groq).
    OPENAI_BASE_URL: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().url().optional(),
    ),
    OPENAI_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
    TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY: z
      .string()
      .regex(/^[\da-f]{64}$/i, "must be a 32-byte hex-encoded key"),
    BACHS_API_KEY: optionalEnvironmentValue,
    BACHS_WEBHOOK_SECRET: optionalEnvironmentValue,
    BACHS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    WATCHUP_API_KEY: optionalEnvironmentValue,
    WATCHUP_PROJECT_ID: optionalEnvironmentValue,
    BROADCAST_WORKER_SECRET: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().min(24).optional(),
    ),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && !env.WATCHUP_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["WATCHUP_API_KEY"],
        message: "is required in production",
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnv(): ServerEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const result = serverEnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }

  cachedEnvironment = result.data;
  return cachedEnvironment;
}
