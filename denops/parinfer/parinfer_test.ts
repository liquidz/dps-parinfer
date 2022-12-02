import { asserts } from "./test_deps.ts";
import * as sut from "./parinfer.ts";

Deno.test("No changes", () => {
  asserts.assertEquals(sut.getChanges("", ""), []);
});

Deno.test("Char changes", () => {
  asserts.assertEquals(sut.getChanges("foo", "far"), [{
    lineNo: 0,
    x: 1,
    oldText: "oo",
    newText: "",
  }, {
    lineNo: 0,
    x: 1,
    oldText: "",
    newText: "ar",
  }]);
});

Deno.test("Add line", () => {
  asserts.assertEquals(sut.getChanges("foo\n", "foo\nbar"), [{
    lineNo: 1,
    x: 0,
    oldText: "",
    newText: "bar",
  }]);
});

Deno.test("Paste multiple lines", () => {
  asserts.assertEquals(
    sut.getChanges(
      "(foo\n  (bar))",
      "(foo\n    (new foo\n         bar)\n  (bar))",
    ),
    [{
      lineNo: 1,
      x: 0,
      oldText: "",
      newText: "    (new foo\n         bar)\n",
    }],
  );
});

Deno.test("Remove line", () => {
  asserts.assertEquals(sut.getChanges("foo\nbar", "foo\n"), [{
    lineNo: 1,
    x: 0,
    oldText: "bar",
    newText: "",
  }]);
});

Deno.test("Indent lines", () => {
  asserts.assertEquals(
    sut.getChanges("(do\n(foo)\n(bar))\n", "(do\n  (foo)\n  (bar))\n"),
    [
      { lineNo: 1, x: 0, oldText: "", newText: "  " },
      { lineNo: 2, x: 0, oldText: "", newText: "  " },
    ],
  );

  asserts.assertEquals(
    sut.getChanges(
      "(foo)\n(bar)\n(baz\n  :baz)\n",
      "(foo)\n(bar)\n  (baz\n  :baz)\n",
    ),
    [
      { lineNo: 2, x: 0, oldText: "", newText: "  " },
    ],
  );

  asserts.assertEquals(
    sut.getChanges(
      `(do)\n(= (str\n       :foo)\n   "")\n(= (str\n     :foo)\n  "")`,
      `(do\n  (= (str\n         :foo)\n     "")\n  (= (str\n       :foo)\n    ""))`,
    ),
    [
      { lineNo: 0, x: 3, oldText: ")", newText: "" },
      { lineNo: 1, x: 0, oldText: "", newText: "  " },
      { lineNo: 2, x: 7, oldText: "", newText: "  " },
      { lineNo: 3, x: 3, oldText: "", newText: "  " },
      { lineNo: 4, x: 0, oldText: "", newText: "  " },
      { lineNo: 5, x: 5, oldText: "", newText: "  " },
      { lineNo: 6, x: 2, oldText: "", newText: "  " },
      { lineNo: 6, x: 7, oldText: "", newText: ")" },
    ],
  );
});

Deno.test("Join lines", () => {
  asserts.assertEquals(
    sut.getChanges(
      "(list :foo\n  (str :bar\n       :baz))",
      "(list :foo (str :bar\n       :baz))",
    ),
    [
      { lineNo: 0, x: 10, oldText: "\n", newText: "" },
      { lineNo: 0, x: 11, oldText: " ", newText: "" },
    ],
  );
});
