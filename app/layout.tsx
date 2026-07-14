import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
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
  title: "Splitwise",
  description: "A professional, production-grade expense sharing application.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Splitwise",
  },
  icons: {
    apple: "/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0a14] text-white">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(20, 16, 32, 0.95)',
              color: '#fff',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              backdropFilter: 'blur(12px)',
              borderRadius: '14px',
              fontWeight: 600,
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#a78bfa', secondary: '#141020' } },
            error: { iconTheme: { primary: '#fb7185', secondary: '#141020' } },
          }}
        />
        {children}
      </body>
    </html>
  );
}
