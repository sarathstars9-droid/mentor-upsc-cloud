// backend/brain/syllabusOptional.js
// ESM module

const OPTIONAL_2026 = {
  subject: "Geography",
  tags: ["OPT"],

  Paper1: {
    paper: 1,
    name: "Physical Geography + Human Geography (Theory)",
    sections: [
      // ================= I. PHYSICAL GEOGRAPHY =================
      {
        id: "OPT-P1-PHYSICAL",
        name: "Physical Geography",
        tags: ["OPT", "P1"],
        topics: [
          // 1. Geomorphology
          {
            id: "OPT-P1-GEOM",
            name: "Geomorphology",
            tags: ["OPT", "P1"],
            microThemes: [
              "Factors controlling landform development",
              "Endogenetic and exogenetic forces",
              "Origin and evolution of the Earth’s crust",
              "Fundamentals of geomagnetism",
              "Physical conditions of the Earth’s interior",
              "Geosynclines",
              "Continental drift theory",
              "Isostasy",
              "Plate tectonics",
              "Recent views on mountain building",
              "Volcanicity",
              "Earthquakes and tsunamis",
              "Concepts of geomorphic cycles and landscape development",
              "Geomorphology and its relation to economic geology",
              "Geomorphology and its relation to environment",
              "Denudation chronology",
              "Channel morphology",
              "Erosion surfaces",
              "Slope development",
              "Applied geomorphology"
            ],
            keywords: [
              "landform development",
              "endogenetic", "exogenetic",
              "earth crust evolution",
              "geomagnetism",
              "earth interior",
              "geosyncline",
              "continental drift", "wegener",
              "isostasy",
              "plate tectonics",
              "mountain building",
              "volcanicity", "volcano",
              "earthquake", "tsunami",
              "geomorphic cycle",
              "denudation chronology",
              "channel morphology",
              "erosion surface",
              "slope development",
              "applied geomorphology"
            ],
            schemes: []
          },

          // 2. Climatology
          {
            id: "OPT-P1-CLIM",
            name: "Climatology",
            tags: ["OPT", "P1"],
            microThemes: [
              "Temperature and pressure belts of the world",
              "Earth’s heat budget",
              "Atmospheric circulation",
              "Atmospheric stability and instability",
              "Planetary and local winds",
              "Monsoons and jet streams",
              "Air masses and fronts",
              "Temperate and tropical cyclones",
              "Types and distribution of precipitation",
              "Weather and climate distinctions",
              "Classification of world climates: Köppen",
              "Classification of world climates: Thornthwaite",
              "Classification of world climates: Trewartha",
              "Hydrological cycle",
              "Global climatic change",
              "Role and response of humans in climatic changes",
              "Applied climatology",
              "Urban climate"
            ],
            keywords: [
              "temperature belts", "pressure belts",
              "heat budget",
              "atmospheric circulation",
              "stability", "instability",
              "planetary winds", "local winds",
              "monsoon", "jet stream",
              "air mass", "front",
              "temperate cyclone", "tropical cyclone",
              "precipitation types",
              "weather vs climate",
              "koppen", "thornthwaite", "trewartha",
              "hydrological cycle",
              "global climatic change", "climate change",
              "human response climate change",
              "applied climatology",
              "urban climate"
            ],
            schemes: []
          },

          // 3. Oceanography
          {
            id: "OPT-P1-OCEAN",
            name: "Oceanography",
            tags: ["OPT", "P1"],
            microThemes: [
              "Bottom topography of Atlantic, Indian and Pacific Oceans",
              "Temperature and salinity of the oceans",
              "Heat and salt budgets",
              "Ocean deposits and their types",
              "Waves, currents and tides — causes and patterns",
              "Marine resources: biotic resources (fisheries)",
              "Marine resources: mineral resources (manganese nodules, petroleum)",
              "Marine resources: energy resources (tidal, wave, OTEC)",
              "Coral reefs and coral bleaching",
              "Sea-level changes — causes and impacts",
              "Law of the Sea — maritime boundaries, EEZ",
              "Marine pollution — sources, effects and control"
            ],
            keywords: [
              "ocean bottom topography",
              "ocean temperature", "salinity",
              "heat budget ocean", "salt budget",
              "ocean deposits",
              "waves", "ocean currents", "tides",
              "fisheries", "marine biotic resources",
              "manganese nodules", "offshore petroleum",
              "tidal energy", "wave energy", "otec",
              "coral reef", "coral bleaching",
              "sea level change",
              "law of the sea", "eez",
              "marine pollution"
            ],
            schemes: []
          },

          // 4. Biogeography (soils + plants/animals)
          {
            id: "OPT-P1-BIOGEO",
            name: "Biogeography",
            tags: ["OPT", "P1"],
            microThemes: [
              "Genesis of soils — soil formation processes",
              "Classification and distribution of soils globally",
              "Soil profile and horizons",
              "Soil erosion, degradation and conservation techniques",
              "Factors influencing world distribution of plants and animals",
              "Deforestation problems and conservation measures",
              "Social forestry and agro-forestry practices",
              "Wildlife and biodiversity conservation",
              "Major gene pool centers — global biodiversity hotspots"
            ],
            keywords: [
              "soil genesis", "soil formation", "pedogenesis",
              "soil classification", "soil distribution",
              "soil profile", "horizons",
              "soil erosion", "soil degradation", "soil conservation",
              "plant distribution", "animal distribution",
              "deforestation",
              "social forestry", "agro forestry",
              "wildlife conservation",
              "biodiversity conservation",
              "gene pool centers",
              "biodiversity hotspots"
            ],
            schemes: []
          },

          // 5. Environmental Geography
          {
            id: "OPT-P1-ENVGEO",
            name: "Environmental Geography",
            tags: ["OPT", "P1"],
            microThemes: [
              "Principles of ecology",
              "Human ecological adaptations across environments",
              "Human influence on ecology and environment",
              "Global and regional ecological changes and imbalances",
              "Ecosystems — management and conservation",
              "Environmental degradation — causes, management and restoration",
              "Biodiversity and sustainable development",
              "Environmental policy frameworks",
              "Environmental hazards — natural and human-induced, and remedies",
              "Environmental education and legislation — global and Indian context"
            ],
            keywords: [
              "ecology principles",
              "human ecological adaptation",
              "human impact environment",
              "ecological imbalance",
              "ecosystem management", "ecosystem conservation",
              "environmental degradation", "restoration",
              "biodiversity", "sustainable development",
              "environmental policy",
              "environmental hazards",
              "environmental education",
              "environmental legislation"
            ],
            schemes: []
          }
        ]
      },

      // ================= II. HUMAN GEOGRAPHY =================
      {
        id: "OPT-P1-HUMAN",
        name: "Human Geography",
        tags: ["OPT", "P1"],
        topics: [
          // 1. Perspectives in Human Geography
          {
            id: "OPT-P1-HG-PERSPECTIVES",
            name: "Perspectives in Human Geography",
            tags: ["OPT", "P1"],
            microThemes: [
              "Areal differentiation — spatial variation and uniqueness of regions",
              "Regional synthesis — integrating physical and human aspects",
              "Dichotomy and dualism — physical vs human; idiographic vs nomothetic",
              "Environmentalism — man–environment relationship through time",
              "Quantitative revolution and locational analysis",
              "Radical geography (Marxist perspective)",
              "Behavioral geography (human perception & decision-making)",
              "Humanistic geography (experience & meaning of place)",
              "Welfare geography (spatial inequality & social justice)",
              "Cultural geography: languages and religions",
              "Secularisation trends",
              "Cultural regions of the world",
              "Human Development Index (HDI) — measurement and patterns"
            ],
            keywords: [
              "areal differentiation",
              "regional synthesis",
              "dualism", "dichotomy",
              "idiographic", "nomothetic",
              "man environment relationship",
              "quantitative revolution",
              "locational analysis",
              "radical geography", "marxist",
              "behavioral geography",
              "humanistic geography",
              "welfare geography",
              "cultural geography",
              "secularisation",
              "cultural regions",
              "hdi", "human development index"
            ],
            schemes: []
          },

          // 2. Economic Geography
          {
            id: "OPT-P1-ECOGEO",
            name: "Economic Geography",
            tags: ["OPT", "P1"],
            microThemes: [
              "World distribution of natural resources — minerals, energy, biotic, marine",
              "Power resources — fossil fuels, hydro, nuclear, renewable",
              "World industries — locational patterns (iron & steel, textiles, chemicals)",
              "Agricultural systems of the world",
              "World trade patterns — commodities and routes",
              "Globalization and world economy"
            ],
            keywords: [
              "natural resources", "mineral resources", "energy resources",
              "power resources", "fossil fuel", "hydro power", "nuclear energy", "renewable energy",
              "iron and steel industry", "textile industry", "chemical industry",
              "industrial location", "world trade", "trade routes",
              "agricultural system", "globalization", "world economy",
              "venezuela oil", "opec", "economic geography"
            ],
            schemes: []
          },

          // 3. Models, Theories and Laws in Human Geography
          {
            id: "OPT-P1-MODELS",
            name: "Models, Theories and Laws in Human Geography",
            tags: ["OPT", "P1"],
            microThemes: [
              "Models of Development — Rostow's stages of growth",
              "Central Place Theory — Christaller and Losch",
              "Von Thunen's agricultural land use model",
              "Weber's industrial location theory",
              "Gravity model and potential model",
              "Heartland and Rimland theories",
              "Demographic transition model",
              "Core-periphery model (Friedmann)",
              "Bid-rent theory",
              "Laws of retail gravitation (Reilly)"
            ],
            keywords: [
              "rostow stages", "take off stage",
              "central place theory", "christaller", "losch",
              "von thunen", "agricultural location",
              "weber location theory",
              "gravity model", "potential model",
              "heartland theory", "rimland theory",
              "demographic transition",
              "core periphery", "friedmann",
              "bid rent",
              "reilly retail gravitation",
              "models human geography", "theories human geography"
            ],
            schemes: []
          },

          // 4. Settlement Geography
          {
            id: "OPT-P1-SETTLEMENT",
            name: "Settlement Geography",
            tags: ["OPT", "P1"],
            microThemes: [
              "Rural settlements: types and patterns (clustered, dispersed, linear etc.)",
              "Environmental issues in rural settlements",
              "Urban settlements: hierarchy of urban centres",
              "Urban morphology",
              "Primate city and rank-size rule",
              "Functional classification of towns",
              "Sphere of urban influence",
              "Rural–urban fringe and satellite towns",
              "Urbanization: problems and remedies",
              "Sustainable development of cities"
            ],
            keywords: [
              "rural settlement", "settlement pattern",
              "clustered settlement", "dispersed settlement", "linear settlement",
              "urban hierarchy",
              "urban morphology",
              "primate city",
              "rank size rule",
              "functional classification of towns",
              "sphere of influence",
              "rural urban fringe",
              "satellite towns",
              "urbanization problems",
              "sustainable cities"
            ],
            schemes: []
          },

          // 3. Regional Planning
          {
            id: "OPT-P1-REGIONAL-PLANNING",
            name: "Regional Planning",
            tags: ["OPT", "P1"],
            microThemes: [
              "Concept and importance of a region in geography",
              "Types of regions — formal, functional, perceptual",
              "Methods of regionalization — quantitative & qualitative",
              "Growth centres and growth poles — core-periphery interactions",
              "Regional imbalances — causes and spatial inequalities",
              "Regional development strategies — balanced and unbalanced growth",
              "Environmental issues in regional planning",
              "Planning for sustainable development — integrating ecology, economy and society"
            ],
            keywords: [
              "region concept",
              "formal region", "functional region", "perceptual region",
              "regionalization methods",
              "growth centre", "growth pole",
              "core periphery",
              "regional imbalance",
              "balanced growth", "unbalanced growth",
              "regional development strategy",
              "environment in planning",
              "sustainable regional planning"
            ],
            schemes: []
          }
        ]
      }
    ]
  },

  Paper2: {
    paper: 2,
    name: "Geography of India",
    sections: [
      // 1. Physical Setting & Resource Base
      {
        id: "OPT-P2-PHYSICAL-RES",
        name: "Physical Setting & Resource Base",
        tags: ["OPT", "P2"],
        topics: [
          {
            id: "OPT-P2-INDIA-PHYS",
            name: "Physical Setting of India",
            tags: ["OPT", "P2"],
            microThemes: [
              "Space relationship of India with neighboring countries",
              "Structure and relief; Physiographic regions (Himalayas, Peninsular Block, Indo-Gangetic Plains)",
              "Drainage system and watersheds",
              "Mechanism of Indian monsoons and rainfall patterns; Western disturbances",
              "Tropical cyclones, floods, droughts",
              "Natural vegetation and soil types"
            ],
            keywords: [
              "india neighbours", "space relationship",
              "physiographic regions",
              "himalayas", "peninsular block", "indo gangetic plain",
              "drainage", "watershed",
              "indian monsoon mechanism",
              "western disturbances",
              "tropical cyclones", "flood", "drought",
              "natural vegetation india",
              "soil types india"
            ],
            schemes: []
          },
          {
            id: "OPT-P2-RESOURCES",
            name: "Resource Base",
            tags: ["OPT", "P2"],
            microThemes: [
              "Land resources",
              "Surface and groundwater resources",
              "Energy resources",
              "Mineral resources",
              "Marine resources",
              "Forest and wildlife resources; conservation strategies"
            ],
            keywords: [
              "land resources",
              "surface water", "groundwater",
              "energy resources",
              "mineral resources",
              "marine resources",
              "forest resources", "wildlife resources",
              "conservation strategies"
            ],
            schemes: []
          }
        ]
      },

      // 2. Economy: Agriculture & Industry
      {
        id: "OPT-P2-AGRI-IND",
        name: "Economy: Agriculture & Industry",
        tags: ["OPT", "P2"],
        topics: [
          {
            id: "OPT-P2-AGRI",
            name: "Agriculture",
            tags: ["OPT", "P2"],
            microThemes: [
              "Infrastructure: irrigation, seeds, fertilizers, power",
              "Institutional factors: land holdings, tenure, reforms",
              "Cropping patterns and agricultural intensity",
              "Green Revolution: socio-economic and ecological implications",
              "Dry farming, livestock (White Revolution), aquaculture",
              "Agro-climatic and agro-ecological regions"
            ],
            keywords: [
              "irrigation", "seeds", "fertilizers", "agri power",
              "land holding", "tenure", "land reforms",
              "cropping pattern", "agricultural intensity",
              "green revolution",
              "dry farming",
              "white revolution",
              "aquaculture",
              "agro climatic regions", "agro ecological regions"
            ],
            schemes: []
          },
          {
            id: "OPT-P2-INDUSTRY",
            name: "Industry",
            tags: ["OPT", "P2"],
            microThemes: [
              "Evolution and locational factors of major industries (Iron & Steel, Cotton Textiles, Chemicals, Pharmaceuticals, Automobile)",
              "Industrial houses, complexes, PSUs",
              "Industrial regionalization and New Industrial Policy",
              "Impact of MNCs, Liberalization and SEZs",
              "Tourism and Eco-tourism"
            ],
            keywords: [
              "industrial location factors",
              "iron and steel industry",
              "cotton textile industry",
              "chemical industry",
              "pharmaceutical industry",
              "automobile industry",
              "industrial houses",
              "industrial complex",
              "psu",
              "industrial regionalization",
              "new industrial policy",
              "mnc impact",
              "liberalization",
              "sez",
              "tourism",
              "eco tourism"
            ],
            schemes: []
          }
        ]
      },

      // 3. Infrastructure & Cultural Setting
      {
        id: "OPT-P2-INFRA-CULTURE",
        name: "Infrastructure & Cultural Setting",
        tags: ["OPT", "P2"],
        topics: [
          {
            id: "OPT-P2-TRANSPORT-TRADE",
            name: "Transport & Trade",
            tags: ["OPT", "P2"],
            microThemes: [
              "Road, railway, waterway, airway and pipeline networks",
              "Role of ports in national and foreign trade",
              "Trade balance and Trade Policy",
              "Developments in IT and communication; Indian Space Programme"
            ],
            keywords: [
              "road network", "railway network",
              "inland waterways", "airways",
              "pipeline network",
              "ports",
              "foreign trade",
              "trade balance", "trade policy",
              "it communication",
              "indian space programme"
            ],
            schemes: []
          },
          {
            id: "OPT-P2-CULTURAL",
            name: "Cultural Setting",
            tags: ["OPT", "P2"],
            microThemes: [
              "Historical perspective of Indian society",
              "Racial, linguistic and ethnic diversities; Religious minorities",
              "Major tribes and tribal area problems",
              "Demographic attributes: growth, density, sex ratio, age structure, literacy",
              "Migration patterns (inter-regional and international)",
              "Population problems and health indicators"
            ],
            keywords: [
              "indian society historical perspective",
              "racial diversity", "linguistic diversity", "ethnic diversity",
              "religious minorities",
              "tribes", "tribal problems",
              "population growth", "density", "sex ratio", "literacy",
              "migration", "international migration",
              "population problems", "health indicators"
            ],
            schemes: []
          }
        ]
      },

      // 4. Settlements & Regional Development
      {
        id: "OPT-P2-SETTLE-REGDEV",
        name: "Settlements & Regional Development",
        tags: ["OPT", "P2"],
        topics: [
          {
            id: "OPT-P2-SETTLEMENTS",
            name: "Settlements in India",
            tags: ["OPT", "P2"],
            microThemes: [
              "Types, patterns and morphology of rural settlements",
              "Urban development and morphology of Indian cities",
              "Functional classification of Indian cities",
              "Conurbations, metropolitan regions and urban sprawl",
              "Slums, town planning and sustainable urbanization"
            ],
            keywords: [
              "rural settlement morphology",
              "urban morphology india",
              "functional classification cities",
              "conurbation",
              "metropolitan region",
              "urban sprawl",
              "slums",
              "town planning",
              "sustainable urbanization"
            ],
            schemes: []
          },
          {
            id: "OPT-P2-REGIONAL-DEV",
            name: "Regional Development & Planning in India",
            tags: ["OPT", "P2"],
            microThemes: [
              "Experience of regional planning in India; Five Year Plans",
              "Integrated rural development and Panchayati Raj",
              "Command area development and watershed management",
              "Planning for backward areas (hill, tribal, desert, drought-prone)",
              "Multi-level planning and development of island territories"
            ],
            keywords: [
              "regional planning india",
              "five year plans",
              "integrated rural development",
              "panchayati raj",
              "command area development",
              "watershed management",
              "backward areas planning",
              "hill areas", "tribal areas", "desert areas", "drought prone",
              "multi level planning",
              "island territories"
            ],
            schemes: []
          }
        ]
      },

      // 5. Political Aspects & Contemporary Issues
      {
        id: "OPT-P2-POLITY-CONTEMP",
        name: "Political Aspects & Contemporary Issues",
        tags: ["OPT", "P2"],
        topics: [
          {
            id: "OPT-P2-POLITICAL",
            name: "Political Aspects",
            tags: ["OPT", "P2"],
            microThemes: [
              "Geographical basis of Indian federalism; State reorganization",
              "Regional consciousness and inter-state issues",
              "International boundaries and cross-border terrorism",
              "India’s role in world affairs; Geopolitics of South Asia and Indian Ocean"
            ],
            keywords: [
              "geographical basis federalism",
              "state reorganization",
              "regional consciousness",
              "inter state issues",
              "international boundaries",
              "cross border terrorism",
              "geopolitics south asia",
              "indian ocean geopolitics"
            ],
            schemes: []
          },
          {
            id: "OPT-P2-CONTEMP",
            name: "Contemporary Issues",
            tags: ["OPT", "P2", "CA"],
            microThemes: [
              "Environmental hazards: landslides, earthquakes, tsunamis, epidemics",
              "Pollution and land use changes",
              "Principles of Environmental Impact Assessment (EIA)",
              "Food security, deforestation and desertification",
              "Regional disparities in economic development",
              "Linkage of rivers and Globalization"
            ],
            keywords: [
              "landslide", "earthquake", "tsunami", "epidemic",
              "pollution",
              "land use change",
              "eia", "environmental impact assessment",
              "food security",
              "deforestation",
              "desertification",
              "regional disparity",
              "river linking",
              "globalization"
            ],
            schemes: []
          }
        ]
      }
    ]
  },

  // ===== Mentor OS Bridge Rules (Paper1 -> Paper2 prompts) =====
  Bridges: [
    {
      id: "BRIDGE-CLIM-CYC",
      from: "Paper1: Temperate cyclones",
      to: "Paper2: Western Disturbances",
      hint: "After temperate cyclones, prompt WD mechanism + rainfall + impacts on Rabi + map."
    },
    {
      id: "BRIDGE-CLIM-MONSOON",
      from: "Paper1: Monsoons & Jet Streams",
      to: "Paper2: Mechanism of Indian monsoon + rainfall patterns",
      hint: "Prompt onset/withdrawal, breaks, jet streams, ENSO/IOD references."
    },
    {
      id: "BRIDGE-GEOM-TECTONICS",
      from: "Paper1: Plate tectonics",
      to: "Paper2: Himalayas physiography + earthquakes + landslides",
      hint: "Prompt seismotectonics of Himalaya + hazard mapping."
    },
    {
      id: "BRIDGE-HYDRO-CYCLE",
      from: "Paper1: Hydrological cycle",
      to: "Paper2: Drainage, watersheds, watershed management",
      hint: "Prompt basin-level diagrams + Indian examples."
    },
    {
      id: "BRIDGE-SETTLEMENT-URBAN",
      from: "Paper1: Rank-size rule / primate city",
      to: "Paper2: Urban morphology + conurbations + metro regions + slums",
      hint: "Prompt Indian city examples + sketch maps."
    }
  ]
};

export default OPTIONAL_2026;