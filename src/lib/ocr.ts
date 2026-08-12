import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";

const langPath = path.join(
  process.cwd(),
  "node_modules/@tesseract.js-data/jpn/4.0.0_best_int"
);

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("jpn", 1, {
      langPath,
      gzip: true,
      cachePath: "/tmp/tesseract-cache",
    });
  }
  return workerPromise;
}

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(buffer);
  return text;
}
