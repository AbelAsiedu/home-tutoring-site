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
    // Only rewrite in development mode for local backend
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3000/api/:path*'
        }
      ]
    }
    
    // In production, use the backend URL from environment variable
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL
    if (backendUrl) {
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`
        }
      ]
    }
    
    // If no backend URL configured, no rewrites (API calls will hit vercel functions)
    return []
  }
}

module.exports = nextConfig
