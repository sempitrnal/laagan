import TripDashboard from '@/components/TripDashboard';

export default async function TripPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <TripDashboard tripCode={code.toUpperCase()} />;
}
