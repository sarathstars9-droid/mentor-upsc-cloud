// src/utils/mappingUtils.js

export function humanizeMappingCode(code = "") {
  const map = {
    "MISC-GEN": "",
    "GS3-ST": "Science & Technology",
    "GS3-ST-BIOTECH": "Science & Technology → Biotechnology",
    "GS3-ECO": "Economy",
    "GS3-ENV": "Environment",
    "GS2-POL": "Polity",
    "GS2-POL-CON": "Polity → Constitution",
    "GS1-HIS": "History",
    "GS1-HIS-MOD": "History → Modern",
    "GS1-HIS-ANC": "History → Ancient",
    "GS1-HIS-MED": "History → Medieval",
    "CSAT-BN": "CSAT → Basic Numeracy",
    "CSAT-RC": "CSAT → Reading Comprehension",
    "CSAT-LR": "CSAT → Logical Reasoning",
  };

  if (Object.prototype.hasOwnProperty.call(map, code)) return map[code];
  // Suppress any MISC-* code from ever reaching the UI
  if (/^MISC/i.test(code)) return "";
  return String(code || "").replace(/-MT\d+$/, "").replace(/-/g, " → ");
}