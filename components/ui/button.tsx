import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-label whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] active:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_10%)]",
        outline:
          "border-border bg-background text-foreground shadow-xs hover:bg-muted active:bg-muted/80",
        ghost: "text-foreground hover:bg-muted active:bg-muted/80",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/85 focus-visible:border-destructive/40 focus-visible:ring-destructive/25",
        link: "h-auto min-h-0 rounded-none px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 min-h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        sm: "h-11 min-h-11 gap-1.5 px-3.5 text-small",
        lg: "h-12 min-h-12 gap-2 px-5 text-body",
        icon: "size-11 min-h-11 min-w-11",
        "icon-sm": "size-11 min-h-11 min-w-11",
        "icon-lg": "size-12 min-h-12 min-w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild && !loading ? Slot.Root : "button";
  const isDisabled = Boolean(disabled || loading);

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
