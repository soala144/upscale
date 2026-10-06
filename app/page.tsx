import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  MessageCircle,
  Radio,
  ShieldCheck,
  UserRound,
  Workflow,
} from "lucide-react";

import { SiteNav } from "@/components/marketing/site-nav";

export const metadata: Metadata = {
  title: "Turn conversations into customers",
  description:
    "UPSCALE qualifies incoming leads, identifies buying intent and gives sales a clear path to convert serious prospects.",
};

const plans = [
  { name: "Basic", price: "₦3,500", description: "For teams starting with lead qualification." },
  { name: "Growth", price: "₦5,000", description: "For growing teams ready to convert more.", recommended: true },
  { name: "Scale", price: "₦10,000", description: "For businesses building a repeatable sales engine." },
];

const integrations = [
 
  { name: "Bachs", src: "/bachs.svg", width: 132, height: 28, imageClassName: "object-contain" },
  { name: "WatchUp", src: "/watchup_logo.webp", width: 40, height: 40, imageClassName: "object-contain" },
  { name: "pxxl", src: "/pxxl-1.png", width: 40, height: 48, imageClassName: "object-contain" },
   { name: "Telegram", src: "/telegram_logo.svg.webp", width: 48, height: 42, imageClassName: "rounded-full object-cover" },
];

function IntegrationBrand({
  name,
  src,
  width,
  height,
  imageClassName,
}: (typeof integrations)[number]) {
  return (
    <div className="flex min-h-16 items-center justify-center gap-2.5 bg-surface px-3">
      <Image
        alt={`${name} logo`}
        className={imageClassName}
        height={height}
        src={src}
        width={width}
      />
      
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="container-page grid gap-12 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-28">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5">AI-powered lead conversion engine</p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-[4.1rem]">
              Turn conversations
              <br className="hidden sm:block" /> into customers.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              UPSCALE qualifies incoming leads, identifies buying intent, and
              helps your sales team convert serious prospects before they go cold.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                href="/sign-up"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-5 text-sm font-semibold text-foreground hover:bg-surface-muted"
                href="#how-it-works"
              >
                See how it works <ArrowDown className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Start with a 14-day free trial. No payment details required to create your workspace.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[540px]" aria-label="UPSCALE product preview">
            <div className="surface-card soft-shadow overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="text-xs font-semibold text-muted">LEAD QUALIFICATION</p>
                  <p className="mt-1 text-sm font-semibold">New Telegram conversation</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-foreground px-2.5 py-1 text-xs font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> Active
                </span>
              </div>
              <div className="grid gap-4 p-5">
                <div className="flex max-w-[85%] gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-muted text-muted">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="rounded-xl rounded-tl-sm bg-surface-muted px-3.5 py-3 text-sm text-foreground">
                    I’m looking for a two-bedroom place in Lekki, ideally within the next few months.
                  </div>
                </div>
                <div className="ml-auto flex max-w-[88%] gap-3">
                  <div className="rounded-xl rounded-tr-sm bg-primary px-3.5 py-3 text-sm text-primary-foreground">
                    I can help with that. Do you have a budget range in mind?
                  </div>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted">QUALIFIED LEAD</p>
                      <p className="mt-1 font-semibold">New prospect</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tracking-tight">75</p>
                      <p className="text-xs text-muted">lead score</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                    <div><span className="text-muted">Need</span><p className="mt-1 font-medium">2-bedroom home</p></div>
                    <div><span className="text-muted">Location</span><p className="mt-1 font-medium">Lekki</p></div>
                    <div><span className="text-muted">Timeline</span><p className="mt-1 font-medium">Next few months</p></div>
                    <div><span className="text-muted">Next step</span><p className="mt-1 font-medium text-primary">Sales follow-up</p></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-border bg-surface px-5 py-3 text-xs text-muted">
                <ShieldCheck className="h-4 w-4 text-success" />
                Qualification is structured. Lead scoring is deterministic.
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface py-7" id="integrations">
          <div className="container-page flex flex-col items-center justify-between gap-5 md:flex-row">
            <p className="max-w-sm text-center text-sm text-muted md:text-left">
              Connects your sales workflow with the platforms you use.
            </p>
            <div className="w-full gap-2 md:max-w-[650px] flex flex-wrap items-center justify-center md:flex-nowrap ">
              {integrations.map((integration) => (
                <IntegrationBrand key={integration.name} {...integration} />
              ))}
            </div>
          </div>
        </section>

        <section className="container-page py-20 sm:py-28" id="product">
          <div className="max-w-2xl">
            <p className="eyebrow">The conversion gap</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Every minute a lead waits, the chance to convert drops.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Marketing starts the conversation. UPSCALE turns it into a
              qualified opportunity your sales team can act on.
            </p>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <div className="surface-card p-5">
              <MessageCircle className="h-5 w-5 text-primary" />
              <p className="mt-4 font-semibold">A customer reaches out</p>
              <p className="mt-1 text-sm text-muted">A real conversation starts on your business channel.</p>
            </div>
            <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
            <div className="surface-card border-primary/30 p-5">
              <Workflow className="h-5 w-5 text-primary" />
              <p className="mt-4 font-semibold">Intent becomes clear</p>
              <p className="mt-1 text-sm text-muted">AI gathers context; transparent rules calculate the score.</p>
            </div>
            <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
            <div className="surface-card p-5">
              <CircleDollarSign className="h-5 w-5 text-primary" />
              <p className="mt-4 font-semibold">Sales moves forward</p>
              <p className="mt-1 text-sm text-muted">Your team follows up and requests payment directly.</p>
            </div>
          </div>
        </section>

        <section className="bg-surface py-20 sm:py-28" id="how-it-works">
          <div className="container-page">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  A clear path from hello to paid.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted">
                Keep your existing sales workflow. UPSCALE makes the important
                signals visible and the next step easier to take.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: "01", icon: Radio, title: "Connect", text: "Connect your business channels and its own Telegram bot." },
                { n: "02", icon: MessageCircle, title: "Qualify", text: "AI speaks with incoming leads and collects sales context." },
                { n: "03", icon: ClipboardCheck, title: "Score", text: "Need, budget, timeline and decision signals produce a deterministic score." },
                { n: "04", icon: CircleDollarSign, title: "Convert", text: "Sales follows up and creates a customer checkout on its connected Bachs account." },
              ].map(({ n, icon: Icon, title, text }) => (
                <article className="surface-card p-5" key={n}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground">{n}</span>
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-8 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container-page py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="eyebrow">Product flow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Every handoff has a purpose.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              A connected channel leads to a measured qualification, a sales
              action and payment confirmation from the provider.
            </p>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Customer", UserRound],
              ["Telegram", MessageCircle],
              ["UPSCALE AI", Bot],
              ["Qualification", ClipboardCheck],
              ["Lead score", Check],
              ["Sales", UserRound],
              ["Bachs checkout", CircleDollarSign],
              ["Payment", ShieldCheck],
              ["Converted", Check],
            ].map(([label, Icon]) => {
              const FlowIcon = Icon as typeof UserRound;
              return (
                <div className="flex min-h-20 items-center gap-3 rounded-lg border border-border bg-surface px-4" key={label as string}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-primary">
                    <FlowIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 break-words text-sm font-semibold leading-tight">{label as string}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-y border-border bg-surface py-20 sm:py-28">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="eyebrow">Built for conversion</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                The signals sales needs, without another generic CRM.
              </h2>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["AI qualification", "Understand what a prospect needs and capture useful context from the conversation.", Bot],
                ["Deterministic scoring", "Need, budget, timeline and decision-maker signals add up to a clear 0–100 score.", ClipboardCheck],
                ["Human handoff", "When a customer asks for a person or needs human support, the lead is flagged for follow-up.", UserRound],
                ["Business-owned Telegram", "Connect the Telegram bot your customers already use to reach your business.", MessageCircle],
                ["Direct customer payments", "Use the business's connected Bachs account for customer checkout. Payment confirmation remains webhook-driven.", CircleDollarSign],
                ["Operational visibility", "WatchUp tracks useful product events and sanitized failures without sending conversation text.", ShieldCheck],
              ].map(([title, text, Icon]) => {
                const FeatureIcon = Icon as typeof Bot;
                return (
                  <article className="surface-card p-5" key={title as string}>
                    <FeatureIcon className="h-5 w-5 text-primary" />
                    <h3 className="mt-4 font-semibold">{title as string}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{text as string}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="container-page py-20 sm:py-28" id="pricing">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Straightforward pricing</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start with a 14-day free trial.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              Choose a plan to set up your workspace. UPSCALE tracks your plan
              period; Bachs is used for payment checkout when needed.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article
                className={`surface-card flex flex-col p-6 ${plan.recommended ? "border-primary ring-1 ring-primary" : ""}`}
                key={plan.name}
              >
                {plan.recommended ? (
                  <span className="mb-4 w-fit rounded-full bg-success-foreground px-2.5 py-1 text-xs font-semibold text-success">
                    Recommended
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted">{plan.description}</p>
                <p className="mt-6 text-3xl font-semibold tracking-tight">
                  {plan.price}
                  <span className="ml-1 text-sm font-normal text-muted">/ month</span>
                </p>
                <p className="mt-3 text-sm text-muted">14-day free trial</p>
                <Link
                  className={`mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold ${plan.recommended ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-border-strong hover:bg-surface-muted"}`}
                  href={`/sign-up?plan=${plan.name.toUpperCase()}`}
                >
                  Choose {plan.name} <ArrowUpRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="container-page pb-20 sm:pb-28">
          <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center sm:px-12 sm:py-16">
            <p className="eyebrow">Move while intent is high</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Stop losing leads while you’re still getting back to them.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted">
              Start converting with UPSCALE: conversations in, qualified
              opportunities out.
            </p>
            <a
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              href="/sign-up"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-surface py-8">
        <div className="container-page flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-[0.14em]">UPSCALE</Link>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <span>Support contact not configured</span>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} UPSCALE</p>
        </div>
      </footer>
    </>
  );
}
