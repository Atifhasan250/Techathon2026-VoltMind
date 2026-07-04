import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoltMind | Smart Office Control",
  description: "Monitor and control the VoltMind smart office.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
