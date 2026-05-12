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

    return `You are an AIR-1 level UPSC Mains evaluator, paper-specific mentor, PYQ intelligence analyst, source finder, current affairs linker, and answer rewriter.

Evaluate the answer brutally strictly but realistically. Use the basic MentorOS review as context, but independently verify it. Reward genuinely strong answers fairly. Expose every weakness clearly.

Do not invent fake PYQs, reports, judgments, committees, data, scholars, or sources. If exact information is uncertain, label it as Probable / Needs Verification / Low Confidence. If browsing or verification is available, verify latest current affairs before using them.

Use MentorOS PYQ Matches as the primary PYQ source. Use MentorOS Current Affairs Notes as the primary current-affairs source. If adding any PYQ/current affair from memory or web outside MentorOS data, mark it with confidence and reliability level.

OCR protection: If OCR text appears broken, incomplete, repeated, affected by strike-offs, or missing diagrams/flowcharts, mention OCR confidence and do not penalize the candidate for unclear OCR unless the meaning is genuinely absent.

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

Length Control:
- For 10-marker: keep model answer around 120–150 words.
- For 15-marker: keep model answer around 200–250 words.
- For 20-marker / Optional: keep model answer around 300–350 words unless otherwise specified.
- For Essay: evaluate deeply, but keep rewritten samples controlled unless full essay rewrite is explicitly requested.
- Keep line correction focused only on weak, incorrect, generic, unclear, or high-impact lines.
- Do not over-expand current affairs or PYQ linkage. Give only the most relevant items.
- Keep the review concise. For 10-marker answers, complete the entire review in about 900–1200 words unless the answer is very complex. For 15-marker answers, keep it around 1200–1600 words. Avoid unnecessary expansion.

Now produce:
1. 30-second examiner impression
2. Question Intelligence: syllabus mapping, source finder, PYQ linkage, current affairs linkage
3. Demand decoding
4. Strict score + potential score + answer level
5. Paper-specific marks breakdown
6. Exact reasons marks were lost
7. Weak/incorrect/generic line correction
8. Factual errors
9. Missing dimensions
10. Paper-specific value additions
11. Diagram/map/flowchart suggestions
12. Improved user answer
13. Full AIR-1 model answer
14. Extra value-add notes
15. Read-this-source-next list
16. MentorOS revision tasks
17. Mistake Book entries
18. Next attempt strategy
19. Valid MentorOS JSON output

JSON Rule:
At the end, return machine-readable JSON only between these exact tags. The JSON inside <MENTOROS_JSON> must be valid parseable JSON: no markdown inside JSON, no comments, no trailing commas, double quotes only, numbers for score fields, arrays for list fields.
<MENTOROS_JSON>
{
  "score": 0,
  "potentialScore": 0,
  "level": "",
  "paper": "",
  "subject": "",
  "topic": "",
  "syllabusNode": "",
  "confidenceLevel": "",
  "ocrIssues": [],
  "questionType": [],
  "syllabusMapping": [],
  "questionDemand": [],
  "didAnswerDemand": "",
  "marksBreakdown": [],
  "mistakeTypes": [],
  "factualErrors": [],
  "genericLines": [],
  "missingDimensions": [],
  "valueAdditions": [],
  "diagramSuggestions": [],
  "relatedPYQs": [],
  "sourceFinder": {
    "preparationSource": [],
    "questionSource": [],
    "currentTrigger": [],
    "pyqPatternSource": [],
    "confidence": ""
  },
  "currentAffairsLinks": [],
  "revisionTasks": [],
  "mistakeBookEntries": [],
  "nextAttemptStrategy": "",
  "verificationWarnings": []
}
</MENTOROS_JSON>`;
}
