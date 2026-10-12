import type { TestContext } from "node:test";
import type { Database } from "../src/server/lib/database";

export type DatabaseCall = { model: string; method: string; args: Record<string, unknown> };

export function mockDatabase(t: TestContext, respond: (call: DatabaseCall) => unknown) {
  const calls: DatabaseCall[] = [];
  const database = new Proxy({}, {
    get(_target, model: string) {
      if (model === "$disconnect") return async () => {};
      if (model === "$transaction") return async (callback: (tx: Database) => unknown, options?: Record<string, unknown>) => {
        calls.push({ model, method: "begin", args: options ?? {} });
        try {
          const result = await callback(database as Database);
          calls.push({ model, method: "commit", args: {} });
          return result;
        } catch (error) {
          calls.push({ model, method: "rollback", args: {} });
          throw error;
        }
      };
      if (model === "$queryRaw") return async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const call = { model, method: "query", args: { sql: strings.join("?"), values } };
        calls.push(call);
        return respond(call);
      };
      return new Proxy({}, { get(_delegate, method: string) {
        return async (args: Record<string, unknown> = {}) => {
          const call = { model, method, args };
          calls.push(call);
          return respond(call);
        };
      } });
    },
  }) as Database;
  const holder = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = holder.fuelDatabase;
  holder.fuelDatabase = { database };
  t.after(() => { if (previous === undefined) delete holder.fuelDatabase; else holder.fuelDatabase = previous; });
  return calls;
}
