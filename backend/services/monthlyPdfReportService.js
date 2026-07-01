import { chromium } from 'playwright';
import { join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import * as progressService from './progressService.js';
import * as telegramService from './telegramService.js';
import { formatHoursAndMins, generateMonthlyMentorTextReport } from './reportGeneratorService.js';
import { query } from '../db/index.js';
import os from 'os';

export async function generateMonthlyReportHtml(userId, monthKey) {
  const summary = await progressService.getMonthlyMentorSummary(userId);
  // Optional: fetch extra data for more detail
  const allSubjects = await progressService.getAllSubjectProgress(userId);
  
  let subjectsHtml = '';
  for (const s of allSubjects) {
    subjectsHtml += `
      <tr>
        <td>${s.subject}</td>
        <td>${formatHoursAndMins(s.target_hours)}</td>
        <td>${formatHoursAndMins(s.completed_hours)}</td>
        <td>${formatHoursAndMins(s.remaining_hours)}</td>
        <td>${s.completion_percent}%</td>
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
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
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
        
        <div class="flex-container">
          <div class="stat-box large">
            <div class="stat-value">${summary.mission_completed_percent}%</div>
            <div class="stat-label">Mission Progress (3500h)</div>
          </div>
          <div class="stat-box large">
            <div class="stat-value">${summary.execution_rate}%</div>
            <div class="stat-label">Monthly Execution Rate</div>
          </div>
        </div>
 
        <div class="flex-container">
          <div class="stat-box">
            <div class="stat-value">${formatHoursAndMins(summary.total_planned_hours)}</div>
            <div class="stat-label">Planned Hours</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${formatHoursAndMins(summary.total_actual_hours)}</div>
            <div class="stat-label">Executed Hours</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${summary.strong_days}</div>
            <div class="stat-label">Strong Days</div>
          </div>
        </div>
 
        <h2>Subject Breakdown & Targets</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Target</th>
              <th>Completed</th>
              <th>Remaining</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            ${subjectsHtml}
          </tbody>
        </table>
 
        <h2>Backlog & Weak Areas</h2>
        <p><strong>Top Weak Areas:</strong> ${summary.top3_weak.length > 0 ? summary.top3_weak.join(', ') : 'None detected this month.'}</p>
 
        <div class="prescription">
          <h2>Next Month Prescription</h2>
          <p>${summary.next_month_prescription}</p>
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

export async function sendMonthlyPdfReport(userId, monthKey, chatId) {
  let summary;
  try {
    summary = await progressService.getMonthlyMentorSummary(userId);
  } catch (err) {
    console.error("[monthlyPdfReportService] Failed to retrieve monthly summary:", err.message);
    return;
  }

  if (summary.total_planned_hours === 0 && summary.total_actual_hours === 0) {
    await telegramService.sendTelegramMessage(chatId, "Not enough data yet to generate a monthly PDF report.");
    return;
  }

  let pdfPath = null;
  try {
    pdfPath = await generateMonthlyReportPdf(userId, monthKey);
    const caption = "📘 Monthly Mentor Report is ready. This is not judgment — this is correction data.";
    const sent = await telegramService.sendTelegramDocument(chatId, pdfPath, caption);
    if (!sent) {
      throw new Error("Telegram document delivery failed (returned false)");
    }
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

    const textReport = generateMonthlyMentorTextReport(summary, userName);
    const fallbackMessage = `⚠️ *Monthly Report (Text Fallback)*\n_PDF rendering was unavailable, sending plain text fallback._\n\n${textReport}`;
    
    await telegramService.sendTelegramMessage(chatId, fallbackMessage);
    console.log("monthly_report_pdf_failed_text_fallback_sent");
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
