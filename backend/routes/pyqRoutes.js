import express from "express";
import { getPyqsByTopic, getPrelimsSectionalTest, } from "../controllers/pyqController.js";

const router = express.Router();

router.get("/topic/:nodeId", getPyqsByTopic);
router.get("/prelims/pyq-tests/sectional", getPrelimsSectionalTest);

export default router;
