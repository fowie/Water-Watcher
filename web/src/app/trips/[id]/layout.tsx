import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trip Details",
};

export default function TripDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
