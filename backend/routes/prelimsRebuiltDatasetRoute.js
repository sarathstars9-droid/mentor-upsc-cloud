import express from "express";
import {
    reloadPrelimsRebuiltDataset,
    getPrelimsDatasetSummary,
    getPrelimsSubjects,
    getPrelimsTopics,
    getPrelimsMicrothemes,
    buildPrelimsSelectorTree,
    buildPrelimsPracticeSet,
    filterPrelimsQuestions
} from "../adapters/prelimsRebuiltDatasetAdapter.js";

const router = express.Router();

router.get("/summary", (req, res) => {
    try {
        return res.json({
            ok: true,
            ...getPrelimsDatasetSummary()
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.get("/subjects", (req, res) => {
    try {
        return res.json({
            ok: true,
            subjects: getPrelimsSubjects()
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.get("/topics", (req, res) => {
    try {
        const { subject } = req.query;

        return res.json({
            ok: true,
            subject,
            topics: getPrelimsTopics(subject)
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.get("/microthemes", (req, res) => {
    try {
        const { subject, topic } = req.query;

        return res.json({
            ok: true,
            subject,
            topic,
            microthemes: getPrelimsMicrothemes(subject, topic)
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.get("/tree", (req, res) => {
    try {
        const includeReview = req.query.includeReview !== "false";

        return res.json({
            ok: true,
            includeReview,
            tree: buildPrelimsSelectorTree({ includeReview })
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.get("/questions", (req, res) => {
    try {
        const {
            subject,
            topic,
            microtheme,
            questionType,
            year,
            limit,
            includeReview
        } = req.query;

        const questions = filterPrelimsQuestions({
            subject,
            topic,
            microtheme,
            questionType,
            year,
            limit: limit ? Number(limit) : null,
            includeReview: includeReview !== "false"
        });

        return res.json({
            ok: true,
            total: questions.length,
            questions
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.get("/practice/build", (req, res) => {
    try {
        const {
            subject,
            topic,
            microtheme,
            questionType,
            year,
            count,
            includeReview
        } = req.query;

        const questions = buildPrelimsPracticeSet({
            subject,
            topic,
            microtheme,
            questionType,
            year,
            count: count ? Number(count) : 10,
            includeReview: includeReview === "true"
        });

        return res.json({
            ok: true,
            count: questions.length,
            questions
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.post("/reload", (req, res) => {
    try {
        const total = reloadPrelimsRebuiltDataset();

        return res.json({
            ok: true,
            totalReloaded: total
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

export default router;