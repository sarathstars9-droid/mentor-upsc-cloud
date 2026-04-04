function norm(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[_/\\-]+/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeAliases(list = []) {
    return [...new Set((list || []).map(norm).filter(Boolean))];
}

export const PRELIMS_SELECTOR_MAP = {
    economy: {
        subjectLabels: ["Economy", "Indian Economy"],
        files: ["prelims_gs_economy_tagged.json"],

        topics: {
            // Frontend topicId: "banking_monetary"
            banking_monetary: {
                labels: [
                    "1A1: Money: Barter to Bitcoins",
                    "1B1: Bank Classification",
                    "1B2: NPA, Bad-Loans, BASEL",
                    "4E: Inflation",
                    "Money: Barter to Bitcoins",
                    "Bank Classification",
                    "NPA, Bad-Loans, BASEL",
                    "Inflation",
                ],
            },

            inflation_fiscal: {
                labels: [
                    "2BC: Finance Commission, BlackMoney, Subsidies",
                    "4E: Inflation",
                    "Finance Commission, BlackMoney, Subsidies",
                    "Inflation",
                ],
            },

            budget: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "2BC: Finance Commission, BlackMoney, Subsidies",
                    "Budget Direct Taxes",
                    "Finance Commission, BlackMoney, Subsidies",
                ],
            },

            taxation: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "2A2: Budget Indirect Taxes GST",
                    "Budget Direct Taxes",
                    "Budget Indirect Taxes GST",
                ],
            },

            financial_markets: {
                labels: [
                    "1C: Sharemarket, Companies Act",
                    "7: Microeconomics",
                    "Sharemarket, Companies Act",
                    "Microeconomics",
                ],
            },

            external_sector: {
                labels: [
                    "3A: BoP, CAD Currency Exchange",
                    "3B: WTO, IMF & other International Organisations & Agreeements",
                    "BoP, CAD Currency Exchange",
                    "WTO, IMF & other International Organisations & Agreeements",
                ],
            },

            growth_development: {
                labels: [
                    "4A: Sectors of Economy- Agriculture",
                    "4B: Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                    "4C: NITI, Planning Commission, FYP, Unemployment",
                    "4D: GDP, GNP",
                    "Sectors of Economy- Agriculture",
                    "Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                    "NITI, Planning Commission, FYP, Unemployment",
                    "GDP, GNP",
                ],
            },

            poverty_inclusion: {
                labels: [
                    "1D1: Insurance, Pension, Financial inclusion",
                    "6A: HRD: Census, Health Hunger",
                    "6B: HRD: Education and Skill",
                    "6C: HRD: Poverty",
                    "6D: HRD: Weaker Section, HDI, SDG",
                    "Insurance, Pension, Financial inclusion",
                    "HRD: Census, Health Hunger",
                    "HRD: Education and Skill",
                    "HRD: Poverty",
                    "HRD: Weaker Section, HDI, SDG",
                ],
            },

            // Frontend topicId: "infrastructure"
            infrastructure: {
                labels: [
                    "5A: Infra: Energy",
                    "5B: Infra: Transport, Urban Rural, Communication, Investment, PPP",
                    "Infra: Energy",
                    "Infra: Transport, Urban Rural, Communication, Investment, PPP",
                ],
            },

            // Frontend topicId: "industry_labour"
            industry_labour: {
                labels: [
                    "4B: Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                    "Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                ],
            },

            agriculture: {
                labels: [
                    "4A: Sectors of Economy- Agriculture",
                    "Sectors of Economy- Agriculture",
                ],
            },
        },

        subtopics: {
            nbfc: {
                labels: [
                    "1B1: Bank Classification",
                    "Bank Classification",
                    "NBFC",
                ],
            },
            commercial_banks: {
                labels: [
                    "1B1: Bank Classification",
                    "Bank Classification",
                    "Commercial Banks",
                ],
            },
            rbi: {
                labels: [
                    "1B1: Bank Classification",
                    "1B2: NPA, Bad-Loans, BASEL",
                    "Bank Classification",
                    "NPA, Bad-Loans, BASEL",
                    "RBI",
                ],
            },
            npa_basel: {
                labels: [
                    "1B2: NPA, Bad-Loans, BASEL",
                    "NPA, Bad-Loans, BASEL",
                    "NPA",
                    "BASEL",
                ],
            },
            money_basics: {
                labels: [
                    "1A1: Money: Barter to Bitcoins",
                    "Money: Barter to Bitcoins",
                ],
            },
            repo_reverse_repo: {
                labels: [
                    "4E: Inflation",
                    "Inflation",
                    "Repo",
                    "Reverse Repo",
                ],
            },
            mpc: {
                labels: [
                    "4E: Inflation",
                    "Inflation",
                    "MPC",
                ],
            },
            liquidity_tools: {
                labels: [
                    "4E: Inflation",
                    "Inflation",
                    "Liquidity",
                ],
            },
            inflation: {
                labels: [
                    "4E: Inflation",
                    "Inflation",
                ],
            },
            fiscal_deficit: {
                labels: [
                    "2BC: Finance Commission, BlackMoney, Subsidies",
                    "2A1: Budget Direct Taxes",
                    "Finance Commission, BlackMoney, Subsidies",
                    "Budget Direct Taxes",
                    "Fiscal Deficit",
                ],
            },
            subsidies: {
                labels: [
                    "2BC: Finance Commission, BlackMoney, Subsidies",
                    "Finance Commission, BlackMoney, Subsidies",
                    "Subsidies",
                ],
            },
            receipts_expenditure: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "Budget Direct Taxes",
                    "Receipts",
                    "Expenditure",
                ],
            },
            budgeting_basics: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "Budget Direct Taxes",
                    "Budget",
                ],
            },
            budget_terms: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "2BC: Finance Commission, BlackMoney, Subsidies",
                    "Budget Direct Taxes",
                    "Finance Commission, BlackMoney, Subsidies",
                ],
            },
            gst: {
                labels: [
                    "2A2: Budget Indirect Taxes GST",
                    "Budget Indirect Taxes GST",
                    "GST",
                ],
            },
            direct_tax: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "Budget Direct Taxes",
                    "Direct Tax",
                ],
            },
            indirect_tax: {
                labels: [
                    "2A2: Budget Indirect Taxes GST",
                    "Budget Indirect Taxes GST",
                    "Indirect Tax",
                ],
            },
            direct_indirect_tax: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "2A2: Budget Indirect Taxes GST",
                    "Budget Direct Taxes",
                    "Budget Indirect Taxes GST",
                    "Direct Tax",
                    "Indirect Tax",
                ],
            },
            sebi: {
                labels: [
                    "1C: Sharemarket, Companies Act",
                    "Sharemarket, Companies Act",
                    "SEBI",
                ],
            },
            capital_market: {
                labels: [
                    "1C: Sharemarket, Companies Act",
                    "Sharemarket, Companies Act",
                    "Capital Market",
                ],
            },
            money_market: {
                labels: [
                    "1C: Sharemarket, Companies Act",
                    "7: Microeconomics",
                    "Sharemarket, Companies Act",
                    "Microeconomics",
                    "Money Market",
                ],
            },
            bop: {
                labels: [
                    "3A: BoP, CAD Currency Exchange",
                    "BoP, CAD Currency Exchange",
                    "Balance of Payments",
                ],
            },
            trade_policy: {
                labels: [
                    "3A: BoP, CAD Currency Exchange",
                    "3B: WTO, IMF & other International Organisations & Agreeements",
                    "BoP, CAD Currency Exchange",
                    "WTO, IMF & other International Organisations & Agreeements",
                    "Trade Policy",
                ],
            },
            forex: {
                labels: [
                    "3A: BoP, CAD Currency Exchange",
                    "BoP, CAD Currency Exchange",
                    "Forex",
                    "Currency Exchange",
                ],
            },
            gdp_gnp: {
                labels: [
                    "4D: GDP, GNP",
                    "GDP, GNP",
                    "GDP",
                    "GNP",
                ],
            },
            human_development: {
                labels: [
                    "6A: HRD: Census, Health Hunger",
                    "6B: HRD: Education and Skill",
                    "6D: HRD: Weaker Section, HDI, SDG",
                    "HRD: Census, Health Hunger",
                    "HRD: Education and Skill",
                    "HRD: Weaker Section, HDI, SDG",
                    "HDI",
                ],
            },
            inclusive_growth: {
                labels: [
                    "4C: NITI, Planning Commission, FYP, Unemployment",
                    "4D: GDP, GNP",
                    "NITI, Planning Commission, FYP, Unemployment",
                    "GDP, GNP",
                ],
            },
            poverty: {
                labels: [
                    "6C: HRD: Poverty",
                    "6D: HRD: Weaker Section, HDI, SDG",
                    "HRD: Poverty",
                    "HRD: Weaker Section, HDI, SDG",
                    "Poverty",
                ],
            },
            financial_inclusion: {
                labels: [
                    "1D1: Insurance, Pension, Financial inclusion",
                    "Insurance, Pension, Financial inclusion",
                    "Financial Inclusion",
                ],
            },
            welfare: {
                labels: [
                    "1D1: Insurance, Pension, Financial inclusion",
                    "6C: HRD: Poverty",
                    "6D: HRD: Weaker Section, HDI, SDG",
                    "Insurance, Pension, Financial inclusion",
                    "HRD: Poverty",
                    "HRD: Weaker Section, HDI, SDG",
                    "Welfare",
                ],
            },
            energy: {
                labels: [
                    "5A: Infra: Energy",
                    "Infra: Energy",
                    "Energy",
                ],
            },
            transport_urban: {
                labels: [
                    "5B: Infra: Transport, Urban Rural, Communication, Investment, PPP",
                    "Infra: Transport, Urban Rural, Communication, Investment, PPP",
                    "Transport",
                    "Urban",
                ],
            },
            manufacturing: {
                labels: [
                    "4B: Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                    "Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                    "Manufacturing",
                    "Services",
                ],
            },
            labour_msme: {
                labels: [
                    "4B: Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                    "Sectors- MFG, Services, Ease of Doing Biz, IPR, Startup, MSME",
                    "MSME",
                    "Labour",
                ],
            },
            agri_sector: {
                labels: [
                    "4A: Sectors of Economy- Agriculture",
                    "Sectors of Economy- Agriculture",
                    "Agriculture",
                ],
            },
        },
    },

    // ─── ENVIRONMENT ────────────────────────────────────────────────────────────
    environment: {
        subjectLabels: ["Environment", "Environment and Ecology"],
        files: ["prelims_gs_environment_tagged.json"],

        topics: {
            biodiversity: {
                labels: [
                    "Biodiversity",
                    "Global Conservation Efforts",
                    "National Conservation Efforts",
                ],
            },
            // "Species in News" → actual data section is "Biodiversity"
            species_in_news: {
                labels: [
                    "Biodiversity",
                ],
            },
            climate_change: {
                labels: [
                    "Climate Change: Causes and Implications",
                    "Environment, Sustainable Development and General Issues",
                ],
            },
            ecology_concepts: {
                labels: [
                    "Ecosystem and Ecology",
                ],
            },
            environmental_conventions: {
                labels: [
                    "Global Conservation Efforts",
                    "Environment, Sustainable Development and General Issues",
                ],
            },
            pollution: {
                labels: [
                    "Environmental Pollution",
                ],
            },
            protected_areas: {
                labels: [
                    "Protected Area Network: NP, WS, BR, etc.",
                    "National Conservation Efforts",
                ],
            },
        },

        subtopics: {
            // biodiversity subtopics
            species_diversity: {
                labels: ["Biodiversity"],
            },
            hotspots: {
                labels: ["Biodiversity"],
            },
            conservation: {
                labels: ["Global Conservation Efforts", "National Conservation Efforts"],
            },
            // species_in_news subtopics
            mammals: {
                labels: ["Biodiversity"],
            },
            birds: {
                labels: ["Biodiversity"],
            },
            reptiles_aquatic: {
                labels: ["Biodiversity"],
            },
            // climate_change subtopics
            cop: {
                labels: ["Climate Change: Causes and Implications", "Environment, Sustainable Development and General Issues"],
            },
            ghg: {
                labels: ["Climate Change: Causes and Implications"],
            },
            mitigation_adaptation: {
                labels: ["Climate Change: Causes and Implications", "Environment, Sustainable Development and General Issues"],
            },
            // ecology_concepts subtopics
            ecosystem: {
                labels: ["Ecosystem and Ecology"],
            },
            food_chain: {
                labels: ["Ecosystem and Ecology"],
            },
            ecological_succession: {
                labels: ["Ecosystem and Ecology"],
            },
            // environmental_conventions subtopics
            cbd: {
                labels: ["Global Conservation Efforts", "Environment, Sustainable Development and General Issues"],
            },
            unfccc: {
                labels: ["Global Conservation Efforts", "Environment, Sustainable Development and General Issues"],
            },
            ramsar_cites: {
                labels: ["Global Conservation Efforts"],
            },
            // pollution subtopics
            air_pollution: {
                labels: ["Environmental Pollution"],
            },
            water_pollution: {
                labels: ["Environmental Pollution"],
            },
            solid_waste: {
                labels: ["Environmental Pollution"],
            },
            // protected_areas subtopics
            national_parks: {
                labels: ["Protected Area Network: NP, WS, BR, etc.", "National Conservation Efforts"],
            },
            wildlife_sanctuaries: {
                labels: ["Protected Area Network: NP, WS, BR, etc.", "National Conservation Efforts"],
            },
            biosphere_reserves: {
                labels: ["Protected Area Network: NP, WS, BR, etc."],
            },
        },
    },

    // ─── CULTURE ────────────────────────────────────────────────────────────────
    culture: {
        subjectLabels: ["Art & Culture", "Art and Culture", "Culture"],
        files: ["prelims_gs_art_culture_tagged.json"],

        topics: {
            architecture: {
                labels: [
                    "Architecture and Sculpture",
                ],
            },
            sculpture: {
                labels: [
                    "Architecture and Sculpture",
                ],
            },
            painting: {
                labels: [
                    "Visual Arts: Painting, ceramics and drawing",
                ],
            },
            literature: {
                labels: [
                    "Literature: Religious and Scientific",
                ],
            },
            religion: {
                labels: [
                    "Literature: Religious and Scientific",
                    "Indian Philosophy and Bhakti & Sufi Movements",
                ],
            },
            performing_arts: {
                labels: [
                    "Performing Arts: Dance, Theatre and Music",
                ],
            },
        },

        subtopics: {
            temple_architecture: {
                labels: ["Architecture and Sculpture"],
            },
            stupa_architecture: {
                labels: ["Architecture and Sculpture"],
            },
            cave_architecture: {
                labels: ["Architecture and Sculpture"],
            },
            buddhist_sculpture: {
                labels: ["Architecture and Sculpture"],
            },
            medieval_sculpture: {
                labels: ["Architecture and Sculpture"],
            },
            bronze_sculpture: {
                labels: ["Architecture and Sculpture"],
            },
            vedic_literature: {
                labels: ["Literature: Religious and Scientific"],
            },
            sangam_literature: {
                labels: ["Literature: Religious and Scientific"],
            },
            classical_texts: {
                labels: ["Literature: Religious and Scientific"],
            },
            buddhism: {
                labels: ["Indian Philosophy and Bhakti & Sufi Movements", "Literature: Religious and Scientific"],
            },
            jainism: {
                labels: ["Indian Philosophy and Bhakti & Sufi Movements", "Literature: Religious and Scientific"],
            },
            bhakti_sufi: {
                labels: ["Indian Philosophy and Bhakti & Sufi Movements"],
            },
            classical_dance: {
                labels: ["Performing Arts: Dance, Theatre and Music"],
            },
            music: {
                labels: ["Performing Arts: Dance, Theatre and Music"],
            },
            theatre: {
                labels: ["Performing Arts: Dance, Theatre and Music"],
            },
            dance: {
                labels: ["Performing Arts: Dance, Theatre and Music"],
            },
        },
    },

    // ─── POLITY ──────────────────────────────────────────────────────────────────
    polity: {
        subjectLabels: ["Polity and Governance", "Polity", "Governance"],
        files: ["prelims_gs_polity_governance_tagged.json"],

        topics: {
            constitutional_bodies: {
                labels: [
                    "Constitutional and Non-constitutional Bodies",
                ],
            },
            non_constitutional_bodies: {
                labels: [
                    "Constitutional and Non-constitutional Bodies",
                ],
            },
            executive: {
                labels: [
                    "Executive",
                ],
            },
            legislature: {
                labels: [
                    "Legislature",
                ],
            },
            judiciary: {
                labels: [
                    "Judiciary",
                    "Judicial & Quasi-Judicial Bodies",
                ],
            },
            federalism: {
                labels: [
                    "Features of the Indian Constitution",
                    "Local Self Government",
                ],
            },
            elections: {
                labels: [
                    "Constitutional and Non-constitutional Bodies",
                ],
            },
            amendments: {
                labels: [
                    "Features of the Indian Constitution",
                    "Historical Background & Making of Indian Constitution",
                ],
            },
            fundamental_rights: {
                labels: [
                    "Features of the Indian Constitution",
                ],
            },
            dpsp_duties: {
                labels: [
                    "Features of the Indian Constitution",
                ],
            },
            governance: {
                labels: [
                    "Governance",
                    "Local Self Government",
                ],
            },
        },

        subtopics: {
            ec: {
                labels: ["Constitutional and Non-constitutional Bodies"],
            },
            upsc: {
                labels: ["Constitutional and Non-constitutional Bodies"],
            },
            cag_fc: {
                labels: ["Constitutional and Non-constitutional Bodies"],
            },
            niti: {
                labels: ["Constitutional and Non-constitutional Bodies"],
            },
            nhrc: {
                labels: ["Judicial & Quasi-Judicial Bodies"],
            },
            tribunals_misc: {
                labels: ["Judicial & Quasi-Judicial Bodies"],
            },
            president: {
                labels: ["Executive"],
            },
            pm_com: {
                labels: ["Executive"],
            },
            governor_cm: {
                labels: ["Executive"],
            },
            parliament: {
                labels: ["Legislature"],
            },
            state_legislature: {
                labels: ["Legislature"],
            },
            procedures: {
                labels: ["Legislature"],
            },
            supreme_court: {
                labels: ["Judiciary"],
            },
            high_court: {
                labels: ["Judiciary"],
            },
            judicial_review: {
                labels: ["Judiciary", "Judicial & Quasi-Judicial Bodies"],
            },
            center_state_relations: {
                labels: ["Features of the Indian Constitution", "Local Self Government"],
            },
            inter_state: {
                labels: ["Features of the Indian Constitution"],
            },
            local_governance_link: {
                labels: ["Local Self Government"],
            },
            electoral_system: {
                labels: ["Constitutional and Non-constitutional Bodies"],
            },
            ec_role: {
                labels: ["Constitutional and Non-constitutional Bodies"],
            },
            reforms: {
                labels: ["Constitutional and Non-constitutional Bodies"],
            },
            procedure: {
                labels: ["Features of the Indian Constitution", "Historical Background & Making of Indian Constitution"],
            },
            basic_structure: {
                labels: ["Features of the Indian Constitution"],
            },
            important_amendments: {
                labels: ["Features of the Indian Constitution", "Historical Background & Making of Indian Constitution"],
            },
            article_14_18: {
                labels: ["Features of the Indian Constitution"],
            },
            article_19_22: {
                labels: ["Features of the Indian Constitution"],
            },
            writs: {
                labels: ["Features of the Indian Constitution"],
            },
            dpsp: {
                labels: ["Features of the Indian Constitution"],
            },
            fundamental_duties: {
                labels: ["Features of the Indian Constitution"],
            },
            comparison_fr_dpsp: {
                labels: ["Features of the Indian Constitution"],
            },
            transparency: {
                labels: ["Governance"],
            },
            citizen_charter: {
                labels: ["Governance"],
            },
            egovernance: {
                labels: ["Governance"],
            },
        },
    },

    // ─── HISTORY ─────────────────────────────────────────────────────────────────
    history: {
        subjectLabels: ["History", "Ancient History", "Medieval History", "Modern History"],
        files: [
            "prelims_gs_history_ancient_tagged.json",
            "prelims_gs_history_medieval_tagged.json",
            "prelims_gs_history_modern_tagged.json",
        ],

        topics: {
            ancient_history: {
                labels: [
                    "Gupta and Post- Gupta Age",
                    "Mauryan and Post-Mauryan Age",
                    "Prehistoric Period and Indus Valley Civilisation",
                    "Sangam Age",
                    "Vedic and Later Vedic Age",
                ],
            },
            medieval_history: {
                labels: [
                    "Delhi Sultanate (1206 AD to 1526 AD)",
                    "Mughal Empire (1526 AD to 1761 AD)",
                    "Provincial Kingdoms in Medieval India",
                    "Religious movement during medieval period",
                ],
            },
            modern_history: {
                labels: [
                    "Development of Press, Education and Civil Services",
                    "Early Uprising Against the British and Revolt of 1857",
                    "Independence to Partition",
                    "India in the 18th Century",
                    "Indian Renaissance and Reform Movements",
                    "Phases of Revolutionary Nationalism",
                    "Rise of Indian National Movement: Moderate and Extremists Phase",
                    "The Beginning of Gandhian Era",
                    "The National Movement in the 1940s",
                ],
            },
        },

        subtopics: {
            ivc: {
                labels: ["Prehistoric Period and Indus Valley Civilisation"],
            },
            vedic_age: {
                labels: ["Vedic and Later Vedic Age"],
            },
            mahajanapadas_mauryas: {
                labels: ["Mauryan and Post-Mauryan Age"],
            },
            delhi_sultanate: {
                labels: ["Delhi Sultanate (1206 AD to 1526 AD)"],
            },
            mughals: {
                labels: ["Mughal Empire (1526 AD to 1761 AD)"],
            },
            bhakti_sufi_history: {
                labels: ["Religious movement during medieval period"],
            },
            british_expansion: {
                labels: ["India in the 18th Century", "Early Uprising Against the British and Revolt of 1857"],
            },
            freedom_movement: {
                labels: [
                    "Rise of Indian National Movement: Moderate and Extremists Phase",
                    "The Beginning of Gandhian Era",
                    "Phases of Revolutionary Nationalism",
                    "The National Movement in the 1940s",
                    "Independence to Partition",
                ],
            },
            governor_general_acts: {
                labels: ["Development of Press, Education and Civil Services", "India in the 18th Century"],
            },
        },
    },

    // ─── GEOGRAPHY ───────────────────────────────────────────────────────────────
    geography: {
        subjectLabels: ["Indian Geography", "World Geography", "Geography"],
        files: [
            "prelims_gs_geography_india_tagged.json",
            "prelims_gs_geography_world_tagged.json",
        ],

        topics: {
            indian_geography: {
                labels: [
                    "Agriculture in India",
                    "Drainage System of India",
                    "Indian Climate",
                    "Indian Map",
                    "Mineral and Industries",
                    "Natural Vegetation in India",
                    "Physiography of India",
                    "Soils",
                ],
            },
            world_geography: {
                labels: [
                    "Climatology",
                    "Geomorphology",
                    "Human and Economic Geography",
                    "Oceanography",
                    "The Earth and the Universe",
                    "World Climatic Regions",
                    "World Map",
                ],
            },
        },

        subtopics: {
            rivers: {
                labels: ["Drainage System of India"],
            },
            monsoon: {
                labels: ["Indian Climate"],
            },
            resources: {
                labels: ["Mineral and Industries", "Natural Vegetation in India", "Soils", "Agriculture in India"],
            },
            landforms: {
                labels: ["Geomorphology", "Physiography of India"],
            },
            climate: {
                labels: ["Climatology", "World Climatic Regions"],
            },
            locations_maps: {
                labels: ["World Map", "Indian Map"],
            },
        },
    },

    // ─── SCIENCE & TECHNOLOGY ─────────────────────────────────────────────────────
    sciencetech: {
        subjectLabels: ["Science & Technology", "Science and Technology"],
        files: ["prelims_gs_science_tech_tagged.json"],

        topics: {
            space: {
                labels: ["Space Science"],
            },
            biotechnology: {
                labels: ["Biotechnology", "Biology"],
            },
            defence_tech: {
                labels: ["Defence Technology"],
            },
            it_ai: {
                labels: ["Communication Technology"],
            },
            health_diseases: {
                labels: ["Biology"],
            },
            misc_tech: {
                labels: ["Energy", "Miscellaneous", "Chemistry", "Physics"],
            },
        },

        subtopics: {
            isro_missions: {
                labels: ["Space Science"],
            },
            satellites: {
                labels: ["Space Science"],
            },
            launch_vehicles: {
                labels: ["Space Science"],
            },
            genetics: {
                labels: ["Biotechnology"],
            },
            stem_cells: {
                labels: ["Biotechnology"],
            },
            vaccines_bio: {
                labels: ["Biotechnology"],
            },
            missiles: {
                labels: ["Defence Technology"],
            },
            naval_systems: {
                labels: ["Defence Technology"],
            },
            air_defence: {
                labels: ["Defence Technology"],
            },
            ai_ml: {
                labels: ["Communication Technology"],
            },
            quantum: {
                labels: ["Physics", "Communication Technology"],
            },
            cybersecurity: {
                labels: ["Communication Technology"],
            },
            vaccines_health: {
                labels: ["Biology"],
            },
            diseases: {
                labels: ["Biology"],
            },
            public_health: {
                labels: ["Biology"],
            },
            materials: {
                labels: ["Chemistry", "Physics", "Miscellaneous"],
            },
            energy_tech: {
                labels: ["Energy"],
            },
            emerging_misc: {
                labels: ["Miscellaneous"],
            },
        },
    },

    // ─── INTERNATIONAL RELATIONS ─────────────────────────────────────────────────
    ir: {
        subjectLabels: ["International Relations"],
        files: ["prelims_gs_international_relations_tagged.json"],

        topics: {
            organizations: {
                labels: [
                    "International Groups and Political Organizations",
                    "India's Foreign Policy",
                ],
            },
            bilateral_relations: {
                labels: [
                    "India & Its Neighbors",
                    "India's Foreign Policy",
                ],
            },
            groupings: {
                labels: [
                    "International Groups and Political Organizations",
                ],
            },
            agreements: {
                labels: [
                    "India's Foreign Policy",
                    "International Groups and Political Organizations",
                ],
            },
        },

        subtopics: {
            un: {
                labels: ["International Groups and Political Organizations"],
            },
            wto_imf_wb: {
                labels: ["International Groups and Political Organizations"],
            },
            regional_bodies: {
                labels: ["International Groups and Political Organizations"],
            },
            india_us: {
                labels: ["India's Foreign Policy", "International Groups and Political Organizations"],
            },
            india_china: {
                labels: ["India & Its Neighbors", "India's Foreign Policy"],
            },
            india_neighbors: {
                labels: ["India & Its Neighbors"],
            },
            quad: {
                labels: ["International Groups and Political Organizations", "India's Foreign Policy"],
            },
            brics: {
                labels: ["International Groups and Political Organizations"],
            },
            g20: {
                labels: ["International Groups and Political Organizations"],
            },
            trade_agreements: {
                labels: ["India's Foreign Policy", "International Groups and Political Organizations"],
            },
            defence_agreements: {
                labels: ["India's Foreign Policy"],
            },
            climate_agreements: {
                labels: ["India's Foreign Policy", "International Groups and Political Organizations"],
            },
        },
    },

    // ─── CURRENT AFFAIRS ─────────────────────────────────────────────────────────
    current_affairs_misc: {
        subjectLabels: ["Current Affairs and Miscellaneous", "Current Affairs"],
        files: ["prelims_gs_current_affairs_misc_tagged.json"],
        topics: {},
        subtopics: {},
    },
};

// Maps alternate frontend subject IDs to the canonical selector map key.
const SUBJECT_ID_ALIASES = {
    science_tech:           "sciencetech",
    science_and_technology: "sciencetech",
    science_technology:     "sciencetech",
    polity_governance:      "polity",
    environment_ecology:    "environment",
    international_relations: "ir",
    current_affairs:        "current_affairs_misc",
};

function resolveSubjectKey(subjectId) {
    const id = String(subjectId || "").toLowerCase().trim();
    return SUBJECT_ID_ALIASES[id] || id;
}

export function getSelectorSubjectMap(subjectId) {
    const key = resolveSubjectKey(subjectId);
    return PRELIMS_SELECTOR_MAP[key] || null;
}

export function getTopicLabels(subjectId, topicId) {
    const key = resolveSubjectKey(subjectId);
    return normalizeAliases(
        PRELIMS_SELECTOR_MAP?.[key]?.topics?.[topicId]?.labels || []
    );
}

export function getSubtopicConfig(subjectId, subtopicId) {
    const key = resolveSubjectKey(subjectId);
    return PRELIMS_SELECTOR_MAP?.[key]?.subtopics?.[subtopicId] || null;
}

export function getSubtopicLabels(subjectId, subtopicId) {
    return normalizeAliases(getSubtopicConfig(subjectId, subtopicId)?.labels || []);
}