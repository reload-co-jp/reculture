/** @type {import('next').NextConfig} */

import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js"

const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

// `next dev` additionally serves `*.dev.ts` routes (the review API). Static
// export forbids POST handlers, so builds never see them.
export default (phase) =>
  phase === PHASE_DEVELOPMENT_SERVER
    ? {
        ...nextConfig,
        output: undefined,
        pageExtensions: ["tsx", "ts", "jsx", "js", "dev.ts"],
      }
    : nextConfig
