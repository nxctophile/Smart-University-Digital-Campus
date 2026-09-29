import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { getCurrentClientContextOrNull } from "@/lib/demo-session";

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});
const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campus OS · Central Institute of Technology",
  description: "AI-native, offline-first digital campus operating system.",
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentClientContextOrNull();

  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground">
        <AppProviders initialCtx={ctx}>{children}</AppProviders>
      </body>
    </html>
  );
}
