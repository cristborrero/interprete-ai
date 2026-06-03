/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // kokoro-js → onnxruntime-node tiene binarios nativos .node que no
  // deben bundlearse. Se excluyen del bundle del servidor.
  serverExternalPackages: [
    '@huggingface/transformers',
    'kokoro-js',
    'onnxruntime-node',
  ],

  // Webpack: soporte estable para new Worker(new URL(..., import.meta.url))
  webpack(config) {
    // Ignorar los binarios nativos .node que onnxruntime-node incluye
    // para múltiples plataformas. Webpack no sabe parsearlos.
    config.module.rules.push({
      test: /\.node$/,
      use: 'null-loader',
    })

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
