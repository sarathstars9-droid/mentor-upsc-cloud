// src/components/mains/MainsReviewPromptCard.jsx
// AIR-1 Review Prompt Card – Copy & Open ChatGPT for external review

import React from "react";
import { buildAir1ReviewPrompt } from "../../utils/mainsReviewApi.js";

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
    if (!finalAnswerText?.trim()) {
        return null; // Don't show until answer is pasted
    }

    const handleCopyPrompt = async () => {
        const prompt = buildAir1ReviewPrompt({
            questionText: currentQuestion?.text || "",
            marks: currentQuestion?.marks || "15",
            wordLimit: wordTarget || "200",
            answerText: finalAnswerText,
        });
        try {
            await navigator.clipboard.writeText(prompt);
            onCopyPrompt?.();
        } catch (error) {
            console.error("Failed to copy prompt:", error);
        }
    };

    const handleOpenChatGPT = () => {
        window.open("https://chat.openai.com", "_blank", "noopener,noreferrer");
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
                        <div style={{ ...label11(T.subtle), marginBottom: 4 }}>AIR-1 Review Prompt</div>
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
                        disabled={!canCopyReviewPrompt}
                        style={{
                            ...primaryBtn(T.purple, !canCopyReviewPrompt),
                        }}
                    >
                        {promptCopied ? "✓ Copied" : "📋 Copy AIR-1 Review Prompt"}
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
                    <span style={{ color: T.textBright, fontWeight: 700 }}>Next steps:</span>
                    {" "}Copy the prompt above → paste it in ChatGPT → let ChatGPT evaluate your answer → copy the
                    complete review → paste in the section below.
                </div>
            </div>
        </div>
    );
}

export default MainsReviewPromptCard;
