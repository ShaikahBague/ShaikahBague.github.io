import assert from "node:assert/strict";
import test from "node:test";
import { axieReply, cues, events, worlds } from "./content.ts";
import { AT, CAMERA_GAP, FLIGHT, LOGO_STROKES, snapTarget, STOP, WORLD_POS, WORLD_RADIUS } from "./story.ts";

const RESTS = [0, 0.9, 1.9, 2.8, 3.8];

test("a page at rest stays on its chapter through a small nudge in either direction", () => {
  assert.equal(snapTarget(RESTS, 1.9, 1.9), 1.9);
  assert.equal(snapTarget(RESTS, 1.9, 1.94), 1.9);
  assert.equal(snapTarget(RESTS, 1.9, 1.86), 1.9);
});

test("one wheel notch moves exactly one chapter, forwards and back", () => {
  assert.equal(snapTarget(RESTS, 1.9, 2.02), 2.8);
  assert.equal(snapTarget(RESTS, 1.9, 1.78), 0.9);
});

test("a long scroll settles on the chapter ahead, not back where it started", () => {
  assert.equal(snapTarget(RESTS, 0, 2.3), 2.8);
  assert.equal(snapTarget(RESTS, 3.8, 1.4), 0.9);
});

test("a scroll that stops about on a chapter stays there rather than skipping it", () => {
  assert.equal(snapTarget(RESTS, 0, 2.84), 2.8);
  assert.equal(snapTarget(RESTS, 3.8, 1.86), 1.9);
});

test("snapping never leaves the ends of the story", () => {
  assert.equal(snapTarget(RESTS, 3.8, 3.95), 3.8);
  assert.equal(snapTarget(RESTS, 0, 0), 0);
});

test("the constellation stays inside the logo image and has stars on every stroke", () => {
  LOGO_STROKES.flat().forEach(([x, y]) => assert.ok(x >= 0 && x <= 1000 && y >= 0 && y <= 773));
  assert.ok(LOGO_STROKES.every((stroke) => stroke.some((point) => point[2])));
});

test("the rocket lands on the same spot it left from", () => {
  assert.deepEqual(FLIGHT[STOP.home], FLIGHT[STOP.house]);
});

test("every event has somewhere to show at least one photo with a description", () => {
  events.forEach((event) => {
    assert.ok(event.photos.length > 0);
    event.photos.forEach((photo) => assert.ok(photo.alt));
  });
});

test("Axie answers what it knows and admits being a placeholder otherwise", () => {
  assert.equal(axieReply("Tell me about ROUTING"), worlds[0].line);
  assert.match(axieReply("what are the departments?"), /Enterprise Networking/);
  assert.match(axieReply("how do i join"), /Sign-ups/);
  assert.match(axieReply("what's the weather like"), /placeholder/);
});

test("every programme cue has a place on the timeline, in order", () => {
  const times = cues.map((cue) => AT[cue.id as keyof typeof AT]);
  assert.ok(times.every((time) => typeof time === "number"));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("the org has three departments, each with a world and a rocket stop in front of it", () => {
  assert.equal(worlds.length, 3);
  assert.equal(WORLD_POS.length, 3);
  worlds.forEach((world, i) => {
    const [x, y, z] = FLIGHT[STOP[world.id as keyof typeof STOP]];
    const [wx, wy, wz] = WORLD_POS[i];
    assert.ok(z < wz + CAMERA_GAP && z > wz + WORLD_RADIUS, `${world.id} rests between camera and world`);
    assert.ok(Math.hypot(x - wx, y - wy, z - wz) > WORLD_RADIUS * 1.5, `${world.id} clears the planet`);
  });
});

test("the rocket's stops run forward through the flight path", () => {
  const stops = Object.values(STOP);
  assert.deepEqual(stops, [...stops].sort((a, b) => a - b));
  assert.ok(stops.every((stop) => stop < FLIGHT.length));
});

test("no flight point sits inside a world", () => {
  FLIGHT.forEach(([x, y, z]) =>
    WORLD_POS.forEach(([wx, wy, wz]) => assert.ok(Math.hypot(x - wx, y - wy, z - wz) > WORLD_RADIUS * 1.5)),
  );
});
