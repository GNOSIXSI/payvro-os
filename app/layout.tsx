import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Display } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans",
});

const notoSansDisplay = Noto_Sans_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-display",
});

export const metadata: Metadata = {
  title: "PAYVRO OS",
  description: "Cobra y libera, sin comprobantes.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className={`${notoSans.variable} ${notoSansDisplay.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
