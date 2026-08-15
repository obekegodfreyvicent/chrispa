import type { Metadata } from "next";
import "./globals.css";
import { NavigationTrap } from "@/components/navigation-trap";

export const metadata: Metadata = {
  title: "ChrisPa Scents and Soaps LTD",
  description: "Natural wellness candles, sea salts, ghee, honey, and soap bars, made in Kampala, Uganda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavigationTrap />
        {children}
      </body>
    </html>
  );
}
