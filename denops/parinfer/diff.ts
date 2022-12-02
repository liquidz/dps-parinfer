import { diff, unknownutil } from "./deps.ts";
import { Difference } from "./types.ts";

export function diffLines(before: string, after: string): Array<Difference> {
  return unknownutil.ensureArray<Difference>(diff.diffLines(before, after));
}

export function diffChars(before: string, after: string): Array<Difference> {
  return unknownutil.ensureArray<Difference>(diff.diffChars(before, after));
}
