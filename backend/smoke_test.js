// backend/smoke_test.js
import { chromium } from "playwright";

async function runSmokeTest() {
  const baseUrl = "https://mentorupsc.in";
  console.log("=== STARTING LIVE PRODUCTION SMOKE TEST ===");
  console.log("Target:", baseUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on("console", msg => {
    if (msg.type() === "error") {
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  const status = {
    login: false,
    geography: false,
    essay: false,
    ethics: false,
    institutional: false,
    refreshProtection: false
  };

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
    // 1. Login
    console.log("\n1. Testing Login...");
    await page.goto(baseUrl);
    await page.waitForTimeout(3000);

    const isLoginCard = await page.locator("input[type='password']").isVisible().catch(() => false);
    if (isLoginCard) {
      await page.fill("input[type='password']", "mentor2026");
      await page.click("button[type='submit']");
      await page.waitForTimeout(3000);
    }
    const currentUrl = page.url();
    status.login = currentUrl.includes("/plan") || currentUrl.includes("/dashboard") || !isLoginCard;
    console.log(`- Login result: ${status.login ? "SUCCESS" : "FAILED"} (Current URL: ${currentUrl})`);

    // 2. Geography Optional Flow
    console.log("\n2. Testing Geography Optional Flow...");
    try {
      await page.goto(`${baseUrl}/geography-optional`);
      await page.waitForTimeout(3000);
      console.log(`- Loaded /geography-optional. Current URL: ${page.url()}`);
      
      const hasPyqBtn = await page.locator("text=Geography Optional PYQ").isVisible().catch(() => false);
      console.log(`- PYQ Button visible? ${hasPyqBtn}`);
      if (hasPyqBtn) {
        await page.click("text=Geography Optional PYQ");
        await page.waitForTimeout(3000);
        console.log(`- Loaded PYQ page. Current URL: ${page.url()}`);
        
        const selected = await clickFirstQuestionRow();
        console.log(`- Question selected? ${selected}`);
        await page.waitForTimeout(1000);
        
        const isWriteBtnVisible = await page.locator("text=Write / Upload Answer").isVisible().catch(() => false);
        console.log(`- Write / Upload Answer button visible? ${isWriteBtnVisible}`);
        
        if (selected && isWriteBtnVisible) {
          await page.click("text=Write / Upload Answer");
          await page.waitForTimeout(3000);
          console.log(`- Loaded workspace. Current URL: ${page.url()}`);
          
          if (page.url().includes("/answer-writing/geography-optional/pyq")) {
            const qText = await page.locator("textarea[placeholder*='question']").inputValue().catch(() => "");
            status.geography = qText.length > 0;
            console.log(`- Question text length: ${qText.length}`);
          }
        }
      }
    } catch (e) {
      console.log(`- Geography Optional Flow error: ${e.message}`);
    }
    console.log(`- Geography Optional flow: ${status.geography ? "SUCCESS" : "FAILED"}`);

    // 3. Essay Flow
    console.log("\n3. Testing Essay Flow...");
    try {
      await page.goto(`${baseUrl}/essay`);
      await page.waitForTimeout(3000);
      console.log(`- Loaded /essay. Current URL: ${page.url()}`);
      
      const hasPyqBtn = await page.locator("text=Essay PYQ").isVisible().catch(() => false);
      console.log(`- Essay PYQ Button visible? ${hasPyqBtn}`);
      if (hasPyqBtn) {
        await page.click("text=Essay PYQ");
        await page.waitForTimeout(3000);
        console.log(`- Loaded Essay PYQ page. Current URL: ${page.url()}`);
        
        const selected = await clickFirstQuestionRow();
        console.log(`- Essay selected? ${selected}`);
        await page.waitForTimeout(1000);
        
        const isWriteBtnVisible = await page.locator("text=Write / Upload Essay").isVisible().catch(() => false);
        console.log(`- Write / Upload Essay button visible? ${isWriteBtnVisible}`);
        
        if (selected && isWriteBtnVisible) {
          await page.click("text=Write / Upload Essay");
          await page.waitForTimeout(3000);
          console.log(`- Loaded workspace. Current URL: ${page.url()}`);
          
          if (page.url().includes("/answer-writing/essay/pyq")) {
            const qText = await page.locator("textarea[placeholder*='question']").inputValue().catch(() => "");
            status.essay = qText.length > 0;
            console.log(`- Essay text length: ${qText.length}`);
          }
        }
      }
    } catch (e) {
      console.log(`- Essay Flow error: ${e.message}`);
    }
    console.log(`- Essay flow: ${status.essay ? "SUCCESS" : "FAILED"}`);

    // 4. Ethics Flow
    console.log("\n4. Testing Ethics Flow...");
    let lastPrefilledTextForRefresh = "";
    try {
      await page.goto(`${baseUrl}/ethics`);
      await page.waitForTimeout(3000);
      console.log(`- Loaded /ethics. Current URL: ${page.url()}`);
      
      const hasPyqBtn = await page.locator("text=Ethics PYQ").isVisible().catch(() => false);
      console.log(`- Ethics PYQ Button visible? ${hasPyqBtn}`);
      if (hasPyqBtn) {
        await page.click("text=Ethics PYQ");
        await page.waitForTimeout(3000);
        console.log(`- Loaded Ethics PYQ page. Current URL: ${page.url()}`);
        
        const selected = await clickFirstQuestionRow();
        console.log(`- Ethics question selected? ${selected}`);
        await page.waitForTimeout(1000);
        
        const isWriteBtnVisible = await page.locator("text=Write / Upload Answer").isVisible().catch(() => false);
        console.log(`- Write / Upload Answer button visible? ${isWriteBtnVisible}`);
        
        if (selected && isWriteBtnVisible) {
          await page.click("text=Write / Upload Answer");
          await page.waitForTimeout(3000);
          console.log(`- Loaded workspace. Current URL: ${page.url()}`);
          
          if (page.url().includes("/answer-writing/ethics/pyq")) {
            lastPrefilledTextForRefresh = await page.locator("textarea[placeholder*='question']").inputValue().catch(() => "");
            status.ethics = lastPrefilledTextForRefresh.length > 0;
            console.log(`- Ethics text length: ${lastPrefilledTextForRefresh.length}`);
          }
        }
      }
    } catch (e) {
      console.log(`- Ethics Flow error: ${e.message}`);
    }
    console.log(`- Ethics flow: ${status.ethics ? "SUCCESS" : "FAILED"}`);

    // 5. Institutional Workspace
    console.log("\n5. Testing Institutional Workspace UI...");
    try {
      await page.goto(`${baseUrl}/answer-writing/ethics/institutional`);
      await page.waitForTimeout(3000);
      console.log(`- Loaded institutional workspace. Current URL: ${page.url()}`);

      const hasUpload = await page.locator("text=Upload Hand-written Pages").isVisible().catch(() => false);
      const hasBasicBtn = await page.locator("text=Basic Evaluation").isVisible().catch(() => false);
      const hasAir1Btn = await page.locator("text=AIR-1 Review").isVisible().catch(() => false);
      console.log(`- Upload visible? ${hasUpload}, Basic Eval button visible? ${hasBasicBtn}, AIR-1 button visible? ${hasAir1Btn}`);
      
      // Let's click AIR-1 Review to show prompt card which displays Import/Paste elements
      if (hasAir1Btn) {
        await page.click("text=AIR-1 Review");
        await page.waitForTimeout(3000);
      }

      const hasPasteArea = await page.locator("textarea[placeholder*='Paste the complete response']").isVisible().catch(() => false);
      const hasSaveBtn = await page.locator("text=Save & Import ChatGPT Report").isVisible().catch(() => false);
      console.log(`- Paste area visible? ${hasPasteArea}, Save button visible? ${hasSaveBtn}`);

      status.institutional = hasUpload && hasBasicBtn && hasAir1Btn && hasPasteArea && hasSaveBtn;
    } catch (e) {
      console.log(`- Institutional UI error: ${e.message}`);
    }
    console.log(`- Institutional Workspace UI check: ${status.institutional ? "SUCCESS" : "FAILED"}`);

    // 6. Refresh Protection
    console.log("\n6. Testing Refresh Protection...");
    if (status.ethics && lastPrefilledTextForRefresh) {
      try {
        await page.goto(`${baseUrl}/answer-writing/ethics/pyq`);
        await page.waitForTimeout(2000);
        
        console.log("Reloading ethics PYQ page...");
        await page.reload();
        await page.waitForTimeout(3000);

        const qTextAfter = await page.locator("textarea[placeholder*='question']").inputValue();
        status.refreshProtection = qTextAfter === lastPrefilledTextForRefresh;
      } catch (e) {
        console.log(`- Refresh Protection error: ${e.message}`);
      }
    } else {
      console.log("- Skipping refresh check: Ethics flow prefill failed.");
    }
    console.log(`- Refresh protection: ${status.refreshProtection ? "SUCCESS" : "FAILED"}`);

  } catch (err) {
    console.error("Critical smoke test runner error:", err);
  } finally {
    await browser.close();
  }

  const allPassed = Object.values(status).every(v => v === true);
  console.log("\n=================================");
  console.log(`FINAL SMOKE TEST RESULT: ${allPassed ? "PASS" : "FAIL"}`);
  console.log("=================================");
  process.exit(allPassed ? 0 : 1);
}

runSmokeTest();
