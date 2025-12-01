
import { TextProcessMode } from '../types';

interface SrtCue {
  id: string;
  start: string;
  end: string;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

export interface TextProcessConfig {
  minLength: number;
  maxLength: number;
}

/**
 * Basic Helpers
 */
const stripTags = (s: string): string => s.replace(/<[^>]+>/g, '');

const parseTime = (timeString: string): number => {
  const parts = timeString.match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!parts) return 0;
  return (parseInt(parts[1], 10) * 3600000) + 
         (parseInt(parts[2], 10) * 60000) + 
         (parseInt(parts[3], 10) * 1000) + 
         parseInt(parts[4], 10);
};

const formatTime = (ms: number): string => {
  const date = new Date(0, 0, 0, 0, 0, 0, ms);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const mls = date.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s},${mls}`;
};

/**
 * Core Algorithm Helpers
 */

// Split text into chunks that do not exceed maxLength (word-aware)
const getChunksByLength = (text: string, maxLength: number): string[] => {
  if (stripTags(text).length <= maxLength) return [text];

  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLen = 0;

  for (const word of words) {
    const wordLen = stripTags(word).length;
    const spaceCost = currentChunk.length > 0 ? 1 : 0;

    if (currentLen + wordLen + spaceCost > maxLength) {
      if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentLen = wordLen;
    } else {
      currentChunk.push(word);
      currentLen += wordLen + spaceCost;
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));
  
  return chunks;
};

// Find the best split point to balance two parts of a text
const getBalancedSplit = (text: string, maxLength: number): [string, string] | null => {
  const words = text.split(' ');
  if (words.length < 2) return null;

  const totalLen = words.reduce((acc, w) => acc + stripTags(w).length, 0);
  const halfLen = totalLen / 2;
  
  let currentLen = 0;
  let bestSplitIndex = -1;
  let minDiff = Infinity;

  // Find index that gets closest to the middle
  for (let i = 0; i < words.length - 1; i++) {
    currentLen += stripTags(words[i]).length;
    const diff = Math.abs(currentLen - halfLen);
    if (diff < minDiff) {
      minDiff = diff;
      bestSplitIndex = i;
    }
  }

  if (bestSplitIndex !== -1) {
    const part1 = words.slice(0, bestSplitIndex + 1).join(' ');
    const part2 = words.slice(bestSplitIndex + 1).join(' ');

    // Ensure the split actually solves the length problem (both parts must be valid)
    if (stripTags(part1).length <= maxLength && stripTags(part2).length <= maxLength) {
      return [part1, part2];
    }
  }
  
  return null;
};

// Logic to decide which neighbor to merge with
const getMergeDirection = (prevText: string | null, nextText: string | null): 'PREV' | 'NEXT' | null => {
  if (!prevText && !nextText) return null;
  
  // If we have both neighbors, check punctuation of the previous one.
  // If previous ends with sentence closer (.?!), start a new block (merge with NEXT).
  // Otherwise default to merging with PREV to fill up lines.
  if (prevText && nextText) {
    const prevEndsSentence = /[.?!]["']?$/.test(prevText);
    return prevEndsSentence ? 'NEXT' : 'PREV';
  }
  
  return prevText ? 'PREV' : 'NEXT';
};

// Logic to try merging two texts. Returns array of 1 string (merged) or 2 strings (balanced) or null (fail).
const tryMergeTexts = (text1: string, text2: string, maxLength: number): string[] | null => {
  const combined = `${text1} ${text2}`;
  
  // Strategy 1: Simple Merge
  if (stripTags(combined).length <= maxLength) {
    return [combined];
  }

  // Strategy 2: Balance (Split combined text)
  const splitParts = getBalancedSplit(combined, maxLength);
  if (splitParts) {
    return splitParts;
  }

  return null; // Cannot optimize
};

/**
 * SRT Parsing & Serialization
 */
const parseSrt = (content: string): SrtCue[] => {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('\n\n');
  const cues: SrtCue[] = [];
  const timecodeRegex = /(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let id = "";
    let timeLineIndex = 0;

    if (timecodeRegex.test(lines[0])) {
      timeLineIndex = 0;
    } else if (lines.length > 1 && timecodeRegex.test(lines[1])) {
      id = lines[0].trim();
      timeLineIndex = 1;
    } else {
      continue;
    }

    const match = lines[timeLineIndex].match(timecodeRegex);
    if (!match) continue;

    const textLines = lines.slice(timeLineIndex + 1);
    const text = textLines.join(' ').replace(/\s+/g, ' ').trim(); 

    if (text) {
      cues.push({
        id,
        start: match[1],
        end: match[2],
        text,
        startTimeMs: parseTime(match[1]),
        endTimeMs: parseTime(match[2])
      });
    }
  }
  return cues;
};

const serializeSrt = (cues: SrtCue[]): string => {
  return cues.map((cue, index) => 
    `${index + 1}\n${cue.start} --> ${cue.end}\n${cue.text}`
  ).join('\n\n');
};

/**
 * SRT specific processing
 */
const splitLongCues = (cues: SrtCue[], maxLength: number): SrtCue[] => {
  const result: SrtCue[] = [];

  for (const cue of cues) {
    const chunks = getChunksByLength(cue.text, maxLength);
    
    if (chunks.length === 1) {
      result.push(cue);
      continue;
    }

    const duration = cue.endTimeMs - cue.startTimeMs;
    const totalLen = cue.text.length; 
    let currentStart = cue.startTimeMs;

    chunks.forEach((chunkText, idx) => {
      const isLast = idx === chunks.length - 1;
      const ratio = chunkText.length / totalLen;
      
      let chunkDuration = Math.floor(duration * ratio);
      let chunkEnd = isLast ? cue.endTimeMs : currentStart + chunkDuration;

      if (chunkEnd <= currentStart) chunkEnd = currentStart + 1;

      result.push({
        id: '', 
        start: formatTime(currentStart),
        end: formatTime(chunkEnd),
        startTimeMs: currentStart,
        endTimeMs: chunkEnd,
        text: chunkText
      });

      currentStart = chunkEnd;
    });
  }

  return result;
};

const optimizeShortCues = (cues: SrtCue[], minLength: number, maxLength: number): SrtCue[] => {
  const workingCues = [...cues.map(c => ({...c}))];
  let changed = true;
  let loops = 0;
  
  while (changed && loops < 5) {
    changed = false;
    loops++;

    for (let i = 0; i < workingCues.length; i++) {
      const current = workingCues[i];
      if (stripTags(current.text).length > minLength) continue;

      const prev = i > 0 ? workingCues[i - 1] : null;
      const next = i < workingCues.length - 1 ? workingCues[i + 1] : null;

      const direction = getMergeDirection(prev?.text ?? null, next?.text ?? null);
      if (!direction) continue;

      const neighbor = direction === 'PREV' ? prev! : next!;
      const text1 = direction === 'PREV' ? neighbor.text : current.text;
      const text2 = direction === 'PREV' ? current.text : neighbor.text;

      const mergedResult = tryMergeTexts(text1, text2, maxLength);

      if (mergedResult) {
        if (mergedResult.length === 1) {
          // Simple Merge
          if (direction === 'PREV') {
            neighbor.text = mergedResult[0];
            neighbor.end = current.end;
            neighbor.endTimeMs = current.endTimeMs;
          } else {
            neighbor.text = mergedResult[0];
            neighbor.start = current.start;
            neighbor.startTimeMs = current.startTimeMs;
          }
          workingCues.splice(i, 1);
          i--;
        } else {
          // Balanced Split
          const [part1, part2] = mergedResult;
          
          // Calculate time boundary
          const totalDur = (direction === 'PREV' ? current.endTimeMs : neighbor.endTimeMs) - 
                           (direction === 'PREV' ? neighbor.startTimeMs : current.startTimeMs);
          
          // Re-calculate ratio based on the newly balanced parts relative to full text
          const fullTextLen = part1.length + part2.length + 1; // +1 for space
          const ratio = part1.length / fullTextLen;
          
          const startBase = direction === 'PREV' ? neighbor.startTimeMs : current.startTimeMs;
          const boundaryTime = startBase + Math.floor(totalDur * ratio);
          const boundaryStr = formatTime(boundaryTime);

          if (direction === 'PREV') {
            neighbor.text = part1;
            neighbor.end = boundaryStr;
            neighbor.endTimeMs = boundaryTime;
            current.text = part2;
            current.start = boundaryStr;
            current.startTimeMs = boundaryTime;
          } else {
            current.text = part1;
            current.end = boundaryStr;
            current.endTimeMs = boundaryTime;
            neighbor.text = part2;
            neighbor.start = boundaryStr;
            neighbor.startTimeMs = boundaryTime;
          }
        }
        changed = true;
      }
    }
  }
  return workingCues;
};

/**
 * Plain Text specific processing
 */
const splitLongLines = (lines: string[], maxLength: number): string[] => {
  const result: string[] = [];
  for (const line of lines) {
    const chunks = getChunksByLength(line, maxLength);
    result.push(...chunks);
  }
  return result;
};

const optimizeShortLines = (lines: string[], minLength: number, maxLength: number): string[] => {
  const workingLines = [...lines];
  let changed = true;
  let loops = 0;
  
  while (changed && loops < 5) {
    changed = false;
    loops++;

    for (let i = 0; i < workingLines.length; i++) {
      const current = workingLines[i];
      if (current.length > minLength) continue;

      const prev = i > 0 ? workingLines[i - 1] : null;
      const next = i < workingLines.length - 1 ? workingLines[i + 1] : null;

      const direction = getMergeDirection(prev, next);
      if (!direction) continue;

      const text1 = direction === 'PREV' ? prev! : current;
      const text2 = direction === 'PREV' ? current : next!;

      const mergedResult = tryMergeTexts(text1, text2, maxLength);

      if (mergedResult) {
        if (mergedResult.length === 1) {
          // Simple Merge
          if (direction === 'PREV') {
            workingLines[i-1] = mergedResult[0];
          } else {
            workingLines[i+1] = mergedResult[0];
          }
          workingLines.splice(i, 1);
          i--;
        } else {
          // Balanced Split
          const [part1, part2] = mergedResult;
          if (direction === 'PREV') {
            workingLines[i-1] = part1;
            workingLines[i] = part2; 
          } else {
            workingLines[i] = part1;
            workingLines[i+1] = part2;
          }
        }
        changed = true;
      }
    }
  }
  return workingLines;
};


export const processTextFile = async (
  file: File, 
  mode: TextProcessMode,
  config: TextProcessConfig = { minLength: 10, maxLength: 32 }
): Promise<{ blob: Blob; count: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawText = e.target?.result as string;
        if (!rawText) throw new Error("파일 내용이 비어있습니다.");

        let outputText = "";
        let count = 0;

        // Simple detection for SRT
        const isSrt = /^\d+\s*\n\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(rawText) || rawText.includes('-->');

        if (isSrt) {
          let cues = parseSrt(rawText);

          if (mode === TextProcessMode.EXTRACT_TEXT) {
            const plainLines = cues.map(c => stripTags(c.text));
            outputText = plainLines.join('\n');
            count = plainLines.length;
          } else {
            // REFORMAT
            cues = splitLongCues(cues, config.maxLength);
            cues = optimizeShortCues(cues, config.minLength, config.maxLength);
            outputText = serializeSrt(cues);
            count = cues.length;
          }
        } else {
          // Plain Text Processing
          let lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          
          if (mode === TextProcessMode.EXTRACT_TEXT) {
            outputText = lines.join('\n');
            count = lines.length;
          } else {
            // REFORMAT
            lines = splitLongLines(lines, config.maxLength);
            lines = optimizeShortLines(lines, config.minLength, config.maxLength);
            outputText = lines.join('\n');
            count = lines.length;
          }
        }

        resolve({ 
          blob: new Blob([outputText], { type: 'text/plain;charset=utf-8' }), 
          count 
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
    reader.readAsText(file);
  });
};

/**
 * Generates a preview string for the UI based on the first few items
 */
export const generatePreview = async (
  file: File,
  mode: TextProcessMode,
  config: TextProcessConfig
): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawText = e.target?.result as string;
        if (!rawText) {
          resolve("미리보기를 불러올 수 없습니다.");
          return;
        }

        // Limit preview input to ensure speed, but enough for context
        // Read first 5000 chars roughly to get first few lines
        const previewRaw = rawText.substring(0, 5000); 
        const isSrt = /^\d+\s*\n\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(previewRaw) || previewRaw.includes('-->');
        const limit = 5; // How many items to show

        if (isSrt) {
          let cues = parseSrt(previewRaw);
          // Slice first N cues for preview processing
          cues = cues.slice(0, Math.min(cues.length, 8)); // Take slightly more for context merging

          if (mode === TextProcessMode.EXTRACT_TEXT) {
            const plainLines = cues.map(c => stripTags(c.text)).slice(0, limit);
            resolve(plainLines.join('\n'));
          } else {
            cues = splitLongCues(cues, config.maxLength);
            cues = optimizeShortCues(cues, config.minLength, config.maxLength);
            // Limit output
            resolve(serializeSrt(cues.slice(0, limit)) + (cues.length > limit ? '\n\n...' : ''));
          }
        } else {
          let lines = previewRaw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          lines = lines.slice(0, Math.min(lines.length, 12));

          if (mode === TextProcessMode.EXTRACT_TEXT) {
            resolve(lines.slice(0, limit).join('\n'));
          } else {
            lines = splitLongLines(lines, config.maxLength);
            lines = optimizeShortLines(lines, config.minLength, config.maxLength);
            resolve(lines.slice(0, limit).join('\n') + (lines.length > limit ? '\n...' : ''));
          }
        }

      } catch (e) {
        resolve("미리보기 생성 중 오류가 발생했습니다.");
      }
    };
    // If file is huge, reading all might be slow, but usually text files are fine.
    // Optimization: slice blob before reading
    const slice = file.slice(0, 5000); 
    reader.readAsText(slice);
  });
};
