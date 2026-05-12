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

    out.score = out.score || {};
    const score = parsed.score || {};
    out.score.awarded = typeof score.awarded === 'number' ? score.awarded : (parseFloat(score.awarded) || 0);
    out.score.total = typeof score.total === 'number' ? score.total : (parseFloat(score.total) || 0);
    out.score.status = typeof score.status === 'string' ? score.status : String(score.status || '');
    out.score.oneLineVerdict = typeof score.oneLineVerdict === 'string' ? score.oneLineVerdict : String(score.oneLineVerdict || '');

    // lossReasons: keep short list, single-line entries
    out.lossReasons = [];
    if (Array.isArray(parsed.lossReasons)) {
        for (let i = 0; i < Math.min(parsed.lossReasons.length, MAX_LOSS_REASONS); i++) {
            out.lossReasons.push(singleLine(parsed.lossReasons[i], 80));
        }
    } else if (parsed.lossReasons) {
        out.lossReasons.push(singleLine(parsed.lossReasons, 80));
    }

    // mistakes: keep top N, and only short single-line fields (userLine, problem, fix, tag, severity)
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

    const fixNow = parsed.fixNow || {};
    out.fixNow = {
        mainTask: singleLine(fixNow.mainTask || '', 180),
        replacementLines: Array.isArray(fixNow.replacementLines) ? fixNow.replacementLines.map((r) => singleLine(r, 120)).slice(0, 3) : (fixNow.replacementLines ? [singleLine(fixNow.replacementLines, 120)] : []),
        nextPracticeTask: singleLine(fixNow.nextPracticeTask || '', 140),
    };

    const air1Answer = parsed.air1Answer || {};
    out.air1Answer = {
        intro: singleLine(air1Answer.intro || '', 180),
        body: Array.isArray(air1Answer.body) ? air1Answer.body.map((b) => singleLine(b, 140)).slice(0, MAX_BODY) : (air1Answer.body ? [singleLine(air1Answer.body, 140)] : []),
        conclusion: singleLine(air1Answer.conclusion || '', 180),
    };

    out.autoTags = [];
    if (Array.isArray(parsed.autoTags)) {
        for (let i = 0; i < Math.min(parsed.autoTags.length, 8); i++) out.autoTags.push(singleLine(parsed.autoTags[i], 60));
    } else if (parsed.autoTags) out.autoTags.push(singleLine(parsed.autoTags, 60));

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
