export default function SyllabusRadar({ radar }) {
    if (!radar) return null;

    return (
        <div className="plan-card">
            <h2 className="plan-card-title">Syllabus Coverage Radar</h2>

            <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                <div>
                    GS1: <b>{radar.GS1 || 0}%</b>
                </div>
                <div>
                    GS2: <b>{radar.GS2 || 0}%</b>
                </div>
                <div>
                    GS3: <b>{radar.GS3 || 0}%</b>
                </div>
                <div>
                    GS4: <b>{radar.GS4 || 0}%</b>
                </div>
                <div>
                    Essay: <b>{radar.ESSAY || 0}%</b>
                </div>
                <div>
                    CSAT: <b>{radar.CSAT || 0}%</b>
                </div>
                <div>
                    Optional: <b>{radar.OPTIONAL || 0}%</b>
                </div>
            </div>
        </div>
    );
}