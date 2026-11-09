import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dossier est imbriqué dans un autre projet npm : on fixe la racine.
  turbopack: { root: __dirname },
  devIndicators: false,
};

export default nextConfig;
