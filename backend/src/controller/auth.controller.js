import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { pool } from "../db/database.js";
import jwt from "jsonwebtoken";

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const existingUser = await pool.query(
    `SELECT * from users 
         WHERE email=$1 or username=$2
        `,
    [email, username],
  );

  if (existingUser.rows.length > 0) {
    throw new ApiError(409, "User with same email or username exists");
  }
  const hashedPassword = await hashPassword(password);

  const user = await pool.query(
    `INSERT INTO users (username , email , password_hash)
         VALUES($1,$2,$3)
         RETURNING id, username, email, avatar_url, created_at`,
    [username, email, hashedPassword],
  );

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: user.rows[0],
      },
      "User registered successfully",
    ),
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    `
         SELECT * from users 
         WHERE email=$1
        `,
    [email],
  );

  if (user.rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  const existingUser = user.rows[0];

  const isPasswordValid = await comparePassword(
    password,
    existingUser.password_hash,
  );

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid Password");
  }

  const accessToken = generateAccessToken(existingUser);
  const refreshToken = generateRefreshToken(existingUser);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 15);

  await pool.query(
    `
    INSERT INTO user_sessions (user_id, refresh_token, expires_at)
    VALUES ($1, $2, $3)
    `,
    [existingUser.id, refreshToken, expiresAt],
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      httpOnly: true,
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
    })
    .json(
      new ApiResponse(
        200,
        {
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            avatar_url: existingUser.avatar_url,
          },
        },
        "User logged in successfully",
      ),
    );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  const session = await pool.query(
    `
         SELECT * 
         FROM user_sessions
         WHERE refresh_token=$1
        `,
    [refreshToken],
  );

  if (session.rows.length === 0) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const existingSession = session.rows[0];

  let decodedToken;

  try {
    decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (new Date() > new Date(existingSession.expires_at)) {
    throw new ApiError(401, "Refresh token expired");
  }

  let user = await pool.query(
    `
     SELECT id,username,email
     FROM users
     WHERE id=$1
    `,
    [decodedToken._id],
  );

  if (user.rows.length === 0) {
    throw new ApiError(401, "Invalid refresh Token");
  }

  user = user.rows[0];

  const newAccessToken = generateAccessToken(user);

  return res
    .status(200)
    .cookie("accessToken", newAccessToken, {
      httpOnly: true,
    })
    .json(
      new ApiResponse(
        200,
        {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
        },
        "Access token refreshed successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  await pool.query(
    `
      DELETE FROM user_sessions
      WHERE refresh_token = $1
    `,
    [refreshToken],
  );

  return res
    .status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

export { registerUser, loginUser, refreshAccessToken, logoutUser };
