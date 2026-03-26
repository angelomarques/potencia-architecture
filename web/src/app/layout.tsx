import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Potencia Stack",
  description: "Potencia Stack",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans", figtree.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
