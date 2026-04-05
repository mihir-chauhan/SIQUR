"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// This route is no longer used — cameras are now shown as an overlay on /v2/building.
// Redirect anyone who lands here directly.
export default function V2CameraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace("/v2/building");
  }, [router, id]);

  return null;
}
