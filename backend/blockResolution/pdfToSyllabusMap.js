/**
 * backend/blockResolution/pdfToSyllabusMap.js
 *
 * DETERMINISTIC BRIDGE: PDF Section → Syllabus Node
 * ─────────────────────────────────────────────────────────
 * Key = "PDF Subject > PDF Section"  (from question.section field)
 * Value = { fallbackNodeId, allowedPrefixes, keywordsToNodeIds? }
 *
 * RULES:
 * - fallbackNodeId MUST exist in syllabus_node_ids_only.txt
 * - allowedPrefixes defines the subject lock boundary
 * - keywordsToNodeIds: optional keyword→node refinement (within allowedPrefixes only)
 * - NEVER map across subject boundaries
 * - MISC-GEN is NEVER used here
 */

export const PDF_TO_SYLLABUS_MAP = {

  // ═══════════════════════════════════════════════════════
  // ART AND CULTURE  →  1C-* nodes
  // ═══════════════════════════════════════════════════════

  "Art and Culture > Art and Craft in India": {
    fallbackNodeId: "1C-VA-ARCH",
    allowedPrefixes: ["1C-VA", "1C-PA", "1C-RLL", "1C-MISC"],
    keywordsToNodeIds: {
      "dance": "1C-PA-DANCE",
      "music": "1C-PA-MUSIC",
      "theatre": "1C-PA-THEATRE",
      "puppet": "1C-PA-PUPPET",
      "puppet theatre": "1C-PA-PUPPET",
      "painting": "1C-VA-PAINT",
      "pottery": "1C-VA-POTTERY",
      "numismatic": "1C-VA-NUMIS",
      "sculpture": "1C-VA-SCULP",
      "cave": "1C-VA-ARCH",
      "stupa": "1C-VA-ARCH",
      "temple": "1C-VA-ARCH",
    },
  },

  "Art and Culture > Indian Culture and Heritage": {
    fallbackNodeId: "1C-RLL-LANG",
    allowedPrefixes: ["1C-VA", "1C-PA", "1C-RLL", "1C-MISC"],
    keywordsToNodeIds: {
      "religion": "1C-RLL-RELIGION",
      "buddhism": "1C-RLL-RELIGION",
      "jainism": "1C-RLL-RELIGION",
      "sufi": "1C-RLL-RELIGION",
      "bhakti": "1C-RLL-RELIGION",
      "language": "1C-RLL-LANG",
    },
  },

  "Art and Culture > Architecture": {
    fallbackNodeId: "1C-VA-ARCH",
    allowedPrefixes: ["1C-VA"],
  },

  "Art and Culture > Sculpture": {
    fallbackNodeId: "1C-VA-SCULP",
    allowedPrefixes: ["1C-VA"],
  },

  "Art and Culture > Painting": {
    fallbackNodeId: "1C-VA-PAINT",
    allowedPrefixes: ["1C-VA"],
  },

  "Art and Culture > Literature and Language": {
    fallbackNodeId: "1C-RLL-LANG",
    allowedPrefixes: ["1C-RLL"],
  },

  "Art and Culture > Performing Arts": {
    fallbackNodeId: "1C-PA-DANCE",
    allowedPrefixes: ["1C-PA"],
    keywordsToNodeIds: {
      "dance": "1C-PA-DANCE",
      "music": "1C-PA-MUSIC",
      "theatre": "1C-PA-THEATRE",
      "puppet": "1C-PA-PUPPET",
      "sports": "1C-PA-SPORTS",
    },
  },

  "Art and Culture > Religion and Philosophy": {
    fallbackNodeId: "1C-RLL-RELIGION",
    allowedPrefixes: ["1C-RLL"],
  },

  "Art and Culture > Geographical Indications and Schemes": {
    fallbackNodeId: "1C-MISC-GI",
    allowedPrefixes: ["1C-MISC"],
    keywordsToNodeIds: {
      "scheme": "1C-MISC-SCHEMES",
      "institute": "1C-MISC-INST",
      "gi tag": "1C-MISC-GI",
      "geographical indication": "1C-MISC-GI",
    },
  },

  "Art and Culture > Institutions and UNESCO": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
    keywordsToNodeIds: {
      "unesco": "1C-MISC-UNESCO",
    },
  },

  // ═══════════════════════════════════════════════════════
  // ANCIENT HISTORY  →  GS1-HIS-ANC-*
  // ═══════════════════════════════════════════════════════

  "Ancient Indian History > Politics and Society": {
    fallbackNodeId: "1C-RLL-LANG",
    allowedPrefixes: ["GS1-HIS-ANC", "1C-RLL"],
    keywordsToNodeIds: {
      "ivc": "GS1-HIS-ANC-IVC",
      "harappa": "GS1-HIS-ANC-IVC",
      "vedic": "GS1-HIS-ANC-VEDIC-LATER",
      "rig": "GS1-HIS-ANC-VEDIC-RIG",
      "maurya": "GS1-HIS-ANC-MAURYA",
      "mahajanapada": "GS1-HIS-ANC-MAHAJAN",
      "gupta": "GS1-HIS-ANC-GUPTA",
      "sangam": "GS1-HIS-ANC-SANGAM",
      "harsha": "GS1-HIS-ANC-HARSHA",
    },
  },

  "Ancient Indian History > Prehistoric and IVC": {
    fallbackNodeId: "GS1-HIS-ANC-IVC",
    allowedPrefixes: ["GS1-HIS-ANC"],
    keywordsToNodeIds: {
      "prehistoric": "GS1-HIS-ANC-PREHIST",
      "mesolithic": "GS1-HIS-ANC-PREHIST",
      "neolithic": "GS1-HIS-ANC-PREHIST",
      "harappa": "GS1-HIS-ANC-IVC",
    },
  },

  "Ancient Indian History > Mauryan and Post-Mauryan": {
    fallbackNodeId: "GS1-HIS-ANC-MAURYA",
    allowedPrefixes: ["GS1-HIS-ANC"],
    keywordsToNodeIds: {
      "post-maurya": "GS1-HIS-ANC-POSTMAURYA",
      "shunga": "GS1-HIS-ANC-POSTMAURYA",
      "satavahana": "GS1-HIS-ANC-POSTMAURYA",
      "kushana": "GS1-HIS-ANC-POSTMAURYA",
    },
  },

  "Ancient Indian History > Gupta and Post-Gupta": {
    fallbackNodeId: "GS1-HIS-ANC-GUPTA",
    allowedPrefixes: ["GS1-HIS-ANC"],
    keywordsToNodeIds: {
      "harsha": "GS1-HIS-ANC-HARSHA",
    },
  },

  "Ancient Indian History > Sangam Age": {
    fallbackNodeId: "GS1-HIS-ANC-SANGAM",
    allowedPrefixes: ["GS1-HIS-ANC"],
  },

  "Ancient Indian History > Architecture": {
    fallbackNodeId: "1C-VA-ARCH",
    allowedPrefixes: ["1C-VA"],
  },

  "Ancient Indian History > Literature": {
    fallbackNodeId: "1C-RLL-LANG",
    allowedPrefixes: ["1C-RLL"],
  },

  "Ancient Indian History > Religion and Philosophy": {
    fallbackNodeId: "GS1-HIS-ANC-BUD",
    allowedPrefixes: ["GS1-HIS-ANC"],
    keywordsToNodeIds: {
      "buddhism": "GS1-HIS-ANC-BUD",
      "jainism": "GS1-HIS-ANC-JAIN",
      "vedic religion": "GS1-HIS-ANC-VEDIC-LATER",
    },
  },

  // ═══════════════════════════════════════════════════════
  // MEDIEVAL HISTORY  →  GS1-HIS-MED-*
  // ═══════════════════════════════════════════════════════

  "Medieval Indian History > Politics and Society": {
    fallbackNodeId: "GS1-HIS-MED-DELHI",
    allowedPrefixes: ["GS1-HIS-MED"],
    keywordsToNodeIds: {
      "mughal": "GS1-HIS-MED-MUGHAL",
      "vijayanagara": "GS1-HIS-MED-VIJAYANAGARA",
      "regional": "GS1-HIS-MED-REGIONAL",
      "chola": "GS1-HIS-MED-CHOLA",
      "18th century": "GS1-HIS-MED-18C",
    },
  },

  "Medieval Indian History > Advent of Europeans in India": {
    fallbackNodeId: "GS1-HIS-MOD-EURO",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },

  "Medieval Indian History > Art, Architecture and Literature": {
    fallbackNodeId: "1C-VA-ARCH",
    allowedPrefixes: ["1C-VA", "1C-RLL"],
    keywordsToNodeIds: {
      "literature": "1C-RLL-LANG",
      "painting": "1C-VA-PAINT",
    },
  },

  "Medieval Indian History > Religion and Philosophy": {
    fallbackNodeId: "GS1-HIS-MED-BHAKTI",
    allowedPrefixes: ["GS1-HIS-MED"],
    keywordsToNodeIds: {
      "sufi": "GS1-HIS-MED-SUFI",
    },
  },

  "Medieval Indian History > Delhi Sultanate": {
    fallbackNodeId: "GS1-HIS-MED-DELHI",
    allowedPrefixes: ["GS1-HIS-MED"],
  },

  "Medieval Indian History > Mughal Empire": {
    fallbackNodeId: "GS1-HIS-MED-MUGHAL",
    allowedPrefixes: ["GS1-HIS-MED"],
  },

  "Medieval Indian History > Bhakti and Sufi Movements": {
    fallbackNodeId: "GS1-HIS-MED-BHAKTI",
    allowedPrefixes: ["GS1-HIS-MED"],
    keywordsToNodeIds: {
      "sufi": "GS1-HIS-MED-SUFI",
    },
  },

  "Medieval Indian History > Vijayanagara and Regional Kingdoms": {
    fallbackNodeId: "GS1-HIS-MED-VIJAYANAGARA",
    allowedPrefixes: ["GS1-HIS-MED"],
    keywordsToNodeIds: {
      "regional": "GS1-HIS-MED-REGIONAL",
      "chola": "GS1-HIS-MED-CHOLA",
    },
  },

  // ═══════════════════════════════════════════════════════
  // MODERN HISTORY  →  GS1-HIS-MOD-*
  // ═══════════════════════════════════════════════════════

  "Modern Indian History > Establishment of British Rule (1750-1857)": {
    fallbackNodeId: "GS1-HIS-MOD-EXPANSION",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },

  "Modern Indian History > The Revolt of 1857": {
    fallbackNodeId: "GS1-HIS-MOD-1857",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },

  "Modern Indian History > Social Reforms and Reformers": {
    fallbackNodeId: "GS1-HIS-MOD-REFORM",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },

  "Modern Indian History > Constitutional Development and Acts": {
    fallbackNodeId: "GS1-HIS-MOD-CONSTDEV",
    allowedPrefixes: ["GS1-HIS-MOD"],
    keywordsToNodeIds: {
      "administration": "GS1-HIS-MOD-ADMIN",
    },
  },

  "Modern Indian History > Nationalist Movement and Freedom Struggle": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },

  "Modern Indian History > Governor Generals and Administration": {
    fallbackNodeId: "GS1-HIS-MOD-ADMIN",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },

  "Modern Indian History > Post-Independence Integration": {
    fallbackNodeId: "GS1-HIS-POSTIND-INTEGRATION",
    allowedPrefixes: ["GS1-HIS-POSTIND"],
    keywordsToNodeIds: {
      "economic": "GS1-HIS-POSTIND-ECON",
      "political": "GS1-HIS-POSTIND-POL",
    },
  },

  // ═══════════════════════════════════════════════════════
  // GEOGRAPHY  →  GS1-GEO-*
  // ═══════════════════════════════════════════════════════

  "Geography > Physical Geography - Geomorphology": {
    fallbackNodeId: "GS1-GEO-GM-LANDFORMS",
    allowedPrefixes: ["GS1-GEO-GM"],
    keywordsToNodeIds: {
      "earthquake": "GS1-GEO-GM-EQ-VOL",
      "volcano": "GS1-GEO-GM-EQ-VOL",
      "plate": "GS1-GEO-GM-PLATE",
      "interior": "GS1-GEO-GM-INTERIOR",
      "rock": "GS1-GEO-GM-MINERALS-ROCKS",
      "mineral": "GS1-GEO-GM-MINERALS-ROCKS",
      "weathering": "GS1-GEO-GM-WEATHERING-SOIL",
      "world facts": "GS1-GEO-GM-WORLD-FACTS",
    },
  },

  "Geography > Physical Geography - Climatology": {
    fallbackNodeId: "GS1-GEO-CLIM-SYSTEMS",
    allowedPrefixes: ["GS1-GEO-CLIM"],
    keywordsToNodeIds: {
      "atmosphere": "GS1-GEO-CLIM-ATM",
      "insolation": "GS1-GEO-CLIM-INSOLATION",
      "koppen": "GS1-GEO-CLIM-KOPPEN",
      "precipitation": "GS1-GEO-CLIM-PRECIP",
      "pressure": "GS1-GEO-CLIM-PRESSURE-WINDS",
      "wind": "GS1-GEO-CLIM-PRESSURE-WINDS",
    },
  },

  "Geography > Physical Geography - Oceanography": {
    fallbackNodeId: "GS1-GEO-OCE-MOTIONS",
    allowedPrefixes: ["GS1-GEO-OCE"],
    keywordsToNodeIds: {
      "hydrology": "GS1-GEO-OCE-HYDRO",
      "relief": "GS1-GEO-OCE-RELIEF",
      "temperature": "GS1-GEO-OCE-TEMP-SAL",
      "salinity": "GS1-GEO-OCE-TEMP-SAL",
      "resource": "GS1-GEO-OCE-RESOURCES",
    },
  },

  "Geography > Physical Geography - Soils and Vegetation": {
    fallbackNodeId: "GS1-GEO-BIO-VEG",
    allowedPrefixes: ["GS1-GEO-BIO"],
    keywordsToNodeIds: {
      "soil": "GS1-GEO-BIO-SOIL",
    },
  },

  "Geography > Indian Geography - Physiography": {
    fallbackNodeId: "GS1-GEO-IND-PHYSIO",
    allowedPrefixes: ["GS1-GEO-IND"],
  },

  "Geography > Indian Geography - Climate and Monsoon": {
    fallbackNodeId: "GS1-GEO-IND-CLIMATE",
    allowedPrefixes: ["GS1-GEO-IND"],
  },

  "Geography > Indian Geography - Rivers and Drainage": {
    fallbackNodeId: "GS1-GEO-IND-DRAINAGE",
    allowedPrefixes: ["GS1-GEO-IND"],
  },

  "Geography > Indian Geography - Agriculture": {
    fallbackNodeId: "GS1-GEO-IND-AGRI",
    allowedPrefixes: ["GS1-GEO-IND"],
  },

  "Geography > Indian Geography - Resources and Minerals": {
    fallbackNodeId: "GS1-GEO-IND-RESOURCES",
    allowedPrefixes: ["GS1-GEO-IND"],
  },

  "Geography > Indian Geography - Population and Urbanization": {
    fallbackNodeId: "GS1-GEO-IND-POP-URBAN",
    allowedPrefixes: ["GS1-GEO-IND"],
  },

  "Geography > World Geography - Locations and Maps": {
    fallbackNodeId: "GS1-GEO-PRE-REGIONAL-PLACES",
    allowedPrefixes: ["GS1-GEO"],
  },

  "Geography > World Geography - Landforms": {
    fallbackNodeId: "GS1-GEO-GM-LANDFORMS",
    allowedPrefixes: ["GS1-GEO-GM"],
  },

  "Geography > Human Geography": {
    fallbackNodeId: "GS1-GEO-HEW-ACTIVITIES",
    allowedPrefixes: ["GS1-GEO-HEW"],
    keywordsToNodeIds: {
      "population": "GS1-GEO-HEW-POP",
      "settlement": "GS1-GEO-HEW-SETTLEMENTS",
      "transport": "GS1-GEO-HEW-TRANSPORT-TRADE",
    },
  },

  // ═══════════════════════════════════════════════════════
  // POLITY  →  GS2-POL-*
  // CRITICAL: Only use nodeIds that exist in syllabus_node_ids_only.txt
  // Valid nodes: GS2-POL-AMEND, GS2-POL-BODIES, GS2-POL-CITIZEN,
  //   GS2-POL-CONTEMP, GS2-POL-CSREL, GS2-POL-DOCTRINES, GS2-POL-DPSP,
  //   GS2-POL-ELECTIONS, GS2-POL-EMER, GS2-POL-EVOL-CA, GS2-POL-EVOL-COMPANY,
  //   GS2-POL-EVOL-CROWN, GS2-POL-EXEC, GS2-POL-FD, GS2-POL-FR,
  //   GS2-POL-JUD, GS2-POL-LOCAL, GS2-POL-PARL, GS2-POL-PREAMBLE,
  //   GS2-POL-STATE, GS2-POL-UTERR, GS2-POL-UTS
  // ═══════════════════════════════════════════════════════

  "Indian Polity > Historical Background and Constitutional Making": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
    keywordsToNodeIds: {
      "company": "GS2-POL-EVOL-COMPANY",
      "crown": "GS2-POL-EVOL-CROWN",
      "constitutional acts": "GS2-POL-EVOL-CA",
    },
  },

  "Indian Polity > Preamble and Key Features": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Fundamental Rights": {
    fallbackNodeId: "GS2-POL-FR",
    allowedPrefixes: ["GS2-POL"],
    keywordsToNodeIds: {
      "writ": "GS2-POL-FR",
      "article 14": "GS2-POL-FR",
      "article 19": "GS2-POL-FR",
      "article 21": "GS2-POL-FR",
      "citizenship": "GS2-POL-CITIZEN",
    },
  },

  "Indian Polity > DPSP and Fundamental Duties": {
    fallbackNodeId: "GS2-POL-DPSP",
    allowedPrefixes: ["GS2-POL"],
    keywordsToNodeIds: {
      "fundamental duties": "GS2-POL-FD",
    },
  },

  "Indian Polity > Executive - President and Vice President": {
    fallbackNodeId: "GS2-POL-EXEC",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Executive - Prime Minister and Council of Ministers": {
    fallbackNodeId: "GS2-POL-EXEC",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Executive - Governor and State Executive": {
    fallbackNodeId: "GS2-POL-STATE",
    allowedPrefixes: ["GS2-POL"],
    keywordsToNodeIds: {
      "governor": "GS2-POL-STATE",
      "chief minister": "GS2-POL-STATE",
      "ordinance": "GS2-POL-EXEC",
    },
  },

  "Indian Polity > Parliament and Legislature": {
    fallbackNodeId: "GS2-POL-PARL",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Judiciary": {
    fallbackNodeId: "GS2-POL-JUD",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Federalism and Center-State Relations": {
    fallbackNodeId: "GS2-POL-CSREL",
    allowedPrefixes: ["GS2-POL"],
    keywordsToNodeIds: {
      "union territory": "GS2-POL-UTS",
      "scheduled area": "GS2-POL-UTERR",
    },
  },

  "Indian Polity > Amendments": {
    fallbackNodeId: "GS2-POL-AMEND",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Elections and Representation": {
    fallbackNodeId: "GS2-POL-ELECTIONS",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Constitutional Bodies": {
    fallbackNodeId: "GS2-POL-BODIES",
    allowedPrefixes: ["GS2-POL"],
    keywordsToNodeIds: {
      "election commission": "GS2-POL-ELECTIONS",
      "cag": "GS2-POL-BODIES",
      "upsc": "GS2-POL-BODIES",
    },
  },

  "Indian Polity > Non-Constitutional Bodies": {
    fallbackNodeId: "GS2-POL-CONTEMP",
    allowedPrefixes: ["GS2-POL"],
    keywordsToNodeIds: {
      "niti aayog": "GS2-POL-CONTEMP",
      "nhrc": "GS2-POL-JUD",
    },
  },

  "Indian Polity > Local Self Government": {
    fallbackNodeId: "GS2-POL-LOCAL",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Emergency Provisions": {
    fallbackNodeId: "GS2-POL-EMER",
    allowedPrefixes: ["GS2-POL"],
  },

  "Indian Polity > Governance": {
    fallbackNodeId: "GS2-POL-CONTEMP",
    allowedPrefixes: ["GS2-POL"],
  },

  // Alias for section labels from the actual tagged files
  "Constitutional and Non-constitutional Bodies": {
    fallbackNodeId: "GS2-POL-BODIES",
    allowedPrefixes: ["GS2-POL"],
  },
  "Executive": {
    fallbackNodeId: "GS2-POL-EXEC",
    allowedPrefixes: ["GS2-POL"],
  },
  "Features of the Indian Constitution": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
  },
  "Legislature": {
    fallbackNodeId: "GS2-POL-PARL",
    allowedPrefixes: ["GS2-POL"],
  },
  "Judiciary": {
    fallbackNodeId: "GS2-POL-JUD",
    allowedPrefixes: ["GS2-POL"],
  },
  "Local Self Government": {
    fallbackNodeId: "GS2-POL-LOCAL",
    allowedPrefixes: ["GS2-POL"],
  },
  "Governance": {
    fallbackNodeId: "GS2-POL-CONTEMP",
    allowedPrefixes: ["GS2-POL"],
  },
  "Historical Background & Making of Indian Constitution": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
  },

  // ═══════════════════════════════════════════════════════
  // ECONOMY  →  GS3-ECO-PRE-* / GS3-ECO-SECT-*
  // ═══════════════════════════════════════════════════════

  "Indian Economy > Banking Structure": {
    fallbackNodeId: "GS3-ECO-PRE-BANKING-STRUCTURE",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > NPA and Credit Quality": {
    fallbackNodeId: "GS3-ECO-PRE-BANKING-STRUCTURE",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Monetary Policy and RBI": {
    fallbackNodeId: "GS3-ECO-PRE-MONEY-BASICS",
    allowedPrefixes: ["GS3-ECO"],
    keywordsToNodeIds: {
      "repo": "GS3-ECO-PRE-MONEY-BASICS",
      "mpc": "GS3-ECO-PRE-MONEY-BASICS",
      "rbi": "GS3-ECO-PRE-BANKING-STRUCTURE",
    },
  },

  "Indian Economy > Inflation and Price Indices": {
    fallbackNodeId: "GS3-ECO-PRE-INFLATION",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Budget and Fiscal Policy": {
    fallbackNodeId: "GS3-ECO-PRE-BUDGET",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Taxation - Direct": {
    fallbackNodeId: "GS3-ECO-PRE-TAX",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Taxation - Indirect and GST": {
    fallbackNodeId: "GS3-ECO-PRE-TAX",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Financial Markets and Capital Market": {
    fallbackNodeId: "GS3-ECO-PRE-FIN-MARKETS",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Insurance, Pension, Financial Inclusion": {
    fallbackNodeId: "GS3-ECO-PRE-POVERTY",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > External Sector and BOP": {
    fallbackNodeId: "GS3-ECO-PRE-BOP",
    allowedPrefixes: ["GS3-ECO"],
    keywordsToNodeIds: {
      "forex": "GS3-ECO-PRE-MONEY-BASICS",
      "trade": "GS3-ECO-PRE-BOP",
    },
  },

  "Indian Economy > International Economic Organisations": {
    fallbackNodeId: "GS3-ECO-PRE-BANKING-STRUCTURE",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Growth, Development and Planning": {
    fallbackNodeId: "GS3-ECO-PRE-GROWTH",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Poverty and Inclusion": {
    fallbackNodeId: "GS3-ECO-PRE-POVERTY",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Agriculture Sector": {
    fallbackNodeId: "GS3-ECO-SECT-AGRI",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Industry and Labour": {
    fallbackNodeId: "GS3-ECO-SECT-INDLAB",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Infrastructure and Energy": {
    fallbackNodeId: "GS3-ECO-SECT-INFRA",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Finance Commission and Devolution": {
    fallbackNodeId: "GS3-ECO-PRE-MONEY-BASICS",
    allowedPrefixes: ["GS3-ECO"],
  },

  "Indian Economy > Black Money and Subsidies": {
    fallbackNodeId: "GS3-ECO-PRE-BUDGET",
    allowedPrefixes: ["GS3-ECO"],
  },

  // ═══════════════════════════════════════════════════════
  // ENVIRONMENT  →  GS3-ENV-*
  // ═══════════════════════════════════════════════════════

  "Environment > Biodiversity": {
    fallbackNodeId: "GS3-ENV-BIOGEO",
    allowedPrefixes: ["GS3-ENV"],
  },

  "Environment > Species in News": {
    fallbackNodeId: "GS3-ENV-BIOGEO",
    allowedPrefixes: ["GS3-ENV"],
    keywordsToNodeIds: {
      "species": "GS3-ENV-SPECIES",
    },
  },

  "Environment > Climate Change": {
    fallbackNodeId: "GS3-ENV-CLIMATEPHEN",
    allowedPrefixes: ["GS3-ENV"],
    keywordsToNodeIds: {
      "cop": "GS3-ENV-CURR-CLIMATE",
      "paris": "GS3-ENV-CURR-CLIMATE",
      "unfccc": "GS3-ENV-CURR-CLIMATE",
      "ghg": "GS3-ENV-CLIMATEPHEN",
      "global warming": "GS3-ENV-GLOBALWARM",
    },
  },

  "Environment > Ecology Concepts": {
    fallbackNodeId: "GS3-ENV-ECO-CONCEPTS",
    allowedPrefixes: ["GS3-ENV"],
  },

  "Environment > Environmental Pollution": {
    fallbackNodeId: "GS3-ENV-CURR-POLLUTION",
    allowedPrefixes: ["GS3-ENV"],
    keywordsToNodeIds: {
      "river": "GS3-ENV-CURR-RIVERS",
      "waste": "GS3-ENV-WASTE",
      "air": "GS3-ENV-AIR",
      "land": "GS3-ENV-LAND-WATER",
      "water": "GS3-ENV-LAND-WATER",
    },
  },

  "Environment > Conservation and Protected Areas": {
    fallbackNodeId: "GS3-ENV-CONSERVATION",
    allowedPrefixes: ["GS3-ENV"],
  },

  "Environment > Environmental Legislation and Acts": {
    fallbackNodeId: "GS3-ENV-ACTS",
    allowedPrefixes: ["GS3-ENV"],
  },

  "Environment > International Environmental Conventions": {
    fallbackNodeId: "GS3-ENV-INTL",
    allowedPrefixes: ["GS3-ENV"],
  },

  "Environment > Energy and Sustainability": {
    fallbackNodeId: "GS3-ENV-ENERGY",
    allowedPrefixes: ["GS3-ENV"],
    keywordsToNodeIds: {
      "governance": "GS3-ENV-ENERGY-GOV",
    },
  },

  "Environment > Agriculture and Environment": {
    fallbackNodeId: "GS3-ENV-CURR-CLIMATE",
    allowedPrefixes: ["GS3-ENV"],
  },

  // ═══════════════════════════════════════════════════════
  // SCIENCE AND TECHNOLOGY  →  GS3-ST-*
  // ═══════════════════════════════════════════════════════

  "Science and Technology > Biotechnology": {
    fallbackNodeId: "GS3-ST-BIOTECH",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > Space": {
    fallbackNodeId: "GS3-ST-SPACE",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > Defence Technology": {
    fallbackNodeId: "GS3-ST-DEFENCE",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > IT and Communications": {
    fallbackNodeId: "GS3-ST-IT-COMM",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > AI and Emerging Technology": {
    fallbackNodeId: "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > Nuclear Technology": {
    fallbackNodeId: "GS3-ST-NUCLEAR",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > Health and Diseases": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > Physics and Chemistry": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > Materials and Nanotechnology": {
    fallbackNodeId: "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
    allowedPrefixes: ["GS3-ST"],
  },

  "Science and Technology > IPR and Technology Policy": {
    fallbackNodeId: "GS3-ST-IPR",
    allowedPrefixes: ["GS3-ST"],
  },

  // ═══════════════════════════════════════════════════════
  // INTERNATIONAL RELATIONS  →  GS2-IR-*
  // ═══════════════════════════════════════════════════════

  "International Relations > International Organisations": {
    fallbackNodeId: "GS2-IR-INSTITUTIONS",
    allowedPrefixes: ["GS2-IR"],
  },

  "International Relations > Regional Groupings": {
    fallbackNodeId: "GS2-IR-GROUPINGS",
    allowedPrefixes: ["GS2-IR"],
  },

  "International Relations > India's Neighbours": {
    fallbackNodeId: "GS2-IR-NEIGHBOURS",
    allowedPrefixes: ["GS2-IR"],
  },

  "International Relations > Major Powers - USA, China, Russia": {
    fallbackNodeId: "GS2-IR-MAJOR-POWERS",
    allowedPrefixes: ["GS2-IR"],
  },

  "International Relations > WTO, IMF, World Bank": {
    fallbackNodeId: "GS2-IR-INSTITUTIONS",
    allowedPrefixes: ["GS2-IR"],
  },

  "International Relations > Agreements and Treaties": {
    fallbackNodeId: "GS2-IR-CLIMATE-DISARM",
    allowedPrefixes: ["GS2-IR"],
    keywordsToNodeIds: {
      "asean": "GS2-IR-ASEAN-EAP",
    },
  },

  "International Relations > West Asia and Middle East": {
    fallbackNodeId: "GS2-IR-WEST-ASIA",
    allowedPrefixes: ["GS2-IR"],
  },

  "International Relations > Climate and Disarmament": {
    fallbackNodeId: "GS2-IR-CLIMATE-DISARM",
    allowedPrefixes: ["GS2-IR"],
  },

  // ═══════════════════════════════════════════════════════
  // SOCIETY  →  GS1-SOC-*
  // ═══════════════════════════════════════════════════════

  "Society > Social Issues and Empowerment": {
    fallbackNodeId: "GS1-SOC-UPSC-EMPOWER",
    allowedPrefixes: ["GS1-SOC"],
    keywordsToNodeIds: {
      "sc": "GS1-SOC-EMPOWER-SC",
      "tribal": "GS1-SOC-EMPOWER-TRIBAL",
      "minority": "GS1-SOC-EMPOWER-MINOR",
    },
  },

  "Society > Women Empowerment": {
    fallbackNodeId: "GS1-SOC-UPSC-WOMEN",
    allowedPrefixes: ["GS1-SOC"],
    keywordsToNodeIds: {
      "laws": "GS1-SOC-WOMEN-LAWS",
    },
  },

  "Society > Tribal Issues": {
    fallbackNodeId: "GS1-SOC-EMPOWER-TRIBAL",
    allowedPrefixes: ["GS1-SOC"],
  },

  "Society > Population and Urbanization": {
    fallbackNodeId: "GS1-SOC-DEV-URBAN",
    allowedPrefixes: ["GS1-SOC"],
    keywordsToNodeIds: {
      "census": "GS1-SOC-DEV-CENSUS",
      "poverty": "GS1-SOC-DEV-POVERTY",
    },
  },

  // ═══════════════════════════════════════════════════════
  // CURRENT AFFAIRS / MISC  →  1C-MISC-*
  // ═══════════════════════════════════════════════════════

  "Current Affairs > Reports and Global Indices": {
    fallbackNodeId: "1C-MISC-GI",
    allowedPrefixes: ["1C-MISC"],
  },

  "Current Affairs > Government Schemes": {
    fallbackNodeId: "1C-MISC-SCHEMES",
    allowedPrefixes: ["1C-MISC"],
  },

  "Current Affairs > Places in News": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },

  "Current Affairs > Awards and Personalities": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },

  "Current Affairs > Miscellaneous": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },

  // ═══════════════════════════════════════════════════════
  // RAW SECTION ALIASES — exact labels from source tagged files
  // These cover all 29 sections that were not being found via composite key
  // ═══════════════════════════════════════════════════════

  // ── Current Affairs cross-subject sections ──────────────────────────────
  "Economy > Current Affairs: India": {
    fallbackNodeId: "GS3-ECO-PRE-GROWTH",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > Current Affairs: World": {
    fallbackNodeId: "GS3-ECO-PRE-BOP",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Environment > Current Affairs: World": {
    fallbackNodeId: "GS3-ENV-CURR-CLIMATE",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environment > Miscellaneous": {
    fallbackNodeId: "GS3-ENV-ECO-CONCEPTS",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Geography > Current Affairs: India": {
    fallbackNodeId: "GS1-GEO-IND-RESOURCES",
    allowedPrefixes: ["GS1-GEO"],
  },
  "Geography > Current Affairs: World": {
    fallbackNodeId: "GS1-GEO-PRE-REGIONAL-PLACES",
    allowedPrefixes: ["GS1-GEO"],
  },
  "Polity > Current Affairs: India": {
    fallbackNodeId: "GS2-POL-CONTEMP",
    allowedPrefixes: ["GS2-POL"],
  },

  // ── History & Culture raw section labels ─────────────────────────────────
  "History & Culture > Architecture and Sculpture": {
    fallbackNodeId: "1C-VA-ARCH",
    allowedPrefixes: ["1C-VA"],
  },
  "History & Culture > Current Affairs: India": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "History & Culture > GK/Persons in News": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "History & Culture > Indian Philosophy and Bhakti & Sufi Movements": {
    fallbackNodeId: "GS1-HIS-MED-BHAKTI",
    allowedPrefixes: ["GS1-HIS-MED"],
    keywordsToNodeIds: {
      "sufi": "GS1-HIS-MED-SUFI",
      "jain": "GS1-HIS-ANC-JAIN",
      "buddhism": "GS1-HIS-ANC-BUD",
    },
  },
  "History & Culture > Indian Traditions, Festivals, and Calendars": {
    fallbackNodeId: "1C-RLL-RELIGION",
    allowedPrefixes: ["1C-RLL", "1C-MISC"],
  },
  "History & Culture > Literature: Religious and Scientific": {
    fallbackNodeId: "1C-RLL-LANG",
    allowedPrefixes: ["1C-RLL"],
  },
  "History & Culture > Miscellaneous": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "History & Culture > Performing Arts: Dance, Theatre and Music": {
    fallbackNodeId: "1C-PA-DANCE",
    allowedPrefixes: ["1C-PA"],
    keywordsToNodeIds: {
      "music": "1C-PA-MUSIC",
      "theatre": "1C-PA-THEATRE",
    },
  },
  "History & Culture > Visual Arts: Painting, ceramics and drawing": {
    fallbackNodeId: "1C-VA-PAINT",
    allowedPrefixes: ["1C-VA"],
    keywordsToNodeIds: {
      "pottery": "1C-VA-POTTERY",
      "ceramics": "1C-VA-POTTERY",
    },
  },

  // ── Science & Technology raw section labels ──────────────────────────────
  "Science & Technology > Biology": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
    keywordsToNodeIds: {
      "biotechnology": "GS3-ST-BIOTECH",
      "gene": "GS3-ST-BIOTECH",
      "vaccine": "GS3-ST-BIOTECH",
    },
  },
  "Science & Technology > Chemistry": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Communication Technology": {
    fallbackNodeId: "GS3-ST-IT-COMM",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Current Affairs: India": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Current Affairs: World": {
    fallbackNodeId: "GS3-ST-SPACE",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Energy": {
    fallbackNodeId: "GS3-ENV-ENERGY",
    allowedPrefixes: ["GS3-ENV", "GS3-ST"],
  },
  "Science & Technology > Miscellaneous": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Physics": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
    keywordsToNodeIds: {
      "nuclear": "GS3-ST-NUCLEAR",
      "nano": "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
    },
  },
  "Science & Technology > Space Science": {
    fallbackNodeId: "GS3-ST-SPACE",
    allowedPrefixes: ["GS3-ST"],
  },

  // also handle without "&" variants used by some CSV parsers
  "Science and Technology > Biology": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science and Technology > Chemistry": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science and Technology > Communication Technology": {
    fallbackNodeId: "GS3-ST-IT-COMM",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science and Technology > Current Affairs: India": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science and Technology > Current Affairs: World": {
    fallbackNodeId: "GS3-ST-SPACE",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science and Technology > Energy": {
    fallbackNodeId: "GS3-ENV-ENERGY",
    allowedPrefixes: ["GS3-ENV", "GS3-ST"],
  },
  "Science and Technology > Miscellaneous": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science and Technology > Physics": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science and Technology > Space Science": {
    fallbackNodeId: "GS3-ST-SPACE",
    allowedPrefixes: ["GS3-ST"],
  },

  // ── Unknown subject sections → best guess based on section label ──────────
  "Unknown > Current Affairs: India": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "Unknown > Current Affairs: World": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "Unknown > GK/Persons in News": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "Unknown > Miscellaneous": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },

  // ── IR leakage fix — section key used in non-IR tagged files ─────────────
  "International Groups and Political Organizations": {
    fallbackNodeId: "GS2-IR-GROUPINGS",
    allowedPrefixes: ["GS2-IR"],
  },
  "Places in news": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "GK/Persons in News": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "Biodiversity": {
    fallbackNodeId: "GS3-ENV-BIOGEO",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environmental Pollution": {
    fallbackNodeId: "GS3-ENV-CURR-POLLUTION",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Biotechnology": {
    fallbackNodeId: "GS3-ST-BIOTECH",
    allowedPrefixes: ["GS3-ST"],
  },
  "Communication Technology": {
    fallbackNodeId: "GS3-ST-IT-COMM",
    allowedPrefixes: ["GS3-ST"],
  },
  "Defence Technology": {
    fallbackNodeId: "GS3-ST-DEFENCE",
    allowedPrefixes: ["GS3-ST"],
  },

  // ═══════════════════════════════════════════════════════
  // ART & CULTURE (actual subject name in source files)
  // ═══════════════════════════════════════════════════════
  "Art & Culture > Architecture and Sculpture": {
    fallbackNodeId: "1C-VA-ARCH",
    allowedPrefixes: ["1C-VA"],
    keywordsToNodeIds: { "sculpture": "1C-VA-SCULP" },
  },
  "Art & Culture > Performing Arts: Dance, Theatre and Music": {
    fallbackNodeId: "1C-PA-DANCE",
    allowedPrefixes: ["1C-PA"],
    keywordsToNodeIds: { "music": "1C-PA-MUSIC", "theatre": "1C-PA-THEATRE" },
  },
  "Art & Culture > Literature: Religious and Scientific": {
    fallbackNodeId: "1C-RLL-LANG",
    allowedPrefixes: ["1C-RLL"],
  },
  "Art & Culture > Indian Philosophy and Bhakti & Sufi Movements": {
    fallbackNodeId: "1C-RLL-RELIGION",
    allowedPrefixes: ["1C-RLL"],
    keywordsToNodeIds: { "sufi": "GS1-HIS-MED-SUFI", "bhakti": "GS1-HIS-MED-BHAKTI" },
  },
  "Art & Culture > Miscellaneous": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "Art & Culture > Indian Traditions, Festivals, and Calendars": {
    fallbackNodeId: "1C-RLL-RELIGION",
    allowedPrefixes: ["1C-RLL", "1C-MISC"],
  },
  "Art & Culture > Visual Arts: Painting, ceramics and drawing": {
    fallbackNodeId: "1C-VA-PAINT",
    allowedPrefixes: ["1C-VA"],
    keywordsToNodeIds: { "pottery": "1C-VA-POTTERY", "ceramics": "1C-VA-POTTERY" },
  },
  "Art & Culture > GK/Persons in News": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "Art & Culture > Current Affairs: India": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },

  // ═══════════════════════════════════════════════════════
  // HISTORY & CULTURE (actual subject name in source files)
  // ═══════════════════════════════════════════════════════
  "History & Culture > Architecture and Sculpture": {
    fallbackNodeId: "1C-VA-ARCH",
    allowedPrefixes: ["1C-VA"],
  },
  "History & Culture > Current Affairs: India": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "History & Culture > GK/Persons in News": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "History & Culture > Indian Philosophy and Bhakti & Sufi Movements": {
    fallbackNodeId: "GS1-HIS-MED-BHAKTI",
    allowedPrefixes: ["GS1-HIS-MED"],
    keywordsToNodeIds: {
      "sufi": "GS1-HIS-MED-SUFI",
      "jain": "GS1-HIS-ANC-JAIN",
      "buddhism": "GS1-HIS-ANC-BUD",
    },
  },
  "History & Culture > Indian Traditions, Festivals, and Calendars": {
    fallbackNodeId: "1C-RLL-RELIGION",
    allowedPrefixes: ["1C-RLL", "1C-MISC"],
  },
  "History & Culture > Literature: Religious and Scientific": {
    fallbackNodeId: "1C-RLL-LANG",
    allowedPrefixes: ["1C-RLL"],
  },
  "History & Culture > Miscellaneous": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "History & Culture > Performing Arts: Dance, Theatre and Music": {
    fallbackNodeId: "1C-PA-DANCE",
    allowedPrefixes: ["1C-PA"],
    keywordsToNodeIds: { "music": "1C-PA-MUSIC", "theatre": "1C-PA-THEATRE" },
  },
  "History & Culture > Visual Arts: Painting, ceramics and drawing": {
    fallbackNodeId: "1C-VA-PAINT",
    allowedPrefixes: ["1C-VA"],
    keywordsToNodeIds: { "pottery": "1C-VA-POTTERY", "ceramics": "1C-VA-POTTERY" },
  },
  "History & Culture > Delhi Sultanate (1206 AD to 1526 AD)": {
    fallbackNodeId: "GS1-HIS-MED-DELHI",
    allowedPrefixes: ["GS1-HIS-MED"],
  },
  "History & Culture > Mughal Empire (1526 AD to 1761 AD)": {
    fallbackNodeId: "GS1-HIS-MED-MUGHAL",
    allowedPrefixes: ["GS1-HIS-MED"],
  },
  "History & Culture > Provincial Kingdoms in Medieval India": {
    fallbackNodeId: "GS1-HIS-MED-REGIONAL",
    allowedPrefixes: ["GS1-HIS-MED"],
  },
  "History & Culture > Religious movement during medieval period": {
    fallbackNodeId: "GS1-HIS-MED-BHAKTI",
    allowedPrefixes: ["GS1-HIS-MED"],
    keywordsToNodeIds: { "sufi": "GS1-HIS-MED-SUFI" },
  },
  "History & Culture > Gupta and Post- Gupta Age": {
    fallbackNodeId: "GS1-HIS-ANC-GUPTA",
    allowedPrefixes: ["GS1-HIS-ANC"],
    keywordsToNodeIds: { "harsha": "GS1-HIS-ANC-HARSHA" },
  },
  "History & Culture > Mauryan and Post-Mauryan Age": {
    fallbackNodeId: "GS1-HIS-ANC-MAURYA",
    allowedPrefixes: ["GS1-HIS-ANC"],
  },
  "History & Culture > Prehistoric Period and Indus Valley Civilisation": {
    fallbackNodeId: "GS1-HIS-ANC-IVC",
    allowedPrefixes: ["GS1-HIS-ANC"],
    keywordsToNodeIds: { "prehistoric": "GS1-HIS-ANC-PREHIST" },
  },
  "History & Culture > Sangam Age": {
    fallbackNodeId: "GS1-HIS-ANC-SANGAM",
    allowedPrefixes: ["GS1-HIS-ANC"],
  },
  "History & Culture > Vedic and Later Vedic Age": {
    fallbackNodeId: "GS1-HIS-ANC-VEDIC-LATER",
    allowedPrefixes: ["GS1-HIS-ANC"],
    keywordsToNodeIds: { "rig": "GS1-HIS-ANC-VEDIC-RIG" },
  },
  "History & Culture > India in the 18th Century": {
    fallbackNodeId: "GS1-HIS-MED-18C",
    allowedPrefixes: ["GS1-HIS-MED"],
  },
  "History & Culture > Indian Renaissance and Reform Movements": {
    fallbackNodeId: "GS1-HIS-MOD-REFORM",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "History & Culture > The Beginning of Gandhian Era": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "History & Culture > Independence to Partition": {
    fallbackNodeId: "GS1-HIS-POSTIND-INTEGRATION",
    allowedPrefixes: ["GS1-HIS-POSTIND"],
  },
  "History & Culture > The National Movement in the 1940s": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "History & Culture > Phases of Revolutionary Nationalism": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "History & Culture > Development of Press, Education and Civil Services": {
    fallbackNodeId: "GS1-HIS-MOD-ADMIN",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "History & Culture > Early Uprising Against the British and Revolt of 1857": {
    fallbackNodeId: "GS1-HIS-MOD-1857",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "History & Culture > Rise of Indian National Movement: Moderate and Extremists Phase": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "History & Culture > International Groups and Political Organizations": {
    fallbackNodeId: "GS2-IR-GROUPINGS",
    allowedPrefixes: ["GS2-IR"],
  },

  // Modern History (actual subject label)
  "Modern History > India in the 18th Century": {
    fallbackNodeId: "GS1-HIS-MED-18C",
    allowedPrefixes: ["GS1-HIS-MED"],
  },
  "Modern History > Indian Renaissance and Reform Movements": {
    fallbackNodeId: "GS1-HIS-MOD-REFORM",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "Modern History > The Beginning of Gandhian Era": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "Modern History > Independence to Partition": {
    fallbackNodeId: "GS1-HIS-POSTIND-INTEGRATION",
    allowedPrefixes: ["GS1-HIS-POSTIND"],
  },
  "Modern History > The National Movement in the 1940s": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "Modern History > Phases of Revolutionary Nationalism": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "Modern History > Development of Press, Education and Civil Services": {
    fallbackNodeId: "GS1-HIS-MOD-ADMIN",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "Modern History > Early Uprising Against the British and Revolt of 1857": {
    fallbackNodeId: "GS1-HIS-MOD-1857",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },
  "Modern History > Rise of Indian National Movement: Moderate and Extremists Phase": {
    fallbackNodeId: "GS1-HIS-MOD-NATIONAL",
    allowedPrefixes: ["GS1-HIS-MOD"],
  },

  // ═══════════════════════════════════════════════════════
  // POLITY (short subject name) — actual subject in source files
  // ═══════════════════════════════════════════════════════
  "Polity > Constitutional and Non-constitutional Bodies": {
    fallbackNodeId: "GS2-POL-BODIES",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Executive": {
    fallbackNodeId: "GS2-POL-EXEC",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Features of the Indian Constitution": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Governance": {
    fallbackNodeId: "GS2-POL-CONTEMP",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Legislature": {
    fallbackNodeId: "GS2-POL-PARL",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Local Self Government": {
    fallbackNodeId: "GS2-POL-LOCAL",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Historical Background & Making of Indian Constitution": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Judiciary": {
    fallbackNodeId: "GS2-POL-JUD",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Judicial & Quasi-Judicial Bodies": {
    fallbackNodeId: "GS2-POL-JUD",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > Current Affairs: India": {
    fallbackNodeId: "GS2-POL-CONTEMP",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity > International Groups and Political Organizations": {
    fallbackNodeId: "GS2-IR-GROUPINGS",
    allowedPrefixes: ["GS2-IR"],
  },
  "Polity > Places in news": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },

  // Polity and Governance variant
  "Polity and Governance > Constitutional and Non-constitutional Bodies": {
    fallbackNodeId: "GS2-POL-BODIES",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Executive": {
    fallbackNodeId: "GS2-POL-EXEC",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Features of the Indian Constitution": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Governance": {
    fallbackNodeId: "GS2-POL-CONTEMP",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Legislature": {
    fallbackNodeId: "GS2-POL-PARL",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Local Self Government": {
    fallbackNodeId: "GS2-POL-LOCAL",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Historical Background & Making of Indian Constitution": {
    fallbackNodeId: "GS2-POL-PREAMBLE",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Judiciary": {
    fallbackNodeId: "GS2-POL-JUD",
    allowedPrefixes: ["GS2-POL"],
  },
  "Polity and Governance > Judicial & Quasi-Judicial Bodies": {
    fallbackNodeId: "GS2-POL-JUD",
    allowedPrefixes: ["GS2-POL"],
  },

  // ═══════════════════════════════════════════════════════
  // GEOGRAPHY (actual section labels from source files)
  // ═══════════════════════════════════════════════════════
  "Geography > Agriculture in India": {
    fallbackNodeId: "GS1-GEO-IND-AGRI",
    allowedPrefixes: ["GS1-GEO-IND"],
  },
  "Geography > Climatology": {
    fallbackNodeId: "GS1-GEO-CLIM-SYSTEMS",
    allowedPrefixes: ["GS1-GEO-CLIM"],
  },
  "Geography > Drainage System of India": {
    fallbackNodeId: "GS1-GEO-IND-DRAINAGE",
    allowedPrefixes: ["GS1-GEO-IND"],
  },
  "Geography > Geomorphology": {
    fallbackNodeId: "GS1-GEO-GM-LANDFORMS",
    allowedPrefixes: ["GS1-GEO-GM"],
  },
  "Geography > Human and Economic Geography": {
    fallbackNodeId: "GS1-GEO-HEW-ACTIVITIES",
    allowedPrefixes: ["GS1-GEO-HEW"],
  },
  "Geography > Indian Climate": {
    fallbackNodeId: "GS1-GEO-IND-CLIMATE",
    allowedPrefixes: ["GS1-GEO-IND"],
  },
  "Geography > Indian Map": {
    fallbackNodeId: "GS1-GEO-IND-PHYSIO",
    allowedPrefixes: ["GS1-GEO-IND"],
  },
  "Geography > Mineral and Industries": {
    fallbackNodeId: "GS1-GEO-IND-RESOURCES",
    allowedPrefixes: ["GS1-GEO-IND"],
  },
  "Geography > Natural Vegetation in India": {
    fallbackNodeId: "GS1-GEO-BIO-VEG",
    allowedPrefixes: ["GS1-GEO-BIO"],
  },
  "Geography > Oceanography": {
    fallbackNodeId: "GS1-GEO-OCE-MOTIONS",
    allowedPrefixes: ["GS1-GEO-OCE"],
  },
  "Geography > Physiography of India": {
    fallbackNodeId: "GS1-GEO-IND-PHYSIO",
    allowedPrefixes: ["GS1-GEO-IND"],
  },
  "Geography > Soils": {
    fallbackNodeId: "GS1-GEO-BIO-SOIL",
    allowedPrefixes: ["GS1-GEO-BIO"],
  },
  "Geography > The Earth and the Universe": {
    fallbackNodeId: "GS1-GEO-GM-INTERIOR",
    allowedPrefixes: ["GS1-GEO-GM"],
  },
  "Geography > World Climatic Regions": {
    fallbackNodeId: "GS1-GEO-CLIM-KOPPEN",
    allowedPrefixes: ["GS1-GEO-CLIM"],
  },
  "Geography > World Map": {
    fallbackNodeId: "GS1-GEO-PRE-REGIONAL-PLACES",
    allowedPrefixes: ["GS1-GEO"],
  },
  "Geography > International Groups and Political Organizations": {
    fallbackNodeId: "GS2-IR-GROUPINGS",
    allowedPrefixes: ["GS2-IR"],
  },

  // ═══════════════════════════════════════════════════════
  // ENVIRONMENT (actual section labels from source files)
  // ═══════════════════════════════════════════════════════
  "Environment > Agriculture": {
    fallbackNodeId: "GS3-ENV-CURR-CLIMATE",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environment > Climate Change: Causes and Implications": {
    fallbackNodeId: "GS3-ENV-CLIMATEPHEN",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environment > Ecosystem and Ecology": {
    fallbackNodeId: "GS3-ENV-ECO-CONCEPTS",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environment > Environment, Sustainable Development and General Issues": {
    fallbackNodeId: "GS3-ENV-ECO-CONCEPTS",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environment > Global Conservation Efforts": {
    fallbackNodeId: "GS3-ENV-INTL",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environment > International Groups and Political Organizations": {
    fallbackNodeId: "GS2-IR-GROUPINGS",
    allowedPrefixes: ["GS2-IR"],
  },
  "Environment > National Conservation Efforts": {
    fallbackNodeId: "GS3-ENV-CONSERVATION",
    allowedPrefixes: ["GS3-ENV"],
  },
  "Environment > Protected Area Network: NP, WS, BR, etc.": {
    fallbackNodeId: "GS3-ENV-CONSERVATION",
    allowedPrefixes: ["GS3-ENV"],
  },

  // ═══════════════════════════════════════════════════════
  // SCIENCE & TECHNOLOGY (actual ampersand subject name)
  // ═══════════════════════════════════════════════════════
  "Science & Technology > Biology": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
    keywordsToNodeIds: {
      "biotechnology": "GS3-ST-BIOTECH",
      "gene": "GS3-ST-BIOTECH",
      "vaccine": "GS3-ST-BIOTECH",
    },
  },
  "Science & Technology > Biotechnology": {
    fallbackNodeId: "GS3-ST-BIOTECH",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Chemistry": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Communication Technology": {
    fallbackNodeId: "GS3-ST-IT-COMM",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Current Affairs: India": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Current Affairs: World": {
    fallbackNodeId: "GS3-ST-SPACE",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Defence Technology": {
    fallbackNodeId: "GS3-ST-DEFENCE",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Energy": {
    fallbackNodeId: "GS3-ENV-ENERGY",
    allowedPrefixes: ["GS3-ENV", "GS3-ST"],
  },
  "Science & Technology > International Groups and Political Organizations": {
    fallbackNodeId: "GS2-IR-GROUPINGS",
    allowedPrefixes: ["GS2-IR"],
  },
  "Science & Technology > Miscellaneous": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
  },
  "Science & Technology > Physics": {
    fallbackNodeId: "GS3-ST-GENSCI-BIO",
    allowedPrefixes: ["GS3-ST"],
    keywordsToNodeIds: {
      "nuclear": "GS3-ST-NUCLEAR",
      "nano": "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
    },
  },
  "Science & Technology > Places in news": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
  "Science & Technology > Space Science": {
    fallbackNodeId: "GS3-ST-SPACE",
    allowedPrefixes: ["GS3-ST"],
  },

  // ═══════════════════════════════════════════════════════
  // ECONOMY (actual numbered section labels from source)
  // ═══════════════════════════════════════════════════════
  "Economy > 1A1: Money: Barter to Bitcoins": {
    fallbackNodeId: "GS3-ECO-PRE-MONEY-BASICS",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 1B1: Bank Classification": {
    fallbackNodeId: "GS3-ECO-PRE-BANKING-STRUCTURE",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 1B2: NPA, Bad-Loans, BASEL": {
    fallbackNodeId: "GS3-ECO-PRE-BANKING-STRUCTURE",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 1C: Sharemarket, Companies Act": {
    fallbackNodeId: "GS3-ECO-PRE-FIN-MARKETS",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 1D1: Insurance, Pension, Financial inclusion": {
    fallbackNodeId: "GS3-ECO-PRE-POVERTY",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 2A1: Budget Direct Taxes": {
    fallbackNodeId: "GS3-ECO-PRE-TAX",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 2A2: Budget Indirect Taxes GST": {
    fallbackNodeId: "GS3-ECO-PRE-TAX",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 2BC: Finance Commission, BlackMoney, Subsidies": {
    fallbackNodeId: "GS3-ECO-PRE-BUDGET",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 3A: BoP, CAD Currency Exchange": {
    fallbackNodeId: "GS3-ECO-PRE-BOP",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 3B: WTO, IMF & other International Organisations & Agreeements": {
    fallbackNodeId: "GS3-ECO-PRE-BOP",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 4A: Sectors of Economy- Agriculture": {
    fallbackNodeId: "GS3-ECO-SECT-AGRI",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 4B: Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME": {
    fallbackNodeId: "GS3-ECO-SECT-INDLAB",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 4C: NITI, Planning Commission, FYP, Unemployment": {
    fallbackNodeId: "GS3-ECO-PRE-GROWTH",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 4D: GDP, GNP": {
    fallbackNodeId: "GS3-ECO-PRE-GROWTH",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 4E: Inflation": {
    fallbackNodeId: "GS3-ECO-PRE-INFLATION",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 5A: Infra: Energy": {
    fallbackNodeId: "GS3-ECO-SECT-INFRA",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 5B: Infra: Transport, Urban Rural, Communication, Investment, PPP": {
    fallbackNodeId: "GS3-ECO-SECT-INFRA",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 6A: HRD: Census, Health Hunger": {
    fallbackNodeId: "GS3-ECO-PRE-POVERTY",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 6B: HRD: Education and Skill": {
    fallbackNodeId: "GS3-ECO-PRE-POVERTY",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 6C: HRD: Poverty": {
    fallbackNodeId: "GS3-ECO-PRE-POVERTY",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 6D: HRD: Weaker Section, HDI, SDG": {
    fallbackNodeId: "GS3-ECO-PRE-POVERTY",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > 7: Microeconomics": {
    fallbackNodeId: "GS3-ECO-PRE-GROWTH",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > Current Affairs: India": {
    fallbackNodeId: "GS3-ECO-PRE-GROWTH",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > Current Affairs: World": {
    fallbackNodeId: "GS3-ECO-PRE-BOP",
    allowedPrefixes: ["GS3-ECO"],
  },
  "Economy > International Groups and Political Organizations": {
    fallbackNodeId: "GS3-ECO-PRE-BOP",
    allowedPrefixes: ["GS3-ECO"],
  },

  // ═══════════════════════════════════════════════════════
  // UNKNOWN subject fallbacks
  // ═══════════════════════════════════════════════════════
  "Unknown > India & Its Neighbors": {
    fallbackNodeId: "GS2-IR-NEIGHBOURS",
    allowedPrefixes: ["GS2-IR"],
  },
  "Unknown > India's Foreign Policy": {
    fallbackNodeId: "GS2-IR-INSTITUTIONS",
    allowedPrefixes: ["GS2-IR"],
  },
  "Unknown > Places in news": {
    fallbackNodeId: "1C-MISC-INST",
    allowedPrefixes: ["1C-MISC"],
  },
};
