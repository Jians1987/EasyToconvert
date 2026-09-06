import { test, expect } from "@playwright/test";
import { csvToJson, jsonToCsv } from "../app/lib/dataConverters";
import { minifyCode } from "../app/lib/minifyCode";

test("CSV preserves multiline cells, quotes, commas and significant spaces", () => {
  const input = 'name,notes\r\nAlice,"first line\r\nsecond, ""quoted"" line"\r\nBob,"  padded  "';
  const rows = JSON.parse(csvToJson(input));
  expect(rows).toEqual([{ name: "Alice", notes: 'first line\r\nsecond, "quoted" line' }, { name: "Bob", notes: "  padded  " }]);
  expect(JSON.parse(csvToJson(jsonToCsv(JSON.stringify(rows))))).toEqual(rows);
});

test("JSON to CSV keeps fields introduced by later rows and escapes headers", () => {
  const csv = jsonToCsv(JSON.stringify([{ 'a,b': 'say "hello"' }, { later: "new\nline" }]));
  expect(JSON.parse(csvToJson(csv))).toEqual([{ 'a,b': 'say "hello"', later: "" }, { 'a,b': "", later: "new\nline" }]);
});

test("CSV rejects malformed or ambiguous records instead of dropping data", () => {
  for (const input of ['a,b\n1,2,3', 'a,a\n1,2', 'a,b\n"unfinished,2']) expect(() => csvToJson(input)).toThrow();
});

test("JS minification preserves strings, regular expressions and automatic semicolons", async () => {
  const source = 'const s = "hello  world /* keep */"; function f(){return\n42;} const re = /a b/; return [s, f(), re.source];';
  // Wrap as a function because top-level return is not a script statement.
  const code = `function run(){${source}}`;
  const output = await minifyCode(code, "js");
  expect(new Function(`${output};return run();`)()).toEqual(new Function(`${code};return run();`)());
  await expect(minifyCode("const = ;", "js")).rejects.toThrow();
});

test("CSS minification preserves strings and calc spacing", async () => {
  const result = await minifyCode('a { content: "a  b /* literal */"; width: calc(100% - 2px); }', "css");
  expect(result).toContain('"a  b /* literal */"');
  expect(result).toContain('calc(100% - 2px)');
});

