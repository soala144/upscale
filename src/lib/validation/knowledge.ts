import { z } from "zod";

export const knowledgeItemSchema = z
  .object({
    kind: z.enum(["PRODUCT", "FAQ"]),
    title: z.string().trim().min(1, "Enter a name or question.").max(200),
    content: z.string().trim().min(1, "Enter details or an answer.").max(2000),
    price: z
      .number()
      .finite()
      .nonnegative()
      .max(100_000_000_000)
      .nullable()
      .optional(),
    available: z.boolean().default(true),
  })
  .refine((value) => value.kind === "PRODUCT" || value.price == null, {
    message: "FAQs do not have a price.",
    path: ["price"],
  });

export type KnowledgeItemInput = z.infer<typeof knowledgeItemSchema>;

export const importKnowledgeSchema = z.object({
  items: z.array(knowledgeItemSchema).min(1).max(200),
});

/** Minimal CSV parser (quoted fields, escaped quotes, CRLF) for the import box. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

/**
 * Expected header: name,price,description[,available][,type]. A row without a
 * price is imported as a product with no price. With a "type" column, rows
 * marked faq are imported as FAQs (name = question, description = answer). Returns items plus per-row problems.
 */
export function csvToProducts(text: string) {
  const rows = parseCsv(text);
  const problems: string[] = [];
  const items: KnowledgeItemInput[] = [];
  const header = rows[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
  const col = (name: string) => header.indexOf(name);
  if (col("name") < 0 || col("description") < 0) {
    return { items, problems: ["The first row must be a header with at least: name, price, description."] };
  }
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const rawPrice = (cells[col("price")] ?? "").replace(/[₦,\s]/g, "");
    const price = rawPrice === "" ? null : Number(rawPrice);
    const isFaq = col("type") >= 0 && (cells[col("type")] ?? "").trim().toLowerCase() === "faq";
    const availableCell = col("available") >= 0 ? (cells[col("available")] ?? "").trim().toLowerCase() : "yes";
    const parsed = knowledgeItemSchema.safeParse({
      kind: isFaq ? "FAQ" : "PRODUCT",
      title: cells[col("name")] ?? "",
      content: cells[col("description")] ?? "",
      price: !isFaq && price !== null && Number.isFinite(price) ? price : null,
      available: !["no", "false", "0", "n"].includes(availableCell),
    });
    if (!isFaq && price !== null && !Number.isFinite(price)) problems.push(`Row ${line}: price is not a number.`);
    else if (!parsed.success) problems.push(`Row ${line}: ${parsed.error.issues[0].message}`);
    else items.push(parsed.data);
  });
  return { items, problems };
}
