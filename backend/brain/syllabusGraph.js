// backend/brain/syllabusGraph.js
// ESM ONLY (Node v22 + package.json => { "type": "module" })

import {GS4_2026}from "./syllabusGS4.js";
import {ESSAY_2026} from "./syllabusEssay.js";
import {CSAT_2026} from "./syllabusCSAT.js";
import OPTIONAL_2026 from "./syllabusOptional.js";

export const SYLLABUS_GRAPH_2026 = {
  GS1: {
    heading: "GS 1: Culture, History, Geography & Society",
    macroTheme: "Civilizational Continuity and Physical Resilience",
    subjects: {
      // ✅ HISTORY (your pasted block)
      History: {
        sections: [
          {
            id: "GS1-HIS-ANC",
            name: "Ancient History",
            tags: ["PM"],
            topics: [
              {
                id: "GS1-HIS-ANC-PREHIST",
                name: "Pre Historic Times",
                tags: ["P"],
                microThemes: [
                  "Periodization of Indian Pre History",
                  "Sources of Pre History",
                  "Palaeolithic / Old Stone Age",
                  "Mesolithic / Middle Stone Age",
                  "Neolithic / New Stone Age",
                  "Chalcolithic Age",
                  "Major Chalcolithic Cultures",
                  "Early Iron Age",
                  "Geographical distribution & characteristics"
                ],
                keywords: ["prehistoric", "palaeolithic", "mesolithic", "neolithic", "chalcolithic", "iron age"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-IVC",
                name: "Indus Valley Civilization (IVC)",
                tags: ["PM"],
                microThemes: [
                  "IVC geography & archaeological findings (major cities, town planning)",
                  "IVC society & culture (script/language, crafts, religion, seals/images)",
                  "IVC economy (trade, agriculture, domestication, weights/measures)",
                  "Decline of Harappan culture"
                ],
                keywords: ["harappa", "mohenjodaro", "dholavira", "rakhigarhi", "town planning", "seals"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-VEDIC-RIG",
                name: "Rig Vedic Period",
                tags: ["PM"],
                microThemes: [
                  "Sources for reconstructing Vedic society",
                  "Geography / area of settlement",
                  "Political organisation & evolution of monarchy",
                  "Social organisation",
                  "Economy",
                  "Religious practices & culture"
                ],
                keywords: ["rig veda", "sabha", "samiti", "rajan", "jana"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-VEDIC-LATER",
                name: "Later Vedic Period",
                tags: ["PM"],
                microThemes: [
                  "Geography / area of settlement",
                  "Political system",
                  "Social organisation & varna system",
                  "Economy",
                  "Religious practices & culture"
                ],
                keywords: ["later vedic", "varna", "janapada", "mahajanapada"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-JAIN",
                name: "Jainism",
                tags: ["PM"],
                microThemes: [
                  "Birth & life of Mahavira",
                  "Teachings",
                  "Organisation & sects",
                  "Literature",
                  "Councils, spread & patrons"
                ],
                keywords: ["mahavira", "triratna", "ahimsa", "digambara", "shvetambara"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-BUD",
                name: "Buddhism",
                tags: ["PM"],
                microThemes: [
                  "Birth & life of Buddha",
                  "Teachings",
                  "Organisation & sects",
                  "Literature",
                  "Councils, spread & patrons",
                  "Causes for decline"
                ],
                keywords: ["buddha", "4 noble truths", "8fold path", "mahayana", "hinayana", "sangha"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-MAHAJAN",
                name: "Mahajanapadas & Magadha Rise",
                tags: ["PM"],
                microThemes: [
                  "Republics and monarchies",
                  "16 Mahajanapadas",
                  "Magadha",
                  "Dynasties: Haryanka, Shishunaga, Nanda",
                  "Persian invasions",
                  "Alexander’s invasion",
                  "Urban centres, economy, administration"
                ],
                keywords: ["magadha", "bimbisara", "ajatasatru", "nanda", "alexander"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-MAURYA",
                name: "Mauryan Empire",
                tags: ["PM"],
                microThemes: [
                  "Sources: inscriptions/sites + Arthashastra",
                  "Chandragupta, Bindusara, Megasthenes",
                  "Ashoka’s inscriptions & sites",
                  "Ashoka & Buddhism",
                  "Dhamma policy",
                  "Administration & foreign relations",
                  "Decline"
                ],
                keywords: ["ashoka", "edicts", "arthashastra", "mauryan admin", "dhamma"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-POSTMAURYA",
                name: "Post-Mauryan India",
                tags: ["PM"],
                microThemes: [
                  "Society: evolution of jatis",
                  "Satavahanas",
                  "Sungas & Kanvas",
                  "Sakas",
                  "Kushanas",
                  "Kanishka"
                ],
                keywords: ["satavahana", "kushana", "kanishka", "saka"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-GUPTA",
                name: "Gupta Period",
                tags: ["PM"],
                microThemes: [
                  "Sources & chronology",
                  "Administration",
                  "Foreign traveller: Fa-Hien",
                  "Society/religion/culture",
                  "Urban centres, economy",
                  "Science & tech, literature",
                  "Later Guptas"
                ],
                keywords: ["gupta", "samudragupta", "chandragupta", "fa hien"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-HARSHA",
                name: "Harshavardhana",
                tags: ["M"],
                microThemes: [
                  "Military conquests",
                  "Harsha & Buddhism",
                  "Administration",
                  "Society & culture",
                  "Economy"
                ],
                keywords: ["harsha", "xuanzang", "kanauj"],
                schemes: []
              },
              {
                id: "GS1-HIS-ANC-SANGAM",
                name: "Sangam Period (South Indian Dynasties)",
                tags: ["PM"],
                microThemes: [
                  "Sangam literature",
                  "Cholas, Cheras, Pandyas",
                  "Polity/society/culture",
                  "Economy, foreign trade contacts",
                  "Schools of art"
                ],
                keywords: ["sangam", "tamil", "chola", "chera", "pandya"],
                schemes: []
              }
            ]
          },

          {
            id: "GS1-HIS-MED",
            name: "Medieval India",
            tags: ["PM"],
            topics: [
              {
                id: "GS1-HIS-MED-EMPIRE",
                name: "Early Medieval Dynasties (750–1200) + Feudalism",
                tags: ["PM"],
                microThemes: [
                  "Pratiharas, Palas, Senas, Rajputs",
                  "Tripartite conflict",
                  "Pallavas, Chalukyas, Rashtrakutas",
                  "Indian feudalism",
                  "Administration, society, economy, decline of trade"
                ],
                keywords: ["pala", "pratihara", "rashtrakuta", "tripartite", "feudalism"],
                schemes: []
              },
              {
                id: "GS1-HIS-MED-CHOLA",
                name: "Cholas & South Indian Kingdoms",
                tags: ["PM"],
                microThemes: [
                  "Chola rulers & political history",
                  "Administration",
                  "Socio-economic life",
                  "Education & literature",
                  "Chera/Yadava",
                  "SE Asia contacts"
                ],
                keywords: ["chola", "ur", "sabha", "nagaram"],
                schemes: []
              },
              {
                id: "GS1-HIS-MED-DELHI",
                name: "Delhi Sultanate (1206–1526)",
                tags: ["PM"],
                microThemes: [
                  "Slave, Khalji, Tughlaq, Sayyid, Lodi",
                  "Provincial kingdoms & resistance",
                  "Mongol/Turk attacks",
                  "Administration, economy, urbanisation",
                  "Society/culture, legal system",
                  "Decline factors"
                ],
                keywords: ["iqta", "khalji", "tughlaq", "sultanate"],
                schemes: []
              },
              {
                id: "GS1-HIS-MED-MUGHAL",
                name: "Mughal Empire (Babur → Aurangzeb) + Deccan + Marathas",
                tags: ["PM"],
                microThemes: [
                  "Babur–Humayun–Sher Shah (Sur Empire contributions, coinage, architecture)",
                  "Akbar: expansion, Rajput policy, mansabdari, revenue (Dahsala)",
                  "Religious policy: Ibadat Khana, Mahzar, Din-i-Ilahi",
                  "Deccan policy up to 1657; Malik Ambar; Bijapur/Golconda suzerainty",
                  "Foreign policy: Qandahar, Iran relations, Balkh campaign",
                  "Jahangir/Shah Jahan polity & ruling class evolution",
                  "Aurangzeb, Marathas, Jagirdari crisis"
                ],
                keywords: ["mansabdari", "zabt", "dahsala", "din-i-ilahi", "deccan", "shivaji"],
                schemes: []
              },
              {
                id: "GS1-HIS-MED-18C",
                name: "18th Century India (Marathas + Regional States)",
                tags: ["M"],
                microThemes: [
                  "Maratha expansion, Panipat (1761)",
                  "Peshwas & other houses (Holkars, Sindhias, Gaikwads, Bhonsles)",
                  "Regional states (Bengal, Awadh, Hyderabad, Mysore, Sikhs etc.)",
                  "Economic condition + social/cultural life"
                ],
                keywords: ["peshwa", "panipat", "regional states"],
                schemes: []
              }
            ]
          },

          {
            id: "GS1-HIS-MOD",
            name: "Modern India",
            tags: ["PM"],
            topics: [
              {
                id: "GS1-HIS-MOD-EURO",
                name: "Advent of Europeans + Anglo-French rivalry",
                tags: ["PM"],
                microThemes: [
                  "Portuguese (Almeida, Albuquerque) & decline",
                  "Dutch, Danes, English, French",
                  "Carnatic wars",
                  "Causes of English success"
                ],
                keywords: ["carnatic wars", "albuquerque", "plassey context"],
                schemes: []
              },
              {
                id: "GS1-HIS-MOD-EXPANSION",
                name: "British Expansion (Bengal → Pan-India)",
                tags: ["PM"],
                microThemes: [
                  "Bengal consolidation",
                  "Anglo-Maratha wars",
                  "Subsidiary alliance",
                  "Conquest of Sindh, Anglo-Sikh wars",
                  "Doctrine of lapse, annexation of Oudh"
                ],
                keywords: ["subsidiary alliance", "doctrine of lapse", "maratha wars", "sikh wars"],
                schemes: []
              },
              {
                id: "GS1-HIS-MOD-ADMIN",
                name: "Administration & Economic Policies",
                tags: ["PM"],
                microThemes: [
                  "Charter Acts + judicial system",
                  "Land revenue: Permanent, Ryotwari, Mahalwari",
                  "Drain of wealth & colonial economic critique",
                  "Industrialisation impact, famines & poverty"
                ],
                keywords: ["charter act", "ryotwari", "mahalwari", "drain of wealth"],
                schemes: []
              },
              {
                id: "GS1-HIS-MOD-1857",
                name: "Revolt of 1857",
                tags: ["PM"],
                microThemes: [
                  "Causes (economic, political, admin, socio-religious, sepoy)",
                  "Centres/leaders/spread",
                  "Failure + nature",
                  "Impact + consequences"
                ],
                keywords: ["1857", "sepoy", "mutiny", "civil rebellion"],
                schemes: []
              },
              {
                id: "GS1-HIS-MOD-REFORM",
                name: "Socio-Religious Reforms + Personalities",
                tags: ["PM"],
                microThemes: [
                  "Reform movements (Hindu/Muslim/Sikh/Parsi)",
                  "Key personalities (Rammohan Roy, Vivekananda, Dayanand, Vidyasagar, Phule, Ambedkar, Annie Besant, Syed Ahmad Khan etc.)"
                ],
                keywords: ["brahmo", "arya samaj", "aligarh", "theosophical"],
                schemes: []
              },
              {
                id: "GS1-HIS-MOD-NATIONAL",
                name: "Indian National Movement (1885–1947)",
                tags: ["PM"],
                microThemes: [
                  "Moderates vs Extremists",
                  "Swadeshi/Partition of Bengal",
                  "Home Rule, Lucknow Pact",
                  "Gandhian phase: NCM, CDM, QIM",
                  "Constitutional developments: 1909, 1919, 1935",
                  "INA/Azad Hind, Cabinet Mission, Mountbatten Plan",
                  "Partition causes & acceptance"
                ],
                keywords: ["swadeshi", "ncm", "cdm", "qim", "cabinet mission", "partition"],
                schemes: []
              },
              {
                id: "GS1-HIS-MOD-CONSTDEV",
                name: "Constitutional Development in India (1773–1947)",
                tags: ["PM"],
                microThemes: [
                  "Regulating Act 1773",
                  "Pitt’s India Act 1784",
                  "Charter Acts 1793/1813/1833/1853",
                  "GoI Act 1858",
                  "Indian Councils Acts 1861/1892/1909",
                  "GoI Acts 1919/1935",
                  "Indian Independence Act 1947"
                ],
                keywords: ["regulating act", "pitt", "charter act", "indian councils act", "1935"],
                schemes: []
              }
            ]
          },

          {
            id: "GS1-HIS-POSTIND",
            name: "Post-Independence Consolidation (Mains)",
            tags: ["M"],
            topics: [
              {
                id: "GS1-HIS-POSTIND-INTEGRATION",
                name: "Integration of Princely States + Nation-building challenges",
                tags: ["M"],
                microThemes: [
                  "Partition rehabilitation",
                  "Integration: Junagadh, Kashmir, Hyderabad",
                  "Language issue & Official Language Act",
                  "Democracy building & ECI challenges"
                ],
                keywords: ["integration", "princely states", "linguistic", "eci"],
                schemes: []
              },
              {
                id: "GS1-HIS-POSTIND-ECON",
                name: "Economic consolidation: Planning, Green Revolution, Land reforms",
                tags: ["M"],
                microThemes: [
                  "Planning Commission + Five Year Plans",
                  "Green Revolution impacts",
                  "Operation Flood & cooperatives",
                  "Land reforms + Bhoodan"
                ],
                keywords: ["planning", "green revolution", "operation flood", "land reforms"],
                schemes: []
              },
              {
                id: "GS1-HIS-POSTIND-POL",
                name: "Crisis of democratic order + movements + 1990s politics",
                tags: ["M"],
                microThemes: [
                  "Emergency 1975–77",
                  "Regionalism, communalism, secessionism",
                  "Popular movements (Chipko, Narmada, women movements etc.)",
                  "Coalition era + Mandal + 1991 reforms context"
                ],
                keywords: ["emergency", "jp movement", "chipko", "narmada", "mandal", "1991"],
                schemes: []
              }
            ]
          },

          {
            id: "GS1-HIS-WORLD",
            name: "World History (Mains)",
            tags: ["M"],
            topics: [
              {
                id: "GS1-HIS-WORLD-REV",
                name: "Industrial + French + Russian Revolutions",
                tags: ["M"],
                microThemes: [
                  "Industrial Revolution causes/impact",
                  "French Revolution & Napoleon",
                  "Russian Revolution & USSR"
                ],
                keywords: ["industrial", "french", "napoleon", "russian", "ussr"],
                schemes: []
              },
              {
                id: "GS1-HIS-WORLD-WARS",
                name: "World Wars + Cold War + Decolonization",
                tags: ["M"],
                microThemes: [
                  "WWI, League of Nations",
                  "Inter-war years, fascism/nazism, Great Depression",
                  "WWII aftermath",
                  "Decolonization",
                  "Cold War and post-1991 world"
                ],
                keywords: ["ww1", "ww2", "cold war", "decolonization"],
                schemes: []
              }
            ]
          }
        ]
      },

      // ✅ CULTURE (FIXED: now INSIDE GS1.subjects, not outside the export)
      Culture: {
        subjectHeading: "Indian Culture (Art, Heritage, Religion, Literature)",
        scope: "Prelims + Mains combined",
        tags: ["PM"],
        blocks: [
          {
            block: "Visual Arts",
            microThemes: [
              {
                code: "1C.VA.ARCH",
                title: "Architecture in India",
                examTag: "PM",
                subtopics: [
                  { t: "Harappan Architecture", tag: "PM" },
                  { t: "Mauryan Architecture", tag: "PM" },
                  { t: "Post-Mauryan Architecture", tag: "PM" },
                  { t: "Gupta Period Architecture", tag: "PM" },
                  { t: "Rock-cut architecture: Chaityas, Viharas", tag: "PM" },
                  { t: "Stupas and Buddhist architecture", tag: "PM" },
                  { t: "Temple architecture: Nagara, Dravida, Vesara", tag: "PM" },
                  { t: "Hoysala style (key features)", tag: "P" },
                  { t: "Pallava temples and features", tag: "PM" },
                  { t: "Chola temples and features", tag: "PM" },
                  { t: "Vijayanagara architecture", tag: "PM" },
                  { t: "Indo-Islamic architecture: Sultanate + Mughal", tag: "PM" },
                  { t: "Provincial/Regional styles (Mandu/Jaunpur etc.)", tag: "M" },
                  { t: "Sikh/Avadh/Rajput architecture (features)", tag: "P" },
                  { t: "Colonial architecture and Indo-Saracenic", tag: "PM" },
                  { t: "Conservation & preservation of monuments", tag: "PM" },
                  { t: "Spread of Indian culture to Southeast Asia", tag: "M" }
                ]
              },
              {
                code: "1C.VA.SCULP",
                title: "Sculpture Traditions",
                examTag: "PM",
                subtopics: [
                  { t: "Harappan sculptures (key examples)", tag: "P" },
                  { t: "Mauryan sculpture: polish, pillars, motifs", tag: "PM" },
                  { t: "Gandhara vs Mathura schools", tag: "PM" },
                  { t: "Gupta sculpture (features, ideals)", tag: "PM" },
                  { t: "Bronze tradition: Pallava/Chola bronzes; Nataraja", tag: "PM" },
                  { t: "Jain and Buddhist sculpture (broad features)", tag: "PM" }
                ]
              },
              {
                code: "1C.VA.PAINT",
                title: "Paintings",
                examTag: "PM",
                subtopics: [
                  { t: "Prehistoric rock paintings", tag: "PM" },
                  { t: "Indian mural traditions (Ajanta/Bagh/Sittanavasal etc.)", tag: "PM" },
                  { t: "Miniature painting traditions: Mughal, Rajput, Pahari, Deccan", tag: "PM" },
                  { t: "Themes and patronage in medieval paintings", tag: "M" },
                  { t: "Modern Indian paintings: Bengal school, Madras school, revivalism", tag: "PM" },
                  { t: "Folk/Decorative traditions: Madhubani, Warli, Kalamkari, Pattachitra, Kalighat", tag: "P" }
                ]
              },
              {
                code: "1C.VA.POTTERY",
                title: "Pottery & Material Culture",
                examTag: "P",
                subtopics: [
                  { t: "Ochre Coloured Pottery (OCP)", tag: "P" },
                  { t: "Black and Red Ware (BRW)", tag: "P" },
                  { t: "Painted Grey Ware (PGW)", tag: "P" },
                  { t: "Northern Black Polished Ware (NBPW)", tag: "P" },
                  { t: "Glazed and unglazed pottery (broad idea)", tag: "P" }
                ]
              },
              {
                code: "1C.VA.NUMIS",
                title: "Numismatics (Coins)",
                examTag: "P",
                subtopics: [
                  { t: "Coinage basics (terms, types, utility in history)", tag: "PM" },
                  { t: "Major coin traditions (broad overview)", tag: "P" }
                ]
              }
            ]
          },

          {
            block: "Performing Arts",
            microThemes: [
              {
                code: "1C.PA.MUSIC",
                title: "Music",
                examTag: "PM",
                subtopics: [
                  { t: "Hindustani vs Carnatic: features, similarities/differences", tag: "PM" },
                  { t: "Gharanas (basic idea)", tag: "P" },
                  { t: "Musical instruments (classification + examples)", tag: "P" },
                  { t: "Folk music traditions (broad)", tag: "P" },
                  { t: "Key contributors (e.g., Amir Khusro; court patronage)", tag: "M" }
                ]
              },
              {
                code: "1C.PA.DANCE",
                title: "Dance",
                examTag: "PM",
                subtopics: [
                  { t: "Evolution of dance (broad references: Nataraja, traditions)", tag: "M" },
                  { t: "Ashta Nayika; Rasa and Bhava (basics)", tag: "PM" },
                  { t: "Classical dances: features + state association", tag: "P" },
                  { t: "Folk dances (broad classification)", tag: "P" }
                ]
              },
              {
                code: "1C.PA.THEATRE",
                title: "Theatre, Drama & Cinema",
                examTag: "PM",
                subtopics: [
                  { t: "Natyashastra basics (conceptual)", tag: "M" },
                  { t: "Classical Sanskrit theatre (broad)", tag: "M" },
                  { t: "Traditional/Regional theatre forms", tag: "P" },
                  { t: "Modern theatre renaissance (broad)", tag: "M" },
                  { t: "Indian cinema: basic evolution + categories (overview)", tag: "P" }
                ]
              },
              {
                code: "1C.PA.PUPPET",
                title: "Puppetry",
                examTag: "P",
                subtopics: [
                  { t: "String puppets", tag: "P" },
                  { t: "Shadow puppets", tag: "P" },
                  { t: "Rod puppets", tag: "P" },
                  { t: "Glove puppets", tag: "P" },
                  { t: "Tribal/modern puppetry (overview)", tag: "P" }
                ]
              },
              {
                code: "1C.PA.SPORTS",
                title: "Traditional Sports & Martial Arts",
                examTag: "P",
                subtopics: [
                  { t: "Traditional martial arts (examples + broad forms)", tag: "P" },
                  { t: "Animal sports (overview)", tag: "P" }
                ]
              }
            ]
          },

          {
            block: "Religion, Philosophy, Language & Literature",
            microThemes: [
              {
                code: "1C.RLL.RELIGION",
                title: "Religions & Philosophies in India",
                examTag: "PM",
                subtopics: [
                  { t: "Pre-Vedic traditions (overview)", tag: "M" },
                  { t: "Hinduism (broad schools/ideas)", tag: "M" },
                  { t: "Buddhism (impact on culture)", tag: "PM" },
                  { t: "Jainism (impact on culture)", tag: "PM" },
                  { t: "Sikhism (key ideas)", tag: "PM" },
                  { t: "Islam in India; Sufism (impact on culture)", tag: "PM" },
                  { t: "Bhakti movement (features, saints as overview)", tag: "PM" },
                  { t: "Vedanta philosophy (overview)", tag: "M" }
                ]
              },
              {
                code: "1C.RLL.LANG",
                title: "Languages & Literature",
                examTag: "PM",
                subtopics: [
                  { t: "Classical languages in India (concept + examples)", tag: "PM" },
                  { t: "Vedic literature (overview)", tag: "M" },
                  { t: "Sanskrit literature (overview)", tag: "M" },
                  { t: "Pali and Prakrit literature (overview)", tag: "M" },
                  { t: "Tamil and Sangam literature (overview)", tag: "PM" },
                  { t: "Medieval literature trends (overview)", tag: "M" },
                  { t: "Modern Indian literature (overview)", tag: "M" },
                  { t: "Persian/Urdu contributions (overview)", tag: "M" }
                ]
              }
            ]
          },

          {
            block: "Heritage, Institutions, UNESCO, GI, Schemes",
            microThemes: [
              {
                code: "1C.MISC.UNESCO",
                title: "UNESCO Heritage & Cultural Governance",
                examTag: "P",
                subtopics: [
                  { t: "UNESCO World Heritage Sites in India (revision list layer)", tag: "P" },
                  { t: "UNESCO Intangible Cultural Heritage: key Indian inscriptions (overview)", tag: "P" },
                  { t: "UNESCO Creative Cities Network; Global Geoparks (overview)", tag: "P" }
                ]
              },
              {
                code: "1C.MISC.INST",
                title: "Cultural Institutions & Legal Protection",
                examTag: "P",
                subtopics: [
                  { t: "Government cultural institutions (overview)", tag: "P" },
                  { t: "Legal provisions for protection/promotion of heritage (overview)", tag: "PM" }
                ]
              },
              {
                code: "1C.MISC.GI",
                title: "GI Tag & IPR basics for Culture",
                examTag: "P",
                subtopics: [
                  { t: "GI tag definition; GI vs trademark", tag: "P" },
                  { t: "Rights under GI; famous goods; latest additions (dynamic layer)", tag: "P" }
                ]
              },
              {
                code: "1C.MISC.SCHEMES",
                title: "Culture Schemes (to be linked dynamically)",
                examTag: "PM",
                subtopics: [
                  { t: "HRIDAY", tag: "PM" },
                  { t: "Swadesh Darshan", tag: "PM" },
                  { t: "PRASAD", tag: "PM" },
                  { t: "Adarsh Smarak", tag: "PM" },
                  { t: "Project Mausam", tag: "PM" }
                ],
                note:
                  "Keep scheme details (ministry, year, funding type) in Master Scheme Dashboard; here keep only linkage hooks."
              }
            ]
          }
        ]
      },

      // ✅ Next subjects (placeholders so commas/braces stay valid)
      
        Geography: {
  sections: [
    /* -------------------- GENERAL / ASTRONOMY + EARTH BASICS -------------------- */
    {
      id: "GS1-GEO-GEN",
      name: "General Geography (Universe → Earth Basics)",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-GEO-GEN-UNIVERSE",
          name: "Universe & Solar System Basics",
          tags: ["PM"],
          microThemes: [
            "Universe; theories of origin/development",
            "Galaxy; star formation; planet formation",
            "Solar system; Moon",
            "Asteroids, Meteors, Kuiper belt, Comets",
            "Dwarf planets"
          ],
          keywords: [
            "universe", "big bang", "galaxy", "star formation", "planet formation",
            "solar system", "moon", "asteroid", "meteor", "kuiper belt", "comet", "dwarf planet"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GEN-EARTH-EVOLUTION",
          name: "Earth Evolution & Geological Time Scale",
          tags: ["PM"],
          microThemes: [
            "Geological history of Earth",
            "Layered structure evolution",
            "Evolution of lithosphere, atmosphere, hydrosphere",
            "Geological time scale",
            "Origin of life (broad overview)"
          ],
          keywords: [
            "earth evolution", "geological history", "geological time scale",
            "lithosphere evolution", "atmosphere evolution", "hydrosphere evolution", "origin of life"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GEN-LATLON",
          name: "Latitude-Longitude, Time, Motions & Eclipses",
          tags: ["PM"],
          microThemes: [
            "Important parallels & meridians",
            "Rotation & revolution and effects",
            "Inclination of axis and seasons",
            "Time zones, local vs standard time, IDL, calendar",
            "Solar & lunar eclipses"
          ],
          keywords: [
            "latitude", "longitude", "tropic of cancer", "equator", "prime meridian",
            "rotation", "revolution", "seasons", "time zones", "international date line", "eclipse"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GEN-MAGNETIC",
          name: "Earth’s Magnetic Field",
          tags: ["PM"],
          microThemes: ["Magnetic field basics; declination/inclination (overview)"],
          keywords: ["earth magnetic field", "declination", "inclination", "magnetic pole"],
          schemes: []
        }
      ]
    },

    /* -------------------- GEOMORPHOLOGY -------------------- */
    {
      id: "GS1-GEO-GM",
      name: "Geomorphology (Earth Interior → Processes → Landforms)",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-GEO-GM-INTERIOR",
          name: "Earth Interior: Structure & Sources",
          tags: ["PM"],
          microThemes: [
            "Crust, mantle, core",
            "Direct vs indirect sources",
            "Earthquake waves & volcanoes as indirect sources"
          ],
          keywords: ["earth interior", "crust mantle core", "seismic waves", "earthquake waves", "volcanoes"],
          schemes: []
        },
        {
          id: "GS1-GEO-GM-MINERALS-ROCKS",
          name: "Minerals, Rocks & Rock Cycle",
          tags: ["PM"],
          microThemes: [
            "Major elements of Earth’s crust",
            "Common minerals: feldspar, quartz, pyroxene, amphibole, mica, olivine",
            "Physical properties: cleavage, fracture, lustre, hardness, specific gravity etc.",
            "Metallic vs non-metallic minerals",
            "Igneous, sedimentary, metamorphic rocks; petrology",
            "Rocks and soils linkage"
          ],
          keywords: [
            "minerals", "feldspar", "quartz", "mica", "olivine", "pyroxene", "amphibole",
            "igneous", "sedimentary", "metamorphic", "rock cycle", "petrology"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GM-ENDO-EXO",
          name: "Geomorphic Processes: Endogenic & Exogenic",
          tags: ["PM"],
          microThemes: [
            "Endogenic: diastrophism (orogenic/epierogenic), plate movement, earthquakes, volcanism",
            "Exogenic: weathering, mass wasting, erosion-transport-deposition",
            "Gradation: degradation & aggradation"
          ],
          keywords: [
            "endogenic forces", "exogenic forces", "diastrophism", "orogenic", "epierogenic",
            "weathering", "mass movement", "erosion", "deposition", "gradation"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GM-EQ-VOL",
          name: "Earthquakes & Volcanism",
          tags: ["PM"],
          microThemes: [
            "Seismic waves: P, S, surface; shadow zone; epicentre",
            "Types of earthquakes; effects; distribution",
            "Volcano types: shield, composite, caldera, flood basalt, mid-ocean ridge",
            "Intrusive landforms: batholith, laccolith, lopolith, phacolith, sill, dyke"
          ],
          keywords: [
            "p waves", "s waves", "shadow zone", "epicentre", "earthquake types",
            "volcano", "shield volcano", "composite volcano", "caldera", "flood basalt",
            "batholith", "laccolith", "sill", "dyke"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GM-PLATE",
          name: "Continental Drift → Sea Floor Spreading → Plate Tectonics",
          tags: ["PM"],
          microThemes: [
            "Wegener: Pangaea, Panthalassa; Laurasia, Gondwanaland; evidences",
            "Sea floor spreading; ocean floor mapping",
            "Plate tectonics: plates, boundaries (divergent/convergent/transform), movement forces",
            "Indian plate basics"
          ],
          keywords: [
            "continental drift", "wegener", "pangaea", "gondwanaland", "laurasia",
            "sea floor spreading", "plate tectonics", "divergent boundary", "convergent boundary",
            "transform boundary", "indian plate"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GM-LANDFORMS",
          name: "Agents of Erosion & Depositional Landforms",
          tags: ["PM"],
          microThemes: [
            "Wind: dunes (barchan, seif), deflation hollows, mushroom rocks",
            "Running water: valleys, gorges/canyons, meanders, terraces, deltas, floodplains, oxbow",
            "Groundwater/karst: sinkholes, dolines, uvala, caves; stalactite/stalagmite",
            "Glacial: cirque, arete, fjord; moraines, eskers, drumlins",
            "Waves/currents: cliffs, stacks; spits, bars, beaches"
          ],
          keywords: [
            "barchan", "seif dune", "mushroom rock", "alluvial fan", "delta", "flood plain",
            "meander", "oxbow lake", "karst", "sinkhole", "stalactite", "stalagmite",
            "cirque", "arete", "fjord", "moraine", "esker", "drumlin",
            "sea cliff", "stack", "spit", "bar", "beach"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GM-WEATHERING-SOIL",
          name: "Weathering, Mass Movements & Soil Formation (Basics)",
          tags: ["PM"],
          microThemes: [
            "Chemical, physical, biological weathering; exfoliation",
            "Mass movement: heave/flow/slide (overview)",
            "Soil formation basics; leaching/enrichment"
          ],
          keywords: [
            "chemical weathering", "carbonation", "hydration", "oxidation", "physical weathering",
            "frost wedging", "salt weathering", "exfoliation", "mass movement", "soil formation", "leaching"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-GM-WORLD-FACTS",
          name: "World Landforms (Factual Lists: Rivers/Lakes/Peaks/Plateaus)",
          tags: ["P"],
          microThemes: ["High-yield factual mapping layer (to be maintained separately)"],
          keywords: ["rivers and lakes", "mountains and peaks", "plateaus", "world landforms"],
          schemes: []
        }
      ]
    },

    /* -------------------- OCEANOGRAPHY -------------------- */
    {
      id: "GS1-GEO-OCE",
      name: "Oceanography",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-GEO-OCE-HYDRO",
          name: "Hydrosphere & Hydrological Cycle",
          tags: ["PM"],
          microThemes: ["Hydrological cycle components and processes"],
          keywords: ["hydrosphere", "hydrological cycle", "evaporation", "condensation", "precipitation"],
          schemes: []
        },
        {
          id: "GS1-GEO-OCE-RELIEF",
          name: "Ocean Floor Relief (Submarine Features)",
          tags: ["PM"],
          microThemes: [
            "Continental shelf/slope, abyssal plain, trenches",
            "Mid-ocean ridge, seamount, guyot, submarine canyon",
            "Fracture zones, hotspots, volcanic islands",
            "Coral islands, atolls"
          ],
          keywords: [
            "continental shelf", "continental slope", "abyssal plain", "trench",
            "mid ocean ridge", "seamount", "guyot", "submarine canyon", "hotspot", "atoll"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-OCE-TEMP-SAL",
          name: "Temperature, Salinity, Density",
          tags: ["PM"],
          microThemes: [
            "Vertical & horizontal distribution",
            "Factors affecting temperature and salinity",
            "Density and its role"
          ],
          keywords: ["ocean temperature", "salinity", "thermocline", "halocline", "density of ocean water"],
          schemes: []
        },
        {
          id: "GS1-GEO-OCE-MOTIONS",
          name: "Waves, Tides & Ocean Currents",
          tags: ["PM"],
          microThemes: [
            "Waves characteristics",
            "Tides: spring/neap; diurnal/semi-diurnal",
            "Currents: warm/cold; surface/deep; effects; major world currents"
          ],
          keywords: [
            "waves", "tides", "spring tide", "neap tide", "ocean currents",
            "warm current", "cold current", "coriolis", "upwelling"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-OCE-RESOURCES",
          name: "Marine Resources, Water Conservation & Ocean Deposits",
          tags: ["PM"],
          microThemes: [
            "Marine resource utilization; water consumption patterns",
            "Water conservation techniques",
            "Ocean deposits: terrigenous, volcanic, biotic, abiotic",
            "Coral reefs; coral bleaching (Mains angle)"
          ],
          keywords: [
            "marine resources", "water conservation", "ocean deposits", "terrigenous deposits",
            "pelagic deposits", "coral reef", "coral bleaching", "great barrier reef"
          ],
          schemes: []
        }
      ]
    },

    /* -------------------- CLIMATOLOGY -------------------- */
    {
      id: "GS1-GEO-CLIM",
      name: "Climatology (Atmosphere → Weather Systems → Climate Types)",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-GEO-CLIM-ATM",
          name: "Atmosphere: Composition & Vertical Structure",
          tags: ["PM"],
          microThemes: ["Troposphere to exosphere; inversion of temperature (concept)"],
          keywords: ["atmosphere composition", "troposphere", "stratosphere", "mesosphere", "thermosphere", "temperature inversion"],
          schemes: []
        },
        {
          id: "GS1-GEO-CLIM-INSOLATION",
          name: "Insolation, Heat Budget & Temperature Distribution",
          tags: ["PM"],
          microThemes: [
            "Aphelion/perihelion",
            "Heating/cooling: conduction, convection, advection, radiation",
            "Albedo; shortwave/longwave; net heat budget"
          ],
          keywords: [
            "insolation", "heat budget", "albedo", "aphelion", "perihelion",
            "conduction", "convection", "advection", "terrestrial radiation"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-CLIM-PRESSURE-WINDS",
          name: "Pressure Belts & Global Circulation (Hadley/Ferrel/Polar)",
          tags: ["PM"],
          microThemes: [
            "Pressure gradient, friction, coriolis",
            "Planetary winds; seasonal/local winds",
            "Land-sea breeze, mountain-valley winds"
          ],
          keywords: [
            "pressure belts", "coriolis force", "pressure gradient force",
            "hadley cell", "ferrel cell", "polar cell", "planetary winds", "local winds", "sea breeze"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-CLIM-SYSTEMS",
          name: "Air Mass, Fronts, Cyclones, Jet Streams, Monsoon",
          tags: ["PM"],
          microThemes: [
            "Air masses & fronts",
            "Cyclones/anticyclones; thunderstorms; tornadoes",
            "Jet streams",
            "Monsoon mechanism (conceptual)"
          ],
          keywords: [
            "air mass", "fronts", "cyclone", "anticyclone", "jet stream",
            "monsoon mechanism", "thunderstorm", "tornado"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-CLIM-PRECIP",
          name: "Humidity, Clouds, Precipitation & Rainfall Types",
          tags: ["PM"],
          microThemes: [
            "Humidity, dew point",
            "Cloud types; precipitation types",
            "Convectional/orographic/cyclonic rainfall",
            "World rainfall distribution"
          ],
          keywords: [
            "humidity", "dew point", "clouds", "cirrus", "cumulus", "stratus",
            "orographic rainfall", "convectional rainfall", "cyclonic rainfall"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-CLIM-KOPPEN",
          name: "Climatic Regions & Köppen Classification (World Climates)",
          tags: ["PM"],
          microThemes: [
            "Köppen classification overview",
            "Equatorial, monsoon, savanna, desert, mediterranean, steppe, china type, british type, siberian, laurentian, polar"
          ],
          keywords: ["koppen classification", "equatorial climate", "savanna", "mediterranean climate", "steppe", "polar climate"],
          schemes: []
        }
      ]
    },

    /* -------------------- BIOGEOGRAPHY -------------------- */
    {
      id: "GS1-GEO-BIO",
      name: "Bio-Geography (Soils, Vegetation, Forests, Conservation)",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-GEO-BIO-SOIL",
          name: "Soils: Formation, Profiles, Erosion & Conservation",
          tags: ["PM"],
          microThemes: [
            "Factors & stages of soil formation",
            "Soil horizons/profile",
            "Soil classification (overview)",
            "Soil erosion & conservation"
          ],
          keywords: ["soil formation", "soil horizons", "soil profile", "soil erosion", "soil conservation"],
          schemes: []
        },
        {
          id: "GS1-GEO-BIO-VEG",
          name: "Natural Vegetation, Forest Types & Forestry",
          tags: ["PM"],
          microThemes: [
            "Forest significance (economic/ecological/cultural)",
            "Forest classification; grasslands; desert; tundra",
            "Deforestation causes & impacts",
            "Afforestation/reforestation; social forestry; agro-forestry"
          ],
          keywords: [
            "natural vegetation", "forest types", "grasslands", "tundra vegetation",
            "deforestation", "afforestation", "reforestation", "social forestry", "agroforestry"
          ],
          schemes: []
        }
      ]
    },

    /* -------------------- HUMAN + ECONOMIC (WORLD) -------------------- */
    {
      id: "GS1-GEO-HEW",
      name: "Human & Economic Geography (World) — Demography, Activities, Trade, Transport, Settlements",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-GEO-HEW-POP",
          name: "Population & Demography (World)",
          tags: ["PM"],
          microThemes: [
            "Population distribution & density; factors",
            "Growth, migration (push/pull), demographic transition",
            "Population composition: sex ratio, age pyramid, literacy",
            "Population problems; policies (overview)"
          ],
          keywords: [
            "population distribution", "population density", "migration push pull",
            "demographic transition", "age sex pyramid", "sex ratio", "literacy rate"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-HEW-ACTIVITIES",
          name: "Economic Activities (Primary → Quinary) & Manufacturing Basics",
          tags: ["PM"],
          microThemes: [
            "Primary activities: agriculture, mining",
            "Secondary: manufacturing (factors, classification)",
            "Tertiary/quaternary/quinary; digital divide"
          ],
          keywords: [
            "primary activities", "secondary activities", "tertiary activities",
            "manufacturing industries", "mining", "digital divide", "quaternary", "quinary"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-HEW-TRANSPORT-TRADE",
          name: "Transport, Communication & International Trade (World)",
          tags: ["PM"],
          microThemes: [
            "Modes: road/rail/water/air/pipelines",
            "Ports types; gateways of trade",
            "WTO & regional blocs (overview)"
          ],
          keywords: [
            "international trade", "wto", "regional trade blocs",
            "ports types", "sea routes", "inland waterways", "pipelines"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-HEW-SETTLEMENTS",
          name: "Settlements & Urbanization (World basics + India link)",
          tags: ["PM"],
          microThemes: [
            "Rural vs urban settlements; patterns",
            "Urban problems: slums; migration (overview)"
          ],
          keywords: ["settlements", "rural settlements", "urban settlements", "urbanization", "slums", "rural urban migration"],
          schemes: []
        }
      ]
    },

    /* -------------------- INDIAN GEOGRAPHY (PHYSICAL + HUMAN) -------------------- */
    {
      id: "GS1-GEO-IND",
      name: "Indian Geography (Physical + Human + Resources)",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-GEO-IND-PHYSIO",
          name: "Physiography of India (Himalayas, Plains, Plateau, Desert, Coasts, Islands)",
          tags: ["PM"],
          microThemes: [
            "Physiographic divisions; mountain systems",
            "Coasts and islands"
          ],
          keywords: ["physiography of india", "himalayas", "northern plains", "peninsular plateau", "thar desert", "coastal plains", "islands"],
          schemes: []
        },
        {
          id: "GS1-GEO-IND-DRAINAGE",
          name: "Drainage Systems (Indus–Ganga–Brahmaputra + Peninsular Rivers)",
          tags: ["PM"],
          microThemes: [
            "Himalayan vs peninsular drainage",
            "Major rivers, tributaries, river-bank cities (factual layer)"
          ],
          keywords: ["indus river system", "ganga river system", "brahmaputra", "peninsular rivers", "east flowing rivers", "west flowing rivers"],
          schemes: []
        },
        {
          id: "GS1-GEO-IND-CLIMATE",
          name: "Indian Climate & Monsoon (Mechanism + ENSO)",
          tags: ["PM"],
          microThemes: [
            "Factors influencing Indian climate",
            "Monsoon mechanism: classical/modern/jet stream/air mass theories",
            "El Nino/La Nina impacts",
            "Droughts & floods (conceptual)"
          ],
          keywords: ["indian monsoon", "monsoon mechanism", "jet stream theory", "air mass theory", "el nino", "la nina", "drought", "flood"],
          schemes: []
        },
        {
          id: "GS1-GEO-IND-SOILS-VEG",
          name: "Soils & Natural Vegetation in India",
          tags: ["PM"],
          microThemes: [
            "Soil textures; soil erosion; conservation",
            "Forest distribution; mangroves; forest issues"
          ],
          keywords: ["soils in india", "soil erosion", "soil conservation", "mangroves", "forest cover in india"],
          schemes: []
        },
        {
          id: "GS1-GEO-IND-POP-URBAN",
          name: "Population, Settlements & Urbanization in India",
          tags: ["PM"],
          microThemes: [
            "Population size/growth/distribution; census basics",
            "Sex ratio, literacy, density (factual layer)",
            "Urbanization; urban agglomerations"
          ],
          keywords: ["census", "population growth rate", "sex ratio", "literacy", "population density", "urbanization", "urban agglomeration"],
          schemes: []
        },
        {
          id: "GS1-GEO-IND-RESOURCES",
          name: "Resources: Land, Minerals, Energy (India) — Overview",
          tags: ["PM"],
          microThemes: [
            "Land use, land degradation, sustainable land management",
            "Minerals (ferrous/non-ferrous) distribution basics",
            "Energy: coal, petroleum, gas, hydro, nuclear, renewables"
          ],
          keywords: [
            "land degradation", "land use pattern", "minerals in india", "iron ore", "bauxite",
            "coal", "petroleum", "natural gas", "hydropower", "nuclear energy", "solar energy", "wind energy"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-IND-AGRI",
          name: "Agriculture (India) — Basics + Crops + Scheme Hooks",
          tags: ["PM"],
          microThemes: [
            "Cropping seasons; cropping pattern; irrigation; fertilizers; land reforms (overview)",
            "Major crops: rice/wheat/maize; plantation crops; fibre crops; sugarcane",
            "Issues: climate change, feminization, digitization",
            "Scheme hooks (details in Master Scheme Dashboard)"
          ],
          keywords: [
            "cropping pattern", "kharif", "rabi", "zaid", "irrigation",
            "rice", "wheat", "maize", "cotton", "jute", "sugarcane", "tea", "coffee",
            "climate change impact on agriculture", "digital agriculture", "e-nam"
          ],
          schemes: ["PM-KISAN", "PMFBY", "e-NAM", "SoilHealthCard", "RKVY"]
        }
      ]
    },

    /* -------------------- MAINS-ONLY: ECONOMIC + HUMAN (ADVANCED) -------------------- */
    {
      id: "GS1-GEO-MAINS-ECOHUM",
      name: "Economic & Human Geography (Mains Focus)",
      tags: ["M"],
      topics: [
        {
          id: "GS1-GEO-MAINS-RESOURCES",
          name: "Resources & Development Debates (Land/Water/Minerals/Energy)",
          tags: ["M"],
          microThemes: [
            "Land degradation neutrality; land-use planning",
            "Inter-state water disputes; national water policy",
            "Mining problems; national mineral policy 2019",
            "Energy security; renewables; hydropower constraints",
            "Geopolitics of resources; globalization impacts"
          ],
          keywords: [
            "land degradation neutrality", "water disputes", "national water policy",
            "national mineral policy 2019", "energy security", "renewable energy", "hydropower challenges",
            "geopolitics of resources"
          ],
          schemes: []
        },
        {
          id: "GS1-GEO-MAINS-AGRI",
          name: "Agriculture (Mains): Productivity, Policies, Food Security, CSA",
          tags: ["M"],
          microThemes: [
            "MSP debates; APMC issues; e-NAM",
            "Food security vulnerability",
            "GM crops controversy",
            "Climate smart agriculture; diversification; dryland challenges"
          ],
          keywords: [
            "minimum support price", "apmc", "food security", "gm crops", "climate smart agriculture",
            "agriculture diversification", "dry zone farming"
          ],
          schemes: ["PM-KISAN", "PMFBY", "e-NAM", "OperationGreens"]
        },
        {
          id: "GS1-GEO-MAINS-INDUSTRY",
          name: "Industry (Mains): Location Theories + Regional Inequality",
          tags: ["M"],
          microThemes: [
            "Weber; Losch (overview)",
            "Industry patterns: steel/textile/pharma/sugar/food processing",
            "Industrial policy; regional imbalance; tourism impacts"
          ],
          keywords: ["weber model", "losch theory", "industrial location", "regional inequality", "food processing industry", "pharmaceutical industry"],
          schemes: []
        },
        {
          id: "GS1-GEO-MAINS-TRANSPORT",
          name: "Transport & Communication (Mains): Corridors, Ports, Carbon Footprint",
          tags: ["M"],
          microThemes: [
            "Bharatmala, DFC, Sagarmala, UDAN (as hooks)",
            "National waterways; port development challenges",
            "Transport planning, city mobility, carbon footprint"
          ],
          keywords: ["bharatmala", "dedicated freight corridor", "sagarmala", "udan", "national waterways", "carbon footprint transport"],
          schemes: ["Bharatmala", "Sagarmala", "UDAN", "AMRUT", "SmartCities"]
        },
        {
          id: "GS1-GEO-MAINS-URBAN",
          name: "Settlements & Urbanization (Mains): Theories + Indian Urban Issues",
          tags: ["M"],
          microThemes: [
            "Central place theory; primate city; conurbation",
            "Slums; rural-urban continuum; urban governance schemes (hooks)"
          ],
          keywords: ["central place theory", "primate city", "conurbation", "urban slums", "rural urban continuum"],
          schemes: ["PMAY", "SmartCities", "AMRUT", "HRIDAY"]
        }
      ]
    },

    /* -------------------- PRELIMS-ONLY: WORLD REGIONAL FACTS + IN-NEWS -------------------- */
    {
      id: "GS1-GEO-PRE-REGIONAL",
      name: "World Regional Geography (Factual + In-News Places)",
      tags: ["P"],
      topics: [
        {
          id: "GS1-GEO-PRE-REGIONAL-PLACES",
          name: "Continents/Countries/Cities/Straits/Projects (Factual + In News)",
          tags: ["P"],
          microThemes: [
            "Cities on river banks; renamed places; epithets",
            "Straits, ports, corridors, dams, plateaus, disputed regions",
            "Location in news layer (to be updated dynamically)"
          ],
          keywords: [
            "strait", "bosporus", "doklam", "gilgit baltistan", "sir creek", "pangong lake",
            "chabahar", "gwadar", "hambantota", "bimstec", "sco", "bengaluru declaration"
          ],
          schemes: []
        }
      ]
    }
  ]
},
      // Society: { ... },
	  Society: {
  sections: [
    /* -------------------- UPSC CORE (GS1 Society) -------------------- */
    {
      id: "GS1-SOC-UPSC",
      name: "UPSC GS1 Society Core",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-SOC-UPSC-SALIENT",
          name: "Salient features of Indian Society",
          tags: ["PM"],
          microThemes: [
            "Unity in diversity; plural society",
            "Caste, class, gender; hierarchy and mobility",
            "Tradition vs modernity; continuity and change",
            "Family, kinship, marriage systems",
            "Syncretism and composite culture"
          ],
          keywords: [
            "salient features", "indian society", "plural society", "syncretism",
            "tradition modernity", "family kinship", "marriage", "caste class gender"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-UPSC-DIVERSITY",
          name: "Diversity of India",
          tags: ["PM"],
          microThemes: [
            "Forms: linguistic, religious, ethnic, regional, tribal, caste",
            "Reasons: geography, migration, historical processes",
            "Diversity as strength and governance challenge"
          ],
          keywords: [
            "diversity of india", "linguistic diversity", "ethnic diversity",
            "tribal diversity", "regional diversity", "religious diversity"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-UPSC-GLOBAL",
          name: "Effects of globalization on Indian society",
          tags: ["PM"],
          microThemes: [
            "Cultural homogenization vs glocalization",
            "Consumerism; identity politics; lifestyle change",
            "Work and gig economy; migration; urban change",
            "Social media polarization and echo chambers",
            "New localism; anti-globalization movements"
          ],
          keywords: [
            "globalization impact", "glocalization", "consumerism", "gig economy",
            "social media polarizing", "new localism", "anti globalization"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-UPSC-INTEGRATION",
          name: "National Integration; communalism, regionalism & secularism",
          tags: ["M"],
          microThemes: [
            "National integration: meaning, pillars, challenges",
            "Communalism: concept, origin, causes, impact",
            "Regionalism: types, causes, effects, solutions",
            "Secularism: western vs Indian; secularization process",
            "Fundamentalism; communal violence; sons of soil"
          ],
          keywords: [
            "national integration", "communalism", "regionalism", "secularism",
            "secularization", "communal violence", "sons of soil", "fundamentalism"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-UPSC-WOMEN",
          name: "Role of women and women’s organization",
          tags: ["PM"],
          microThemes: [
            "Women movements: 19th century, Gandhian, post-independence",
            "Women in panchayats and governance",
            "Women participation in economy; glass ceiling",
            "Gender budgeting (overview)",
            "Women’s organizations and SHGs"
          ],
          keywords: [
            "women movement", "gandhian era women", "women panchayats",
            "women participation economy", "glass ceiling", "gender budgeting",
            "self help groups", "women organizations"
          ],
          schemes: ["Beti Bachao Beti Padhao", "Mission Shakti"] // linkage hooks only
        },
        {
          id: "GS1-SOC-UPSC-EMPOWER",
          name: "Social empowerment, poverty and developmental issues",
          tags: ["PM"],
          microThemes: [
            "Social empowerment: meaning, tools, constraints",
            "Poverty-hunger link; inequality; exclusion",
            "Inclusive growth: meaning and challenges",
            "Developmental issues and social justice lens"
          ],
          keywords: [
            "social empowerment", "poverty", "hunger", "inequality", "inclusive growth",
            "exclusion", "developmental issues"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-UPSC-VULNERABLE",
          name: "Welfare schemes, laws, institutions for vulnerable sections",
          tags: ["M"],
          microThemes: [
            "Vulnerable groups: SC/ST, minorities, women, children, PwD, elderly, transgender",
            "Mechanisms: commissions, ministries, legal frameworks (overview)",
            "Performance analysis: leakages, targeting, last-mile delivery",
            "Rights-based approach vs welfare approach"
          ],
          keywords: [
            "welfare schemes vulnerable", "mechanisms laws institutions bodies",
            "commission for", "rights based approach", "last mile delivery",
            "leakage targeting", "vulnerable sections"
          ],
          schemes: [] // keep detailed scheme data in Master Scheme Dashboard
        },
        {
          id: "GS1-SOC-UPSC-SOCIALSECTOR",
          name: "Social sector services: Health, Education, HR",
          tags: ["M"],
          microThemes: [
            "Health sector issues: access, affordability, quality",
            "Education sector issues: learning outcomes, equity",
            "Human resources development: skilling, employability",
            "Why schemes fail: governance, capacity, awareness"
          ],
          keywords: [
            "social sector", "health sector", "education sector", "human resources",
            "why schemes fail", "governance capacity", "learning outcomes"
          ],
          schemes: ["Ayushman Bharat"] // linkage hook only
        }
      ]
    },

    /* -------------------- UNITY IN DIVERSITY (DETAILED) -------------------- */
    {
      id: "GS1-SOC-UNITY",
      name: "Unity in Diversity & Challenges to Integration",
      tags: ["M"],
      topics: [
        {
          id: "GS1-SOC-UNITY-CONCEPT",
          name: "Unity in Diversity: concepts, bonds, safeguards",
          tags: ["M"],
          microThemes: [
            "Geo-political unity",
            "Pilgrimage as integrative institution",
            "Accommodation and syncretism",
            "Interdependence and economic linkages",
            "Role of leaders; constitutional safeguards"
          ],
          keywords: [
            "unity in diversity", "pilgrimage", "accommodation", "interdependence",
            "constitutional safeguards", "integrative institution"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-UNITY-CHALLENGES",
          name: "Challenges of diversity to unity",
          tags: ["M"],
          microThemes: [
            "Casteism, linguism, communalism",
            "Regional disparities and identities",
            "Ethno-nationality and ethnic conflicts",
            "Tribal identity politics",
            "Social inequalities"
          ],
          keywords: [
            "casteism", "linguism", "regional disparities", "ethnic conflict",
            "ethno nationality", "tribal identity", "social inequalities"
          ],
          schemes: []
        }
      ]
    },

    /* -------------------- BASIC SOCIOLOGICAL CONCEPTS -------------------- */
    {
      id: "GS1-SOC-BASICS",
      name: "Basic Sociological Concepts",
      tags: ["M"],
      topics: [
        {
          id: "GS1-SOC-BASICS-FAMILY",
          name: "Family, Kinship and Patriarchy in India",
          tags: ["M"],
          microThemes: [
            "Family types; changing family structure",
            "Kinship systems; marriage and social norms",
            "Patriarchy: manifestations and consequences",
            "Impact of modernization on family/kinship"
          ],
          keywords: [
            "family and kinship", "kinship", "marriage system", "patriarchy",
            "changing family", "modernization family"
          ],
          schemes: []
        }
      ]
    },

    /* -------------------- SOCIAL EMPOWERMENT: SC/ST/MINORITIES -------------------- */
    {
      id: "GS1-SOC-EMPOWER",
      name: "Social Empowerment: SC/ST/Minorities",
      tags: ["M"],
      topics: [
        {
          id: "GS1-SOC-EMPOWER-CONST",
          name: "Constitutional provisions for Social Justice (SC/ST etc.)",
          tags: ["M"],
          microThemes: [
            "Constitutional safeguards (broad mapping)",
            "Institutions for protection and empowerment (overview)"
          ],
          keywords: [
            "constitutional provisions social justice", "safeguards sc st",
            "institutions for protection", "social justice empowerment"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-EMPOWER-SC",
          name: "Scheduled Castes: identity, issues, state efforts",
          tags: ["M"],
          microThemes: [
            "From untouchable to Dalit identity formation",
            "Caste atrocities: forms and causes",
            "State mechanisms against atrocities (overview)",
            "Dalits: political implications"
          ],
          keywords: [
            "dalit", "untouchability", "sc atrocities", "caste violence",
            "dalit identity formation", "political implications dalits"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-EMPOWER-TRIBAL",
          name: "Tribals: issues, displacement, Forest Rights",
          tags: ["M"],
          microThemes: [
            "Indebtedness and exploitation",
            "Forest-related problems; environment destruction",
            "Development displacement and rehabilitation",
            "Forest Rights Act (analysis lens)"
          ],
          keywords: [
            "tribals in india", "indebtedness", "displacement",
            "forest rights act", "rehabilitation", "forest related problems"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-EMPOWER-MINOR",
          name: "Status of minorities in India",
          tags: ["M"],
          microThemes: [
            "Minority rights and inclusion (broad)",
            "Challenges: discrimination, representation, security"
          ],
          keywords: ["minorities in india", "minority rights", "representation minorities", "discrimination minorities"],
          schemes: []
        }
      ]
    },

    /* -------------------- WOMEN ISSUES (ADVANCED LIST) -------------------- */
    {
      id: "GS1-SOC-WOMEN-ISSUES",
      name: "Women Issues & Debates",
      tags: ["M"],
      topics: [
        {
          id: "GS1-SOC-WOMEN-LAWS",
          name: "Women: laws, debates, social change",
          tags: ["M"],
          microThemes: [
            "Violence against women; stalking and harassment",
            "Marital rape debate; adultery decriminalization context",
            "Triple talaq law context; women entry to worship places",
            "Surrogacy debates; maternity laws issues",
            "Women in judiciary; dowry-related issues",
            "MeToo movement; corporate gender discrimination"
          ],
          keywords: [
            "marital rape", "dowry", "metoo", "triple talaq",
            "women entry place of worship", "surrogacy", "maternity laws",
            "stalking laws", "adultery no longer a crime", "corporate gender discrimination"
          ],
          schemes: []
        }
      ]
    },

    /* -------------------- POVERTY, INEQUALITY, GLOBALIZATION, URBANIZATION -------------------- */
    {
      id: "GS1-SOC-DEV",
      name: "Poverty, Inequality, Globalization, Urbanization",
      tags: ["PM"],
      topics: [
        {
          id: "GS1-SOC-DEV-POVERTY",
          name: "Understanding poverty, inequality and policies",
          tags: ["PM"],
          microThemes: [
            "Dimensions of poverty",
            "Poverty-development linkage",
            "Rangarajan committee (mention lens)",
            "Poverty alleviation since independence (overview)",
            "Concept of inequality"
          ],
          keywords: [
            "dimensions of poverty", "poverty development linkage",
            "rangarajan committee", "poverty alleviation strategy", "inequality"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-DEV-GLOBAL",
          name: "Globalization: meaning, reasons, dimensions",
          tags: ["PM"],
          microThemes: [
            "Political, cultural-social, economic impacts",
            "Anti-globalization movement; new localism",
            "NPM (New Public Management) (as a mention hook)"
          ],
          keywords: ["meaning of globalization", "dimensions of globalization", "new public management", "npm", "new localism"],
          schemes: []
        },
        {
          id: "GS1-SOC-DEV-URBAN",
          name: "Urbanization & governance; Smart Cities (analysis)",
          tags: ["PM"],
          microThemes: [
            "Trends and patterns",
            "Service delivery and governance",
            "Urban projects; smart city mission analysis",
            "SDGs and urbanization link"
          ],
          keywords: [
            "urbanization trends", "service delivery", "urban governance",
            "smart city mission", "sdgs and urbanization", "slums"
          ],
          schemes: ["Smart Cities", "AMRUT", "PMAY", "HRIDAY"] // hooks only
        },
        {
          id: "GS1-SOC-DEV-CENSUS",
          name: "Census 2011 & socio-demographic issues",
          tags: ["PM"],
          microThemes: [
            "Highlights of Census 2011",
            "Sex ratio and skewed ratio impact",
            "Female infanticide prevention laws (hook)",
            "Literacy trends and challenges; improvement efforts",
            "Old age population: issues and policy initiatives",
            "SECC 2011; NRC (hook for dynamic layer)"
          ],
          keywords: [
            "census 2011", "sex ratio", "skewed sex ratio", "female infanticide",
            "literacy rate", "old age population", "secc 2011", "nrc"
          ],
          schemes: []
        }
      ]
    },

    /* -------------------- CHILDREN + OTHER CONTEMPORARY ISSUES -------------------- */
    {
      id: "GS1-SOC-CONTEMP",
      name: "Contemporary Issues (Dynamic Hooks)",
      tags: ["M"],
      topics: [
        {
          id: "GS1-SOC-CONTEMP-CHILD",
          name: "Children: protection, malnutrition, juvenile justice",
          tags: ["M"],
          microThemes: [
            "Child trafficking; street children",
            "Malnutrition; schooling safety",
            "Child labour law changes (hook)",
            "Juvenile justice; child marriage",
            "National Action Plan for Children (hook)"
          ],
          keywords: [
            "child trafficking", "street children", "malnutrition",
            "juvenile justice", "child marriage", "child labour act", "school safety"
          ],
          schemes: []
        },
        {
          id: "GS1-SOC-CONTEMP-OTHER",
          name: "Other social debates and issues",
          tags: ["M"],
          microThemes: [
            "Same-sex marriage debate",
            "Domestic workers: laws and issues",
            "Human trafficking law gaps",
            "Transgender rights debates",
            "Mental health care",
            "Manual scavenging",
            "Mob lynching and rule of law",
            "Right to privacy judgement (hook)",
            "HIV stigma"
          ],
                    keywords: [
            "same sex marriage", "domestic workers", "human trafficking laws",
            "transgender bill", "mental health care bill", "manual scavenging",
            "mob lynching", "right to privacy judgement", "hiv stigma"
          ],
          schemes: []
        }
      ]
    }
  ]
} // ✅ end of Society subject
    } // ✅ end of GS1.subjects
  },  // ✅ end of GS1 (comma REQUIRED because GS2 comes next)

  // ===================== GS2 =====================
  GS2: {
    heading: "GS 2: Governance, Constitution, Polity, Social Justice & International relations",
    macroTheme: "Constitutionalism, Governance Capacity, Social Justice, and External Relations",
    subjects: {
      Polity: {
        sections: [
          {
            id: "GS2-POL-EVOL",
            name: "Evolution of the Constitution (1773–1947) + Constituent Assembly",
            tags: ["PM"],
            topics: [
              {
                id: "GS2-POL-EVOL-COMPANY",
                name: "Company Rule (1773–1858) + Acts",
                tags: ["P"],
                microThemes: [
                  "Regulating Act 1773",
                  "Amending Act 1781",
                  "Pitt’s India Act 1784",
                  "Charter Acts 1793/1813/1833/1853"
                ],
                keywords: [
                  "regulating act 1773", "pitt's india act 1784", "charter act 1833", "charter act 1853"
                ],
                schemes: []
              },
              {
                id: "GS2-POL-EVOL-CROWN",
                name: "Crown Rule (1858–1947) + Constitutional Developments",
                tags: ["P"],
                microThemes: [
                  "Government of India Act 1858",
                  "Indian Councils Acts 1861/1892/1909",
                  "Government of India Acts 1919/1935",
                  "Simon Commission",
                  "Indian Independence Act 1947"
                ],
                keywords: [
                  "goi act 1858", "indian councils act 1909", "goi act 1919", "goi act 1935", "simon commission", "independence act 1947"
                ],
                schemes: []
              },
              {
                id: "GS2-POL-EVOL-CA",
                name: "Drafting, Sources & Committees of the Constituent Assembly",
                tags: ["PM"],
                microThemes: [
                  "Sources: seminal / external / developmental",
                  "Constitutional practices",
                  "Important committees + chairmen"
                ],
                keywords: [
                  "constituent assembly committees", "drafting committee", "sources of indian constitution"
                ],
                schemes: []
              }
            ]
          },

          {
            id: "GS2-POL-FEATURES",
            name: "Salient Features, Preamble, Amendments, Basic Structure, Doctrines",
            tags: ["PM"],
            topics: [
              {
                id: "GS2-POL-PREAMBLE",
                name: "Preamble and Values",
                tags: ["PM"],
                microThemes: [
                  "Objectives in Preamble",
                  "Preamble as part of Constitution",
                  "Amendability",
                  "Key ideals: Sovereign, Socialist, Secular, Democratic, Republic, Justice, Liberty, Equality, Fraternity"
                ],
                keywords: ["preamble", "berubari", "kesavananda", "socialist secular democratic"],
                schemes: []
              },
              {
                id: "GS2-POL-AMEND",
                name: "Amendment Procedure + Types + Basic Structure",
                tags: ["PM"],
                microThemes: [
                  "Procedure (Article 368)",
                  "Types of amendments",
                  "Basic structure: ingredients",
                  "Amendability of Fundamental Rights"
                ],
                keywords: ["article 368", "basic structure", "amendment types", "amendability of fundamental rights"],
                schemes: []
              },
              {
                id: "GS2-POL-DOCTRINES",
                name: "Key Constitutional Doctrines/Terms",
                tags: ["PM"],
                microThemes: [
                  "Severability, Eclipse, Harmonious Construction",
                  "Pith and Substance, Colorable Legislation, Territorial Nexus",
                  "Laches",
                  "Due Process vs Procedure Established by Law"
                ],
                keywords: [
                  "doctrine of eclipse", "harmonious construction", "pith and substance", "colorable legislation", "territorial nexus", "due process", "procedure established by law"
                ],
                schemes: []
              }
            ]
          },

          {
            id: "GS2-POL-UNION",
            name: "Union & Its Territory + Citizenship",
            tags: ["PM"],
            topics: [
              {
                id: "GS2-POL-UTERR",
                name: "Union and Its Territory (Articles 1–4) + Delimitation/SRC",
                tags: ["PM"],
                microThemes: [
                  "Articles 1–4",
                  "State Reorganisation Commission 1953",
                  "Delimitation Commission"
                ],
                keywords: ["articles 1-4", "state reorganisation commission", "delimitation commission"],
                schemes: []
              },
              {
                id: "GS2-POL-CITIZEN",
                name: "Citizenship (Constitution + Citizenship Act 1955)",
                tags: ["PM"],
                microThemes: [
                  "Constitutional provisions",
                  "Citizenship Act 1955",
                  "Modes of acquiring/losing citizenship",
                  "Dual citizenship debate",
                  "Indian diaspora basics"
                ],
                keywords: ["citizenship act 1955", "dual citizenship", "nri", "pravasi bharatiya divas"],
                schemes: []
              }
            ]
          },

          {
            id: "GS2-POL-FR-DPSP-FD",
            name: "FR, DPSP, Fundamental Duties",
            tags: ["PM"],
            topics: [
              {
                id: "GS2-POL-FR",
                name: "Fundamental Rights (Articles 12–35)",
                tags: ["PM"],
                microThemes: [
                  "Articles 12 & 13",
                  "Equality (14–18)",
                  "Freedom (19–22)",
                  "Exploitation (23–24)",
                  "Religion (25–28)",
                  "Cultural/Educational (29–30)",
                  "Remedies (32) + writs"
                ],
                keywords: ["article 12", "article 13", "article 14", "article 19", "article 21", "article 32", "writs"],
                schemes: []
              },
              {
                id: "GS2-POL-DPSP",
                name: "DPSP (Part IV) + Outside Part IV",
                tags: ["PM"],
                microThemes: [
                  "Socialistic/Gandhian/Liberal principles",
                  "Important articles: 38–51",
                  "Articles 335, 350A, 351 (outside Part IV)"
                ],
                keywords: ["dpsp", "part iv", "article 44", "article 48a", "article 51"],
                schemes: []
              },
              {
                id: "GS2-POL-FD",
                name: "Fundamental Duties (Article 51A) + Recent Developments",
                tags: ["PM"],
                microThemes: [
                  "List of duties",
                  "FD vs FR relationship",
                  "86th Amendment 2002/03 (RTE linkage)",
                  "Examples: anthem, national honour act, Aadhaar debate hooks"
                ],
                keywords: ["article 51a", "fundamental duties", "national honour act 1971", "rte 86th amendment"],
                schemes: []
              }
            ]
          },

          {
            id: "GS2-POL-GOVSYSTEM",
            name: "System of Governance: Centre-State, Emergency, Executive, Legislature, Judiciary, Bodies",
            tags: ["PM"],
            topics: [
              { id: "GS2-POL-CSREL", name: "Centre-State Relations + Inter-State Relations", tags: ["PM"], microThemes: ["Legislative/Administrative/Financial relations", "Inter-State Council, Zonal Councils", "Inter-state water disputes"], keywords: ["centre state relations", "inter state council", "zonal council", "water dispute"], schemes: [] },
              { id: "GS2-POL-EMER", name: "Emergency Provisions", tags: ["PM"], microThemes: ["National", "President’s Rule", "Financial emergency"], keywords: ["national emergency", "article 356", "president rule", "financial emergency"], schemes: [] },
              { id: "GS2-POL-EXEC", name: "Union Executive", tags: ["PM"], microThemes: ["President, VP, PM, Council of Ministers"], keywords: ["president powers", "ordinance article 123", "prime minister", "article 74", "article 75"], schemes: [] },
              { id: "GS2-POL-PARL", name: "Union Legislature (Parliament)", tags: ["PM"], microThemes: ["Lok Sabha/Rajya Sabha, Speaker/Chairman, Bills, Budget, Committees, Privileges"], keywords: ["parliament", "money bill", "budget article 112", "speaker", "parliamentary committees"], schemes: [] },
              { id: "GS2-POL-STATE", name: "State Executive + Legislature", tags: ["PM"], microThemes: ["Governor, CM, CoM, Vidhan Sabha/Parishad"], keywords: ["governor", "article 153", "chief minister", "vidhan sabha", "article 169"], schemes: [] },
              { id: "GS2-POL-LOCAL", name: "Local Government (73rd/74th)", tags: ["PM"], microThemes: ["Panchayati Raj, Urban local bodies"], keywords: ["73rd amendment", "74th amendment", "panchayati raj", "municipality"], schemes: [] },
              { id: "GS2-POL-UTS", name: "Union Territories + Special Areas", tags: ["PM"], microThemes: ["UT administration, Delhi provisions, schedules/tribal areas"], keywords: ["union territory", "delhi special provisions", "schedule areas", "tribal areas"], schemes: [] },
              { id: "GS2-POL-JUD", name: "Judiciary + Lok Adalats", tags: ["PM"], microThemes: ["SC/HC, independence, appointments, tribunals, ADR, NALSA"], keywords: ["supreme court", "high court", "judicial independence", "lok adalat", "nalsa"], schemes: [] },
              { id: "GS2-POL-BODIES", name: "Constitutional & Non-Constitutional Bodies", tags: ["PM"], microThemes: ["CAG, UPSC, Finance Commission, NHRC, CIC, Lokpal, CVC"], keywords: ["cag", "upsc", "finance commission", "nhrc", "cic", "lokpal", "cvc"], schemes: [] }
            ]
          },
          {
            id: "GS2-POL-POLITICS",
            name: "Political Dynamics (Elections, Parties, Pressure Groups)",
            tags: ["PM"],
            topics: [
              {
                id: "GS2-POL-ELECTIONS",
                name: "Electoral System + Reforms + RPA",
                tags: ["PM"],
                microThemes: [
                  "RPA 1950/1951",
                  "Electoral reforms, criminalisation, anti-defection",
                  "Pressure groups + role"
                ],
                keywords: ["rpa 1950", "rpa 1951", "anti defection", "criminalisation of politics", "pressure groups"],
                schemes: []
              }
            ]
          },
          {
            id: "GS2-POL-MAINS-FEATURES",
            name: "Polity & Governance (Mains): Features, Amendments, Debates, RPA, Pressure Groups",
            tags: ["M"],
            topics: [
              {
                id: "GS2-POL-MAINS-HIST",
                name: "Historical Underpinnings + Evolution + Constituent Assembly Vision",
                tags: ["M"],
                microThemes: [
                  "Why constitution? historical background",
                  "Constituent Assembly: vision, making of constitution",
                  "Constitution as living document; democracy & diversity",
                  "Crisis of democratic order",
                  "National Commission to Review the Working of the Constitution"
                ],
                keywords: [
                  "historical underpinnings", "constituent assembly vision", "living document",
                  "crisis of democratic order", "ncrwc", "review working of the constitution"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-COMPARE",
                name: "Comparison with Other Countries + Systems + Conventions",
                tags: ["M"],
                microThemes: [
                  "Comparison of Indian constitutional scheme with other countries",
                  "Parliamentary vs Presidential; semi-presidential idea",
                  "Role of conventions",
                  "Judicial review vs parliamentary supremacy"
                ],
                keywords: [
                  "comparison with other countries", "parliamentary system", "presidential system",
                  "conventions", "judicial review", "parliamentary supremacy"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-AMEND",
                name: "Amendments + Basic Structure + Landmark Amendments",
                tags: ["PM"],
                microThemes: [
                  "Amendment process and politics",
                  "Kesavananda Bharati and basic structure",
                  "42nd and 44th amendments",
                  "103rd amendment (EWS reservation) + debates",
                  "Other proposed amendments (hook)"
                ],
                keywords: [
                  "kesavananda", "basic structure", "42nd amendment", "44th amendment",
                  "103rd amendment", "ews reservation", "constitutional amendment politics"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-FR-DEBATES",
                name: "FR + Rule of Law + Major Debates (Speech, Privacy, RTI, Sedition etc.)",
                tags: ["M"],
                microThemes: [
                  "Rule of law; exceptions/limitations on FR",
                  "Procedure established by law vs due process",
                  "Freedom of press; censorship; hate speech",
                  "Data protection: privacy vs innovation; Aadhaar & privacy",
                  "RTI Act 2005; RTI amendments",
                  "Sedition (124A) debate; defamation decriminalisation debate",
                  "Living wills / euthanasia",
                  "Women entry in places of worship",
                  "Reservation debates: promotion, quotas, judicial positions"
                ],
                keywords: [
                  "rule of law", "procedure established by law", "due process",
                  "freedom of press", "hate speech", "data protection", "privacy vs innovation",
                  "aadhaar privacy", "rti amendments", "sedition 124a", "defamation decriminalised",
                  "living will", "euthanasia", "women entry worship", "reservation in promotion"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-DPSP-UCC-FD",
                name: "DPSP Scope + FR vs DPSP + UCC + Fundamental Duties",
                tags: ["M"],
                microThemes: [
                  "Scope of DPSP: economic & social democracy",
                  "Implementation challenges",
                  "FR vs DPSP conflict; judiciary harmonisation",
                  "Uniform Civil Code: debates and feasibility",
                  "Fundamental duties and civic culture"
                ],
                keywords: [
                  "scope of dpsp", "economic social democracy", "fr vs dpsp",
                  "harmonizing fr dpsp", "uniform civil code", "ucc debate", "fundamental duties"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-UTS",
                name: "Union Territories + LG vs CM + Special Provisions + Scheduled/Tribal Areas",
                tags: ["M"],
                microThemes: [
                  "Union Territories and administration",
                  "CM vs Lieutenant Governor: powers & conflicts",
                  "Special provisions for some states",
                  "J&K special status (historical + post-changes as hooks)",
                  "Scheduled areas and tribal areas; governance issues",
                  "Official language debates; 58th amendment reasons (hook)"
                ],
                keywords: [
                  "union territories", "lieutenant governor powers", "cm vs lg",
                  "special provisions for states", "jammu kashmir special status",
                  "scheduled areas", "tribal areas", "official language", "58th amendment"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-DOCTRINES",
                name: "Major Doctrines (Judicial): Basic Structure, Eclipse, Pith & Substance etc.",
                tags: ["PM"],
                microThemes: [
                  "Basic structure",
                  "Harmonious construction",
                  "Eclipse",
                  "Pith and substance",
                  "Incidental/ancillary powers",
                  "Colourable legislation",
                  "Severability",
                  "Territorial nexus",
                  "Laches"
                ],
                keywords: [
                  "harmonious construction", "doctrine of eclipse", "pith and substance",
                  "incidental powers", "colourable legislation", "severability",
                  "territorial nexus", "laches"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-PRESSURE",
                name: "Pressure Groups + Movements + Civil Society",
                tags: ["M"],
                microThemes: [
                  "Pressure groups: formal/informal, methods, role",
                  "Popular struggles and movements",
                  "Role of civil society in democracy"
                ],
                keywords: [
                  "pressure groups", "popular movements", "civil society role"
                ],
                schemes: []
              },

              {
                id: "GS2-POL-MAINS-RPA-ELECT",
                name: "Elections + RPA + Electoral Reforms + Funding + Anti-Defection",
                tags: ["PM"],
                microThemes: [
                  "Salient features of RPA; election laws",
                  "NOTA; absentee ballot; proportional representation; tactical voting",
                  "Electoral reforms; simultaneous elections; paper trail (VVPAT hooks)",
                  "Political parties issues; inner party democracy; strong opposition",
                  "Criminalisation of politics; freebies debate",
                  "Election funding: electoral bonds, corporate funding, state funding",
                  "Women in elections",
                  "Anti-defection law and reform debate",
                  "Right to recall debate"
                ],
                keywords: [
                  "representation of people act", "rpa salient features", "nota", "absentee ballot",
                  "proportional representation", "tactical voting", "simultaneous elections",
                  "vvpat", "criminalisation of politics", "freebies politics", "electoral bonds",
                  "state funding", "anti defection law", "right to recall"
                ],
                schemes: []
              },

                           {
                id: "GS2-POL-MAINS-VULNERABLE-LAWS",
                name: "Vulnerable Sections: Laws/Institutions + Sensitive Debates",
                tags: ["M"],
                microThemes: [
                  "Mechanisms, laws, institutions for vulnerable sections",
                  "Special provisions for certain classes",
                  "SC/ST Act debates (protection vs misuse arguments)",
                  "Muslim personal law: polygamy/triple talaq debates"
                ],
                keywords: [
                  "vulnerable sections institutions",
                  "special provisions certain classes",
                  "sc st act judgement",
                  "triple talaq",
                  "muslim personal law"
                ],
                schemes: []
              },
              {
  id: "GS2-POL-MAINS-EXEC-LEG-JUD-FED",
  name: "Polity & Governance (Mains): Executive, Legislature, Judiciary, Federalism, Devolution, Dispute Redressal",
  tags: ["M"],
  topics: [
    {
      id: "GS2-POL-MAINS-FEDERAL",
      name: "Federal Structure: Union–State Relations, Special Status, New States, Emergency Issues",
      tags: ["M"],
      microThemes: [
        "Nature of Indian federalism; peculiar features; critique",
        "Union & its territory; formation of states; alteration of boundaries",
        "Challenges of nation building; regional aspirations; one-party dominance era",
        "Demand for new states: Gorkhaland, Nagalim, Vidarbha, Purvanchal etc.",
        "Emergency provisions; President’s Rule; FR during emergency",
        "Conversion of state to UT by Centre: constitutional questions"
      ],
      keywords: [
        "federal structure", "indian federalism", "union and its territory",
        "formation of states", "alteration of boundaries", "demand for new states",
        "regional aspirations", "emergency provisions", "president rule",
        "fundamental rights during emergency", "state to ut conversion"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-UNION-EXEC",
      name: "Union Executive: President, VP, PM, Council of Ministers, Cabinet Committees",
      tags: ["M"],
      microThemes: [
        "President: discretionary powers; President’s Rule; ‘rubber stamp’ debate",
        "Vice President: role and functions",
        "Prime Minister: role, powers, leadership",
        "Council of Ministers: responsibility, cabinet vs CoM",
        "Cabinet Committees: role in governance"
      ],
      keywords: [
        "union executive", "president discretionary powers", "rubber stamp president",
        "vice president", "prime minister powers", "council of ministers",
        "cabinet committees", "president rule"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-STATE-EXEC",
      name: "State Executive: Governor, CM, State Council of Ministers",
      tags: ["M"],
      microThemes: [
        "Governor: discretionary powers; politicisation; removal (Article 156)",
        "Chief Minister: role; relation with Governor",
        "State Council of Ministers: functioning and responsibility"
      ],
      keywords: [
        "state executive", "governor discretionary powers", "politicisation of governor",
        "article 156", "chief minister powers", "state council of ministers"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-PARLIAMENT",
      name: "Parliament: Structure, Functioning, Procedures, Committees, Privileges, Ordinances, Budget",
      tags: ["M"],
      microThemes: [
        "Sessions: adjournment, prorogation, dissolution",
        "Lacunae in parliamentary functioning",
        "Bill lapsing; misuse of ordinance power",
        "Majorities in Parliament; Rajya Sabha election procedure; relevance of Rajya Sabha",
        "Office of Speaker: powers and issues; office of profit",
        "Parliamentary privileges; breach of privilege",
        "Parliamentary committees: roles; diminishing importance",
        "Budget basics: budget documents; cut motions (policy/economy/token)"
      ],
      keywords: [
        "sessions of parliament", "adjournment", "prorogation", "dissolution",
        "bill lapse", "ordinance misuse", "types of majorities",
        "rajya sabha election", "relevance of rajya sabha",
        "speaker powers", "office of profit", "breach of privilege",
        "parliamentary committees", "budget documents", "cut motions"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-STATE-LEG",
      name: "State Legislature: Structure, Council, Delhi Statehood Debate",
      tags: ["M"],
      microThemes: [
        "State legislature: functioning and issues",
        "Legislative Council: relevance debate",
        "Full statehood to Delhi: pros/cons (hook)"
      ],
      keywords: [
        "state legislature", "legislative council relevance",
        "full statehood to delhi"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-UNION-STATE-FUNCTIONS",
      name: "Functions & Responsibilities of Union and States: 7th Schedule, Separation of Powers, Power Sharing",
      tags: ["M"],
      microThemes: [
        "7th Schedule: Union/State/Concurrent lists",
        "Separation of powers; power sharing",
        "Centre–State relations; Inter-State Council vs NDC",
        "States and foreign policy debate; separate state flag issues (hook)",
        "NITI Aayog replacing Planning Commission: implications"
      ],
      keywords: [
        "7th schedule", "union list", "state list", "concurrent list",
        "separation of powers", "power sharing",
        "centre state relations", "inter state council", "national development council",
        "states in foreign policy", "separate state flag", "niti aayog planning commission"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-DISPUTE-REDRESSAL",
      name: "Dispute Redressal Mechanisms: Inter-State Disputes, Tribunals, Parliamentary Forums/Groups, National Integration",
      tags: ["M"],
      microThemes: [
        "Inter-state relations and mechanisms",
        "Inter-state river water disputes",
        "Inter-state councils and coordination",
        "Administrative tribunals and challenges",
        "Parliamentary forums/groups (overview)",
        "National integration mechanisms"
      ],
      keywords: [
        "inter state relations", "river water dispute", "inter state councils",
        "administrative tribunals", "parliamentary forums", "parliamentary groups",
        "national integration"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-DEVOLUTION",
      name: "Devolution to Local Levels: Panchayats, Municipalities, PESA, Finance & Challenges",
      tags: ["M"],
      microThemes: [
        "Devolution of powers and finances: challenges",
        "Local governments: Panchayati Raj; PESA 1996",
        "Municipalities and urban governance alignment with missions (hook)",
        "Nagaland reservation in urban bodies (hook)",
        "Education qualification for local body elections (hook)"
      ],
      keywords: [
        "devolution of powers", "devolution of finances", "local governments",
        "panchayati raj", "pesa 1996", "municipalities",
        "nagaland reservation urban bodies", "education qualification local elections"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-MAINS-JUDICIARY",
      name: "Judiciary: Appointments, Collegium vs NJAC, Accountability, Review/Activism, Pendency, Tribunals, ADR, Key Judgements",
      tags: ["M"],
      microThemes: [
        "Higher judiciary appointments; collegium issues; collegium vs NJAC",
        "CJI removal (overview)",
        "Judicial review; judicial activism vs overreach",
        "Judicial accountability; RTI and judiciary",
        "PIL: role and misuse",
        "National Litigation Policy (hook)",
        "All India Judicial Service; National Court of Appeal (hook)",
        "Judicial pendency; reforms; tribunals and bypassing HC issues",
        "ADR mechanisms",
        "Major SC judgements: right to convert; caste/religion in polls; Aadhaar validity with caveats; Cauvery verdict",
        "Defamation debates; live streaming of SC proceedings (hook)",
        "Reservation in promotion: arguments for/against"
      ],
      keywords: [
        "higher judiciary appointments", "collegium system", "njac",
        "cji removal", "judicial review", "judicial activism", "judicial overreach",
        "judicial accountability", "rti judiciary", "pil",
        "all india judicial service", "national court of appeal",
        "judicial pendency", "judicial reforms", "tribunals bypassing hc",
        "adr", "right to convert", "aadhaar caveats", "cauvery verdict",
        "defamation", "live streaming sc proceedings",
        "reservation in promotion"
      ],
      schemes: []
    }
  ]
}
            ]
          }
        ]
      }, // ✅ COMMA here: Polity ends, next subject starts

      Governance: { sections: [{
  id: "GS2-GOV-MAINS",
  name: "Governance (Mains): Policies, Transparency, E-Governance, Civil Services, Bodies/Regulators, Development Industry",
  tags: ["M"],
  topics: [
    {
      id: "GS2-GOV-GOOD-GOV",
      name: "Good Governance: Concept, Issues, Rights-Based Approach, Policy Design & Implementation",
      tags: ["M"],
      microThemes: [
        "Concept of good governance",
        "Issues concerning governance",
        "Rights-based approach in policy making",
        "Public policy making and implementation gaps",
        "How to establish good governance (principles, reforms)"
      ],
      keywords: [
        "good governance", "rights based approach", "policy design", "policy implementation",
        "governance issues", "governance reforms"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-TRANSPARENCY",
      name: "Transparency & Accountability: RTI, Citizen Charters, OSA, Media/Social Media, Right to Service",
      tags: ["M"],
      microThemes: [
        "Right to Information (RTI): purpose and issues",
        "RTI vs Official Secrets Act; transparency vs secrecy; judiciary isolation debate (hook)",
        "Information sharing and transparency in government",
        "Citizen Charters: benefits, evaluation, implementation problems, improvements",
        "Sevottam model; ARC 7-step model for citizen-centricity",
        "Right to Service framework",
        "Media role in accountability; social media accountability; openness of platforms",
        "Hate speech committee references (K. Viswanathan Committee) (hook)"
      ],
      keywords: [
        "rti", "official secrets act", "citizen charter", "sevottam model", "arc seven step model",
        "right to service", "media transparency", "social media accountability", "hate speech committee"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-EGOV",
      name: "E-Governance: Applications, Models, Successes, Limitations, Projects & Challenges",
      tags: ["M"],
      microThemes: [
        "E-governance applications and models",
        "Successes and limitations; potential and risks",
        "Role of e-governance in transparency and accountability",
        "Major e-governance projects and implementation challenges"
      ],
      keywords: [
        "e governance", "digital governance", "e governance models",
        "e governance successes", "e governance limitations", "major e governance projects"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-CIVIL-SERVICES",
      name: "Role of Civil Services in a Democracy: Neutrality, Ethics, Reforms, Lateral Entry, Performance, MCC",
      tags: ["M"],
      microThemes: [
        "Concept and need of civil services",
        "Roles: law making support, policy formulation, implementation, evaluation",
        "Civil services as protector of democracy; protection of minorities",
        "Inclusive and sustainable growth facilitation",
        "Lateral entry debate",
        "Civil servants vs political executive: relationship",
        "Performance appraisal systems; reforms needed in bureaucracy",
        "Codes of ethics and code of conduct",
        "Model Code of Conduct (MCC)",
        "Paid news and poll-related abuse; public funds utilisation; PAC significance",
        "Corruption and incompetence challenges"
      ],
      keywords: [
        "role of civil services", "bureaucracy reforms", "lateral entry",
        "civil servant political executive", "performance appraisal", "codes of ethics",
        "model code of conduct", "paid news", "public accounts committee", "corruption"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-REGULATORY-REFORMS",
      name: "Regulatory Structure & Governance Reforms: CAG/CBI/CVC/NHRC, Lokpal, Police/Prison Reforms, Corporate Governance",
      tags: ["M"],
      microThemes: [
        "Autonomy and functioning of oversight bodies: CAG, CBI, CVC, NHRC",
        "Lokpal and ombudsman journey; effectiveness evaluation",
        "Local governments: state and operational effectiveness",
        "Corporate governance: importance and challenges",
        "Police reforms; VIP culture curb; prison reforms",
        "Improving governance in public systems"
      ],
      keywords: [
        "cag autonomy", "cbi autonomy", "cvc autonomy", "nhrc functioning",
        "lokpal effectiveness", "ombudsman", "police reforms", "prison reforms",
        "vip culture", "corporate governance", "local government effectiveness"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-DEVELOPMENT-INDUSTRY",
      name: "Development Processes & Development Industry: NGOs, SHGs, MFIs, Donors, Foreign Aid, Pressure Group Politics",
      tags: ["M"],
      microThemes: [
        "Role of SHGs in development; shortcomings and improvements",
        "Role and functions of NGOs; challenges; fund mismanagement",
        "Microfinance institutions: issues and recommendations",
        "Donors, charities, institutional stakeholders: ecosystem",
        "Foreign aid in development: role and concerns",
        "Pressure groups: role in development and governance; changing pattern"
      ],
      keywords: [
        "shg role", "ngo role", "ngo challenges", "fund mismanagement",
        "microfinance institutions", "foreign aid", "development industry",
        "pressure group politics"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-SOCIO-ECON",
      name: "Socio-Economic Development in Governance Lens: HD, Poverty, Inequality, Hunger, Health, Education, Welfare Mechanisms",
      tags: ["M"],
      microThemes: [
        "Human development: concept; growth vs human development link",
        "Measurement of human development",
        "Poverty: dimensions; poverty-development linkage; Rangarajan Committee (hook)",
        "Poverty alleviation since independence; programmes; inequality concept",
        "World Inequality Report 2018 findings (hook); income inequality in India; remedies",
        "Hunger: causes; food security challenges; Global Hunger Index 2018 (hook)",
        "Institutional measures for welfare of vulnerable sections; issues in mechanisms",
        "Health: public health system; shortcomings; universal health coverage",
        "Swachh Bharat Mission evaluation (hook); Global Nutrition Report 2018 (hook)",
        "Ayushman Bharat; National Health Policy (hooks)",
        "Education: challenges; RTE and EWS children; initiatives"
      ],
      keywords: [
        "human development", "poverty dimensions", "rangarajan committee",
        "poverty alleviation programmes", "inequality", "world inequality report",
        "hunger", "global hunger index", "food security",
        "public health system", "universal health coverage", "swachh bharat evaluation",
        "global nutrition report", "ayushman bharat", "national health policy",
        "education challenges", "right to education", "ews children"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-PRESSURE-GROUPS",
      name: "Pressure Groups: Types, Significance, Role, Difference from Political Parties",
      tags: ["M"],
      microThemes: [
        "What are pressure groups?",
        "Types of pressure groups",
        "Significance in India",
        "Pressure group vs political party",
        "Evaluation of pressure groups’ role"
      ],
      keywords: [
        "pressure groups", "types of pressure groups", "pressure group vs political party",
        "significance of pressure groups", "evaluation of pressure groups"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-CONST-POSTS",
      name: "Appointments to Constitutional Posts & Constitutional Bodies: CAG, ECI, UPSC, Finance Commission, NCSC/NST",
      tags: ["M"],
      microThemes: [
        "Appointment, composition, functions, powers: CAG",
        "Appointment, composition, functions, powers: Election Commission (ECI)",
        "Appointment, composition, functions, powers: UPSC",
        "Appointment, composition, functions, powers: Finance Commission",
        "National Commissions for SCs/STs: role overview"
      ],
      keywords: [
        "appointment of cag", "powers of cag", "appointment of eci", "powers of eci",
        "appointment of upsc", "powers of upsc", "finance commission appointment",
        "national commission for sc", "national commission for st"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-REGULATORS-QUASI",
      name: "Statutory/Regulatory/Quasi-Judicial Bodies: SEBI, TRAI, IRDA, CIC/SIC, NCDRC, PCI etc. + Hooks",
      tags: ["M"],
      microThemes: [
        "SEBI, TRAI, IRDA and sector regulation",
        "CVC, CBI, NHRC/SHRC",
        "CIC/SIC and transparency ecosystem",
        "NCDRC and consumer dispute redressal",
        "Medical Council of India (legacy/regulation hook)",
        "PFRDA and pensions regulation",
        "National Biodiversity Authority",
        "Press Council of India",
        "Forward Markets Commission (legacy hook)",
        "Inland Waterways Authority of India",
        "Role of CAG: audit and accountability",
        "14th Finance Commission analysis (hook)",
        "7th Pay Commission repercussions (hook)",
        "AFSPA and Second ARC (hook)",
        "Cauvery dispute (inter-state water dispute hook)",
        "Role of NITI Aayog (hook)"
      ],
      keywords: [
        "sebi", "trai", "irda", "cic", "sic", "ncdrc", "pfrda",
        "nhrc", "shrc", "press council of india", "national biodiversity authority",
        "inland waterways authority", "14th finance commission", "7th pay commission",
        "afspa", "second arc", "cauvery dispute", "niti aayog"
      ],
      schemes: []
    },
    {
  id: "GS2-POL-CONTEMP",
  name: "Polity & Governance (Mains): Contemporary Issues (Bills/Acts + Elections + RPA + Anti-Defection)",
  tags: ["M"],
  topics: [
    {
      id: "GS2-POL-CONTEMP-ACTS",
      name: "Recent Bills & Acts (Constitutional + Governance + Rights)",
      tags: ["M"],
      microThemes: [
        "103rd Constitutional Amendment (EWS reservation) – debates and implications",
        "Fugitive Economic Offenders Bill/Act (2018): intent and issues",
        "Triple Talaq ordinance/legislation: constitutionality + social justice angle",
        "Citizenship (Amendment) Bill/Act: issues, debate, NRC linkage (hook)",
        "Draft Emigration Bill (2019): rationale and concerns",
        "Consumer Protection Bill/Act (2018/2019): core changes and significance",
        "Prevention of Corruption (Amendment) Act (2018): key changes and controversies",
        "Lokpal & Lokayukta amendment (2016): impact on anti-corruption framework",
        "RTE (Amendment) Act (2019): provisions + implications",
        "Data protection / privacy bill (2017 onwards): privacy vs innovation (hook)",
        "Transgender Persons (Protection of Rights) Bill/Act: rights and implementation issues",
        "IIIT (Amendment) Bill (2017): autonomy of institutes (hook)"
      ],
      keywords: [
        "103rd amendment", "ews reservation", "fugitive economic offenders",
        "triple talaq ordinance", "citizenship amendment bill", "cab", "nrc",
        "draft emigration bill", "consumer protection bill", "prevention of corruption amendment act 2018",
        "lokpal lokayukta amendment 2016", "rte amendment 2019",
        "data protection bill 2017", "privacy protection bill", "transgender persons protection of rights",
        "iiit amendment bill 2017", "autonomy of institutes"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-CONTEMP-ELECTIONS",
      name: "Elections & Political Process: Criminalisation, Parties, EC, Freebies, Funding, EVM/VVPAT",
      tags: ["M"],
      microThemes: [
        "Criminalisation of politics: causes + reforms",
        "Working of political parties: inner-party democracy, transparency, candidate selection",
        "SC pushes for stronger laws to cleanse politics (hook)",
        "Election Commission effectiveness in ensuring fair elections",
        "Freebies politics: debate and governance implications",
        "EC proposals to counter bribe-for-votes (hook)",
        "Law Commission reports on electoral reforms (hook)",
        "State funding of elections: pros/cons",
        "Civil society role in free and fair elections",
        "Women’s voices/representation in elections",
        "EVM issue: trust, transparency, reforms",
        "Paper trail units (VVPAT): purpose and concerns"
      ],
      keywords: [
        "criminalisation of politics", "political party reforms", "inner party democracy",
        "election commission effectiveness", "freebies politics", "bribe for votes",
        "law commission electoral reforms", "state funding elections", "civil society election",
        "women representation elections", "evm issue", "paper trail units", "vvpat"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-CONTEMP-ANTI-DEF",
      name: "Anti-Defection + Office of Profit + RPA Linkages",
      tags: ["PM"],
      microThemes: [
        "Anti-defection law: objectives, loopholes, reform debate",
        "Office of profit: disqualification issues",
        "RPA (Representation of People Act) linkage: disqualification + electoral integrity"
      ],
      keywords: [
        "anti defection law", "tenth schedule", "defection reforms",
        "office of profit", "disqualification office of profit",
        "representation of people act", "rpa disqualification"
      ],
      schemes: []
    },
    {
  id: "GS2-POL-CONTEMP-EXECJUDLEG",
  name: "Polity & Governance (Mains): Contemporary Issues (Executive, Judiciary, Legislature, Local Govt, Elections, Misc)",
  tags: ["M"],
  topics: [
    {
      id: "GS2-POL-CONTEMP-EXECLEG",
      name: "Union & State Executive + Legislature (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "Imposition of President’s Rule: analysis, misuse debates",
        "Is President a rubber stamp? discretionary powers (hook)",
        "Politicization of Governor’s post",
        "Lacunas in parliamentary functioning; disruption, quality of debates",
        "Significance of strong opposition in democracy",
        "Ordinance making power: misuse and reforms",
        "FR vs Parliamentary privileges: balance and conflicts",
        "Special provisions for some states; special category status debate",
        "NRC Assam: issues and implications",
        "Gorkhaland crisis (hook)",
        "Office of profit issues",
        "Women reservation in Parliament (hook)",
        "Centre vs State disputes (AAP vs LG as hook)"
      ],
      keywords: [
        "president rule", "article 356", "rubber stamp president", "discretionary powers",
        "governor politicization", "parliament functioning lacunas", "strong opposition",
        "ordinance making power", "article 123", "parliamentary privileges",
        "fundamental rights vs privileges", "special provisions for states", "special category status",
        "nrc assam", "gorkhaland crisis", "office of profit", "women reservation in parliament",
        "aap vs lg", "centre vs state dispute"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-CONTEMP-JUDICIARY",
      name: "Judiciary (Contemporary Issues + Reforms)",
      tags: ["M"],
      microThemes: [
        "Shortage of judges; judge-population ratio debates",
        "Appointment of judges: collegium issues (hook)",
        "Removal of judges: procedure and challenges",
        "Judiciary under RTI? transparency vs independence",
        "Judicial accountability mechanisms",
        "Post-retirement appointments of judges: concerns",
        "Judicial overreach vs activism debates",
        "Judicial reforms to reduce pendency",
        "Future challenges of Indian judiciary",
        "All India Judicial Service (AIJS): pros/cons",
        "Draft witness protection scheme (hook)",
        "Contempt of court: scope and reform debates",
        "Government as biggest litigant (hook)",
        "PIL: utility vs misuse",
        "National Litigation Policy",
        "Administrative tribunals: issues, reforms",
        "Sabarimala verdict (hook)",
        "Right to convert: SC debates (hook)",
        "ADR mechanisms: Lok Adalat, mediation, arbitration",
        "Death penalty abolition debate"
      ],
      keywords: [
        "shortage of judges", "collegium system", "appointment of judges",
        "removal of judges procedure", "judiciary under rti", "judicial accountability",
        "post retirement appointment of judges", "judicial overreach", "judicial activism",
        "pendency of cases", "judicial reforms", "all india judicial service", "aijs",
        "witness protection scheme", "contempt of court", "government biggest litigant",
        "public interest litigation", "pil misuse", "national litigation policy",
        "administrative tribunals", "sabarimala verdict", "right to convert",
        "alternate dispute redressal", "adr", "abolish death penalty"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-CONTEMP-LOCAL",
      name: "Local Government (Contemporary Issues + Reforms)",
      tags: ["M"],
      microThemes: [
        "Education qualification for local elections: debate",
        "Municipal reforms aligned with urban missions",
        "Municipal reforms for sustainable cities",
        "14th Finance Commission and local governments",
        "Telangana: tribal hamlets to village panchayat status (hook)",
        "Dharavi: slum redevelopment as governance issue (hook)",
        "Panchayati Raj: challenges and reforms",
        "Women participation in Panchayats: strengthening",
        "PESA in tribal areas: implementation gaps",
        "Sixth Schedule areas: deepening grassroots democracy",
        "2nd ARC recommendations on local governance (hook)"
      ],
      keywords: [
        "education qualification local elections", "municipal reforms",
        "sustainable cities municipal reforms", "14th finance commission local governments",
        "tribal hamlets village panchayat status telangana", "dharavi slum",
        "panchayati raj reforms", "women participation panchayat",
        "pesa in tribal areas", "sixth schedule grassroots democracy", "2nd arc recommendations"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-CONTEMP-ELECT",
      name: "Elections (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "Criminalization of politics",
        "Political party functioning issues; inner party democracy",
        "SC push for stronger laws to cleanse politics (hook)",
        "Election Commission effectiveness",
        "Freebies politics debate",
        "EC proposal to counter bribe-for-votes (hook)",
        "Law Commission report on electoral reforms (hook)",
        "State funding in elections",
        "Civil society role in free and fair elections",
        "Women voices in elections",
        "EVM issue: transparency and trust",
        "Paper trail units (VVPAT)",
        "Anti-defection law",
        "Office of profit & RPA linkages"
      ],
      keywords: [
        "criminalization of politics", "political parties issues", "inner party democracy",
        "cleanse politics supreme court", "election commission effectiveness",
        "freebies politics", "bribe for votes", "law commission electoral reforms",
        "state funding elections", "civil society fair election", "women voices elections",
        "evm issue", "vvpat", "paper trail units", "anti defection law",
        "office of profit", "rpa"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-CONTEMP-MISC",
      name: "Miscellaneous (Contemporary Polity Hooks)",
      tags: ["M"],
      microThemes: [
        "Revisiting Section 124A IPC (Sedition): debates, misuse, reform"
      ],
      keywords: [
        "section 124a", "ipc 124a", "sedition law", "revisiting sedition"
      ],
      schemes: []
    },
    {
  id: "GS2-POL-BODIES",
  name: "Constitutional, Statutory, Regulatory & Quasi-Judicial Bodies",
  tags: ["PM"],
  topics: [
    {
      id: "GS2-POL-CONST-BODIES",
      name: "Constitutional Bodies (ECI, UPSC, CAG, FC etc.)",
      tags: ["PM"],
      microThemes: [
        "Election Commission: autonomy and reforms",
        "UPSC and State PSC",
        "Finance Commission: role and federal fiscal balance",
        "14th and 15th Finance Commission debates",
        "State Finance Commission",
        "Law Commission reports (bail reforms, hate speech)",
        "Pay Commission (7th Pay Commission)",
        "National Commission for SC/ST/OBC",
        "Special Officer for Linguistic Minorities",
        "CAG: powers, autonomy, audit accountability",
        "Attorney General and Advocate General",
        "Co-operative societies",
        "Tribunals and issues with tribunals bypassing High Courts"
      ],
      keywords: [
        "election commission autonomy", "upsc", "state psc",
        "finance commission", "14th finance commission", "15th finance commission",
        "state finance commission", "law commission report", "bail reforms", "hate speech report",
        "7th pay commission", "national commission sc", "national commission st", "national commission obc",
        "linguistic minorities officer", "cag autonomy", "attorney general", "advocate general",
        "cooperative societies", "tribunals bypassing high court"
      ],
      schemes: []
    },

    {
      id: "GS2-POL-STAT-BODIES",
      name: "Statutory & Regulatory Bodies (NHRC, CBI, CVC, CIC etc.)",
      tags: ["PM"],
      microThemes: [
        "National Human Rights Commission",
        "National Commission for Women",
        "State Human Rights Commission",
        "Central Information Commission & State Information Commission",
        "Central Vigilance Commission & preventive vigilance",
        "Central Bureau of Investigation: autonomy debates",
        "Lokpal and Lokayukta: appointment issues",
        "Amendments to Lokpal Act",
        "Quasi-judicial bodies functioning",
        "Rationalization of autonomous bodies",
        "NITI Aayog: role and policy think-tank",
        "NITI Aayog CSS rationalization report",
        "Model Land Leasing Law by NITI Aayog"
      ],
      keywords: [
        "nhrc", "national human rights commission", "ncw",
        "state human rights commission", "cic", "information commission",
        "cvc vigilance", "preventive vigilance", "cbi autonomy",
        "lokpal appointment", "lokayukta", "lokpal amendment",
        "quasi judicial bodies", "autonomous bodies rationalization",
        "niti aayog role", "css rationalization", "model land leasing law"
      ],
      schemes: []
    },
    {
  id: "GS2-GOV-CONT",
  name: "Governance (Mains) - Contemporary Issues (2nd ARC, Accountability, e-Gov, Schemes, Policies)",
  tags: ["M"],
  topics: [
    {
      id: "GS2-GOV-ARC",
      name: "Second ARC Themes (Functions, Org Structure, Citizen Centricity, e-Gov, Ethics in Governance)",
      tags: ["M"],
      microThemes: [
        "Functions of government",
        "Organizational structure issues in GoI",
        "Good governance and citizen-centric administration",
        "e-Governance",
        "Ethics in governance (2nd ARC hooks)"
      ],
      keywords: [
        "second arc", "2nd arc", "administrative reforms commission",
        "citizen centric administration", "good governance", "e governance",
        "ethics in governance", "organizational structure of goi"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-ACCOUNTABILITY",
      name: "Transparency & Accountability Initiatives (RTI, Aadhaar, PRAGATI, DBT, Social Audit, Bureaucracy Reforms)",
      tags: ["PM"],
      microThemes: [
        "Public accountability concept",
        "Virtual ID for Aadhaar; Aadhaar mandatory debate",
        "Social media & accountability",
        "Accountability & transparency in NGOs",
        "Autonomy of CBI (governance angle)",
        "Analysis of functioning of CAG (governance angle)",
        "People-centric governance",
        "PRAGATI (Pro-Active Governance & Timely Implementation)",
        "Rights-based approach in policy making",
        "Direct Benefit Transfer (DBT)",
        "Reforms needed in Indian bureaucracy",
        "Performance appraisal in bureaucracy",
        "Curb on VIP culture",
        "Social audit law"
      ],
      keywords: [
        "public accountability", "virtual id aadhaar", "aadhaar mandatory",
        "social media accountability", "ngo transparency", "cbi autonomy",
        "cag functioning", "people centric governance", "pragati",
        "rights based approach", "direct benefit transfer", "dbt",
        "bureaucracy reforms", "performance appraisal bureaucracy",
        "vip culture curb", "social audit"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-BODIES",
      name: "Org/Bodies & Parliamentary Accountability (PAC, NITI Aayog, Pay/Finance Commissions, AFSPA hook)",
      tags: ["M"],
      microThemes: [
        "14th Finance Commission analysis (governance impact)",
        "7th Pay Commission repercussions",
        "AFSPA and governance debates (2nd ARC hook)",
        "Role of NITI Aayog",
        "Significance of Public Accounts Committee (PAC)",
        "Right to Information (repeated governance anchor)"
      ],
      keywords: [
        "14th finance commission analysis", "7th pay commission repercussions",
        "afspa second arc", "role of niti aayog", "public accounts committee", "pac",
        "right to information", "rti governance"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-SCHEMES",
      name: "Schemes in Governance Lens",
      tags: ["PM"],
      microThemes: [
        "PM Jan-Dhan Yojana (PMJDY)",
        "Swachh Bharat Mission",
        "National Skill Development Mission",
        "National Food Security Act 2013",
        "Sansad Adarsh Gram Yojana",
        "Smart Cities Mission",
        "Saubhagya plan",
        "Namami Gange",
        "Stand Up India: critical analysis",
        "MGNREGA"
      ],
      keywords: [
        "pmjdy", "jan dhan yojana", "swachh bharat mission",
        "national skill development mission", "national food security act 2013",
        "sansad adarsh gram yojana", "smart city mission", "smart cities mission",
        "saubhagya plan", "namami gange", "stand up india critical analysis", "mgnrega"
      ],
      schemes: [
        "PMJDY", "Swachh Bharat Mission", "NSDM", "NFSA 2013",
        "Sansad Adarsh Gram", "Smart Cities Mission", "Saubhagya",
        "Namami Gange", "Stand Up India", "MGNREGA"
      ]
    },

    {
      id: "GS2-GOV-POLICIES",
      name: "Policies/Reports/Committees (NITI, Law Commission, Hate Speech, NEP etc.)",
      tags: ["M"],
      microThemes: [
        "NITI Aayog CSS rationalisation report",
        "Law Commission 268th bail reforms report",
        "Model Land Leasing Law by NITI Aayog",
        "T K Viswanathan committee on hate speech",
        "Law Commission report on tribunals",
        "Law Commission report on UN Convention against Torture",
        "National Education Policy"
      ],
      keywords: [
        "css rationalization report", "centrally sponsored schemes rationalization",
        "268th report bail reforms", "law commission bail reforms",
        "model land leasing law", "t k viswanathan committee hate speech",
        "law commission report on tribunals", "un convention against torture",
        "national education policy", "nep"
      ],
      schemes: []
    },

    {
      id: "GS2-GOV-MISC",
      name: "Misc Governance Debates",
      tags: ["M"],
      microThemes: [
        "Inter-state water dispute (governance angle)",
        "Directly elected mayor debate",
        "Lobbying debate in India",
        "Media role & censorship issue",
        "Role of states in India’s foreign policy"
      ],
      keywords: [
        "inter state water dispute", "directly elected mayor",
        "lobbying debate india", "media censorship issue",
        "states role in foreign policy"
      ],
      schemes: []
    }
  ]
}
  ]
}
  ]
}
  ]
}
  ]
}] },
      SocialJustice: { sections: [] },
      InternationalRelations: { sections: [{
  id: "GS2-IR-SYLLABUS-CORE",
  name: "IR Core (UPSC Syllabus Pillars)",
  tags: ["M"],
  topics: [
    {
      id: "GS2-IR-NEIGHBOURS",
      name: "India & Neighbourhood Relations",
      tags: ["M"],
      microThemes: [
        "Neighbourhood First",
        "India-China, India-Pak, India-Nepal, India-Bhutan",
        "India-Bangladesh, India-Myanmar, India-Sri Lanka, India-Maldives",
        "Indian Ocean Region (IOR) security"
      ],
      keywords: [
        "neighbourhood first", "india china", "border dispute", "string of pearls",
        "bri", "belt and road", "cpec", "malacca dilemma", "south china sea",
        "india pakistan", "terrorism emanating", "indus water",
        "india bhutan", "friendship treaty",
        "india nepal", "tilt towards china", "hydropower cooperation",
        "india myanmar", "kaladan", "trilateral highway", "rohingya",
        "india bangladesh", "teesta", "tipaimukh", "illegal immigration",
        "india afghanistan", "moscow format",
        "india maldives", "fta china maldives",
        "india sri lanka", "fishermen issue", "13th amendment",
        "ior", "iora", "piracy", "net security provider"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-GROUPINGS",
      name: "Groupings, Agreements, Forums impacting India",
      tags: ["M"],
      microThemes: [
        "Bilateral, regional, global groupings",
        "SAARC/BIMSTEC/BBIN",
        "Indo-Pacific concept; East Asia Summit",
        "QUAD and regional security/economic angle"
      ],
      keywords: [
        "bilateral agreements", "regional groupings", "global groupings",
        "saarc", "bimstec", "bbin", "indo pacific", "east asia summit",
        "quad", "india pacific regional dialogue"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-DEVELOPED-DEVELOPING",
      name: "Impact of Developed/Developing Countries' Policies on India",
      tags: ["M"],
      microThemes: [
        "Protectionism and currency wars",
        "Sanctions and extraterritorial laws (CAATSA etc.)",
        "Trade disputes; WTO reforms",
        "Global power shifts: multipolarity"
      ],
      keywords: [
        "protectionism", "currency wars", "sanctions", "extraterritorial sanctions",
        "caatsa", "wto dispute", "wto reforms", "multipolar order",
        "china russia axis", "waning superpower"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-DIASPORA",
      name: "Indian Diaspora",
      tags: ["M"],
      microThemes: [
        "Role of diaspora; safety of Indians abroad",
        "Welfare schemes for overseas Indians",
        "Indian diaspora in Gulf (Nitaqat etc.)"
      ],
      keywords: [
        "indian diaspora", "safety of indians abroad",
        "welfare of overseas indian", "diaspora in gulf", "nitaqat"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-INSTITUTIONS",
      name: "International Institutions/Agencies/Fora",
      tags: ["M"],
      microThemes: [
        "UN & UNSC; UNSC reforms",
        "IMF/World Bank reforms (Bretton Woods twins)",
        "WTO, IAEA, NATO, Arctic Council",
        "BRICS, SCO, Commonwealth"
      ],
      keywords: [
        "un", "unsc reforms", "security council", "imf reforms",
        "bretton woods", "wto", "doha round", "singapore agenda",
        "iaea safeguards", "nato", "arctic council",
        "brics", "new development bank", "sco", "commonwealth"
      ],
      schemes: []
    }
  ]
},

{
  id: "GS2-IR-FOREIGN-POLICY",
  name: "India’s Foreign Policy (Evolution, Tools, Doctrines)",
  tags: ["M"],
  topics: [
    {
      id: "GS2-IR-FP-EVOLUTION",
      name: "Evolution, Determinants, Doctrines, Recent Policies",
      tags: ["M"],
      microThemes: [
        "NAM, Look East → Act East, Gujral Doctrine",
        "Neighbourhood First, Act East, Link West, IOR outreach",
        "Soft power, hard power, defence & nuclear diplomacy",
        "Space diplomacy, para diplomacy, middle power coalitions",
        "PMO role in foreign policy making; rise of realpolitik"
      ],
      keywords: [
        "nam", "look east", "act east", "gujral doctrine",
        "neighbourhood first", "link west", "indian ocean outreach",
        "soft power", "hard power", "defence diplomacy", "nuclear diplomacy",
        "space diplomacy", "para diplomacy", "middle power coalition",
        "pmo role", "realpolitik"
      ],
      schemes: []
    }
  ]
},

{
  id: "GS2-IR-EXTENDED",
  name: "Extended Neighbourhood (ASEAN, Central Asia, West Asia, Africa, Europe, Americas)",
  tags: ["M"],
  topics: [
    {
      id: "GS2-IR-ASEAN-EAP",
      name: "ASEAN / East Asia / Indo-Pacific",
      tags: ["M"],
      microThemes: [
        "India-ASEAN partnership; Indo-Pacific concept",
        "India-Vietnam, India-Indonesia, India-Singapore, Thailand",
        "Indo-Pacific regional security/economic architecture"
      ],
      keywords: [
        "asean", "india asean", "indo pacific",
        "india vietnam", "india indonesia", "global maritime axis",
        "india singapore", "naval cooperation", "indo thai relations"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-CENTRAL-ASIA",
      name: "Central Asia Connectivity + Strategy",
      tags: ["M"],
      microThemes: [
        "Connect Central Asia policy",
        "INSTC, Ashgabat Agreement, TAPI pipeline",
        "Golden Crescent; security and connectivity"
      ],
      keywords: [
        "connect central asia", "instc", "ashgabat agreement",
        "tapi pipeline", "golden crescent"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-WEST-ASIA",
      name: "West Asia / Middle East",
      tags: ["M"],
      microThemes: [
        "India-Saudi, India-UAE, India-Iran, India-Israel",
        "Chabahar connectivity; Iran nuclear deal sanctions",
        "De-hyphenation of Israel-Palestine",
        "Migrant workers and diaspora issues"
      ],
      keywords: [
        "west asia", "middle east", "india saudi", "india uae",
        "india iran", "chabahar", "iran nuclear deal", "sanctions",
        "india israel", "de hyphenation", "palestine", "migrant workers"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-MAJOR-POWERS",
      name: "Major Powers: USA, Russia, EU/UK, Japan, Australia, Canada",
      tags: ["M"],
      microThemes: [
        "India-USA: defence cooperation, nuclear deal logjams, NSS, LEMOA",
        "CAATSA impacts; sanctions on Russia/Iran/NK",
        "India-Russia: defence ties, Russia-Pak arms, Eurasian Economic Union",
        "India-EU/UK/France: GDPR, FTA irritants, summits",
        "India-Japan and India-Australia: projects, nuclear cooperation"
      ],
      keywords: [
        "india usa", "defence cooperation", "civil nuclear cooperation",
        "nss", "lemoa", "caatsa", "jcpoa",
        "india russia", "eurasian economic union",
        "india eu", "gdpr", "fta", "brexit",
        "india japan", "nuclear pact", "india australia", "economic strategy 2035",
        "india canada", "uranium deal"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-AFRICA",
      name: "India-Africa",
      tags: ["M"],
      microThemes: [
        "Trade, diaspora contributions, IOR security cooperation",
        "FDI in hydrocarbons; strategic partnership with South Africa"
      ],
      keywords: [
        "india africa trade", "diaspora in africa",
        "indian ocean security", "fdi hydrocarbons", "south africa partnership"
      ],
      schemes: []
    }
  ]
},

{
  id: "GS2-IR-GLOBAL-ISSUES",
  name: "Global Issues & Security Challenges",
  tags: ["M"],
  topics: [
    {
      id: "GS2-IR-TERRORISM",
      name: "Terrorism + Global Security Architecture",
      tags: ["M"],
      microThemes: [
        "CCIT; UNSC 1267 sanctions; international legal cooperation",
        "Lone wolf attacks; radicalisation; far-right rise"
      ],
      keywords: [
        "ccit", "unsc 1267", "al qaeda sanctions", "masood azhar",
        "security council resolution 2322", "lone wolf attacks", "far right politics"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-CLIMATE-DISARM",
      name: "Climate Change & Disarmament",
      tags: ["M"],
      microThemes: [
        "Climate change diplomacy",
        "Disarmament and nuclear regimes",
        "International Solar Alliance"
      ],
      keywords: [
        "climate change diplomacy", "disarmament",
        "international solar alliance"
      ],
      schemes: []
    },
    {
      id: "GS2-IR-REGIONAL-CONFLICTS",
      name: "Regional Conflicts (South China Sea, Yemen etc.)",
      tags: ["M"],
      microThemes: [
        "South China Sea disputes and rulings",
        "Yemen crisis impacts",
        "Senkaku/Diaoyu dispute context"
      ],
      keywords: [
        "south china sea", "south china sea ruling",
        "yemen crisis", "senkaku", "diaoyu"
      ],
      schemes: []
    },
    {
  id: "GS2-IR-CONTEMP",
  name: "International Relations (Contemporary Issues)",
  tags: ["M"],
  topics: [
    {
      id: "GS2-IR-CONTEMP-FP",
      name: "Foreign Policy: Soft Power, Middle Power, Diaspora, Terrorism, Buddhism Diplomacy, Navy Diplomacy",
      tags: ["M"],
      microThemes: [
        "Foreign Policy of India (contemporary lens)",
        "Virtue of Soft Power",
        "Middle Power Coalition",
        "Terrorism (Global Terrorism Index hook)",
        "Diplomacy of Buddhism",
        "Indian Navy and maritime diplomacy",
        "Indian Diaspora; Indian Diaspora in Gulf"
      ],
      keywords: [
        "soft power", "middle power coalition", "global terrorism index",
        "buddhism diplomacy", "indian navy diplomacy", "maritime diplomacy",
        "indian diaspora", "diaspora in gulf", "terrorism"
      ],
      schemes: []
    },

    {
      id: "GS2-IR-CONTEMP-NEIGH",
      name: "Neighbours: Policy, China, Nepal, Pakistan, Afghanistan, Sri Lanka, Bangladesh, Myanmar, Maldives, Bhutan",
      tags: ["M"],
      microThemes: [
        "India’s neighbourhood policy (contemporary issues)",
        "China: South China Sea ruling; water diplomacy via dams; Doklam/Chumbi valley",
        "China winning neighbours narrative; internal security cooperation agreement",
        "Nepal: reboot ties; BIMSTEC military drill withdrawal",
        "Pakistan: shift Indus Waters Treaty policy",
        "Afghanistan: Heart of Asia",
        "Sri Lanka, Bangladesh, Myanmar, Maldives, Bhutan",
        "FTA between China and Maldives (warning for India)"
      ],
      keywords: [
        "neighbourhood policy", "south china sea ruling", "water diplomacy dams",
        "doklam", "chumbi valley", "china winning neighbours",
        "internal security cooperation agreement", "rebooting india nepal ties",
        "bimstec military drill withdrawal", "indus waters treaty policy shift",
        "heart of asia", "fta china maldives"
      ],
      schemes: []
    },

    {
      id: "GS2-IR-CONTEMP-BILATERAL",
      name: "Bilateral Relations: Act East + Key Partners",
      tags: ["M"],
      microThemes: [
        "Act East Policy (contemporary issues)",
        "Australia, Indonesia, Singapore, South Korea, Thailand, Vietnam, Philippines",
        "Iran, Saudi Arabia, UAE",
        "Slowdown in West Asia",
        "Return of retrenched workers (Gulf labour issue)",
        "Race for resources in Central Asia",
        "Kazakhstan, Mongolia",
        "Island nations",
        "Africa focus (Nigeria)"
      ],
      keywords: [
        "act east policy", "australia", "indonesia", "singapore", "south korea",
        "thailand", "vietnam", "philippines", "iran", "saudi arabia", "uae",
        "west asia slowdown", "retrench workers", "central asia resources",
        "kazakhstan", "mongolia", "island nations", "africa", "nigeria"
      ],
      schemes: []
    },

    {
      id: "GS2-IR-CONTEMP-GLOBAL-POWERS",
      name: "Global Powers: USA, EU, Germany, Japan, France, Russia, UK, Brazil, Israel (De-hyphenation), RIC/JAI/BRICS",
      tags: ["M"],
      microThemes: [
        "USA",
        "EU strategy for India; Germany",
        "Japan; Asia-Africa Growth Corridor (AAGC) (hook)",
        "France",
        "Russia; decline in Indo-Russia relations",
        "Why RIC is as important as JAI and BRICS (hook)",
        "UK, Brazil",
        "Israel: India’s de-hyphenated policy"
      ],
      keywords: [
        "usa", "eu strategy for india", "germany", "japan", "aagc",
        "france", "russia decline", "indo russia relations decline",
        "ric jai brics", "uk", "brazil", "israel", "de hyphenated policy"
      ],
      schemes: []
    },

    {
      id: "GS2-IR-CONTEMP-ORG",
      name: "International Organisations & Agreements",
      tags: ["M"],
      microThemes: [
        "IMF, World Bank, WTO",
        "G-20, ASEAN, BIMSTEC",
        "Indian Ocean Region and world affairs",
        "BRICS, AIIB",
        "TPP; RCEP and India",
        "Nuclear weapons ban negotiations",
        "Wassenaar Arrangement; Australia Group",
        "IAEA; Nuclear Security Summit",
        "NAM; UNSC reform"
      ],
      keywords: [
        "imf", "world bank", "wto", "g20", "asean", "bimstec", "indian ocean region",
        "brics", "aiib", "tpp", "rcep", "nuclear weapons ban",
        "wassenaar arrangement", "australia group", "iaea", "nuclear security summit",
        "non alignment movement", "nam", "unsc reform"
      ],
      schemes: []
    },

    {
      id: "GS2-IR-CONTEMP-GLOBAL-ISSUES",
      name: "Global Issues: Terrorism, Migration, Protectionism, Iran Deal/Sanctions, Fake News, Jerusalem, Yemen, Rohingya",
      tags: ["M"],
      microThemes: [
        "International Terrorism",
        "Migration crisis in Europe",
        "Rising protectionism and currency wars",
        "Greek debt crisis",
        "Iran nuclear deal; US sanctions on Iran",
        "Global initiative to fight fake news",
        "US recognition of Jerusalem: implications",
        "Yemen war: implications",
        "Saudi reforms (hook)",
        "Rohingya repatriation deal"
      ],
      keywords: [
        "international terrorism", "migration crisis europe", "protectionism", "currency wars",
        "greek debt crisis", "iran nuclear deal", "us sanctions on iran",
        "fake news initiative", "jerusalem recognition", "yemen war",
        "saudi reforms", "rohingya repatriation"
      ],
      schemes: []
    }
  ]
}
  ]
}] }
    }
  },
  // ===================== END GS2 =====================
    GS3: {
    heading: "GS3: Economy, Environment, Security, Disaster Management, Science & Tech",
    macroTheme: "GS3",
    subjects: {

      Economy: {
  sections: [
    {
      id: "GS3-ECO-PRE-BASICS",
      name: "Economy (Prelims): Basic Concepts",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ECO-PRE-BASICS-MACRO",
          name: "Macroeconomic Concepts",
          tags: ["P"],
          microThemes: [
            "Meaning of economics",
            "Types of economies",
            "Sectors of economy",
            "Micro vs macro (basic linkage)"
          ],
          keywords: [
            "meaning of economics", "types of economies", "sectors of economy",
            "primary secondary tertiary sectors", "microeconomics", "macroeconomics"
          ],
          schemes: []
        }
      ]
    },

    {
      id: "GS3-ECO-PRE-MEASURE",
      name: "Economy (Prelims): Economic Measurements",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ECO-PRE-NI",
          name: "National Income + GDP Concepts + Indicators",
          tags: ["P"],
          microThemes: [
            "National income concepts and calculation methods",
            "GDP, GNP, NNP (basic)",
            "Real vs nominal",
            "Per capita income, PPP",
            "Lorenz curve, Gini coefficient, Phillips curve (basic)",
            "New base year series (hook)"
          ],
          keywords: [
            "national income", "gdp", "gnp", "nnp", "real gdp", "nominal gdp",
            "per capita income", "ppp", "purchasing power parity",
            "lorenz curve", "gini coefficient", "phillips curve",
            "base year 2011-12"
          ],
          schemes: []
        },

        {
          id: "GS3-ECO-PRE-INFLATION",
          name: "Inflation + Indices",
          tags: ["P"],
          microThemes: [
            "Inflation types and causes",
            "WPI, CPI, GDP deflator, core inflation",
            "Measures to control inflation: fiscal, monetary, administrative"
          ],
          keywords: [
            "inflation", "types of inflation", "core inflation",
            "wpi", "cpi", "gdp deflator", "producer price index",
            "measures to control inflation", "monetary measures", "fiscal measures"
          ],
          schemes: []
        },

        {
          id: "GS3-ECO-PRE-GROWTH",
          name: "Economic Growth vs Development",
          tags: ["P"],
          microThemes: [
            "Growth vs development",
            "Measurement: HDI/PQLI (basic)",
            "MDGs (hook) and sustainability link",
            "Environment taxes: carbon tax, green accounting (hook)"
          ],
          keywords: [
            "economic growth", "economic development", "hdi", "pqli", "mdgs",
            "sustainability", "carbon tax", "green accounting", "environment taxes"
          ],
          schemes: []
        }
      ]
    },

    {
      id: "GS3-ECO-PRE-MONEY",
      name: "Economy (Prelims): Money and Banking",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ECO-PRE-MONEY-BASICS",
          name: "Money: Functions + Aggregates",
          tags: ["P"],
          microThemes: [
            "Functions of money",
            "Money supply measures",
            "Broad vs narrow money",
            "Money multiplier",
            "Digital money (hook)"
          ],
          keywords: [
            "functions of money", "money supply", "broad money", "narrow money",
            "money multiplier", "digital money", "monetary aggregates"
          ],
          schemes: []
        },

        {
          id: "GS3-ECO-PRE-RBI",
          name: "RBI + Monetary Policy + Credit Control Tools",
          tags: ["P"],
          microThemes: [
            "RBI role",
            "Monetary policy basics",
            "CRR, SLR, repo, reverse repo, MSF, bank rate",
            "Call rate"
          ],
          keywords: [
            "rbi", "monetary policy", "credit control",
            "crr", "slr", "repo rate", "reverse repo", "msf", "bank rate", "call rate"
          ],
          schemes: []
        },

        {
          id: "GS3-ECO-PRE-FIN-MARKETS",
          name: "Financial Markets + Regulators",
          tags: ["P"],
          microThemes: [
            "Money market vs capital market",
            "Stock exchange basics",
            "Insurance sector basics",
            "SEBI, IRDA (regulators)",
            "Basel norms; banking ombudsman (hook)"
          ],
          keywords: [
            "financial markets", "money market", "capital market", "stock exchange",
            "insurance reforms", "sebi", "irda", "basel norms", "banking ombudsman"
          ],
          schemes: []
        },

        {
          id: "GS3-ECO-PRE-BANKING-STRUCTURE",
          name: "Banking Structure + Banking Reforms",
          tags: ["P"],
          microThemes: [
            "Banking structure: PSBs, private, foreign, RRBs, co-operative banks",
            "Differentiated banks: payment banks, small finance banks",
            "UPI (hook), white label ATM",
            "MCLR (hook), priority sector lending certificates"
          ],
          keywords: [
            "banking structure", "public sector banks", "private banks", "foreign banks",
            "rrb", "cooperative banks", "payment banks", "small finance banks",
            "upi", "white label atm", "mclr", "priority sector lending certificates"
          ],
          schemes: []
        }
      ]
    },

    {
      id: "GS3-ECO-PRE-PUBLIC-FIN",
      name: "Economy (Prelims): Public Finance",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ECO-PRE-BUDGET",
          name: "Budget + Deficits + FRBM",
          tags: ["P"],
          microThemes: [
            "Union budget basics",
            "Revenue receipts vs capital receipts (basic idea)",
            "Fiscal deficit, revenue deficit, primary deficit",
            "FRBM Act 2003"
          ],
          keywords: [
            "union budget", "fiscal policy", "frbm", "fiscal deficit",
            "revenue deficit", "primary deficit", "deficit financing"
          ],
          schemes: []
        },

        {
          id: "GS3-ECO-PRE-TAX",
          name: "Tax Structure + GST",
          tags: ["P"],
          microThemes: [
            "Direct vs indirect taxes",
            "GST and GST Council",
            "VAT and service tax (historic hook)",
            "Direct tax code (hook)"
          ],
          keywords: [
            "direct tax", "indirect tax", "gst", "gst council", "vat", "service tax", "dtc"
          ],
          schemes: []
        }
      ]
    },

    {
      id: "GS3-ECO-PRE-PLANNING",
      name: "Economy (Prelims): Planning",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ECO-PRE-PLANS",
          name: "Economic Planning + Institutions",
          tags: ["P"],
          microThemes: [
            "Meaning and objectives of planning",
            "Planning commission, NDC, NITI Aayog",
            "Five year plans (12th plan hook)",
            "Strategies: Harrod-Domar, Mahalanobis, LPG etc (basic hook list)"
          ],
          keywords: [
            "economic planning", "planning commission", "ndc", "niti aayog",
            "five year plans", "12th five year plan", "harrod domar", "mahalanobis", "lpg strategy"
          ],
          schemes: []
        }
      ]
    },

    {
      id: "GS3-ECO-PRE-OPEN",
      name: "Economy (Prelims): Open Economy",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ECO-PRE-BOP",
          name: "BoP + Forex + Exchange Rates",
          tags: ["P"],
          microThemes: [
            "Balance of payments",
            "Exchange rate basics",
            "NEER/REER",
            "External debt; NRI deposits",
            "FERA vs FEMA (hook)"
          ],
          keywords: [
            "balance of payments", "exchange rate", "forex", "neer", "reer",
            "external debt", "nri deposits", "fera", "fema"
          ],
          schemes: []
        },

        {
          id: "GS3-ECO-PRE-TRADE",
          name: "Trade Policy + Agreements",
          tags: ["P"],
          microThemes: [
            "Trade policy basics",
            "WTO and trade agreements (RCEP, TPP, NAFTA, MERCOSUR, ASEAN etc)",
            "FDI/FPI/FII (basic)"
          ],
          keywords: [
            "wto", "trade agreements", "rcep", "tpp", "nafta", "mercosur", "asean", "safta",
            "fdi", "fpi", "fii"
          ],
          schemes: []
        }
      ]
    },

    {
      id: "GS3-ECO-PRE-SECTORS",
      name: "Economy (Prelims): Economic Sectors (Poverty, Jobs, Schemes, Committees)",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ECO-PRE-POVERTY",
          name: "Poverty + Inequality + Employment",
          tags: ["P"],
          microThemes: [
            "Poverty concepts and indices",
            "Inequality basics",
            "Employment and unemployment basics",
            "Committees (as hooks)"
          ],
          keywords: [
            "poverty", "poverty index", "inequality", "employment", "unemployment",
            "rangarajan committee", "uday kotak committee", "narasimham committee", "nachiket mor"
          ],
          schemes: []
        }
      ]
    },
    {
  id: "GS3-ECO-MAINS-SECTORS",
  name: "Economy (Mains): Sectors of Indian Economy",
  tags: ["M"],
  topics: [
    {
      id: "GS3-ECO-AGR-CORE",
      name: "Agriculture: Crops, Cropping Patterns, Irrigation, MSP, Subsidies",
      tags: ["M"],
      microThemes: [
        "Major crops; cropping patterns",
        "Irrigation types; irrigation systems; storage",
        "Transport & marketing of agricultural produce; constraints",
        "E-technology for farmers",
        "Farm subsidies (direct/indirect) and MSP issues",
        "Agricultural revolutions: Green, White (Operation Flood), Yellow, Blue, Golden fibre (Jute)"
      ],
      keywords: [
        "major crops", "cropping pattern", "irrigation", "micro irrigation",
        "storage", "warehousing", "agri marketing", "apmc",
        "e technology farmers", "agritech", "farm subsidies", "fertiliser subsidy",
        "power subsidy", "irrigation subsidy", "minimum support price", "msp",
        "green revolution", "white revolution", "operation flood", "blue revolution",
        "yellow revolution", "golden fibre", "jute revolution"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-PDS-FOODSEC",
      name: "PDS, Buffer Stocks, Food Security",
      tags: ["M"],
      microThemes: [
        "PDS: objectives, functioning, limitations; revamping",
        "Buffer stocks; food management; price stabilisation",
        "Food security issues; NFSA linkages",
        "Future of subsidies debates"
      ],
      keywords: [
        "public distribution system", "pds", "targeted pds", "tpds",
        "buffer stocks", "food security", "nfsa", "national food security act",
        "food subsidy", "price stabilisation", "future of subsidies"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-ANIMAL",
      name: "Animal Rearing Economics + Allied Activities",
      tags: ["M"],
      microThemes: [
        "Economics of animal rearing",
        "Dairy and livestock productivity constraints",
        "Allied sector linkages (dairy, fisheries as hook)"
      ],
      keywords: [
        "animal rearing", "livestock economics", "dairy sector",
        "fodder", "milk productivity", "allied activities", "fisheries"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-FOODPROC",
      name: "Food Processing: Scope, Location, Supply Chain, FDI",
      tags: ["M"],
      microThemes: [
        "Food processing: scope & significance",
        "Location factors; upstream and downstream linkages",
        "Supply chain management; cold chain; logistics",
        "FDI in food processing; sector policies; budget hooks"
      ],
      keywords: [
        "food processing", "value addition", "location of food processing",
        "upstream downstream", "supply chain", "cold chain", "logistics",
        "fdi food processing", "processed foods", "mega food park"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-LANDREFORMS",
      name: "Land Reforms + Land Leasing + Land Degradation",
      tags: ["M"],
      microThemes: [
        "Land resource; land-use pattern; land capability classification",
        "Land degradation: causes and impacts; sustainable land management",
        "Steps by GOI (hook)",
        "Land reforms: objectives; progress; challenges",
        "NITI Aayog report on land leasing"
      ],
      keywords: [
        "land use pattern", "land capability classification", "land resource",
        "land degradation", "sustainable land management",
        "land reforms", "objectives of land reforms", "progress of land reforms",
        "land leasing", "niti aayog land leasing"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-AGRI-FIN",
      name: "Agriculture Finance + Credit Institutions + Crop Insurance",
      tags: ["M"],
      microThemes: [
        "Need and sources of agricultural finance",
        "Credit institutions: cooperative credit, commercial banks, RRBs, NABARD",
        "Kisan Credit Card; RIDF; bank linkage",
        "Crop insurance: issues; PMFBY; comparison with earlier schemes"
      ],
      keywords: [
        "agriculture finance", "agricultural credit", "cooperative credit",
        "commercial bank", "rrb", "regional rural bank", "nabard",
        "kisan credit card", "kcc", "ridf",
        "crop insurance", "pmfby", "pradhan mantri fasal bima yojana"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-INDPOL",
      name: "Industrial Policy, Liberalisation, MSMEs, Corridors, SEZ, Disinvestment",
      tags: ["M"],
      microThemes: [
        "Effects of liberalisation on economy",
        "Industrial policy changes and impact on growth",
        "Industrial Policy Resolutions 1948/1956; Mahalanobis strategy (hook)",
        "Phases of industrial development since independence",
        "Public vs private sector roles; productivity, employment",
        "Disinvestment/privatisation strategies",
        "MSMEs: role, issues, globalisation impact",
        "Industrial corridors; SEZ issues",
        "Industrial sickness; exit policy",
        "Industrial finance: DFI, commercial banks, VC/angel capital",
        "Make in India: achievements (hook)"
      ],
      keywords: [
        "liberalisation impact", "lpg reforms", "industrial policy", "industrial growth",
        "industrial policy resolution 1948", "industrial policy resolution 1956",
        "mahalanobis strategy", "phases of industrial development",
        "disinvestment", "privatisation", "msme", "small medium micro enterprises",
        "industrial corridors", "sez", "special economic zone",
        "industrial sickness", "exit policy", "industrial finance",
        "venture capital", "angel capital", "make in india"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ECO-MAINS-POLICYREFORMS",
  name: "Economy (Mains): Policy & Reforms in Indian Economy",
  tags: ["M"],
  topics: [
    {
      id: "GS3-ECO-PLAN-GROWTH",
      name: "Planning, Growth, Development, Unemployment",
      tags: ["M"],
      microThemes: [
        "Role and objectives of Indian planning",
        "Planning experience at Centre and State levels",
        "Regulatory role of the state",
        "Development strategy in Five Year Plans",
        "Mahalanobis four-sector model; employment generation",
        "Poverty and unemployment: strategies",
        "Role of public sector",
        "Trends in saving and capital formation since independence",
        "NITI Aayog and cooperative federalism",
        "India’s economic performance in development planning"
      ],
      keywords: [
        "indian planning", "five year plans", "planning commission",
        "niti aayog cooperative federalism", "regulatory role of state",
        "mahalanobis four sector model", "employment generation",
        "unemployment", "poverty unemployment strategy",
        "public sector role", "capital formation", "saving trends",
        "development planning performance"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-RESOURCE-MOB",
      name: "Resource Mobilization (Tax, Debt, Fiscal-Monetary, Foreign Investment)",
      tags: ["M"],
      microThemes: [
        "Types of resources: physical and financial",
        "Need for resource mobilization (welfare state logic)",
        "Sources: public and private sector",
        "Taxation and resource mobilization for growth",
        "Direct taxes; agricultural taxation; indirect taxes",
        "Government revenues and mobilizing financial resources",
        "Public debt: market borrowing, loans, grants",
        "Fiscal and monetary policy role in mobilization",
        "Foreign investment role; desirability & consequences",
        "Multilateral agencies and resource mobilization",
        "Challenges to resource mobilization"
      ],
      keywords: [
        "resource mobilization", "government revenues", "public debt",
        "market borrowing", "loans grants", "direct taxes", "indirect taxes",
        "agricultural taxation", "taxation mobilization", "fiscal policy mobilization",
        "monetary policy mobilization", "foreign investment mobilization",
        "multilateral agencies", "resource mobilisation challenges"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-INCLUSIVE-GROWTH",
      name: "Inclusive Growth + Issues",
      tags: ["M"],
      microThemes: [
        "Meaning and concept of inclusion",
        "India’s experience of inclusion",
        "Why growth is not inclusive: rural economy, sustainable agriculture, food security, resilience",
        "Solutions and policy directions",
        "Social sector flagship schemes and ground realities",
        "PDS as inclusive growth tool",
        "Financial inclusion as instrument of inclusive growth",
        "Poverty alleviation & employment generation for inclusion",
        "Social sector development for inclusion",
        "PPP for inclusive growth",
        "Industrial integration; sectoral & regional diversification"
      ],
      keywords: [
        "inclusive growth", "inclusion concept", "why growth not inclusive",
        "financial inclusion inclusive growth", "pds inclusive growth",
        "poverty alleviation strategy", "employment generation inclusion",
        "social sector schemes", "flagship schemes ground realities",
        "public private partnership inclusive growth", "sectoral diversification",
        "regional diversification", "industrial integration"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-BUDGETING",
      name: "Government Budgeting (Outcome, Gender, Process, Analysis)",
      tags: ["M"],
      microThemes: [
        "Budget terminology and types",
        "Outcome budgeting; gender budgeting",
        "Benefits of budgeting; flaws in budgeting process",
        "Merger of Railway and General Budget",
        "Budget analysis approach"
      ],
      keywords: [
        "government budgeting", "budget terminology", "types of budget",
        "outcome budgeting", "gender budgeting", "flaws in budgeting",
        "merger railway budget", "budget analysis"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-INVESTMENT-MODELS",
      name: "Investment Models (FDI, Startups, PPP, Trends)",
      tags: ["M"],
      microThemes: [
        "Measures and factors affecting investment",
        "Classification of investments; FDI",
        "Angel investors and start-ups",
        "Investment models; role of state",
        "PPP models",
        "Savings and investment trends"
      ],
      keywords: [
        "investment models", "measures of investment", "factors affecting investment",
        "foreign direct investment", "fdi", "angel investors", "startups",
        "ppp model", "public private partnership", "role of state investment",
        "savings investment trends"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-FISCAL-POLICY",
      name: "Fiscal Policy (Deficits, Spending Trends, Twin Balance Sheet)",
      tags: ["M"],
      microThemes: [
        "Fiscal concepts and fiscal policy in India",
        "Government revenue and spending trends",
        "Impact of deficits on growth",
        "Twin balance sheet syndrome",
        "Types of deficit"
      ],
      keywords: [
        "fiscal policy india", "government spending trends", "revenue trends",
        "fiscal deficit impact", "deficit and growth", "twin balance sheet",
        "types of deficit", "revenue deficit", "primary deficit"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-TAXATION",
      name: "Taxation (Direct/Indirect, GST, Subsidies)",
      tags: ["M"],
      microThemes: [
        "Objectives and principles of taxation",
        "Tax reforms; taxation for mobilization",
        "Tax system in India",
        "GST and sectoral impact",
        "Subsidies and their impact"
      ],
      keywords: [
        "taxation principles", "tax reforms", "tax system india",
        "direct tax", "indirect tax", "gst impact", "gst sectors",
        "subsidies impact", "taxation mobilization"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-MONETARY-POLICY",
      name: "Monetary Policy (Tools, MPC, Inflation Targeting, Committees)",
      tags: ["M"],
      microThemes: [
        "Instruments of monetary policy",
        "Pre-reform era (1948-1991) vs post-reform era (since 1991)",
        "Urjit Patel Committee (hook)",
        "Monetary Policy Committee; inflation targeting"
      ],
      keywords: [
        "monetary policy tools", "instruments of monetary policy",
        "pre reform monetary policy", "post reform monetary policy",
        "urjit patel committee", "mpc", "inflation targeting"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-FINANCIAL-SYSTEM",
      name: "Financial System (Money/Capital Markets, Regulation, Convertibility, Risks)",
      tags: ["M"],
      microThemes: [
        "Money market and capital market",
        "Regulatory framework for capital market",
        "Primary and secondary market reforms",
        "Current & capital account convertibility",
        "Risks of financial system"
      ],
      keywords: [
        "money market", "capital market", "capital market regulation",
        "primary market reforms", "secondary market reforms",
        "current account convertibility", "capital account convertibility",
        "financial system risks"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-BANKING",
      name: "Banking (Structure, Reforms, NBFC, Inclusion, NPAs)",
      tags: ["M"],
      microThemes: [
        "Indian banking system: key concepts",
        "Nationalisation of banks",
        "Functions and challenges of commercial banks",
        "Banking reforms; new bank licence criteria",
        "Small finance banks; payment banks",
        "NBFCs",
        "Financial inclusion",
        "NPAs and banking stress",
        "Banking-related bills (hooks)"
      ],
      keywords: [
        "indian banking system", "bank nationalisation", "commercial bank functions",
        "banking reforms", "new bank licence", "small finance bank", "payment bank",
        "nbfc", "financial inclusion", "npa", "bad loans", "banking bills"
      ],
      schemes: []
    },

    {
      id: "GS3-ECO-FOREIGN-TRADE-IO",
      name: "Foreign Trade + BoP + Globalisation + International Organisations",
      tags: ["M"],
      microThemes: [
        "Trends in international trade",
        "Foreign trade policy",
        "Balance of payments and foreign capital",
        "Impact of globalisation on Indian economy",
        "IMF, WTO, World Bank Group, AIIB, NDB"
      ],
      keywords: [
        "international trade trends", "foreign trade policy",
        "balance of payments", "bop", "foreign capital",
        "globalisation impact", "imf", "wto", "world bank",
        "aiib", "new development bank", "ndb"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ECO-MAINS-SECTORS-CONTEMP",
  name: "Economy (Mains): Contemporary Issues — Sectors of Indian Economy",
  tags: ["M"],
  topics: [
    /* ===================== INDUSTRY & LABOUR ===================== */
    {
      id: "GS3-ECO-SECT-INDLAB",
      name: "Industry & Labour (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "Draft National Food Processing Policy released",
        "Fund/initiatives for Start-ups",
        "Beyond CSR: business responsibility & strategic ESG",
        "Initiatives to support MSME sector",
        "Model Shop & Establishment Bill, 2016",
        "National Capital Goods Policy 2016",
        "H-1B visa rule change & impact on IT sector",
        "Unemployment survey: signals and debates",
        "Draft Social Security Code",
        "Competition Commission of India (CCI): performance analysis",
        "Exit issues and Insolvency Resolution Process (IBC)",
        "Limits of government in job creation",
        "Code on Wages, 2019",
        "Amendments in Bankruptcy Code (IBC updates)",
        "Contract workers: issues and reforms",
        "Feminization of agriculture (labour + gender) — linked issue",
        "Fourth Industrial Revolution: challenges & opportunities",
        "Why manufacturing is not generating jobs?",
        "Inequality: large business houses vs MSMEs",
        "How labour regulations affect manufacturing?"
      ],
      keywords: [
        "draft national food processing policy",
        "fund for start ups", "startup initiatives", "startup fund",
        "beyond csr", "csr beyond", "esg",
        "msme support initiatives", "msme sector",
        "model shop and establishment bill 2016",
        "national capital goods policy 2016",
        "h1b visa rule change", "it sector impact",
        "unemployment survey", "jobs survey",
        "draft social security code", "social security code",
        "competition commission of india", "cci analysis",
        "exit issues", "insolvency resolution process", "ibc",
        "job creation limitations",
        "code on wages 2019", "wage code",
        "bankruptcy code amendment", "ibc amendment",
        "contract worker issues", "contract labour",
        "fourth industrial revolution", "industry 4.0",
        "manufacturing not generating jobs", "jobless growth",
        "inequality big business vs small", "msme inequality",
        "labour regulations manufacturing"
      ],
      schemes: []
    },

    /* ===================== AGRICULTURE ===================== */
    {
      id: "GS3-ECO-SECT-AGRI",
      name: "Agriculture (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "NITI Aayog agricultural marketing & farm-friendly reforms index",
        "Defects in procurement policy",
        "Reforming trade in agriculture products",
        "Draft Model APMC Act, 2016",
        "NITI Aayog report on agriculture",
        "Agriculture Export Policy, 2018",
        "Farm policies: one-size-fits-all doesn’t work",
        "Lab to land: how to improve",
        "Agriculture price policy in India"
      ],
      keywords: [
        "agricultural marketing reforms index", "niti aayog reforms index",
        "procurement policy defects", "procurement defects",
        "reforming trade in agriculture products", "agri trade reform",
        "draft model apmc act 2016", "apmc reform",
        "niti aayog agriculture report",
        "agriculture export policy 2018",
        "one size fits all farm policies",
        "lab to land", "improve lab to land",
        "agriculture price policy", "price policy india"
      ],
      schemes: []
    },

    /* ===================== INFRASTRUCTURE ===================== */
    {
      id: "GS3-ECO-SECT-INFRA",
      name: "Infrastructure (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "Inland waterways in India",
        "Aviation sector & regional connectivity: UDAN",
        "Air service agreements",
        "Airline sector: downtime and turnaround",
        "Privatisation of Air India: critical analysis",
        "Multi-modal transport system",
        "Bharatmala Pariyojana: highways push",
        "Privatisation of railways: debates",
        "Transformation in Indian Railways",
        "Connecting North East: infra & logistics",
        "Optimising thermal power in India",
        "Reliable and affordable energy",
        "Mineral Auction Rules, 2015"
      ],
      keywords: [
        "inland waterways india",
        "udan scheme", "regional connectivity scheme",
        "air service agreement",
        "airline turnaround", "airline downtime",
        "privatization of air india", "air india privatization",
        "multi modal transport system", "multimodal transport",
        "bharatmala pariyojana", "national highways bharatmala",
        "privatization of railways", "railways privatization",
        "transformation in indian railways", "railway reforms",
        "connecting north east", "north east connectivity",
        "optimising thermal power", "thermal power optimization",
        "reliable affordable energy",
        "mineral auction rules 2015"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ECO-MAINS-POLICYREF-CONTEMP",
  name: "Economy (Mains): Contemporary Issues — Policy & Reforms",
  tags: ["M"],
  topics: [
    /* ===================== BUDGET & TAXATION ===================== */
    {
      id: "GS3-ECO-PR-BUDTAX",
      name: "Budget & Taxation (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "Low tax-to-GDP ratio: reasons and suggestions",
        "Public Debt Management Cell",
        "IBBI and insolvency rules",
        "Ponzi schemes: issues and regulation",
        "Fat tax: concept and analysis",
        "Municipal bonds: concept and use-cases",
        "Lower taxes, higher compliance: implications",
        "Shell companies and black money",
        "Offshore investments and tax havens",
        "Google tax / digital tax: implications",
        "Sunset clause in policies: significance",
        "Capital gains tax rules: policy implications",
        "Credit rating agencies: role and concerns",
        "Fugitive Economic Offenders Bill"
      ],
      keywords: [
        "tax to gdp ratio", "low tax gdp reasons",
        "public debt management cell", "pdmc",
        "ibbi", "insolvency rules",
        "ponzi scheme", "ponzi issues",
        "fat tax",
        "municipal bonds", "muni bonds",
        "lower taxes higher compliance",
        "shell companies black money",
        "tax havens", "offshore investments",
        "google tax", "digital tax",
        "sunset clause",
        "capital gains tax rule",
        "credit rating agencies",
        "fugitive economic offenders bill"
      ],
      schemes: []
    },

    /* ===================== BANKING & FINANCE ===================== */
    {
      id: "GS3-ECO-PR-BANKFIN",
      name: "Banking & Finance (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "Willful defaulter: concept and debates",
        "Shadow banking: concept (NBFC ecosystem)",
        "Non-performing assets (NPAs): trends and solutions",
        "MCLR: marginal cost of funds based lending rate",
        "UPI: unified payments interface",
        "India Post Payments Bank",
        "Differentiated bank licences",
        "Digital payments scenario",
        "Monetary Policy Committee: significance",
        "Corporate bond market working group report",
        "IL&FS issue and corporate governance lessons",
        "SEBI corporate governance reforms: Uday Kotak Committee",
        "SEBI and commodity markets",
        "Crypto-currencies: concept and regulation debates",
        "Crypto under SEBI lens (regulatory hooks)",
        "Corporate governance: role of SEBI",
        "Peer-to-peer lending firms",
        "Bank recapitalisation programme",
        "NPA lessons from global banks",
        "Regime for Alternative Investment Funds (AIF)",
        "Name-and-shame willful defaulters: pros/cons"
      ],
      keywords: [
        "willful defaulter", "wilful defaulter",
        "shadow banking", "nbfc",
        "npa", "non performing assets",
        "mclr",
        "upi", "unified payments interface",
        "india post payments bank", "ippb",
        "differentiated bank licence", "payment bank", "small finance bank",
        "digital payments scenario",
        "monetary policy committee", "mpc",
        "corporate bond market working group",
        "ilfs issue", "il&fs",
        "uday kotak committee", "sebi corporate governance reforms",
        "sebi commodity markets",
        "crypto currencies", "cryptocurrency regulation",
        "peer to peer lending", "p2p lending",
        "bank recapitalization program",
        "aif regulatory regime", "alternative investment fund",
        "name and shame willful defaulters"
      ],
      schemes: []
    },

    /* ===================== SCHEMES & POLICIES ===================== */
    {
      id: "GS3-ECO-PR-SCHEMES",
      name: "Schemes & Policies (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "Sustainable Development Goals (SDGs): economic policy links",
        "Ease of Doing Business: reforms and critique",
        "PM Crop Insurance Scheme: critical analysis",
        "Bhavantar Bhugtan Yojana",
        "Operation Greens",
        "Banks Board Bureau: critical analysis",
        "Draft energy policy: critical analysis",
        "Stand Up India scheme: critical analysis",
        "New PPP policy",
        "Sagarmala project",
        "Bharatmala project: critical analysis",
        "GST analysis",
        "GST impact on small businesses"
      ],
      keywords: [
        "sustainable development goals", "sdgs",
        "ease of doing business", "eodb",
        "pm crop insurance scheme", "pradhan mantri fasal bima yojana", "pmfby",
        "bhavantar bhugtan yojana",
        "operation greens",
        "banks board bureau", "bbb",
        "draft energy policy",
        "stand up india scheme",
        "new ppp policy", "ppp policy",
        "sagarmala project",
        "bharatmala project",
        "gst analysis", "gst small business impact"
      ],
      schemes: []
    },

    /* ===================== EXTERNAL SECTOR ===================== */
    {
      id: "GS3-ECO-PR-EXTSECTOR",
      name: "External Sector + Global Economic Governance (Contemporary Issues)",
      tags: ["M"],
      microThemes: [
        "FDI status and issues in India",
        "Permanent residency status for foreign investors",
        "WTO reforms and India’s stance",
        "WTO dispute settlement mechanism",
        "Foreign Trade Policy (FTP) 2015–2020: gist",
        "IMF quota reforms",
        "Rising protectionism: new forms",
        "BIT dispute management strategy",
        "Broad-based trade & investment agreement: India–EU FTA talks"
      ],
      keywords: [
        "fdi status issues", "fdi india",
        "permanent residency status foreign investors", "prs foreign investors",
        "wto reforms india stance",
        "wto dispute settlement mechanism", "dsm wto",
        "foreign trade policy 2015 2020", "ftp 2015 2020",
        "imf quota reforms",
        "new protectionism", "rising protectionism",
        "bit dispute management strategy", "bilateral investment treaty dispute",
        "india eu fta talks", "bbtia", "broad based trade investment agreement"
      ],
      schemes: []
    },

    /* ===================== COMMITTEES / REPORTS (HIGH-YIELD) ===================== */
    {
      id: "GS3-ECO-PR-COMMITTEES",
      name: "Committees / Reports (Economy & Reforms) — High Yield",
      tags: ["PM"],
      microThemes: [
        "Nachiket Mor Committee",
        "P. J. Nayak Committee",
        "Vijay Kelkar Committee on PPP reforms",
        "Parthasarathi Shome Committee on GAAR",
        "Urjit Patel Committee Report on Monetary Policy",
        "Mahapatra Committee (NBFC loan restructuring)",
        "Usha Thorat Committee (2012)",
        "Bibek Debroy Committee (Railways)",
        "N. K. Singh panel on FRBM Act",
        "Shanta Kumar Committee",
        "Watal Committee on Digital Payments",
        "H. R. Khan Committee on Foreign Portfolio Investment",
        "Strategic Partnership Policy to boost defence manufacturing: Dhirendra Singh Committee"
      ],
      keywords: [
        "nachiket mor committee",
        "pj nayak committee", "p j nayak committee",
        "vijay kelkar committee ppp", "kelkar ppp reforms",
        "parthasarathi shome committee", "shome gaar",
        "urjit patel committee report", "monetary policy committee report",
        "mahapatra committee nbfc restructuring",
        "usha thorat committee 2012",
        "bibek debroy committee railways",
        "nk singh panel frbm", "n k singh frbm",
        "shanta kumar committee",
        "watal committee digital payments",
        "hr khan committee fpi", "h r khan committee",
        "strategic partnership policy defence manufacturing", "dhirendra singh committee"
      ],
      schemes: []
    }
  ]
},
  ]
},

      Environment: { sections: [{
  id: "GS3-ENV-ECOLOGY",
  name: "Ecology Basics",
  tags: ["P"],
  topics: [
    {
      id: "GS3-ENV-ECO-CONCEPTS",
      name: "Basic Ecology Concepts",
      tags: ["P"],
      microThemes: [
        "Habitat vs ecological niche",
        "Ecological hierarchy",
        "Ecotone and edge effect",
        "Climax community",
        "Range of tolerance",
        "Deep vs shallow ecology"
      ],
      keywords: [
        "habitat niche difference",
        "ecological hierarchy",
        "ecotone edge effect",
        "climax community",
        "range of tolerance ecology",
        "deep ecology shallow ecology"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-ECO-ENERGY",
      name: "Ecosystem Functions & Energy Flow",
      tags: ["P"],
      microThemes: [
        "Food chain vs food web",
        "Trophic levels",
        "Ecological pyramids",
        "Energy flow models",
        "Biomagnification",
        "Primary productivity"
      ],
      keywords: [
        "food chain food web",
        "trophic level ecology",
        "ecological pyramid",
        "energy flow ecosystem",
        "biomagnification",
        "primary productivity ecology"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-BIOGEO",
      name: "Biogeochemical Cycles",
      tags: ["P"],
      microThemes: [
        "Carbon cycle",
        "Nitrogen cycle",
        "Hydrological cycle",
        "Phosphorus cycle",
        "Human impact on nutrient cycles"
      ],
      keywords: [
        "carbon cycle",
        "nitrogen cycle",
        "hydrological cycle",
        "phosphorus cycle",
        "biogeochemical cycles human impact"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ENV-BIODIV",
  name: "Biodiversity & Conservation",
  tags: ["P"],
  topics: [
    {
      id: "GS3-ENV-SPECIES",
      name: "Species Concepts",
      tags: ["P"],
      microThemes: [
        "Endemic species",
        "Keystone species",
        "Indicator species",
        "Invasive species",
        "Allopatric vs sympatric speciation"
      ],
      keywords: [
        "endemic species",
        "keystone species",
        "indicator species",
        "invasive species",
        "allopatric sympatric speciation"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-CONSERVATION",
      name: "Conservation Methods",
      tags: ["P"],
      microThemes: [
        "In-situ conservation",
        "Ex-situ conservation",
        "Biosphere reserve",
        "National park vs sanctuary",
        "Sacred groves"
      ],
      keywords: [
        "in situ ex situ conservation",
        "biosphere reserve",
        "national park sanctuary difference",
        "sacred groves"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-PROJECTS",
      name: "Species Conservation Projects",
      tags: ["P"],
      microThemes: [
        "Project Tiger",
        "Project Elephant",
        "Snow Leopard Project",
        "Indian Rhino Vision",
        "Ganges Dolphin project"
      ],
      keywords: [
        "project tiger",
        "project elephant",
        "snow leopard project",
        "indian rhino vision",
        "ganges dolphin project"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ENV-POLLUTION",
  name: "Pollution & Waste Management",
  tags: ["P"],
  topics: [
    {
      id: "GS3-ENV-AIR",
      name: "Air Pollution",
      tags: ["P"],
      microThemes: [
        "Smog",
        "Acid rain",
        "Ozone depletion",
        "Bharat stage norms",
        "Air Quality Index"
      ],
      keywords: [
        "smog",
        "acid rain",
        "ozone depletion",
        "bharat stage norms",
        "air quality index"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-WASTE",
      name: "Waste Management",
      tags: ["P"],
      microThemes: [
        "Solid waste management",
        "E-waste rules",
        "Biomedical waste rules",
        "Hazardous waste",
        "Waste to energy"
      ],
      keywords: [
        "solid waste management",
        "e waste rules",
        "biomedical waste rules",
        "hazardous waste",
        "waste to energy"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ENV-CLIMATE",
  name: "Climate Change",
  tags: ["P"],
  topics: [
    {
      id: "GS3-ENV-GLOBALWARM",
      name: "Global Warming Concepts",
      tags: ["P"],
      microThemes: [
        "Greenhouse effect",
        "Carbon footprint",
        "Carbon sequestration",
        "Global warming potential",
        "Urban heat island"
      ],
      keywords: [
        "greenhouse effect",
        "carbon footprint",
        "carbon sequestration",
        "global warming potential",
        "urban heat island"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-CLIMATEPHEN",
      name: "Climate Phenomena",
      tags: ["P"],
      microThemes: [
        "El Nino",
        "La Nina",
        "Ocean acidification",
        "Glacier melting",
        "Climate change and health"
      ],
      keywords: [
        "el nino",
        "la nina",
        "ocean acidification",
        "glacier melting",
        "climate change health"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ENV-LAWS",
  name: "Environmental Governance & Laws",
  tags: ["P"],
  topics: [
    {
      id: "GS3-ENV-ACTS",
      name: "Indian Environmental Acts",
      tags: ["P"],
      microThemes: [
        "Wildlife Protection Act 1972",
        "Environment Protection Act",
        "Forest Rights Act 2006",
        "Biological Diversity Act 2002",
        "National Green Tribunal"
      ],
      keywords: [
        "wildlife protection act 1972",
        "environment protection act",
        "forest rights act 2006",
        "biological diversity act 2002",
        "national green tribunal"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-INTL",
      name: "International Environmental Agreements",
      tags: ["P"],
      microThemes: [
        "UNFCCC",
        "Paris Agreement",
        "Montreal Protocol",
        "Kyoto Protocol",
        "Convention on Biological Diversity"
      ],
      keywords: [
        "unfccc",
        "paris agreement",
        "montreal protocol",
        "kyoto protocol",
        "cbd biodiversity convention"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ENV-RES-ENERGY",
  name: "Resources & Energy",
  tags: ["P"],
  topics: [
    {
      id: "GS3-ENV-LAND-WATER",
      name: "Land, Forest & Water Resources",
      tags: ["P"],
      microThemes: [
        "Land degradation: causes + impacts",
        "Desertification + sustainable land management",
        "Deforestation: causes + consequences + control",
        "Soil formation + soil erosion + soil conservation",
        "Groundwater and surface water issues",
        "Eutrophication, algal bloom, arsenic/mercury contamination"
      ],
      keywords: [
        "land degradation", "desertification", "sustainable land management",
        "deforestation", "soil erosion", "soil conservation",
        "groundwater depletion", "surface water pollution",
        "eutrophication", "algal bloom", "arsenic contamination", "mercury pollution"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-ENERGY",
      name: "Energy Resources (Renewable + Non-renewable)",
      tags: ["P"],
      microThemes: [
        "Solar, wind, biomass, biogas",
        "Biofuels and National Policy on Biofuels",
        "Geothermal, tidal, wave, OTEC",
        "Fuel cell and microbial fuel cell",
        "Nuclear energy basics; 3-stage nuclear programme",
        "Energy efficiency (UJALA etc.)"
      ],
      keywords: [
        "renewable energy", "solar energy", "wind energy", "biomass", "biogas",
        "biofuels policy", "geothermal energy", "tidal energy", "wave energy", "otec",
        "fuel cell", "microbial fuel cell",
        "three stage nuclear power programme", "energy efficiency", "ujala"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-ENERGY-GOV",
      name: "Energy Governance (Policies/Institutions)",
      tags: ["P"],
      microThemes: [
        "National Electric Mobility Mission Plan",
        "Renewable Purchase Obligation (RPO)",
        "Petroleum Planning & Analysis Cell (PPAC)",
        "Petroleum Conservation Research Association (PCRA)",
        "National/sectoral energy policy hooks"
      ],
      keywords: [
        "national electric mobility mission plan",
        "renewable purchase obligation", "rpo",
        "ppac", "petroleum planning analysis cell",
        "pcra", "petroleum conservation research association",
        "energy policy"
      ],
      schemes: []
    }
  ]
},
{
  id: "GS3-ENV-CURRENT",
  name: "Current Environmental Issues",
  tags: ["P"],
  topics: [
    {
      id: "GS3-ENV-CURR-POLLUTION",
      name: "Current Issues: Pollution + Waste + Innovations",
      tags: ["P"],
      microThemes: [
        "Microplastics and marine debris",
        "Black carbon",
        "Anti-smog guns (hook)",
        "Sand mining guidelines",
        "Wetland Rules updates (hook)",
        "Waste-to-green fuel technologies",
        "Air pollution graded response plan (hook)"
      ],
      keywords: [
        "microplastics", "marine debris", "black carbon",
        "anti smog gun", "sand mining guidelines",
        "wetland rules", "waste to green fuel",
        "graded response action plan", "grap"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-CURR-CLIMATE",
      name: "Current Issues: Climate + COP + Targets",
      tags: ["P"],
      microThemes: [
        "COP meetings (hook)",
        "Carbon neutrality / net-zero (hook)",
        "Loss and damage (Warsaw mechanism hook)",
        "HFC phase-down / Kigali (hook)",
        "Geo-engineering (hook)"
      ],
      keywords: [
        "cop", "net zero", "carbon neutrality",
        "loss and damage", "warsaw international mechanism",
        "kigali agreement", "hfc phase down",
        "geo engineering"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-CURR-RIVERS",
      name: "Current Issues: Rivers, Wetlands, Coasts",
      tags: ["P"],
      microThemes: [
        "Namami Gange",
        "Smart Ganga City",
        "Ganga Task Force (hook)",
        "Coastal erosion (hook)",
        "Bottom trawling / deep-sea fishing (hook)"
      ],
      keywords: [
        "namami gange", "smart ganga city", "ganga task force",
        "coastal erosion", "bottom trawling", "deep sea fishing"
      ],
      schemes: []
    },
    {
  id: "GS3-ENV-MAINS",
  name: "Environment (Mains: Ecology, Pollution, EIA, Climate, Sustainability)",
  tags: ["M"],
  topics: [

    {
      id: "GS3-ENV-MAINS-BASICS",
      name: "Environment & Ecology Basics",
      tags: ["M"],
      microThemes: [
        "Categories and components of environment",
        "Ecology concepts and human-environment relationship",
        "Ecology vs economy debate",
        "Features and importance of environment"
      ],
      keywords: [
        "components of environment", "ecology basics", "human environment relationship",
        "ecology vs economy", "importance of environment"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-MAINS-ECOSYSTEM",
      name: "Ecosystem & Biogeochemical Cycles",
      tags: ["M"],
      microThemes: [
        "Ecosystem structure and functions",
        "Abiotic and biotic factors",
        "Carbon cycle and greenhouse gases",
        "Nitrogen cycle and human impact",
        "Hydrological cycle",
        "Sulphur and phosphorus cycles"
      ],
      keywords: [
        "ecosystem structure", "biotic abiotic factors",
        "carbon cycle", "greenhouse gases",
        "nitrogen cycle", "hydrological cycle",
        "phosphorus cycle", "sulphur cycle"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-MAINS-BIODIVERSITY",
      name: "Biodiversity & Conservation",
      tags: ["M"],
      microThemes: [
        "Types of biodiversity",
        "Threats to biodiversity",
        "Invasive species and extinction",
        "In-situ vs ex-situ conservation",
        "Ecologically sensitive areas"
      ],
      keywords: [
        "biodiversity types", "biodiversity threats", "invasive species",
        "extinction", "in situ conservation", "ex situ conservation",
        "ecologically sensitive area"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-MAINS-POLLUTION",
      name: "Pollution & Environmental Degradation",
      tags: ["M"],
      microThemes: [
        "Air pollution and control",
        "Water pollution and degradation",
        "Marine pollution",
        "Noise and radioactive pollution",
        "Mining and environmental degradation"
      ],
      keywords: [
        "air pollution", "water pollution", "marine pollution",
        "noise pollution", "radioactive pollution", "mining pollution"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-MAINS-WASTE",
      name: "Waste Management",
      tags: ["M"],
      microThemes: [
        "Solid waste management rules",
        "E-waste management",
        "Biomedical waste",
        "Hazardous waste treatment"
      ],
      keywords: [
        "solid waste management", "swm rules 2016",
        "e waste management", "biomedical waste",
        "hazardous waste management"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-MAINS-CLIMATE",
      name: "Climate Change & Mitigation",
      tags: ["M"],
      microThemes: [
        "Climate change causes and impacts",
        "Mitigation and adaptation strategies",
        "International climate conventions",
        "Climate change management"
      ],
      keywords: [
        "climate change impact", "climate mitigation",
        "climate adaptation", "climate conventions"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-MAINS-EIA",
      name: "Environmental Impact Assessment & Sustainable Development",
      tags: ["M"],
      microThemes: [
        "Environmental impact assessment process",
        "Sustainable agriculture",
        "Green buildings",
        "Rainwater harvesting",
        "Eco tourism"
      ],
      keywords: [
        "environmental impact assessment", "eia process",
        "sustainable agriculture", "green buildings",
        "rainwater harvesting", "eco tourism"
      ],
      schemes: []
    },
    {
  id: "GS3-ENV-CONTEMP-MAINS",
  name: "Environment (Contemporary Issues – Mains)",
  tags: ["M"],
  topics: [

    {
      id: "GS3-ENV-WILDLIFE-CURR",
      name: "Wildlife & Biodiversity Issues",
      tags: ["M"],
      microThemes: [
        "Man-animal conflict",
        "Poaching and wildlife crime",
        "Elephant conservation",
        "Declining pollinators",
        "Critical wildlife habitats",
        "Eco-bridges and biodiversity corridors",
        "Urban land as bird death traps",
        "Sundarbans and climate risk"
      ],
      keywords: [
        "man animal conflict",
        "poaching india",
        "elephant conservation",
        "declining pollinators",
        "critical wildlife habitat",
        "eco bridges",
        "urban birds death",
        "sundarbans climate change"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-POLLUTION-CURR",
      name: "Combating Pollution – Current Issues",
      tags: ["M"],
      microThemes: [
        "Indoor air pollution",
        "Particulate matter impact",
        "Stubble burning",
        "Plastic pollution",
        "Groundwater contamination",
        "Polluter Pays Principle",
        "Oil spills",
        "E-waste rules 2016",
        "Beach pollution",
        "Nitrogen pollution"
      ],
      keywords: [
        "indoor air pollution",
        "particulate matter",
        "stubble burning",
        "plastic pollution",
        "arsenic groundwater",
        "polluter pays principle",
        "oil spill",
        "e waste rules",
        "beach pollution",
        "nitrogen pollution"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-CLIMATE-CURR",
      name: "Climate Change – Contemporary Developments",
      tags: ["M"],
      microThemes: [
        "COP meetings",
        "Paris Agreement and US withdrawal",
        "Kigali Amendment",
        "IPCC reports",
        "Green bonds",
        "Green Climate Fund",
        "Climate change and agriculture",
        "Climate change and cities",
        "Sea level rise",
        "Ethical dimensions of climate change"
      ],
      keywords: [
        "cop climate",
        "paris agreement",
        "kigali amendment",
        "ipcc report",
        "green bond",
        "green climate fund",
        "climate agriculture",
        "climate cities",
        "sea level rise",
        "climate ethics"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-RENEWABLE-CURR",
      name: "Renewable Energy & Climate Policy",
      tags: ["M"],
      microThemes: [
        "National Solar Mission",
        "National Wind-Solar Hybrid Policy",
        "Hydropower status in India",
        "National Energy Storage Mission",
        "India Cooling Action Plan",
        "Alternative fuels",
        "Draft energy policy"
      ],
      keywords: [
        "national solar mission",
        "wind solar hybrid policy",
        "hydropower india",
        "energy storage mission",
        "india cooling action plan",
        "alternative fuels india",
        "draft energy policy"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-CONSERVATION-CURR",
      name: "Environmental Governance & Initiatives",
      tags: ["M"],
      microThemes: [
        "Compensatory Afforestation Fund Act",
        "Wetland Rules 2017",
        "REDD+ strategy",
        "Environmental compliance",
        "Forest Survey of India",
        "National Green Tribunal analysis",
        "Genetic Engineering Appraisal Committee",
        "Living status to rivers"
      ],
      keywords: [
        "compensatory afforestation fund act",
        "wetland rules 2017",
        "redd plus india",
        "environmental compliance",
        "forest survey of india",
        "national green tribunal",
        "genetic engineering appraisal committee",
        "living rivers status"
      ],
      schemes: []
    },

    {
      id: "GS3-ENV-MISC-CURR",
      name: "Miscellaneous Contemporary Environmental Issues",
      tags: ["M"],
      microThemes: [
        "Forest fires",
        "Sand mining",
        "River linking impact",
        "Mass coral bleaching",
        "Antarctic ice melting",
        "Bottom trawling",
        "Algal bloom"
      ],
      keywords: [
        "forest fires",
        "sand mining",
        "river linking project impact",
        "coral bleaching",
        "antarctic melting",
        "bottom trawling",
        "algal bloom"
      ],
      schemes: []
    }

  ]
},

  ]
},
  ]
},

] },
      InternalSecurity: {
  sections: [
    {
      id: "GS3-SEC-MAINS",
      name: "Internal Security Challenges In India (Mains)",
      tags: ["M"],
      topics: [

        {
          id: "GS3-SEC-FOUNDATIONS",
          name: "Internal Security: Concepts + Threat Landscape",
          tags: ["M"],
          microThemes: [
            "Law and order vs internal security",
            "Social diversity as security threat",
            "Challenges from within India",
            "Neighbours as security threat",
            "Non-state actors and vulnerability indices"
          ],
          keywords: [
            "law and order vs internal security",
            "social diversity security threat",
            "internal security challenges",
            "non state actors",
            "vulnerability index"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-NEIGHBOURS",
          name: "External State Actors: Neighbourhood Security Challenges",
          tags: ["M"],
          microThemes: [
            "Pakistan challenge",
            "China challenge",
            "Myanmar, Bangladesh, Bhutan, Nepal, Sri Lanka dimensions",
            "Cross-border influence and spillovers"
          ],
          keywords: [
            "pakistan security threat",
            "china security threat",
            "myanmar border security",
            "bangladesh border issues",
            "nepal security",
            "sri lanka security",
            "bhutan security"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-TERRORISM",
          name: "Terrorism Threat to India",
          tags: ["M"],
          microThemes: [
            "Changing face of terrorism",
            "Terror threats faced by India",
            "Framework to deal with terrorism"
          ],
          keywords: [
            "changing face of terrorism",
            "terror threats india",
            "counter terrorism framework",
            "terrorism in india"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-ORGCRIME",
          name: "Organized Crime + Terror Linkages",
          tags: ["M"],
          microThemes: [
            "Types of organized crime",
            "Controlling organized crime: challenges",
            "Combating organized crime",
            "Linkage between terrorism and organized crime"
          ],
          keywords: [
            "organized crime",
            "terrorism organized crime linkage",
            "narco terror",
            "crime terror nexus"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-EXTREMISM",
          name: "Development–Extremism Linkages (Naxalism)",
          tags: ["M"],
          microThemes: [
            "What is naxalism",
            "History of naxal movement",
            "Why naxalism is a major internal security threat",
            "Development deficits and spread of extremism"
          ],
          keywords: [
            "naxalism",
            "left wing extremism",
            "history of naxal movement",
            "development and extremism"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-NE-INSURGENCY",
          name: "Insurgency in North-East",
          tags: ["M"],
          microThemes: [
            "North-East insurgency overview",
            "Assam insurgency",
            "Issues and conflicts in NE"
          ],
          keywords: [
            "north east insurgency",
            "assam insurgency",
            "ne conflicts",
            "insurgency north east"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-BORDER",
          name: "Border Area Security + Border Management",
          tags: ["M"],
          microThemes: [
            "Challenges to border management",
            "Issues faced in border management",
            "Community participation for border management"
          ],
          keywords: [
            "border management",
            "border area security",
            "community participation border",
            "border challenges"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-CYBER-BASICS",
          name: "Cyber Security Basics + Cyber Crimes",
          tags: ["M"],
          microThemes: [
            "Basics of cyber security",
            "Types of cyber crimes",
            "Ransomware incidents",
            "National Cyber Security Policy 2013"
          ],
          keywords: [
            "cyber security basics",
            "cyber crimes",
            "ransomware",
            "national cyber security policy 2013"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-CYBERWAR",
          name: "Cyber Warfare + Spyware + State Actors",
          tags: ["M"],
          microThemes: [
            "Cyber warfare and its drivers",
            "China's role in cyber warfare",
            "Spywares and surveillance tools",
            "Initiatives to tackle cyber warfare",
            "Way forward"
          ],
          keywords: [
            "cyber warfare",
            "china cyber warfare",
            "spyware",
            "cyber attack initiatives",
            "cyber defence"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-SOCIALMEDIA",
          name: "Communication Networks + Social Media Threats",
          tags: ["M"],
          microThemes: [
            "Role of media and social networks in internal security",
            "Regulation of social media for internal security",
            "Challenges in monitoring social media"
          ],
          keywords: [
            "social media internal security",
            "regulation of social media",
            "monitoring social media challenges",
            "communication networks security"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-ML-BLACK",
          name: "Money Laundering + Black Money",
          tags: ["M"],
          microThemes: [
            "Meaning and impact of money laundering",
            "Steps taken by government",
            "Black money and parallel economy",
            "Demonetization: impact and critique"
          ],
          keywords: [
            "money laundering",
            "prevention of money laundering",
            "black money",
            "parallel economy",
            "demonetization black money"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-POLICE-PRISON",
          name: "Police Reforms + Prison Reforms",
          tags: ["M"],
          microThemes: [
            "Centre’s role in policing",
            "Police structure and responsibilities",
            "Traditional vs non-traditional security challenges",
            "Recommendations for police reforms",
            "Prison reforms"
          ],
          keywords: [
            "police reforms",
            "centre role in policing",
            "non traditional security",
            "prison reforms",
            "police we want 21st century"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-FORCES",
          name: "Security Forces & Mandate",
          tags: ["M"],
          microThemes: [
            "Assam Rifles",
            "BSF",
            "ITBP",
            "CISF",
            "CRPF",
            "NSG",
            "Issues with paramilitary forces"
          ],
          keywords: [
            "assam rifles",
            "bsf",
            "itbp",
            "cisf",
            "crpf",
            "nsg",
            "paramilitary forces issues"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-ARMY",
          name: "Role of Army in Internal Security",
          tags: ["M"],
          microThemes: [
            "Why military role is relevant",
            "Indian Army response in internal security",
            "Doctrinal development and structural adaptation"
          ],
          keywords: [
            "role of army internal security",
            "military relevance internal security",
            "doctrinal development army",
            "structural adaptation army"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-GOV-MECH",
          name: "Governance + National Security Mechanism + Intelligence",
          tags: ["M"],
          microThemes: [
            "Impact of governance and justice delivery on internal security",
            "Improving e-governance platforms",
            "Improving policing and intelligence",
            "Centre-state issues in internal security management",
            "Issues in intelligence services and response mechanisms"
          ],
          keywords: [
            "governance impact on internal security",
            "justice delivery internal security",
            "improving policing and intelligence",
            "centre state internal security",
            "intelligence services issues",
            "response mechanism india"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-MARITIME",
          name: "Coastal + Maritime Security",
          tags: ["M"],
          microThemes: [
            "Facets of maritime security",
            "Reporting mechanisms for security",
            "Coastal community participation",
            "Coastal and offshore strategy"
          ],
          keywords: [
            "maritime security",
            "coastal security",
            "offshore security strategy",
            "coastal community participation"
          ],
          schemes: []
        },

        {
          id: "GS3-SEC-DEFENCE-MII",
          name: "Make in India in Defence + Indigenization",
          tags: ["M"],
          microThemes: [
            "Make in India defence: present scenario",
            "Policy and strategy for indigenization",
            "Skill development for defence manufacturing",
            "Technology acquisition"
          ],
          keywords: [
            "make in india defence",
            "defence indigenization",
            "defence manufacturing skill development",
            "technology acquisition defence"
          ],
          schemes: []
        },
        {
  id: "GS3-SEC-CONTEMP",
  name: "Contemporary Issues: Internal Security Challenges In India (Mains)",
  tags: ["M"],
  topics: [

    {
      id: "GS3-SEC-CONTEMP-MIL-POLICY",
      name: "Military Related Policies in India",
      tags: ["M"],
      microThemes: [
        "Joint Doctrine Indian Armed Forces (2017)",
        "Doctrine of Hot Pursuit",
        "Cold Start Doctrine (debate/idea)",
        "India’s military readiness",
        "Women into Military Police",
        "Anti-Hijacking Act, 2016: analysis"
      ],
      keywords: [
        "joint doctrine indian armed forces 2017",
        "hot pursuit doctrine",
        "cold start doctrine",
        "military readiness",
        "women military police",
        "anti hijacking act 2016"
      ],
      schemes: []
    },

    {
      id: "GS3-SEC-CONTEMP-PROCUREMENT",
      name: "Defence Procurement + Manufacturing Ecosystem",
      tags: ["M"],
      microThemes: [
        "Defence PSUs: working analysis",
        "DRDO: role and challenges",
        "Make in India in Defence",
        "CAG report: ammunitions management (hook)",
        "Strategic Partnership Policy to boost defence manufacturing",
        "China increasing defence budget vs India decreasing: implications"
      ],
      keywords: [
        "defence psu",
        "drdo",
        "make in india defence",
        "cag report ammunitions management",
        "strategic partnership policy defence manufacturing",
        "china defence budget implications"
      ],
      schemes: []
    },

    {
      id: "GS3-SEC-CONTEMP-FORCES",
      name: "Issues Related to Security Forces + Policing",
      tags: ["M"],
      microThemes: [
        "Central Armed Police Forces (CAPFs)",
        "Indian police structure",
        "Police modernization scheme",
        "Police reform with respect to cyber security",
        "Police surveillance in age of big data",
        "Non-lethal weapons for crowd control + legal framework",
        "V.S.N. Prasad report: alternatives to pellet guns",
        "One Rank One Pension (OROP)"
      ],
      keywords: [
        "capf",
        "indian police structure",
        "police modernization scheme",
        "police reform cyber security",
        "police surveillance big data",
        "non lethal weapons crowd control",
        "vsn prasad report pellet guns alternatives",
        "one rank one pension",
        "orop"
      ],
      schemes: []
    },

    {
      id: "GS3-SEC-CONTEMP-MARITIME",
      name: "Maritime Security + Indian Ocean + Strategic Expansion",
      tags: ["M"],
      microThemes: [
        "Andaman Sea region: strategic expansion (hook)",
        "Role of Indian Navy in Indian Ocean",
        "Indian Ocean security posture"
      ],
      keywords: [
        "andaman sea military expansion",
        "indian navy indian ocean",
        "maritime security indian ocean"
      ],
      schemes: []
    },

    {
      id: "GS3-SEC-CONTEMP-NIA",
      name: "Counter-Terror Legal/Institutional Updates",
      tags: ["M"],
      microThemes: [
        "Draft amendments to NIA Act, 2008",
        "Counter-terrorism infrastructure in India",
        "Strategy for managing internal security"
      ],
      keywords: [
        "nia act 2008 amendments",
        "draft amendments nia act",
        "counter terrorism infrastructure india",
        "strategy managing internal security"
      ],
      schemes: []
    },

    {
      id: "GS3-SEC-CONTEMP-CT-ISIS-CCIT",
      name: "Terrorism Trends: ISIS + CCIT + Counter-Terror Debates",
      tags: ["M"],
      microThemes: [
        "ISIS challenge in India",
        "Comprehensive Convention on International Terrorism (CCIT)"
      ],
      keywords: [
        "isis challenge in india",
        "ccit",
        "comprehensive convention on international terrorism"
      ],
      schemes: []
    },

    {
      id: "GS3-SEC-CONTEMP-LWE-PEACE",
      name: "Naxalism + Peace Accords + Organized Crime (Contemporary Hooks)",
      tags: ["M"],
      microThemes: [
        "Naxalism: current challenges",
        "Peace accords and negotiations (hook)",
        "Organized crime: evolving nature"
      ],
      keywords: [
        "naxalism current",
        "left wing extremism current",
        "peace accord naxal",
        "organized crime evolving"
      ],
      schemes: []
    },

    {
      id: "GS3-SEC-CONTEMP-MEDIA",
      name: "Media + Social Media as Internal Security Threat",
      tags: ["M"],
      microThemes: [
        "Media and internal security threats",
        "Does social media threaten democracy?"
      ],
      keywords: [
        "media internal security threat",
        "social media threaten democracy",
        "social media internal security"
      ],
      schemes: []
    }

  ]
},

      ]
    }
  ]
},
      DisasterManagement: {
  sections: [
    {
      id: "GS3-DM-MAINS",
      name: "Disaster and Disaster Management (Mains)",
      tags: ["M"],
      topics: [

        {
          id: "GS3-DM-DISASTERS",
          name: "Natural and Man-made Disasters: Types + India Vulnerability",
          tags: ["M"],
          microThemes: [
            "Types of disasters: natural vs man-made",
            "India’s vulnerability profile",
            "Earthquakes",
            "Tsunamis",
            "Landslides",
            "Floods",
            "Drought",
            "Epidemics",
            "Nuclear reactor explosion",
            "Dam collapse",
            "Gas leakage",
            "Oil spill",
            "Volcanic eruption",
            "Forest fires"
          ],
          keywords: [
            "types of disasters",
            "natural disasters",
            "man made disasters",
            "india vulnerability profile",
            "earthquake",
            "tsunami",
            "landslide",
            "flood",
            "drought",
            "epidemic",
            "pandemic",
            "nuclear reactor explosion",
            "nuclear accident",
            "dam collapse",
            "gas leakage",
            "gas leak",
            "oil spill",
            "volcanic eruption",
            "forest fires",
            "wildfire"
          ],
          schemes: []
        },

        {
          id: "GS3-DM-PREP-MIT",
          name: "Disaster Management: Preparedness + Mitigation + Frameworks",
          tags: ["M"],
          microThemes: [
            "Management of disasters",
            "Preparedness and mitigation",
            "Community management and community participation",
            "Government initiatives to tackle disasters",
            "National Disaster Management Act, 2005",
            "Global framework for disaster risk reduction",
            "Disaster insurance",
            "Role of media in disaster management",
            "Gender implications of disasters",
            "Disaster management cycle",
            "Role of NGOs in disaster management",
            "Pre-disaster preparation"
          ],
          keywords: [
            "disaster management",
            "preparedness",
            "mitigation",
            "community management",
            "community participation",
            "government initiatives disaster",
            "ndma act 2005",
            "disaster management act 2005",
            "global framework disaster risk reduction",
            "sendai framework",
            "disaster insurance",
            "role of media disaster management",
            "gender implications disasters",
            "disaster management cycle",
            "role of ngos disaster",
            "pre disaster preparation"
          ],
          schemes: []
        }

      ]
    },
    {
  id: "GS3-DM-INST-LAW",
  name: "DM Institutions + Legal/Policy + International Frameworks",
  tags: ["M"],
  microThemes: [
    "Disaster Management Cycle: Mitigation, Preparedness, Response, Recovery/Reconstruction",
    "Institutional framework: NDMA, NDRF, SDMA, DDMA/District administration, local bodies",
    "Disaster Management Act, 2005",
    "National Disaster Management Policy, 2009",
    "National Disaster Management Plan (NDMP), 2016",
    "International frameworks: Sendai Framework (2015–2030), Hyogo Framework, UNDRR"
  ],
  keywords: [
    "disaster management cycle", "mitigation", "preparedness", "response", "recovery", "reconstruction",
    "ndma", "ndrf", "sdma", "ddma", "district administration", "local bodies",
    "disaster management act 2005", "ndmp 2016", "national disaster management policy 2009",
    "sendai framework", "hyogo framework", "undrr"
  ],
  schemes: []
},

{
  id: "GS3-DM-APPLIED-CA",
  name: "Applied/Current: Vulnerability, Climate Change, Tech, Urban, Community, Funds, Case Studies",
  tags: ["M"],
  microThemes: [
    "India vulnerability profile: coastal cyclones, Himalayas landslides, floods/drought-prone regions",
    "Climate change linkages: cyclone intensity, extreme rainfall, GLOF, heat waves (hooks)",
    "Technology: Early warning systems (cyclone/tsunami/flood), GIS/Remote Sensing mapping, drones/AI for SAR",
    "Urban disaster management: urban flooding, heat islands, building safety",
    "CBDRR: community-based disaster risk reduction; role of NGOs/civil society",
    "Financial mechanisms: NDRF/SDRF and disaster funds",
    "Recent disasters as case studies + lessons (keep updating)"
  ],
  keywords: [
    "vulnerability profile india", "coastal cyclones", "himalayan landslides", "flood prone", "drought prone",
    "climate change disasters", "extreme rainfall", "glof", "glacial lake outburst flood", "heat wave",
    "early warning system", "ews", "gis", "remote sensing", "disaster mapping", "drones", "ai search and rescue",
    "urban flooding", "urban heat island", "building safety", "structural safety",
    "cbdrr", "community based disaster risk reduction", "ngo role",
    "ndrf fund", "sdrf fund"
  ],
  schemes: []
}
  ]
},
      ScienceTech: {
  sections: [
    {
      id: "GS3-ST-PRELIMS",
      name: "Science & Technology (Prelims)",
      tags: ["P"],
      topics: [
        {
          id: "GS3-ST-POLICY-INST",
          name: "S&T Policy + Institutions + India Collaboration",
          tags: ["P"],
          microThemes: [
            "S&T policy evolution: 1958, 1983, 2003, 2013",
            "Role of S&T in development; HRD linkages",
            "Awards related to science (overview)",
            "National agenda initiatives; collaboration projects",
            "Technology Vision Document 2035",
            "National Biotechnology Development Strategy (2015–2020) (hook)",
            "National IPR Policy; organ donation rules; synthetic biology policy (hooks)",
            "Institutions: DST, CSIR, Survey of India, SERB, TDB, NABL etc."
          ],
          keywords: [
            "science and technology policy 1958", "science and technology policy 1983",
            "science and technology policy 2003", "science and technology policy 2013",
            "technology vision 2035", "dst", "csir", "serb", "technology development board",
            "survey of india", "nabl", "synthetic biology policy", "national ipr policy",
            "organ donation rules", "national biotechnology development strategy"
          ],
          schemes: []
        },

        {
          id: "GS3-ST-SPACE",
          name: "Space (ISRO, Orbits, Launch Vehicles, Missions, Space Tech)",
          tags: ["P"],
          microThemes: [
            "ISRO programme; ANTRIX (hook)",
            "Orbits: LEO/MEO/GEO; launch systems",
            "Satellites: INSAT/GSAT/IRS; EO systems; satcom",
            "Launch vehicles: PSLV/GSLV; cryogenic engines",
            "Navigation systems: GPS, Galileo, GLONASS, IRNSS/NavIC, GAGAN",
            "Key missions: Chandrayaan, Mangalyaan/MOM, Aditya (hooks)",
            "Space junk; graveyard orbit",
            "NISAR (NASA-ISRO) (hook)"
          ],
          keywords: [
            "isro", "antrix", "orbit leo", "geo orbit", "launch vehicle", "pslv", "gslv",
            "cryogenic engine", "insat", "gsat", "irs", "earth observation",
            "navic", "irnss", "gagan", "chandrayaan", "mangalyaan", "mars orbiter mission",
            "aditya", "space junk", "graveyard orbit", "nisar"
          ],
          schemes: []
        },

        {
          id: "GS3-ST-IT-COMM",
          name: "IT & Communication (ICT, Cyber, Internet, Digital India, Emerging Tech)",
          tags: ["P"],
          microThemes: [
            "ICT governance: ministry/regulators; spectrum management",
            "Basics: computer terms, generations, networks, internet (IP/URL/HTTP)",
            "Cyber: cyber law, cyber crime, security tools (firewalls etc.)",
            "Mobile/telecom: 3G/4G/VoLTE/5G concepts; optical fibre, VSAT, SIM/IMEI",
            "Cloud, big data, encryption, biometrics, VR",
            "IoT; digital payments; blockchain/crypto (hooks)",
            "Digital India ecosystem: BharatNet, MeghRaj, e-Kranti etc. (hooks)",
            "Net neutrality and privacy debates"
          ],
          keywords: [
            "ict", "spectrum management", "cyber law", "cyber crime", "firewall",
            "ip url http", "cloud computing", "big data", "encryption", "biometrics",
            "virtual reality", "internet of things", "iot", "blockchain", "bitcoin",
            "digital india", "bharatnet", "meghraj", "net neutrality", "privacy"
          ],
          schemes: []
        },

        {
          id: "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
          name: "Materials, Nano Tech, Robotics, AI (incl. lasers, superconductors)",
          tags: ["P"],
          microThemes: [
            "Superconductors: basics, types, applications",
            "Lasers: types and applications",
            "AI basics + applications + pros/cons",
            "Robotics: components, types, applications (industry/health/space/defence)",
            "Nano science/technology: materials and applications",
            "Carbon nanotube, graphene, quantum dots, nanobots (hooks)"
          ],
          keywords: [
            "superconductor", "superconductivity", "laser", "artificial intelligence",
            "robotics", "end effector", "sensor", "autonomous robots",
            "nanotechnology", "nanomaterials", "carbon nanotube", "graphene",
            "quantum dots", "nanobots"
          ],
          schemes: []
        },

        {
          id: "GS3-ST-DEFENCE",
          name: "Defence Technology (Missiles, Platforms, DRDO, Ships/Submarines)",
          tags: ["P"],
          microThemes: [
            "Missile basics: ballistic vs cruise; range/proplusion classification",
            "IGMDP: Prithvi, Agni, Akash, Nag, Trishul (hook)",
            "BrahMos; air independent propulsion (AIP) (hook)",
            "UAVs, stealth, AWACS (overview)",
            "Naval platforms: frigates/destroyers/carriers; Project 75 submarines (hook)",
            "DRDO and defence R&D ecosystem (hook)"
          ],
          keywords: [
            "ballistic missile", "cruise missile", "igmdp", "prithvi", "agni",
            "akash missile", "nag missile", "trishul missile", "brahmos",
            "air independent propulsion", "uav", "awacs", "drdo",
            "project 75", "submarine"
          ],
          schemes: []
        },

        {
          id: "GS3-ST-NUCLEAR",
          name: "Nuclear Technology (Energy, Reactors, 3-stage programme, Safety)",
          tags: ["P"],
          microThemes: [
            "Fission vs fusion; radioactivity basics",
            "India 3-stage nuclear programme",
            "Department of Atomic Energy (DAE), BARC, AERB (institutions)",
            "Nuclear reactors in India (Kudankulam, Jaitapur as hooks)",
            "Safety standards; radioactive waste management",
            "Nuclear/radiological disasters (overview)"
          ],
          keywords: [
            "nuclear fission", "nuclear fusion", "radioactivity", "dae", "barc", "aerb",
            "three stage nuclear programme", "kudankulam", "jaitapur",
            "radioactive waste", "radiological disaster"
          ],
          schemes: []
        },

        {
          id: "GS3-ST-IPR",
          name: "IPR (Patents, Copyright, Trademarks) + Linkages",
          tags: ["P"],
          microThemes: [
            "IPR basics: patents, copyright, trademarks, industrial design, trade secrets",
            "IPR in agriculture; biotech patenting (hooks)"
          ],
          keywords: [
            "intellectual property rights", "ipr", "patent", "copyright",
            "trademark", "industrial design", "trade secret", "ipr agriculture"
          ],
          schemes: []
        },

        {
          id: "GS3-ST-BIOTECH",
          name: "Biotechnology (Genetics, GM, Health, Biofuels, Recent Developments)",
          tags: ["P"],
          microThemes: [
            "Basics: genetics, genetic engineering, DNA sequencing, genomics/proteomics",
            "Biotech in medicine: vaccines, monoclonal antibodies, diagnostics, gene therapy, stem cells",
            "Biofuels: bioethanol, biodiesel, biogas, hydrogen; environmental biotech",
            "GM crops/insects debates (GM mustard, GM mosquito) (hooks)",
            "Biotech institutions: DBT etc.",
            "Recent developments (hooks): genome sequencing, devices, gene editing etc."
          ],
          keywords: [
            "biotechnology", "genetic engineering", "dna sequencing", "genomics",
            "proteomics", "vaccine", "monoclonal antibody", "gene therapy",
            "stem cell", "biofuel", "bioethanol", "biodiesel", "biogas",
            "gm mustard", "gm mosquito", "dbt"
          ],
          schemes: []
        },
        {
  id: "GS3-ST-GENSCI-BIO",
  name: "General Science (Prelims): Biology",
  tags: ["P"],
  microThemes: [
    "Origin of life; cells and cell structure",
    "Cell membranes; cell-cell interactions",
    "Energy & metabolism; respiration",
    "Cell division; sexual reproduction basics",
    "Genetics: inheritance; DNA as genetic material; gene expression/regulation; mutation",
    "Recombinant DNA technology (rDNA)",
    "Classification of living things: domains; viruses; prokaryotes/eukaryotes; protista; plants; fungi; animals",
    "Evolution: evolution of life; animal evolution; human evolution",
    "Tissues: epithelial; connective; muscle",
    "Endocrine system: hypothalamus, pineal, pituitary, thyroid, adrenal, reproductive glands",
    "Respiratory system: plants, insects, humans/animals; external/internal respiration",
    "Transport systems: cell transport; plant transport; animal blood vascular; lymphatic",
    "Skeletal & muscular systems: bones/skeleton; ligaments; muscles; vertebrates",
    "Reproductive system: asexual/sexual reproduction in plants/animals/humans",
    "Excretory system: excretion in plants/animals; osmoregulation; ADH; urine formation",
    "Physiological & behavioural adjustments",
    "Nutrition: energy/carbon sources; plant nutrition; animal nutrition; human diet",
    "Digestive system; photosynthesis",
    "Diseases: TB; non-communicable diseases; diabetes",
    "Economic zoology: beneficial/harmful animals; vectors; pests",
    "Recent developments (hooks): stem cell research guidelines; sepsis therapy; embryo transfer tech; SOHUM; KFD/monkey fever; Mission Indradhanush; new TB regimen; bird flu free status (time-bound)"
  ],
  keywords: [
    "origin of life", "cell structure", "cell membrane", "cell division", "respiration",
    "sexual reproduction", "genetics", "inheritance", "dna genetic material",
    "gene expression", "gene regulation", "mutation", "recombinant dna",
    "classification of living things", "domains of life", "viruses", "prokaryotes", "eukaryotes",
    "protista", "fungi", "plants", "animals", "evolution", "human evolution",
    "tissues epithelial connective muscle", "endocrine system", "hypothalamus",
    "pituitary", "thyroid", "adrenal", "respiratory system", "transport system",
    "blood vascular", "lymphatic", "skeletal system", "ligaments", "muscular system",
    "excretory system", "osmoregulation", "adh", "nutrition", "digestive system",
    "photosynthesis", "tuberculosis", "diabetes", "vectors", "pests",
    "stem cell research", "sepsis therapy", "embryo transfer technology",
    "sohum", "kyasanur forest disease", "mission indradhanush", "tb drug regimen", "bird flu"
  ],
  schemes: []
},
{
  id: "GS3-ST-MAINS-CORE",
  name: "Science & Technology (Mains): Developments, Applications, Indigenisation, IPR",
  tags: ["M"],
  microThemes: [
    "Developments in S&T and applications in everyday life (impact assessment)",
    "Achievements of Indians in S&T; indigenisation; developing new technology",
    "Policy architecture: S&T Policy Resolution 1958; S&T Policy 2013; key initiatives (generic hooks)",
    "Institutional structure for S&T (DST, ISRO, DRDO, DBT, CSIR etc. as hooks)",
    "India–World collaboration in science projects (generic hooks)",
    "SPACE: satcom, INSAT/GSAT applications, remote sensing applications, cryogenic rockets, GPS systems, role of space in development, ISRO as soft power",
    "SPACE governance: space race issues; Outer Space Treaty (broad); Space Activities Bill 2017 (hook)",
    "IT/Telecom/Electronics: IT industry, applications of IT, display technologies, telecom evolution, govt initiatives, contemporary debates (privacy, cyber, net neutrality hooks)",
    "DEFENCE: missile systems classification, India's missile ecosystem, ballistic missile defence, UAVs, stealth, chemical/biological weapons (ethical/legal hooks)",
    "NANO: nanomaterials, applications, health/environment impacts, social/ethical impacts, nano in India",
    "ROBOTICS & AI: applications, productivity vs unemployment debate, ethical/safety issues",
    "NUCLEAR: nuclear power policy, non-energy applications, radiation impacts, radioactive waste, institutions, nuclear/radiological disasters",
    "BIOTECH: applications, projects, bio-piracy, bioinformatics, biotech & IPR issues, ethical dimensions",
    "RENEWABLE ENERGY: OTEC, green buildings, tidal/wave/geothermal, fuel cells (application + feasibility)",
    "IPR: awareness + policy hooks; IP challenges across biotech/IT/defence (innovation vs access debate)"
  ],
  keywords: [
    "science and technology developments", "applications in everyday life", "indigenisation", "technology development",
    "science policy 1958", "science technology policy 2013", "institutional structure",
    "india world collaboration", "space soft power", "satellite communication", "insat", "gsat", "remote sensing",
    "cryogenic rocket", "outer space treaty", "space activities bill 2017", "space race",
    "it industry", "telecom", "display technologies", "privacy debate", "net neutrality",
    "missile classification", "ballistic missile defence", "uav", "stealth technology", "chemical weapons", "biological weapons",
    "nanotechnology", "nanomaterials", "nano ethics", "robotics", "artificial intelligence", "automation unemployment",
    "nuclear power policy", "radioactive waste", "radiation impact", "radiological disaster",
    "biotechnology applications", "bio piracy", "bioinformatics", "biotech ipr", "ethical dimension biotech",
    "renewable energy", "otec", "green building", "tidal energy", "wave energy", "geothermal", "fuel cell",
    "ipr policy", "intellectual property rights"
  ],
  schemes: []
},
{
  id: "GS3-ST-MAINS-CURRENT",
  name: "Science & Technology: Contemporary Developments & Emerging Technologies",
  tags: ["M", "CA"],
  microThemes: [
    "SPACE current missions: Aditya, Chandrayaan, Gaganyaan, reusable launch vehicles",
    "Space governance: Outer Space Treaty, Space Activities Bill, space debris challenges",
    "Astrophysics & discoveries: gravitational waves, neutrino observatory, navigation systems",
    "ISRO as soft power and socio-economic development tool",
    "Biotechnology & health: TB, HIV transmission, Nipah virus, zoonotic diseases",
    "Genomics & bioethics: genome sequencing, genetic testing, three-parent babies, DNA profiling law",
    "GM food debate, digital biopiracy, secondary patents and pharma policy",
    "Defence technology: missiles, BrahMos, UAVs, submarines, LCA, BMD system",
    "Cyber technologies: IoT, blockchain, cyber-physical systems, authentication technologies",
    "Data governance: data protection, data localisation, digital identity, internet governance",
    "AI & automation: AI and society, robotics implications, robot tax debates",
    "Advanced computing: quantum computing, supercomputing mission, big data",
    "Digital infrastructure: BharatNet, Digital India, e-sign, fintech security",
    "Electronics & telecom policies: net neutrality, national electronics policy, digital communications policy",
    "Biotech ethics & regulation: DNA Technology Bill, genetic discrimination concerns",
    "Public health technology ecosystem: digital health, disease surveillance, geo-mapping",
    "Emerging technologies: Li-Fi, blockchain, hyperloop, hydrogen weapons, nanomedicine",
    "Nuclear & strategic tech: Kudankulam nuclear plant, nuclear safety concerns",
    "Agritech & food security tech: remote sensing for agriculture, cattle tagging, cloud seeding",
    "Science policy & innovation ecosystem: STI policy, INSPIRE scheme, research funding structures"
  ],
  keywords: [
    "gaganyaan", "aditya l1", "chandrayaan", "isro mission",
    "outer space treaty", "space debris", "navigation satellite",
    "gravitational waves", "neutrino observatory",
    "genome sequencing", "dna profiling bill", "genetic testing",
    "gm food debate", "biopiracy", "secondary patent",
    "nipah virus", "tuberculosis", "zoonotic disease",
    "brahmos", "uav", "ballistic missile defence", "light combat aircraft",
    "internet of things", "blockchain", "cyber physical system",
    "data protection", "data localisation", "internet governance",
    "artificial intelligence", "robotics", "automation unemployment",
    "quantum computing", "supercomputing mission", "big data",
    "bharatnet", "digital india", "esign", "fintech security",
    "net neutrality", "electronics policy", "digital communication policy",
    "dna technology bill", "genetic discrimination",
    "digital health", "disease surveillance", "health mapping",
    "li fi technology", "hyperloop", "nanomedicine",
    "kudankulam nuclear", "nuclear safety",
    "remote sensing agriculture", "cloud seeding", "cattle tagging",
    "sti policy", "inspire scheme"
  ],
  schemes: []
}

] // ✅ closes GS3 ScienceTech topics array
} // ✅ closes GS3 ScienceTech section object
] // ✅ closes GS3 ScienceTech sections array
}, // ✅ closes GS3 ScienceTech subject (comma because more subjects can follow inside GS3)
} // ✅ closes GS3 subjects object
}, // ✅ closes GS3 object (comma because GS4 etc come next)

// ===================== GS3 completed =====================

GS4: GS4_2026,
Essay: ESSAY_2026,
CSAT: CSAT_2026,
Optional: OPTIONAL_2026
};

export default SYLLABUS_GRAPH_2026;