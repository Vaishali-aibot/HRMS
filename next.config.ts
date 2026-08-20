import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for a scanned ID document/photo upload
      // (src/lib/actions/onboarding.ts's uploadOnboardingDocument). Leaves
      // headroom over MAX_FILE_SIZE_BYTES (src/lib/document-upload.ts) for
      // multipart/form-data overhead.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
