// src/app/arabicFont.ts
import localFont from "next/font/local";

export const uthmani = localFont({
  src: [
    {
      path: "../../public/KFGQPC Uthmanic Script HAFS Regular.otf", // 👈 relative FS path (no leading slash)
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-uthmani",
});
