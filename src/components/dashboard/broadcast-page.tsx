"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Send, Trash2 } from "lucide-react";

import { CampaignStatusBadge } from "@/components/dashboard/overview-page";
import { Dialog } from "@/components/ui/dialog";
import { Button, EmptyState, InlineNotice, PageHeader, Skeleton, TextArea, TextInput } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import {
  deleteTemplate,
  getCampaigns,
  getTemplates,
  saveTemplate,
  type CampaignSummary,
  type Template,
} from "@/lib/api/broadcast";
import { VariablePalette, TemplatePreview } from "@/components/dashboard/broadcast-composer-parts";
import { validateTemplateBody } from "@/lib/broadcast/template";

function message(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : fallback;
}

export function BroadcastPage() {
  const [tab, setTab] = useState<"campaigns" | "templates">("campaigns");
  return (
    <>
      <PageHeader
        title="Broadcast"
        description="Follow up with existing leads over Telegram. Only contacts who have messaged your bot and have not opted out can be reached."
        actions={
          <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" href="/broadcast/new">
            <Plus className="h-4 w-4" aria-hidden="true" /> New broadcast
          </Link>
        }
      />
      <div className="mb-5 flex gap-1 border-b border-border" role="tablist" aria-label="Broadcast sections">
        {(["campaigns", "templates"] as const).map((item) => (
          <button
            key={item}
            role="tab"
            type="button"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold capitalize ${tab === item ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "campaigns" ? <CampaignList /> : <TemplateManager />}
    </>
  );
}

function CampaignList() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCampaigns(page);
      setCampaigns(result.campaigns);
      setTotal(result.total);
      setPageSize(result.pageSize);
    } catch (reason) {
      setError(message(reason, "We couldn't load your campaigns."));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (loading) return <div className="grid gap-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20" />)}</div>;
  if (error) return <><InlineNotice>{error}</InlineNotice><button className="mt-3 text-sm font-semibold text-primary underline" type="button" onClick={() => void load()}>Try again</button></>;
  if (!campaigns.length) {
    return (
      <section className="surface-card">
        <EmptyState icon={<Send className="h-5 w-5" />} title="No broadcasts yet" description="Create a campaign to follow up with leads you have already talked to." action={<Link className="text-sm font-semibold text-primary hover:underline" href="/broadcast/new">Create your first broadcast</Link>} />
      </section>
    );
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-muted">
          <span>{total.toLocaleString()} campaign{total === 1 ? "" : "s"}</span>
          <button type="button" onClick={() => void load()} aria-label="Refresh campaigns" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-muted"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <ul className="divide-y divide-border">
          {campaigns.map((campaign) => {
            const processed = campaign.counts.sent + campaign.counts.failed + campaign.counts.skipped;
            return (
              <li key={campaign.id}>
                <Link className="grid gap-2 px-5 py-4 hover:bg-surface-muted sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" href={`/broadcast/${encodeURIComponent(campaign.id)}`}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{campaign.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Telegram · {new Date(campaign.createdAt).toLocaleString()}
                      {campaign.status === "DRAFT" ? "" : ` · ${campaign.counts.sent.toLocaleString()} sent, ${campaign.counts.failed.toLocaleString()} failed, ${campaign.counts.skipped.toLocaleString()} skipped (${processed.toLocaleString()}/${campaign.counts.total.toLocaleString()} processed)`}
                    </p>
                  </div>
                  <CampaignStatusBadge status={campaign.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted">Page {page} of {pages}</span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      ) : null}
    </>
  );
}

function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTemplates(await getTemplates());
    } catch (reason) {
      setError(message(reason, "We couldn't load your templates."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function open(template: Partial<Template>) {
    setEditing(template);
    setName(template.name ?? "");
    setBody(template.body ?? "");
    setFormError("");
  }

  async function save() {
    if (saving) return;
    const problems = validateTemplateBody(body);
    if (!name.trim()) problems.unshift("Enter a template name.");
    if (problems.length) { setFormError(problems.join(" ")); return; }
    setSaving(true);
    setFormError("");
    try {
      await saveTemplate({ id: editing?.id, name: name.trim(), body });
      setEditing(null);
      await load();
    } catch (reason) {
      setFormError(message(reason, "We couldn't save this template."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(template: Template) {
    if (!window.confirm(`Delete the template "${template.name}"? Campaigns already sent keep their message.`)) return;
    try {
      await deleteTemplate(template.id);
      await load();
    } catch (reason) {
      setError(message(reason, "We couldn't delete this template."));
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open({})}><Plus className="h-4 w-4" aria-hidden="true" /> New template</Button>
      </div>
      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
      {loading ? <Skeleton className="h-40" /> : templates.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <li key={template.id} className="surface-card flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-semibold">{template.name}</h3>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Edit ${template.name}`} onClick={() => open(template)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Delete ${template.name}`} onClick={() => void remove(template)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted">{template.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="surface-card"><EmptyState title="No templates yet" description="Save reusable messages with personalization like {{first_name}}." /></section>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit template" : "New template"} wide>
        <form className="grid gap-4" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <TextInput label="Name" name="template-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          <TextArea label="Message" name="template-body" value={body} onChange={(event) => setBody(event.target.value)} className="min-h-36" />
          <VariablePalette onInsert={(token) => setBody((current) => `${current}${token}`)} />
          <TemplatePreview body={body} />
          {formError ? <InlineNotice>{formError}</InlineNotice> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save template"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
