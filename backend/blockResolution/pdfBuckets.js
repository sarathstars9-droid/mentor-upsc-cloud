/**
 * backend/blockResolution/pdfBuckets.js
 *
 * PRELIMS PDF BUCKET REGISTRY
 * ─────────────────────────────────────────────────────────────────────────────
 * These are the classification labels that appear in the `section` field
 * of our tagged prelims question JSON files.
 *
 * Each entry represents a canonical PDF bucket: "Subject > Section".
 * The resolver uses these as lookup keys into pdfToSyllabusMap.js.
 *
 * RULE: Do NOT use these for global keyword matching.
 *       These are category labels, not search terms.
 */

export const PDF_BUCKETS = [

  // ─── ART AND CULTURE ─────────────────────────────────────────────────────
  "Art and Culture > Art and Craft in India",
  "Art and Culture > Indian Culture and Heritage",
  "Art and Culture > Architecture",
  "Art and Culture > Sculpture",
  "Art and Culture > Painting",
  "Art and Culture > Literature and Language",
  "Art and Culture > Performing Arts",
  "Art and Culture > Religion and Philosophy",
  "Art and Culture > Geographical Indications and Schemes",
  "Art and Culture > Institutions and UNESCO",

  // ─── ANCIENT HISTORY ─────────────────────────────────────────────────────
  "Ancient Indian History > Politics and Society",
  "Ancient Indian History > Architecture",
  "Ancient Indian History > Literature",
  "Ancient Indian History > Religion and Philosophy",
  "Ancient Indian History > Prehistoric and IVC",
  "Ancient Indian History > Mauryan and Post-Mauryan",
  "Ancient Indian History > Gupta and Post-Gupta",
  "Ancient Indian History > Sangam Age",

  // ─── MEDIEVAL HISTORY ────────────────────────────────────────────────────
  "Medieval Indian History > Politics and Society",
  "Medieval Indian History > Advent of Europeans in India",
  "Medieval Indian History > Art, Architecture and Literature",
  "Medieval Indian History > Religion and Philosophy",
  "Medieval Indian History > Delhi Sultanate",
  "Medieval Indian History > Mughal Empire",
  "Medieval Indian History > Bhakti and Sufi Movements",
  "Medieval Indian History > Vijayanagara and Regional Kingdoms",

  // ─── MODERN HISTORY ──────────────────────────────────────────────────────
  "Modern Indian History > Establishment of British Rule (1750-1857)",
  "Modern Indian History > The Revolt of 1857",
  "Modern Indian History > Social Reforms and Reformers",
  "Modern Indian History > Constitutional Development and Acts",
  "Modern Indian History > Nationalist Movement and Freedom Struggle",
  "Modern Indian History > Governor Generals and Administration",
  "Modern Indian History > Post-Independence Integration",

  // ─── GEOGRAPHY ───────────────────────────────────────────────────────────
  "Geography > Physical Geography - Geomorphology",
  "Geography > Physical Geography - Climatology",
  "Geography > Physical Geography - Oceanography",
  "Geography > Physical Geography - Soils and Vegetation",
  "Geography > Indian Geography - Physiography",
  "Geography > Indian Geography - Climate and Monsoon",
  "Geography > Indian Geography - Rivers and Drainage",
  "Geography > Indian Geography - Agriculture",
  "Geography > Indian Geography - Resources and Minerals",
  "Geography > Indian Geography - Population and Urbanization",
  "Geography > World Geography - Locations and Maps",
  "Geography > World Geography - Landforms",
  "Geography > Human Geography",

  // ─── POLITY ──────────────────────────────────────────────────────────────
  "Indian Polity > Historical Background and Constitutional Making",
  "Indian Polity > Preamble and Key Features",
  "Indian Polity > Fundamental Rights",
  "Indian Polity > DPSP and Fundamental Duties",
  "Indian Polity > Executive - President and Vice President",
  "Indian Polity > Executive - Prime Minister and Council of Ministers",
  "Indian Polity > Executive - Governor and State Executive",
  "Indian Polity > Parliament and Legislature",
  "Indian Polity > Judiciary",
  "Indian Polity > Federalism and Center-State Relations",
  "Indian Polity > Amendments",
  "Indian Polity > Elections and Representation",
  "Indian Polity > Constitutional Bodies",
  "Indian Polity > Non-Constitutional Bodies",
  "Indian Polity > Local Self Government",
  "Indian Polity > Emergency Provisions",
  "Indian Polity > Governance",

  // ─── ECONOMY ─────────────────────────────────────────────────────────────
  "Indian Economy > Banking Structure",
  "Indian Economy > NPA and Credit Quality",
  "Indian Economy > Monetary Policy and RBI",
  "Indian Economy > Inflation and Price Indices",
  "Indian Economy > Budget and Fiscal Policy",
  "Indian Economy > Taxation - Direct",
  "Indian Economy > Taxation - Indirect and GST",
  "Indian Economy > Financial Markets and Capital Market",
  "Indian Economy > Insurance, Pension, Financial Inclusion",
  "Indian Economy > External Sector and BOP",
  "Indian Economy > International Economic Organisations",
  "Indian Economy > Growth, Development and Planning",
  "Indian Economy > Poverty and Inclusion",
  "Indian Economy > Agriculture Sector",
  "Indian Economy > Industry and Labour",
  "Indian Economy > Infrastructure and Energy",
  "Indian Economy > Finance Commission and Devolution",
  "Indian Economy > Black Money and Subsidies",

  // ─── ENVIRONMENT ─────────────────────────────────────────────────────────
  "Environment > Biodiversity",
  "Environment > Species in News",
  "Environment > Climate Change",
  "Environment > Ecology Concepts",
  "Environment > Environmental Pollution",
  "Environment > Conservation and Protected Areas",
  "Environment > Environmental Legislation and Acts",
  "Environment > International Environmental Conventions",
  "Environment > Energy and Sustainability",
  "Environment > Agriculture and Environment",

  // ─── SCIENCE AND TECHNOLOGY ──────────────────────────────────────────────
  "Science and Technology > Biotechnology",
  "Science and Technology > Space",
  "Science and Technology > Defence Technology",
  "Science and Technology > IT and Communications",
  "Science and Technology > AI and Emerging Technology",
  "Science and Technology > Nuclear Technology",
  "Science and Technology > Health and Diseases",
  "Science and Technology > Physics and Chemistry",
  "Science and Technology > Materials and Nanotechnology",
  "Science and Technology > IPR and Technology Policy",

  // ─── INTERNATIONAL RELATIONS ─────────────────────────────────────────────
  "International Relations > International Organisations",
  "International Relations > Regional Groupings",
  "International Relations > India's Neighbours",
  "International Relations > Major Powers - USA, China, Russia",
  "International Relations > WTO, IMF, World Bank",
  "International Relations > Agreements and Treaties",
  "International Relations > West Asia and Middle East",
  "International Relations > Climate and Disarmament",

  // ─── SOCIETY AND SOCIAL ISSUES ───────────────────────────────────────────
  "Society > Social Issues and Empowerment",
  "Society > Women Empowerment",
  "Society > Tribal Issues",
  "Society > Population and Urbanization",

  // ─── CURRENT AFFAIRS / MISC ──────────────────────────────────────────────
  "Current Affairs > Reports and Global Indices",
  "Current Affairs > Government Schemes",
  "Current Affairs > Places in News",
  "Current Affairs > Awards and Personalities",
  "Current Affairs > Miscellaneous",
];

/**
 * Get all unique subject prefixes from PDF bucket list.
 * @returns {string[]}
 */
export function getPdfSubjects() {
  const subjects = new Set(PDF_BUCKETS.map(b => b.split(" > ")[0]));
  return Array.from(subjects);
}

/**
 * Check if a given subject+section combo is a registered PDF bucket.
 * @param {string} subject
 * @param {string} section
 * @returns {boolean}
 */
export function isValidPdfBucket(subject, section) {
  const key = `${subject} > ${section}`;
  return PDF_BUCKETS.includes(key);
}
