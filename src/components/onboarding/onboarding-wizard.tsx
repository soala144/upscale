"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDollarSign,
  LoaderCircle,
  MessageCircle,
  Radio,
  Sparkles,
} from "lucide-react";

import { Button, ButtonLink, Card, InlineNotice, Skeleton, StatusBadge, TextArea, TextInput } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth/client";
import { connectBachs, getBachsStatus, type BachsStatus } from "@/lib/api/bachs";
import { ApiError } from "@/lib/api/client";
import { createOrganization, getOrganization, updateOrganization, type Organization, type Plan } from "@/lib/api/organizations";
import { connectTelegram, getTelegramStatus, type TelegramConnection } from "@/lib/api/telegram";
import {
  agentFormSchema,
  businessProfileFormSchema,
  telegramFormSchema,
} from "@/lib/validation/forms";

const steps = [
  { key: "business", label: "Business", icon: Radio },
  { key: "plan", label: "Plan", icon: Check },
  { key: "bachs", label: "Bachs", icon: CircleDollarSign },
  { key: "telegram", label: "Telegram", icon: MessageCircle },
  { key: "agent", label: "AI agent", icon: Sparkles },
  { key: "review", label: "Review", icon: Check },
] as const;

const planOptions: { id: Plan; price: string; description: string }[] = [
  { id: "BASIC", price: "₦3,500 / month", description: "Start qualifying conversations." },
  { id: "GROWTH", price: "₦5,000 / month", description: "Recommended for growing teams." },
  { id: "SCALE", price: "₦10,000 / month", description: "Build a repeatable conversion engine." },
];

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : "We couldn't complete that request. Please try again.";
}

function integrationError(error: unknown, integration: "Bachs" | "Telegram") {
  if (error instanceof ApiError && error.status === 400 && integration === "Telegram") {
    return "We couldn't connect this Telegram bot. Please verify the bot credentials and try again.";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return `${integration} is temporarily unavailable. Please try again later.`;
  }
  return errorText(error);
}

function focusFirstInvalidField(fields: string[]) {
  const field = fields.find((name) => name !== "description") ??
    (document.querySelector('[name="agentBusinessDescription"]') ? "agentBusinessDescription" : "description");
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)?.focus();
}

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = authClient.useSession();
  const activeOrganizationId = session.data?.session.activeOrganizationId;
  const selectedPlan = searchParams.get("plan")?.toUpperCase();
  const [step, setStep] = useState<(typeof steps)[number]["key"]>("business");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [bachs, setBachs] = useState<BachsStatus | null>(null);
  const [telegram, setTelegram] = useState<TelegramConnection | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<Plan>(
    selectedPlan === "BASIC" || selectedPlan === "GROWTH" || selectedPlan === "SCALE"
      ? selectedPlan
      : "GROWTH",
  );
  const [agentName, setAgentName] = useState("Helen");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [botToken, setBotToken] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (session.isPending) return;
    if (!session.data) {
      router.replace("/sign-in");
      return;
    }
    if (!activeOrganizationId) {
      return;
    }
    let active = true;
    Promise.allSettled([
      getOrganization(activeOrganizationId),
      getBachsStatus(),
      getTelegramStatus(),
    ]).then(([organizationResult, bachsResult, telegramResult]) => {
      if (!active) return;
      if (organizationResult.status === "rejected") {
        setError(errorText(organizationResult.reason));
        setLoaded(true);
        return;
      }
      const org = organizationResult.value;
      setOrganization(org);
      setBusinessName(org.name);
      setSlug(org.slug);
      setIndustry(org.industry ?? "");
      setDescription(org.description ?? "");
      setAgentName(org.agentName);
      setAgentPrompt(org.agentPrompt ?? "");
      if (bachsResult.status === "fulfilled") setBachs(bachsResult.value);
      else setError(`Bachs: ${errorText(bachsResult.reason)}`);
      if (telegramResult.status === "fulfilled") setTelegram(telegramResult.value.connection);
      else setError(`Telegram: ${errorText(telegramResult.reason)}`);
      setLoaded(true);
      setStep(org.onboarding?.currentStep === "CONNECT_TELEGRAM" ? "telegram" :
        org.onboarding?.currentStep === "CONNECT_BACHS" ? "bachs" : "review");
    }).catch((reason: unknown) => {
      if (active) {
        setError(errorText(reason));
        setLoaded(true);
      }
    });
    return () => { active = false; };
  }, [activeOrganizationId, router, session.data, session.isPending]);

  const stepIndex = useMemo(() => steps.findIndex((item) => item.key === step), [step]);

  function updateBusinessName(value: string) {
    setBusinessName(value);
    setSlug(value.trim().toLowerCase().normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 63));
    setFieldErrors((current) => ({ ...current, name: "", slug: "" }));
  }

  function continueBusiness() {
    const result = businessProfileFormSchema.safeParse({
      name: businessName,
      slug,
      industry,
      description,
    });
    if (!result.success) {
      const issues = result.error.issues;
      setFieldErrors(Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message])));
      focusFirstInvalidField(issues.map((issue) => String(issue.path[0])));
      return;
    }
    setFieldErrors({});
    setStep("plan");
  }

  async function saveBusiness() {
    setBusy("business");
    setError("");
    try {
      const org = organization ?? await createOrganization({
        name: businessName.trim(),
        slug: slug.trim(),
        plan,
        industry: industry.trim() || undefined,
        description: description.trim() || undefined,
      });
      setOrganization(org);
      const activated = await authClient.organization.setActive({ organizationId: org.id });
      if (activated.error) throw new Error(activated.error.message);
      setStep("bachs");
      router.refresh();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setFieldErrors({ slug: "That workspace address is already in use. Choose another." });
        setError("Please correct the highlighted workspace address.");
      } else setError(errorText(reason));
    } finally {
      setBusy("");
    }
  }

  async function startBachs() {
    setBusy("bachs");
    setError("");
    try {
      const result = await connectBachs();
      setBachs({ accountId: result.accountId, status: result.status });
      if (result.onboardingUrl) window.location.assign(result.onboardingUrl);
      else setStep("telegram");
    } catch (reason) {
      setError(integrationError(reason, "Bachs"));
    } finally {
      setBusy("");
    }
  }

  async function connectBusinessBot() {
    setBusy("telegram");
    setError("");
    const tokenResult = telegramFormSchema.safeParse({ botToken });
    if (!tokenResult.success) {
      setFieldErrors({ botToken: tokenResult.error.issues[0]?.message ?? "Enter your Telegram bot token." });
      document.querySelector<HTMLInputElement>('[name="botToken"]')?.focus();
      setBusy("");
      return;
    }
    try {
      const result = await connectTelegram(tokenResult.data.botToken);
      setTelegram({ ...result.connection, connected: result.connection.status === "CONNECTED" });
      setBotToken("");
      setFieldErrors({});
      setStep("agent");
    } catch (reason) {
      setError(integrationError(reason, "Telegram"));
    } finally {
      setBusy("");
    }
  }

  async function saveAgent() {
    if (!organization) return;
    const agentResult = agentFormSchema.safeParse({
      agentName,
      description,
      agentPrompt,
    });
    if (!agentResult.success) {
      const issues = agentResult.error.issues;
      setFieldErrors(Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message])));
      focusFirstInvalidField(issues.map((issue) => String(issue.path[0])));
      return;
    }
    setBusy("agent");
    setError("");
    setFieldErrors({});
    try {
      const updated = await updateOrganization(organization.id, {
        description: agentResult.data.description,
        agentName: agentResult.data.agentName,
        agentPrompt: agentResult.data.agentPrompt || null,
      });
      setOrganization(updated);
      setStep("review");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy("");
    }
  }

  if (session.isPending || !session.data || (Boolean(activeOrganizationId) && !loaded)) {
    return (
      <main className="container-page max-w-4xl py-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-14 w-full" />
        <Skeleton className="mt-8 h-72 w-full" />
      </main>
    );
  }

  return (
    <main className="container-page max-w-4xl py-8 sm:py-12">
      <div className="mb-8">
        <p className="eyebrow">Workspace setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Build your conversion engine</h1>
        <p className="mt-2 text-sm text-muted">Your setup is saved as you connect your business and channels.</p>
      </div>
      <ol className="mb-7 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Onboarding progress">
        {steps.map((item, index) => {
          const done = index < stepIndex || (organization && index < 2);
          const active = item.key === step;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setStep(item.key)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-3 text-left text-xs font-semibold sm:px-3 ${active ? "border-primary bg-success-foreground text-success" : "border-border bg-surface text-muted"}`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? "bg-success text-primary-foreground" : "bg-surface-muted"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <span>{String(index + 1).padStart(2, "0")}</span>}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <Card className="p-5 sm:p-8">
        {error ? <div className="mb-5"><InlineNotice>{error}</InlineNotice></div> : null}

        {step === "business" ? (
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold">Tell us about your business</h2>
            <p className="mb-6 mt-1 text-sm text-muted">This information helps UPSCALE represent your business accurately.</p>
            <div className="grid gap-4">
              <TextInput label="Business name" name="businessName" required maxLength={100} value={businessName} onChange={(e) => updateBusinessName(e.target.value)} error={fieldErrors.name} />
              <TextInput label="Workspace address" name="slug" required maxLength={63} value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setFieldErrors((current) => ({ ...current, slug: "" })); }} error={fieldErrors.slug} />
              <TextInput label="Industry" name="industry" required maxLength={80} value={industry} onChange={(e) => { setIndustry(e.target.value); setFieldErrors((current) => ({ ...current, industry: "" })); }} placeholder="e.g. Real estate" error={fieldErrors.industry} />
              <TextArea label="Business description" name="description" required maxLength={2000} value={description} onChange={(e) => { setDescription(e.target.value); setFieldErrors((current) => ({ ...current, description: "" })); }} placeholder="What do you offer, and who do you serve?" error={fieldErrors.description} />
              <p className="-mt-3 text-right text-xs text-muted">{description.length} / 2,000 characters</p>
              <Button disabled={Boolean(busy)} onClick={continueBusiness}>Continue <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : null}

        {step === "plan" ? (
          <div>
            <h2 className="text-xl font-semibold">Choose your plan</h2>
            <p className="mb-6 mt-1 text-sm text-muted">Every plan starts with a 14-day free trial.</p>
            <div className="grid gap-3 md:grid-cols-3">
              {planOptions.map((option) => (
                <button key={option.id} type="button" onClick={() => setPlan(option.id)} aria-pressed={plan === option.id} className={`rounded-xl border p-4 text-left ${plan === option.id ? "border-primary bg-success-foreground ring-1 ring-primary" : "border-border hover:border-border-strong"}`}>
                  <span className="font-semibold">{option.id.charAt(0) + option.id.slice(1).toLowerCase()}</span>
                  <p className="mt-2 text-xl font-semibold">{option.price}</p>
                  <p className="mt-2 text-sm text-muted">{option.description}</p>
                  <p className="mt-4 text-xs font-medium text-success">14-day free trial</p>
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setStep("business")}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button disabled={Boolean(busy) || businessName.trim().length < 2 || slug.length < 2} onClick={saveBusiness}>
                {busy === "business" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Creating workspace...</> : <>Start 14-day trial <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "bachs" ? (
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold">Connect your Bachs account</h2>
            <p className="mb-6 mt-1 text-sm text-muted">Customer payments go to your business’s own Bachs account. UPSCALE does not collect them on your behalf.</p>
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <div className="flex items-center justify-between gap-4">
                <div><p className="font-semibold">Bachs</p><p className="mt-1 text-sm text-muted">{bachs?.status === "READY" || bachs?.status === "CONNECTED" ? "Ready to receive customer payments." : bachs?.status === "ONBOARDING" ? "Finish account setup to accept payments." : "Connect an account to request customer payments."}</p></div>
                {bachs?.status ? <StatusBadge tone={bachs.status === "READY" || bachs.status === "CONNECTED" ? "success" : "warning"}>{bachs.status}</StatusBadge> : <StatusBadge>Not connected</StatusBadge>}
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">Don’t have a Bachs account yet? Create one through Bachs’ official onboarding, then return here to connect. The current backend does not provide an account-creation link.</p>
            <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setStep("plan")}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                {bachs?.status !== "READY" && bachs?.status !== "CONNECTED" ? <Button onClick={startBachs} disabled={Boolean(busy)}>{busy === "bachs" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Connecting...</> : <>Connect Bachs <ArrowRight className="h-4 w-4" /></>}</Button> : null}
                <Button variant="secondary" onClick={() => setStep("telegram")}>Continue <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === "telegram" ? (
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold">Connect your Telegram bot</h2>
            <p className="mb-6 mt-1 text-sm text-muted">Use a bot created for your business. The token is sent securely to UPSCALE and is never shown again.</p>
            {telegram?.connected ? (
              <div className="rounded-xl border border-border bg-surface-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-semibold">Connected to @{telegram.botUsername}</p><p className="mt-1 text-sm text-muted">{telegram.botName || "Business Telegram bot"}</p></div>
                  <StatusBadge tone="success">Connected</StatusBadge>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <TextInput label="Telegram bot token" name="botToken" type="password" autoComplete="off" value={botToken} onChange={(e) => { setBotToken(e.target.value); setFieldErrors((current) => ({ ...current, botToken: "" })); }} placeholder="Paste the token from BotFather" required error={fieldErrors.botToken} />
                <p className="-mt-2 text-xs text-muted">The token is held only until submission. It is not saved in browser storage.</p>
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setStep("bachs")}><ArrowLeft className="h-4 w-4" /> Back</Button>
              {telegram?.connected ? <Button onClick={() => setStep("agent")}>Continue <ArrowRight className="h-4 w-4" /></Button> : <Button onClick={connectBusinessBot} disabled={Boolean(busy)}>{busy === "telegram" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Connecting Telegram...</> : <>Connect Telegram <ArrowRight className="h-4 w-4" /></>}</Button>}
            </div>
          </div>
        ) : null}

        {step === "agent" ? (
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold">Configure your AI agent</h2>
            <p className="mb-6 mt-1 text-sm text-muted">Set a name and give the agent context to represent your business. Keep instructions focused on helpful qualification.</p>
            <div className="grid gap-4">
              <TextInput label="Agent name" name="agentName" maxLength={80} required value={agentName} onChange={(e) => { setAgentName(e.target.value); setFieldErrors((current) => ({ ...current, agentName: "" })); }} error={fieldErrors.agentName} />
              <TextArea label="Business description" name="agentBusinessDescription" required value={description} onChange={(e) => { setDescription(e.target.value); setFieldErrors((current) => ({ ...current, description: "" })); }} error={fieldErrors.description} />
              <p className="-mt-3 text-right text-xs text-muted">{description.length} / 2,000 characters</p>
              <TextArea label="Additional instructions (optional)" name="agentPrompt" maxLength={4000} value={agentPrompt} onChange={(e) => { setAgentPrompt(e.target.value); setFieldErrors((current) => ({ ...current, agentPrompt: "" })); }} placeholder="Tone, services, qualification priorities, or when to ask for human help." error={fieldErrors.agentPrompt} />
              <div className="rounded-xl border border-border bg-surface-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Agent preview</p>
                <p className="mt-2 font-semibold">{agentName || "Your agent"}</p>
                <p className="mt-1 text-sm text-muted">{agentPrompt || "Friendly, concise and focused on understanding customer needs."}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setStep("telegram")}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={saveAgent} disabled={Boolean(busy)}>{busy === "agent" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Saving...</> : <>Save and review <ArrowRight className="h-4 w-4" /></>}</Button>
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <div>
            <h2 className="text-xl font-semibold">Review your workspace</h2>
            <p className="mb-6 mt-1 text-sm text-muted">Your organization and selected plan are saved. You can finish integrations any time from the dashboard.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewItem label="Business" value={organization?.name ?? businessName} />
              <ReviewItem label="Plan" value={`${organization?.plan ?? plan} · 14-day trial`} />
              <ReviewItem label="Bachs" value={bachs?.status ?? "Not connected"} />
              <ReviewItem label="Telegram" value={telegram?.connected ? `@${telegram.botUsername}` : "Not connected"} />
              <ReviewItem label="AI agent" value={organization?.agentName ?? agentName} />
            </div>
            <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setStep(telegram?.connected ? "agent" : "telegram")}><ArrowLeft className="h-4 w-4" /> Continue setup</Button>
              <ButtonLink href="/overview">Open dashboard <ArrowRight className="h-4 w-4" /></ButtonLink>
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
