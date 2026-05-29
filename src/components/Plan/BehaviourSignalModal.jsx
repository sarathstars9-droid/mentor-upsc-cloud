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
        <div className="focus-overlay" onClick={handleClose}>
            <div className="focus-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                {busy && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Saving...</div>}
                
                {step === 1 && (
                    <>
                        <h2 className="focus-title">How did this block go?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                            <button onClick={() => handleStatusSelect('done')} style={{ padding: 16, background: '#059669', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>
                                ✅ Done
                            </button>
                            <button onClick={() => handleStatusSelect('partial')} style={{ padding: 16, background: '#D97706', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>
                                🟡 Partial
                            </button>
                            <button onClick={() => handleStatusSelect('missed')} style={{ padding: 16, background: '#DC2626', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>
                                ❌ Missed
                            </button>
                            <button onClick={handleClose} style={{ padding: 12, background: 'transparent', color: '#94A3B8', border: '1px solid #475569', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 'bold', marginTop: 8 }}>
                                Cancel Stop
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && status === 'done' && (
                    <>
                        <h2 className="focus-title">Quality of focus?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                            <button onClick={() => handleQualitySelect('strong')} style={{ padding: 16, background: '#3B82F6', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>
                                ⚡ Strong
                            </button>
                            <button onClick={() => handleQualitySelect('normal')} style={{ padding: 16, background: '#6B7280', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>
                                👍 Normal
                            </button>
                            <button onClick={() => handleQualitySelect('weak')} style={{ padding: 16, background: '#4B5563', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>
                                😵 Weak
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && status === 'partial' && (
                    <>
                        <h2 className="focus-title">Why partial?</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
                            {partialReasons.map(r => (
                                <button key={r.id} 
                                    onClick={() => setReasonCode(r.id)}
                                    style={{ 
                                        padding: '8px 12px', 
                                        background: reasonCode === r.id ? '#D97706' : '#334155', 
                                        color: 'white', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13 
                                    }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {reasonCode && (
                            <div style={{ marginTop: 24 }}>
                                <h3 style={{ color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>Completion %</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {[25, 50, 75].map(pct => (
                                        <button key={pct}
                                            onClick={() => handlePartialSubmit(reasonCode, pct)}
                                            style={{ flex: 1, padding: 12, background: '#475569', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
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
                        <h2 className="focus-title">Why missed?</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
                            {missedReasons.map(r => (
                                <button key={r.id} 
                                    onClick={() => setReasonCode(r.id)}
                                    style={{ 
                                        padding: '8px 12px', 
                                        background: reasonCode === r.id ? '#DC2626' : '#334155', 
                                        color: 'white', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13 
                                    }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {reasonCode && (
                            <div style={{ marginTop: 24 }}>
                                <h3 style={{ color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>Did you study something else?</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button onClick={() => handleMissedSubmit(reasonCode, true)} style={{ flex: 1, padding: 12, background: '#475569', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Yes</button>
                                    <button onClick={() => handleMissedSubmit(reasonCode, false)} style={{ flex: 1, padding: 12, background: '#475569', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>No</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
