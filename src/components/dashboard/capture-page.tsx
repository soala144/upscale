"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { InlineNotice, PageHeader, Skeleton, TextInput } from "@/components/ui/primitives";
import { getOrganization } from "@/lib/api/organizations";
import { getTelegramStatus } from "@/lib/api/telegram";
import { authClient } from "@/lib/auth/client";

export function CapturePage() {
  const session = authClient.useSession();
  const organizationId = session.data?.session.activeOrganizationId;
  const [slug, setSlug] = useState<string | null>(null);
  const [bot, setBot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tag, setTag] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    void Promise.all([getOrganization(organizationId), getTelegramStatus()])
      .then(([organization, telegram]) => {
        setSlug(organization.slug);
        setBot(telegram.connection?.connected ? telegram.connection.botUsername : null);
      })
      .catch(() => setError("We couldn't load your links."))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const cleanTag = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30).replace(/^-+|-+$/g, "");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const formLink = slug ? `${origin}/c/${slug}${cleanTag ? `?src=${cleanTag}` : ""}` : "";
  const telegramLink = bot ? `https://t.me/${bot}${cleanTag ? `?start=s_${cleanTag}` : ""}` : "";

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch { setError("Copy is not available here. Select the link and copy it manually."); }
  }

  const row = (key: string, title: string, description: string, link: string, unavailable?: ReactNodeLike) => (
    <section className="surface-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {link ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input readOnly aria-label={`${title} link`} value={link} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-muted px-3 text-sm" />
          <button type="button" onClick={() => void copy(key, link)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-muted">
            {copied === key ? <><Check className="h-4 w-4" aria-hidden="true" /> Copied</> : <><Copy className="h-4 w-4" aria-hidden="true" /> Copy</>}
          </button>
        </div>
      ) : <div className="mt-4">{unavailable}</div>}
    </section>
  );

  return (
    <>
      <PageHeader title="Lead capture" description="Links to put in your ads, posts and bio. Customers who tap them become leads automatically." />
      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
      {loading ? <Skeleton className="h-64" /> : (
        <div className="grid max-w-3xl gap-4">
          <section className="surface-card p-5">
            <TextInput label="Where will you share this? (optional)" name="cap-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="instagram-october" maxLength={40} />
            <p className="mt-2 text-xs text-muted">Adds a label to every lead from this link, so you can see which ad worked. Letters, numbers and dashes only.</p>
          </section>
          {row("tg", "Chat link (Telegram)", "Customers tap it and the chat with your assistant starts straight away.", telegramLink,
            <InlineNotice tone="info">Connect your Telegram bot in <Link className="font-semibold underline" href="/integrations">Integrations</Link> to get a chat link.</InlineNotice>)}
          {row("form", "Enquiry form", "A short form that works in any browser. Afterwards the customer can continue on Telegram with their details already filled in.", formLink)}
        </div>
      )}
    </>
  );
}

type ReactNodeLike = React.ReactNode;
