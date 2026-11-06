import assert from "node:assert/strict";
import test from "node:test";
import { cues } from "./content.ts";
import { AT, seats } from "./story.ts";

test("the seat plan shows the 54 launch attendees plus one open seat", () => {
  assert.equal(seats.filter((seat) => !seat.open).length, 54);
  assert.equal(seats.filter((seat) => seat.open).length, 1);
});

test("every programme cue has a place on the timeline, in order", () => {
  const times = cues.map((cue) => AT[cue.id as keyof typeof AT]);
  assert.ok(times.every((time) => typeof time === "number"));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});
