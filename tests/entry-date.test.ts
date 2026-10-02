import test from "node:test";
import assert from "node:assert/strict";
import { entryDateSchema } from "../shared/content";
test("entry dates preserve precision and reject impossible dates", () => {
  for (const value of ["", "2018", "2018-03", "2024-02-29"]) assert.equal(entryDateSchema.parse(value), value);
  for (const value of ["yesterday", "2018-13", "2023-02-29", "2024-04-31", "0000", "2018-03-00"]) assert.equal(entryDateSchema.safeParse(value).success, false);
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EntryDate } from "../shared/EntryDate";
test("entry date display preserves editorial precision without save-time fallback", () => {
  assert.equal(renderToStaticMarkup(createElement(EntryDate, {})), "");
  assert.match(renderToStaticMarkup(createElement(EntryDate, {value: "2018"})), /dateTime="2018">Entry · 2018/);
  assert.match(renderToStaticMarkup(createElement(EntryDate, {value: "2018-03"})), /Entry · Mar 2018/);
  assert.match(renderToStaticMarkup(createElement(EntryDate, {value: "2018-03-07"})), /Entry · Mar 7, 2018/);
});
