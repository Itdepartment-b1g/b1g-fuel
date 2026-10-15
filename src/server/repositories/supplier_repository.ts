import { ListSupplierResponse } from "../schema/supplier_schema";
import { getDatabase } from "../lib/database";

export default function list_suppliers(): Promise<ListSupplierResponse[]> {
    return prisma.supplier.findMany({
        where:
    })
}