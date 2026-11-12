import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { AppShell, Splash } from "@/components/AppShell";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MindCare · Mental Health EHR",
  description: "Mental health EHR and practice management: patients, appointments, clinical notes, follow-ups, tasks and care-team communication.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={<Splash />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
