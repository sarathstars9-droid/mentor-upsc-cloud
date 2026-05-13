
const fs = require('fs');
const file = 'c:/Projects/upsc-mentor-pwa/upsc-mentor-cloud-deploy/upsc-mentor-pwa/src/pages/AnswerWritingPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = '    return (\n        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>';
const index = content.indexOf(targetStr);

if (index === -1) {
    console.log('Target string not found');
    process.exit(1);
}

const before = content.substring(0, index);

const newRender = `
    const isDark = theme === "dark";
    
    const getNextAction = () => {
        if (!sessionStarted) return { text: "Read question and start the attempt timer.", cta: "Start Attempt", action: handleStartSession, primary: true };
        if (!hasPages) return { text: "Upload photos of your handwritten answer pages.", cta: "Upload Pages", action: () => fileInputRef.current?.click(), primary: true };
        if (!hasPastedText) return { text: "Extract text from pages or paste manually.", cta: "Prepare Text", action: handleExtractAnswer, primary: true };
        if (!hasEvaluationText) return { text: "Run basic evaluation to get initial scores.", cta: "Evaluate Answer", action: handleBasicReview, primary: true };
        if (!parsedAir1Json && !air1ReviewText) return { text: "Copy prompt, run in ChatGPT, and paste AIR-1 review.", cta: "Generate AIR-1 Prompt", action: handleCopyReviewPrompt, primary: true };
        if (!saved) return { text: "Finalize this attempt to save intelligence to your profile.", cta: "Finalize Attempt", action: handleSave, primary: true };
        return { text: "Attempt completed successfully. Great job!", cta: "Next Question", action: handleNext, primary: false };
    };

    const nextAction = getNextAction();

    return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>
            
            {/* 1. Premium Header */}
            <div style={{
                borderBottom: \`1px solid \${T.borderMid}\`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(248, 250, 252, 0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 30
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: T.subtle, cursor: "pointer", fontSize: 20 }}>←</button>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: T.textBright }}>Mains Answer Review</div>
                        <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Write, evaluate, improve, and save intelligence from every answer.</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <StatusChip status={pageStatus} />
                    <button onClick={toggleTheme} style={{ background: T.surfaceHigh, border: \`1px solid \${T.borderMid}\`, color: T.textBright, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                        {isDark ? "☀️ Light" : "🌙 Dark"}
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
                
                {/* 2. Hero Summary Card */}
                {sessionStarted && (
                    <div style={{ background: T.surface, border: \`1px solid \${T.border}\`, borderRadius: 16, padding: 24, marginBottom: 32, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "center", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                        <div style={{ display: "flex", gap: 32 }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase" }}>Current Score</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: hasEvaluationText ? T.primaryAccent : T.dim }}>{parsedAir1Json?.score || (hasEvaluationText ? "?" : "—")}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase" }}>Target Score</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: T.textBright }}>{parsedAir1Json?.potentialScore || (hasEvaluationText ? "?" : "—")}</div>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 280, padding: "0 24px", borderLeft: \`1px solid \${T.borderMid}\`, borderRight: \`1px solid \${T.borderMid}\` }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.purple, textTransform: "uppercase", marginBottom: 8 }}>Examiner Impression</div>
                            <div style={{ fontSize: 14, color: parsedAir1Json?.examinerImpression ? T.textBright : T.dim, fontStyle: "italic", lineHeight: 1.5 }}>
                                {parsedAir1Json?.examinerImpression ? \`"\${parsedAir1Json.examinerImpression}"\` : "Awaiting detailed AIR-1 evaluation..."}
                            </div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 240 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8 }}>Next Action</div>
                            <button onClick={nextAction.action} style={{ background: nextAction.primary ? T.primaryAccent : T.surfaceHigh, color: nextAction.primary ? "#fff" : T.textBright, border: \`1px solid \${nextAction.primary ? T.primaryAccent : T.borderMid}\`, padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", width: "100%", transition: "all 0.2s" }}>
                                {nextAction.cta}
                            </button>
                            <div style={{ fontSize: 11, color: T.dim, marginTop: 8 }}>{nextAction.text}</div>
                        </div>
                    </div>
                )}

                {/* 3. Two-Column Layout */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>
                    
                    {/* Left Column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
                        
                        {/* Question Card */}
                        <SectionCard accentTop={T.primaryAccent}>
                            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "4px 10px", borderRadius: 6 }}>{SESSION.paper}</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "4px 10px", borderRadius: 6 }}>{marks} Marks</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "4px 10px", borderRadius: 6 }}>{wordTarget} Words</span>
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: T.textBright, lineHeight: 1.6 }}>{SESSION.question}</div>
                                {!sessionStarted && (
                                    <button onClick={handleStartSession} style={{ background: T.primaryAccent, color: "#fff", padding: "12px 24px", borderRadius: 8, fontWeight: 800, border: "none", cursor: "pointer", width: "fit-content", marginTop: 8 }}>
                                        Start Attempt Timer
                                    </button>
                                )}
                            </div>
                        </SectionCard>

                        {/* Candidate Answer Card */}
                        {sessionStarted && (
                            <SectionCard accentTop={T.blue}>
                                <div style={{ padding: 24 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 16 }}>Your Answer</div>
                                    
                                    {/* Uploading */}
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span style={{ fontSize: 12, color: T.dim, fontWeight: 600 }}>Pages ({uploadedPages.length}/{MAX_PAGES})</span>
                                            {hasPages && <button onClick={handleClearAll} style={{ background: "none", border: "none", color: T.red, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Clear All</button>}
                                        </div>
                                        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
                                            {uploadedPages.map((pg, i) => (
                                                <div key={i} style={{ width: 100, height: 140, background: T.surfaceHigh, border: \`1px solid \${T.borderMid}\`, borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                                                    <img src={pg.preview} alt={\`Page \${i+1}\`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    <button onClick={() => handleRemovePage(i)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 10, cursor: "pointer" }}>✕</button>
                                                </div>
                                            ))}
                                            {uploadedPages.length < MAX_PAGES && (
                                                <div onClick={() => fileInputRef.current?.click()} style={{ width: 100, height: 140, background: T.surfaceHigh, border: \`2px dashed \${T.borderMid}\`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: T.subtle, fontSize: 24 }}>+</div>
                                            )}
                                        </div>
                                        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                                    </div>

                                    {/* Text Extraction */}
                                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                        <button onClick={handleExtractAnswer} disabled={!hasPages || isExtracting} style={{ flex: 1, background: T.surfaceHigh, color: T.textBright, border: \`1px solid \${T.borderMid}\`, padding: "10px", borderRadius: 8, fontWeight: 700, cursor: hasPages ? "pointer" : "not-allowed" }}>
                                            {isExtracting ? "Extracting..." : "Auto-Extract Text"}
                                        </button>
                                    </div>
                                    <textarea
                                        value={pastedText}
                                        onChange={(e) => { setPastedText(e.target.value); setSaved(false); }}
                                        rows={8}
                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: \`1px solid \${T.borderMid}\`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                        placeholder="Your answer text..."
                                    />
                                    <div style={{ fontSize: 12, color: T.dim, marginTop: 8 }}>Words: {wordCount} / {wordTarget}</div>
                                </div>
                            </SectionCard>
                        )}

                        {/* Basic Review Card */}
                        {hasPastedText && (
                            <SectionCard accentTop={T.amber}>
                                <div style={{ padding: 24 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>Basic Evaluation</div>
                                        <button onClick={handleBasicReview} disabled={isEvaluating} style={{ background: T.surfaceHigh, border: \`1px solid \${T.borderMid}\`, color: T.textBright, padding: "6px 12px", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                                            {isEvaluating ? "Evaluating..." : "Run Evaluation"}
                                        </button>
                                    </div>
                                    <textarea
                                        value={evaluationText}
                                        onChange={(e) => setEvaluationText(e.target.value)}
                                        rows={6}
                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: \`1px solid \${T.borderMid}\`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                        placeholder="Basic evaluation report..."
                                    />
                                </div>
                            </SectionCard>
                        )}

                        {/* Advanced AIR-1 Review Card */}
                        {hasEvaluationText && (
                            <SectionCard accentTop={T.purple}>
                                <div style={{ padding: 24 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 16 }}>Advanced AIR-1 Review</div>
                                    <MainsReviewPromptCard
                                        currentQuestion={{ text: SESSION.question, marks: parseInt(SESSION.marks), paper: SESSION.paper, topic: topic, syllabusNode: syllabusNodeId }}
                                        finalAnswerText={finalAnswerText}
                                        papersAccent={paperAccent}
                                        wordTarget={wordTarget}
                                        onCopyPrompt={handleCopyReviewPrompt}
                                        onOpenChatGPT={handleOpenChatGPTReview}
                                        canCopyReviewPrompt={canCopyReviewPrompt}
                                        promptCopied={reviewPromptCopied}
                                    />
                                    <div style={{ marginTop: 24 }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, marginBottom: 8, textTransform: "uppercase" }}>Import AIR-1 Output</div>
                                        <textarea
                                            value={air1JsonText || air1ReviewText}
                                            onChange={(e) => handleAir1ReviewChange(e.target.value)}
                                            rows={6}
                                            style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: \`1px solid \${air1ReviewText.trim() ? T.purple : T.borderMid}\`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                            placeholder="Paste ChatGPT result..."
                                        />
                                    </div>
                                    {parsedAir1Json && (
                                        <button onClick={() => setReviewModeActive(true)} style={{ background: T.purple, color: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", fontWeight: 800, cursor: "pointer", width: "100%", marginTop: 16, fontSize: 15 }}>
                                            View Premium Report
                                        </button>
                                    )}
                                </div>
                            </SectionCard>
                        )}
                        
                    </div>

                    {/* Right Column: Sticky Panel */}
                    <div style={{ position: "sticky", top: 100, display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
                        {sessionStarted && (
                            <div style={{ background: T.surface, border: \`1px solid \${T.border}\`, borderRadius: 16, overflow: "hidden", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                                <Timer key={currentIndex} marks={marks} accent={paperAccent} autoStart={sessionStarted} timerRef={timerSectionRef} onStatusChange={setTimerStatus} />
                            </div>
                        )}
                        <div style={{ background: T.surface, border: \`1px solid \${T.border}\`, borderRadius: 16, padding: 24, boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.textBright, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: saved ? T.green : T.amber }}></span>
                                Attempt Intelligence
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>Words</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{wordCount} / {wordTarget}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>Pages</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{uploadedPages.length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>State</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{saved ? "Finalized" : "Draft"}</span>
                                </div>
                            </div>
                            
                            {parsedAir1Json?.whyMarksLost && (
                                <div style={{ marginTop: 24, paddingTop: 16, borderTop: \`1px solid \${T.borderMid}\` }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, marginBottom: 12, textTransform: "uppercase" }}>Top Weaknesses</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {parsedAir1Json.whyMarksLost.slice(0, 3).map((w, i) => (
                                            <div key={i} style={{ fontSize: 13, color: T.textBright, lineHeight: 1.4, display: "flex", gap: 8 }}>
                                                <span style={{ color: T.red, flexShrink: 0 }}>•</span> <span>{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 24 }}>
                                <button onClick={handleSave} disabled={!hasPastedText || saved} style={{ background: saved ? T.green : T.textBright, color: saved ? "#fff" : "#000", border: "none", padding: "12px", borderRadius: 8, fontWeight: 800, cursor: hasPastedText && !saved ? "pointer" : "not-allowed", width: "100%", fontSize: 14 }}>
                                    {saved ? "✓ Finalized" : "💾 Finalize Attempt"}
                                </button>
                                {!saved && <div style={{ fontSize: 11, color: T.dim, marginTop: 8, textAlign: "center" }}>Saves answer to your timeline.</div>}
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
    );
}
`

const newContent = before + newRender + '\n';
fs.writeFileSync(file, newContent);
console.log('Successfully updated file.');
