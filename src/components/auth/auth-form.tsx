"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/primitives";
import { InlineNotice, TextInput } from "@/components/ui/primitives";
import { createAuthFormSchema, type AuthFormValues } from "@/lib/validation/forms";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === "sign-up";
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(createAuthFormSchema(isSignUp)),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function submit(values: AuthFormValues) {
    setSubmitting(true);
    setError("");

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: values.name?.trim() ?? "", email: values.email.trim(), password: values.password })
        : await authClient.signIn.email({ email: values.email.trim(), password: values.password });
      if (result.error) {
        if (!isSignUp && result.error.status === 401) {
          setError("Email or password is incorrect. Check your details and try again.");
        } else if (isSignUp && result.error.status === 422) {
          setError(
            "We couldn't create the account. This email may already be registered; try signing in, or use another email address.",
          );
        } else if (result.error.status >= 500) {
          setError(
            "The service is temporarily unavailable. Please try again shortly.",
          );
        } else {
          setError("We couldn't complete your request. Check your details and try again.");
        }
        return;
      }
      const selectedPlan = new URLSearchParams(window.location.search).get("plan")?.toUpperCase();
      const onboardingPlan =
        selectedPlan === "BASIC" || selectedPlan === "GROWTH" || selectedPlan === "SCALE"
          ? `?plan=${selectedPlan}`
          : "";
      router.replace(isSignUp ? `/onboarding${onboardingPlan}` : "/overview");
      router.refresh();
    } catch {
      setError("We couldn't reach the service. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={form.handleSubmit(submit)} noValidate>
      {error ? <InlineNotice>{error}</InlineNotice> : null}
      {isSignUp ? (
        <TextInput
          label="Full name"
          {...form.register("name")}
          autoComplete="name"
          error={form.formState.errors.name?.message}
        />
      ) : null}
      <TextInput
        label="Work email"
        {...form.register("email")}
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
      />
      <TextInput
        label="Password"
        {...form.register("password")}
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        error={form.formState.errors.password?.message}
      />
      {isSignUp ? (
        <TextInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          {...form.register("confirmPassword")}
          error={form.formState.errors.confirmPassword?.message}
        />
      ) : null}
      <Button className="mt-1 w-full" type="submit" disabled={submitting}>
        {submitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            {isSignUp ? "Creating account..." : "Signing in..."}
          </>
        ) : (
          <>
            {isSignUp ? "Create account" : "Sign in"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>
    </form>
  );
}
