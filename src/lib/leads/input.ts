import { z } from "zod";

import { parseCsv } from "@/lib/validation/knowledge";

/**
 * Normalizes a phone number to a comparable form. Nigerian national numbers
 * (0803...) become +234803...; other numbers need an explicit country code.
 * Returns null when the value cannot be a phone number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;
  const digits = cleaned.replace(/^\+/, "");
  if (cleaned.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const leadInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the contact's name.").max(120),
    phone: optionalText(40).refine(
      (value) => value === null || normalizePhone(value) !== null,
      "Enter a valid phone number, e.g. 08031234567 or +14155550123.",
    ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .email("Enter a valid email address.")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null))
      .transform((value) => value ?? null),
    need: optionalText(500),
    location: optionalText(300),
    timeline: optionalText(300),
    budget: z.number().finite().nonnegative().max(100_000_000_000).nullable().optional(),
    decisionMaker: z.boolean().nullable().optional(),
    notes: optionalText(2000),
  })
  .refine((value) => value.phone !== null || value.email !== null, {
    message: "Add a phone number or an email so you can reach this lead.",
    path: ["phone"],
  });

export type LeadInput = z.output<typeof leadInputSchema>;

export const importLeadsSchema = z.object({
  leads: z.array(z.unknown()).min(1).max(500),
});

/**
 * Header (any order, case-insensitive): name, phone, email, need, budget,
 * location, timeline, notes, decision_maker. Returns valid rows and per-row problems.
 */
export function csvToLeads(text: string) {
  const rows = parseCsv(text);
  const header = rows[0]?.map((cell) => cell.trim().toLowerCase().replace(/\s+/g, "_")) ?? [];
  const col = (name: string) => header.indexOf(name);
  if (col("name") < 0) {
    return { leads: [] as LeadInput[], problems: ["The first row must be a header including a name column."] };
  }
  const leads: LeadInput[] = [];
  const problems: string[] = [];
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const rawBudget = get("budget").replace(/[₦,\s]/g, "");
    const budget = rawBudget === "" ? null : Number(rawBudget);
    const dm = get("decision_maker").toLowerCase();
    if (budget !== null && !Number.isFinite(budget)) {
      problems.push(`Row ${line}: budget is not a number.`);
      return;
    }
    const parsed = leadInputSchema.safeParse({
      name: get("name"),
      phone: get("phone") || null,
      email: get("email") || null,
      need: get("need") || null,
      location: get("location") || null,
      timeline: get("timeline") || null,
      notes: get("notes") || null,
      budget,
      decisionMaker: dm === "" ? null : ["yes", "y", "true", "1"].includes(dm),
    });
    if (!parsed.success) problems.push(`Row ${line}: ${parsed.error.issues[0].message}`);
    else leads.push(parsed.data);
  });
  return { leads, problems };
}

/** Public lead form payload. */
export const publicLeadSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .refine((value) => normalizePhone(value) !== null, "Enter a valid phone number."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  need: z.string().trim().min(1, "Tell us what you are looking for.").max(500),
  location: z.string().trim().max(300).optional(),
  budget: z.number().finite().nonnegative().max(100_000_000_000).optional(),
  consent: z.literal(true, { error: "Please agree to be contacted." }),
  source: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,30}$/)
    .optional(),
  /** Honeypot: real visitors never fill this in. */
  website: z.string().max(0).optional(),
});
