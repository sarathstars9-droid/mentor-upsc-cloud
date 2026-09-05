function detectVisuals(answer) {
  const lowerAnswer = String(answer || "").toLowerCase();
  return {
    flowchart: lowerAnswer.includes("flowchart") || lowerAnswer.includes("flow-chart") || lowerAnswer.includes("process flow") || lowerAnswer.includes("step-by-step"),
    diagram: lowerAnswer.includes("diagram") || lowerAnswer.includes("sketch") || lowerAnswer.includes("figure") || lowerAnswer.includes("illustration"),
    map: lowerAnswer.includes("map") || lowerAnswer.includes("india map") || lowerAnswer.includes("world map"),
    table: lowerAnswer.includes("table") || lowerAnswer.includes("comparison") || lowerAnswer.includes("matrix")
  };
}

const fixtures = [
  {
    name: "A. answer with clear flowchart",
    text: "Here is a step-by-step process of the monsoon mechanism.",
    expected: { flowchart: true, diagram: false, map: false, table: false }
  },
  {
    name: "B. answer with table",
    text: "The matrix below shows the difference between fundamental rights and duties.",
    expected: { flowchart: false, diagram: false, map: false, table: true }
  },
  {
    name: "C. answer with no visual",
    text: "Cooperative federalism requires continuous political cooperation.",
    expected: { flowchart: false, diagram: false, map: false, table: false }
  },
  {
    name: "D. Geography answer with map/sketch",
    text: "As seen in the world map and the sketch of the Himalayas, tectonic plates shift.",
    expected: { flowchart: false, diagram: true, map: true, table: false }
  },
  {
    name: "E. Real Case: Cooperative-federalism answer with a visual titled 'Cooperative Federalism: A Continuous Partnership'",
    text: "Cooperative federalism requires continuous political cooperation. [Cooperative Federalism: A Continuous Partnership]",
    expected: { flowchart: false, diagram: false, map: false, table: false }
  }
];

console.log("=== VISUAL DETECTION MOCK OFFLINE TESTS ===");
for (const f of fixtures) {
  const result = detectVisuals(f.text);
  console.log(`\nTesting: ${f.name}`);
  console.log(`Input Text: "${f.text}"`);
  console.log(`Detected:`, result);
  
  // Assertions (just visual for now)
  const passFlowchart = result.flowchart === f.expected.flowchart;
  const passDiagram = result.diagram === f.expected.diagram;
  const passTable = result.table === f.expected.table;
  const passMap = result.map === f.expected.map;
  
  console.log(`FLOWCHART DETECTION: ${passFlowchart ? 'PASS' : 'FAIL'}`);
  console.log(`DIAGRAM DETECTION: ${passDiagram ? 'PASS' : 'FAIL'}`);
  console.log(`TABLE DETECTION: ${passTable ? 'PASS' : 'FAIL'}`);
  console.log(`MAP/SKETCH DETECTION: ${passMap ? 'PASS' : 'FAIL'}`);
}
