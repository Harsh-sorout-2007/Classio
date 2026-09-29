Last inspected: 2026-09-29

# Classio
Classio is a Discord-like platform for college students designed to provide spaces for communication, communities, and collaboration. It allows students to create and join rooms to communicate.

# Product Vision
The long-term vision is to build a college-focused Discord-like platform where students can create and join rooms (communities) and communicate through text, and eventually voice and video. It aims to serve as a hub for real-time collaboration among students.

# Core Features

| Feature | Status | Description |
|---|---|---|
| **Authentication** | Implemented | JWT-based user registration, login, logout, and token refresh. |
| **User profiles** | Partially implemented | Basic user creation in DB, but no profile management API yet. |
| **Rooms** | Implemented | Create, list, view, update, and delete rooms. |
| **Room membership** | Partially implemented | Room owners are automatically added to `room_members` table on creation, but APIs to invite/add/remove others are not yet implemented. |
| **Roles/permissions** | Partially implemented | Basic ownership checks for updating and deleting rooms exist. |
| **Channels** | Not implemented | Text channels inside rooms are not yet built. |
| **Messages** | Not implemented | Text messaging inside rooms is missing. |
| **Replies** | Not implemented | - |
| **File sharing** | Not implemented | Dependencies (multer, cloudinary) are installed but unused. |
| **Real-time communication**| Planned | Socket.IO not yet integrated. |
| **Notifications** | Planned | - |
| **Search** | Planned | - |
| **Voice** | Planned | - |
| **Video** | Planned | - |
| **Screen sharing** | Planned | - |
| **WebRTC** | Planned | - |
| **Moderation** | Planned | - |

# System Architecture

**Current Implemented Architecture**:
```
Express Backend (Node.js)
      ↓
Middleware (verifyJWT)
      ↓
Controllers (Auth, Room, User)
      ↓
PostgreSQL (via pg pool)
```

**Planned Architecture**:
```
React Frontend (Vite)
      ↓
Axios / HTTP
      ↓
Express Backend
      ↓
Middleware
      ↓
Controllers
      ↓
PostgreSQL 

[Later Planned additions:]
React Frontend
 ↓
Socket.IO
 ↓
Real-time Backend (Express)

React Frontend
 ↓
WebRTC
 ↓
Peer-to-peer media
```

# Complete Data Flow

**Registration**:
Client `POST /api/v1/auth/register` → `auth.controller.js` (hash password via bcrypt) → `pool.query` (INSERT INTO users) → Response (201 Created).

**Login**:
Client `POST /api/v1/auth/login` → `auth.controller.js` (verify password) → `pool.query` (INSERT INTO user_sessions) → Generates JWTs → Set `httpOnly` Cookies → Response (200 OK).

**Authenticated Request (Create Room)**:
Client `POST /api/v1/room` with cookies → `verifyJWT` middleware reads and verifies cookie JWT → Attaches `req.user` → `room.controller.js` (starts SQL transaction) → `pool.query` (INSERT INTO rooms) → `pool.query` (INSERT INTO room_members) → Commits transaction → Response (201 Created).

**Get Rooms**:
Client `GET /api/v1/room` with cookies → `verifyJWT` middleware → `room.controller.js` → `pool.query` (SELECT rooms JOIN room_members ON user_id = req.user._id) → Response (200 OK).

**Update/Delete Room**:
Client request with cookies → `verifyJWT` middleware → `room.controller.js` → verifies room exists and `req.user._id` matches `owner_id` → Executes UPDATE/DELETE query → Response.

# Database Architecture
The database is a PostgreSQL instance accessed via the `pg` driver using raw parameterized SQL queries.

- **`users`**: Stores user credentials and profile data.
- **`user_sessions`**: Manages long-lived refresh tokens for authenticated sessions.
- **`rooms`**: Stores the metadata of a community/room and links to the `owner_id` (users).
- **`room_members`**: A junction table linking `users` to `rooms`, representing community membership and specific roles (like "owner").

# Authentication Architecture
Authentication utilizes a secure double-token strategy. 
- **Access Tokens**: Short-lived JWTs stored in `httpOnly` cookies, verified on protected routes by the `verifyJWT` middleware.
- **Refresh Tokens**: Long-lived JWTs stored in `httpOnly` cookies and backed by the `user_sessions` table in the database, used to securely obtain new access tokens without re-authenticating.

# Backend Architecture
The backend is a monolithic Node.js REST API using Express. It is responsible for:
- Routing HTTP requests.
- Enforcing authentication via JWT.
- Managing database connections (pg pool).
- Executing business logic and raw SQL transactions.
- Formatting API responses.

# Frontend Architecture
*(Not yet implemented)*
The frontend will be a single-page React application built with Vite, responsible for UI, routing, and communicating with the backend via Axios.

# API Overview

| Method | Path | Purpose | Auth Required |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Register a new user | No |
| POST | `/api/v1/auth/login` | Authenticate user & get cookies | No |
| POST | `/api/v1/auth/refresh` | Refresh access token | Yes (Cookie) |
| POST | `/api/v1/auth/logout` | Logout and clear session | Yes (Cookie) |
| GET | `/api/v1/users/` | Get all users | No (Currently) |
| POST | `/api/v1/room/` | Create a room | Yes |
| GET | `/api/v1/room/` | Get user's rooms | Yes |
| GET | `/api/v1/room/:roomId`| Get a specific room | Yes |
| PATCH | `/api/v1/room/:roomId`| Update room details | Yes (Owner) |
| DELETE| `/api/v1/room/:roomId`| Delete a room | Yes (Owner) |

# Current Project State
- **Completed**: Database connectivity, core user authentication, basic room CRUD.
- **Next**: Frontend initialization, room membership APIs (invites/adding users).
- **Future**: Text messaging, real-time Socket.IO, voice/video WebRTC.

# Roadmap
- **Phase 1 — Foundation**: Express setup, PostgreSQL connection. (Implemented)
- **Phase 2 — Authentication**: JWT, cookies, bcrypt, sessions. (Implemented)
- **Phase 3 — Room Management**: Room CRUD, ownership. (Implemented)
- **Phase 4 — Frontend Foundation**: React/Vite initialization, basic UI. (Next)
- **Phase 5 — Membership**: Inviting and adding users to rooms. (Planned)
- **Phase 6 — Channels**: Text channels inside rooms. (Planned)
- **Phase 7 — Messaging**: Sending and retrieving messages. (Planned)
- **Phase 8 — Real-time Communication**: Socket.IO integration for live messaging. (Planned)
- **Phase 9 — File Sharing**: Multer and Cloudinary integration. (Planned)
- **Phase 10 — Notifications/Search**: Alerts and message searching. (Planned)
- **Phase 11 — Voice/Video/WebRTC**: Peer-to-peer communication. (Planned)

# Important Engineering Decisions
- **PostgreSQL instead of MongoDB**: Chosen for strict schema, relations (users, rooms, members), and data integrity.
- **raw SQL instead of Prisma**: Currently using raw SQL queries with the `pg` pool rather than an ORM.
- **JWT authentication with HTTP-only cookies**: Chosen to mitigate XSS attacks.
- **access + refresh tokens**: For better security, allowing short-lived access tokens while maintaining user sessions seamlessly.
- **room_members junction table**: Accommodates many-to-many relationships between users and rooms.
- **transactions**: Used during room creation (`BEGIN`, `COMMIT`, `ROLLBACK`) to ensure `rooms` and `room_members` records are inserted atomically.
- **ApiError / ApiResponse / asyncHandler**: Standardized structures to ensure all API responses are consistent and async errors do not crash the Express server.

# Known TODOs / Technical Debt
- **Missing Global Error Handler**: `asyncHandler` passes errors to `next()`, but there is no custom Express error-handling middleware set up in `app.js` to format these into JSON responses.
- **CORS Configuration**: Not yet configured in `app.js`.
- **Validation**: Request body validation (like checking email formats, password strength) is missing. `express-validator` is installed but not used.
- **Rate Limiting**: `rateLimit.middleware.js` is defined but not attached to any routes or `app.js`.
- **Route Protection**: `GET /api/v1/users/` lacks the `verifyJWT` middleware.

# Developer Guide
1. **Where the backend starts**: `backend/src/index.js` initializes DB connection and starts the server. `backend/src/app.js` configures Express.
2. **Where routes live**: `backend/src/routes/` maps endpoints to controllers.
3. **Where controllers live**: `backend/src/controller/` holds the business logic.
4. **Where database connection lives**: `backend/src/db/database.js`.
5. **Where authentication lives**: Logic in `auth.controller.js` and protection in `middleware/auth.middleware.js`.
6. **Where frontend starts**: Currently uninitialized.
7. **How frontend communicates with backend**: Will use Axios to hit `/api/v1/...` endpoints.
8. **How to add a new API endpoint**: Create a controller function in `src/controller/`, add a route in `src/routes/`, and mount it in `app.js`.
9. **How to add a new database feature**: Write a raw SQL query inside the respective controller, ensuring parameters are safely passed as `$1, $2`, etc.
10. **How to add a frontend feature**: N/A yet.
