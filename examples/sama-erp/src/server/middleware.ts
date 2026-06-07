// Illustrative auth guard for discovery's auth detection.
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.authorization) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
