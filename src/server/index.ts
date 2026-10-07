import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";
const server = createApp().listen(port, host, () =>
  console.log(`B1G Fuel API listening on http://${host}:${port}`),
);

function shutdown() {
  server.close(async () => {
    const { getPrisma } = await import("./prisma/client");
    if (process.env.DATABASE_URL) await getPrisma().$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
