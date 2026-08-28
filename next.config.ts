import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The export route reads the PDF font files with fs at runtime; static
  // tracing can't see those reads, so include them in its server bundle.
  outputFileTracingIncludes: {
    "/api/export": ["./src/lib/pdf/fonts/*.ttf"],
  },
};

export default nextConfig;
