import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: false,
  reloadOnOnline: false,
  fallbacks: {
    document: "/dashboard",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith("/dashboard"),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "dashboard-pages",
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
        method: "GET",
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 middleware on Vercel expects .env at runtime — include it in the trace.
  outputFileTracingIncludes: {
    "/*": [".env", ".env.production"],
  },
};

export default withPWA(nextConfig);
