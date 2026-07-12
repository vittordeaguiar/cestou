/**
 * Internal visual showcase for the Cestou design system (V-41).
 * Not a product feature. Hidden in production via notFound().
 * Can be removed or gated by auth later (e.g. V-44 middleware).
 */
import { notFound } from "next/navigation";

import { DesignSystemShowcase } from "@/components/design-system/showcase";

export const metadata = {
  title: "Design System — Cestou",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignSystemShowcase />;
}
