"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const links = [
    ["Product", "#product"],
    ["How it works", "#how-it-works"],
    ["Pricing", "#pricing"],
    ["Integrations", "#integrations"],
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <nav
        className="container-page flex min-h-[4.25rem] items-center justify-between"
        aria-label="Main navigation"
      >
        <Link href="/" aria-label="UPSCALE home">
          <BrandLogo />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <Link
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/sign-in"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Get started
          </Link>
        </div>
        <button
          className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-foreground md:hidden"
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {open ? (
        <div className="border-t border-border bg-surface pb-4 pt-2 md:hidden">
          <div className="container-page grid gap-1">
            {links.map(([label, href]) => (
              <Link
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface-muted"
                href={href}
                key={href}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <Link
                className="rounded-lg border border-border px-3 py-2.5 text-center text-sm font-semibold"
                href="/sign-in"
              >
                Sign in
              </Link>
              <Link
                className="rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                href="/sign-up"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
