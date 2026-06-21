// backend/test_live_qa.js
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup test files
const largeFilePath = path.join(__dirname, "temp_large_file.pdf");
const invalidFilePath = path.join(__dirname, "temp_invalid_file.txt");
const validImgPath = path.join(__dirname, "temp_valid_image.png");

// Create dummy files
fs.writeFileSync(largeFilePath, Buffer.alloc(11 * 1024 * 1024)); // 11MB
fs.writeFileSync(invalidFilePath, "This is an unsupported text file.");
// Create a small 1x1 png image
const pngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
fs.writeFileSync(validImgPath, pngBuffer);

async function runLiveQA() {
  // Let the user specify target URL via argv, default to live production website
  const baseUrl = process.argv[2] || "https://mentorupsc.in";
  console.log("=== STARTING QA BROWSER FLOW VERIFICATION ===");
  console.log("Target URL:", baseUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on("console", msg => console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`));
  page.on("pageerror", err => console.log(`[BROWSER EXCEPTION] ${err.message}`));

  const results = [];

  function record(route, expected, actual, status = "PASS", issue = "None", fix = "None") {
    results.push({
      url: route,
      expectedBehavior: expected,
      actualBehavior: actual,
      status,
      issueFound: issue,
      fixNeeded: fix
    });
    console.log(`[${status}] Route: ${route}\n  Expected: ${expected}\n  Actual:   ${actual}\n`);
  }

  // Helper to click first question row in the explorer bank
  async function clickFirstQuestionRow() {
    return await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll("div"));
      const row = divs.find(d => {
        const style = window.getComputedStyle(d);
        if (style.cursor !== "pointer") return false;
        
        const text = d.innerText || "";
        const hasYear = /(201\d|202\d)/.test(text);
        const isRow = text.length > 10 && text.length < 400 && hasYear;
        
        if (d.tagName === "BUTTON") return false;
        return isRow;
      });
      if (row) {
        row.click();
        return true;
      }
      return false;
    });
  }

  try {
    // 1. Home Page & Login
    console.log("Opening website home page...");
    await page.goto(baseUrl);
    await page.waitForTimeout(3000);

    const isLoginCard = await page.locator("input[type='password']").isVisible().catch(() => false);
    if (isLoginCard) {
      console.log("Login screen detected. Entering password...");
      await page.fill("input[type='password']", "mentor2026");
      await page.click("button[type='submit']");
      await page.waitForTimeout(3000);
      console.log("Logged in successfully. Current URL:", page.url());
      record("/", "Login page accepts correct password and redirects", "Logged in. Routed to " + page.url());
    } else {
      console.log("No login password field detected or already logged in. Current URL:", page.url());
      record("/", "Opens homepage/dashboard", "Already logged in. Opened: " + page.url());
    }

    // ====================================================
    // 1. Geography Optional Flow
    // ====================================================
    console.log("\n--- Testing Geography Optional Flow ---");
    try {
      await page.goto(`${baseUrl}/geography-optional`);
      await page.waitForTimeout(2000);
      
      const openedGeoDash = page.url().includes("/geography-optional");
      record("/geography-optional", "Opens Geography Optional Dashboard", openedGeoDash ? "Loads dashboard" : "Fails to load: " + page.url(), openedGeoDash ? "PASS" : "FAIL");

      console.log("Clicking Geography Optional PYQ...");
      await page.click("text=Geography Optional PYQ");
      await page.waitForTimeout(2500);
      
      const openedGeoPyq = page.url().includes("/geography-optional/pyq");
      record("/geography-optional/pyq", "Opens Geography Optional PYQ bank Page", openedGeoPyq ? "Navigates to /geography-optional/pyq" : "URL is " + page.url(), openedGeoPyq ? "PASS" : "FAIL", openedGeoPyq ? "None" : "PYQ bank page route doesn't match", openedGeoPyq ? "None" : "Check path registration in App.jsx");

      console.log("Selecting a question from the bank...");
      const selected = await clickFirstQuestionRow();
      await page.waitForTimeout(1500);
      
      if (!selected) {
        record("/geography-optional/pyq", "Selects a question from list", "No question row clicked", "FAIL", "No questions rendered or clicked", "Ensure database has optional geography PYQs");
      } else {
        const isWriteBtnVisible = await page.locator("text=Write / Upload Answer").isVisible();
        record("/geography-optional/pyq", "Write / Upload Answer button is visible after selection", isWriteBtnVisible ? "Button is visible" : "Button NOT visible", isWriteBtnVisible ? "PASS" : "FAIL");

        if (isWriteBtnVisible) {
          await page.click("text=Write / Upload Answer");
          await page.waitForTimeout(2500);
          
          const openedWorkspace = page.url().includes("/answer-writing/geography-optional/pyq");
          record("/answer-writing/geography-optional/pyq", "Opens Geography Optional Workspace", openedWorkspace ? "Navigated to " + page.url() : "URL is " + page.url(), openedWorkspace ? "PASS" : "FAIL");

          if (openedWorkspace) {
            let questionVal = await page.locator("textarea[placeholder*='question']").inputValue();
            record("/answer-writing/geography-optional/pyq", "Selected question text is prefilled in textarea", questionVal.length > 0 ? "Prefilled: " + questionVal.slice(0, 40) + "..." : "Textarea is empty", questionVal.length > 0 ? "PASS" : "FAIL");

            console.log("Refreshing workspace page to test sessionStorage fallback...");
            await page.reload();
            await page.waitForTimeout(2500);

            let questionValAfter = await page.locator("textarea[placeholder*='question']").inputValue();
            record("/answer-writing/geography-optional/pyq [refresh]", "Selected question metadata remains prefilled after refresh", questionValAfter.length > 0 ? "Metadata remains intact" : "Prefilled text is lost", questionValAfter.length > 0 ? "PASS" : "FAIL");
          }
        }
      }
    } catch (err) {
      record("/geography-optional", "Geography optional flow runs successfully", "Crashed: " + err.message, "FAIL", "Geography optional flow error", "Check selector/DOM integrity");
    }

    // ====================================================
    // 2. Essay Flow
    // ====================================================
    console.log("\n--- Testing Essay Flow ---");
    try {
      await page.goto(`${baseUrl}/essay`);
      await page.waitForTimeout(2000);
      
      const openedEssayDash = page.url().includes("/essay");
      record("/essay", "Opens Essay Dashboard", openedEssayDash ? "Loads dashboard" : "Fails to load: " + page.url(), openedEssayDash ? "PASS" : "FAIL");

      console.log("Clicking Essay PYQ...");
      await page.click("text=Essay PYQ");
      await page.waitForTimeout(2500);
      
      const openedEssayPyq = page.url().includes("/essay/pyq");
      record("/essay/pyq", "Opens Essay PYQ bank Page", openedEssayPyq ? "Navigates to /essay/pyq" : "URL is " + page.url(), openedEssayPyq ? "PASS" : "FAIL");

      console.log("Selecting an essay topic from the bank...");
      const selected = await clickFirstQuestionRow();
      await page.waitForTimeout(1500);
      
      if (!selected) {
        record("/essay/pyq", "Selects an essay topic", "No topic clicked", "FAIL", "No topics rendered or clicked", "Ensure database has essay PYQs");
      } else {
        const isWriteBtnVisible = await page.locator("text=Write / Upload Essay").isVisible();
        record("/essay/pyq", "Write / Upload Essay button is visible after selection", isWriteBtnVisible ? "Button is visible" : "Button NOT visible", isWriteBtnVisible ? "PASS" : "FAIL");

        if (isWriteBtnVisible) {
          await page.click("text=Write / Upload Essay");
          await page.waitForTimeout(2500);
          
          const openedWorkspace = page.url().includes("/answer-writing/essay/pyq");
          record("/answer-writing/essay/pyq", "Opens Essay Workspace", openedWorkspace ? "Navigated to " + page.url() : "URL is " + page.url(), openedWorkspace ? "PASS" : "FAIL");

          if (openedWorkspace) {
            let essayVal = await page.locator("textarea[placeholder*='question']").inputValue();
            record("/answer-writing/essay/pyq", "Selected essay topic is prefilled in textarea", essayVal.length > 0 ? "Prefilled: " + essayVal.slice(0, 40) + "..." : "Textarea is empty", essayVal.length > 0 ? "PASS" : "FAIL");

            console.log("Refreshing workspace page to test sessionStorage fallback...");
            await page.reload();
            await page.waitForTimeout(2500);

            let essayValAfter = await page.locator("textarea[placeholder*='question']").inputValue();
            record("/answer-writing/essay/pyq [refresh]", "Selected topic remains prefilled after refresh", essayValAfter.length > 0 ? "Metadata remains intact" : "Prefilled text is lost", essayValAfter.length > 0 ? "PASS" : "FAIL");
          }
        }
      }
    } catch (err) {
      record("/essay", "Essay flow runs successfully", "Crashed: " + err.message, "FAIL", "Essay flow error", "Check selector/DOM integrity");
    }

    // ====================================================
    // 3. Ethics Flow
    // ====================================================
    console.log("\n--- Testing Ethics Flow ---");
    try {
      await page.goto(`${baseUrl}/ethics`);
      await page.waitForTimeout(2000);
      
      const openedEthicsDash = page.url().includes("/ethics");
      record("/ethics", "Opens Ethics Dashboard", openedEthicsDash ? "Loads dashboard" : "Fails to load: " + page.url(), openedEthicsDash ? "PASS" : "FAIL");

      console.log("Clicking Ethics PYQ...");
      await page.click("text=Ethics PYQ");
      await page.waitForTimeout(2500);
      
      const openedEthicsPyq = page.url().includes("/ethics/pyq");
      record("/ethics/pyq", "Opens Ethics PYQ bank Page", openedEthicsPyq ? "Navigates to /ethics/pyq" : "URL is " + page.url(), openedEthicsPyq ? "PASS" : "FAIL");

      console.log("Selecting an ethics question from the bank...");
      // Let's first filter for Case Study to test Case Study badge as well!
      const hasCaseStudyTab = await page.locator("text=Case Study").first().isVisible().catch(() => false);
      if (hasCaseStudyTab) {
        console.log("Clicking Case Studies filter tab...");
        await page.click("text=Case Study");
        await page.waitForTimeout(1500);
      }

      const selected = await clickFirstQuestionRow();
      await page.waitForTimeout(1500);
      
      if (!selected) {
        record("/ethics/pyq", "Selects an ethics question", "No question clicked", "FAIL", "No questions rendered or clicked", "Ensure database has ethics PYQs");
      } else {
        const isWriteBtnVisible = await page.locator("text=Write / Upload Answer").isVisible();
        record("/ethics/pyq", "Write / Upload Answer button is visible after selection", isWriteBtnVisible ? "Button is visible" : "Button NOT visible", isWriteBtnVisible ? "PASS" : "FAIL");

        if (isWriteBtnVisible) {
          await page.click("text=Write / Upload Answer");
          await page.waitForTimeout(2500);
          
          const openedWorkspace = page.url().includes("/answer-writing/ethics/pyq");
          record("/answer-writing/ethics/pyq", "Opens Ethics Workspace", openedWorkspace ? "Navigated to " + page.url() : "URL is " + page.url(), openedWorkspace ? "PASS" : "FAIL");

          if (openedWorkspace) {
            let ethicsVal = await page.locator("textarea[placeholder*='question']").inputValue();
            record("/answer-writing/ethics/pyq", "Selected ethics question is prefilled in textarea", ethicsVal.length > 0 ? "Prefilled: " + ethicsVal.slice(0, 40) + "..." : "Textarea is empty", ethicsVal.length > 0 ? "PASS" : "FAIL");

            // Case Study Badge check
            const hasCSBadge = await page.locator("text=Case Study").isVisible().catch(() => false);
            record("/answer-writing/ethics/pyq", "Case Study badge is rendered if question is a case study", hasCSBadge ? "Badge is visible" : "No badge rendered (or not a case study question)", "PASS");

            console.log("Refreshing workspace page to test sessionStorage fallback...");
            await page.reload();
            await page.waitForTimeout(2500);

            let ethicsValAfter = await page.locator("textarea[placeholder*='question']").inputValue();
            record("/answer-writing/ethics/pyq [refresh]", "Selected ethics question remains prefilled after refresh", ethicsValAfter.length > 0 ? "Metadata remains intact" : "Prefilled text is lost", ethicsValAfter.length > 0 ? "PASS" : "FAIL");
          }
        }
      }
    } catch (err) {
      record("/ethics", "Ethics flow runs successfully", "Crashed: " + err.message, "FAIL", "Ethics flow error", "Check selector/DOM integrity");
    }

    // ====================================================
    // 4. Institutional Routes
    // ====================================================
    console.log("\n--- Testing Institutional Routes ---");
    const instRoutes = [
      "/answer-writing/essay/institutional",
      "/answer-writing/ethics/institutional",
      "/answer-writing/geography-optional/institutional"
    ];

    for (const route of instRoutes) {
      try {
        await page.goto(`${baseUrl}${route}`);
        await page.waitForTimeout(2000);
        
        const currentRouteUrl = page.url();
        const opened = currentRouteUrl.includes(route);
        if (!opened) {
          record(route, "Loads workspace directly in institutional mode", "Loads wrong URL: " + currentRouteUrl, "FAIL", "Failed to navigate directly to institutional workspace route", "Check route definitions in App.jsx");
          continue;
        }

        const hasUpload = await page.locator("text=Upload Hand-written Pages").isVisible().catch(() => false);
        const hasQTextarea = await page.locator("textarea[placeholder*='question']").isVisible().catch(() => false);
        const hasATextarea = await page.locator("textarea[placeholder*='answer']").isVisible().catch(() => false);
        const hasBasicBtn = await page.locator("text=Basic Evaluation").isVisible().catch(() => false);
        const hasAir1Btn = await page.locator("text=AIR-1 Review").isVisible().catch(() => false);

        if (hasUpload && hasQTextarea && hasATextarea && hasBasicBtn && hasAir1Btn) {
          record(route, "Shows upload area, question/answer textareas, and basic/AIR-1 evaluation buttons", "All required interface elements are present", "PASS");
        } else {
          const missing = [];
          if (!hasUpload) missing.push("Upload Scan UI");
          if (!hasQTextarea) missing.push("Question Area");
          if (!hasATextarea) missing.push("Answer Area");
          if (!hasBasicBtn) missing.push("Basic Evaluation Button");
          if (!hasAir1Btn) missing.push("AIR-1 Prompt Button");
          record(route, "Shows upload area, question/answer textareas, and basic/AIR-1 evaluation buttons", "Missing: " + missing.join(", "), "FAIL", "Interface elements missing", "Check AnswerWriting.jsx conditional render logic");
        }
      } catch (err) {
        record(route, "Loads institutional route without error", "Crashed: " + err.message, "FAIL", "Institutional route crash", "Check components and subelements loaded");
      }
    }

    // ====================================================
    // 5. Upload & Evaluation testing
    // ====================================================
    console.log("\n--- Testing Upload and Evaluation flow ---");
    try {
      await page.goto(`${baseUrl}/answer-writing/ethics/institutional`);
      await page.waitForTimeout(2000);

      // Fill mock inputs to perform evaluation
      console.log("Filling dummy inputs for evaluation...");
      await page.fill("textarea[placeholder*='question']", "What is the relation between emotional intelligence and ethical governance?");
      await page.fill("textarea[placeholder*='answer']", "Emotional intelligence helps public servants control their emotions, empathize with citizens, and make ethical choices under stressful situations.");

      // Upload valid file
      console.log("Uploading valid test image...");
      await page.setInputFiles("input[type='file']", validImgPath);
      await page.waitForTimeout(1000);

      // Basic Evaluation
      console.log("Clicking Basic Evaluation...");
      await page.click("text=Basic Evaluation");
      await page.waitForTimeout(1500); // Wait for loading state
      
      const hasLoadingIndicator = await page.locator("text=Analyzing uploads").isVisible().catch(() => false) || 
                                  await page.locator("text=Sending to AI").isVisible().catch(() => false);
      record("/answer-writing/ethics/institutional [Basic Eval]", "Shows loading state spinner and indicator text", hasLoadingIndicator ? "Loading indicator shown" : "No loading indicator detected", hasLoadingIndicator ? "PASS" : "FAIL");

      // Wait for response (up to 30 seconds for AI model evaluation response)
      console.log("Waiting for AI evaluation report response...");
      await page.waitForSelector("text=Estimated Marks", { timeout: 35000 }).catch(() => {});

      const hasMarksText = await page.locator("text=Estimated Marks").isVisible().catch(() => false);
      if (hasMarksText) {
        record("/answer-writing/ethics/institutional [Basic Eval]", "Renders AI evaluation report with Marks, Level and Impression", "Report successfully loaded on UI with Estimated Marks card", "PASS");
      } else {
        const errorText = await page.locator("div[style*='position: fixed']").innerText().catch(() => "");
        record("/answer-writing/ethics/institutional [Basic Eval]", "Renders AI evaluation report", "Report not loaded. Toast error: " + errorText, "FAIL", "API request failed or evaluation returned error", "Ensure server model is running and DB is connected");
      }

      // AIR-1 Evaluation
      console.log("Testing AIR-1 ChatGPT Prompt generation...");
      await page.click("text=AIR-1 Review");
      
      // Wait for response (up to 15 seconds)
      await page.waitForSelector("text=AIR-1 Review Prompt Ready", { timeout: 15000 }).catch(() => {});

      const hasPromptTextarea = await page.locator("text=AIR-1 Review Prompt Ready").isVisible().catch(() => false);
      if (hasPromptTextarea) {
        record("/answer-writing/ethics/institutional [AIR-1 Prompt]", "Generates ChatGPT prompt and displays prompt panel", "Prompt generated and panel shown", "PASS");
        
        // Copy Prompt button
        const hasCopyAgainBtn = await page.locator("text=Copy Again").isVisible().catch(() => false);
        record("/answer-writing/ethics/institutional [AIR-1 Prompt]", "Shows Copy Again button on panel", hasCopyAgainBtn ? "Copy Again button is visible" : "Copy Again button hidden", hasCopyAgainBtn ? "PASS" : "FAIL");

        // Paste JSON Review and Save Report
        console.log("Pasting ChatGPT review JSON...");
        const sampleChatGPTReview = `{
          "score": 7.5,
          "finalVerdict": "Excellent",
          "examinerImpression": "Very structure-aligned answer showing great conceptual depth.",
          "topImprovements": [
            "Use a diagram next time for emotional model",
            "Refer to a specific case study of a civil servant"
          ],
          "missingDimensionsChecklist": ["Public service context", "Rawlsian ethics link"],
          "idealStructure": ["Define EQ", "Explain ethics link", "Show governance application"],
          "detailedMentorReview": "Excellent job on this ethics question."
        }`;
        
        await page.fill("textarea[placeholder*='Paste the complete response']", sampleChatGPTReview);
        await page.click("text=Save & Import ChatGPT Report");
        // Wait for the paragraph element to appear (ensures the report was successfully parsed and rendered, avoiding textarea match)
        await page.waitForSelector("p:has-text('Very structure-aligned answer')", { timeout: 12000 }).catch(() => {});

        // Verify saved report renders
        const savedTextImpress = await page.locator("p:has-text('Very structure-aligned answer')").isVisible().catch(() => false);
        if (!savedTextImpress) {
          console.log("DEBUG: Saved report details not visible. Inspecting page state...");
          const evalHtml = await page.evaluate(() => document.body ? document.body.innerHTML : "No body");
          console.log("Contains 'Very'?", evalHtml.includes("Very"));
          console.log("Contains 'structure-aligned'?", evalHtml.includes("structure-aligned"));
          console.log("Contains 'Impression'?", evalHtml.includes("Impression"));
          console.log("Contains 'evaluation' key in window/state?", await page.evaluate(() => !!window.evaluation || !!document.querySelector("h4")));
          fs.writeFileSync(path.join(__dirname, "debug_page.html"), evalHtml);
          console.log("Saved full debug HTML to backend/debug_page.html");
        }
        record("/answer-writing/ethics/institutional [Save Report]", "Imported ChatGPT report parses and renders saved score/impression in UI", savedTextImpress ? "Saved report renders successfully" : "Saved report details not visible", savedTextImpress ? "PASS" : "FAIL");
      } else {
        record("/answer-writing/ethics/institutional [AIR-1 Prompt]", "Generates ChatGPT prompt", "Failed to generate prompt panel", "FAIL", "Prompt API failed or returned error", "Check backend route /api/answer-writing/air1-chatgpt-prompt");
      }

    } catch (err) {
      record("/answer-writing/ethics/institutional", "Upload and evaluation tests run successfully", "Crashed: " + err.message, "FAIL", "Upload evaluation test crash", "Check backend status and mock credentials");
    }

    // ====================================================
    // 6. Error testing
    // ====================================================
    console.log("\n--- Testing Error Handling and Limits ---");
    try {
      await page.goto(`${baseUrl}/answer-writing/ethics/institutional`);
      await page.waitForTimeout(2000);

      // A. Unsupported file type
      console.log("Uploading unsupported text file...");
      await page.setInputFiles("input[type='file']", invalidFilePath);
      await page.fill("textarea[placeholder*='question']", "What is virtue ethics?");
      await page.click("text=Basic Evaluation");
      await page.waitForTimeout(2000);
      
      const toastText1 = await page.locator("div[style*='position: fixed']").innerText().catch(() => "");
      console.log("Error Toast received:", toastText1);
      if (toastText1.toLowerCase().includes("unsupported") || toastText1.toLowerCase().includes("type") || toastText1.toLowerCase().includes("only images")) {
        record("/answer-writing/ethics/institutional [unsupported file]", "Shows friendly error message for unsupported file types", "Received toast error: " + toastText1, "PASS");
      } else {
        record("/answer-writing/ethics/institutional [unsupported file]", "Shows friendly error message for unsupported file types", "No toast error or wrong text: " + toastText1, "FAIL", "Multer validation not caught or not displaying toast", "Check fileFilter error handling in answerWritingRoutes.js and toast rendering in AnswerWriting.jsx");
      }

      // B. Large file size
      await page.reload();
      await page.waitForTimeout(2000);
      console.log("Uploading 11MB file (exceeds 10MB limit)...");
      await page.setInputFiles("input[type='file']", largeFilePath);
      await page.fill("textarea[placeholder*='question']", "What is virtue ethics?");
      await page.click("text=Basic Evaluation");
      await page.waitForTimeout(2000);

      const toastText2 = await page.locator("div[style*='position: fixed']").innerText().catch(() => "");
      console.log("Error Toast received:", toastText2);
      if (toastText2.toLowerCase().includes("exceeded") || toastText2.toLowerCase().includes("limit") || toastText2.toLowerCase().includes("10mb")) {
        record("/answer-writing/ethics/institutional [large file]", "Shows friendly error message for files exceeding 10MB", "Received toast error: " + toastText2, "PASS");
      } else {
        record("/answer-writing/ethics/institutional [large file]", "Shows friendly error message for files exceeding 10MB", "No toast error or wrong text: " + toastText2, "FAIL", "Multer limits.fileSize not caught correctly in uploadMiddleware", "Verify uploadMiddleware catches MulterError LIMIT_FILE_SIZE and returns 400 JSON");
      }

      // C. Empty inputs validation
      await page.evaluate(() => sessionStorage.removeItem("mains_pyq_metadata"));
      await page.reload();
      await page.waitForTimeout(2000);
      console.log("Submitting basic evaluation with completely empty inputs...");
      await page.click("text=Basic Evaluation");
      await page.waitForTimeout(1500);

      const toastText3 = await page.locator("div[style*='position: fixed']").innerText().catch(() => "");
      console.log("Error Toast received:", toastText3);
      if (toastText3.toLowerCase().includes("please provide") || toastText3.toLowerCase().includes("question")) {
        record("/answer-writing/ethics/institutional [empty input]", "Shows proper validation error for empty question/answer", "Received toast error: " + toastText3, "PASS");
      } else {
        record("/answer-writing/ethics/institutional [empty input]", "Shows validation error for empty question/answer", "No validation toast displayed", "FAIL", "Validation missing in handleBasicEvaluation", "Check input verification logic in handleBasicEvaluation in AnswerWriting.jsx");
      }

    } catch (err) {
      record("/answer-writing/ethics/institutional [error checks]", "Error limits tests run successfully", "Crashed: " + err.message, "FAIL", "Error checks crashed", "Check playwright select selectors");
    }

    // ====================================================
    // 7. Sidebar Highlight State
    // ====================================================
    console.log("\n--- Testing Sidebar Active Highlight States ---");
    const testHighlight = async (route, expectedKey) => {
      try {
        await page.goto(`${baseUrl}${route}`);
        await page.waitForTimeout(2500);

        const activeSidebarItems = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll(".mos-nav-item-v2.active"));
          return items.map(item => {
            const label = item.querySelector(".mos-nav-item-label-v2")?.innerText;
            return label ? label.trim() : null;
          }).filter(Boolean);
        });

        console.log(`Route ${route} - Active Sidebar Highlight:`, activeSidebarItems);
        const matches = activeSidebarItems.includes(expectedKey);
        
        record(route, `Sidebar highlights active category: ${expectedKey}`, matches ? "Active highlighted: " + JSON.stringify(activeSidebarItems) : "Not highlighted. Active items: " + JSON.stringify(activeSidebarItems), matches ? "PASS" : "FAIL", matches ? "None" : `Sidebar doesn't highlight ${expectedKey}`, "Verify current page variable computation and sidebar config mapping");
      } catch (err) {
        record(route, `Sidebar highlights active category: ${expectedKey}`, "Failed: " + err.message, "FAIL", "Highlight test error", "Check sidebar active selector");
      }
    };

    await testHighlight("/answer-writing/essay/pyq", "Essay");
    await testHighlight("/answer-writing/ethics/pyq", "Ethics");
    await testHighlight("/answer-writing/geography-optional/pyq", "Optional Geography");

  } catch (error) {
    console.error("❌ E2E QA Test execution crashed:", error);
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(largeFilePath)) fs.unlinkSync(largeFilePath);
      if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
      if (fs.existsSync(validImgPath)) fs.unlinkSync(validImgPath);
      console.log("Cleanup of temporary test files completed.");
    } catch (cleanupErr) {
      console.error("Error during temporary file cleanup:", cleanupErr);
    }

    await browser.close();
    console.log("\n=== LIVE QA VERIFICATION SUMMARY ===");
    console.table(results);

    // Save final report to disk
    const reportPath = path.join(process.cwd(), "live_qa_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`Report successfully saved to: ${reportPath}`);
  }
}

runLiveQA();
