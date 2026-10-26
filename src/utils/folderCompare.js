// Loading folders, file sets and ZIP archives into a common { path → entry } map, and comparing two maps.
import JSZip from 'jszip';

const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const IGNORED = [/(^|\/)\.git\//, /(^|\/)\.DS_Store$/, /(^|\/)Thumbs\.db$/, /(^|\/)__MACOSX\//];

/** entry: { path, size, read: () => Promise<Uint8Array> } */

const isIgnored = (path) => IGNORED.some((re) => re.test(path));

/** Drops a single top-level folder shared by every path ("project/src/a.js" → "src/a.js"). */
function stripCommonRoot(entries) {
  if (entries.length === 0) return { entries, root: null };
  const first = entries[0].path.split('/')[0];
  const shared = entries.every((e) => e.path.includes('/') && e.path.split('/')[0] === first);
  if (!shared) return { entries, root: null };
  return { entries: entries.map((e) => ({ ...e, path: e.path.slice(first.length + 1) })), root: first };
}

function finish(entries, label) {
  const kept = entries.filter((e) => !isIgnored(e.path));
  const total = kept.reduce((n, e) => n + e.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error(`${label} is larger than ${MAX_TOTAL_BYTES / 1048576} MB`);
  const { entries: stripped, root } = stripCommonRoot(kept);
  return { entries: stripped, root, label: root || label, total };
}

/** From an <input type="file" webkitdirectory|multiple> FileList. */
export function loadFileList(fileList, label = 'Selection') {
  const entries = Array.from(fileList, (file) => ({
    path: (file.webkitRelativePath || file.relativePath || file.name).replace(/\\/g, '/'),
    size: file.size,
    read: () => file.arrayBuffer().then((b) => new Uint8Array(b)),
  }));
  return finish(entries, label);
}

export async function loadZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  zip.forEach((path, obj) => {
    if (obj.dir) return;
    entries.push({
      path,
      // Uncompressed size is in the central directory; JSZip keeps it on _data
      size: obj._data?.uncompressedSize ?? 0,
      read: () => obj.async('uint8array'),
    });
  });
  return finish(entries, file.name);
}

/** Reads dropped items, walking directories via the File System Entry API. */
export async function loadDataTransfer(dataTransfer) {
  const items = Array.from(dataTransfer.items || []).map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (items.length === 1 && items[0].isFile && /\.zip$/i.test(items[0].name)) {
    return loadZip(dataTransfer.files[0]);
  }
  if (items.length === 0) return loadFileList(dataTransfer.files);

  const files = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      files.push({ path: prefix + entry.name, size: file.size, read: () => file.arrayBuffer().then((b) => new Uint8Array(b)) });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      // readEntries returns results in batches until an empty batch
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const item of items) await walk(item, '');
  const label = items.length === 1 ? items[0].name : `${items.length} items`;
  return finish(files, label);
}

// ---- Comparison ----

const sameBytes = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export const isBinary = (bytes) => {
  const n = Math.min(bytes.length, 8000);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
  return false;
};

/**
 * Compares two loaded sources. Files with equal sizes are compared byte by byte.
 * onProgress(done, total) is called while reading.
 */
export async function compareSources(left, right, { onProgress } = {}) {
  const lmap = new Map(left.entries.map((e) => [e.path, e]));
  const rmap = new Map(right.entries.map((e) => [e.path, e]));
  const paths = [...new Set([...lmap.keys(), ...rmap.keys()])].sort((a, b) => a.localeCompare(b));

  const results = [];
  let done = 0;
  for (const path of paths) {
    const l = lmap.get(path);
    const r = rmap.get(path);
    let status;
    if (!l) status = 'added';
    else if (!r) status = 'removed';
    else if (l.size !== r.size && l.size && r.size) status = 'modified';
    else {
      const [lb, rb] = await Promise.all([l.read(), r.read()]);
      status = sameBytes(lb, rb) ? 'same' : 'modified';
    }
    results.push({ path, status, left: l, right: r });
    done++;
    if (onProgress && (done % 25 === 0 || done === paths.length)) {
      onProgress(done, paths.length);
      // Yield so the progress indicator can paint
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  return results;
}

/** Builds a folder tree from flat results; folders carry aggregated counts. */
export function buildTree(results) {
  const root = { name: '', path: '', children: new Map(), counts: { added: 0, removed: 0, modified: 0, same: 0 } };
  for (const item of results) {
    const parts = item.path.split('/');
    let node = root;
    node.counts[item.status]++;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');
      if (isFile) {
        node.children.set(part, { name: part, path, file: item });
      } else {
        if (!node.children.has(part)) {
          node.children.set(part, { name: part, path, children: new Map(), counts: { added: 0, removed: 0, modified: 0, same: 0 } });
        }
        node = node.children.get(part);
        node.counts[item.status]++;
      }
    });
  }
  return root;
}
