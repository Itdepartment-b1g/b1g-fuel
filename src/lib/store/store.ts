import { configureStore } from "@reduxjs/toolkit";
import { usersReducer } from "./users-slice";
import { authReducer } from "./auth-slice";
import { rolesReducer } from "./roles-slice";
import { companiesReducer } from "./companies-slice";
import { measurementsReducer } from "./measurements-slice";
import { brandsReducer } from "./brands-slice";
import { variantsReducer } from "./variants-slice";
import { suppliersReducer } from "./suppliers-slice";
import { productTypesReducer } from "./product-types-slice";
import { purchaseOrdersReducer } from "./purchase-orders-slice";
import { receivingReducer } from "./receiving-slice";
import { hubsReducer } from "./hubs-slice";
import { companySupplyReducer } from "./company-supply-slice";
import { materialRequestsReducer } from "./material-requests-slice";

export const makeStore = () =>
  configureStore({
    reducer: {
      users: usersReducer,
      auth: authReducer,
      roles: rolesReducer,
      companies: companiesReducer,
      measurements: measurementsReducer,
      brands: brandsReducer,
      variants: variantsReducer,
      suppliers: suppliersReducer,
      productTypes: productTypesReducer,
      purchaseOrders: purchaseOrdersReducer,
      receiving: receivingReducer,
      hubs: hubsReducer,
      companySupply: companySupplyReducer,
      materialRequests: materialRequestsReducer,
    },
  });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
