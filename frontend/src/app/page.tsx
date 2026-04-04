"use client";

import dynamic from "next/dynamic";

const GlobeView = dynamic(() => import("@/components/GlobeView"), {
  ssr: false,
});

export default function Home() {
  return (
    <main
      className="relative flex-1 w-full h-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <GlobeView />
    </main>
  );
}
