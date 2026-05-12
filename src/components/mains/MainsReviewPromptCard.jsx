// src/components/mains/MainsReviewPromptCard.jsx
// AIR-1 Review Prompt Card – Copy & Open ChatGPT for external review

import React, { useState } from "react";
import { buildAir1ReviewPrompt, buildAir1Prompt } from "../../utils/mainsReviewApi.js";

const T = {
    bg:          "#09090b",
    surface:     "#111113",
    surfaceHigh: "#18181b",
    border:      "#1f1f23",
    borderMid:   "#27272a",
    muted:       "#3f3f46",
    subtle:      "#52525b",
    dim:         "#71717a",
    text:        "#e4e4e7",
    textBright:  "#f4f4f5",
    amber:       "#f59e0b",
    amberDim:    "#d97706",
    blue:        "#3b82f6",
    green:       "#22c55e",
    red:         "#ef4444",
    purple:      "#8b5cf6",
    font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const label11 = (color = T.subtle) => ({
    fontSize: 11, fontWeight: 700,
    letterSpacing: "0.11em", textTransform: "uppercase", color,
});

const outlineBtn = (accent, size = "md") => ({
    background: "transparent", color: accent,
    border: `1px solid ${accent}44`, borderRadius: 8,
    fontWeight: 600,
    fontSize: size === "sm" ? 11 : 13,
    padding: size === "sm" ? "5px 12px" : "10px 20px",
    cursor: "pointer", fontFamily: T.font,
    letterSpacing: "0.03em", whiteSpace: "nowrap",
});

const primaryBtn = (accent, disabled = false) => ({
    background: disabled ? T.muted : accent,
    color: "#09090b", border: "none", borderRadius: 8,
    fontWeight: 900, fontSize: 13,
    padding: "11px 26px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: T.font, letterSpacing: "0.04em",
    opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
});

function MainsReviewPromptCard({
    currentQuestion,
    finalAnswerText,
    wordTarget,
    onCopyPrompt,
    onOpenChatGPT,
    canCopyReviewPrompt,
    promptCopied,
}) {
    const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);

    if (!finalAnswerText?.trim()) {
        return null; // Don't show until answer is pasted
    }

    const handleCopyPrompt = async () => {
        setIsBuildingPrompt(true);
        try {
            const payload = {
                paper: currentQuestion?.paper || "GS",
                subject: currentQuestion?.subject || "",
                topic: currentQuestion?.topic || "",
                syllabusNode: currentQuestion?.syllabusNode || currentQuestion?.nodeId || "",
                question: currentQuestion?.text || "",
                marks: currentQuestion?.marks || 15,
                wordLimit: wordTarget || 200,
                candidateAnswer: finalAnswerText || "",
                basicReview: currentQuestion?.basicReview || "",
                attemptHistory: currentQuestion?.attemptHistory || "",
                mentorOsPyqMatches: currentQuestion?.mentorOsPyqMatches || "",
                currentAffairsNotes: currentQuestion?.currentAffairsNotes || ""
            };

            const response = await buildAir1Prompt(payload);
            
            if (response && response.ok && response.prompt) {
                await navigator.clipboard.writeText(response.prompt);
                onCopyPrompt?.(); // triggers state update in parent
                
                // Show prompt success logic handled by parent via promptCopied
                // Open ChatGPT
                window.open("https://chatgpt.com", "_blank", "noopener,noreferrer");
                onOpenChatGPT?.();
            } else {
                throw new Error("Failed to get prompt from backend");
            }
        } catch (error) {
            console.error("Failed to copy prompt:", error);
            alert("Failed to build AIR-1 prompt. Check console.");
        } finally {
            setIsBuildingPrompt(false);
        }
    };

    const handleOpenChatGPT = () => {
        window.open("https://chatgpt.com", "_blank", "noopener,noreferrer");
        onOpenChatGPT?.();
    };

    return (
        <div
            style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 14, overflow: "hidden",
            }}
        >
            <div
                style={{
                    height: 2,
                    background: `linear-gradient(90deg, ${T.purple}, ${T.purple}44, ${T.border})`,
                }}
            />
            <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                        <div style={{ ...label11(T.subtle), marginBottom: 4 }}>Advanced AIR-1 Review</div>
                        <div style={{ fontSize: 13, color: T.dim }}>
                            Generate a strict external review of your answer using our AIR-1 evaluation framework.
                        </div>
                    </div>
                </div>

                <div style={{
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    marginBottom: 12,
                }}>
                    <button
                        onClick={handleCopyPrompt}
                        disabled={!canCopyReviewPrompt || isBuildingPrompt}
                        style={{
                            ...primaryBtn(T.purple, !canCopyReviewPrompt || isBuildingPrompt),
                        }}
                    >
                        {isBuildingPrompt ? "⏳ Generating..." : (promptCopied ? "✓ Copied" : "📋 Deep AIR-1 Review")}
                    </button>
                    <button
                        onClick={handleOpenChatGPT}
                        disabled={!canCopyReviewPrompt}
                        style={{
                            ...outlineBtn(T.purple),
                            opacity: !canCopyReviewPrompt ? 0.4 : 1,
                            cursor: !canCopyReviewPrompt ? "not-allowed" : "pointer",
                        }}
                    >
                        🤖 Open ChatGPT for Review
                    </button>
                </div>

                <div style={{
                    padding: "14px 16px", background: T.bg,
                    border: `1px solid ${T.border}`, borderRadius: 10,
                    fontSize: 12, color: T.dim, lineHeight: 1.65,
                }}>
                    {!promptCopied ? (
                        <div>
                            <span style={{ color: T.textBright, fontWeight: 700 }}>Next steps:</span>
                            {" "}Clicking the button will build the deep review prompt, copy it, and open ChatGPT.
                        </div>
                    ) : (
                        <div style={{ color: T.textBright, fontWeight: 700 }}>Prompt copied. ChatGPT opened. Paste it there and copy the final review back.</div>
                    )}
                </div>

                <details style={{ marginTop: 10, background: 'transparent' }}>
                    <summary style={{ cursor: 'pointer', color: T.dim, fontSize: 12 }}>Advanced: Legacy prompt</summary>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                            onClick={async () => {
                                const legacy = buildAir1ReviewPrompt({
                                    questionText: currentQuestion?.text || "",
                                    marks: currentQuestion?.marks || "15",
                                    wordLimit: wordTarget || "200",
                                    answerText: finalAnswerText,
                                });
                                try { await navigator.clipboard.writeText(legacy); } catch (e) { /* ignore */ }
                            }}
                            style={{ ...outlineBtn(T.purple) }}
                        >
                            Copy Legacy Prompt
                        </button>
                        <div style={{ fontSize: 12, color: T.dim }}>Legacy prompt preserved for advanced use only.</div>
                    </div>
                </details>
            </div>
        </div>
    );
}

export default MainsReviewPromptCard;
