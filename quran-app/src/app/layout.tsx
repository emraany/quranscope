import type { Metadata } from "next";
import { Geist, Geist_Mono, Marcellus, Scheherazade_New } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const marcellus = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-brand" });
const scheherazade = Scheherazade_New({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuranScope",
  description: "Search → click → explain (streaming)",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${marcellus.variable} ${scheherazade.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
