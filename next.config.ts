// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
