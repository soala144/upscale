"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2, Upload } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button, EmptyState, InlineNotice, PageHeader, Skeleton, StatusBadge, TextArea, TextInput } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import { deleteKnowledge, getKnowledge, importKnowledge, saveKnowledge, type KnowledgeItem } from "@/lib/api/knowledge";
import { csvToProducts } from "@/lib/validation/knowledge";

const msg = (reason: unknown, fallback: string) =>
  reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : fallback;

type Draft = { id?: string; kind: "PRODUCT" | "FAQ"; title: string; content: string; price: string; available: boolean };
const blank = (kind: "PRODUCT" | "FAQ"): Draft => ({ kind, title: "", content: "", price: "", available: true });

export function KnowledgePage() {
  const [tab, setTab] = useState<"PRODUCT" | "FAQ">("PRODUCT");
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [importMsg, setImportMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await getKnowledge()); }
    catch (reason) { setError(msg(reason, "We couldn't load your knowledge base.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const visible = items.filter((item) => item.kind === tab);

  async function save() {
    if (!draft || saving) return;
    setFormError("");
    const price = draft.price.trim() === "" ? null : Number(draft.price);
    if (draft.kind === "PRODUCT" && price !== null && (!Number.isFinite(price) || price < 0)) return setFormError("Enter a valid price.");
    setSaving(true);
    try {
      await saveKnowledge({ kind: draft.kind, title: draft.title, content: draft.content, price: draft.kind === "PRODUCT" ? price : null, available: draft.available }, draft.id);
      setDraft(null);
      await load();
    } catch (reason) { setFormError(msg(reason, "We couldn't save this entry.")); }
    finally { setSaving(false); }
  }

  async function remove(item: KnowledgeItem) {
    if (!window.confirm(`Delete "${item.title}"? The bot will stop using it.`)) return;
    try { await deleteKnowledge(item.id); await load(); }
    catch (reason) { setError(msg(reason, "We couldn't delete this entry.")); }
  }

  async function runImport() {
    setImportMsg("");
    const { items: parsed, problems } = csvToProducts(csv);
    if (problems.length) return setImportMsg(problems.slice(0, 5).join(" "));
    if (!parsed.length) return setImportMsg("No rows to import.");
    try {
      const result = await importKnowledge(parsed);
      setImportMsg(`Imported ${result.created} product${result.created === 1 ? "" : "s"}.`);
      setCsv("");
      await load();
    } catch (reason) { setImportMsg(msg(reason, "We couldn't import these rows.")); }
  }

  return (
    <>
      <PageHeader
        title="Knowledge"
        description="What your assistant knows about your business. It answers prices, products and policies only from what you add here."
        actions={
          <div className="flex gap-2">
            {tab === "PRODUCT" ? <Button variant="secondary" onClick={() => { setImportMsg(""); setImportOpen(true); }}><Upload className="h-4 w-4" aria-hidden="true" /> Import CSV</Button> : null}
            <Button onClick={() => { setFormError(""); setDraft(blank(tab)); }}><Plus className="h-4 w-4" aria-hidden="true" /> {tab === "PRODUCT" ? "Add product" : "Add FAQ"}</Button>
          </div>
        }
      />
      <div className="mb-5 flex gap-1 border-b border-border" role="tablist" aria-label="Knowledge sections">
        {([["PRODUCT", "Products and services"], ["FAQ", "FAQs and policies"]] as const).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold ${tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}>
            {label} ({items.filter((item) => item.kind === key).length})
          </button>
        ))}
      </div>
      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
      {loading ? <Skeleton className="h-48" /> : visible.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <li key={item.id} className="surface-card flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{item.title}</h3>
                  {item.kind === "PRODUCT" ? <p className="mt-0.5 text-sm font-semibold text-primary">{item.price ? `${item.currency} ${Number(item.price).toLocaleString()}` : "No price set"}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.kind === "PRODUCT" && !item.available ? <StatusBadge tone="warning">Unavailable</StatusBadge> : null}
                  <button type="button" aria-label={`Edit ${item.title}`} onClick={() => { setFormError(""); setDraft({ id: item.id, kind: item.kind, title: item.title, content: item.content, price: item.price ?? "", available: item.available }); }} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Delete ${item.title}`} onClick={() => void remove(item)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted">{item.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="surface-card">
          <EmptyState icon={<BookOpen className="h-5 w-5" />} title={tab === "PRODUCT" ? "No products or services yet" : "No FAQs yet"}
            description={tab === "PRODUCT" ? "Add what you sell with prices so the assistant can quote them accurately." : "Add common questions such as delivery, refunds and opening hours."} />
        </section>
      )}

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={`${draft?.id ? "Edit" : "Add"} ${draft?.kind === "FAQ" ? "FAQ" : "product or service"}`} wide>
        {draft ? (
          <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <TextInput label={draft.kind === "FAQ" ? "Question" : "Name"} name="k-title" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            {draft.kind === "PRODUCT" ? <TextInput label="Price (NGN)" name="k-price" type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Leave empty if the price varies" /> : null}
            <TextArea label={draft.kind === "FAQ" ? "Answer" : "Description"} name="k-content" value={draft.content} maxLength={2000} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            {draft.kind === "PRODUCT" ? (
              <label className="inline-flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--primary)]" checked={draft.available} onChange={(e) => setDraft({ ...draft, available: e.target.checked })} /> Currently available</label>
            ) : null}
            {formError ? <InlineNotice>{formError}</InlineNotice> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} title="Import products from CSV" description="Paste rows from a spreadsheet. First row must be the header: name, price, description (optional: available)." wide>
        <div className="grid gap-4">
          <TextArea label="CSV" name="k-csv" value={csv} onChange={(e) => setCsv(e.target.value)} className="min-h-40 font-mono text-xs" placeholder={"name,price,description\nBlue sneakers,25000,Size 40-45 in stock"} />
          {importMsg ? <InlineNotice tone={importMsg.startsWith("Imported") ? "success" : "danger"}>{importMsg}</InlineNotice> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Close</Button>
            <Button onClick={() => void runImport()} disabled={!csv.trim()}>Import</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
