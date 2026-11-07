import type { Metadata } from "next";
import { Anybody, Hanken_Grotesk, Martian_Mono } from "next/font/google";
import "./globals.css";

const display = Anybody({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
});

const body = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

const ticket = Martian_Mono({
  variable: "--font-ticket",
  subsets: ["latin"],
});

const TITLE = "Cisco NetConnect PUP - Manila";
const DESCRIPTION = "A student community at PUP - Manila for enterprise networking, cybersecurity operations and development networking.";

// The preview image itself is app/opengraph-image.jpg and twitter-image.jpg, the site's opening scene. Link previews need its full address, so a host without
// its own default has to be told the site's domain through NEXT_PUBLIC_SITE_URL
export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: TITLE, type: "website", locale: "en_PH" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Runs before first paint so only browsers that can't run the show get the stacked layout.
const chooseLayout = `try{if(document.createElement("canvas").getContext("webgl2"))document.documentElement.classList.add("live")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${ticket.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: chooseLayout }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
