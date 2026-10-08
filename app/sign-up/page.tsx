import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function SignUpPage() {
  return (
    <main className="container-page grid min-h-[calc(100vh-4rem)] max-w-lg content-center py-12">
      <Link className="mb-8 w-fit" href="/" aria-label="UPSCALE home">
        <BrandLogo />
      </Link>
      <div className="surface-card p-6 sm:p-8">
        <p className="eyebrow">14-day free trial</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted">Set up your workspace and start converting conversations.</p>
        <div className="mt-7">
          <AuthForm mode="sign-up" />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link className="font-semibold text-primary hover:underline" href="/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
