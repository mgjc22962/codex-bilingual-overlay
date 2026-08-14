const DEFAULT_MAX_CHUNK_CHARS = 900;
const SENTENCE_PATTERN = /[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/gu;

function splitOversizedSentence(sentence, maxChunkChars) {
  const chunks = [];
  let remaining = sentence.trim();
  while (remaining.length > maxChunkChars) {
    const window = remaining.slice(0, maxChunkChars + 1);
    const breakAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const end = breakAt >= Math.floor(maxChunkChars * 0.55) ? breakAt : maxChunkChars;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function splitParagraph(paragraph, maxChunkChars) {
  if (paragraph.length <= maxChunkChars) return [paragraph];
  const sentences = (paragraph.match(SENTENCE_PATTERN) ?? [paragraph])
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => (
      value.length > maxChunkChars
        ? splitOversizedSentence(value, maxChunkChars)
        : [value]
    ));
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    const combined = current ? `${current} ${sentence}` : sentence;
    if (current && combined.length > maxChunkChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current = combined;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function splitStructuredText(source, maxChunkChars = DEFAULT_MAX_CHUNK_CHARS) {
  if (!Number.isInteger(maxChunkChars) || maxChunkChars < 16) {
    throw new Error("maxChunkChars must be an integer of at least 16");
  }
  const normalized = String(source ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized
    .split(/\n[\t ]*\n+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  return paragraphs.flatMap((paragraph, index) => (
    splitParagraph(paragraph, maxChunkChars)
      .map((chunk) => ({ paragraph: index, chunk }))
  ));
}

function joinTranslatedChunks(chunks) {
  return chunks.reduce((result, chunk) => {
    if (!result) return chunk;
    const needsSpace = !/[\s\n。！？；：]$/u.test(result) && !/^[\s\n，。！？；：]/u.test(chunk);
    return `${result}${needsSpace ? " " : ""}${chunk}`;
  }, "");
}

export async function translateStructuredText(source, translateChunk) {
  if (typeof translateChunk !== "function") throw new Error("translateChunk must be a function");
  const structured = splitStructuredText(source);
  const translatedByParagraph = new Map();
  for (const { paragraph, chunk } of structured) {
    const translated = String(await translateChunk(chunk) ?? "").trim();
    if (!translated) throw new Error("Full-text translation returned an empty chunk");
    const chunks = translatedByParagraph.get(paragraph) ?? [];
    chunks.push(translated);
    translatedByParagraph.set(paragraph, chunks);
  }
  return [...translatedByParagraph.keys()]
    .sort((a, b) => a - b)
    .map((paragraph) => joinTranslatedChunks(translatedByParagraph.get(paragraph)))
    .join("\n\n");
}
