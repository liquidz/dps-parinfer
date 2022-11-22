import {
  autocmd,
  batch,
  Denops,
  helper,
  unknownutil,
  variable,
} from "./deps.ts";
import { Cursor, ParinferMode, ParinferOption } from "./type.ts";
import { applyParinfer, getChanges } from "./parinfer.ts";
import { unknownToParinferMode, unknownToParinferOption } from "./unknown.ts";

function unixTime(): number {
  return (new Date()).getTime();
}

async function loadGlobalConfig(
  denops: Denops,
): Promise<[ParinferMode, ParinferOption]> {
  const [
    mode,
    commentChars,
    openParenChars,
    closeParenChars,
    forceBalance,
    partialResult,
  ] = await batch.gather(denops, async (denops) => {
    await variable.globals.get(denops, "dps_parinfer_mode");
    await variable.globals.get(denops, "dps_parinfer_comment_chars");
    await variable.globals.get(denops, "dps_parinfer_open_paren_chars");
    await variable.globals.get(denops, "dps_parinfer_close_paren_chars");
    await variable.globals.get(denops, "dps_parinfer_force_balance");
    await variable.globals.get(denops, "dps_parinfer_partial_result");
  });

  return [
    unknownToParinferMode(mode),
    unknownToParinferOption({
      "commentChars": commentChars,
      "openParenChars": openParenChars,
      "closeParenChars": closeParenChars,
      "forceBalance": forceBalance,
      "partialResult": partialResult,
    }),
  ];
}

async function getCurrentStatus(
  denops: Denops,
  lastUpdatedAt: number,
  innerPrevText: string,
): Promise<[Array<number>, Array<number>, string, Array<string>]> {
  if (innerPrevText === "" || (unixTime() - lastUpdatedAt) > 300) {
    const [pos, prevPos, prevText, lines] = await batch.gather(
      denops,
      async (denops) => {
        await denops.call("getcurpos");
        await variable.windows.get(denops, "dps_parinfer_curpos");
        await variable.windows.get(denops, "dps_parinfer_text");
        await denops.call("getline", 1, "$");
      },
    );
    unknownutil.assertArray<number>(pos);
    unknownutil.assertArray<number>(prevPos);
    unknownutil.assertString(prevText);
    unknownutil.assertArray<string>(lines);
    return [pos, prevPos, prevText, lines];
  } else {
    const [pos, prevPos, lines] = await batch.gather(
      denops,
      async (denops) => {
        await denops.call("getcurpos");
        await variable.windows.get(denops, "dps_parinfer_curpos");
        await denops.call("getline", 1, "$");
      },
    );
    unknownutil.assertArray<number>(pos);
    unknownutil.assertArray<number>(prevPos);
    unknownutil.assertArray<string>(lines);
    return [pos, prevPos, innerPrevText, lines];
  }
}

export async function main(denops: Denops): Promise<void> {
  const [initialMode, globalOption] = await loadGlobalConfig(denops);
  const bufferOptions: Map<string, ParinferOption> = new Map();

  let mode: ParinferMode = initialMode;
  const prevCursor: Cursor = { line: -1, column: -1 };
  let innerPrevText = "";
  let lastUpdatedAt = unixTime();

  denops.dispatcher = {
    switchToSmartMode() {
      mode = "smart";
      return Promise.resolve(true);
    },

    switchToIndentMode() {
      mode = "indent";
      return Promise.resolve(true);
    },

    switchToParenMode() {
      mode = "paren";
      return Promise.resolve(true);
    },

    setOption(filetype: unknown, option: unknown) {
      unknownutil.assertString(filetype);
      unknownutil.assertObject(option);
      bufferOptions.set(filetype, unknownToParinferOption(option));
      return Promise.resolve(true);
    },

    async applyToBuffer(filetype: unknown) {
      unknownutil.assertString(filetype);
      const [pos, prevPos, prevText, lines] = await getCurrentStatus(
        denops,
        lastUpdatedAt,
        innerPrevText,
      );

      const joined = lines.join("\n");
      const option = { ...globalOption, ...(bufferOptions.get(filetype)) };
      option.cursorLine = pos[1] - 1;
      option.cursorX = pos[2] - 1;
      option.prevCursorLine = prevPos[1] - 1;
      option.prevCursorX = prevPos[2] - 1;
      option.changes = getChanges(prevText, joined);

      const result = await applyParinfer(mode, joined, option);
      const applied = result.text;

      if (joined == applied) {
        return;
      }

      const newLines = applied.split(/\r?\n/);
      let start = NaN;
      let end = NaN;
      for (let i = 0; i < newLines.length; i++) {
        if (lines[i] != newLines[i]) {
          start = start || i;
          end = i;
        }
      }

      await batch.batch(denops, async (denops) => {
        await denops.cmd("silent! undojoin");
        await denops.call(
          "setline",
          start + 1,
          newLines.slice(start, end + 1),
        );
      });

      prevCursor.line = result.cursorLine;
      prevCursor.column = result.cursorX;
      innerPrevText = applied;
      lastUpdatedAt = unixTime();

      await denops.redraw(false);
    },
  };

  const n = denops.name;
  await helper.execute(
    denops,
    `
    command! DpsParinferApply call denops#notify("${n}", "applyToBuffer", [])
    command! DpsParinferSmartMode call denops#notify("${n}", "switchToSmartMode", [])
    command! DpsParinferParenMode call denops#notify("${n}", "switchToParenMode", [])
    command! DpsParinferIndentMode call denops#notify("${n}", "switchToIndentMode", [])
    call dps_parinfer#buf_enter("${n}")
    `,
  );

  await autocmd.group(denops, "dps-parinfer-autocmd", (helper) => {
    helper.define("BufEnter", "*", `call dps_parinfer#buf_enter("${n}")`);
    helper.define("WinEnter", "*.clj", `call dps_parinfer#win_enter("${n}")`);
    helper.define(
      "CursorMoved",
      "*.clj",
      `call dps_parinfer#cursor_moved("${n}")`,
    );
    helper.define("TextChanged", "*.clj", `call dps_parinfer#apply("${n}")`);
    helper.define("TextChangedI", "*.clj", `call dps_parinfer#apply("${n}")`);
    helper.define("InsertCharPre", "*.clj", `call dps_parinfer#apply("${n}")`);
    helper.define("InsertEnter", "*.clj", `call dps_parinfer#apply("${n}")`);
    helper.define("TextChangedP", "*.clj", `call dps_parinfer#apply("${n}")`);
  });
}
