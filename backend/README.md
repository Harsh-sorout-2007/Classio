Last inspected: 2026-09-29

# Backend Overview

The backend of Classio serves as a RESTful API powering a college-focused Discord-like platform. It handles user authentication, session management, and room/community creation and management.

- **Current architecture**: Monolithic Node.js/Express REST API connecting to a PostgreSQL database.
- **Current technology stack**: Node.js, Express.js, PostgreSQL (via `pg` module), JSON Web Tokens (JWT), bcrypt for password hashing, and HTTP-only cookies for session management.
- **Backend entry point**: `src/index.js`
- **Server startup flow**: `src/index.js` connects to the PostgreSQL database via `pool.query("SELECT 1")`. Upon successful connection, it starts the Express application defined in `src/app.js` on the specified port.

# Backend Folder Structure

The actual implementation resides in the `src/` directory with the following structure:

- `src/`
  - `controller/`: Contains the business logic for handling incoming HTTP requests.
    - `auth.controller.js`: Handles registration, login, logout, and token refresh.
    - `room.controller.js`: Handles room creation, retrieval, updates, and deletion.
    - `user.controller.js`: Handles fetching user data.
  - `db/`: Database configuration.
    - `database.js`: Exports the `pg` Pool instance connected via `DATABASE_URL`.
  - `middleware/`: Express middlewares.
    - `auth.middleware.js`: Protects routes by verifying JWT access tokens.
    - `rateLimit.middleware.js`: (File exists, but not currently used in routes).
  - `routes/`: Express route definitions connecting endpoints to controllers.
    - `auth.routes.js`: Authentication routes (`/register`, `/login`, etc.).
    - `room.routes.js`: Room management routes.
    - `user.routes.js`: User-related routes.
  - `utils/`: Utility functions and helper classes.
    - `ApiError.js`: Standardized error class.
    - `ApiResponse.js`: Standardized success response wrapper.
    - `asyncHandler.js`: Wrapper to handle async route errors without repeating try-catch blocks.
    - `password.js`: Helper functions for bcrypt hashing and comparing.
    - `token.js`: Helper functions for generating JWTs.
  - `app.js`: Express application setup and global middleware configuration.
  - `index.js`: Server entry point and database connection logic.

_(Note: The `validators/` folder is currently empty/not implemented)_

# Request Flow

A standard request flows through the backend as follows:

1. **Client** sends an HTTP request to an endpoint.
2. **Express** routes it via `src/app.js` to the respective router (e.g., `src/routes/room.routes.js`).
3. **Middleware**: If protected, `src/middleware/auth.middleware.js` verifies the JWT access token from cookies or the Authorization header.
4. **Route** forwards the request to the mapped controller function wrapped in `asyncHandler`.
5. **Controller** (e.g., `src/controller/room.controller.js`) executes business logic.
6. **PostgreSQL**: The controller interacts with the database via raw SQL using `pool.query()` from `src/db/database.js`.
7. **Response**: The controller returns a JSON response wrapped in `ApiResponse` (or throws an `ApiError` handled by Express).

# Database

- **PostgreSQL Setup**: The backend connects to PostgreSQL using the `pg` Pool configured in `src/db/database.js`. The connection string is provided by the `DATABASE_URL` environment variable. Raw SQL is used for queries. Transactions (BEGIN, COMMIT, ROLLBACK) are utilized for complex operations like room creation.

**Actual Tables (Inferred from queries)**:

- `users`:
  - `id` (Primary Key)
  - `username`
  - `email`
  - `password_hash`
  - `avatar_url`
  - `created_at`
- `user_sessions`:
  - `user_id` (Foreign Key to users)
  - `refresh_token`
  - `expires_at`
- `rooms`:
  - `id` (Primary Key)
  - `name`
  - `description`
  - `owner_id` (Foreign Key to users)
  - `is_private`
  - `created_at`
- `room_members`:
  - `room_id` (Foreign Key to rooms)
  - `user_id` (Foreign Key to users)
  - `role` (e.g., "owner")

# Authentication

Authentication is implemented using a dual-token system (JWT Access Tokens and Refresh Tokens).

- **Registration** (`POST /api/v1/auth/register`): Hashes the password using `bcrypt` and stores the user in the `users` table.
- **Login** (`POST /api/v1/auth/login`): Verifies the password using `bcrypt.compare`. Generates an `accessToken` (15m expiry typically) and a `refreshToken` (15d expiry). Stores a session in `user_sessions` and sets both tokens as `httpOnly` cookies.
- **Protected Request**: `verifyJWT` middleware reads the `accessToken` from cookies (or Authorization header as fallback), verifies it using `jsonwebtoken`, and attaches the decoded payload to `req.user`.
- **Refresh** (`POST /api/v1/auth/refresh`): Reads `refreshToken` from cookies, verifies it against the `user_sessions` table and `jsonwebtoken`, and generates a new `accessToken` cookie.
- **Logout** (`POST /api/v1/auth/logout`): Deletes the session from `user_sessions` and clears the `accessToken` and `refreshToken` cookies.

# Error Handling

Errors are handled using two main utilities:

- `ApiError` (`src/utils/ApiError.js`): A custom Error class containing `statusCode`, `message`, and `errors` array.
- `asyncHandler` (`src/utils/asyncHandler.js`): A higher-order function that wraps async controllers and passes any caught errors to the `next()` function (Express's default error handler).

# API Documentation

## Auth Endpoints

### `POST /api/v1/auth/register`

- **Purpose**: Register a new user.
- **Authentication required**: No
- **Request body**: `username`, `email`, `password`
- **Success response**: 201 Created with user details.
- **Possible errors**: 409 Conflict (User exists).
- **Controller**: `registerUser` (`src/controller/auth.controller.js`)

### `POST /api/v1/auth/login`

- **Purpose**: Authenticate user and set session cookies.
- **Authentication required**: No
- **Request body**: `email`, `password`
- **Success response**: 200 OK with user details and `accessToken`/`refreshToken` cookies.
- **Possible errors**: 404 Not Found (User not found), 400 Bad Request (Invalid Password).
- **Controller**: `loginUser` (`src/controller/auth.controller.js`)

### `POST /api/v1/auth/refresh`

- **Purpose**: Refresh the access token using the refresh token cookie.
- **Authentication required**: Requires `refreshToken` cookie.
- **Success response**: 200 OK with new `accessToken` cookie.
- **Possible errors**: 401 Unauthorized (Invalid/Expired token).
- **Controller**: `refreshAccessToken` (`src/controller/auth.controller.js`)

### `POST /api/v1/auth/logout`

- **Purpose**: Invalidate refresh token and clear cookies.
- **Authentication required**: Requires `refreshToken` cookie.
- **Success response**: 200 OK with cleared cookies.
- **Possible errors**: 401 Unauthorized.
- **Controller**: `logoutUser` (`src/controller/auth.controller.js`)

## User Endpoints

### `GET /api/v1/users`

- **Purpose**: Fetch all users.
- **Authentication required**: No (currently missing `verifyJWT` middleware in route).
- **Success response**: 200 OK with array of users.
- **Controller**: `getUsers` (`src/controller/user.controller.js`)

## Room Endpoints

### `POST /api/v1/room`

- **Purpose**: Create a new room.
- **Authentication required**: Yes
- **Request body**: `name`, `description`, `is_private`
- **Success response**: 201 Created with room details.
- **Controller**: `createRoom` (`src/controller/room.controller.js`)

### `GET /api/v1/room`

- **Purpose**: Fetch all rooms the requesting user is a member of.
- **Authentication required**: Yes
- **Success response**: 200 OK with array of rooms.
- **Controller**: `getRooms` (`src/controller/room.controller.js`)

### `GET /api/v1/room/:roomId`

- **Purpose**: Fetch details of a specific room.
- **Authentication required**: Yes
- **Path parameters**: `roomId`
- **Success response**: 200 OK with room details.
- **Possible errors**: 403 Forbidden (Not a member), 404 Not Found.
- **Controller**: `getRoomById` (`src/controller/room.controller.js`)

### `PATCH /api/v1/room/:roomId`

- **Purpose**: Update room details.
- **Authentication required**: Yes (Must be owner)
- **Path parameters**: `roomId`
- **Request body**: `name`, `description`
- **Success response**: 200 OK with updated room details.
- **Possible errors**: 403 Forbidden (Not owner), 404 Not Found.
- **Controller**: `updateRoom` (`src/controller/room.controller.js`)

### `DELETE /api/v1/room/:roomId`

- **Purpose**: Delete a room.
- **Authentication required**: Yes (Must be owner)
- **Path parameters**: `roomId`
- **Success response**: 200 OK
- **Possible errors**: 403 Forbidden (Not owner), 404 Not Found.
- **Controller**: `deleteRoom` (`src/controller/room.controller.js`)

# Room Management

- **Room Creation**: A user creates a room and is designated as the `owner_id`.
- **Automatic Owner Membership**: Creating a room opens a SQL transaction that inserts the room into `rooms` and automatically inserts the creator into `room_members` with the role `"owner"`.
- **Room Listing**: Users can fetch rooms they are joined in via a `JOIN` between `rooms` and `room_members`.
- **Authorization Rules**:
  - Viewing a room requires being a member in `room_members`.
  - Updating or deleting a room strictly requires the `req.user._id` to match the `owner_id` on the `rooms` table.

# Security

- **Password hashing**: Handled securely via `bcrypt` (10 rounds).
- **Parameterized SQL**: All database queries use `pg` parameterization (`$1`, `$2`, etc.) to prevent SQL injection.
- **JWT & Cookies**: Secure access and refresh tokens stored as `httpOnly` cookies, mitigating XSS risks for token theft.
- **Authentication Middleware**: `verifyJWT` secures private endpoints.
- **Environment variables**: Sensitive data like DB URLs and token secrets are stored in `.env`.

## Security TODO

- Implement global error handling middleware in Express to catch unhandled errors from `asyncHandler`.
- Apply Rate Limiting (the `rateLimit.middleware.js` exists but is not used in `app.js`).
- Validate request inputs (e.g., using `express-validator` which is in `package.json` but not used).
- Enable CORS rules (currently missing from `app.js`).

# Backend Current Status

**Implemented**:

- Database connection via `pg`
- User Authentication (Register, Login, Logout, Refresh)
- JWT and cookie-based sessions
- Room CRUD operations
- Room ownership and basic membership checking

**In Progress**:

- General user data fetching (currently unprotected)

**Not Implemented**:

- Text Channels within rooms
- Messages and replies
- File/Image sharing
- Notifications
- Search

**Planned**:

- Real-time messaging (Socket.IO)
- WebRTC for Voice/Video communication
- Screen sharing
