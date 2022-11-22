export type ParinferMode = "smart" | "paren" | "indent";

export type Cursor = {
  line: number;
  column: number;
};

export type ParinferChange = {
  lineNo: number;
  x: number;
  oldText: string;
  newText: string;
};

export type ParinferOption = {
  commentChars?: string[];
  openParenChars?: string[];
  closeParenChars?: string[];
  cursorLine?: number;
  cursorX?: number;
  prevCursorLine?: number;
  prevCursorX?: number;
  selectionStartLine?: number;
  changes?: ParinferChange[];
  forceBalance?: boolean;
  partialResult?: boolean;
};

type ParinferResultErrorName =
  | "quote-danger"
  | "eol-backslash"
  | "unclosed-quote"
  | "unclosed-paren"
  | "unmatched-close-paren"
  | "unhandled";

type ParinferResultError = {
  name: ParinferResultErrorName;
  message: string;
  lineNo?: number;
  x?: number;
  extra?: {
    name: ParinferResultErrorName;
    lineNo: number;
    x: number;
  };
};

export type ParinferResult = {
  success: boolean;
  text: string;
  cursorLine: number;
  cursorX: number;
  error?: ParinferResultError;
};

export type ParinferFn = (
  text: string,
  option: ParinferOption,
) => ParinferResult;
