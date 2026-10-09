import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { pool } from "../db/database.js";

const getUsers = asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, username, email, avatar_url, created_at FROM users"
  );
  return res.status(200).json(result.rows);
});

export { getUsers };
