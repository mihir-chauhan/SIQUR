import type { Metadata } from "next";
import { Inter, Rajdhani, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const rajdhani = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Minority Report — AI Surveillance Platform",
  description: "Secure. Simulate. Save. An AI-powered surveillance optimization and synthetic data platform by Catapult at Purdue University.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${rajdhani.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent white flash before JS hydrates */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{background:#0a0a0a;color-scheme:dark;margin:0;padding:0;height:100%;-webkit-font-smoothing:antialiased}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <div className="scanlines app-shell">{children}</div>
      </body>
    </html>
  );
}
