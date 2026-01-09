// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\next.config.ts

import type { NextConfig } from "next";

function hostnameFromUrl(url?: string) {
  try {
    if (!url) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Prefer env (works across prod/preview/local), fallback to your current Supabase project host
const supabaseHost =
  hostnameFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  "cbycgtnjhyodsbxraety.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Force correct headers for Apple App Site Association (Universal Links)
  async headers() {
    return [
      {
        // Primary location Apple checks
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        // Fallback location (also okay to serve)
        source: "/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
