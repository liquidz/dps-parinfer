import { parinfer } from "./deps.ts";
import {
  Difference,
  ParinferChange,
  ParinferFn,
  ParinferMode,
  ParinferOption,
  ParinferResult,
} from "./types.ts";
import { diffChars, diffLines } from "./diff.ts";

function modeToFunction(mode: ParinferMode): ParinferFn {
  if (mode === "indent") {
    return parinfer.indentMode;
  } else if (mode === "paren") {
    return parinfer.parenMode;
  }
  return parinfer.smartMode;
}

function countNewLine(s: string): number {
  return [...s.matchAll(/\r?\n/g)].length;
}

function getLinesChangesFromDiffs(lineDiffs: Difference[]): ParinferChange[] {
  const res: ParinferChange[] = [];
  let lineNo = 0;

  for (const d of lineDiffs) {
    if (d.added) {
      res.push({ lineNo: lineNo, x: 0, oldText: "", newText: d.value });
    }
    lineNo += countNewLine(d.value);
  }

  return res;
}

function getCharsChanges(before: string, after: string): ParinferChange[] {
  const res: ParinferChange[] = [];
  let x = 0;
  let lineNo = 0;

  for (const d of diffChars(before, after)) {
    if (d.added) {
      res.push({ lineNo: lineNo, x: x, oldText: "", newText: d.value });
      const lineCnt = countNewLine(d.value);
      lineNo += lineCnt;
      if (lineCnt > 0) {
        x = d.value.length - (d.value.lastIndexOf("\n") + 1);
      } else {
        x += d.value.length;
      }
    } else if (d.removed) {
      res.push({ lineNo: lineNo, x: x, oldText: d.value, newText: "" });
    } else {
      const lineCnt = countNewLine(d.value);
      lineNo += lineCnt;
      if (lineCnt > 0) {
        x = d.value.length - (d.value.lastIndexOf("\n") + 1);
      } else {
        x += d.value.length;
      }
    }
  }

  return res;
}

export function getChanges(before: string, after: string): ParinferChange[] {
  const lineDiffs = diffLines(before, after);

  // Only when lines are added
  if (lineDiffs.every((d) => d.removed === undefined)) {
    return getLinesChangesFromDiffs(lineDiffs);
  }

  return getCharsChanges(before, after);
}

export function applyParinfer(
  mode: ParinferMode,
  text: string,
  option: ParinferOption,
): Promise<ParinferResult> {
  return new Promise((resolve, reject) => {
    const fn = modeToFunction(mode);
    const ret = fn(text, option);
    if (ret.success) {
      resolve(ret);
    } else {
      reject(ret.error!.message);
    }
  });
}
