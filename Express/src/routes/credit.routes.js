// Credit routes: read and top-up organization credit balances.
import { Router } from "express";
import { getCreditBalance, addCreditTokens } from "../controllers/credit.controller.js";

const router = Router();

router.get("/:orgId?", getCreditBalance);
router.put("/:orgId?", addCreditTokens);

export default router;