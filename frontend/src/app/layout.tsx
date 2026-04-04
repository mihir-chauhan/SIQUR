import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Minority Report",
  description: "Secure. Simulate. Save.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable} h-full antialiased`}
      style={{ backgroundColor: "#0a0a0a", colorScheme: "dark" }}
    >
      <head>
        {/* Prevent white flash by forcing background before any paint */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{background:#0a0a0a;color-scheme:dark}`,
          }}
        />
      </head>
      <body className="scanlines min-h-full flex flex-col">{children}</body>
    </html>
  );
}
