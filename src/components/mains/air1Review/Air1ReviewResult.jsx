import React from "react";
import ScoreHeader from "./ScoreHeader";
import LossReasonsCard from "./LossReasonsCard";
import MistakeCard from "./MistakeCard";
import FixNowCard from "./FixNowCard";
import CompareAir1Answer from "./CompareAir1Answer";

function Air1ReviewResult({ data, rawReviewText, onStartFix }) {
    const { score, lossReasons = [], mistakes = [], fixNow = {}, air1Answer = {}, autoTags = [] } = data || {};

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ScoreHeader score={score} />

            {lossReasons && lossReasons.length > 0 && (
                <LossReasonsCard lossReasons={lossReasons} />
            )}

            {mistakes && mistakes.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                    {mistakes.slice(0, 5).map((m, i) => (
                        <MistakeCard key={i} mistake={m} />
                    ))}
                </div>
            )}

            {fixNow && (Object.keys(fixNow).length > 0) && (
                <FixNowCard fixNow={fixNow} onStartFix={onStartFix} />
            )}

            <CompareAir1Answer air1Answer={air1Answer} />

            {autoTags && autoTags.length > 0 && (
                <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                    <strong>Auto tags:</strong> {autoTags.join(", ")}.
                </div>
            )}

            <details style={{ background: "#09090b", border: "1px solid #222", borderRadius: 8, padding: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>View Raw Parsed JSON</summary>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, color: "#ddd", fontSize: 12 }}>{JSON.stringify(data, null, 2)}</pre>
                {rawReviewText && (
                    <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Original pasted review (raw):</div>
                        <pre style={{ whiteSpace: "pre-wrap", color: "#ddd", fontSize: 12 }}>{rawReviewText}</pre>
                    </div>
                )}
            </details>
        </div>
    );
}

export default Air1ReviewResult;
