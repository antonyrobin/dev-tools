// Runs regex matching off the main thread so a catastrophic pattern can be killed by a timeout.
const MAX_MATCHES = 5000;

self.onmessage = (e) => {
  const { id, pattern, flags, text, replacement, doReplace } = e.data;
  try {
    const regex = new RegExp(pattern, flags.includes('d') ? flags : `${flags}d`);
    const matches = [];
    if (regex.global || regex.sticky) {
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        matches.push(serialize(m));
        if (m[0] === '') regex.lastIndex += (regex.unicode && text.codePointAt(m.index) > 0xffff) ? 2 : 1;
        if (matches.length >= MAX_MATCHES) break;
      }
    } else {
      const m = regex.exec(text);
      if (m) matches.push(serialize(m));
    }
    const replaced = doReplace ? text.replace(new RegExp(pattern, flags), replacement) : null;
    self.postMessage({ id, matches, replaced, truncated: matches.length >= MAX_MATCHES });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};

function serialize(m) {
  return {
    index: m.index,
    end: m.index + m[0].length,
    text: m[0],
    groups: m.slice(1).map((g, i) => ({
      value: g,
      start: m.indices?.[i + 1]?.[0],
      end: m.indices?.[i + 1]?.[1],
    })),
    named: m.groups ? { ...m.groups } : null,
  };
}
