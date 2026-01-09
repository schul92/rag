import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gkplxjckzsvouxfmgxtc.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Google Image Search result domains
      {
        protocol: 'https',
        hostname: '**.instagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: '**.pinimg.com',
      },
      {
        protocol: 'https',
        hostname: '**.twimg.com',
      },
      {
        protocol: 'https',
        hostname: '**.imgur.com',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Organization and project from Sentry
  org: process.env.SENTRY_ORG || "zoe-studio-llc",
  project: process.env.SENTRY_PROJECT || "javascript-nextjs",

  // Auth token for source map uploads
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Tunnel route to bypass ad-blockers (sends errors via your server)
  tunnelRoute: "/monitoring",

  // Suppress source map uploading logs during build
  silent: !process.env.CI,

  // Source maps configuration
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },
});
