import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Please enter a valid email address.")
  .max(254, "Email address must be 254 characters or fewer.");

const signInPassword = z.string().min(1, "Enter your password.");
const signUpPassword = signInPassword.min(8, "Password must be at least 8 characters.");
const fullName = z.string().trim().min(2, "Enter your name (at least 2 characters).").max(100, "Name must be 100 characters or fewer.");
const passwordConfirmation = z.string().min(1, "Confirm your password.");

export const signInFormSchema = z.object({ email, password: signInPassword });

export const signUpFormSchema = z
  .object({
    name: fullName,
    email,
    password: signUpPassword,
    confirmPassword: passwordConfirmation,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type AuthFormValues = {
  name?: string;
  email: string;
  password: string;
  confirmPassword?: string;
};

export function createAuthFormSchema(isSignUp: boolean) {
  return z.object({
    name: z.string().optional(),
    email,
    password: signInPassword,
    confirmPassword: z.string().optional(),
  }).superRefine((values, context) => {
    if (isSignUp) {
      const nameResult = fullName.safeParse(values.name ?? "");
      if (!nameResult.success) {
        context.addIssue({ code: "custom", path: ["name"], message: nameResult.error.issues[0].message });
      }
      const passwordResult = signUpPassword.safeParse(values.password);
      if (!passwordResult.success) {
        context.addIssue({ code: "custom", path: ["password"], message: passwordResult.error.issues[0].message });
      }
      const confirmationResult = passwordConfirmation.safeParse(values.confirmPassword);
      if (!confirmationResult.success) {
        context.addIssue({ code: "custom", path: ["confirmPassword"], message: confirmationResult.error.issues[0].message });
      } else if (values.password !== values.confirmPassword) {
        context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
      }
    }
  });
}

export const businessProfileFormSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters.").max(100, "Business name must be 100 characters or fewer."),
  slug: z.string().trim().min(2, "Workspace address must be at least 2 characters.").max(63, "Workspace address must be 63 characters or fewer.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
  industry: z.string().trim().min(1, "Enter your industry.").max(80, "Industry must be 80 characters or fewer."),
  description: z.string().trim().min(10, "Add a short description of your business (at least 10 characters).").max(2000, "Description must be 2,000 characters or fewer."),
});

export const agentFormSchema = z.object({
  agentName: z.string().trim().min(1, "Enter a name for your AI agent.").max(80, "Agent name must be 80 characters or fewer."),
  description: z.string().trim().min(10, "Add a short description of your business (at least 10 characters).").max(2000, "Description must be 2,000 characters or fewer."),
  agentPrompt: z.string().trim().max(4000, "Instructions must be 4,000 characters or fewer."),
});

export const telegramFormSchema = z.object({
  botToken: z.string().trim().min(1, "Enter the token for your business's Telegram bot.").max(512, "Telegram bot token is too long."),
});

export const paymentFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Enter a payment amount.")
    .refine((value) => value.length <= 13 && /^\d+(?:\.\d{1,2})?$/.test(value), "Enter a valid amount with up to two decimal places.")
    .transform(Number)
    .refine((value) => Number.isFinite(value) && value > 0, "Amount must be greater than zero.")
    .refine((value) => value <= 9_999_999_999.99, "Amount exceeds the supported maximum."),
});

export const settingsFormSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters.").max(100, "Business name must be 100 characters or fewer."),
  slug: z.string().trim().min(2, "Workspace address must be at least 2 characters.").max(63, "Workspace address must be 63 characters or fewer.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
  industry: z.string().trim().max(80, "Industry must be 80 characters or fewer."),
  description: z.string().trim().min(10, "Add a short description of your business (at least 10 characters).").max(2000, "Description must be 2,000 characters or fewer."),
  email: z.union([z.literal(""), email]),
  agentName: z.string().trim().min(1, "Enter a name for your AI agent.").max(80, "Agent name must be 80 characters or fewer."),
  agentPrompt: z.string().trim().max(4000, "Instructions must be 4,000 characters or fewer."),
});
