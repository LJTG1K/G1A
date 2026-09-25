import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PinsProvider } from "@/components/pins/pins-provider";
import { ServiceWorker } from "@/components/service-worker";
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
  applicationName: "G1A",
  // Installed to an iPhone home screen: full screen, translucent status bar.
  appleWebApp: { capable: true, title: "G1A", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "G1A",
    description: "All your buying spreadsheets in one clean storefront.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  viewportFit: "cover",
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
        <ServiceWorker />
      </body>
    </html>
  );
}
