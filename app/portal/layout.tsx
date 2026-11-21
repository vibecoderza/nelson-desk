import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { previewLook } from "@/surface/preview.ts";

// Never prerendered, never cached: everything under this tree belongs to a signed-in session.
export const dynamic = "force-dynamic";
export const metadata = { title: "Nelson" };

export default function PortalLayout({ children }: { children: ReactNode }) {
  // A preview on sample data has no Clerk session: Vercel's login is the door (src/surface/preview.ts).
  if (previewLook()) return children;
  return (
    <ClerkProvider publishableKey={process.env.CLERK_PORTAL_PUBLISHABLE_KEY} signInUrl="/sign-in" dynamic>
      {children}
    </ClerkProvider>
  );
}
