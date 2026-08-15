import type { Metadata } from "next";
import "./globals.css";
import { NavigationTrap } from "@/components/navigation-trap";

export const metadata: Metadata = {
  title: "ChrisPa Admin — Scents and Soaps LTD",
  description: "ChrisPa Scents and Soaps LTD — admin / backend console.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <NavigationTrap />
        {children}
      </body>
    </html>
  );
}
