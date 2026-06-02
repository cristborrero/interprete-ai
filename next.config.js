/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Transformers.js corre en el browser — no bundlear en el servidor
  serverExternalPackages: ['@huggingface/transformers'],

  // Webpack: soporte estable para new Worker(new URL(..., import.meta.url))
  // Turbopack tiene soporte limitado para Workers con import.meta.url
  webpack(config) {
    return config
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      // COOP + COEP necesarios para SharedArrayBuffer (WASM threading)
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
