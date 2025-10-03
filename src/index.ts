import "dotenv/config";
import { makeApp } from "./app.js";

const PORT = Number(process.env.PORT || 4000);
const app = makeApp();

app.listen(PORT, () => {
  console.log(`ASIK API listening on http://localhost:${PORT}`);
});
