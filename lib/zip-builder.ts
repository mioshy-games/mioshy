/**
 * Minimal pure-JavaScript ZIP builder (PKZip STORE method, no compression).
 * No external dependencies — uses only TextEncoder and DataView.
 *
 * Limitations:
 *   • Files > 4 GB not supported (uint32 size fields)
 *   • Only UTF-8 file names
 */

// ---------------------------------------------------------------------------
// CRC-32 (standard polynomial 0xEDB88320)
// ---------------------------------------------------------------------------

const CRC_TABLE = /* @__PURE__ */ (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// DOS time encoding
// ---------------------------------------------------------------------------

function dosDateTime(): { time: number; date: number } {
  const n = new Date();
  return {
    time:
      ((n.getSeconds() >> 1) & 0x1f) |
      ((n.getMinutes() & 0x3f) << 5) |
      ((n.getHours() & 0x1f) << 11),
    date:
      (n.getDate() & 0x1f) |
      (((n.getMonth() + 1) & 0x0f) << 5) |
      (((n.getFullYear() - 1980) & 0x7f) << 9),
  };
}

// ---------------------------------------------------------------------------
// concat helper
// ---------------------------------------------------------------------------

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ZipEntry = {
  /** File name inside the ZIP (may contain path separators, e.g. "folder/file.csv") */
  name: string;
  /** UTF-8 file content */
  content: string;
};

/**
 * Build a ZIP archive (STORE, no compression) and return it as a Uint8Array.
 * Suitable for use in Next.js API route responses.
 *
 * @example
 * const zip = buildZip([
 *   { name: "programs.csv", content: "id,name\n1,Intimacy" },
 *   { name: "items.csv",    content: "id,title\n1,Day 1" },
 * ]);
 * return new Response(zip, { headers: { "content-type": "application/zip" } });
 */
export function buildZip(files: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const { time: dosT, date: dosD } = dosDateTime();

  const localHeaders: Uint8Array[] = [];
  const centralEntries: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameB = enc.encode(file.name);
    const dataB = enc.encode(file.content);
    const crc = crc32(dataB);
    const size = dataB.length;

    // ── Local file header (30 bytes) + name + data ──────────────────────────
    const lh = new Uint8Array(30 + nameB.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true);          // version needed (2.0)
    lv.setUint16(6, 0, true);           // general purpose bit flag
    lv.setUint16(8, 0, true);           // compression method: STORE
    lv.setUint16(10, dosT, true);       // last mod file time
    lv.setUint16(12, dosD, true);       // last mod file date
    lv.setUint32(14, crc, true);        // crc-32
    lv.setUint32(18, size, true);       // compressed size
    lv.setUint32(22, size, true);       // uncompressed size
    lv.setUint16(26, nameB.length, true); // file name length
    lv.setUint16(28, 0, true);          // extra field length
    lh.set(nameB, 30);

    offsets.push(offset);
    localHeaders.push(lh);
    localHeaders.push(dataB);
    offset += lh.length + dataB.length;

    // ── Central directory record (46 bytes) + name ──────────────────────────
    const cd = new Uint8Array(46 + nameB.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);  // signature
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(8, 0, true);            // general purpose bit flag
    cv.setUint16(10, 0, true);           // compression method: STORE
    cv.setUint16(12, dosT, true);        // last mod file time
    cv.setUint16(14, dosD, true);        // last mod file date
    cv.setUint32(16, crc, true);         // crc-32
    cv.setUint32(20, size, true);        // compressed size
    cv.setUint32(24, size, true);        // uncompressed size
    cv.setUint16(28, nameB.length, true); // file name length
    cv.setUint16(30, 0, true);           // extra field length
    cv.setUint16(32, 0, true);           // file comment length
    cv.setUint16(34, 0, true);           // disk number start
    cv.setUint16(36, 0, true);           // internal file attributes
    cv.setUint32(38, 0, true);           // external file attributes
    cv.setUint32(42, offsets[offsets.length - 1], true); // relative offset of local header
    cd.set(nameB, 46);

    centralEntries.push(cd);
  }

  // ── End of central directory record (22 bytes) ──────────────────────────
  const cdSize = centralEntries.reduce((s, e) => s + e.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);       // signature
  ev.setUint16(4, 0, true);                 // number of this disk
  ev.setUint16(6, 0, true);                 // disk where cd starts
  ev.setUint16(8, files.length, true);      // entries on this disk
  ev.setUint16(10, files.length, true);     // total entries
  ev.setUint32(12, cdSize, true);           // size of central directory
  ev.setUint32(16, offset, true);           // offset of central directory
  ev.setUint16(20, 0, true);                // ZIP comment length

  return concat([...localHeaders, ...centralEntries, eocd]);
}
