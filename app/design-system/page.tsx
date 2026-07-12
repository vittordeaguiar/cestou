/**
 * Internal visual showcase for the Cestou design system (V-41).
 * Not a product feature. Blocked in production by the auth proxy and notFound().
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
