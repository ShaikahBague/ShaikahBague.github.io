import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // GitHub Pages only serves files, so its build (.github/workflows/deploy.yml) exports the site. Other builds keep the server that app/api needs
  ...(process.env.STATIC_EXPORT && { output: "export", images: { unoptimized: true }, cacheComponents: false, partialPrefetching: false }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
