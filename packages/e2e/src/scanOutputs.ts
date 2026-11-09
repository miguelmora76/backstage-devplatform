import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

export interface Hit {
  /** Where the text was found: a file, a zip entry (file!entry) or a named text. */
  where: string;
  kind: 'secret' | 'token-shape' | 'bearer';
}

export interface ScanInput {
  folders: string[];
  /** Named text blobs, such as the compose logs. */
  texts?: Record<string, string>;
  /** Values that must not appear anywhere: the database password, every token obtained. */
  secrets: string[];
}

const MIN_SECRET_LENGTH = 8;
const TOKEN_SHAPE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]{8,}=*/;

export interface ZipEntry {
  name: string;
  content: string;
}

/** Reads a zip through its central directory (stored and deflated entries). */
export function readZipEntries(buffer: Buffer): ZipEntry[] {
  let end = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) {
    throw new Error('Not a zip file: no end-of-directory record.');
  }
  const count = buffer.readUInt16LE(end + 10);
  let pos = buffer.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error('Not a zip file: bad directory entry.');
    }
    const method = buffer.readUInt16LE(pos + 10);
    const size = buffer.readUInt32LE(pos + 20);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const local = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength);
    const dataStart =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    const body = buffer.subarray(dataStart, dataStart + size);
    const data = method === 8 ? inflateRawSync(body) : body;
    entries.push({ name, content: data.toString('utf8') });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function scanText(text: string, where: string, secrets: string[]): Hit[] {
  const hits: Hit[] = [];
  if (secrets.some(secret => text.includes(secret))) {
    hits.push({ where, kind: 'secret' });
  }
  if (TOKEN_SHAPE.test(text)) hits.push({ where, kind: 'token-shape' });
  if (BEARER.test(text)) hits.push({ where, kind: 'bearer' });
  return hits;
}

function scanFile(path: string, secrets: string[]): Hit[] {
  const buffer = readFileSync(path);
  if (path.endsWith('.zip')) {
    try {
      return readZipEntries(buffer).flatMap(entry =>
        scanText(entry.content, `${path}!${entry.name}`, secrets),
      );
    } catch {
      // Not a readable zip: scan the raw bytes instead.
    }
  }
  return scanText(buffer.toString('latin1'), path, secrets);
}

function walk(dir: string, secrets: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    hits.push(
      ...(statSync(path).isDirectory()
        ? walk(path, secrets)
        : scanFile(path, secrets)),
    );
  }
  return hits;
}

/**
 * Searches the compose logs and every file of the report folders (zip entries
 * too) for the database password, every token obtained and any token-shaped
 * text (NFR5.10). A hit names where, never the value.
 */
export function scanOutputs(input: ScanInput): Hit[] {
  const secrets = input.secrets.filter(
    secret => secret.length >= MIN_SECRET_LENGTH,
  );
  const hits: Hit[] = [];
  for (const [name, text] of Object.entries(input.texts ?? {})) {
    hits.push(...scanText(text, name, secrets));
  }
  for (const folder of input.folders) {
    if (existsSync(folder)) hits.push(...walk(folder, secrets));
  }
  return hits;
}
