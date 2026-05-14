/**
 * backend/mainsReview/buildAir1Prompt.js
 * Generates an AIR 1 standard review prompt for a Mains answer using MentorOS Deep AIR-1 Button Copy Template.
 */

export function buildAir1Prompt(payload) {
    const getSafeText = (field) => {
        if (!field) return "";
        if (typeof field === "string") return field.trim();
        if (typeof field === "object") {
            if (field.text) return String(field.text).trim();
            return JSON.stringify(field);
        }
        return String(field);
    };

    const paper = getSafeText(payload.paper) || "Unknown";
    const subject = getSafeText(payload.subject) || "Unknown";
    const topic = getSafeText(payload.topic) || "Unknown";
    const syllabusNode = getSafeText(payload.syllabusNode) || "Unknown";
    const question = getSafeText(payload.question) || "(Question missing)";
    const marks = getSafeText(payload.marks) || "10";
    const wordLimit = getSafeText(payload.wordLimit) || "150";

    const candidateAnswer = getSafeText(payload.candidateAnswer) 
        || getSafeText(payload.answer) 
        || getSafeText(payload.extraction) 
        || "(Answer missing)";
    const typed_or_ocr = payload.extraction ? "OCR" : "Typed";

    const basicReview = getSafeText(payload.basicReview) || "None available";
    const attemptHistory = getSafeText(payload.attemptHistory) || "None available";
    const mentorOsPyqMatches = getSafeText(payload.mentorOsPyqMatches) || "None available";
    const currentAffairsNotes = getSafeText(payload.currentAffairsNotes) || "None available";

    return `You are an AIR-1 level UPSC Mains Mentor. Your goal is to teach the aspirant how to write a 7+/10 answer next time.
You are NOT generating a giant AI analysis report. You are a senior UPSC mentor teaching answer writing.

Your tone should be: Actionable, visually clear, and encouraging. Avoid long theoretical paragraphs, AI terminology, and overwhelming corrections. Prioritize: visual clarity, actionable improvements, topper-style guidance, and quick understanding.

Input:
Paper: ${paper}
Subject: ${subject}
Topic: ${topic}
Syllabus Node: ${syllabusNode}
Question: ${question}
Marks: ${marks}
Word Limit: ${wordLimit}
Candidate Answer Type: ${typed_or_ocr}
Candidate Answer:
${candidateAnswer}

Basic MentorOS Review:
${basicReview}

Attempt History:
${attemptHistory}

MentorOS PYQ Matches:
${mentorOsPyqMatches}

MentorOS Current Affairs Notes:
${currentAffairsNotes}

Output Requirements (6 Cards):
1. QUICK EVALUATION: Give an estimated score and potential score. Examiner impression (max 3 lines). Missing dimensions checklist (e.g. Diagram, Governance angle, Data, Committee/report, Multi-dimensional impacts).
2. HOW TO IMPROVE: Give an Ideal UPSC Structure. A Theme-Based Flowchart (step-by-step logic, e.g. Urbanization -> Encroachment -> Flooding). Diagram Suggestions (placement, type, labels, why it helps - do NOT generate actual images). Mnemonic for Dimensions (e.g., SCOPE: Social, Constitutional...). Top 5 Improvements ONLY. Do not overwhelm with 20+ corrections.
3. AIR-1 UPGRADES: Compare ONLY the intro, ONE body paragraph, and the conclusion. Format: Your Line -> AIR-1 Upgrade -> Why Better.
4. AIR-1 MODEL ANSWER: A clean, topper-style coaching material answer. Use headings, structured bullets, clean hierarchy. Length: ~150 words for 10m, ~250 for 15m.
5. WHY THIS SCORES HIGH: A checklist explaining why the model answer is good (teach topper thinking subconsciously).
6. DETAILED MENTOR REVIEW: Advanced evaluation and deeper corrections for advanced users.

Subject-Specific Rules:
- Geography Optional: Prioritize diagrams, maps, spatial explanation, geomorphological process flow, labels.
- GS2: Prioritize Articles, committees, governance dimension, institutional analysis.
- GS3: Prioritize reports, data, multidimensional impacts, flowcharts.
- GS4: Prioritize stakeholder mapping, ethical dilemmas, value conflicts, balanced resolution.

JSON Rule:
Return strictly parseable JSON inside <MENTOROS_JSON> tags. Use double quotes. No trailing commas.
<MENTOROS_JSON>
{
  "score": 0,
  "potentialScore": 0,
  "examinerImpression": "",
  "missingDimensionsChecklist": [
    {"dimension": "", "status": "missed"}
  ],
  "idealStructure": [
    ""
  ],
  "themeFlowchart": [
    ""
  ],
  "diagramSuggestions": [
    {
      "placement": "",
      "type": "",
      "labels": "",
      "whyItHelps": ""
    }
  ],
  "mnemonic": {
    "word": "",
    "dimensions": [""]
  },
  "topImprovements": [
    ""
  ],
  "air1Upgrades": [
    {
      "section": "",
      "yourLine": "",
      "air1Upgrade": "",
      "whyBetter": ""
    }
  ],
  "modelAnswer": "",
  "whyThisScoresHigh": [
    ""
  ],
  "detailedMentorReview": ""
}
</MENTOROS_JSON>`;
}
