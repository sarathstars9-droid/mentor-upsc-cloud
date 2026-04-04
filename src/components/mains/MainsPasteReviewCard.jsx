// src/components/mains/MainsPasteReviewCard.jsx
// Paste External Review Card – textarea, agreement selector, buttons

import React from "react";

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

function MainsPasteReviewCard({
    externalReviewText,
    setExternalReviewText,
    reviewAgreement,
    setReviewAgreement,
    reviewAgreementNote,
    setReviewAgreementNote,
    onSaveReview,
    onProcessReview,
    canSaveReview,
    canProcessReview,
    reviewSaveState,
    reviewProcessState,
}) {
    const reviewLength = externalReviewText.trim().length;
    const isReviewTooShort = reviewLength > 0 && reviewLength < 200;

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
                    background: `linear-gradient(90deg, ${T.blue}, ${T.blue}44, ${T.border})`,
                }}
            />
            <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                        <div style={{ ...label11(T.subtle), marginBottom: 4 }}>Paste External Review</div>
                        <div style={{ fontSize: 13, color: T.dim }}>
                            Paste the complete review from ChatGPT below. MentorOS will audit and process it.
                        </div>
                    </div>
                    {reviewLength > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: isReviewTooShort ? T.red : T.green, fontWeight: 700 }}>
                                {reviewLength} characters
                            </span>
                            {isReviewTooShort && (
                                <span style={{ fontSize: 10, color: T.red }}>
                                    ✗ Minimum 200 characters
                                </span>
                            )}
                            {!isReviewTooShort && reviewLength > 0 && (
                                <span style={{ fontSize: 10, color: T.green }}>
                                    ✓ Valid length
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Textarea */}
                <textarea
                    value={externalReviewText}
                    onChange={(e) => setExternalReviewText(e.target.value)}
                    rows={12}
                    style={{
                        width: "100%", boxSizing: "border-box",
                        background: T.bg,
                        border: `1px solid ${externalReviewText.trim() ? T.blue + "55" : T.borderMid}`,
                        borderRadius: 10, color: T.text, fontSize: 13.5,
                        lineHeight: 1.8, padding: "16px 18px",
                        fontFamily: T.font, resize: "vertical", outline: "none",
                        letterSpacing: "0.01em",
                        transition: "border-color 0.2s",
                        marginBottom: 12,
                    }}
                    placeholder="Paste the complete review from ChatGPT here…"
                />

                {/* Agreement Selector */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ ...label11(T.subtle), marginBottom: 10 }}>How much do you agree with this review?</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {[
                            { value: "fully_agree", label: "Fully Agree", color: T.green },
                            { value: "partly_agree", label: "Partly Agree", color: T.amber },
                            { value: "disagree", label: "Disagree", color: T.red },
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setReviewAgreement(option.value)}
                                style={{
                                    padding: "8px 16px", borderRadius: 8, fontSize: 12,
                                    fontWeight: 600, border: "none",
                                    background: reviewAgreement === option.value
                                        ? option.color
                                        : T.surfaceHigh,
                                    color: reviewAgreement === option.value
                                        ? "#09090b"
                                        : T.text,
                                    cursor: "pointer", fontFamily: T.font,
                                    letterSpacing: "0.03em",
                                    transition: "all 0.2s",
                                }}
                            >
                                {reviewAgreement === option.value && "✓ "}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Optional Note */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ ...label11(T.subtle), marginBottom: 8 }}>Optional Note</div>
                    <input
                        type="text"
                        value={reviewAgreementNote}
                        onChange={(e) => setReviewAgreementNote(e.target.value)}
                        placeholder="e.g., marks seem harsh, or content feedback is valuable"
                        style={{
                            width: "100%", boxSizing: "border-box",
                            background: T.bg, border: `1px solid ${T.border}`,
                            borderRadius: 8, color: T.text, fontSize: 13,
                            padding: "10px 14px", fontFamily: T.font,
                            outline: "none", transition: "border-color 0.2s",
                        }}
                    />
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                        onClick={onSaveReview}
                        disabled={!canSaveReview}
                        style={{
                            ...primaryBtn(T.blue, !canSaveReview),
                        }}
                    >
                        {reviewSaveState === "saving" ? "Saving…" : reviewSaveState === "saved" ? "✓ Saved" : "💾 Save Review"}
                    </button>
                    <button
                        onClick={onProcessReview}
                        disabled={!canProcessReview}
                        style={{
                            ...outlineBtn(T.green),
                            opacity: !canProcessReview ? 0.4 : 1,
                            cursor: !canProcessReview ? "not-allowed" : "pointer",
                        }}
                    >
                        {reviewProcessState === "processing" ? "Processing…" : "⚙ Process Review"}
                    </button>
                </div>

                {reviewSaveState === "saved" && (
                    <div style={{
                        marginTop: 12, padding: "10px 14px",
                        background: `${T.green}11`, border: `1px solid ${T.green}33`,
                        borderRadius: 8, fontSize: 12, color: T.green, fontWeight: 600,
                    }}>
                        ✓ Review saved. Click "Process Review" to audit and extract signals.
                    </div>
                )}
            </div>
        </div>
    );
}

export default MainsPasteReviewCard;
