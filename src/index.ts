// ⬅️ Pasang polyfill BigInt->JSON PALING AWAL
import "./utils/bigint-json.js";

import "dotenv/config";
import { makeApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4000);
const app = makeApp();

app.listen(PORT, () => {
  console.log(`ASIK API listening on http://localhost:${PORT}`);
});

// (opsional) log error global
process.on("unhandledRejection", (e) => {
  console.error("Unhandled Rejection:", e);
});
process.on("uncaughtException", (e) => {
  console.error("Uncaught Exception:", e);
});
