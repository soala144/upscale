"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { TemplatePreview, VariablePalette } from "@/components/dashboard/broadcast-composer-parts";
import { Dialog } from "@/components/ui/dialog";
import { Button, InlineNotice, PageHeader, SelectInput, Skeleton, TextArea, TextInput } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import {
  createCampaign,
  getChannels,
  getTemplates,
  previewAudience,
  saveTemplate,
  sendCampaign,
  type AudiencePreview,
  type Channel,
  type Template,
} from "@/lib/api/broadcast";
import { ineligibleReasonLabels, leadStageValues, type AudienceFilters } from "@/lib/broadcast/audience";
import { validateTemplateBody } from "@/lib/broadcast/template";

const err = (reason: unknown, fallback: string) =>
  reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : fallback;

export function BroadcastComposer() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);

  const [mode, setMode] = useState<"filters" | "specific">("filters");
  const [stages, setStages] = useState<string[]>([]);
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [quietDays, setQuietDays] = useState("");

  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState("");
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateMsg, setTemplateMsg] = useState("");
  const draftId = useRef<string | null>(null);

  useEffect(() => {
    void Promise.all([getChannels(), getTemplates()])
      .then(([c, t]) => { setChannels(c); setTemplates(t); })
      .catch((reason) => setLoadError(err(reason, "We couldn't load Broadcast.")));
  }, []);

  // Built on demand (not memoized) because "last contacted" is relative to now.
  const buildFilters = (): AudienceFilters => {
    const result: AudienceFilters = {};
    if (stages.length) result.stages = stages as AudienceFilters["stages"];
    if (scoreMin !== "") result.scoreMin = Number(scoreMin);
    if (scoreMax !== "") result.scoreMax = Number(scoreMax);
    if (createdFrom) result.createdFrom = new Date(`${createdFrom}T00:00:00`).toISOString();
    if (createdTo) result.createdTo = new Date(`${createdTo}T23:59:59`).toISOString();
    if (quietDays) result.notContactedSince = new Date(Date.now() - Number(quietDays) * 86_400_000).toISOString();
    return result;
  };

  // Re-resolve the audience on the server whenever filters change (debounced).
  const filtersKey = JSON.stringify([mode, stages, scoreMin, scoreMax, createdFrom, createdTo, quietDays]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setAudienceLoading(true);
      setAudienceError("");
      const request = mode === "specific" ? {} : buildFilters();
      previewAudience(request)
        .then((result) => { if (!cancelled) { setAudience(result); setRemoved(new Set()); } })
        .catch((reason) => { if (!cancelled) setAudienceError(err(reason, "We couldn't load the audience.")); })
        .finally(() => { if (!cancelled) setAudienceLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const recipients = useMemo(() => {
    if (!audience) return [];
    return audience.leads.filter((lead) => lead.eligible && (mode === "specific" ? picked.has(lead.id) : !removed.has(lead.id)));
  }, [audience, mode, picked, removed]);

  // In filter mode the shown list may be capped (300); count removals against the full eligible total.
  const recipientCount = mode === "specific" ? recipients.length : audience ? audience.eligible - audience.leads.filter((l) => l.eligible && removed.has(l.id)).length : 0;

  const problems = validateTemplateBody(body);
  const channelReady = channels?.some((c) => c.available) ?? false;
  const canReview = Boolean(name.trim()) && problems.length === 0 && recipientCount > 0 && channelReady && !(audience?.overflow);

  function toggle(set: Set<string>, id: string, update: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    update(next);
  }

  async function send() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      if (!draftId.current) {
        const request: AudienceFilters = mode === "specific" ? { leadIds: [...picked] } : buildFilters();
        draftId.current = (await createCampaign({ name: name.trim(), body, templateId, filters: request })).id;
      }
      await sendCampaign(draftId.current, mode === "specific" ? [] : [...removed]);
      router.push(`/broadcast/${encodeURIComponent(draftId.current)}`);
    } catch (reason) {
      setSubmitError(err(reason, "We couldn't send this broadcast."));
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  async function saveAsTemplate() {
    setTemplateMsg("");
    if (!templateName.trim() || problems.length) { setTemplateMsg("Enter a template name and a valid message."); return; }
    try {
      await saveTemplate({ name: templateName.trim(), body });
      setTemplates(await getTemplates());
      setTemplateName("");
      setTemplateMsg("Template saved.");
    } catch (reason) {
      setTemplateMsg(err(reason, "We couldn't save the template."));
    }
  }

  if (loadError) return <InlineNotice>{loadError}</InlineNotice>;
  if (!channels) return <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const telegram = channels[0];
  const sample = recipients[0]?.name ?? undefined;

  return (
    <>
      <Link href="/broadcast" className="mb-5 inline-flex min-h-9 items-center gap-2 text-sm font-medium text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to broadcasts</Link>
      <PageHeader title="New broadcast" description="Choose who to message, write the message, then review before sending." />
      {submitError ? <div className="mb-4"><InlineNotice>{submitError}</InlineNotice></div> : null}

      <div className="grid gap-4">
        <section className="surface-card p-5">
          <h2 className="font-semibold">1. Campaign</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput label="Campaign name" name="campaign-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="October follow-up" />
            <div>
              <p className="mb-1.5 text-sm font-medium">Channel</p>
              <div className={`rounded-lg border px-3 py-2.5 text-sm ${telegram.available ? "border-primary/30 bg-success-foreground" : "border-border bg-surface-muted"}`}>
                <p className="font-semibold">{telegram.label} {telegram.available ? "" : "(not connected)"}</p>
                <p className="mt-0.5 text-xs text-muted">{telegram.detail}</p>
                {!telegram.available ? <Link className="mt-1 inline-block text-xs font-semibold text-primary hover:underline" href="/integrations">Go to Integrations</Link> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">2. Audience</h2>
            <div className="inline-flex rounded-lg border border-border-strong p-0.5" role="group" aria-label="Audience mode">
              {(["filters", "specific"] as const).map((item) => (
                <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`min-h-9 rounded-md px-3 text-sm font-medium ${mode === item ? "bg-primary text-primary-foreground" : "text-muted"}`}>
                  {item === "filters" ? "Use filters" : "Pick leads"}
                </button>
              ))}
            </div>
          </div>
          {mode === "filters" ? (
            <div className="mt-4 grid gap-4">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Lead status</legend>
                <div className="flex flex-wrap gap-2">
                  {leadStageValues.map((stage) => (
                    <label key={stage} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${stages.includes(stage) ? "border-primary bg-success-foreground" : "border-border-strong"}`}>
                      <input type="checkbox" className="accent-[var(--primary)]" checked={stages.includes(stage)} onChange={() => setStages(stages.includes(stage) ? stages.filter((s) => s !== stage) : [...stages, stage])} />
                      {stage.replaceAll("_", " ").toLowerCase()}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <TextInput label="Min score" name="score-min" type="number" min={0} max={100} value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} />
                <TextInput label="Max score" name="score-max" type="number" min={0} max={100} value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} />
                <SelectInput label="Last contacted" name="quiet" value={quietDays} onChange={(e) => setQuietDays(e.target.value)}>
                  <option value="">Any time</option>
                  <option value="7">Not in the last 7 days</option>
                  <option value="14">Not in the last 14 days</option>
                  <option value="30">Not in the last 30 days</option>
                </SelectInput>
                <TextInput label="Created from" name="created-from" type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
                <TextInput label="Created to" name="created-to" type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
              </div>
            </div>
          ) : <p className="mt-3 text-sm text-muted">Tick the contacts you want to message below.</p>}

          <div className="mt-5 border-t border-border pt-4" aria-live="polite">
            {audienceError ? <InlineNotice>{audienceError}</InlineNotice> : audienceLoading && !audience ? <Skeleton className="h-16" /> : audience ? (
              <>
                <p className="text-sm"><span className="text-lg font-semibold tabular-nums">{recipientCount.toLocaleString()}</span> recipient{recipientCount === 1 ? "" : "s"} will be messaged <span className="text-muted">({audience.total.toLocaleString()} matched)</span></p>
                {(["OPTED_OUT", "NO_DESTINATION", "NOT_CONNECTED"] as const).filter((r) => audience.ineligible[r] > 0).map((r) => (
                  <p key={r} className="mt-1 text-xs text-muted">{audience.ineligible[r].toLocaleString()} excluded: {ineligibleReasonLabels[r]}</p>
                ))}
                {audience.overflow ? <div className="mt-3"><InlineNotice>More than {audience.maxRecipients.toLocaleString()} leads match. Narrow the filters to continue.</InlineNotice></div> : null}
                {audience.leads.length ? (
                  <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border">
                    <ul className="divide-y divide-border">
                      {audience.leads.map((lead) => {
                        const checked = mode === "specific" ? picked.has(lead.id) : !removed.has(lead.id);
                        return (
                          <li key={lead.id}>
                            <label className={`flex min-h-11 items-center gap-3 px-3 py-2 text-sm ${lead.eligible ? "cursor-pointer hover:bg-surface-muted" : "opacity-60"}`}>
                              <input type="checkbox" className="accent-[var(--primary)]" disabled={!lead.eligible} checked={lead.eligible && checked} aria-label={`Include ${lead.name || "unnamed lead"}`}
                                onChange={() => mode === "specific" ? toggle(picked, lead.id, setPicked) : toggle(removed, lead.id, setRemoved)} />
                              <span className="min-w-0 flex-1 truncate">{lead.name || "Unnamed lead"}</span>
                              <span className="shrink-0 text-xs text-muted">{lead.eligible ? `${lead.stage.replaceAll("_", " ").toLowerCase()} · ${lead.score}` : lead.reason ? ineligibleReasonLabels[lead.reason] : ""}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : <p className="mt-3 text-sm text-muted">No leads match these filters.</p>}
                {audience.total > audience.leads.length ? <p className="mt-2 text-xs text-muted">Showing the first {audience.leads.length} of {audience.total.toLocaleString()}. Use filters to review the rest.</p> : null}
              </>
            ) : null}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-semibold">3. Message</h2>
          <div className="mt-4 grid gap-4">
            <SelectInput label="Start from a template" name="template" value={templateId ?? ""} onChange={(e) => {
              const picked = templates.find((t) => t.id === e.target.value);
              setTemplateId(picked?.id ?? null);
              if (picked) setBody(picked.body);
            }}>
              <option value="">No template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectInput>
            <TextArea label="Message" name="message" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-36" error={body && problems.length ? problems.join(" ") : undefined} />
            <VariablePalette onInsert={(token) => setBody((c) => `${c}${token}`)} />
            <TemplatePreview body={body} context={sample ? { name: sample, businessName: "Your business" } : undefined} />
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1"><TextInput label="Save as template" name="save-template" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" /></div>
              <Button type="button" variant="secondary" onClick={() => void saveAsTemplate()}>Save</Button>
            </div>
            {templateMsg ? <p className="text-xs text-muted" role="status">{templateMsg}</p> : null}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Link href="/broadcast" className="inline-flex min-h-10 items-center rounded-lg border border-border-strong px-4 text-sm font-semibold hover:bg-surface-muted">Cancel</Link>
          <Button disabled={!canReview || submitting} onClick={() => setConfirmOpen(true)}>Review and send</Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} title="Send broadcast now?" description="Messages are sent immediately and cannot be recalled.">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Campaign</dt><dd className="font-semibold">{name}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Channel</dt><dd>Telegram</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Recipients</dt><dd className="font-semibold">{recipientCount.toLocaleString()}</dd></div>
        </dl>
        <div className="mt-4"><TemplatePreview body={body} context={sample ? { name: sample, businessName: "Your business" } : undefined} /></div>
        <p className="mt-3 text-xs text-muted">Contacts who opted out are excluded automatically. Telegram confirms acceptance, not that the message was read.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(false)}>Back</Button>
          <Button disabled={submitting} onClick={() => void send()}>{submitting ? "Sending..." : `Send to ${recipientCount.toLocaleString()}`}</Button>
        </div>
      </Dialog>
    </>
  );
}
