/**
 * PRELIMS NODE RESOLVER
 * ----------------------
 * Single backend authority for mapping frontend prelims selections
 * (subjectId, topicId, subtopicIds) to real node IDs from pyq_by_node.json.
 *
 * All node IDs listed here are verified against pyq_by_node.json.
 * autoNodeResolver is NOT used here — this is fully data-driven and deterministic.
 *
 * Priority: subtopic → topic → subject
 * Fallback to autoNodeResolver is handled by the caller (server.js), not here.
 */

// ---------------------------------------------------------------------------
// SUBJECT-LEVEL: all nodes for each subject (verified in pyq_by_node.json)
// ---------------------------------------------------------------------------
const SUBJECT_NODES = {
    economy: [
        "GS3-ECO-PRE-BANKING-STRUCTURE",
        "GS3-ECO-PRE-MONEY-BASICS",
        "GS3-ECO-PRE-INFLATION",
        "GS3-ECO-PRE-BUDGET",
        "GS3-ECO-PRE-TAX",
        "GS3-ECO-PRE-FIN-MARKETS",
        "GS3-ECO-PRE-BOP",
        "GS3-ECO-PRE-GROWTH",
        "GS3-ECO-PRE-POVERTY",
        "GS3-ECO-SECT-INFRA",
        "GS3-ECO-SECT-INDLAB",
        "GS3-ECO-SECT-AGRI",
    ],
    history: [
        "GS1-HIS-ANC-BUD",
        "GS1-HIS-ANC-GUPTA",
        "GS1-HIS-ANC-IVC",
        "GS1-HIS-ANC-JAIN",
        "GS1-HIS-ANC-MAURYA",
        "GS1-HIS-ANC-PREHIST",
        "GS1-HIS-ANC-SANGAM",
        "GS1-HIS-ANC-VEDIC-LATER",
        "GS1-HIS-MED-BHAKTI",
        "GS1-HIS-MED-DELHI",
        "GS1-HIS-MED-MUGHAL",
        "GS1-HIS-MED-REGIONAL",
        "GS1-HIS-MED-VIJAYANAGARA",
        "GS1-HIS-MOD-1857",
        "GS1-HIS-MOD-ADMIN",
        "GS1-HIS-MOD-EURO",
        "GS1-HIS-MOD-EXPANSION",
        "GS1-HIS-MOD-NATIONAL",
        "GS1-HIS-MOD-REFORM",
    ],
    // Culture uses 1C-* nodes — hyphen-separated, matching pyq_by_node.json keys.
    culture: [
        "1C-VA-ARCH",
        "1C-VA-PAINT",
        "1C-PA-DANCE",
        "1C-PA-MUSIC",
        "1C-PA-THEATRE",
        "1C-PA-SPORTS",
        "1C-RLL-LANG",
        "1C-RLL-RELIGION",
        "1C-MISC-INST",
        "1C-MISC-SCHEMES",
        "1C-MISC-GI",
    ],
    geography: [
        "GS1-GEO-CLIM-SYSTEMS",
        "GS1-GEO-GEN-UNIVERSE",
        "GS1-GEO-GM-LANDFORMS",
        "GS1-GEO-HEW-ACTIVITIES",
        "GS1-GEO-IND-AGRI",
        "GS1-GEO-IND-CLIMATE",
        "GS1-GEO-IND-DRAINAGE",
        "GS1-GEO-IND-PHYSIO",
        "GS1-GEO-IND-POP-URBAN",
        "GS1-GEO-IND-RESOURCES",
        "GS1-GEO-IND-SOILS-VEG",
        "GS1-GEO-OCE-MOTIONS",
        "GS1-GEO-PRE-REGIONAL-PLACES",
    ],
    polity: [
        "GS2-POL-AMEND",
        // GS2-POL-CONTEMP removed — node does not exist in pyq_by_node.json
        "GS2-POL-CSREL",
        "GS2-POL-DPSP",
        "GS2-POL-ELECTIONS",
        "GS2-POL-EXEC",
        "GS2-POL-FR",
        "GS2-POL-JUD",
        "GS2-POL-PARL",
        "GS2-POL-PREAMBLE",
    ],
    environment: [
        "GS3-ENV-ACTS",
        "GS3-ENV-BIOGEO",
        "GS3-ENV-CLIMATEPHEN",
        "GS3-ENV-CONSERVATION",
        "GS3-ENV-CURR-CLIMATE",
        "GS3-ENV-CURR-POLLUTION",
        "GS3-ENV-ECO-CONCEPTS",
        "GS3-ENV-ENERGY",
        "GS3-ENV-INTL",
    ],
    science_tech: [
        "GS3-ST-BIOTECH",
        "GS3-ST-DEFENCE",
        "GS3-ST-GENSCI-BIO",
        "GS3-ST-IPR",
        "GS3-ST-IT-COMM",
        "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
        "GS3-ST-NUCLEAR",
        "GS3-ST-SPACE",
    ],
    ir: [
        "GS2-IR-ASEAN-EAP",
        "GS2-IR-CLIMATE-DISARM",
        // GS2-IR-CONTEMP removed — node does not exist in pyq_by_node.json
        "GS2-IR-GROUPINGS",
        "GS2-IR-INSTITUTIONS",
        "GS2-IR-WEST-ASIA",
    ],
    current_affairs_misc: [
        "1C-MISC-GI",
        "1C-MISC-INST",
        "1C-MISC-SCHEMES",
        "1C-MISC-UNESCO",
    ],
    // CSAT quant: all BN (basic numerics) + DI nodes
    csat_quant: [
        "CSAT-BN-NS",
        "CSAT-BN-PNC",
        "CSAT-BN-PERCENT",
        "CSAT-BN-AVG-MIX",
        "CSAT-BN-MENS",
        "CSAT-BN-TSD",
        "CSAT-BN-TWP",
        "CSAT-BN-TRAINS",
        "CSAT-BN-AGES",
        "CSAT-BN-PLD",
        "CSAT-BN-RATIO",
        "CSAT-BN-APGP",
        "CSAT-BN-INT",
        "CSAT-BN-PROB",
        "CSAT-BN-LCMHCF",
        "CSAT-DI-MIXED",
        "CSAT-DI-TABLES",
        "CSAT-DI-BAR",
        "CSAT-DI-LINE",
        "CSAT-DI-PIE",
    ],
    // CSAT reasoning: all LR nodes
    csat_reasoning: [
        "CSAT-LR-BLOOD",
        "CSAT-LR-CALENDAR",
        "CSAT-LR-CLOCK",
        "CSAT-LR-CODE",
        "CSAT-LR-COMPLEX",
        "CSAT-LR-CUBE",
        "CSAT-LR-DIR",
        "CSAT-LR-LSER",
        "CSAT-LR-MISC",
        "CSAT-LR-NSER",
        "CSAT-LR-RANK",
        "CSAT-LR-SELECT",
        "CSAT-LR-SIT",
        "CSAT-LR-SYL",
        "CSAT-LR-VENN",
        "CSAT-LR-VISUAL",
    ],
    csat_rc: [
        "CSAT-RC-ASSUMP",
        "CSAT-RC-CONCL",
        "CSAT-RC-FACT",
        "CSAT-RC-INFER",
        "CSAT-RC-MAIN",
        "CSAT-RC-MISC",
        "CSAT-RC-STRENGTH",
        "CSAT-RC-TONE",
        "CSAT-RC-WEAKEN",
        "CSAT-RC-THEME",
    ],
};

// ---------------------------------------------------------------------------
// TOPIC-LEVEL: subjectId → topicId → nodeIds[]
// ---------------------------------------------------------------------------
const TOPIC_NODES = {
    economy: {
        banking_monetary:   ["GS3-ECO-PRE-BANKING-STRUCTURE", "GS3-ECO-PRE-MONEY-BASICS"],
        inflation_fiscal:   ["GS3-ECO-PRE-INFLATION"],
        budget:             ["GS3-ECO-PRE-BUDGET"],
        taxation:           ["GS3-ECO-PRE-TAX"],
        financial_markets:  ["GS3-ECO-PRE-FIN-MARKETS"],
        external_sector:    ["GS3-ECO-PRE-BOP"],
        growth_development: ["GS3-ECO-PRE-GROWTH"],
        poverty_inclusion:  ["GS3-ECO-PRE-POVERTY"],
        infrastructure:     ["GS3-ECO-SECT-INFRA"],
        industry_labour:    ["GS3-ECO-SECT-INDLAB"],
        agriculture:        ["GS3-ECO-SECT-AGRI"],
    },
    history: {
        ancient_history: [
            "GS1-HIS-ANC-BUD", "GS1-HIS-ANC-GUPTA", "GS1-HIS-ANC-IVC",
            "GS1-HIS-ANC-JAIN", "GS1-HIS-ANC-MAURYA", "GS1-HIS-ANC-PREHIST",
            "GS1-HIS-ANC-SANGAM", "GS1-HIS-ANC-VEDIC-LATER",
        ],
        medieval_history: [
            "GS1-HIS-MED-BHAKTI", "GS1-HIS-MED-DELHI", "GS1-HIS-MED-MUGHAL",
            "GS1-HIS-MED-REGIONAL", "GS1-HIS-MED-VIJAYANAGARA",
        ],
        modern_history: [
            "GS1-HIS-MOD-1857", "GS1-HIS-MOD-ADMIN", "GS1-HIS-MOD-EURO",
            "GS1-HIS-MOD-EXPANSION", "GS1-HIS-MOD-NATIONAL", "GS1-HIS-MOD-REFORM",
        ],
    },
    culture: {
        architecture:   ["1C-VA-ARCH"],
        sculpture:      ["1C-VA-ARCH"],    // no separate sculpture node in index
        painting:       ["1C-VA-PAINT"],
        literature:     ["1C-RLL-LANG", "1C-RLL-RELIGION"],
        religion:       ["1C-RLL-RELIGION"],
        performing_arts: ["1C-PA-DANCE", "1C-PA-MUSIC", "1C-PA-THEATRE"],
    },
    geography: {
        indian_geography: [
            "GS1-GEO-IND-AGRI", "GS1-GEO-IND-CLIMATE", "GS1-GEO-IND-DRAINAGE",
            "GS1-GEO-IND-PHYSIO", "GS1-GEO-IND-POP-URBAN", "GS1-GEO-IND-RESOURCES",
            "GS1-GEO-IND-SOILS-VEG",
        ],
        world_geography: [
            "GS1-GEO-GM-LANDFORMS", "GS1-GEO-CLIM-SYSTEMS", "GS1-GEO-PRE-REGIONAL-PLACES",
            "GS1-GEO-GEN-UNIVERSE", "GS1-GEO-OCE-MOTIONS", "GS1-GEO-HEW-ACTIVITIES",
        ],
    },
    polity: {
        // GS2-POL-CONTEMP does not exist in pyq_by_node — mapped to PARL (nearest available)
        constitutional_bodies:     ["GS2-POL-ELECTIONS", "GS2-POL-PARL", "GS2-POL-JUD"],
        non_constitutional_bodies: ["GS2-POL-PARL"],
        executive:                 ["GS2-POL-EXEC"],
        legislature:               ["GS2-POL-PARL"],
        judiciary:                 ["GS2-POL-JUD"],
        federalism:                ["GS2-POL-CSREL"],
        elections:                 ["GS2-POL-ELECTIONS"],
        amendments:                ["GS2-POL-AMEND"],
        fundamental_rights:        ["GS2-POL-FR"],
        dpsp_duties:               ["GS2-POL-DPSP"],
        governance:                ["GS2-POL-PARL"],
    },
    environment: {
        biodiversity:               ["GS3-ENV-BIOGEO", "GS3-ENV-CONSERVATION"],
        species_in_news:            ["GS3-ENV-BIOGEO"],
        climate_change:             ["GS3-ENV-CLIMATEPHEN", "GS3-ENV-CURR-CLIMATE"],
        ecology_concepts:           ["GS3-ENV-ECO-CONCEPTS"],
        environmental_conventions:  ["GS3-ENV-INTL"],
        pollution:                  ["GS3-ENV-CURR-POLLUTION"],
        protected_areas:            ["GS3-ENV-CONSERVATION"],
    },
    science_tech: {
        space:           ["GS3-ST-SPACE"],
        biotechnology:   ["GS3-ST-BIOTECH"],
        defence_tech:    ["GS3-ST-DEFENCE"],
        it_ai:           ["GS3-ST-IT-COMM", "GS3-ST-MATERIALS-NANO-ROBOTICS-AI"],
        health_diseases: ["GS3-ST-GENSCI-BIO"],
        misc_tech:       ["GS3-ST-MATERIALS-NANO-ROBOTICS-AI", "GS3-ST-NUCLEAR"],
    },
    ir: {
        organizations:      ["GS2-IR-INSTITUTIONS", "GS2-IR-GROUPINGS"],
        // GS2-IR-CONTEMP does not exist in pyq_by_node — use GROUPINGS + INSTITUTIONS
        bilateral_relations: ["GS2-IR-GROUPINGS", "GS2-IR-INSTITUTIONS", "GS2-IR-ASEAN-EAP"],
        groupings:          ["GS2-IR-GROUPINGS"],
        agreements:         ["GS2-IR-CLIMATE-DISARM"],
    },
    current_affairs_misc: {
        reports_indices: ["1C-MISC-GI", "1C-MISC-INST"],
        schemes:         ["1C-MISC-SCHEMES", "1C-MISC-INST"],
        places_in_news:  ["1C-MISC-INST"],
        awards:          ["1C-MISC-INST"],
        misc:            ["1C-MISC-INST"],
    },
    csat_quant: {
        number_system:              ["CSAT-BN-NS"],
        permutations_combinations:  ["CSAT-BN-PNC"],
        percentage:                 ["CSAT-BN-PERCENT"],
        data_interpretation:        ["CSAT-DI-MIXED", "CSAT-DI-TABLES", "CSAT-DI-BAR", "CSAT-DI-LINE", "CSAT-DI-PIE"],
        avg_mixture:                ["CSAT-BN-AVG-MIX"],
        mensuration:                ["CSAT-BN-MENS"],
        tsd_tw:                     ["CSAT-BN-TSD", "CSAT-BN-TWP", "CSAT-BN-TRAINS"],
        misc_quant:                 ["CSAT-BN-AGES", "CSAT-BN-PLD", "CSAT-BN-RATIO", "CSAT-BN-APGP", "CSAT-BN-INT", "CSAT-BN-PROB", "CSAT-BN-LCMHCF"],
    },
    csat_reasoning: {
        puzzles_complex:  ["CSAT-LR-COMPLEX"],
        blood_relations:  ["CSAT-LR-BLOOD"],
        syllogism:        ["CSAT-LR-SYL"],
        number_series:    ["CSAT-LR-NSER"],
        non_verbal:       ["CSAT-LR-VISUAL"],
        cube_dice:        ["CSAT-LR-CUBE"],
        ranking:          ["CSAT-LR-RANK"],
        coding_decoding:  ["CSAT-LR-CODE"],
        venn_diagrams:    ["CSAT-LR-VENN"],
        direction_sense:  ["CSAT-LR-DIR"],
        calendar_clock:   ["CSAT-LR-CALENDAR", "CSAT-LR-CLOCK"],
        misc_lr:          ["CSAT-LR-LSER", "CSAT-LR-SIT", "CSAT-LR-SELECT", "CSAT-LR-MISC"],
    },
    csat_rc: {
        reading_comprehension: [
            "CSAT-RC-ASSUMP", "CSAT-RC-CONCL", "CSAT-RC-FACT",
            "CSAT-RC-INFER", "CSAT-RC-MAIN", "CSAT-RC-MISC",
            "CSAT-RC-STRENGTH", "CSAT-RC-TONE", "CSAT-RC-WEAKEN", "CSAT-RC-THEME",
        ],
        assumption:          ["CSAT-RC-ASSUMP"],
        conclusion:          ["CSAT-RC-CONCL"],
        fact_opinion:        ["CSAT-RC-FACT"],
        inference:           ["CSAT-RC-INFER"],
        main_idea:           ["CSAT-RC-MAIN"],
        strengthen_weaken:   ["CSAT-RC-STRENGTH", "CSAT-RC-WEAKEN"],
        tone_attitude:       ["CSAT-RC-TONE"],
        theme_title:         ["CSAT-RC-THEME"],
        misc_rc:             ["CSAT-RC-MISC"],
    },
};

// ---------------------------------------------------------------------------
// SUBTOPIC-LEVEL: subjectId → topicId → subtopicId → nodeIds[]
// ---------------------------------------------------------------------------
const SUBTOPIC_NODES = {
    economy: {
        banking_monetary: {
            rbi:              ["GS3-ECO-PRE-BANKING-STRUCTURE"],
            npa_basel:        ["GS3-ECO-PRE-BANKING-STRUCTURE"],
            repo_reverse_repo: ["GS3-ECO-PRE-MONEY-BASICS"],
            mpc:              ["GS3-ECO-PRE-MONEY-BASICS"],
            money_basics:     ["GS3-ECO-PRE-MONEY-BASICS"],
        },
        inflation_fiscal: {
            inflation:        ["GS3-ECO-PRE-INFLATION"],
            fiscal_deficit:   ["GS3-ECO-PRE-BUDGET"],
            subsidies:        ["GS3-ECO-PRE-BUDGET"],
        },
        budget: {
            budgeting_basics:      ["GS3-ECO-PRE-BUDGET"],
            receipts_expenditure:  ["GS3-ECO-PRE-BUDGET"],
            budget_terms:          ["GS3-ECO-PRE-BUDGET"],
        },
        taxation: {
            direct_tax:    ["GS3-ECO-PRE-TAX"],
            indirect_tax:  ["GS3-ECO-PRE-TAX"],
            gst:           ["GS3-ECO-PRE-TAX"],
        },
        financial_markets: {
            capital_market: ["GS3-ECO-PRE-FIN-MARKETS"],
            money_market:   ["GS3-ECO-PRE-FIN-MARKETS"],
            sebi:           ["GS3-ECO-PRE-FIN-MARKETS"],
        },
        external_sector: {
            bop:          ["GS3-ECO-PRE-BOP"],
            forex:        ["GS3-ECO-PRE-MONEY-BASICS"],
            trade_policy: ["GS3-ECO-PRE-BOP"],
        },
        growth_development: {
            gdp_gnp:           ["GS3-ECO-PRE-GROWTH"],
            human_development: ["GS3-ECO-PRE-GROWTH"],
            inclusive_growth:  ["GS3-ECO-PRE-GROWTH"],
        },
        poverty_inclusion: {
            poverty:             ["GS3-ECO-PRE-POVERTY"],
            financial_inclusion: ["GS3-ECO-PRE-POVERTY"],
            welfare:             ["GS3-ECO-PRE-POVERTY"],
        },
        infrastructure: {
            energy:          ["GS3-ECO-SECT-INFRA"],
            transport_urban: ["GS3-ECO-SECT-INFRA"],
        },
        industry_labour: {
            manufacturing: ["GS3-ECO-SECT-INDLAB"],
            labour_msme:   ["GS3-ECO-SECT-INDLAB"],
        },
        agriculture: {
            agri_sector: ["GS3-ECO-SECT-AGRI"],
        },
    },
    history: {
        ancient_history: {
            ivc:                    ["GS1-HIS-ANC-IVC"],
            vedic_age:              ["GS1-HIS-ANC-VEDIC-LATER"],
            mahajanapadas_mauryas:  ["GS1-HIS-ANC-MAURYA"],
        },
        medieval_history: {
            delhi_sultanate:   ["GS1-HIS-MED-DELHI"],
            mughals:           ["GS1-HIS-MED-MUGHAL"],
            bhakti_sufi_history: ["GS1-HIS-MED-BHAKTI"],
        },
        modern_history: {
            british_expansion:      ["GS1-HIS-MOD-EXPANSION"],
            freedom_movement:       ["GS1-HIS-MOD-NATIONAL"],
            governor_general_acts:  ["GS1-HIS-MOD-ADMIN"],
        },
    },
    culture: {
        architecture: {
            temple_architecture: ["1C-VA-ARCH"],
            stupa_architecture:  ["1C-VA-ARCH"],
            cave_architecture:   ["1C-VA-ARCH"],
        },
        sculpture: {
            buddhist_sculpture: ["1C-VA-ARCH"],
            medieval_sculpture: ["1C-VA-ARCH"],
            bronze_sculpture:   ["1C-VA-ARCH"],
        },
        literature: {
            vedic_literature:  ["1C-RLL-LANG"],
            sangam_literature: ["1C-RLL-LANG"],
            classical_texts:   ["1C-RLL-LANG"],
        },
        religion: {
            buddhism:    ["1C-RLL-RELIGION"],
            jainism:     ["1C-RLL-RELIGION"],
            bhakti_sufi: ["1C-RLL-RELIGION"],
        },
        performing_arts: {
            classical_dance: ["1C-PA-DANCE"],
            music:           ["1C-PA-MUSIC"],
            theatre:         ["1C-PA-THEATRE"],
        },
    },
    geography: {
        indian_geography: {
            rivers:    ["GS1-GEO-IND-DRAINAGE"],
            monsoon:   ["GS1-GEO-IND-CLIMATE"],
            resources: ["GS1-GEO-IND-RESOURCES"],
        },
        world_geography: {
            landforms:     ["GS1-GEO-GM-LANDFORMS"],
            climate:       ["GS1-GEO-CLIM-SYSTEMS"],
            locations_maps: ["GS1-GEO-PRE-REGIONAL-PLACES"],
        },
    },
    polity: {
        constitutional_bodies: {
            ec:     ["GS2-POL-ELECTIONS"],
            upsc:   ["GS2-POL-PARL"],   // no dedicated CONTEMP node; PARL is nearest
            cag_fc: ["GS2-POL-PARL"],   // CAG/Finance Commission — parliamentary oversight
        },
        non_constitutional_bodies: {
            niti:           ["GS2-POL-PARL"],
            nhrc:           ["GS2-POL-JUD"],   // NHRC is quasi-judicial
            tribunals_misc: ["GS2-POL-JUD"],
        },
        executive: {
            president:   ["GS2-POL-EXEC"],
            pm_com:      ["GS2-POL-EXEC"],
            governor_cm: ["GS2-POL-EXEC"],
        },
        legislature: {
            parliament:       ["GS2-POL-PARL"],
            state_legislature: ["GS2-POL-PARL"],
            procedures:       ["GS2-POL-PARL"],
        },
        judiciary: {
            supreme_court:  ["GS2-POL-JUD"],
            high_court:     ["GS2-POL-JUD"],
            judicial_review: ["GS2-POL-JUD"],
        },
        federalism: {
            center_state_relations: ["GS2-POL-CSREL"],
            inter_state:            ["GS2-POL-CSREL"],
            local_governance_link:  ["GS2-POL-CSREL"],
        },
        elections: {
            electoral_system: ["GS2-POL-ELECTIONS"],
            ec_role:          ["GS2-POL-ELECTIONS"],
            reforms:          ["GS2-POL-ELECTIONS"],
        },
        amendments: {
            procedure:             ["GS2-POL-AMEND"],
            basic_structure:       ["GS2-POL-AMEND"],
            important_amendments:  ["GS2-POL-AMEND"],
        },
        fundamental_rights: {
            article_14_18: ["GS2-POL-FR"],
            article_19_22: ["GS2-POL-FR"],
            writs:         ["GS2-POL-FR"],
        },
        dpsp_duties: {
            dpsp:               ["GS2-POL-DPSP"],
            fundamental_duties: ["GS2-POL-DPSP"],
            comparison_fr_dpsp: ["GS2-POL-DPSP", "GS2-POL-FR"],
        },
        governance: {
            transparency:    ["GS2-POL-PARL"],
            citizen_charter: ["GS2-POL-PARL"],
            egovernance:     ["GS2-POL-PARL"],
        },
    },
    environment: {
        biodiversity: {
            species_diversity: ["GS3-ENV-BIOGEO"],
            hotspots:          ["GS3-ENV-BIOGEO"],
            conservation:      ["GS3-ENV-CONSERVATION"],
        },
        species_in_news: {
            mammals:          ["GS3-ENV-BIOGEO"],
            birds:            ["GS3-ENV-BIOGEO"],
            reptiles_aquatic: ["GS3-ENV-BIOGEO"],
        },
        climate_change: {
            cop:                   ["GS3-ENV-CURR-CLIMATE"],
            ghg:                   ["GS3-ENV-CLIMATEPHEN"],
            mitigation_adaptation: ["GS3-ENV-CLIMATEPHEN", "GS3-ENV-CURR-CLIMATE"],
        },
        ecology_concepts: {
            ecosystem:            ["GS3-ENV-ECO-CONCEPTS"],
            food_chain:           ["GS3-ENV-ECO-CONCEPTS"],
            ecological_succession: ["GS3-ENV-ECO-CONCEPTS"],
        },
        environmental_conventions: {
            cbd:          ["GS3-ENV-INTL"],
            unfccc:       ["GS3-ENV-INTL"],
            ramsar_cites: ["GS3-ENV-INTL"],
        },
        pollution: {
            air_pollution:  ["GS3-ENV-CURR-POLLUTION"],
            water_pollution: ["GS3-ENV-CURR-POLLUTION"],
            solid_waste:    ["GS3-ENV-CURR-POLLUTION"],
        },
        protected_areas: {
            national_parks:       ["GS3-ENV-CONSERVATION"],
            wildlife_sanctuaries: ["GS3-ENV-CONSERVATION"],
            biosphere_reserves:   ["GS3-ENV-CONSERVATION"],
        },
    },
    science_tech: {
        space: {
            isro_missions:  ["GS3-ST-SPACE"],
            satellites:     ["GS3-ST-SPACE"],
            launch_vehicles: ["GS3-ST-SPACE"],
        },
        biotechnology: {
            genetics:    ["GS3-ST-BIOTECH"],
            stem_cells:  ["GS3-ST-BIOTECH"],
            vaccines_bio: ["GS3-ST-BIOTECH"],
        },
        defence_tech: {
            missiles:     ["GS3-ST-DEFENCE"],
            naval_systems: ["GS3-ST-DEFENCE"],
            air_defence:  ["GS3-ST-DEFENCE"],
        },
        it_ai: {
            ai_ml:        ["GS3-ST-MATERIALS-NANO-ROBOTICS-AI"],
            quantum:      ["GS3-ST-MATERIALS-NANO-ROBOTICS-AI"],
            cybersecurity: ["GS3-ST-IT-COMM"],
        },
        health_diseases: {
            vaccines_health: ["GS3-ST-GENSCI-BIO"],
            diseases:        ["GS3-ST-GENSCI-BIO"],
            public_health:   ["GS3-ST-GENSCI-BIO"],
        },
        misc_tech: {
            materials:     ["GS3-ST-MATERIALS-NANO-ROBOTICS-AI"],
            energy_tech:   ["GS3-ST-MATERIALS-NANO-ROBOTICS-AI"],
            emerging_misc: ["GS3-ST-MATERIALS-NANO-ROBOTICS-AI"],
        },
    },
    ir: {
        organizations: {
            un:             ["GS2-IR-INSTITUTIONS"],
            wto_imf_wb:     ["GS2-IR-INSTITUTIONS"],
            regional_bodies: ["GS2-IR-GROUPINGS"],
        },
        bilateral_relations: {
            india_us:        ["GS2-IR-GROUPINGS", "GS2-IR-INSTITUTIONS"],  // QUAD, US-related institutions
            india_china:     ["GS2-IR-GROUPINGS"],                          // SCO, BRICS overlap
            india_neighbors: ["GS2-IR-ASEAN-EAP"],
        },
        groupings: {
            quad:  ["GS2-IR-GROUPINGS"],
            brics: ["GS2-IR-GROUPINGS"],
            g20:   ["GS2-IR-GROUPINGS"],
        },
        agreements: {
            trade_agreements:   ["GS2-IR-INSTITUTIONS"],
            defence_agreements: ["GS2-IR-GROUPINGS"],
            climate_agreements: ["GS2-IR-CLIMATE-DISARM"],
        },
    },
    current_affairs_misc: {
        reports_indices: {
            global_indices:   ["1C-MISC-GI", "1C-MISC-INST"],
            national_reports: ["1C-MISC-INST"],
            institutions:     ["1C-MISC-INST"],
        },
        schemes: {
            agri_schemes:          ["1C-MISC-SCHEMES"],
            social_sector_schemes: ["1C-MISC-SCHEMES"],
            infra_schemes:         ["1C-MISC-SCHEMES"],
        },
        places_in_news: {
            indian_places: ["1C-MISC-INST"],
            world_places:  ["1C-MISC-INST"],
            map_locations: ["1C-MISC-INST"],
        },
        awards: {
            national_awards:     ["1C-MISC-INST"],
            international_awards: ["1C-MISC-INST"],
            science_awards:      ["1C-MISC-INST"],
        },
        misc: {
            personalities: ["1C-MISC-INST"],
            sports:        ["1C-MISC-INST"],
            other_misc:    ["1C-MISC-INST"],
        },
    },
    csat_quant: {
        number_system: {
            ns_basics: ["CSAT-BN-NS"],
        },
        permutations_combinations: {
            pnc_basics: ["CSAT-BN-PNC"],
        },
        percentage: {
            pct_basics: ["CSAT-BN-PERCENT"],
        },
        data_interpretation: {
            di_mixed:  ["CSAT-DI-MIXED"],
            di_tables: ["CSAT-DI-TABLES"],
            di_charts: ["CSAT-DI-BAR", "CSAT-DI-LINE", "CSAT-DI-PIE"],
        },
        avg_mixture: {
            average:  ["CSAT-BN-AVG-MIX"],
            mixture:  ["CSAT-BN-AVG-MIX"],
        },
        mensuration: {
            mens_basics: ["CSAT-BN-MENS"],
        },
        tsd_tw: {
            tsd:    ["CSAT-BN-TSD"],
            tw:     ["CSAT-BN-TWP"],
            trains: ["CSAT-BN-TRAINS"],
        },
        misc_quant: {
            ages:        ["CSAT-BN-AGES"],
            profit_loss: ["CSAT-BN-PLD"],
            ratio:       ["CSAT-BN-RATIO"],
            apgp:        ["CSAT-BN-APGP"],
            interest:    ["CSAT-BN-INT"],
            prob:        ["CSAT-BN-PROB"],
            lcmhcf:      ["CSAT-BN-LCMHCF"],
            partnership: ["CSAT-BN-PLD"],
        },
    },
    csat_reasoning: {
        puzzles_complex: {
            complex_lr: ["CSAT-LR-COMPLEX"],
        },
        blood_relations: {
            blood_basics: ["CSAT-LR-BLOOD"],
        },
        syllogism: {
            syllogism_basics: ["CSAT-LR-SYL"],
        },
        number_series: {
            nser: ["CSAT-LR-NSER"],
        },
        non_verbal: {
            visual: ["CSAT-LR-VISUAL"],
        },
        cube_dice: {
            cube_basics: ["CSAT-LR-CUBE"],
        },
        ranking: {
            rank_basics: ["CSAT-LR-RANK"],
        },
        coding_decoding: {
            coding_basics: ["CSAT-LR-CODE"],
        },
        venn_diagrams: {
            venn_basics: ["CSAT-LR-VENN"],
        },
        direction_sense: {
            dir_basics: ["CSAT-LR-DIR"],
        },
        calendar_clock: {
            calendar: ["CSAT-LR-CALENDAR"],
            clock:    ["CSAT-LR-CLOCK"],
        },
        misc_lr: {
            lser:        ["CSAT-LR-LSER"],
            seating:     ["CSAT-LR-SIT"],
            select:      ["CSAT-LR-SELECT"],
            misc_lr_other: ["CSAT-LR-MISC"],
        },
    },
    csat_rc: {
        reading_comprehension: {
            all_rc: ["CSAT-RC-ASSUMP", "CSAT-RC-CONCL", "CSAT-RC-FACT", "CSAT-RC-INFER", "CSAT-RC-MISC", "CSAT-RC-STRENGTH", "CSAT-RC-TONE", "CSAT-RC-WEAKEN", "CSAT-RC-THEME"],
        },
        assumption: {
            assumption_mt: ["CSAT-RC-ASSUMP"],
        },
        conclusion: {
            conclusion_mt: ["CSAT-RC-CONCL"],
        },
        fact_opinion: {
            fact_mt: ["CSAT-RC-FACT"],
        },
        inference: {
            inference_mt: ["CSAT-RC-INFER"],
        },
        strengthen_weaken: {
            strengthen_mt: ["CSAT-RC-STRENGTH", "CSAT-RC-WEAKEN"],
        },
        tone_attitude: {
            tone_mt: ["CSAT-RC-TONE"],
        },
        theme_title: {
            theme_mt: ["CSAT-RC-THEME"],
        },
        misc_rc: {
            misc_mt: ["CSAT-RC-MISC"],
        },
    },
};

// ---------------------------------------------------------------------------
// RESOLVER FUNCTION
// ---------------------------------------------------------------------------

/**
 * Resolve frontend prelims selections to real pyq_by_node.json node IDs.
 *
 * @param {object} params
 * @param {string} params.subjectId    - e.g. "economy", "csat_quant"
 * @param {string} params.topicId      - e.g. "banking_monetary"
 * @param {string[]} params.subtopicIds - e.g. ["rbi", "mpc"]
 * @param {string} params.practiceScope - "subject" | "topic" | "subtopic"
 * @returns {{ nodeIds: string[], level: string, source: string, warning?: string }}
 */
export function resolvePrelimsNodes({
    subjectId = "",
    topicId = "",
    subtopicIds = [],
    practiceScope = "subject",
} = {}) {
    const subId = String(subjectId).toLowerCase().trim();
    const topId = String(topicId).toLowerCase().trim();
    const subIds = Array.isArray(subtopicIds)
        ? subtopicIds.map((s) => String(s).toLowerCase().trim()).filter(Boolean)
        : [];

    console.log("[PRELIMS-RESOLVER] input:", { subId, topId, subIds, practiceScope });



    // SUBTOPIC MODE
    if (practiceScope === "subtopic" && subIds.length > 0 && topId) {
        const subtopicMap = SUBTOPIC_NODES[subId]?.[topId];
        if (subtopicMap) {
            const nodes = [];
            const missed = [];
            for (const sid of subIds) {
                const mapped = subtopicMap[sid];
                if (mapped) {
                    nodes.push(...mapped);
                } else {
                    missed.push(sid);
                }
            }
            const unique = [...new Set(nodes)];
            if (unique.length) {
                if (missed.length) {
                    console.warn("[PRELIMS-RESOLVER] some subtopics not mapped, falling back to topic for them:", missed);
                }
                console.log("[PRELIMS-RESOLVER] subtopic-level resolved:", unique);
                return { nodeIds: unique, level: "subtopic", source: "prelims-resolver" };
            }
        }
        // Fall through to topic level
        console.warn("[PRELIMS-RESOLVER] subtopic map empty — falling to topic level for:", { subId, topId });
    }

    // TOPIC MODE
    if ((practiceScope === "topic" || practiceScope === "subtopic") && topId) {
        const topicMap = TOPIC_NODES[subId];
        if (topicMap && topicMap[topId]) {
            const nodes = [...new Set(topicMap[topId])];
            console.log("[PRELIMS-RESOLVER] topic-level resolved:", nodes);
            return { nodeIds: nodes, level: "topic", source: "prelims-resolver" };
        }
        console.warn("[PRELIMS-RESOLVER] topic not in map:", { subId, topId });
    }

    // SUBJECT MODE (also fallback from topic/subtopic miss)
    if (SUBJECT_NODES[subId] !== undefined) {
        const nodes = [...new Set(SUBJECT_NODES[subId])];
        if (!nodes.length) {
            console.warn("[PRELIMS-RESOLVER] subject has 0 nodes — no PYQs in index:", subId);
            return { nodeIds: [], level: "subject", source: "prelims-resolver", warning: "NO_NODES_FOR_SUBJECT" };
        }
        console.log("[PRELIMS-RESOLVER] subject-level resolved:", nodes.length, "nodes for", subId);
        return { nodeIds: nodes, level: "subject", source: "prelims-resolver" };
    }

    console.warn("[PRELIMS-RESOLVER] unrecognized subjectId:", subId);
    return { nodeIds: [], level: "unknown", source: "prelims-resolver", warning: "UNKNOWN_SUBJECT" };
}
