// src/services/performanceService.js

function getPerformanceDataSeed() {
    return {
        execution: {
            plannedHours: 9,
            actualHours: 6.5,
            deepWorkHours: 3.8,
            shallowWorkHours: 2.7,
            completedBlocks: 5,
            partialBlocks: 2,
            missedBlocks: 3,
            delayedStarts: 2,
            interruptions: 4,
            csatMinutes: 0,
            streakDays: 11,
            focusScore: 62,
            blockAdherence: 58,
        },

        subjects: [
            { id: "gs1", name: "GS1", score: 71, trend: 3, accuracy: 68, testCount: 4, revisionHealth: 72, topicCoverage: 61, status: "stable" },
            { id: "gs2", name: "GS2", score: 64, trend: -2, accuracy: 61, testCount: 3, revisionHealth: 55, topicCoverage: 54, status: "warning" },
            { id: "gs3", name: "GS3", score: 58, trend: -5, accuracy: 54, testCount: 5, revisionHealth: 48, topicCoverage: 49, status: "critical" },
            { id: "gs4", name: "GS4", score: 78, trend: 6, accuracy: 76, testCount: 2, revisionHealth: 80, topicCoverage: 70, status: "strong" },
            { id: "optional", name: "Optional", score: 82, trend: 2, accuracy: 80, testCount: 3, revisionHealth: 85, topicCoverage: 78, status: "strong" },
            { id: "essay", name: "Essay", score: 55, trend: -1, accuracy: 52, testCount: 2, revisionHealth: 50, topicCoverage: 40, status: "warning" },
            { id: "csat", name: "CSAT", score: 44, trend: -8, accuracy: 41, testCount: 1, revisionHealth: 30, topicCoverage: 35, status: "critical" },
        ],

        topics: [
            { id: 1, topicName: "Indian Economy – Growth Models", subject: "GS3", accuracy: 42, mistakes: 9, revisionHealth: 38, priorityScore: 91, trend: -4, lastStudiedDaysAgo: 9, status: "critical" },
            { id: 2, topicName: "Polity – Parliament Procedures", subject: "GS2", accuracy: 55, mistakes: 7, revisionHealth: 51, priorityScore: 84, trend: -2, lastStudiedDaysAgo: 6, status: "warning" },
            { id: 3, topicName: "Environment – Climate Agreements", subject: "GS3", accuracy: 48, mistakes: 8, revisionHealth: 44, priorityScore: 88, trend: -5, lastStudiedDaysAgo: 11, status: "critical" },
        ],

        revision: {
            dueToday: 8,
            overdue: 14,
            completedToday: 2,
            retentionScore: 54,
            revisionSuccessRate: 61,
            loopHealth: { one: 55, three: 62, seven: 48 },
        },

        mistakes: {
            conceptual: 28,
            silly: 14,
            guess: 19,
            repeat: 11,
            total: 72,
            illusionOfLearning: true,
            overconfidenceTrap: false,
            avoidanceBehavior: true,
        },

        csat: {
            todayMinutes: 0,
            last2DayTouched: false,
            weeklyMinutes: 35,
            status: "critical",
        },

        trends: {
            studyHours: [8.2, 7.5, 9.0, 6.0, 7.8, 8.5, 6.5],
            completion: [78, 71, 88, 55, 74, 81, 62],
            accuracy: [64, 62, 67, 60, 65, 63, 61],
            revision: [70, 68, 72, 60, 65, 66, 61],
            csat: [45, 30, 60, 0, 40, 55, 0],
        },

        mainAnswers: 6,
        testScoreThisWeek: 61,
        negativeMarksLost: 8,
    };
}

function toStatus(score) {
    if (score >= 75) return "strong";
    if (score >= 60) return "stable";
    if (score >= 45) return "warning";
    return "critical";
}

function mapBackendToUI(api) {
    const summary = api?.summary || {};
    const subjectStats = api?.subjectStats || {};
    const weakNodes = api?.weakNodes || [];
    const recommendations = api?.recommendations || [];
    const trapStats = api?.trapStats || {};

    const subjects = Object.entries(subjectStats).map(([key, value]) => {
        const score = Math.round(value?.accuracy || 0);
        return {
            id: String(key).toLowerCase(),
            name: String(key).toUpperCase(),
            score,
            trend: 0,
            accuracy: score,
            testCount: value?.total || 0,
            revisionHealth: 50,
            topicCoverage: 50,
            status: toStatus(score),
        };
    });

    const topics = weakNodes.map((node, index) => {
        const accuracy = Math.round(node?.accuracy || 0);
        const mistakes = node?.incorrect || 0;
        return {
            id: index + 1,
            topicName: node?.label || node?.nodeId || `Weak Topic ${index + 1}`,
            subject: node?.subject || "GS",
            accuracy,
            mistakes,
            revisionHealth: Math.max(20, 100 - mistakes * 8),
            priorityScore: Math.min(100, mistakes * 10 + (100 - accuracy)),
            trend: 0,
            lastStudiedDaysAgo: 5,
            status: toStatus(accuracy),
        };
    });

    const conceptual = trapStats?.conceptual || 0;
    const silly = trapStats?.silly || 0;
    const guess = trapStats?.guess || 0;
    const repeat = trapStats?.repeat || 0;
    const totalMistakes = conceptual + silly + guess + repeat;

    return {
        execution: {
            plannedHours: 9,
            actualHours: summary?.attempted || 0,
            deepWorkHours: 0,
            shallowWorkHours: 0,
            completedBlocks: summary?.correct || 0,
            partialBlocks: 0,
            missedBlocks: summary?.incorrect || 0,
            delayedStarts: 0,
            interruptions: 0,
            csatMinutes: 0,
            streakDays: 0,
            focusScore: 60,
            blockAdherence: 60,
        },

        subjects: subjects.length ? subjects : getPerformanceDataSeed().subjects,
        topics: topics.length ? topics : getPerformanceDataSeed().topics,

        revision: {
            dueToday: recommendations.length,
            overdue: weakNodes.length,
            completedToday: 0,
            retentionScore: 50,
            revisionSuccessRate: 50,
            loopHealth: { one: 50, three: 50, seven: 50 },
        },

        mistakes: {
            conceptual,
            silly,
            guess,
            repeat,
            total: totalMistakes,
            illusionOfLearning: false,
            overconfidenceTrap: false,
            avoidanceBehavior: false,
        },

        csat: {
            todayMinutes: 0,
            last2DayTouched: true,
            weeklyMinutes: 0,
            status: "stable",
        },

        trends: {
            studyHours: [5, 6, 7, 6, 8, 7, 6],
            completion: [60, 65, 70, 68, 72, 71, 69],
            accuracy: [50, 55, 60, 58, 62, 61, 59],
            revision: [40, 45, 50, 48, 52, 51, 49],
            csat: [0, 0, 0, 0, 0, 0, 0],
        },

        mainAnswers: 0,
        testScoreThisWeek: Math.round(summary?.accuracy || 0),
        negativeMarksLost: 0,
    };
}

export async function fetchRealPerformanceData() {
    try {
        const BACKEND_URL =
            import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

        const res = await fetch(
            `${BACKEND_URL}/api/prelims/dashboard?testId=prelims_2020_gs1&userId=user_1`,
            { method: "GET" }
        );

        if (!res.ok) {
            throw new Error(`Performance API failed: ${res.status}`);
        }

        const api = await res.json();
        // ✅ NOW LOG AFTER api exists
        console.log("RAW PERFORMANCE API:", api);

        const mapped = mapBackendToUI(api);
        console.log("MAPPED PERFORMANCE DATA:", mapped);
        return mapped;
    } catch (error) {
        console.error("fetchRealPerformanceData failed, using seed fallback", error);
        return getPerformanceDataSeed();
    }
}