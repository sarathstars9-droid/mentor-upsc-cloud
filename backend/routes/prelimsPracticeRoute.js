import express from "express";
import buildPrelimsPracticeTest from "../api/buildPrelimsPracticeTest.js";

const router = express.Router();

router.post("/build", buildPrelimsPracticeTest);

export default router;