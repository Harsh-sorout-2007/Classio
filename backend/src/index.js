import "dotenv/config";
import { pool } from "./db/database.js";
import { app } from "./app.js";

const PORT = process.env.PORT || 5000;

async function testDatabase() {
  const result = await pool.query("SELECT 1");
  console.log(result);
}

testDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server is running");
    });
  })
  .catch((err) => {
    console.log("Error in connection ", err);
    process.exit(1);
  });
