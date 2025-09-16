/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Ensure proper environment variable handling
  env: {
    NEXT_PUBLIC_SUI_NETWORK: process.env.NEXT_PUBLIC_SUI_NETWORK || 'devnet',
    NEXT_PUBLIC_DEFAULT_GAS_BUDGET: process.env.NEXT_PUBLIC_DEFAULT_GAS_BUDGET || '10000000',
    NEXT_PUBLIC_SUI_PACKAGE_ID: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '',
    NEXT_PUBLIC_OG_NFT_PACKAGE_ID: process.env.NEXT_PUBLIC_OG_NFT_PACKAGE_ID || '',
  },
}

export default nextConfig
