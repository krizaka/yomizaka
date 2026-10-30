import assert from "node:assert/strict";
import { test } from "vitest";

import { retime, vtt, vttTime } from "./take.mjs";

test("vttTime writes WebVTT timestamps", () => {
  assert.equal(vttTime(0), "00:00:00.000");
  assert.equal(vttTime(62.5), "00:01:02.500");
  assert.equal(vttTime(3661.007), "01:01:01.007");
});

test("retime plays the marked waits faster and leaves the rest alone", () => {
  const spans = [[10, 30, 10]]; // a 20 s wait played at 10x lasts 2 s
  assert.equal(retime(5, spans), 5);
  assert.equal(retime(10, spans), 10);
  assert.equal(retime(20, spans), 11);
  assert.equal(retime(30, spans), 12);
  assert.equal(retime(40, spans), 22);
});

test("vtt gives each beat its sentence in the language asked, never a cue without words", () => {
  const words = { a: { en: "First.", fr: "D'abord." }, b: { en: "Then.", fr: "Ensuite." }, c: { en: "" } };
  const beats = [
    { id: "a", at: 0 },
    { id: "b", at: 4 },
    { id: "c", at: 8 },
  ];
  const en = vtt(beats, words, "en", 10);
  assert.match(en, /^WEBVTT/);
  assert.match(en, /00:00:00\.000 --> 00:00:03\.900\nFirst\./);
  assert.match(en, /00:00:04\.000 --> 00:00:07\.900\nThen\./);
  assert.doesNotMatch(en, /00:00:08/);
  assert.match(vtt(beats, words, "fr", 10), /D'abord\./);
});
