// backend/test_browser_flow.js
import { chromium } from "playwright";

async function runBrowserQA() {
  console.log("=== STARTING HEADLESS BROWSER FLOW VERIFICATION ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseUrl = "http://localhost:4173"; // Default Vite preview port

  try {
    // 1. Open home & Login
    console.log("Opening home page and attempting login...");
    await page.goto(baseUrl);
    
    // Check if login is required
    const isLoginCard = await page.locator(".login-card").isVisible();
    if (isLoginCard) {
      console.log("Login card visible. Entering password...");
      await page.fill("input[type='password']", "mentor2026");
      await page.click("button[type='submit']");
      await page.waitForTimeout(2500);
      console.log("Logged in successfully. Current URL:", page.url());
    } else {
      console.log("Already authenticated. Current URL:", page.url());
    }

    // ==========================================
    // Flow 1: Geography Optional Flow
    // ==========================================
    console.log("\n--- Testing Geography Optional Flow ---");
    await page.goto(`${baseUrl}/geography-optional`);
    await page.waitForTimeout(1500);
    console.log("Dashboard loaded. Clicking Geography Optional PYQ...");
    await page.click("text=Geography Optional PYQ");
    await page.waitForTimeout(2500);
    console.log("Current URL:", page.url());
    
    // Select a question row
    console.log("Selecting a question...");
    const geoQRow = page.locator("text=Paper").first();
    await geoQRow.click();
    await page.waitForTimeout(1500);
    
    // Confirm button is visible
    const writeBtnGeo = page.locator("text=Write / Upload Answer");
    const isWriteBtnGeoVisible = await writeBtnGeo.isVisible();
    console.log("Write / Upload Answer button visible:", isWriteBtnGeoVisible);
    
    // Click button
    await writeBtnGeo.click();
    await page.waitForTimeout(2500);
    console.log("Workspace URL:", page.url());
    
    // Confirm prefilled metadata
    let questionVal = await page.locator("textarea[placeholder*='question']").inputValue();
    console.log("Prefilled Question length:", questionVal.length);
    console.log("Is question prefilled:", questionVal.length > 0);

    // Refresh page
    console.log("Refreshing workspace page...");
    await page.reload();
    await page.waitForTimeout(2500);
    questionVal = await page.locator("textarea[placeholder*='question']").inputValue();
    console.log("After refresh - Is question still prefilled:", questionVal.length > 0);

    // ==========================================
    // Flow 2: Essay Flow
    // ==========================================
    console.log("\n--- Testing Essay Flow ---");
    await page.goto(`${baseUrl}/essay`);
    await page.waitForTimeout(1500);
    console.log("Dashboard loaded. Clicking Essay PYQ...");
    await page.click("text=Essay PYQ");
    await page.waitForTimeout(2500);
    console.log("Current URL:", page.url());
    
    // Select essay topic
    console.log("Selecting a topic...");
    const essayRow = page.locator("text=20").first();
    await essayRow.click();
    await page.waitForTimeout(1500);

    // Confirm button is visible
    const writeBtnEssay = page.locator("text=Write / Upload Essay");
    const isWriteBtnEssayVisible = await writeBtnEssay.isVisible();
    console.log("Write / Upload Essay button visible:", isWriteBtnEssayVisible);

    // Click button
    await writeBtnEssay.click();
    await page.waitForTimeout(2500);
    console.log("Workspace URL:", page.url());

    // Confirm prefilled metadata
    let essayVal = await page.locator("textarea[placeholder*='question']").inputValue();
    console.log("Prefilled Essay Topic length:", essayVal.length);
    console.log("Is topic prefilled:", essayVal.length > 0);

    // Refresh page
    console.log("Refreshing workspace page...");
    await page.reload();
    await page.waitForTimeout(2500);
    essayVal = await page.locator("textarea[placeholder*='question']").inputValue();
    console.log("After refresh - Is topic still prefilled:", essayVal.length > 0);

    // ==========================================
    // Flow 3: Ethics Flow
    // ==========================================
    console.log("\n--- Testing Ethics Flow ---");
    await page.goto(`${baseUrl}/ethics`);
    await page.waitForTimeout(1500);
    console.log("Dashboard loaded. Clicking Ethics PYQ...");
    await page.click("text=Ethics PYQ");
    await page.waitForTimeout(2500);
    console.log("Current URL:", page.url());
    
    // Select an ethics question
    console.log("Selecting a question...");
    const ethicsRow = page.locator("text=20").first();
    await ethicsRow.click();
    await page.waitForTimeout(1500);

    // Confirm button is visible
    const writeBtnEthics = page.locator("text=Write / Upload Answer");
    const isWriteBtnEthicsVisible = await writeBtnEthics.isVisible();
    console.log("Write / Upload Answer button visible:", isWriteBtnEthicsVisible);

    // Click button
    await writeBtnEthics.click();
    await page.waitForTimeout(2500);
    console.log("Workspace URL:", page.url());

    // Confirm prefilled metadata
    let ethicsVal = await page.locator("textarea[placeholder*='question']").inputValue();
    console.log("Prefilled Question length:", ethicsVal.length);
    console.log("Is question prefilled:", ethicsVal.length > 0);

    // Check for Case Study badge (if caseStudy)
    const caseStudyBadge = page.locator("text=Case Study");
    const hasCaseStudyBadge = await caseStudyBadge.isVisible();
    console.log("Case Study badge visible:", hasCaseStudyBadge);

    // Refresh page
    console.log("Refreshing workspace page...");
    await page.reload();
    await page.waitForTimeout(2500);
    ethicsVal = await page.locator("textarea[placeholder*='question']").inputValue();
    console.log("After refresh - Is question still prefilled:", ethicsVal.length > 0);

    // ==========================================
    // Flow 4: Institutional Routes Direct Check
    // ==========================================
    console.log("\n--- Checking Direct Institutional Routes ---");
    const instRoutes = [
      "/answer-writing/essay/institutional",
      "/answer-writing/ethics/institutional",
      "/answer-writing/geography-optional/institutional"
    ];

    for (const r of instRoutes) {
      console.log(`Verifying: ${r}`);
      await page.goto(`${baseUrl}${r}`);
      await page.waitForTimeout(1500);

      // Verify key workspace elements
      const hasUploadText = await page.locator("text=Upload Hand-written Pages").isVisible();
      const hasQuestionArea = await page.locator("textarea[placeholder*='question']").inputValue().then(v => true).catch(() => false);
      const hasAnswerArea = await page.locator("textarea[placeholder*='answer']").inputValue().then(v => true).catch(() => false);
      const hasBasicBtn = await page.locator("text=Basic Evaluation").isVisible();
      const hasAir1Btn = await page.locator("text=AIR-1 Review (ChatGPT)").isVisible();

      console.log(" - Has Upload Card:", hasUploadText);
      console.log(" - Has Question Area:", hasQuestionArea);
      console.log(" - Has Answer Area:", hasAnswerArea);
      console.log(" - Has Basic Evaluation button:", hasBasicBtn);
      console.log(" - Has AIR-1 Review button:", hasAir1Btn);
    }

    console.log("\n=== HEADLESS BROWSER FLOW QA COMPLETED ===");
  } catch (error) {
    console.error("❌ E2E QA Test Failed:", error);
  } finally {
    await browser.close();
  }
}

runBrowserQA();
