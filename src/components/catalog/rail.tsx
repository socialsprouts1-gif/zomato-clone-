import { ChevronRight } from "lucide-react";
import Link from "next/link";

/** Horizontally scrolling section on mobile, grid on desktop. */
export function Rail({ title, subtitle, href, children, testId }: { title: string; subtitle?: string; href?: string; children: React.ReactNode; testId?: string }) {
  return (
    <section aria-label={title} data-testid={testId}>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="flex items-center text-sm font-semibold text-primary">
            See all <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&>*]:snap-start">{children}</div>
    </section>
  );
}
