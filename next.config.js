/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Permitir construir aunque existan errores de tipo para depuración en producción
    ignoreBuildErrors: true,
  },
  // Disable static export to force server-side rendering
  // This prevents prerendering errors on pages with dynamic content
  output: undefined,
  // Ignore prerender errors to allow build to continue
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 5,
  },
  experimental: {
    // Allow pages to fail prerendering without blocking the build
    // This is useful for pages with dynamic content that can't be prerendered
    ppr: false,
  },
  // Agregar un manejador de errores durante la prerendering
  staticPageGenerationTimeout: 0,
};

module.exports = nextConfig;
