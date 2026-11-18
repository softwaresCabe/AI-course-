import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The Vite single-file build uses the root tsconfig.json; Next.js uses its own.
  typescript: { tsconfigPath: 'tsconfig.next.json' },
};

export default nextConfig;
