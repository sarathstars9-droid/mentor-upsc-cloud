import express from "express";
import { query } from "../db/index.js";
import { fetchPyqsForTopic } from "../services/pyqTopicService.js";

const router = express.Router();

router.get("/command-center", async (req, res) => {
  const { userId, date } = req.query;
  
  if (!userId || !date) {
    return res.status(400).json({ ok: false, message: "Missing userId or date" });
  }
  
  try {
    // 1. Fetch Today's Blocks
    const blocksQuery = `
      SELECT * FROM public.study_blocks 
      WHERE user_id = $1 AND day_key = $2
      ORDER BY created_at ASC
    `;
    const blocksResult = await query(blocksQuery, [userId, date]);
    const rawBlocks = blocksResult.rows || [];
    
    const normalizeBlock = (b) => {
      if (!b) return b;
      return {
        ...b,
        blockId: b.block_id || b.id,
        id: b.id || b.block_id
      };
    };
    
    const blocks = rawBlocks.map(normalizeBlock);
    
    // 2. Fetch Due Revisions
    const revisionsQuery = `
      SELECT * FROM revision_items 
      WHERE user_id = $1 
        AND (status IS NULL OR status NOT IN ('reviewed', 'completed', 'revised', 'done'))
        AND COALESCE(next_review_at, due_date) <= NOW()
      ORDER BY priority DESC, COALESCE(next_review_at, due_date) ASC
    `;
    const revisionsResult = await query(revisionsQuery, [userId]);
    const revisionsDue = revisionsResult.rows || [];
    
    // 3. Fetch Mistakes for Weakness Logic & Must-Revise
    const mistakesQuery = `
      SELECT * FROM mistakes 
      WHERE user_id = $1 
        AND (must_revise = true OR answer_status IS NULL OR answer_status IN ('open', 'pending'))
    `;
    const activeMistakesResult = await query(mistakesQuery, [userId]);
    const activeMistakes = activeMistakesResult.rows || [];
    const mustReviseMistakes = activeMistakes.filter(m => m.must_revise);
    
    // 4. Fetch Last Answer Written
    const lastAnswerQuery = `
      SELECT created_at FROM mains_answers 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const lastAnswerResult = await query(lastAnswerQuery, [userId]);
    const lastAnswer = lastAnswerResult.rows ? lastAnswerResult.rows[0] : null;
    
    // Categorize Blocks
    const activeBlock = blocks.find(b => b.status === 'active');
    const pausedBlock = blocks.find(b => b.status === 'paused');
    const completedBlocks = blocks.filter(b => ['completed', 'done'].includes(b.status));
    const partialBlocks = blocks.filter(b => ['partial', 'incomplete'].includes(b.status));
    const skippedBlocks = blocks.filter(b => ['skipped', 'missed'].includes(b.status));
    const pendingBlocks = blocks.filter(b => ['planned', 'upcoming'].includes(b.status));
    
    // Calculate Overdue Logic using IST
    const nowInIst = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const todayIstDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    let overdueBlocks = [];
    if (date < todayIstDate) {
      overdueBlocks = pendingBlocks;
    } else if (date === todayIstDate) {
      overdueBlocks = pendingBlocks.filter(b => b.planned_start && b.planned_start < nowInIst);
    } // else if date > todayIstDate, no blocks overdue
    
    const overdueBlock = overdueBlocks.length > 0 ? overdueBlocks[0] : null;
    const nextPlannedBlock = pendingBlocks.length > 0 ? pendingBlocks[0] : null;
    const missedBlocksCount = skippedBlocks.length + overdueBlocks.length;
    
    // Priority: paused block acts as overdue
    let topOverdue = pausedBlock || overdueBlock;
    
    // Compute Answer Writing Suggestion Based on Weakest Paper
    const paperMistakeCounts = {};
    activeMistakes.forEach(m => {
      // Paper can be extracted from subject or stage etc.
      let p = (m.subject || m.paper || 'GS1').trim().toLowerCase();
      paperMistakeCounts[p] = (paperMistakeCounts[p] || 0) + 1;
    });
    
    let weakestPaper = null;
    let highestMistakes = -1;
    for (const [p, count] of Object.entries(paperMistakeCounts)) {
      if (count > highestMistakes) {
        highestMistakes = count;
        weakestPaper = p;
      }
    }
    
    let answerSuggestion = null;
    if (weakestPaper) {
      if (weakestPaper.includes('ethics') || weakestPaper === 'gs4' || weakestPaper === 'gs-4') {
        answerSuggestion = { paper: "Ethics", reason: `Ethics has ${highestMistakes} unresolved mistakes. Suggest writing one Ethics case study today.`, route: "/mains" };
      } else if (weakestPaper.includes('essay')) {
        answerSuggestion = { paper: "Essay", reason: `Essay pattern issues detected. Outline one full essay today.`, route: "/mains" };
      } else if (weakestPaper.includes('optional') || weakestPaper.includes('geography')) {
        answerSuggestion = { paper: "Optional", reason: `${weakestPaper.charAt(0).toUpperCase() + weakestPaper.slice(1)} is accumulating mistakes. Drill one optional answer/diagram today.`, route: "/mains" };
      } else {
        const displayPaper = weakestPaper.toUpperCase();
        answerSuggestion = { paper: displayPaper, reason: `Write 1 ${displayPaper} answer today because directive mismatch or content issues are repeating.`, route: "/mains" };
      }
    } else {
      answerSuggestion = { paper: 'GS', reason: 'Write one GS answer today to build consistency.', route: "/mains" };
    }
    
    // EXACT Priority Logic (A to F)
    let command = {};
    let nowTask = null;
    
    if (blocks.length === 0) {
      command = {
        message: "No study plan uploaded for today. Upload your plan to unlock execution tracking.",
        primaryAction: "Upload Plan",
        actionRoute: "/plan"
      };
    } else if (activeBlock) {
      command = {
        message: "You have an active study block running. Maintain focus.",
        primaryAction: "Continue Focus",
        actionRoute: null 
      };
      nowTask = activeBlock;
    } else if (topOverdue) {
      command = {
        message: `Your block "${topOverdue.subject || 'Session'}" is overdue or paused. Start it now.`,
        primaryAction: topOverdue.status === 'paused' ? "Resume Block" : "Start Block",
        actionRoute: null
      };
      nowTask = topOverdue;
    } else if (mustReviseMistakes.length > 0 || revisionsDue.length > 0) {
      command = {
        message: "Start your overdue revision first before tackling new topics.",
        primaryAction: "Open Revision",
        actionRoute: "/revision"
      };
      nowTask = revisionsDue[0] || mustReviseMistakes[0];
    } else if (nextPlannedBlock) {
      command = {
        message: `Your next block is ${nextPlannedBlock.subject || 'Scheduled Session'}${nextPlannedBlock.planned_start ? ` at ${nextPlannedBlock.planned_start}` : ''}.`,
        primaryAction: "Start Block",
        actionRoute: null
      };
      nowTask = nextPlannedBlock;
    } else if (answerSuggestion) {
      command = {
        message: answerSuggestion.reason,
        primaryAction: "Open Answer Writing",
        actionRoute: "/mains"
      };
      nowTask = { title: "Answer Writing Drill", subject: answerSuggestion.paper, status: "pending", planned_minutes: 30 };
    } else {
      command = {
        message: "Ready for the next task.",
        primaryAction: "View Plan",
        actionRoute: "/plan"
      };
    }

    // Guardian Snapshot Risk Level Logic
    let riskLevel = "Low";
    if (missedBlocksCount > 2 || revisionsDue.length > 5 || mustReviseMistakes.length > 5) {
      riskLevel = "High";
    } else if (missedBlocksCount > 0 || revisionsDue.length > 0 || mustReviseMistakes.length > 0) {
      riskLevel = "Medium";
    }
    
    const guardianSnapshot = {
      planUploaded: blocks.length > 0,
      blocksCompleted: completedBlocks.length,
      blocksMissed: missedBlocksCount,
      currentActiveBlock: activeBlock ? activeBlock.subject : null,
      revisionsOverdue: revisionsDue.length,
      mustRevisePending: mustReviseMistakes.length,
      lastAnswerWritten: lastAnswer ? lastAnswer.created_at : null,
      riskLevel
    };

    if (nowTask && (nowTask.topic_id || nowTask.node_id)) {
      try {
        const pyqData = fetchPyqsForTopic(nowTask.topic_id || nowTask.node_id);
        if (pyqData && pyqData.questions && pyqData.questions.length > 0) {
          nowTask.pyqIntelligence = {
            count: pyqData.questions.length,
            lastAskedYear: pyqData.lastAskedYear,
            topicId: pyqData.nodeId,
            questionsPreview: pyqData.questions.slice(0, 2).map(q => ({
              year: q.year,
              text: q.questionText || q.text,
              marks: q.marks || 10
            }))
          };
        }
      } catch (err) {
        console.error("Failed to load PYQ intelligence for nowTask", err);
      }
    }

    return res.json({
      ok: true,
      command,
      nowTask,
      overdue: {
        blocks: overdueBlocks.slice(0, 3),
        revisions: revisionsDue.slice(0, 3),
        mistakes: mustReviseMistakes.slice(0, 3)
      },
      revisionsDue: revisionsDue.slice(0, 3),
      answerSuggestion,
      guardianSnapshot
    });
    
  } catch (error) {
    console.error("[Execution Center] Error:", error);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

export default router;
