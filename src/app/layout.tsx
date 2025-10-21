import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { Providers } from "./providers"; // Importe os Providers
import Header from "@/components/Header"; // Importe o Header

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sentinel Pro",
  description: "Asset intelligence and security hub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-slate-950 text-white`}>
        <Providers>
          <Header />
          <main className="pt-20">
            {" "}
            {/* Adiciona um padding para o Header não sobrepor o conteúdo */}
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

