import { useRef, useState } from 'react';
import type { WordItem } from '../types/game';

interface Chunk {
  id: string;
  start: number;
  end: number;
  text: string;
}

type ImportMode = 'lines' | 'sentences' | 'manual' | 'math';

interface UseManualHighlightingArgs {
  manualInput: string;
  importMode: ImportMode;
  setWords: (words: WordItem[]) => void;
}

const chunksToWords = (chunks: Chunk[]): WordItem[] =>
  chunks.map((c) => ({ id: c.id, targetWord: c.text.trim(), isCompleted: false }));

/**
 * Kapselt das manuelle Highlighting (Wörter/Chunks im Text markieren):
 * Chunk-State, Segment-/Token-Berechnung, Klick- und Auswahl-Handler.
 * Verhalten unverändert gegenüber der vorherigen Inline-Version.
 */
export const useManualHighlighting = ({ manualInput, importMode, setWords }: UseManualHighlightingArgs) => {
  const [manualChunks, setManualChunks] = useState<Chunk[]>([]);
  const highlightContainerRef = useRef<HTMLDivElement>(null);

  const getSegments = () => {
    const segments: Array<{ start: number; end: number; text: string; isHighlighted: boolean; chunkId?: string }> = [];
    const sortedChunks = [...manualChunks].sort((a, b) => a.start - b.start);
    let lastIndex = 0;

    for (const chunk of sortedChunks) {
      if (chunk.start > lastIndex) {
        segments.push({
          start: lastIndex,
          end: chunk.start,
          text: manualInput.substring(lastIndex, chunk.start),
          isHighlighted: false,
        });
      }
      segments.push({
        start: chunk.start,
        end: chunk.end,
        text: chunk.text,
        isHighlighted: true,
        chunkId: chunk.id,
      });
      lastIndex = chunk.end;
    }

    if (lastIndex < manualInput.length) {
      segments.push({
        start: lastIndex,
        end: manualInput.length,
        text: manualInput.substring(lastIndex),
        isHighlighted: false,
      });
    }

    return segments;
  };

  const tokenizeText = (text: string, segmentStart: number) => {
    const tokens: Array<{ text: string; start: number; end: number; isWord: boolean }> = [];
    const regex = /(\p{L}+|\p{N}+)/gu;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const wordText = match[0];
      const end = regex.lastIndex;

      if (start > lastIndex) {
        tokens.push({
          text: text.substring(lastIndex, start),
          start: segmentStart + lastIndex,
          end: segmentStart + start,
          isWord: false,
        });
      }

      tokens.push({
        text: wordText,
        start: segmentStart + start,
        end: segmentStart + end,
        isWord: true,
      });

      lastIndex = end;
    }

    if (lastIndex < text.length) {
      tokens.push({
        text: text.substring(lastIndex),
        start: segmentStart + lastIndex,
        end: segmentStart + text.length,
        isWord: false,
      });
    }

    return tokens;
  };

  const getTokens = () => tokenizeText(manualInput, 0);

  const handleWordClick = (start: number, end: number, wordText: string) => {
    if (importMode !== 'manual') return;

    // Check if this word is already in an existing chunk
    const existingChunkIndex = manualChunks.findIndex((c) => start >= c.start && end <= c.end);

    if (existingChunkIndex !== -1) {
      // Remove this chunk
      handleDeleteChunk(manualChunks[existingChunkIndex].id);
      return;
    }

    // Check if we can merge with adjacent highlighted chunks
    const tokens = getTokens();
    const clickedTokenIdx = tokens.findIndex((t) => t.start === start && t.end === end);
    if (clickedTokenIdx === -1) return;

    // Find nearest highlighted chunk to the left (no other words in between)
    let leftChunkIdx = -1;
    let canMergeLeft = false;
    let searchIdx = clickedTokenIdx - 1;
    while (searchIdx >= 0) {
      const t = tokens[searchIdx];
      if (t.isWord) {
        const chunk = manualChunks.find((c) => t.start >= c.start && t.end <= c.end);
        if (chunk) {
          leftChunkIdx = manualChunks.indexOf(chunk);
          canMergeLeft = true;
        }
        break;
      }
      searchIdx--;
    }

    // Find nearest highlighted chunk to the right (no other words in between)
    let rightChunkIdx = -1;
    let canMergeRight = false;
    searchIdx = clickedTokenIdx + 1;
    while (searchIdx < tokens.length) {
      const t = tokens[searchIdx];
      if (t.isWord) {
        const chunk = manualChunks.find((c) => t.start >= c.start && t.end <= c.end);
        if (chunk) {
          rightChunkIdx = manualChunks.indexOf(chunk);
          canMergeRight = true;
        }
        break;
      }
      searchIdx++;
    }

    let newChunks = [...manualChunks];

    if (canMergeLeft && canMergeRight && leftChunkIdx !== -1 && rightChunkIdx !== -1 && leftChunkIdx !== rightChunkIdx) {
      // Merge left and right chunks with clicked word!
      const leftChunk = manualChunks[leftChunkIdx];
      const rightChunk = manualChunks[rightChunkIdx];
      const mergedStart = leftChunk.start;
      const mergedEnd = rightChunk.end;
      const mergedText = manualInput.substring(mergedStart, mergedEnd);

      newChunks = newChunks.filter((_, i) => i !== leftChunkIdx && i !== rightChunkIdx);
      newChunks.push({
        id: crypto.randomUUID(),
        start: mergedStart,
        end: mergedEnd,
        text: mergedText,
      });
    } else if (canMergeLeft && leftChunkIdx !== -1) {
      // Merge left chunk with clicked word
      const leftChunk = manualChunks[leftChunkIdx];
      const mergedStart = leftChunk.start;
      const mergedEnd = end;
      const mergedText = manualInput.substring(mergedStart, mergedEnd);
      newChunks[leftChunkIdx] = {
        ...leftChunk,
        end: mergedEnd,
        text: mergedText,
      };
    } else if (canMergeRight && rightChunkIdx !== -1) {
      // Merge right chunk with clicked word
      const rightChunk = manualChunks[rightChunkIdx];
      const mergedStart = start;
      const mergedEnd = rightChunk.end;
      const mergedText = manualInput.substring(mergedStart, mergedEnd);
      newChunks[rightChunkIdx] = {
        ...rightChunk,
        start: mergedStart,
        text: mergedText,
      };
    } else {
      // Create new single-word chunk
      newChunks.push({
        id: crypto.randomUUID(),
        start,
        end,
        text: wordText,
      });
    }

    newChunks.sort((a, b) => a.start - b.start);
    setManualChunks(newChunks);
    setWords(chunksToWords(newChunks));
  };

  const handleMouseUp = () => {
    if (importMode !== 'manual') return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = highlightContainerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    // Absoluten Start-Index berechnen, indem alles bis zum Klick geklont und gemessen wird
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);

    let start = preSelectionRange.toString().length;
    let end = start + range.toString().length;

    // Auto-Trim: Leerzeichen am Anfang und Ende ignorieren
    const selectedString = manualInput.substring(start, end);
    const trimStartOffset = selectedString.length - selectedString.trimStart().length;
    const trimEndOffset = selectedString.length - selectedString.trimEnd().length;

    start += trimStartOffset;
    end -= trimEndOffset;

    if (start >= end) {
      selection.removeAllRanges();
      return;
    }

    // Check overlap with existing chunks
    const hasOverlap = manualChunks.some(
      (chunk) => Math.max(start, chunk.start) < Math.min(end, chunk.end)
    );

    if (hasOverlap) {
      selection.removeAllRanges();
      return;
    }

    const chunkText = manualInput.substring(start, end);
    const newChunk = {
      id: crypto.randomUUID(),
      start,
      end,
      text: chunkText,
    };

    const updatedChunks = [...manualChunks, newChunk].sort((a, b) => a.start - b.start);
    setManualChunks(updatedChunks);
    setWords(chunksToWords(updatedChunks));

    // Clear selection
    selection.removeAllRanges();
  };

  const handleDeleteChunk = (chunkId: string) => {
    const updatedChunks = manualChunks.filter((c) => c.id !== chunkId);
    setManualChunks(updatedChunks);
    setWords(chunksToWords(updatedChunks));
  };

  const handleResetChunks = () => {
    setManualChunks([]);
    setWords([]);
  };

  /** Nur Chunks leeren (z. B. wenn der Rohtext geändert wird). */
  const resetChunks = () => setManualChunks([]);

  /** Aktuelle Chunks als Wörter in den Store schreiben (Wechsel in den Manuell-Modus). */
  const applyChunksToWords = () => {
    setWords(chunksToWords([...manualChunks].sort((a, b) => a.start - b.start)));
  };

  return {
    manualChunks,
    highlightContainerRef,
    getSegments,
    tokenizeText,
    handleWordClick,
    handleMouseUp,
    handleDeleteChunk,
    handleResetChunks,
    resetChunks,
    applyChunksToWords,
  };
};
