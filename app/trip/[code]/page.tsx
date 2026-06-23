import TripDashboard from "@/components/TripDashboard";

export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <TripDashboard tripCode={code.toUpperCase()} />;
}
