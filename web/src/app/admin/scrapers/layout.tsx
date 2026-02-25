import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scrape Monitor",
};

export default function AdminScrapersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
