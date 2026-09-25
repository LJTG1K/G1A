import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PinsProvider } from "@/components/pins/pins-provider";
import { TopBar } from "@/components/top-bar";
import { createClient } from "@/lib/supabase/server";
import { getPinState } from "@/server/pins";
import { InlineScript } from "@/components/ui/inline-script";
import { themeScript } from "@/components/ui/theme-toggle";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "G1A", template: "%s · G1A" },
  description: "Every buying spreadsheet, one storefront.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  const pins = await getPinState(supabase, userId);

  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="flex min-h-full flex-col">
        <PinsProvider signedIn={!!userId} initialBoards={pins.boards} initialPins={pins.pins}>
          <TopBar />
          {children}
        </PinsProvider>
      </body>
    </html>
  );
}
