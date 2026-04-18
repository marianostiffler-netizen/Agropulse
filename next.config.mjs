/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @google/earthengine is a Node-only SDK; keep it external to the server bundle
  // so webpack doesn't try to bundle its optional dependencies.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), '@google/earthengine'];
    }
    return config;
  },
};

export default nextConfig;
