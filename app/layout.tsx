import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://upscale.pxxl.pro",
  ),
  title: {
    default: "UPSCALE — Turn conversations into customers",
    template: "%s | UPSCALE",
  },
  description:
    "AI-powered lead qualification and conversion for businesses that sell through conversations.",
  applicationName: "UPSCALE",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "UPSCALE — Turn conversations into customers",
    description:
      "AI-powered lead qualification and conversion for businesses that sell through conversations.",
    siteName: "UPSCALE",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary",
    title: "UPSCALE — Turn conversations into customers",
    description:
      "AI-powered lead qualification and conversion for businesses that sell through conversations.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
