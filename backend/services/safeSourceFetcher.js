import http from 'http';
import https from 'https';
import dns from 'dns/promises';
import { URL } from 'url';
import { load as loadCheerio } from 'cheerio';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_PDF_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_PORTS = [80, 443];

// Reject private, loopback, link-local, multicast, CGNAT, etc.
function isPrivateIP(ip) {
  // IPv4 Private & Reserved
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('0.')) return true;
  
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  
  // 100.64.0.0/10 CGNAT
  if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(ip)) return true;

  // Multicast & Experimental
  if (/^2(2[4-9]|[3-5][0-9])\./.test(ip)) return true;

  // IPv6 checks
  const lowerIp = ip.toLowerCase();
  if (lowerIp === '::1') return true;
  if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true; // ULA
  if (lowerIp.startsWith('fe8') || lowerIp.startsWith('fe9') || lowerIp.startsWith('fea') || lowerIp.startsWith('feb')) return true; // Link-local
  if (lowerIp.startsWith('::ffff:')) {
    const v4 = lowerIp.split('::ffff:')[1];
    if (v4 && isPrivateIP(v4)) return true;
  }
  
  return false;
}

async function validateAndResolve(hostname) {
  const records = await dns.lookup(hostname, { all: true });
  if (!records || records.length === 0) {
    throw new Error('DNS_RESOLUTION_FAILED');
  }

  // Reject if ANY record is private
  for (const record of records) {
    if (isPrivateIP(record.address)) {
      throw new Error('UNSAFE_IP_REJECTED');
    }
  }

  // Return the first validated public address
  return records[0].address;
}

function safeRequest(targetUrl, redirectCount = 0) {
  return new Promise(async (resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error('TOO_MANY_REDIRECTS'));
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (err) {
      return reject(new Error('INVALID_URL'));
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return reject(new Error('UNSAFE_SCHEME_REJECTED'));
    }
    
    if (parsedUrl.username || parsedUrl.password) {
      return reject(new Error('URL_CREDENTIALS_REJECTED'));
    }

    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80);
    if (!ALLOWED_PORTS.includes(port)) {
      return reject(new Error('UNSAFE_PORT_REJECTED'));
    }

    let pinnedIp;
    try {
      pinnedIp = await validateAndResolve(parsedUrl.hostname);
    } catch (err) {
      return reject(err);
    }

    const options = {
      hostname: pinnedIp,
      port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Host': parsedUrl.hostname,
        'Accept': 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.1',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept-Encoding': 'identity',
        'User-Agent': 'MentorOS/1.0'
      },
      timeout: TIMEOUT_MS,
      // Pass the original hostname for SNI
      servername: parsedUrl.hostname,
      rejectUnauthorized: true, // MUST remain true
      // Custom lookup to enforce the pinned IP
      lookup: (hostname, opts, cb) => {
        // cb(err, address, family)
        cb(null, pinnedIp, pinnedIp.includes(':') ? 6 : 4);
      }
    };

    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      const statusCode = res.statusCode;
      
      // Handle Redirects
      if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).toString();
        // Manually destroy current response
        res.destroy();
        return resolve(safeRequest(redirectUrl, redirectCount + 1));
      }

      if (statusCode < 200 || statusCode >= 300) {
        res.destroy();
        return reject(new Error(`HTTP_ERROR_${statusCode}`));
      }

      const contentType = (res.headers['content-type'] || '').toLowerCase();
      const isPdf = contentType.includes('application/pdf');
      
      const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_HTML_BYTES;
      let totalBytes = 0;
      const chunks = [];

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          req.destroy(new Error('RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          contentType,
          url: targetUrl
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('FETCH_TIMEOUT'));
    });

    req.end();
  });
}

function extractHtmlText(htmlBuffer) {
  const $ = loadCheerio(htmlBuffer.toString('utf-8'));
  
  // Remove unwanted tags
  $('script, style, noscript, nav, header, footer, form, aside, iframe, svg').remove();
  
  // Prefer article/main/body
  let root = $('article');
  if (root.length === 0) root = $('main');
  if (root.length === 0) root = $('body');
  if (root.length === 0) root = $.root();
  
  let text = root.text();
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export async function extractPdfText(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text.replace(/\s+/g, ' ').trim();
  } catch (err) {
    throw new Error('UNPARSEABLE_PDF');
  }
}

/**
 * Claim Windowing
 * Extract ~3 windows of text that are most relevant to the claim.
 */
export function getClaimRelevantWindows(fullText, claimText, metadata = {}) {
  // Simple heuristic: search for words in claim + metadata
  const keywords = new Set();
  
  const extractWords = (str) => {
    if (!str) return [];
    return String(str).toLowerCase().match(/\b[a-z0-9]{4,}\b/gi) || [];
  };

  extractWords(claimText).forEach(w => keywords.add(w));
  if (metadata.source_year) keywords.add(String(metadata.source_year));
  if (metadata.institution) extractWords(metadata.institution).forEach(w => keywords.add(w));
  if (metadata.scheme_name) extractWords(metadata.scheme_name).forEach(w => keywords.add(w));
  
  const keywordArray = Array.from(keywords);
  if (keywordArray.length === 0) {
    // If no keywords, return first ~12k chars
    return fullText.substring(0, 12000);
  }

  const WINDOW_SIZE = 4000;
  const windows = [];

  let lastIndex = 0;
  while (lastIndex < fullText.length) {
    let bestScore = -1;
    let bestStart = -1;
    
    // Scan ahead in ~2000 char increments to find keyword-dense regions
    for (let i = lastIndex; i < fullText.length; i += 2000) {
      const chunk = fullText.substring(i, i + WINDOW_SIZE);
      const lowerChunk = chunk.toLowerCase();
      let score = 0;
      for (const kw of keywordArray) {
        // Count occurrences
        let count = 0;
        let pos = lowerChunk.indexOf(kw);
        while (pos !== -1) {
          count++;
          pos = lowerChunk.indexOf(kw, pos + kw.length);
        }
        score += count;
      }
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }

    if (bestScore > 0 && bestStart !== -1) {
      // Avoid overlapping with existing windows
      let overlap = false;
      for (const w of windows) {
        if (Math.abs(w.start - bestStart) < WINDOW_SIZE) {
          overlap = true;
          break;
        }
      }
      
      if (!overlap) {
        windows.push({
          start: bestStart,
          text: fullText.substring(bestStart, bestStart + WINDOW_SIZE)
        });
      }
    }
    
    lastIndex += WINDOW_SIZE;
    if (windows.length >= 3) break;
  }

  if (windows.length === 0) {
    return fullText.substring(0, 12000);
  }

  // Sort by start position
  windows.sort((a, b) => a.start - b.start);
  return windows.map(w => w.text).join('\n\n[...]\n\n');
}

let __mockFetchAndExtractSource = null;

export function setMockFetchAndExtractSource(mockFn) {
  __mockFetchAndExtractSource = mockFn;
}

export async function fetchAndExtractSource(url, claimText, metadata) {
  if (__mockFetchAndExtractSource) {
    return __mockFetchAndExtractSource(url, claimText, metadata);
  }

  const result = await safeRequest(url);
  let text = '';
  
  if (result.contentType.includes('application/pdf')) {
    text = await extractPdfText(result.buffer);
  } else {
    // HTML / plain / json
    text = extractHtmlText(result.buffer);
  }

  // Windowing
  if (text.length > 12000) {
    text = getClaimRelevantWindows(text, claimText, metadata);
  }
  
  return text;
}

function requestNoRedirects(targetUrl) {
  return new Promise(async (resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (err) {
      return reject(new Error('INVALID_URL'));
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return reject(new Error('UNSAFE_SCHEME_REJECTED'));
    }
    if (parsedUrl.username || parsedUrl.password) {
      return reject(new Error('URL_CREDENTIALS_REJECTED'));
    }
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80);
    if (!ALLOWED_PORTS.includes(port)) {
      return reject(new Error('UNSAFE_PORT_REJECTED'));
    }

    let pinnedIp;
    try {
      pinnedIp = await validateAndResolve(parsedUrl.hostname);
    } catch (err) {
      return reject(err);
    }

    const options = {
      hostname: pinnedIp,
      port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Host': parsedUrl.hostname,
        'User-Agent': 'MentorOS/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.1',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept-Encoding': 'identity'
      },
      servername: parsedUrl.hostname,
      rejectUnauthorized: true,
      lookup: (hostname, opts, cb) => {
        cb(null, pinnedIp, pinnedIp.includes(':') ? 6 : 4);
      }
    };

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let location = res.headers.location;
      res.destroy(); // We don't need body for this proxy proof
      resolve({ statusCode: res.statusCode, location });
    });
    req.on('error', reject);
    req.end();
  });
}

export async function resolveProxyUrl(initialUrl) {
  let currentUrl = initialUrl;
  let redirectCount = 0;
  let chain = [];

  let isFirst = true;

  while (redirectCount <= 3) {
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch(e) {
      return { status: "FAILED", error: "INVALID_URL", finalUrl: currentUrl, redirectCount, chain };
    }

    // Step 1: validate initial URL specifically
    if (isFirst) {
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'vertexaisearch.cloud.google.com') {
         return { status: "UNSAFE", error: "INVALID_PROXY_ORIGIN", finalUrl: currentUrl, redirectCount, chain };
      }
    }
    isFirst = false;

    chain.push(parsed.hostname);

    // SSRF Validation
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { status: "UNSAFE", error: "UNSAFE_SCHEME_REJECTED", finalUrl: currentUrl, redirectCount, chain };
    }
    if (parsed.username || parsed.password) {
      return { status: "UNSAFE", error: "URL_CREDENTIALS_REJECTED", finalUrl: currentUrl, redirectCount, chain };
    }
    const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    if (!ALLOWED_PORTS.includes(port)) {
      return { status: "UNSAFE", error: "UNSAFE_PORT_REJECTED", finalUrl: currentUrl, redirectCount, chain };
    }

    try {
      await validateAndResolve(parsed.hostname);
    } catch (err) {
      return { status: "UNSAFE", error: err.message, finalUrl: currentUrl, redirectCount, chain };
    }

    let statusCode, location;
    
    try {
      const res = await requestNoRedirects(currentUrl);
      statusCode = res.statusCode;
      location = res.location;
    } catch(err) {
      return { status: "FAILED", error: err.message, finalUrl: currentUrl, redirectCount, chain };
    }

    if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
    } else if (statusCode === 200 || statusCode === 403 || statusCode === 404 || statusCode >= 400) {
      // It reached a final publisher URL (even if it's 403, we return DIRECT_PUBLISHER for resolution!)
      return { status: "DIRECT_PUBLISHER", finalUrl: currentUrl, redirectCount, chain };
    } else {
      return { status: "FAILED", error: `HTTP_${statusCode}`, finalUrl: currentUrl, redirectCount, chain };
    }
  }

  return { status: "FAILED", error: "TOO_MANY_REDIRECTS", finalUrl: currentUrl, redirectCount, chain };
}
