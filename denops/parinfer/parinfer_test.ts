import { asserts } from "./deps.ts";
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

Deno.test("Remove line", () => {
  asserts.assertEquals(sut.getChanges("foo\nbar", "foo\n"), [{
    lineNo: 1,
    x: 0,
    oldText: "bar",
    newText: "",
  }]);
});
