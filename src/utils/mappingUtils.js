// src/utils/mappingUtils.js

export function humanizeMappingCode(code = "") {
  const map = {
    "GS3-ST": "Science & Technology",
    "GS3-ST-BIOTECH": "Science & Technology → Biotechnology",
    "GS3-ECO": "Economy",
    "GS3-ENV": "Environment",
    "GS2-POL-CON": "Polity → Constitution",
    "GS1-HIS-MOD": "History → Modern",
    "CSAT-BN": "CSAT → Basic Numeracy",
    "CSAT-RC": "CSAT → Reading Comprehension",
    "CSAT-LR": "CSAT → Logical Reasoning",
  };

  return map[code] || String(code || "").replace(/-MT\d+$/, "").replace(/-/g, " → ");
}