function extractFirstJson(raw) {
    if (!raw || typeof raw !== "string") return null;
    // Try fenced code block first
    const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const fence = raw.match(fenceRe);
    if (fence && fence[1]) return fence[1].trim();

    // Otherwise find first balanced {...} object
    const start = raw.indexOf("{");
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return raw.slice(start, i + 1);
            }
        }
    }
    return null;
}

function sanitizeSmartQuotes(s) {
    return s.replace(/\u2018|\u2019/g, "'").replace(/\u201C|\u201D/g, '"');
}

function repairCommonIssues(s) {
    let out = s;
    out = out.replace(/\r\n/g, "\n");
    out = out.replace(/\t/g, ' ');
    out = sanitizeSmartQuotes(out);

    // Remove trailing commas before closing braces/brackets
    out = out.replace(/,\s*(\}|\])/g, "$1");

    // Quote unquoted object keys: { key:  -> { "key":
    out = out.replace(/([\{,]\s*)([A-Za-z0-9_\-@ ]+)\s*:/g, function (_, p1, p2) {
        // don't double-quote if already quoted
        if (/^\".*\"$/.test(p2.trim())) return p1 + p2 + ":";
        return p1 + '"' + p2.trim() + '":';
    });

    // Convert single-quoted strings to double-quoted strings
    out = out.replace(/'(?:\\'|[^'])*'/g, function (m) {
        // remove the surrounding single quotes, escape any existing double quotes
        const inner = m.slice(1, -1).replace(/"/g, '\\"');
        return '"' + inner + '"';
    });

    // Insert missing commas between a closing value and the next key/quote if on different lines
    out = out.replace(/([\]\}"0-9\"])(\s*\n\s*)(\"|[A-Za-z0-9_\-@ ]+\s*:)/g, "$1,$2$3");

    // Remove trailing commas again in case insertion created issues
    out = out.replace(/,\s*(\}|\])/g, "$1");

    return out;
}

function coerceSchema(parsed) {
    // Ensure a minimal tolerant schema, coercing types where possible.
    const out = {};

    const singleLine = (val, max = 160) => {
        let s = val == null ? "" : String(val);
        s = s.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
        if (s.length > max) return s.slice(0, max - 1) + "…";
        return s;
    };

    const MAX_MISTAKES = 5;
    const MAX_LOSS_REASONS = 4;
    const MAX_BODY = 4;

    // OLD SCHEMA PARSING (Fallback / Compatibility)
    if (parsed.score && typeof parsed.score === 'object') {
        out.score = {};
        const score = parsed.score || {};
        out.score.awarded = typeof score.awarded === 'number' ? score.awarded : (parseFloat(score.awarded) || 0);
        out.score.total = typeof score.total === 'number' ? score.total : (parseFloat(score.total) || 0);
        out.score.status = typeof score.status === 'string' ? score.status : String(score.status || '');
        out.score.oneLineVerdict = typeof score.oneLineVerdict === 'string' ? score.oneLineVerdict : String(score.oneLineVerdict || '');
    }

    if (parsed.lossReasons) {
        out.lossReasons = [];
        if (Array.isArray(parsed.lossReasons)) {
            for (let i = 0; i < Math.min(parsed.lossReasons.length, MAX_LOSS_REASONS); i++) {
                out.lossReasons.push(singleLine(parsed.lossReasons[i], 80));
            }
        } else {
            out.lossReasons.push(singleLine(parsed.lossReasons, 80));
        }
    }

    if (parsed.mistakes) {
        out.mistakes = [];
        if (Array.isArray(parsed.mistakes)) {
            for (let i = 0; i < Math.min(parsed.mistakes.length, MAX_MISTAKES); i++) {
                const m = parsed.mistakes[i];
                if (!m || typeof m !== 'object') continue;
                out.mistakes.push({
                    userLine: singleLine(m.userLine || m.line || '', 120),
                    problem: singleLine(m.problem || m.issue || '', 140),
                    fix: singleLine(m.fix || m.suggestion || '', 140),
                    tag: singleLine(m.tag || '', 60),
                    severity: singleLine(m.severity || '', 20),
                });
            }
        }
    }

    if (parsed.fixNow) {
        const fixNow = parsed.fixNow || {};
        out.fixNow = {
            mainTask: singleLine(fixNow.mainTask || '', 180),
            replacementLines: Array.isArray(fixNow.replacementLines) ? fixNow.replacementLines.map((r) => singleLine(r, 120)).slice(0, 3) : (fixNow.replacementLines ? [singleLine(fixNow.replacementLines, 120)] : []),
            nextPracticeTask: singleLine(fixNow.nextPracticeTask || '', 140),
        };
    }

    if (parsed.air1Answer) {
        const air1Answer = parsed.air1Answer || {};
        out.air1Answer = {
            intro: singleLine(air1Answer.intro || '', 180),
            body: Array.isArray(air1Answer.body) ? air1Answer.body.map((b) => singleLine(b, 140)).slice(0, MAX_BODY) : (air1Answer.body ? [singleLine(air1Answer.body, 140)] : []),
            conclusion: singleLine(air1Answer.conclusion || '', 180),
        };
    }

    if (parsed.autoTags) {
        out.autoTags = [];
        if (Array.isArray(parsed.autoTags)) {
            for (let i = 0; i < Math.min(parsed.autoTags.length, 8); i++) out.autoTags.push(singleLine(parsed.autoTags[i], 60));
        } else {
            out.autoTags.push(singleLine(parsed.autoTags, 60));
        }
    }

    // NEW 6-CARD SCHEMA PARSING
    if (parsed.score !== undefined && typeof parsed.score !== 'object') out.score = parsed.score;
    if (parsed.potentialScore !== undefined) out.potentialScore = parsed.potentialScore;
    if (parsed.examinerImpression !== undefined) out.examinerImpression = parsed.examinerImpression;
    if (Array.isArray(parsed.missingDimensionsChecklist)) out.missingDimensionsChecklist = parsed.missingDimensionsChecklist;
    if (Array.isArray(parsed.idealStructure)) out.idealStructure = parsed.idealStructure;
    if (Array.isArray(parsed.themeFlowchart)) out.themeFlowchart = parsed.themeFlowchart;
    if (Array.isArray(parsed.diagramSuggestions)) out.diagramSuggestions = parsed.diagramSuggestions;
    if (parsed.mnemonic) {
        if (typeof parsed.mnemonic === 'object') {
            out.mnemonic = {
                word: singleLine(parsed.mnemonic.word || '', 40),
                meaning: Array.isArray(parsed.mnemonic.meaning) ? parsed.mnemonic.meaning : (parsed.mnemonic.meaning ? [singleLine(parsed.mnemonic.meaning, 200)] : []),
                whyItFits: singleLine(parsed.mnemonic.whyItFits || '', 200)
            };
        } else if (typeof parsed.mnemonic === 'string') {
            out.mnemonic = {
                word: "Memory Hook",
                meaning: [singleLine(parsed.mnemonic, 200)],
                whyItFits: ""
            };
        }

        // Vedic Fallback Logic: if it's the Vedic transformation question and word is not SETTLE or meaning is a sentence
        const isVedic = /Vedic/i.test(parsed.question || parsed.topic || "");
        if (isVedic && out.mnemonic.word && out.mnemonic.word.length > 10) {
            out.mnemonic = {
                word: "SETTLE",
                meaning: [
                    "S — Settled agriculture",
                    "E — Expanding territory",
                    "T — Tools / iron",
                    "T — Taxation and surplus",
                    "L — Layered varna hierarchy",
                    "E — Elaborate rituals"
                ],
                whyItFits: "The question asks the shift from Rig Vedic pastoral-tribal life to Later Vedic settled agrarian hierarchy."
            };
        }
    }
    if (Array.isArray(parsed.topImprovements)) out.topImprovements = parsed.topImprovements;
    if (Array.isArray(parsed.air1Upgrades)) out.air1Upgrades = parsed.air1Upgrades;
    if (parsed.modelAnswer !== undefined) out.modelAnswer = parsed.modelAnswer;
    if (Array.isArray(parsed.whyThisScoresHigh)) out.whyThisScoresHigh = parsed.whyThisScoresHigh;
    if (parsed.detailedMentorReview !== undefined) out.detailedMentorReview = parsed.detailedMentorReview;

    if (parsed.cards !== undefined) out.cards = parsed.cards;
    if (parsed.quickEvaluation !== undefined) out.quickEvaluation = parsed.quickEvaluation;
    if (parsed.howToImprove !== undefined) out.howToImprove = parsed.howToImprove;
    if (parsed.air1ModelAnswer !== undefined) out.air1ModelAnswer = parsed.air1ModelAnswer;

    if (parsed.card1_quickEvaluation !== undefined) out.card1_quickEvaluation = parsed.card1_quickEvaluation;
    if (parsed.card2_howToImprove !== undefined) out.card2_howToImprove = parsed.card2_howToImprove;
    if (parsed.card3_air1Upgrades !== undefined) out.card3_air1Upgrades = parsed.card3_air1Upgrades;
    if (parsed.card4_air1ModelAnswer !== undefined) out.card4_air1ModelAnswer = parsed.card4_air1ModelAnswer;
    if (parsed.card5_whyThisScoresHigh !== undefined) out.card5_whyThisScoresHigh = parsed.card5_whyThisScoresHigh;
    if (parsed.card6_detailedMentorReview !== undefined) out.card6_detailedMentorReview = parsed.card6_detailedMentorReview;

    return out;
}

export function parseAir1ReviewJson(rawText) {
    try {
        const jsonStr = extractFirstJson(rawText);
        if (!jsonStr) return { ok: false, error: 'Could not find a JSON object in the pasted text.' };

        // First attempt: direct JSON.parse
        try {
            const parsed = JSON.parse(jsonStr);
            const coerced = coerceSchema(parsed);
            return { ok: true, data: coerced };
        } catch (e) {
            // continue to repair
        }

        // Apply heuristic repairs
        const repaired = repairCommonIssues(jsonStr);
        try {
            const parsed2 = JSON.parse(repaired);
            const coerced2 = coerceSchema(parsed2);
            return { ok: true, data: coerced2 };
        } catch (e) {
            return { ok: false, error: 'Unable to parse JSON after heuristic repairs: ' + e.message };
        }
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
}

export default parseAir1ReviewJson;
