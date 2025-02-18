import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Exai - Bring Memories Back to Life",
  description:
    "Exai is an open-source AI agent powered by deepseek that revives your chat memories.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${lexend.className} antialiased`}>{children}</body>
    </html>
  );
}
