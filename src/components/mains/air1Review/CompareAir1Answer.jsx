import React, { useState } from "react";

const T = { border: "#1f1f23", text: "#e4e4e7", dim: "#9ca3af" };

function CompareAir1Answer({ air1Answer = {} }) {
    const { intro = "", body = [], conclusion = "" } = air1Answer;
    const [open, setOpen] = useState(false);

    return (
        <div style={{ background: "#0b0b0d", border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: T.text }}>AIR-1 Model Answer (collapsed)</div>
                <button onClick={() => setOpen(!open)} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${T.border}`, color: T.dim }}>{open ? "Hide" : "Show"}</button>
            </div>

            {open && (
                <div style={{ marginTop: 10, color: T.text }}>
                    {intro && (
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: T.dim, fontWeight: 800 }}>Intro</div>
                            <div style={{ marginTop: 6 }}>{intro}</div>
                        </div>
                    )}

                    {body && body.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: T.dim, fontWeight: 800 }}>Body</div>
                            <ol style={{ marginTop: 6, paddingLeft: 18 }}>
                                {body.map((b, i) => (
                                    <li key={i} style={{ marginBottom: 6 }}>{b}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {conclusion && (
                        <div>
                            <div style={{ fontSize: 12, color: T.dim, fontWeight: 800 }}>Conclusion</div>
                            <div style={{ marginTop: 6 }}>{conclusion}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default CompareAir1Answer;
