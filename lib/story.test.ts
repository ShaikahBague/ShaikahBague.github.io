import assert from "node:assert/strict";
import test from "node:test";
import { axieReply, crews, events, worlds } from "./content.ts";
import { AT, CAMERA_GAP, CRUISE, FLIGHT, followStep, GROUND_Y, holdsAtChat, LOGO_STROKES, MARK, passBy, ROCK_DEPTH, starChart, STOP, walkPath, WORLD_POS, WORLD_RADIUS } from "./story.ts";

test("the show never outruns its cruising speed on an ordinary scroll, in either direction", () => {
  const dt = 1 / 60;
  assert.ok(followStep(0, 3, dt) / dt <= CRUISE + 1e-9);
  assert.ok(followStep(5, 2, dt) >= 5 - (CRUISE + 1e-9) * dt);
});

test("the show settles exactly on the scroll position", () => {
  let now = 0;
  for (let i = 0; i < 1000; i++) now = followStep(now, 0.4, 1 / 60);
  assert.equal(now, 0.4);
});

test("a long backlog clears faster than cruising speed, so a scroll bar drag doesn't play the whole flight", () => {
  const dt = 1 / 60;
  assert.ok(followStep(0, 15, dt) / dt > 1.5);
});

test("an asteroid rests where it was told, comes from far off and leaves past the camera", () => {
  assert.deepEqual(passBy(0, -0.4, 0.1), [-0.4, 0.1, ROCK_DEPTH]);
  assert.ok(passBy(-1, -0.4, 0.1)[2] > ROCK_DEPTH * 4);
  assert.ok(passBy(1, -0.4, 0.1)[2] < ROCK_DEPTH);
  assert.ok(Math.abs(passBy(1, -0.4, 0.1)[0]) > 1, "off screen by the time it is gone");
});

test("Axie's walk runs from inside the hull, up the ramp, to their mark on the ground", () => {
  assert.ok(walkPath(0).along < 1 && walkPath(0).y > GROUND_Y);
  assert.deepEqual(walkPath(1), { along: MARK, y: GROUND_Y });
  for (let out = 0.05; out <= 1; out += 0.05) assert.ok(walkPath(out).y <= walkPath(out - 0.05).y);
});

test("the page waits at the chat until Axie has arrived and rested there", () => {
  assert.ok(holdsAtChat(AT.home, 99), "Axie is still walking");
  assert.ok(holdsAtChat(AT.chat, 0.2), "Axie has only just stopped");
  assert.ok(!holdsAtChat(AT.chat, 99));
  assert.ok(AT.end - AT.chat >= 1.5, "there is room to chat before the show ends");
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

test("the story's beats run in order", () => {
  const times = Object.values(AT);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("the crew starts on the current year and runs back to 2024", () => {
  assert.deepEqual(crews.map((crew) => crew.year), [2026, 2025, 2024]);
  crews.forEach((crew) => assert.ok(crew.officers.length > 0));
});

test("every officer gets a star on the chart, in order across it, whatever the head count", () => {
  crews.forEach((_, year) => {
    [1, 2, 4, 6, 15].forEach((count) => {
      const stars = starChart(year, count);
      assert.equal(stars.length, count);
      stars.forEach(([x, y], i) => {
        assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100);
        if (i) assert.ok(x > stars[i - 1][0], "a phone stacks them in this order");
      });
    });
  });
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
