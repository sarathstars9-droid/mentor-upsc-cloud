import React, { useState } from "react";
import { fetchWithAuth } from "../../utils/auth";
import { theme } from "../../theme/theme";

export default function StaleRecoveryModal({ isOpen, staleBlock, onClose, onRecovered }) {
  const [minutes, setMinutes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !staleBlock) return null;

  const handleRecover = async (resolution) => {
    setIsSubmitting(true);
    setError("");
    
    let actualMin = 0;
    if (resolution === 'user_confirmed') {
      actualMin = parseInt(minutes, 10);
      if (isNaN(actualMin) || actualMin < 0) {
        setError("Please enter a valid number of minutes.");
        setIsSubmitting(false);
        return;
      }
      if (actualMin > staleBlock.thresholdMinutes) {
        setError(`Minutes cannot exceed the maximum threshold of ${staleBlock.thresholdMinutes}.`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetchWithAuth(`/api/plan/blocks/${staleBlock.blockId}/recover-stale-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualMinutes: actualMin, resolution })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "Failed to recover session");
      } else {
        onRecovered();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const elapsedHours = (staleBlock.elapsedMinutes / 60).toFixed(1);

  return (
    <div className="focus-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="focus-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 450, padding: 24, textAlign: 'center' }}
      >
        <h2 style={{ margin: "0 0 16px", color: theme.colors.textHighlight, fontSize: 22 }}>Session Recovery Required</h2>
        
        <p style={{ margin: "0 0 16px", color: theme.colors.textSecondary, fontSize: 15, lineHeight: 1.5 }}>
          MentorOS found an earlier study session that remained open much longer than expected. Please confirm the actual focused study time before continuing.
        </p>

        <div style={{ background: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 8, marginBottom: 20, textAlign: 'left' }}>
          <div style={{ marginBottom: 8 }}><span style={{ color: theme.colors.textSecondary }}>Block ID:</span> {staleBlock.blockId || staleBlock.BlockId}</div>
          <div style={{ marginBottom: 8 }}><span style={{ color: theme.colors.textSecondary }}>Started At:</span> {new Date(staleBlock.startedAt || staleBlock.ActualStart).toLocaleString()}</div>
          <div style={{ marginBottom: 8 }}><span style={{ color: theme.colors.textSecondary }}>Session Open For:</span> {((staleBlock.sessionAgeMinutes || staleBlock.StaleSessionAgeMinutes || 0) / 60).toFixed(1)} hours</div>
          <div style={{ marginBottom: 8 }}><span style={{ color: theme.colors.textSecondary }}>Focused Elapsed:</span> {staleBlock.focusedElapsedMinutes || staleBlock.StaleFocusedElapsedMinutes} minutes</div>
          <div><span style={{ color: theme.colors.textSecondary }}>Planned:</span> {staleBlock.plannedMinutes || staleBlock.PlannedMinutes} minutes</div>
        </div>

        {error && <div style={{ color: theme.colors.danger, marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              type="number"
              placeholder="Actual study minutes..."
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={isSubmitting}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                padding: "12px 16px",
                color: "white",
                fontSize: 16
              }}
            />
            <button 
              disabled={isSubmitting}
              onClick={() => handleRecover('user_confirmed')}
              style={{
                background: theme.colors.success,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: "0 20px",
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              Confirm
            </button>
          </div>
          
          <button 
            disabled={isSubmitting}
            onClick={() => handleRecover('abandoned')}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: "12px 16px",
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            Mark as Abandoned (0 minutes)
          </button>
          
          <button 
            disabled={isSubmitting}
            onClick={onClose}
            style={{
              background: "transparent",
              color: theme.colors.textSecondary,
              border: 'none',
              padding: "8px",
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              textDecoration: 'underline'
            }}
          >
            Cancel and resolve later
          </button>
        </div>
      </div>
    </div>
  );
}
