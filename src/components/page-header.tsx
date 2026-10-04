import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 flex h-14 items-center gap-2 border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/80">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Back"
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
      )}
      <h1 className="flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}
