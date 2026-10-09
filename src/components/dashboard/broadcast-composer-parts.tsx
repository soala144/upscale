"use client";

import { TEMPLATE_VARIABLES, renderTemplate, type TemplateContext } from "@/lib/broadcast/template";

const sampleContext: TemplateContext = {
  name: "Ada Okafor",
  location: "Lekki",
  need: "a 3-bedroom flat",
  businessName: "Your business",
};

export function VariablePalette({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Personalization</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(TEMPLATE_VARIABLES).map(([key, variable]) => (
          <button
            key={key}
            type="button"
            title={`${variable.description}. Falls back to "${variable.fallback}" if missing.`}
            onClick={() => onInsert(`{{${key}}}`)}
            className="min-h-8 rounded-md border border-border-strong bg-surface px-2.5 font-mono text-xs hover:bg-surface-muted"
          >
            {`{{${key}}}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Missing contact details use a safe fallback, so a raw placeholder is never sent.</p>
    </div>
  );
}

export function TemplatePreview({ body, context }: { body: string; context?: TemplateContext }) {
  const rendered = body.trim() ? renderTemplate(body, context ?? sampleContext) : "";
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Preview</p>
      <div className="min-h-16 whitespace-pre-wrap break-words rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm" aria-live="polite">
        {rendered || <span className="text-muted">Your message preview appears here.</span>}
      </div>
    </div>
  );
}
