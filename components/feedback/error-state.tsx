import type { ReactNode } from "react";
import { CircleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível concluir a operação. Tente novamente.",
  icon,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        "border-destructive/25 bg-destructive/5 flex w-full flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-10 text-center",
        className,
      )}
    >
      <div className="text-destructive" aria-hidden>
        {icon ?? <CircleAlertIcon className="size-8" />}
      </div>
      <div className="space-y-1">
        <p className="text-h3 text-foreground">{title}</p>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { ErrorState };
export type { ErrorStateProps };
