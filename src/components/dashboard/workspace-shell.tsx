"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  CalendarDays,
  Send,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { authClient } from "@/lib/auth/client";
import { InlineNotice, Skeleton } from "@/components/ui/primitives";
import { BrandLogo } from "@/components/brand-logo";

const navigation = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: UsersRound },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/broadcast", label: "Broadcast", icon: Send },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/integrations", label: "Integrations", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const activeOrganizationId = session.data?.session.activeOrganizationId;

  useEffect(() => {
    if (session.isPending) return;
    if (!session.data) router.replace("/sign-in");
    else if (!activeOrganizationId) router.replace("/onboarding");
  }, [activeOrganizationId, router, session.data, session.isPending]);

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
      <main className="container-page py-8">
        <Skeleton className="h-12 w-full" />
        <div className="mt-8 grid gap-5 md:grid-cols-[220px_1fr]">
          <Skeleton className="h-[70vh] w-full" />
          <Skeleton className="h-[70vh] w-full" />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="container-page flex min-h-16 items-center justify-between gap-4">
          <Link href="/overview" aria-label="UPSCALE overview">
            <BrandLogo />
          </Link>
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="truncate text-sm font-semibold">{session.data.user.name}</p>
            <p className="truncate text-xs text-muted">{session.data.user.email}</p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-border md:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="hidden min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground md:inline-flex"
            disabled={signingOut}
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" /> {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>
      <div className="container-page grid min-h-[calc(100vh-4rem)] gap-5 py-5 md:grid-cols-[210px_minmax(0,1fr)] md:gap-8 md:py-8">
        <aside id="workspace-navigation" className={`${menuOpen ? "block" : "hidden"} md:block`}>
          <nav className="sticky top-24 grid gap-1" aria-label="Workspace navigation">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/overview" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${active ? "bg-success-foreground text-success" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                </Link>
              );
            })}
            <button
              type="button"
              className="mt-3 inline-flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground md:hidden"
              disabled={signingOut}
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" /> {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </nav>
        </aside>
        <main className="min-w-0">
          {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
