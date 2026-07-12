import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

function EmptyState({
  title = "Nada por aqui",
  description = "Quando houver conteúdo, ele aparecerá neste espaço.",
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "border-border bg-muted/30 flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground" aria-hidden>
        {icon ?? <InboxIcon className="size-8" />}
      </div>
      <div className="space-y-1">
        <p className="text-h3 text-foreground">{title}</p>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
