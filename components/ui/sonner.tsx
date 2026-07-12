"use client";

import type { CSSProperties } from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Light-theme Toaster for Cestou v1.
 * next-themes is intentionally unused so dark mode stays deferred.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      richColors={false}
      closeButton
      icons={{
        success: <CircleCheckIcon className="text-success size-4" aria-hidden />,
        info: <InfoIcon className="text-info size-4" aria-hidden />,
        warning: <TriangleAlertIcon className="text-warning-foreground size-4" aria-hidden />,
        error: <OctagonXIcon className="text-destructive size-4" aria-hidden />,
        loading: <Loader2Icon className="text-muted-foreground size-4 animate-spin" aria-hidden />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--card)",
          "--success-text": "var(--success)",
          "--success-border": "color-mix(in oklch, var(--success) 35%, var(--border))",
          "--error-bg": "var(--card)",
          "--error-text": "var(--destructive)",
          "--error-border": "color-mix(in oklch, var(--destructive) 35%, var(--border))",
          "--warning-bg": "var(--card)",
          "--warning-text": "var(--warning-foreground)",
          "--warning-border": "color-mix(in oklch, var(--warning) 45%, var(--border))",
          "--info-bg": "var(--card)",
          "--info-text": "var(--info)",
          "--info-border": "color-mix(in oklch, var(--info) 35%, var(--border))",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast border shadow-md !min-h-11 gap-3 px-4 py-3 text-body [&_[data-close-button]]:size-11 [&_[data-close-button]]:rounded-xl",
          title: "text-label text-foreground",
          description: "text-caption text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
