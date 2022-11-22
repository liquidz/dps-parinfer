import { unknownutil } from "./deps.ts";
import { ParinferMode, ParinferOption } from "./type.ts";

export function unknownToParinferMode(mode: unknown): ParinferMode {
  if (mode === null) {
    return "smart";
  }
  unknownutil.assertString(mode);
  if (mode === "smart") {
    return "smart";
  } else if (mode === "paren") {
    return "paren";
  } else if (mode === "indent") {
    console.log("kokoyo");
    return "indent";
  }

  throw new Error(`unknown mode: ${mode}`);
}

export function unknownToParinferOption(
  values: Record<string, unknown>,
): ParinferOption {
  const opt: ParinferOption = {};
  if (values["commentChars"]) {
    opt.commentChars = unknownutil.ensureArray<string>(values["commentChars"]);
  }
  if (values["openParenChars"]) {
    opt.openParenChars = unknownutil.ensureArray<string>(
      values["openParenChars"],
    );
  }
  if (values["closeParenChars"]) {
    opt.closeParenChars = unknownutil.ensureArray<string>(
      values["closeParenChars"],
    );
  }
  if (values["forceBalance"]) {
    opt.forceBalance = unknownutil.ensureBoolean(values["forceBalance"]);
  }
  if (values["partialvalues"]) {
    opt.forceBalance = unknownutil.ensureBoolean(values["partialvalues"]);
  }
  return opt;
}
