/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  env: {
    // Empty string = same origin (production). localhost:4000 = dev with separate backend.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : ''),
  },
};

module.exports = nextConfig;
