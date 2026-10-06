import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover border border-primary",
  secondary:
    "bg-surface text-foreground border border-border-strong hover:bg-surface-muted",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted border border-transparent",
  danger: "bg-danger text-danger-foreground hover:opacity-90 border border-danger",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${buttonVariants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...props
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${buttonVariants[variant]} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}

export function TextInput({
  label,
  error,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const inputId = id ?? props.name;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`min-h-11 w-full rounded-lg border ${error ? "border-danger" : "border-border-strong"} bg-surface px-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextArea({
  error,
  label,
  className = "",
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const inputId = id ?? props.name;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        className={`min-h-28 w-full resize-y rounded-lg border ${error ? "border-danger" : "border-border-strong"} bg-surface px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error ? <span id={`${inputId}-error`} className="text-xs text-danger" role="alert">{error}</span> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card ${className}`}>{children}</section>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const statusClasses: Record<StatusTone, string> = {
  success: "bg-success-foreground text-success",
  warning: "bg-warning-foreground text-warning",
  danger: "bg-danger-foreground text-danger",
  info: "bg-info-foreground text-info",
  neutral: "bg-surface-muted text-muted",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-surface-muted text-muted">
          {icon}
        </span>
      ) : null}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function InlineNotice({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "success" | "info";
  children: ReactNode;
}) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "info"
        ? Info
        : AlertCircle;
  const classes =
    tone === "success"
      ? "border-success/20 bg-success-foreground text-success"
      : tone === "info"
        ? "border-info/20 bg-info-foreground text-info"
        : "border-danger/20 bg-danger-foreground text-danger";
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${classes}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function LoadingButtonContent({ children }: { children: ReactNode }) {
  return (
    <>
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      {children}
    </>
  );
}

export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-muted ${className}`}
      aria-hidden="true"
    />
  );
}
