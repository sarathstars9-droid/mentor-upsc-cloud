import React, { useState } from 'react';

export default function BehaviourSignalModal({
    open,
    block,
    onClose,
    onSignalSaved,
    BACKEND_URL
}) {
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState(null); // 'done', 'partial', 'missed'
    const [quality, setQuality] = useState(null); // 'strong', 'normal', 'weak'
    const [reasonCode, setReasonCode] = useState(null);
    const [completionPercent, setCompletionPercent] = useState(null);
    const [studiedSomethingElse, setStudiedSomethingElse] = useState(false);
    const [busy, setBusy] = useState(false);

    if (!open || !block) return null;

    const partialReasons = [
        { id: 'time_underestimated', label: 'Time Underestimated' },
        { id: 'distracted', label: 'Distracted' },
        { id: 'difficult_topic', label: 'Difficult Topic' },
        { id: 'slow_writing', label: 'Slow Writing' },
        { id: 'phone_interruption', label: 'Phone Interruption' },
        { id: 'low_energy', label: 'Low Energy' },
        { id: 'overthinking', label: 'Overthinking' },
        { id: 'other', label: 'Other' },
    ];

    const missedReasons = [
        { id: 'overslept', label: 'Overslept' },
        { id: 'burnout', label: 'Burnout' },
        { id: 'unexpected_work', label: 'Unexpected Work' },
        { id: 'family_interruption', label: 'Family Interruption' },
        { id: 'mobile_distraction', label: 'Mobile Distraction' },
        { id: 'anxiety_stress', label: 'Anxiety/Stress' },
        { id: 'plan_unrealistic', label: 'Plan Unrealistic' },
        { id: 'shifted_to_another_block', label: 'Shifted to Another Block' },
        { id: 'health_issue', label: 'Health Issue' },
    ];

    const resetState = () => {
        setStep(1);
        setStatus(null);
        setQuality(null);
        setReasonCode(null);
        setCompletionPercent(null);
        setStudiedSomethingElse(false);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const submitSignal = async (payloadExtras) => {
        setBusy(true);
        try {
            const dayKey = new Date().toISOString().slice(0, 10);
            
            const payload = {
                userId: 'moulika', // Default user
                blockId: block.BlockId || null,
                stableBlockId: block.BlockId || null,
                dayKey: dayKey,
                subject: block.PlannedSubject || null,
                topic: block.PlannedTopic || null,
                status: payloadExtras.status || status,
                quality: payloadExtras.quality || quality || null,
                completionPercent: payloadExtras.completionPercent || completionPercent || null,
                reasonCode: payloadExtras.reasonCode || reasonCode || null,
                studiedSomethingElse: payloadExtras.studiedSomethingElse || studiedSomethingElse || false,
                plannedMinutes: Number(block.PlannedMinutes) || 0,
                actualMinutes: Number(block.ActualMinutes) || 0,
            };

            const url = `${BACKEND_URL || ""}/api/behaviour/signals`;
            
            // Best-effort telemetry - do not block lifecycle
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(async (res) => {
                if (!res.ok) console.error("Failed to save behaviour signal", await res.text());
            })
            .catch(err => {
                console.warn("Behaviour signal save failed, continuing stop lifecycle", err);
            });
            
            // Always execute primary block lifecycle (stopBlock)
            if (onSignalSaved) onSignalSaved(payload);
            handleClose();

        } catch (e) {
            console.error("Error saving behaviour signal", e);
            handleClose();
        } finally {
            setBusy(false);
        }
    };

    const handleStatusSelect = (s) => {
        setStatus(s);
        setStep(2);
    };

    const handleQualitySelect = (q) => {
        setQuality(q);
        submitSignal({ status: 'done', quality: q });
    };

    const handlePartialSubmit = (reason, percent) => {
        submitSignal({ status: 'partial', reasonCode: reason, completionPercent: percent });
    };

    const handleMissedSubmit = (reason, somethingElse) => {
        submitSignal({ status: 'missed', reasonCode: reason, studiedSomethingElse: somethingElse });
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000 }} onClick={handleClose}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-card)', position: 'relative', border: '1px solid var(--border-subtle)' }} onClick={(e) => e.stopPropagation()}>
                {busy && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 24, color: 'var(--brand-primary)', fontWeight: 600 }}>Saving...</div>}
                
                {step === 1 && (
                    <>
                        <h2 style={{ margin: '0 0 24px 0', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', textAlign: 'center' }}>How did this block go?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button onClick={() => handleStatusSelect('done')} style={{ padding: 16, background: 'var(--brand-primary)', color: 'white', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, boxShadow: 'none', transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                ✓ Done
                            </button>
                            <button onClick={() => handleStatusSelect('partial')} style={{ padding: 16, background: 'var(--bg-subtle)', color: 'var(--warning)', borderRadius: 14, border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: 16, fontWeight: 700, transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                🟡 Partial
                            </button>
                            <button onClick={() => handleStatusSelect('missed')} style={{ padding: 16, background: 'var(--bg-subtle)', color: 'var(--danger)', borderRadius: 14, border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: 16, fontWeight: 700, transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                ✕ Missed
                            </button>
                            <button onClick={handleClose} style={{ padding: 14, background: 'transparent', color: 'var(--text-secondary)', border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                                Cancel Stop
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && status === 'done' && (
                    <>
                        <h2 style={{ margin: '0 0 24px 0', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', textAlign: 'center' }}>Quality of focus?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button onClick={() => handleQualitySelect('strong')} style={{ padding: 16, background: '#0A64F5', color: 'white', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, boxShadow: '0 4px 12px rgba(10, 100, 245, 0.25)', transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                ⚡ Strong
                            </button>
                            <button onClick={() => handleQualitySelect('normal')} style={{ padding: 16, background: '#F8FAFC', color: 'var(--mos-text)', borderRadius: 14, border: '1px solid var(--mos-border)', cursor: 'pointer', fontSize: 16, fontWeight: 700, transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                👍 Normal
                            </button>
                            <button onClick={() => handleQualitySelect('weak')} style={{ padding: 16, background: '#FEF2F2', color: '#DC2626', borderRadius: 14, border: '1px solid #FECACA', cursor: 'pointer', fontSize: 16, fontWeight: 700, transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                😵 Weak
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && status === 'partial' && (
                    <>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 800, color: 'var(--mos-text)', letterSpacing: '-0.02em' }}>Why partial?</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {partialReasons.map(r => (
                                <button key={r.id} 
                                    onClick={() => setReasonCode(r.id)}
                                    style={{ 
                                        padding: '10px 14px', 
                                        background: reasonCode === r.id ? '#0A64F5' : 'var(--mos-bg-soft)', 
                                        color: reasonCode === r.id ? '#FFFFFF' : 'var(--mos-text)', borderRadius: 20, border: '1px solid var(--mos-border)', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.15s' 
                                    }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {reasonCode && (
                            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--mos-border)' }}>
                                <h3 style={{ color: 'var(--mos-text-soft)', fontSize: 14, marginBottom: 12, fontWeight: 600 }}>Completion %</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {[25, 50, 75].map(pct => (
                                        <button key={pct}
                                            onClick={() => handlePartialSubmit(reasonCode, pct)}
                                            style={{ flex: 1, padding: '14px 12px', background: 'var(--mos-bg-soft)', color: 'var(--mos-text)', borderRadius: 12, border: '1px solid var(--mos-border)', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                                            {pct}%
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {step === 2 && status === 'missed' && (
                    <>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 800, color: 'var(--mos-text)', letterSpacing: '-0.02em' }}>Why missed?</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {missedReasons.map(r => (
                                <button key={r.id} 
                                    onClick={() => setReasonCode(r.id)}
                                    style={{ 
                                        padding: '10px 14px', 
                                        background: reasonCode === r.id ? '#DC2626' : 'var(--mos-bg-soft)', 
                                        color: reasonCode === r.id ? '#FFFFFF' : 'var(--mos-text)', borderRadius: 20, border: '1px solid var(--mos-border)', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.15s' 
                                    }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {reasonCode && (
                            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--mos-border)' }}>
                                <h3 style={{ color: 'var(--mos-text-soft)', fontSize: 14, marginBottom: 12, fontWeight: 600 }}>Did you study something else?</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button onClick={() => handleMissedSubmit(reasonCode, true)} style={{ flex: 1, padding: '14px 12px', background: 'var(--mos-bg-soft)', color: 'var(--mos-text)', borderRadius: 12, border: '1px solid var(--mos-border)', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>Yes</button>
                                    <button onClick={() => handleMissedSubmit(reasonCode, false)} style={{ flex: 1, padding: '14px 12px', background: 'var(--mos-bg-soft)', color: 'var(--mos-text)', borderRadius: 12, border: '1px solid var(--mos-border)', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>No</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
