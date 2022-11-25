import { diff, parinfer } from "./deps.ts";
import {
  ParinferChange,
  ParinferFn,
  ParinferMode,
  ParinferOption,
  ParinferResult,
} from "./type.ts";

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

export function getChanges(before: string, after: string): ParinferChange[] {
  let x = 0;
  let lineNo = 0;
  const res: ParinferChange[] = [];

  for (const d of diff.diffChars(before, after)) {
    if (d.added) {
      res.push({ lineNo: lineNo, x: x, oldText: "", newText: d.value });
      const lineCnt = countNewLine(d.value);
      lineNo += lineCnt;
      if (lineCnt > 0) {
        x = d.value.length - (d.value.lastIndexOf("\n") + 1);
      } else {
        x += d.count;
      }
    } else if (d.removed) {
      res.push({ lineNo: lineNo, x: x, oldText: d.value, newText: "" });
    } else {
      const lineCnt = countNewLine(d.value);
      lineNo += lineCnt;
      if (lineCnt > 0) {
        x = d.value.length - (d.value.lastIndexOf("\n") + 1);
      } else {
        x += d.count;
      }
    }
  }
  return res;
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
