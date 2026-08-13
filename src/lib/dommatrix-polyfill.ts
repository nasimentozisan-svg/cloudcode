import CSSMatrix from "dommatrix";

// pdfjs-dist's legacy build references the browser's DOMMatrix at module
// evaluation time (for its internal transform utilities), which doesn't
// exist in Node.js. Side-effect import this before importing pdfjs-dist so
// ECMAScript's module evaluation order guarantees the polyfill is in place
// first.
if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === "undefined") {
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = CSSMatrix;
}
