"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button, InlineNotice, TextArea, TextInput } from "@/components/ui/primitives";

export function PublicLeadForm({ slug, source }: { slug: string; source?: string }) {
  const [values, setValues] = useState({ name: "", phone: "", email: "", need: "", location: "", budget: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ telegramUrl: string | null } | null>(null);
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit() {
    if (busy) return;
    setError("");
    const budget = values.budget.trim() === "" ? undefined : Number(values.budget.replace(/[₦,\s]/g, ""));
    if (budget !== undefined && !Number.isFinite(budget)) return setError("Enter the budget as a number.");
    setBusy(true);
    try {
      const response = await fetch(`/api/public/leads/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name, phone: values.phone, email: values.email, need: values.need,
          location: values.location || undefined, budget, consent, source: source || undefined, website: values.website,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; telegramUrl?: string | null };
      if (!response.ok) { setError(body.error ?? "We couldn't submit your details. Please try again."); return; }
      setDone({ telegramUrl: body.telegramUrl ?? null });
    } catch {
      setError("We couldn't reach the service. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="mt-6" role="status">
        <h2 className="text-lg font-semibold">Thank you, we have your details.</h2>
        <p className="mt-1 text-sm text-muted">The team will be in touch{done.telegramUrl ? ", or you can continue the conversation right now on Telegram." : "."}</p>
        {done.telegramUrl ? (
          <a href={done.telegramUrl} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Continue on Telegram <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form className="mt-6 grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <TextInput label="Your name" name="pf-name" autoComplete="name" value={values.name} onChange={set("name")} maxLength={120} />
      <TextInput label="Phone number" name="pf-phone" type="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} placeholder="08031234567" />
      <TextInput label="Email (optional)" name="pf-email" type="email" autoComplete="email" value={values.email} onChange={set("email")} />
      <TextArea label="What are you looking for?" name="pf-need" value={values.need} onChange={set("need")} maxLength={500} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Location (optional)" name="pf-location" value={values.location} onChange={set("location")} maxLength={300} />
        <TextInput label="Budget in NGN (optional)" name="pf-budget" inputMode="numeric" value={values.budget} onChange={set("budget")} />
      </div>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} /></label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree to be contacted about my enquiry, including by message.</span>
      </label>
      {error ? <InlineNotice>{error}</InlineNotice> : null}
      <Button type="submit" disabled={busy}>{busy ? "Sending..." : "Submit"}</Button>
    </form>
  );
}
