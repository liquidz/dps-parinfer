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

function getLineChanges(
  lineNo: number,
  before: string,
  after: string,
): ParinferChange[] {
  const res: ParinferChange[] = [];
  let x = 0;
  for (const d of diff.diffChars(before, after)) {
    if (d.added) {
      res.push({ lineNo: lineNo, x: x, oldText: "", newText: d.value });
      x += d.count;
    } else if (d.removed) {
      res.push({ lineNo: lineNo, x: x, oldText: d.value, newText: "" });
    } else {
      x += d.count;
    }
  }
  return res;
}

export function getChanges(before: string, after: string): ParinferChange[] {
  if (before == after) {
    return [];
  }

  let res: ParinferChange[] = [];
  let lineNo = 0;
  let removedLine = "";

  for (const d of diff.diffLines(before, after)) {
    if (d.added) {
      if (removedLine === "") {
        res.push({ lineNo: lineNo, x: 0, oldText: "", newText: d.value });
      } else {
        res = res.concat(getLineChanges(lineNo, removedLine, d.value));
      }
      removedLine = "";
      lineNo += d.count;
    } else if (d.removed) {
      removedLine = d.value;
    } else {
      if (removedLine !== "") {
        res.push({ lineNo: lineNo, x: 0, oldText: removedLine, newText: "" });
      }
      removedLine = "";
      lineNo += d.count;
    }
  }

  if (removedLine !== "") {
    res.push({ lineNo: lineNo, x: 0, oldText: removedLine, newText: "" });
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
