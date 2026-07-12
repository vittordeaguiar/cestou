import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});

describe("buttonVariants", () => {
  it("applies primary styles by default with touch-friendly height", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("min-h-11");
  });

  it("supports destructive and outline variants", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "outline" })).toContain("border-border");
  });
});

describe("badgeVariants", () => {
  it("exposes semantic success and warning variants", () => {
    expect(badgeVariants({ variant: "success" })).toContain("bg-success/12");
    expect(badgeVariants({ variant: "warning" })).toContain("bg-warning/25");
  });
});
