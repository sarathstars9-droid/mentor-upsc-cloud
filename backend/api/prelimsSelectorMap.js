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
            banking_structure: {
                labels: [
                    "1B1: Bank Classification",
                    "1B2: NPA, Bad-Loans, BASEL",
                    "Bank Classification",
                    "NPA, Bad-Loans, BASEL",
                ],
            },

            monetary_policy: {
                labels: [
                    "4E: Inflation",
                    "Inflation",
                ],
            },

            inflation_fiscal: {
                labels: [
                    "2BC: Finance Commission, BlackMoney, Subsidies",
                    "Finance Commission, BlackMoney, Subsidies",
                ],
            },

            budget: {
                labels: [
                    "2A1: Budget Direct Taxes",
                    "Budget Direct Taxes",
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

            fiscal_deficit: {
                labels: [
                    "2BC: Finance Commission, BlackMoney, Subsidies",
                    "2A1: Budget Direct Taxes",
                    "Finance Commission, BlackMoney, Subsidies",
                    "Budget Direct Taxes",
                    "Fiscal Deficit",
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

            gst: {
                labels: [
                    "2A2: Budget Indirect Taxes GST",
                    "Budget Indirect Taxes GST",
                    "GST",
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

            human_development: {
                labels: [],
                taggingPending: true,
            },
            inclusive_growth: {
                labels: [],
                taggingPending: true,
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
        },
    },

    geography: {
        subjectLabels: ["Indian Geography", "World Geography", "Geography"],
        files: [
            "prelims_gs_geography_india_tagged.json",
            "prelims_gs_geography_world_tagged.json",
        ],
        topics: {},
        subtopics: {},
    },

    polity: {
        subjectLabels: ["Polity and Governance", "Polity", "Governance"],
        files: ["prelims_gs_polity_governance_tagged.json"],
        topics: {},
        subtopics: {},
    },

    environment: {
        subjectLabels: ["Environment", "Environment and Ecology"],
        files: ["prelims_gs_environment_tagged.json"],
        topics: {},
        subtopics: {},
    },

    sciencetech: {
        subjectLabels: ["Science & Technology", "Science and Technology"],
        files: ["prelims_gs_science_tech_tagged.json"],
        topics: {},
        subtopics: {},
    },

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

            literature: {
                labels: [
                    "Literature: Religious and Scientific",
                ],
            },

            religion: {
                labels: [
                    "Literature: Religious and Scientific",
                ],
                taggingPending: true,
            },

            performing_arts: {
                labels: [
                    "Performing Arts: Dance, Theatre and Music",
                ],
            },
        },

        subtopics: {
            temple_architecture: {
                labels: [
                    "Architecture and Sculpture",
                ],
                taggingPending: true,
            },

            stupa_architecture: {
                labels: [
                    "Architecture and Sculpture",
                ],
                taggingPending: true,
            },

            cave_architecture: {
                labels: [
                    "Architecture and Sculpture",
                ],
                taggingPending: true,
            },

            dance: {
                labels: [
                    "Performing Arts: Dance, Theatre and Music",
                ],
                taggingPending: true,
            },

            music: {
                labels: [
                    "Performing Arts: Dance, Theatre and Music",
                ],
                taggingPending: true,
            },

            theatre: {
                labels: [
                    "Performing Arts: Dance, Theatre and Music",
                ],
                taggingPending: true,
            },
        },
    },

    history: {
        subjectLabels: ["History", "Ancient History", "Medieval History", "Modern History"],
        files: [
            "prelims_gs_history_ancient_tagged.json",
            "prelims_gs_history_medieval_tagged.json",
            "prelims_gs_history_modern_tagged.json",
        ],
        topics: {},
        subtopics: {},
    },

    ir: {
        subjectLabels: ["International Relations"],
        files: ["prelims_gs_international_relations_tagged.json"],
        topics: {},
        subtopics: {},
    },

    current_affairs_misc: {
        subjectLabels: ["Current Affairs and Miscellaneous", "Current Affairs"],
        files: ["prelims_gs_current_affairs_misc_tagged.json"],
        topics: {},
        subtopics: {},
    },
};

export function getSelectorSubjectMap(subjectId) {
    return PRELIMS_SELECTOR_MAP[subjectId] || null;
}

export function getTopicLabels(subjectId, topicId) {
    return normalizeAliases(
        PRELIMS_SELECTOR_MAP?.[subjectId]?.topics?.[topicId]?.labels || []
    );
}

export function getSubtopicConfig(subjectId, subtopicId) {
    return PRELIMS_SELECTOR_MAP?.[subjectId]?.subtopics?.[subtopicId] || null;
}

export function getSubtopicLabels(subjectId, subtopicId) {
    return normalizeAliases(getSubtopicConfig(subjectId, subtopicId)?.labels || []);
}