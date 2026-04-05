"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GlobeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/v2");
  }, [router]);

  return <div style={{ background: "#000", position: "fixed", inset: 0 }} />;
}
