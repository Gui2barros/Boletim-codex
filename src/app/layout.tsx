import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boletim Codex",
  description: "Sistema escolar para boletins, notas e frequência"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
