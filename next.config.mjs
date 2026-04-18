/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      return config;
    }
    
    // 排除服務器端專用的包，防止客戶端編譯時的問題
    config.externals = {
      ...config.externals,
      'file-type': 'commonjs2 file-type',
      'heic-convert': 'commonjs2 heic-convert',
    };
    
    return config;
  },
}

export default nextConfig
