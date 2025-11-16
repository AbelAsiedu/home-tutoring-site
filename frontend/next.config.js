/**
 * Next.js dev proxy: forward /api/* to the local Express backend
 * This avoids CORS and makes frontend calls use relative `/api` URLs.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep trailingSlash disabled so dev server doesn't redirect
  // API rewrites must be exported on the same object.
  trailingSlash: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*'
      }
    ]
  }
}

module.exports = nextConfig
