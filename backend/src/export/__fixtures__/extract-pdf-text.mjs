// Standalone ESM helper for render.test.ts. pdfjs-dist's Node-compatible
// build is ESM-only ("legacy/build/pdf.mjs") and ts-jest compiles test
// files to CommonJS, where a dynamic import() of a real ESM module still
// gets routed through Jest's CJS module registry and fails ("Must use
// import to load ES Module"). Running this as a real `node` subprocess
// sidesteps that entirely — it's genuine Node ESM, not a Jest-transformed
// module — while still exercising the exact library the frontend uses to
// read an uploaded PDF.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const [, , pdfPath] = process.argv;
const data = new Uint8Array(readFileSync(pdfPath));
const doc = await getDocument({ data, isEvalSupported: false }).promise;

let text = "";
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  text += content.items.map((item) => item.str).join(" ");
}

process.stdout.write(text);
