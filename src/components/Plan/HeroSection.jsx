import { useState } from 'react';
import { getEffectiveBlockStatus } from "../../utils/studyEngine";

export default function HeroSection({
    dPre,
    dMains,
    todayBlocks = [],
    currentBlock,
    onStartBlock,
    onPauseBlock,
    onResumeBlock,
    nextBlock,
    onStartNextBlock,
    onOpenFocus,
}) {
    const [showLogicModal, setShowLogicModal] = useState(false);

    const totalBlocks = todayBlocks.length;
    const completedBlocks = todayBlocks.filter(b => {
        const s = getEffectiveBlockStatus(b).toLowerCase();
        return s === 'completed' || s === 'done';
    }).length;
    
    const pct = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

    // Math for the SVG circle
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    let heroActionLabel = "Start next block";
    let heroActionClick = () => nextBlock && onStartNextBlock(nextBlock);

    if (currentBlock) {
        const status = getEffectiveBlockStatus(currentBlock).toLowerCase();
        if (status === "active") {
            heroActionLabel = "Open focus mode";
            heroActionClick = onOpenFocus;
        } else if (status === "paused") {
            heroActionLabel = "Resume current block";
            heroActionClick = onResumeBlock;
        } else {
            heroActionLabel = "Start current block";
            heroActionClick = onStartBlock;
        }
    }

    return (
        <section style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 16,
            padding: "32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            boxShadow: "var(--shadow-card)",
            marginBottom: 24,
            gap: 24
        }}>
            <div style={{ flex: 1, maxWidth: 640 }}>
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "var(--text-primary)",
                    margin: "0 0 16px 0"
                }}>
                    Good morning, <span style={{ color: "var(--brand-primary)" }}>Moulika.</span>
                </h1>
                
                <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 8
                }}>
                    Today's Mentor Command
                </div>

                <p style={{
                    fontSize: 16,
                    color: "var(--text-primary)",
                    margin: "0 0 4px 0",
                    fontWeight: 500,
                    lineHeight: 1.5
                }}>
                    Finish Modern History: British expansion and resistance before 12:45 PM.
                </p>
                
                <p style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    margin: "0 0 24px 0",
                    fontWeight: 400,
                    lineHeight: 1.4
                }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Reason:</span> Yesterday's Modern History target carried forward, and this topic is connected to two repeated mistakes.
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
                    <button 
                        onClick={heroActionClick}
                        style={{
                        background: "var(--brand-primary)",
                        color: "#FFFFFF",
                        padding: "10px 18px",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "none"
                    }}>
                        {heroActionLabel} <span>›</span>
                    </button>
                    
                    <a href="#" onClick={(e) => { e.preventDefault(); setShowLogicModal(true); }} style={{
                        color: "var(--text-secondary)",
                        fontSize: 14,
                        fontWeight: 500,
                        textDecoration: "none"
                    }}>
                        View today's logic ›
                    </a>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                        <span style={{ color: "var(--brand-primary)" }}>⏱</span> 21 min left
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                        <span style={{ color: "var(--brand-primary)" }}>○</span> 83% complete
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                        <span style={{ color: "var(--success)" }}>🛡</span> Plan status: <span style={{ color: "var(--brand-primary)" }}>Recoverable</span>
                    </div>
                    
                    <div style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }} />
                    
                    <div style={{
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                        border: "1px solid var(--border-default)",
                        padding: "4px 8px",
                        borderRadius: 6
                    }}>
                        Prelims in <span style={{ color: "var(--warning)" }}>{dPre || 312} days</span>
                    </div>
                    <div style={{
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                        border: "1px solid var(--border-default)",
                        padding: "4px 8px",
                        borderRadius: 6
                    }}>
                        Mains in <span style={{ color: "var(--warning)" }}>{dMains || 401} days</span>
                    </div>
                </div>
            </div>

            <div style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: "24px",
                display: "flex",
                alignItems: "center",
                gap: 24,
                minWidth: 280,
                boxShadow: "var(--shadow-card, none)"
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.4 }}>
                        {completedBlocks} of {totalBlocks} blocks completed
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        Complete the current block to keep today on track.
                    </div>
                </div>
                <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
                    <svg width="72" height="72" viewBox="0 0 72 72">
                        <circle
                            cx="36" cy="36" r={radius}
                            fill="none" stroke="var(--border-default)" strokeWidth="6"
                        />
                        <circle
                            cx="36" cy="36" r={radius}
                            fill="none" stroke="var(--brand-primary)" strokeWidth="6"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 36 36)"
                        />
                    </svg>
                    <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 700, color: "var(--text-primary)"
                    }}>
                        {pct}%
                    </div>
                </div>
            </div>
            
            {showLogicModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLogicModal(false)}>
                    <div style={{ background: 'var(--bg-surface)', padding: 32, borderRadius: 24, width: 440, maxWidth: 'calc(100vw - 32px)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Why this block now?</h2>
                        <p style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--text-secondary)' }}>MentorOS selected this block because:</p>
                        <ul style={{ margin: '0 0 24px', paddingLeft: 20, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6 }}>
                            <li>It is the active or next recoverable block in today’s schedule.</li>
                            <li>Yesterday’s Modern History target carried forward.</li>
                            <li>This topic is linked to two repeated mistakes.</li>
                            <li>Polity should wait until this block is completed.</li>
                        </ul>
                        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                            This logic is generated from today’s plan, previous completion, pending blocks, and repeated mistakes.
                        </p>
                        <button onClick={() => setShowLogicModal(false)} style={{ width: '100%', padding: '12px', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Got it</button>
                    </div>
                </div>
            )}
        </section>
    );
}
