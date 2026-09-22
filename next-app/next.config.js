/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Server-only packages must not be bundled into the client graph.
  serverExternalPackages: ['pg'],

  /**
   * Pin the file-tracing root to this project.
   *
   * There are lockfiles above this directory (the old Express/SPA app, and one
   * in the home directory), so Next infers the workspace root as `~` and traces
   * far more of the filesystem than it should. Being explicit keeps the
   * standalone output correct and silences the warning.
   */
  outputFileTracingRoot: import.meta.dirname,

  experimental: {
    // Server Actions carry mutations; cap the payload (QR/image URLs only, no uploads).
    serverActions: { bodySizeLimit: '2mb' },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Google Identity Services opens a popup and talks back via postMessage.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
