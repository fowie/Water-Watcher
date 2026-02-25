import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Rivers",
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
