"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button, Card, InlineNotice, PageHeader, Skeleton, StatusBadge, TextArea, TextInput } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth/client";
import { ApiError } from "@/lib/api/client";
import { getOrganization, updateOrganization, type Organization } from "@/lib/api/organizations";
import { getSubscription, type Subscription } from "@/lib/api/billing";
import { settingsFormSchema } from "@/lib/validation/forms";

type SettingsValues = z.input<typeof settingsFormSchema>;

function describeError(reason: unknown) {
  return reason instanceof ApiError ? reason.message : "We couldn't complete this request.";
}

export function SettingsPage() {
  const session = authClient.useSession();
  const organizationId = session.data?.session.activeOrganizationId;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "", slug: "", industry: "", description: "", email: "", agentName: "", agentPrompt: "" },
  });

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    const [orgResult, subscriptionResult] = await Promise.allSettled([
      getOrganization(organizationId),
      getSubscription(),
    ]);
    if (orgResult.status === "fulfilled") {
      const org = orgResult.value;
      setOrganization(org);
      form.reset({
        name: org.name,
        slug: org.slug,
        industry: org.industry ?? "",
        description: org.description ?? "",
        email: org.notificationEmail ?? "",
        agentName: org.agentName,
        agentPrompt: org.agentPrompt ?? "",
      });
    } else setError(`Workspace: ${describeError(orgResult.reason)}`);
    if (subscriptionResult.status === "fulfilled") setSubscription(subscriptionResult.value.subscription);
    else setError((current) => current ? `${current} Subscription: ${describeError(subscriptionResult.reason)}` : `Subscription: ${describeError(subscriptionResult.reason)}`);
    setLoading(false);
  }, [form, organizationId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  useEffect(() => {
    if (!form.formState.isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form.formState.isDirty]);

  async function save(values: SettingsValues) {
    if (!organization) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateOrganization(organization.id, {
        name: values.name,
        slug: values.slug,
        industry: values.industry || null,
        description: values.description || null,
        notificationEmail: values.email || null,
        agentName: values.agentName,
        agentPrompt: values.agentPrompt || null,
      });
      setOrganization(updated);
      form.reset(values);
      setNotice("Workspace settings saved.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        form.setError("slug", { message: "That workspace address is already in use. Choose another." });
      }
      setError(describeError(reason));
    } finally {
      setSaving(false);
    }
  }

  if (loading || session.isPending) return <div className="grid gap-4"><Skeleton className="h-10 w-52" /><Skeleton className="h-96" /><Skeleton className="h-44" /></div>;
  const canEdit = organization?.role === "owner" || organization?.role === "admin";

  return (
    <>
      <PageHeader title="Settings" description="Manage your business profile, agent behavior, and plan status." />
      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice><button type="button" className="mt-3 text-sm font-semibold text-primary underline" onClick={() => void load()}>Try again</button></div> : null}
      {notice ? <div className="mb-4"><InlineNotice tone="success">{notice}</InlineNotice></div> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Business profile and AI agent</h2>
          <p className="mt-1 text-sm text-muted">These saved details are used across your organization.</p>
          <form className="mt-6 grid gap-4" onSubmit={form.handleSubmit(save)} noValidate>
            <TextInput label="Business name" required {...form.register("name")} error={form.formState.errors.name?.message} disabled={!canEdit} />
            <TextInput label="Workspace address" required {...form.register("slug")} error={form.formState.errors.slug?.message} disabled={!canEdit} />
            <TextInput label="Industry" maxLength={80} {...form.register("industry")} error={form.formState.errors.industry?.message} disabled={!canEdit} />
            <TextInput label="Notification email" type="email" maxLength={254} {...form.register("email")} error={form.formState.errors.email?.message} disabled={!canEdit} />
            <TextArea label="Business description" maxLength={2000} {...form.register("description")} error={form.formState.errors.description?.message} disabled={!canEdit} />
            <div className="border-t border-border pt-4"><p className="mb-4 text-sm font-semibold">Your AI agent</p>
              <div className="grid gap-4">
                <TextInput label="Agent name" required maxLength={80} {...form.register("agentName")} error={form.formState.errors.agentName?.message} disabled={!canEdit} />
                <TextArea label="Additional instructions" maxLength={4000} {...form.register("agentPrompt")} error={form.formState.errors.agentPrompt?.message} disabled={!canEdit} />
              </div>
            </div>
            {canEdit ? <Button type="submit" disabled={saving || !form.formState.isDirty}>{saving ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save changes</>}</Button> : <p className="text-sm text-muted">Only workspace owners and admins can edit these settings.</p>}
          </form>
        </Card>
        <aside className="grid content-start gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Subscription</h2>{subscription ? <StatusBadge tone={subscription.status === "ACTIVE" || subscription.status === "TRIALING" ? "success" : "warning"}>{subscription.status.replaceAll("_", " ")}</StatusBadge> : null}</div>
            {subscription ? <dl className="mt-5 grid gap-3 text-sm">
              <SettingRow label="Plan" value={subscription.plan} />
              <SettingRow label="Listed monthly price" value={`${new Intl.NumberFormat("en-NG", { style: "currency", currency: subscription.currency, maximumFractionDigits: 0 }).format(Number(subscription.amount))} / month`} />
              <SettingRow label="Trial ends" value={subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString() : "Not available"} />
              <SettingRow label="Next payment due" value={subscription.nextPaymentDue ? new Date(subscription.nextPaymentDue).toLocaleDateString() : "Not scheduled"} />
            </dl> : <p className="mt-4 text-sm text-muted">Subscription details unavailable.</p>}
            <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted">UPSCALE tracks your subscription lifecycle. Do not assume automatic recurring NGN billing; payment collection follows the configured checkout flow.</p>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Workspace access</h2>
            <p className="mt-2 text-sm text-muted">Your role is <span className="font-semibold text-foreground">{organization?.role ?? "member"}</span>. Organization data is scoped by the authenticated session.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}
