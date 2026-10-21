import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Original Thaali mark: a plate (thaali) seen from above with three katoris. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <circle cx="16" cy="16" r="15" fill="var(--primary)" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
      <circle cx="11.5" cy="13" r="3" fill="#fff" />
      <circle cx="20.5" cy="13" r="3" fill="#fff" fillOpacity=".85" />
      <circle cx="16" cy="20.5" r="3" fill="#fff" fillOpacity=".7" />
    </svg>
  );
}

export function Logo({
  href = "/",
  suffix,
  className,
}: {
  href?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-lg", className)} aria-label={`${brand.name} home`}>
      <LogoMark />
      <span className="font-display text-xl font-extrabold tracking-tight">
        {brand.name}
        {suffix ? <span className="ml-1.5 text-sm font-semibold text-primary">{suffix}</span> : null}
      </span>
    </Link>
  );
}
