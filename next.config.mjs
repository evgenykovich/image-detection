/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'pdf-parse', 'detect-libc'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        sharp: false,
        fs: false,
        path: false,
        'pdf-parse': false,
        child_process: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        'detect-libc': false,
        os: false,
        util: false,
      }
    }

    // Ignore test files during build
    config.module.rules.push({
      test: /test[\\/].*$/,
      loader: 'ignore-loader',
    })

    return config
  },
  transpilePackages: ['detect-libc'],
}

export default nextConfig
