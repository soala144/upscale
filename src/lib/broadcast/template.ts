/**
 * Message template rendering shared by the composer preview (browser) and the
 * sender (server). Only whitelisted variables are accepted and every variable
 * has a fallback, so an unresolved placeholder can never be sent.
 */

export const MAX_MESSAGE_LENGTH = 4096;

export type TemplateContext = {
  name?: string | null;
  location?: string | null;
  need?: string | null;
  businessName?: string | null;
};

type VariableDefinition = {
  description: string;
  fallback: string;
  resolve: (context: TemplateContext) => string | null | undefined;
};

export const TEMPLATE_VARIABLES = {
  first_name: {
    description: "Contact first name",
    fallback: "there",
    resolve: (context) => firstName(context.name),
  },
  name: {
    description: "Contact full name",
    fallback: "there",
    resolve: (context) => context.name,
  },
  location: {
    description: "Contact location",
    fallback: "your area",
    resolve: (context) => context.location,
  },
  need: {
    description: "What the contact is looking for",
    fallback: "what you asked about",
    resolve: (context) => context.need,
  },
  business_name: {
    description: "Your business name",
    fallback: "our team",
    resolve: (context) => context.businessName,
  },
} as const satisfies Record<string, VariableDefinition>;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;

const placeholderPattern = /\{\{\s*([A-Za-z0-9_]*)\s*\}\}/g;

function firstName(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

export function isTemplateVariable(value: string): value is TemplateVariable {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_VARIABLES, value);
}

/** Returns the distinct placeholders used in a body (unknown ones included). */
export function extractPlaceholders(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(placeholderPattern)) {
    found.add(match[1]);
  }
  return [...found];
}

/** Human-readable problems that must block saving or sending the body. */
export function validateTemplateBody(body: string): string[] {
  const problems: string[] = [];
  if (!body.trim()) {
    problems.push("Write a message.");
  }
  if (body.length > MAX_MESSAGE_LENGTH) {
    problems.push(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  const unknown = extractPlaceholders(body).filter(
    (placeholder) => !isTemplateVariable(placeholder),
  );
  if (unknown.length) {
    problems.push(
      `Unsupported variable${unknown.length > 1 ? "s" : ""}: ${unknown
        .map((value) => `{{${value}}}`)
        .join(", ")}.`,
    );
  }
  // Any leftover brace pair means a malformed placeholder would be sent as-is.
  const withoutValid = body.replace(placeholderPattern, "");
  if (/\{\{|\}\}/.test(withoutValid)) {
    problems.push("Fix the unmatched {{ }} in your message.");
  }
  return problems;
}

export function renderTemplate(body: string, context: TemplateContext): string {
  return body.replace(placeholderPattern, (_match, key: string) => {
    if (!isTemplateVariable(key)) {
      return "";
    }
    const definition: VariableDefinition = TEMPLATE_VARIABLES[key];
    return clean(definition.resolve(context)) ?? definition.fallback;
  });
}
