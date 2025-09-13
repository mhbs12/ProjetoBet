import type React from "react"
// import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

// const inter = Inter({
//   variable: "--font-sans",
//   subsets: ["latin"],
// })

// const jetbrainsMono = JetBrains_Mono({
//   variable: "--font-mono",
//   subsets: ["latin"],
// })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="antialiased">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
