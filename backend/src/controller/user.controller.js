import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { pool } from "../db/database.js";

const getUsers = asyncHandler(async (req, res) => {
  const result = await pool.query("Select * from users");
  return res.status(200).json(result.rows);
});

export { getUsers };
