"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Send } from "lucide-react";

import { formatNaira } from "@/components/dashboard/overview-page";
import { Dialog } from "@/components/ui/dialog";
import { Button, InlineNotice, SelectInput, TextInput } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import { getKnowledge, type KnowledgeItem } from "@/lib/api/knowledge";
import { getLeads, sendHumanReply, type Lead } from "@/lib/api/leads";
import { createCustomerCheckout } from "@/lib/api/payments";

const msg = (reason: unknown, fallback: string) =>
  reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : fallback;

export function PaymentLinkDialog({ open, onClose, onCreated, presetLeadId }: {
  open: boolean; onClose: () => void; onCreated: () => void; presetLeadId?: string;
}) {
  const [products, setProducts] = useState<KnowledgeItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [leadId, setLeadId] = useState(presetLeadId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState("");

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => { setLink(null); setError(""); setSendState(""); setCopied(false); });
    void getKnowledge().then((items) => setProducts(items.filter((item) => item.kind === "PRODUCT" && item.available))).catch(() => undefined);
    void getLeads().then(setLeads).catch(() => undefined);
  }, [open]);

  // Picking a product fills in the description and the total; both stay editable.
  function chooseProduct(id: string, qty: string) {
    setProductId(id);
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const count = Math.max(1, Math.floor(Number(qty) || 1));
    setDescription(count > 1 ? `${count} x ${product.title}` : product.title);
    if (product.price) setAmount(String(Math.round(Number(product.price) * count * 100) / 100));
  }

  async function create() {
    if (busy) return;
    setError("");
    const value = Number(amount.replace(/[₦,\s]/g, ""));
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero.");
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) return setError("Use at most two decimal places.");
    setBusy(true);
    try {
      const result = await createCustomerCheckout({ amount: value, leadId: leadId || undefined, description: description.trim() || undefined });
      setLink({ url: result.checkoutUrl, amount: Number(result.amount) });
      onCreated();
    } catch (reason) {
      setError(msg(reason, "We couldn't create the payment link."));
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError("Copy is not available here. Select the link and copy it manually."); }
  }

  async function sendOnTelegram() {
    if (!link || !leadId) return;
    setSendState("sending");
    try {
      await sendHumanReply(leadId, `Here is your payment link for ${formatNaira(link.amount)}${description ? ` (${description})` : ""}: ${link.url}`);
      setSendState("sent");
    } catch (reason) { setSendState(msg(reason, "We couldn't send it on Telegram.")); }
  }

  const selectedLead = leads.find((lead) => lead.id === leadId);

  return (
    <Dialog open={open} onClose={onClose} title="New payment link" description="Create a link a customer can open to pay you. Money goes to your connected Bachs account." wide>
      {link ? (
        <div className="grid gap-4" role="status">
          <InlineNotice tone="success">Payment link created for {formatNaira(link.amount)}. It stays pending until Bachs confirms payment.</InlineNotice>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly aria-label="Payment link" value={link.url} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-muted px-3 text-sm" />
            <Button variant="secondary" onClick={() => void copy()}>{copied ? <><Check className="h-4 w-4" aria-hidden="true" /> Copied</> : <><Copy className="h-4 w-4" aria-hidden="true" /> Copy</>}</Button>
          </div>
          {leadId ? (
            <div>
              <Button onClick={() => void sendOnTelegram()} disabled={sendState === "sending" || sendState === "sent"}><Send className="h-4 w-4" aria-hidden="true" /> {sendState === "sent" ? "Sent on Telegram" : `Send to ${selectedLead?.name ?? "customer"} on Telegram`}</Button>
              {sendState && !["sending", "sent"].includes(sendState) ? <div className="mt-3"><InlineNotice>{sendState}</InlineNotice></div> : null}
              <p className="mt-2 text-xs text-muted">Sending from here pauses the assistant for that chat. Use Hand back to AI on the lead when you are done.</p>
            </div>
          ) : <p className="text-xs text-muted">Copy the link and send it to the customer on any channel.</p>}
          {error ? <InlineNotice>{error}</InlineNotice> : null}
          <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Done</Button></div>
        </div>
      ) : (
        <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <SelectInput label="Product (optional)" name="pl-product" value={productId} onChange={(e) => chooseProduct(e.target.value, quantity)}>
              <option value="">Custom amount</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.title}{product.price ? ` · ${formatNaira(Number(product.price))}` : ""}</option>)}
            </SelectInput>
            <TextInput label="Quantity" name="pl-qty" type="number" min={1} step={1} value={quantity} onChange={(e) => { setQuantity(e.target.value); if (productId) chooseProduct(productId, e.target.value); }} />
          </div>
          <TextInput label="What is it for?" name="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="2 x Leather wallet" />
          <TextInput label="Amount (NGN)" name="pl-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25000" />
          <SelectInput label="For lead (optional)" name="pl-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">No lead</option>
            {leads.filter((lead) => lead.stage !== "CONVERTED").map((lead) => <option key={lead.id} value={lead.id}>{lead.name || "Unnamed lead"}</option>)}
          </SelectInput>
          <p className="text-xs text-muted">Linking a lead moves it to Payment pending, and to Converted once Bachs confirms payment.</p>
          {error ? <InlineNotice>{error}</InlineNotice> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create link"}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
