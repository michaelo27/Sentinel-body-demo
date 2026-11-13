import type { NextConfig } from 'next';
import path from 'node:path';

// This app lives in apps/web inside a pnpm monorepo rooted at /home/user.
// Tell Turbopack where the workspace is so it can resolve next/package.json.
const workspaceRoot = path.resolve(process.cwd(), '../..');

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ['@sentinel/core'],
  // Live preview is served from https://{port}-{sandbox}.e2b.app
  allowedDevOrigins: ['*.e2b.app', '*.arena.ai', '127.0.0.1', 'localhost'],
  async rewrites() {
    const gateway = process.env.GATEWAY_INTERNAL_URL || 'http://127.0.0.1:8787';
    return [
      { source: '/api/:path*', destination: `${gateway}/api/:path*` },
      { source: '/auth/:path*', destination: `${gateway}/auth/:path*` },
      { source: '/admin/:path*', destination: `${gateway}/admin/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] }];
  },
};

export default nextConfig;
