import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function StopConfirmModal({
  open,
  block,
  onConfirm,
  onCancel,
}) {
  const modalRef = useRef(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          onCancelRef.current && onCancelRef.current();
        }
      };
      document.addEventListener("keydown", handleKeyDown);

      let handleTab;
      const currentModal = modalRef.current;
      
      if (currentModal) {
        const focusableElements = currentModal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          handleTab = (e) => {
            if (e.key === "Tab") {
              if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                  lastElement.focus();
                  e.preventDefault();
                }
              } else {
                if (document.activeElement === lastElement) {
                  firstElement.focus();
                  e.preventDefault();
                }
              }
            }
          };
          currentModal.addEventListener("keydown", handleTab);
        }
      }

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        if (currentModal && handleTab) {
          currentModal.removeEventListener("keydown", handleTab);
        }
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open || !block) return null;

  const handleConfirm = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    onConfirm();
  };

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.72)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    zIndex: 999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px"
  };

  const modalStyle = {
    position: "relative",
    zIndex: 1000000,
    width: "100%",
    maxWidth: "560px",
    background: "linear-gradient(145deg, #101827, #0b1220)",
    border: "1px solid var(--mo-border-amber)",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "var(--mo-shadow-premium), var(--mo-shadow-amber)",
    margin: "auto",
    color: "var(--mo-text)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center"
  };

  const subjectText = block?.PlannedSubject || "Study Block";

  return createPortal(
    <div style={overlayStyle} onClick={onCancel}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex="-1"
      >
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "rgba(245,158,11,0.15)",
          color: "#f59e0b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          marginBottom: "20px",
          border: "1px solid rgba(245,158,11,0.3)"
        }}>
          ⏸
        </div>

        <h2 style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 16px 0", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          End current session?
        </h2>

        <div style={{ fontSize: "16px", color: "var(--mo-text-soft)", lineHeight: 1.5, marginBottom: "32px", maxWidth: "420px" }}>
          You are about to stop the active <strong>{subjectText}</strong> block. Your progress will be saved.
        </div>

        <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "center" }}>
          <button 
            style={{ 
              flex: 1, 
              padding: "14px 20px", 
              borderRadius: "14px", 
              background: "rgba(255,255,255,0.06)", 
              color: "var(--mo-text-soft)", 
              border: "1px solid var(--mo-border)", 
              fontWeight: 600, 
              cursor: "pointer", 
              fontSize: "16px",
              transition: "all 0.2s"
            }} 
            onClick={onCancel}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--mo-text)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--mo-text-soft)"; }}
          >
            Continue Session
          </button>
          
          <button 
            style={{ 
              flex: 1, 
              padding: "14px 20px", 
              borderRadius: "14px", 
              background: "linear-gradient(135deg, var(--mo-danger), #dc2626)", 
              color: "#fff", 
              border: "none", 
              fontWeight: 700, 
              cursor: "pointer", 
              fontSize: "16px",
              boxShadow: "0 12px 35px rgba(239, 68, 68, 0.25)",
              transition: "transform 0.1s"
            }} 
            onClick={handleConfirm}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            End Session
          </button>
        </div>

        <div style={{ marginTop: "20px", fontSize: "13px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
          Esc to continue
        </div>
      </div>
    </div>,
    document.body
  );
}