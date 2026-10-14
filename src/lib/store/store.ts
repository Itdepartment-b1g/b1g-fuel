import { configureStore } from "@reduxjs/toolkit";
import { usersReducer } from "./users-slice";
import { authReducer } from "./auth-slice";
import { rolesReducer } from "./roles-slice";
import { companiesReducer } from "./companies-slice";
import { measurementsReducer } from "./measurements-slice";

export const makeStore = () => configureStore({ reducer: { users: usersReducer, auth: authReducer, roles: rolesReducer, companies: companiesReducer, measurements: measurementsReducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
