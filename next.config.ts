import type { NextConfig } from "next";

const config: NextConfig = {
  // Nothing exposed: no source maps in anything public, no framework banner.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  env: {
    // Clerk's keyless mode makes a stand-in application when keys are missing. Never here: no keys, no sign-in.
    NEXT_PUBLIC_CLERK_KEYLESS_DISABLED: "true",
  },
  serverExternalPackages: ["pg"],
};

export default config;
