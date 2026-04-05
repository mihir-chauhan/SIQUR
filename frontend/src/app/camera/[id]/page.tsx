"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Camera feeds are now shown as an overlay on /building.
// Redirect anyone who lands here directly.
export default function CameraPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/building");
  }, [router]);

  return null;
}
