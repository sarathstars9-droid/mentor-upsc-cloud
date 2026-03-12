import { mapTextToSyllabusChunks } from "./brain/findMicroTheme.js";

const input = "FR article 19 + tone and summary + monsoon mechanism";

console.dir(mapTextToSyllabusChunks(input, 2), { depth: null });