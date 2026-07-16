import { chromium } from 'playwright';
import { join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import * as progressService from './progressService.js';
import * as telegramService from './telegramService.js';
import { formatHoursAndMins, generateMonthlyMentorTextReport, generateCanonicalMonthlyTextReport } from './reportGeneratorService.js';
import { query } from '../db/index.js';
import os from 'os';

export async function generateMonthlyReportHtml(userId, monthKey, dataset = null) {
  // Accept a pre-validated dataset to avoid a second independent execution query.
  // If not provided, fetch it (legacy path for direct HTML generation).
  if (!dataset) {
    dataset = await progressService.getCanonicalMonthlyReportDataset(userId, monthKey);
  }
  const thisMonth = dataset.thisMonth;
  const mtd = dataset.missionToDate;
  
  let monthlySubjectsHtml = '';
  for (const s of thisMonth.subjects) {
    monthlySubjectsHtml += `
      <tr>
        <td>${s.subject}</td>
        <td>${formatHoursAndMins(s.plannedSeconds / 3600)}</td>
        <td>${formatHoursAndMins(s.recordedSeconds / 3600)}</td>
        <td>${formatHoursAndMins(s.pendingSeconds / 3600)}</td>
        <td>${s.completedBlockCount}</td>
        <td>${s.partialBlockCount}</td>
      </tr>
    `;
  }

  let cumulativeSubjectsHtml = '';
  for (const s of mtd.subjects) {
    cumulativeSubjectsHtml += `
      <tr>
        <td>${s.subject}</td>
        <td>${formatHoursAndMins(s.targetHours)}</td>
        <td>${formatHoursAndMins(s.completedHours)}</td>
        <td>${formatHoursAndMins(s.remainingHours)}</td>
        <td>${s.progressPercent}%</td>
      </tr>
    `;
  }
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Monthly Mentor Report</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; background-color: #f9fafb; }
        .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
        h1 { margin: 0; color: #111827; font-size: 28px; }
        h2 { color: #374151; font-size: 20px; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        p { font-size: 16px; line-height: 1.6; color: #4b5563; }
        .stat-box { background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 10px 0; display: inline-block; width: 30%; box-sizing: border-box; }
        .stat-box.large { width: 45%; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .stat-label { font-size: 14px; color: #6b7280; text-transform: uppercase; margin-top: 4px; }
        .flex-container { display: flex; justify-content: space-between; flex-wrap: wrap; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background-color: #f9fafb; font-weight: 600; color: #374151; }
        .prescription { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MentorOS Monthly Report</h1>
          <p>Month: ${monthKey}</p>
        </div>
        
        <h2>Monthly Executive Summary</h2>
        <div class="flex-container">
          <div class="stat-box large">
            <div class="stat-value">${mtd.overallProgressPercent}%</div>
            <div class="stat-label">Mission Progress (3500h)</div>
          </div>
          <div class="stat-box large">
            <div class="stat-value">${thisMonth.plannedSeconds > 0 ? ((thisMonth.recordedSeconds / thisMonth.plannedSeconds) * 100).toFixed(1) : 0}%</div>
            <div class="stat-label">Monthly Execution Rate</div>
          </div>
        </div>

        <h2>Study Days & Consistency</h2>
        <div class="flex-container">
          <div class="stat-box">
            <div class="stat-value">${formatHoursAndMins(thisMonth.plannedSeconds / 3600)}</div>
            <div class="stat-label">Planned Study</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${formatHoursAndMins(thisMonth.recordedSeconds / 3600)}</div>
            <div class="stat-label">Recorded Study</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${thisMonth.activeDaysCount}</div>
            <div class="stat-label">Active Study Days</div>
          </div>
        </div>

        <h2>Planned vs Completed Execution</h2>
        <div class="flex-container">
          <div class="stat-box">
            <div class="stat-value">${thisMonth.completedBlockCount}</div>
            <div class="stat-label">Completed Blocks</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${thisMonth.partialBlockCount}</div>
            <div class="stat-label">Partial Blocks</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${thisMonth.missedBlockCount}</div>
            <div class="stat-label">Missed Blocks</div>
          </div>
        </div>

        <h2>This Month's Subject Performance</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Planned Study</th>
              <th>Recorded Study</th>
              <th>Pending Work</th>
              <th>Completed Blocks</th>
              <th>Partial Blocks</th>
            </tr>
          </thead>
          <tbody>
            ${monthlySubjectsHtml}
          </tbody>
        </table>
 
        <h2>Cumulative Mission Progress (Mission to Date)</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Target Hours</th>
              <th>Completed Hours</th>
              <th>Remaining Target</th>
              <th>Progress %</th>
            </tr>
          </thead>
          <tbody>
            ${cumulativeSubjectsHtml}
          </tbody>
        </table>
 
        <h2>Pending Revisions & Weak Areas</h2>
        <p><strong>Top Weak Areas:</strong> ${dataset.weakAreas.length > 0 ? dataset.weakAreas.join(', ') : 'None detected this month.'}</p>
 
        <div class="prescription">
          <h2>Next Month Directives</h2>
          <p>1. Target Geography Optional deficit blocks to stabilize weekly pacing.<br/>2. Clear the daily pending revision queue to maintain high retention.<br/>3. Restrict consecutive zero-study days to protect the habit streak.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return html;
}

export async function generateMonthlyReportPdf(userId, monthKey) {
  const html = await generateMonthlyReportHtml(userId, monthKey);
  const pdfFileName = `mentoros-monthly-report-${userId}-${monthKey}.pdf`;
  const pdfPath = join(os.tmpdir(), pdfFileName);
  
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });
    return pdfPath;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Internal helper: generates PDF file from a pre-validated dataset
async function generateMonthlyReportPdfFromDataset(userId, monthKey, dataset) {
  const html = await generateMonthlyReportHtml(userId, monthKey, dataset);
  let pdfPath = null;
  let browser = null;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const reportsDir = join(process.cwd(), 'reports');
    if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
    pdfPath = join(reportsDir, `monthly_report_${userId}_${monthKey}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    return pdfPath;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function sendMonthlyPdfReport(userId, monthKey, chatId) {
  let dataset;
  try {
    dataset = await progressService.getCanonicalMonthlyReportDataset(userId, monthKey);
  } catch (err) {
    if (err.message === 'MONTHLY_RECONCILIATION_FAILED') {
      console.error("[monthlyPdfReportService] Monthly report blocked due to reconciliation mismatch.");
      // Reconciliation failure: return not-delivered so the event is NOT recorded as sent.
      // The scheduler will handle sending a deduplicated notice.
      // The next monthly tick will retry once new data is available.
      return { delivered: false, reason: 'RECONCILIATION_FAILED' };
    }
    console.error("[monthlyPdfReportService] Failed to retrieve monthly dataset:", err.message);
    return { delivered: false, reason: 'DATASET_FETCH_ERROR' };
  }

  const thisMonth = dataset.thisMonth;
  if (thisMonth.plannedSeconds === 0 && thisMonth.recordedSeconds === 0) {
    await telegramService.sendTelegramMessage(chatId, "Not enough data yet to generate a monthly PDF report.");
    // Insufficient data: record as delivered so we don't spam user every tick on 1st of month.
    return { delivered: true, reason: 'INSUFFICIENT_DATA' };
  }

  let pdfPath = null;
  try {
    // Use the pre-validated dataset for PDF — no independent study-execution query
    pdfPath = await generateMonthlyReportPdfFromDataset(userId, monthKey, dataset);
    const caption = "📘 Monthly Mentor Report is ready. This is not judgment — this is correction data.";
    const sent = await telegramService.sendTelegramDocument(chatId, pdfPath, caption);
    if (!sent) {
      throw new Error("Telegram document delivery failed (returned false)");
    }
    return { delivered: true, reason: 'PDF_SENT' };
  } catch (pdfErr) {
    console.error("[monthlyPdfReportService] PDF generation/sending failed. Falling back to plain text report. Error:", pdfErr.message);
    
    // Retrieve user's name from database
    let userName = "Moulika";
    try {
      const userRes = await query(`SELECT name FROM public.users WHERE id = $1`, [userId]);
      if (userRes.rows.length > 0 && userRes.rows[0].name) {
        userName = userRes.rows[0].name;
      }
    } catch (dbErr) {
      console.error("[monthlyPdfReportService] Failed to fetch user name, using default. Error:", dbErr.message);
    }

    const textReport = generateCanonicalMonthlyTextReport(dataset, userName);
    const fallbackMessage = `⚠️ *Monthly Report (Text Fallback)*\n_PDF rendering was unavailable, sending plain text fallback._\n\n${textReport}`;
    
    await telegramService.sendTelegramMessage(chatId, fallbackMessage);
    console.log("monthly_report_pdf_failed_text_fallback_sent");
    return { delivered: true, reason: 'TEXT_FALLBACK_SENT' };
  } finally {
    if (pdfPath && existsSync(pdfPath)) {
      try {
        unlinkSync(pdfPath);
      } catch (err) {
        // ignore
      }
    }
  }
}
