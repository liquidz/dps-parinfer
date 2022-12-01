import { batch, Denops, helper, unknownutil, variable } from "./deps.ts";
import { Config, ParinferMode, ParinferOption } from "./types.ts";
import { applyParinfer, getChanges } from "./parinfer.ts";
import { unknownToParinferMode, unknownToParinferOption } from "./unknown.ts";

const DEFAULT_FILETYPES = [
  "carp",
  "clojure",
  "dune",
  "fennel",
  "hy",
  "janet",
  "lisp",
  "racket",
  "scheme",
  "wast",
  "yuck",
];

async function loadGlobalConfig(denops: Denops): Promise<Config> {
  const [
    mode,
    filetypes,
    commentChars,
    openParenChars,
    closeParenChars,
    forceBalance,
    partialResult,
  ] = await batch.gather(denops, async (denops) => {
    await variable.globals.get(denops, "dps_parinfer_mode");
    await variable.globals.get(denops, "dps_parinfer_filetypes");
    await variable.globals.get(denops, "dps_parinfer_comment_chars");
    await variable.globals.get(denops, "dps_parinfer_open_paren_chars");
    await variable.globals.get(denops, "dps_parinfer_close_paren_chars");
    await variable.globals.get(denops, "dps_parinfer_force_balance");
    await variable.globals.get(denops, "dps_parinfer_partial_result");
  });

  return {
    mode: unknownToParinferMode(mode),
    filetypes: (filetypes)
      ? unknownutil.ensureArray<string>(filetypes)
      : DEFAULT_FILETYPES,
    option: unknownToParinferOption({
      "commentChars": commentChars,
      "openParenChars": openParenChars,
      "closeParenChars": closeParenChars,
      "forceBalance": forceBalance,
      "partialResult": partialResult,
    }),
  };
}

export async function main(denops: Denops): Promise<void> {
  const globalConfig = await loadGlobalConfig(denops);
  const bufferOptions: Map<string, ParinferOption> = new Map();

  let isEnabled = true;
  let isDebug = false;
  let mode: ParinferMode = globalConfig.mode;

  denops.dispatcher = {
    disable() {
      isEnabled = false;
      console.log("dps-parinfer is disabled.");
      return Promise.resolve(isEnabled);
    },
    enable() {
      isEnabled = true;
      console.log("dps-parinfer is enabled.");
      return Promise.resolve(isEnabled);
    },

    switchToSmartMode() {
      mode = "smart";
      return Promise.resolve(mode);
    },

    switchToIndentMode() {
      mode = "indent";
      return Promise.resolve(mode);
    },

    switchToParenMode() {
      mode = "paren";
      return Promise.resolve(mode);
    },

    setBufferOption(filetype: unknown, option: unknown) {
      unknownutil.assertString(filetype);
      unknownutil.assertObject(option);
      bufferOptions.set(filetype, unknownToParinferOption(option));
      return Promise.resolve(true);
    },

    async applyToBuffer(
      filetype: unknown,
      currentLine: unknown,
      currentColumn: unknown,
      prevLine: unknown,
      prevColumn: unknown,
      topFormStartLine: unknown,
      prevText: unknown,
      lines: unknown,
    ) {
      if (!isEnabled) {
        return;
      }

      unknownutil.assertString(filetype);
      unknownutil.assertNumber(currentLine);
      unknownutil.assertNumber(currentColumn);
      unknownutil.assertNumber(prevLine);
      unknownutil.assertNumber(prevColumn);
      unknownutil.assertNumber(topFormStartLine);
      unknownutil.assertString(prevText);
      unknownutil.assertArray<string>(lines);

      const joined = lines.join("\n");
      if (joined == prevText) {
        return;
      }

      const option = {
        ...(globalConfig.option),
        ...(bufferOptions.get(filetype)),
      };

      option.cursorLine = currentLine - topFormStartLine;
      option.cursorX = currentColumn - 1;
      option.prevCursorLine = prevLine - topFormStartLine;
      option.prevCursorX = prevColumn - 1;
      try {
        option.changes = getChanges(prevText, joined);
      } catch (ex) {
        console.log(ex);
      }

      const result = await applyParinfer(mode, joined, option);
      const applied = result.text;

      if (joined == applied) {
        return;
      }

      if (isDebug) {
        console.log("== PREV TEXT ==================================");
        console.log(prevText);
        console.log("== JOINED =====================================");
        console.log(joined);
        console.log("== CHANGES ====================================");
        console.log(option.changes);
        console.log("== APPLIED ====================================");
        console.log(applied);
      }

      const newLines = applied.split(/\r?\n/);
      let start = NaN;
      let end = NaN;
      for (let i = 0; i < newLines.length; i++) {
        if (lines[i] != newLines[i]) {
          start = isNaN(start) ? i : start;
          end = i;
        }
      }

      await batch.batch(denops, async (denops) => {
        await denops.cmd("silent! undojoin");
        await denops.call(
          "setline",
          topFormStartLine + start,
          newLines.slice(start, end + 1),
        );
      });

      // prevCursor.line = result.cursorLine;
      // prevCursor.column = result.cursorX;

      await denops.redraw(false);
    },

    toggleDebug() {
      isDebug = !isDebug;
      return denops.call("dps_parinfer#set_debug", isDebug);
    },

    async initialize() {
      const n = denops.name;
      await helper.execute(
        denops,
        `
        command! DpsParinferDisable     call denops#notify("${n}", "disable", [])
        command! DpsParinferEnable      call denops#notify("${n}", "enable", [])
        command! DpsParinferApply       call denops#notify("${n}", "applyToBuffer", [])
        command! DpsParinferSmartMode   call denops#notify("${n}", "switchToSmartMode", [])
        command! DpsParinferParenMode   call denops#notify("${n}", "switchToParenMode", [])
        command! DpsParinferIndentMode  call denops#notify("${n}", "switchToIndentMode", [])
        command! DpsParinferToggleDebug call denops#notify("${n}", "toggleDebug", [])
        call dps_parinfer#buf_enter("${n}")

        au! DpsParinferAutoCmd BufEnter      <buffer> call dps_parinfer#buf_enter("${n}")
        au! DpsParinferAutoCmd WinEnter      <buffer> call dps_parinfer#win_enter("${n}")
        au! DpsParinferAutoCmd CursorMoved   <buffer> call dps_parinfer#cursor_moved("${n}")
        au! DpsParinferAutoCmd ModeChanged   <buffer> call dps_parinfer#mode_changed("${n}")

        au! DpsParinferAutoCmd TextChanged   <buffer> call dps_parinfer#apply("${n}")
        au! DpsParinferAutoCmd TextChangedI  <buffer> call dps_parinfer#apply("${n}")
        au! DpsParinferAutoCmd InsertCharPre <buffer> call dps_parinfer#apply("${n}")
        au! DpsParinferAutoCmd InsertEnter   <buffer> call dps_parinfer#apply("${n}")
        au! DpsParinferAutoCmd TextChangedP  <buffer> call dps_parinfer#apply("${n}")
    `,
      );
    },
  };

  const n = denops.name;
  const fts = globalConfig.filetypes.join(",");
  await helper.execute(
    denops,
    `
    aug DpsParinferAutoCmd
      au!
      au FileType ${fts} call denops#notify("${n}", "initialize", [])
    aug END
    `,
  );

  const currentFiletype = await variable.options.get(denops, "filetype");
  if (
    unknownutil.isString(currentFiletype) &&
    globalConfig.filetypes.includes(currentFiletype)
  ) {
    denops.dispatch(n, "initialize", []);
  }
}
