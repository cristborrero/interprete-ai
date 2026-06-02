/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Transformers.js corre en el browser — no bundlear en el servidor
  serverExternalPackages: ['@huggingface/transformers'],

  // Next.js 16 usa Turbopack por defecto; maneja WASM y node fallbacks nativamente
  turbopack: {},

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
