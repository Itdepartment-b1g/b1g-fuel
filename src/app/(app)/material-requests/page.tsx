import MaterialRequestsList from "@/components/material-requests/list";
export default async function MaterialRequestsPage({ searchParams }: { searchParams: Promise<{ search?: string | string[] }> }) {
  const { search } = await searchParams;
  const initialSearch = typeof search === "string" ? search.slice(0, 160) : "";
  return <MaterialRequestsList key={initialSearch} initialSearch={initialSearch} />;
}
