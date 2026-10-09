"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  CalendarDays,
  CreditCard,
  Gem,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Send,
  Settings,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { InlineNotice, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { getSubscription, type Subscription } from "@/lib/api/billing";
import { getOrganization } from "@/lib/api/organizations";
import { authClient } from "@/lib/auth/client";
import { planProgress } from "@/lib/plan-progress";
import { subscriptionPlans } from "@/lib/plans";

type NavItem = { href: string; label: string; icon: LucideIcon };

const navigation: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Workspace",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: UsersRound },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/capture", label: "Lead capture", icon: Link2 },
      { href: "/broadcast", label: "Broadcast", icon: Send },
      { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/payments", label: "Payments", icon: Wallet },
      { href: "/billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/integrations", label: "Integrations", icon: Activity },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const allItems = navigation.flatMap((group) => group.items);

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/overview" && pathname.startsWith(`${href}/`));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const activeOrganizationId = session.data?.session.activeOrganizationId;

  useEffect(() => {
    if (session.isPending) return;
    if (!session.data) router.replace("/sign-in");
    else if (!activeOrganizationId) router.replace("/onboarding");
  }, [activeOrganizationId, router, session.data, session.isPending]);

  // Workspace name and plan are decoration: failures must never block the page.
  useEffect(() => {
    if (!activeOrganizationId) return;
    void getOrganization(activeOrganizationId).then((org) => setOrgName(org.name)).catch(() => undefined);
    void getSubscription().then((result) => setSubscription(result.subscription)).catch(() => undefined);
  }, [activeOrganizationId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function signOut() {
    setSigningOut(true);
    setError("");
    const result = await authClient.signOut();
    if (result.error) {
      setError("We couldn't sign you out. Please try again.");
      setSigningOut(false);
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  if (session.isPending || !session.data || !activeOrganizationId) {
    return (
      <div className="min-h-screen lg:pl-64">
        <Skeleton className="fixed inset-y-0 left-0 hidden w-64 rounded-none lg:block" />
        <div className="grid gap-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  const user = session.data.user;
  const currentLabel = allItems.find((item) => isActive(pathname, item.href))?.label ?? "";
  const progress = subscription ? planProgress(subscription) : null;
  const planName = subscription ? subscriptionPlans[subscription.plan].name : "";
  const lapsed = subscription?.status === "PAST_DUE" || subscription?.status === "EXPIRED" || subscription?.status === "CANCELLED";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/overview" aria-label="UPSCALE overview" onClick={() => setMenuOpen(false)}><BrandLogo /></Link>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-muted lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace navigation">
        {navigation.map((group) => (
          <div key={group.label} className="mt-5 first:mt-2">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            <ul className="grid gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-success-foreground text-success" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}
                    >
                      {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-primary" aria-hidden="true" /> : null}
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /> {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        {subscription ? (
          <Link href="/billing" onClick={() => setMenuOpen(false)} className="block rounded-xl border border-border bg-background p-3 hover:border-border-strong" aria-label="Plan and billing">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Gem className="h-4 w-4 text-primary" aria-hidden="true" /> {planName}</span>
              <StatusBadge tone={subscription.status === "ACTIVE" ? "success" : subscription.status === "TRIALING" ? "info" : "danger"}>{subscription.status === "TRIALING" ? "Trial" : subscription.status === "ACTIVE" ? "Active" : "Lapsed"}</StatusBadge>
            </div>
            {progress ? (
              <>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                  <div className={`h-full rounded-full ${progress.daysLeft <= 3 ? "bg-warning" : "bg-primary"}`} style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted">{progress.daysLeft} day{progress.daysLeft === 1 ? "" : "s"} left{progress.isTrial ? " in trial" : ""}</p>
              </>
            ) : lapsed ? <p className="mt-2 text-xs text-danger">Plan lapsed. Renew to keep replies on.</p> : null}
            <p className="mt-2 text-xs font-semibold text-primary">{subscription.status === "ACTIVE" ? "Manage plan" : "Upgrade plan"}</p>
          </Link>
        ) : null}
        <div className="mt-3 flex items-center gap-3 px-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-foreground text-xs font-semibold text-success" aria-hidden="true">{initials(user.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground" disabled={signingOut} onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">{sidebar}</aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{orgName || "Your workspace"}</p>
            {currentLabel ? <p className="truncate text-xs text-muted">{currentLabel}</p> : null}
          </div>
          {subscription ? (
            <Link href="/billing" className="hidden items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-border-strong sm:inline-flex">
              <Gem className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {planName}
              {progress?.isTrial ? <span className="font-normal text-muted">· {progress.daysLeft}d left</span> : null}
            </Link>
          ) : null}
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
