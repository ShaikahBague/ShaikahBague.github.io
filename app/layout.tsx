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

export const metadata: Metadata = {
  title: "Cisco NetConnect PUP - Manila",
  description:
    "A student community at PUP - Manila for enterprise networking, cybersecurity operations and development networking.",
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
