import type { ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

type LoadingStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

function LoadingState({ title = "Carregando…", description, icon, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="loading-state"
      className={cn(
        "border-border bg-card/60 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <div className="text-primary" aria-hidden>
        {icon ?? <Loader2Icon className="size-8 animate-spin" />}
      </div>
      <div className="space-y-1">
        <p className="text-h3 text-foreground">{title}</p>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

export { LoadingState };
export type { LoadingStateProps };
