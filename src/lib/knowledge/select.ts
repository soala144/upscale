/**
 * Chooses which knowledge entries go into the prompt for one message.
 * Small catalogues are sent whole; larger ones are ranked by keyword overlap
 * with the customer's recent messages and trimmed to a character budget.
 */

export type KnowledgeEntry = {
  kind: "PRODUCT" | "FAQ";
  title: string;
  content: string;
  price: string | null;
  currency: string;
  available: boolean;
};

export const KNOWLEDGE_CHAR_BUDGET = 6_000;
export const MAX_KNOWLEDGE_ENTRIES = 25;

const stopWords = new Set([
  "the", "and", "for", "you", "are", "with", "have", "what", "how", "much",
  "does", "can", "this", "that", "your", "from", "about", "please", "want",
  "need", "any", "get", "is", "it", "a", "to", "of", "in", "on", "do", "i",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

export function formatEntry(entry: KnowledgeEntry): string {
  if (entry.kind === "FAQ") {
    return `Q: ${entry.title}\nA: ${entry.content}`;
  }
  const price = entry.price
    ? `${entry.currency} ${Number(entry.price).toLocaleString("en-US")}`
    : "price not set";
  const status = entry.available ? "" : " (currently unavailable)";
  return `Product: ${entry.title}${status}\nPrice: ${price}\nDetails: ${entry.content}`;
}

export function selectKnowledge(
  entries: KnowledgeEntry[],
  query: string,
  budget = KNOWLEDGE_CHAR_BUDGET,
): KnowledgeEntry[] {
  const formatted = entries.map((entry) => ({ entry, text: formatEntry(entry) }));
  const total = formatted.reduce((sum, item) => sum + item.text.length, 0);
  if (total <= budget && entries.length <= MAX_KNOWLEDGE_ENTRIES) {
    return entries;
  }

  const queryTokens = new Set(tokenize(query));
  const scored = formatted
    .map((item, index) => {
      const tokens = tokenize(`${item.entry.title} ${item.entry.content}`);
      const titleTokens = new Set(tokenize(item.entry.title));
      let score = 0;
      for (const token of tokens) if (queryTokens.has(token)) score += 1;
      for (const token of titleTokens) if (queryTokens.has(token)) score += 3;
      return { ...item, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const picked: KnowledgeEntry[] = [];
  let used = 0;
  for (const item of scored) {
    if (picked.length >= MAX_KNOWLEDGE_ENTRIES) break;
    if (used + item.text.length > budget) continue;
    picked.push(item.entry);
    used += item.text.length;
  }
  return picked;
}
