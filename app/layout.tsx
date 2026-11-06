import type { Metadata } from "next";
import { Anybody, Hanken_Grotesk, Martian_Mono } from "next/font/google";
import { MOTION_KEY } from "@/lib/story";
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
    "A student community at PUP - Manila for networking, cybersecurity, data analytics and IoT.",
};

// Runs before first paint so visitors without motion or WebGL never see the stacked layout.
// Visitors asking for reduced motion can still opt in, which the show's button stores.
const chooseLayout = `try{var o=false;try{o=localStorage.getItem("${MOTION_KEY}")==="on"}catch(e){}if((o||!matchMedia("(prefers-reduced-motion: reduce)").matches)&&document.createElement("canvas").getContext("webgl2"))document.documentElement.classList.add("live")}catch(e){}`;

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
