import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card text-body text-foreground h-11 min-h-11 w-full min-w-0 rounded-xl border px-3.5 py-2 shadow-xs transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3",
        "disabled:bg-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
        "file:text-small file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
