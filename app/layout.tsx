import type { Metadata } from "next";
import "./globals.css";

const title = "Exam Recall Trainer · CIE Chemistry";
const description = "Practise Cambridge IGCSE Chemistry definitions and short-answer marking points.";

export const metadata: Metadata = {
  metadataBase: new URL("https://igcse-exam-recall-trainer.pages.dev"),
  title,
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title, description, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
