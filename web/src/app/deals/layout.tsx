import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Raft Watch — Gear Deals",
};

export default function DealsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
