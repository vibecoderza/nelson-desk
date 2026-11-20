import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

// Never prerendered, never cached: everything under this tree belongs to a signed-in session.
export const dynamic = "force-dynamic";
export const metadata = { title: "Nelson" };

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.CLERK_PORTAL_PUBLISHABLE_KEY} signInUrl="/sign-in" dynamic>
      {children}
    </ClerkProvider>
  );
}
