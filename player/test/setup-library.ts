// Loads the parts library from disk before any test builds a BikeModel (the app fetches it at start).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadLibrary } from '../src/stage/library.js';

const file = readFileSync(resolve(import.meta.dirname, '../public/parts/library.glb'));
await loadLibrary(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
