import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicLeadForm } from "@/components/public/public-lead-form";
import { getPublicFormContext } from "@/server/leads/public-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get in touch",
  robots: { index: false },
};

export default async function PublicLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { slug } = await params;
  const { src } = await searchParams;
  const form = await getPublicFormContext(slug);
  if (!form) notFound();

  return (
    <main className="container-page max-w-xl py-10">
      <div className="surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {form.description ? form.description.slice(0, 200) : "Tell us what you need and we will get back to you."}
        </p>
        <PublicLeadForm slug={slug} source={src} />
      </div>
    </main>
  );
}
