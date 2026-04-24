import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Middleware: requireAuth
 * Extracts JWT from Authorization header, verifies it, attaches req.user
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated", code: "UNAUTHENTICATED" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token", code: "UNAUTHENTICATED" });
  }
}

/**
 * Middleware factory: requireRole
 * Checks that the authenticated user has one of the specified roles
 */
export function requireRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated", code: "UNAUTHENTICATED" });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
      }
      if (!user.role || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      }
      req.dbUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Shorthand: requireOwner
 */
export function requireOwner(req, res, next) {
  return requireRole(["owner"])(req, res, next);
}

/**
 * Shorthand: requireManagerOrAbove
 */
export function requireManagerOrAbove(req, res, next) {
  return requireRole(["owner", "manager"])(req, res, next);
}
