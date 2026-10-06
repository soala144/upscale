"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, LoaderCircle, MessageCircle, Radio, RefreshCw } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button, Card, InlineNotice, PageHeader, Skeleton, StatusBadge, TextInput } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import { getBachsStatus, connectBachs, type BachsStatus } from "@/lib/api/bachs";
import { getHealth, type Health } from "@/lib/api/health";
import { connectTelegram, disconnectTelegram, getTelegramStatus, type TelegramConnection } from "@/lib/api/telegram";
import { telegramFormSchema } from "@/lib/validation/forms";

type TelegramValues = z.input<typeof telegramFormSchema>;

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "We couldn't complete the integration request.";
}

function telegramError(error: unknown) {
  if (error instanceof ApiError && error.status === 400) {
    return "We couldn't connect this Telegram bot. Please verify the bot credentials and try again.";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "Telegram is temporarily unavailable. Please try again later.";
  }
  return message(error);
}

export function IntegrationsPage() {
  const [bachs, setBachs] = useState<BachsStatus | null>(null);
  const [telegram, setTelegram] = useState<TelegramConnection | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const telegramForm = useForm<TelegramValues>({
    resolver: zodResolver(telegramFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { botToken: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const problems: string[] = [];
    const [bachsResult, telegramResult, healthResult] = await Promise.allSettled([
      getBachsStatus(), getTelegramStatus(), getHealth(),
    ]);
    if (bachsResult.status === "fulfilled") setBachs(bachsResult.value);
    else problems.push(`Bachs: ${message(bachsResult.reason)}`);
    if (telegramResult.status === "fulfilled") setTelegram(telegramResult.value.connection);
    else problems.push(`Telegram: ${message(telegramResult.reason)}`);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    else problems.push(`System health: ${message(healthResult.reason)}`);
    setErrors(problems);
    setLoading(false);
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function connectPaymentAccount() {
    setBusy("bachs");
    setNotice("");
    setErrors([]);
    try {
      const result = await connectBachs();
      setBachs({ accountId: result.accountId, status: result.status });
      setNotice("Bachs connection started. Complete provider onboarding, then refresh this page to check readiness.");
      if (result.onboardingUrl) window.location.assign(result.onboardingUrl);
    } catch (reason) { setErrors([`Bachs: ${message(reason)}`]); }
    finally { setBusy(""); }
  }

  async function connectBot(values: TelegramValues) {
    setBusy("telegram");
    setNotice("");
    setErrors([]);
    try {
      const result = await connectTelegram(values.botToken.trim());
      setTelegram({ ...result.connection, connected: result.connection.status === "CONNECTED" });
      telegramForm.reset({ botToken: "" });
      setNotice(`Connected to @${result.connection.botUsername}.`);
    } catch (reason) { setErrors([telegramError(reason)]); }
    finally { setBusy(""); }
  }

  async function disconnectBot() {
    setBusy("disconnect");
    setErrors([]);
    try {
      await disconnectTelegram();
      setTelegram(null);
      setNotice("Telegram bot disconnected.");
    } catch (reason) { setErrors([`Telegram: ${message(reason)}`]); }
    finally { setBusy(""); }
  }

  if (loading) return <div className="grid gap-4"><Skeleton className="h-10 w-52" /><Skeleton className="h-56" /><Skeleton className="h-56" /></div>;

  return (
    <>
      <PageHeader title="Integrations" description="Connect the business-owned services that power qualification and payments." actions={<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-muted"><RefreshCw className="h-4 w-4" /> Refresh</button>} />
      {errors.length ? <div className="mb-4 grid gap-2">{errors.map((item) => <InlineNotice key={item}>{item}</InlineNotice>)}</div> : null}
      {notice ? <div className="mb-4"><InlineNotice tone="success">{notice}</InlineNotice></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-muted text-primary"><Activity className="h-5 w-5" /></span><div><h2 className="font-semibold">Bachs</h2><p className="mt-1 text-sm text-muted">Your account receives customer payments.</p></div></div>
            {bachs ? <StatusBadge tone={bachs.status === "READY" || bachs.status === "CONNECTED" ? "success" : bachs.status === "ONBOARDING" ? "warning" : "neutral"}>{bachs.status}</StatusBadge> : null}
          </div>
          <p className="mt-5 text-sm leading-6 text-muted">{bachs?.status === "READY" || bachs?.status === "CONNECTED" ? `Account ${bachs.accountId ?? ""} is connected. Checkout payments use this business account.` : bachs?.status === "ONBOARDING" ? "Finish your Bachs account onboarding. Refresh after completing the provider flow to confirm payment readiness." : "Connect your own Bachs account to request payments from qualified leads."}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {bachs?.status !== "READY" && bachs?.status !== "CONNECTED" ? <Button onClick={connectPaymentAccount} disabled={Boolean(busy)}>{busy === "bachs" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Connecting...</> : "Connect Bachs"}</Button> : null}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">No account-creation URL is configured by this integration, so UPSCALE does not link to an unverified signup page.</p>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-muted text-primary"><MessageCircle className="h-5 w-5" /></span><div><h2 className="font-semibold">Telegram</h2><p className="mt-1 text-sm text-muted">Connect the bot your customers will message.</p></div></div>
            {telegram ? <StatusBadge tone={telegram.connected ? "success" : "danger"}>{telegram.status}</StatusBadge> : <StatusBadge>Not connected</StatusBadge>}
          </div>
          {telegram?.connected ? <div className="mt-5 rounded-lg border border-border bg-surface-muted p-4"><p className="font-semibold">@{telegram.botUsername}</p><p className="mt-1 text-sm text-muted">{telegram.botName || "Business Telegram bot"}</p></div> : (
            <form className="mt-5 grid gap-3" onSubmit={telegramForm.handleSubmit(connectBot)} noValidate>
              <TextInput label="Bot token" type="password" autoComplete="off" required {...telegramForm.register("botToken")} error={telegramForm.formState.errors.botToken?.message} placeholder="Paste the token from BotFather" />
              <p className="-mt-2 text-xs text-muted">The token is sent only on submit and is not saved in browser storage.</p>
              <Button type="submit" disabled={Boolean(busy) || telegramForm.formState.isSubmitting}>{busy === "telegram" || telegramForm.formState.isSubmitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Connecting Telegram...</> : "Connect Telegram"}</Button>
            </form>
          )}
          {telegram?.connected ? <Button variant="secondary" className="mt-5" onClick={disconnectBot} disabled={Boolean(busy)}>{busy === "disconnect" ? "Disconnecting..." : "Disconnect bot"}</Button> : null}
        </Card>

        <Card className="p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-muted text-primary"><Radio className="h-5 w-5" /></span><div><h2 className="font-semibold">System health</h2><p className="mt-1 text-sm text-muted">Public health endpoint reports API and database availability.</p></div></div>
          {health ? <div className="mt-5 grid gap-3 sm:grid-cols-3"><HealthItem label="API" healthy={health.status === "ok"} /><HealthItem label="Database" healthy={health.database === "ok"} /><div className="rounded-lg border border-border p-4"><p className="text-xs text-muted">Checked</p><p className="mt-1 text-sm font-medium">{new Date(health.timestamp).toLocaleString()}</p></div></div> : <p className="mt-5 text-sm text-muted">Health details unavailable.</p>}
          <p className="mt-4 text-xs text-muted">The backend does not expose provider-specific health probes for Claude, Telegram, or Bachs.</p>
        </Card>
      </div>
    </>
  );
}

function HealthItem({ label, healthy }: { label: string; healthy: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"><span className="text-sm font-medium">{label}</span><StatusBadge tone={healthy ? "success" : "danger"}>{healthy ? "Healthy" : "Unavailable"}</StatusBadge></div>;
}
