"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-input bg-card relative flex size-5 shrink-0 items-center justify-center rounded-md border shadow-xs transition-colors outline-none",
        "after:absolute after:-inset-x-3 after:-inset-y-2.5",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
        "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
