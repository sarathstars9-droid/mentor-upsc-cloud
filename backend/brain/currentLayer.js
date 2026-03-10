// backend/brain/currentLayer.js

export const CURRENT_LAYER_2026 = [
  {
    id: "CA-2025-UNESCO-NEW",
    year: "2025-26",
    title: "UNESCO / Heritage related updates",
    tags: ["P", "PM"],
    staticRefs: ["GS1-HIS-ANC-IVC"], // overlay on IVC / culture nodes (we can refine)
    bullets: [
      "Any new UNESCO inscriptions / tentative list updates",
      "Archaeological excavations & findings relevant to IVC/Sangam etc."
    ]
  },

  {
    id: "CA-2025-26-GOVERNOR-DISCRETION",
    year: "2025-26",
    title: "Governor’s discretion controversies",
    tags: ["M", "PM"],
    staticRefs: [
      "GS2-POLITY-FEDERAL-356" // will exist in GS2 graph later
    ],
    bullets: [
      "Recent judicial observations and state-level political disputes",
      "Relevance: Article 356, federalism, discretionary powers"
    ]
  }
];