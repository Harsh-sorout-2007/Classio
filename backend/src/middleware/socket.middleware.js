import jwt from "jsonwebtoken";

const verifySocketJWT = (socket, next) => {
  const token = socket.handshake.headers.cookie
    ?.split("; ")
    .find((cookie) => cookie.startsWith("accessToken="))
    ?.split("=")[1];

  if (!token) {
    return next(new Error("Unauthorized request"));
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    socket.user = decodedToken;

    next();
  } catch (error) {
    next(new Error("Invalid access token"));
  }
};

export { verifySocketJWT };
