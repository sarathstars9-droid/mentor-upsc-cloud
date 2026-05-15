import React from "react";

export default function Air1StructureMap({ data, modelAnswer, T }) {
    // Attempt to extract skeleton from model answer headings
    const extractSkeleton = () => {
        const skeleton = [];
        let hasIntro = false;
        let hasConclusion = false;

        // Try to parse modelAnswer first
        if (modelAnswer) {
            const lines = modelAnswer.split("\n");
            let currentSection = null;

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // Look for headings: ### Title, **Title**, or 1. Title
                const headingMatch = trimmed.match(/^(?:###|##|#|\*\*|\d+\.)\s*(.+?)(?:\*\*|:)?$/);
                
                if (headingMatch || (trimmed.length < 50 && trimmed === trimmed.toUpperCase())) {
                    let title = headingMatch ? headingMatch[1].replace(/\*\*/g, '').trim() : trimmed;
                    // Filter out non-headings that got caught
                    if (title.length > 60) continue;

                    let type = "body";
                    let color = T.blue;
                    let icon = "🔵";

                    if (title.toLowerCase().includes("intro")) {
                        type = "intro";
                        color = T.purple;
                        icon = "🟣";
                        hasIntro = true;
                    } else if (title.toLowerCase().includes("conclu") || title.toLowerCase().includes("way forward")) {
                        type = "conclusion";
                        color = T.amber;
                        icon = "🟠";
                        hasConclusion = true;
                    } else if (title.toLowerCase().includes("econom")) {
                        color = T.green;
                        icon = "🟢";
                    }

                    if (currentSection) {
                        skeleton.push(currentSection);
                    }
                    currentSection = { title, type, color, icon, points: [] };
                } else if (currentSection && (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.match(/^\d+\./))) {
                    let point = trimmed.replace(/^[-•\d+\.]\s*/, '').replace(/\*\*/g, '').trim();
                    // Keep it short
                    if (point.length > 40) point = point.substring(0, 40) + "...";
                    if (currentSection.points.length < 4) {
                        currentSection.points.push(point);
                    }
                }
            }
            if (currentSection) skeleton.push(currentSection);
        }

        // If parsing failed to get a good structure, fallback to AI explicit suggestions
        if (skeleton.length < 2) {
            const fallback = [];
            
            // Intro
            fallback.push({
                title: "INTRODUCTION", type: "intro", color: T.purple, icon: "🟣",
                points: ["Set the core context"]
            });
            
            // Body from subheading suggestions
            if (Array.isArray(data.subheadingSuggestions) && data.subheadingSuggestions.length > 0) {
                data.subheadingSuggestions.forEach(sh => {
                    fallback.push({
                        title: typeof sh === "string" ? sh : sh.heading || "KEY DIMENSION",
                        type: "body", color: T.blue, icon: "🔵",
                        points: ["Core analytical points"]
                    });
                });
            } else {
                fallback.push({
                    title: "MAIN BODY", type: "body", color: T.blue, icon: "🔵",
                    points: ["Primary arguments", "Supporting evidence"]
                });
            }

            // Conclusion
            fallback.push({
                title: "CONCLUSION", type: "conclusion", color: T.amber, icon: "🟠",
                points: ["Balanced final assessment"]
            });

            return fallback;
        }

        return skeleton;
    };

    const skeleton = extractSkeleton();

    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: 0,
            background: T.surfaceHigh, padding: "24px 32px",
            borderRadius: 16, border: `1px solid ${T.border}`
        }}>
            {skeleton.map((section, idx) => (
                <div key={idx} style={{ display: "flex", gap: 20, position: "relative" }}>
                    {/* Timeline line */}
                    {idx !== skeleton.length - 1 && (
                        <div style={{
                            position: "absolute", left: 11, top: 28, bottom: -12,
                            width: 2, background: `${section.color}30`
                        }} />
                    )}
                    
                    <div style={{ fontSize: 24, zIndex: 2, position: "relative", top: 2 }}>{section.icon}</div>
                    
                    <div style={{ paddingBottom: 28, flex: 1 }}>
                        <div style={{ 
                            fontSize: 13, fontWeight: 800, color: section.color,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                            marginBottom: 8
                        }}>
                            {section.title}
                        </div>
                        
                        {section.points.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {section.points.map((pt, i) => (
                                    <div key={i} style={{ 
                                        fontSize: 14, color: T.textBright,
                                        display: "flex", gap: 8, alignItems: "center"
                                    }}>
                                        <span style={{ color: T.subtle, fontSize: 10 }}>•</span>
                                        {pt}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
