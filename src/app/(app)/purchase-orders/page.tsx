import ListPurchaseOrders from "@/components/purchase-orders/list";

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ search?: string | string[] }> }) {
  const { search } = await searchParams;
  const initialSearch = typeof search === "string" ? search.slice(0, 160) : "";
  return <ListPurchaseOrders key={initialSearch} initialSearch={initialSearch} />;
}
