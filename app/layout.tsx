import type { Metadata, Viewport } from "next";
import { Unbounded, Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import { PrefsProvider } from "@/components/Prefs";
import "./globals.css";
import "./experience.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Ribriz Travel: holidays, group tours & beach escapes", template: "%s · Ribriz Travel" },
  description: "Flight + hotel packages, escorted group tours and beach hotels from India and Europe. One honest price with taxes shown, 0% EMI and a 48-hour price hold.",
  icons: { icon: "/img/logo.png" },
  openGraph: { siteName: "Ribriz Travel", type: "website", images: ["/img/hero.jpg"] },
};

export const viewport: Viewport = { themeColor: "#f6f7ff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* lets CSS start reveal animations only when JS is running */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
