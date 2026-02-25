import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trip Planner",
};

export default function TripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
