import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KSP Crime Intelligence Assistant",
  description: "Voice-enabled crime data intelligence for Karnataka State Police",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
