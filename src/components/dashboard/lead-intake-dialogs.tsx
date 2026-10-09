"use client";

import Link from "next/link";
import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Button, InlineNotice, SelectInput, TextArea, TextInput } from "@/components/ui/primitives";
import { ApiError, apiRequest, jsonBody } from "@/lib/api/client";
import { csvToLeads } from "@/lib/leads/input";

const msg = (reason: unknown, fallback: string) =>
  reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : fallback;

const empty = { name: "", phone: "", email: "", need: "", budget: "", location: "", timeline: "", decisionMaker: "", notes: "" };

export function AddLeadDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [values, setValues] = useState(empty);
  const [error, setError] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit() {
    if (busy) return;
    setError(""); setExistingId(null);
    const budget = values.budget.trim() === "" ? null : Number(values.budget.replace(/[₦,\s]/g, ""));
    if (budget !== null && !Number.isFinite(budget)) return setError("Enter the budget as a number.");
    setBusy(true);
    try {
      await apiRequest("/api/leads", {
        method: "POST",
        body: jsonBody({
          name: values.name, phone: values.phone || null, email: values.email || null, need: values.need || null,
          budget, location: values.location || null, timeline: values.timeline || null,
          decisionMaker: values.decisionMaker === "" ? null : values.decisionMaker === "yes", notes: values.notes || null,
        }),
      });
      setValues(empty);
      onCreated();
      onClose();
    } catch (reason) {
      if (reason instanceof ApiError && typeof reason.body?.existingLeadId === "string") setExistingId(reason.body.existingLeadId);
      setError(msg(reason, "We couldn't add this lead."));
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add a lead" description="For people you meet in person or hear about outside ads. Add what you know; the more detail, the better the score." wide>
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Name" name="al-name" value={values.name} onChange={set("name")} maxLength={120} />
          <TextInput label="Phone" name="al-phone" type="tel" value={values.phone} onChange={set("phone")} placeholder="08031234567" />
          <TextInput label="Email" name="al-email" type="email" value={values.email} onChange={set("email")} />
          <TextInput label="Location" name="al-location" value={values.location} onChange={set("location")} />
        </div>
        <TextArea label="What do they need?" name="al-need" value={values.need} onChange={set("need")} maxLength={500} className="min-h-20" />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Budget (NGN)" name="al-budget" inputMode="numeric" value={values.budget} onChange={set("budget")} />
          <TextInput label="Timeline" name="al-timeline" value={values.timeline} onChange={set("timeline")} placeholder="e.g. within 2 weeks" />
          <SelectInput label="Decision maker?" name="al-dm" value={values.decisionMaker} onChange={set("decisionMaker")}>
            <option value="">Not sure</option><option value="yes">Yes</option><option value="no">No</option>
          </SelectInput>
        </div>
        <TextArea label="Notes" name="al-notes" value={values.notes} onChange={set("notes")} maxLength={2000} className="min-h-20" />
        <p className="text-xs text-muted">A phone number or email is required. Manually added leads are not on Telegram, so they cannot receive broadcasts until they message your bot.</p>
        {error ? <InlineNotice>{error}{existingId ? <> <Link className="font-semibold underline" href={`/leads/${encodeURIComponent(existingId)}`}>Open the existing lead</Link></> : null}</InlineNotice> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add lead"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ImportLeadsDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) return setMessage({ text: "That file is larger than 1 MB.", ok: false });
    setCsv(await file.text());
  }

  async function run() {
    if (busy) return;
    setMessage(null);
    const { leads, problems } = csvToLeads(csv);
    if (!leads.length) return setMessage({ text: problems.slice(0, 5).join(" ") || "No rows to import.", ok: false });
    setBusy(true);
    try {
      const result = await apiRequest<{ created: number; duplicates: number }>("/api/leads/import", { method: "POST", body: jsonBody({ leads }) });
      const skipped = problems.length ? ` ${problems.length} row${problems.length === 1 ? "" : "s"} had problems and were skipped: ${problems.slice(0, 3).join(" ")}` : "";
      setMessage({ text: `Imported ${result.created} lead${result.created === 1 ? "" : "s"}; ${result.duplicates} already existed.${skipped}`, ok: true });
      setCsv("");
      onImported();
    } catch (reason) {
      setMessage({ text: msg(reason, "We couldn't import these leads."), ok: false });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Import leads from CSV" description="Header row must include name, plus a phone or email for each lead. Optional columns: need, budget, location, timeline, notes, decision_maker (yes/no)." wide>
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">Upload a .csv file
          <input type="file" accept=".csv,text/csv" onChange={(e) => void readFile(e.target.files?.[0])} className="min-h-11 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm" />
        </label>
        <TextArea label="Or paste rows" name="il-csv" value={csv} onChange={(e) => setCsv(e.target.value)} className="min-h-40 font-mono text-xs" placeholder={"name,phone,email,need,budget\nAda Okafor,08031234567,ada@example.com,3-bedroom flat,25000000"} />
        <p className="text-xs text-muted">Up to 500 rows. Leads with a phone number or email already in your workspace are skipped, not overwritten.</p>
        {message ? <InlineNotice tone={message.ok ? "success" : "danger"}>{message.text}</InlineNotice> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={() => void run()} disabled={busy || !csv.trim()}>{busy ? "Importing..." : "Import"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
