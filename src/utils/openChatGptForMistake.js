/**
 * openChatGptForMistake.js
 * Copies the explanation prompt to clipboard and opens ChatGPT.
 *
 * Direct URL prefill for ChatGPT is NOT reliably supported
 * (the ?q= or ?prompt= parameter is not stable across ChatGPT versions).
 * We use the reliable approach:
 *   1. Copy prompt to clipboard
 *   2. Open ChatGPT in a new tab
 *   3. Return a status object for UI feedback
 */

const CHATGPT_URL = "https://chatgpt.com/";

/**
 * Copy text to clipboard with a safe fallback for older browsers.
 */
async function copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
    }
    // Fallback: execCommand (deprecated but wider compat)
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
}

/**
 * Main entry point.
 *
 * @param {string} prompt  The full prompt string from buildMistakeExplanationPrompt()
 * @returns {{ success: boolean, message: string }}
 */
export async function openChatGptForMistake(prompt) {
    try {
        const copied = await copyToClipboard(prompt);

        // Open ChatGPT in a new tab
        window.open(CHATGPT_URL, "_blank", "noopener,noreferrer");

        if (copied) {
            return {
                success: true,
                message: "Prompt copied. Paste into ChatGPT for explanation.",
            };
        } else {
            return {
                success: true,
                message: "ChatGPT opened. Copy the prompt manually if needed.",
            };
        }
    } catch {
        // Clipboard failed — still try to open ChatGPT
        try {
            window.open(CHATGPT_URL, "_blank", "noopener,noreferrer");
        } catch {
            // ignore
        }
        return {
            success: false,
            message: "Could not copy prompt. Open ChatGPT and paste manually.",
        };
    }
}
