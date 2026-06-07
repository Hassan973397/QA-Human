// Illustrative tenant-scoped order API for discovery (auth + tenant signals).
import express from "express";
import { requireAuth } from "./middleware.js";

const router = express.Router();

router.get("/api/merchants/:merchantId/orders", requireAuth, (req, res) => {
  const tenantId = req.params.merchantId; // tenant-scoped resource
  res.json({ tenantId, orders: [] });
});

router.post("/api/merchants/:merchantId/orders/:id/status", requireAuth, (req, res) => {
  res.json({ ok: true });
});

router.post("/api/customers/:id/block", requireAuth, (req, res) => {
  res.json({ blocked: true });
});

export default router;
