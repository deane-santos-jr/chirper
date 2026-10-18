/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Screenshots sent to the agent travel through a Server Action.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
