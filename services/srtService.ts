
import { SrtMode } from '../types';

interface SrtCue {
  id: string;
  start: string;
  end: string;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

/**
 * Helpers
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
    } else if (timecodeRegex.test(lines[1])) {
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
 * Split cues longer than maxLength into multiple cues with interpolated timestamps.
 */
const splitLongCues = (cues: SrtCue[], maxLength: number): SrtCue[] => {
  const result: SrtCue[] = [];

  for (const cue of cues) {
    if (stripTags(cue.text).length <= maxLength) {
      result.push(cue);
      continue;
    }

    const words = cue.text.split(' ');
    const duration = cue.endTimeMs - cue.startTimeMs;
    const totalLen = cue.text.length; 
    
    let currentChunkWords: string[] = [];
    let currentChunkLen = 0;
    let chunks: string[] = [];

    // Word wrap
    for (const word of words) {
      const wordLen = stripTags(word).length;
      if (currentChunkLen + wordLen + (currentChunkWords.length > 0 ? 1 : 0) > maxLength) {
        chunks.push(currentChunkWords.join(' '));
        currentChunkWords = [word];
        currentChunkLen = wordLen;
      } else {
        if (currentChunkWords.length > 0) currentChunkLen += 1;
        currentChunkWords.push(word);
        currentChunkLen += wordLen;
      }
    }
    if (currentChunkWords.length > 0) {
      chunks.push(currentChunkWords.join(' '));
    }

    // Create new cues
    let currentStart = cue.startTimeMs;
    chunks.forEach((chunkText, idx) => {
      const isLast = idx === chunks.length - 1;
      const ratio = chunkText.length / totalLen;
      let chunkDuration = Math.floor(duration * ratio);
      
      let chunkEnd = isLast ? cue.endTimeMs : currentStart + chunkDuration;

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

/**
 * Merge or balance short cues (<= 10 chars) with neighbors.
 */
const optimizeShortCues = (cues: SrtCue[]): SrtCue[] => {
  let changed = true;
  let loops = 0;
  
  while (changed && loops < 5) {
    changed = false;
    loops++;

    for (let i = 0; i < cues.length; i++) {
      const current = cues[i];
      if (stripTags(current.text).length > 10) continue;

      const prev = i > 0 ? cues[i - 1] : null;
      const next = i < cues.length - 1 ? cues[i + 1] : null;

      if (!prev && !next) continue;

      // Decide merge direction
      const prevEndsSentence = prev ? /[.?!]["']?$/.test(prev.text) : false;
      let target: 'PREV' | 'NEXT' = (prev && next) 
        ? (prevEndsSentence ? 'NEXT' : 'PREV') 
        : (prev ? 'PREV' : 'NEXT');

      const neighbor = target === 'PREV' ? prev! : next!;
      const combinedText = target === 'PREV' 
        ? `${neighbor.text} ${current.text}`
        : `${current.text} ${neighbor.text}`;
      
      // Strategy 1: Simple Merge
      if (stripTags(combinedText).length <= 32) {
        if (target === 'PREV') {
          neighbor.text = combinedText;
          neighbor.end = current.end;
          neighbor.endTimeMs = current.endTimeMs;
        } else {
          neighbor.text = combinedText;
          neighbor.start = current.start;
          neighbor.startTimeMs = current.startTimeMs;
        }
        cues.splice(i, 1);
        i--; 
        changed = true;
        continue;
      }

      // Strategy 2: Balance (Split combined text)
      const words = combinedText.split(' ');
      const totalLen = words.reduce((acc, w) => acc + w.length, 0);
      const halfLen = totalLen / 2;
      
      let currentLen = 0;
      let bestSplitIndex = -1;
      let minDiff = Infinity;

      for (let wIdx = 0; wIdx < words.length - 1; wIdx++) {
        currentLen += words[wIdx].length;
        const diff = Math.abs(currentLen - halfLen);
        if (diff < minDiff) {
          minDiff = diff;
          bestSplitIndex = wIdx;
        }
      }

      if (bestSplitIndex !== -1) {
        const part1 = words.slice(0, bestSplitIndex + 1).join(' ');
        const part2 = words.slice(bestSplitIndex + 1).join(' ');

        // Skip if balancing fails to solve the length issue
        if (part1.length > 32 || part2.length > 32) continue;

        // Recalculate boundary
        const totalDur = (target === 'PREV' ? current.endTimeMs : neighbor.endTimeMs) - 
                         (target === 'PREV' ? neighbor.startTimeMs : current.startTimeMs);
        const ratio = part1.length / combinedText.length;
        const boundaryTime = (target === 'PREV' ? neighbor.startTimeMs : current.startTimeMs) + Math.floor(totalDur * ratio);
        const boundaryStr = formatTime(boundaryTime);

        if (target === 'PREV') {
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
        changed = true;
      }
    }
  }
  return cues;
};

export const processSrtFile = async (file: File, mode: SrtMode): Promise<{ blob: Blob; count: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawText = e.target?.result as string;
        if (!rawText) throw new Error("파일 내용이 비어있습니다.");

        let outputText = "";
        let count = 0;
        let cues = parseSrt(rawText);

        if (mode === SrtMode.EXTRACT_ONLY) {
          const plainLines = cues.map(c => stripTags(c.text));
          outputText = plainLines.join('\n');
          count = plainLines.length;
        } else {
          // REFORMAT_32
          cues = splitLongCues(cues, 32);
          cues = optimizeShortCues(cues);
          outputText = serializeSrt(cues);
          count = cues.length;
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
