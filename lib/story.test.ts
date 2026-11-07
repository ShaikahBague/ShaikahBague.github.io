import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { axieReply, crews, events, offices, worlds } from "./content.ts";
import { ARRIVED, AT, ATMOSPHERES, BRIDGE, CAMERA_GAP, CRUISE, FIRST_OFFICE, FLEET, FLIGHT, floatAt, followStep, FULL_STATURE, GROUND_Y, holdsAtChat, LET_GO_MS, LOGO_STROKES, MARK, nextGoal, offBridge, officeSpots, OFFICE_RADIUS, passBy, RAMP_FOOT, ROCK_DEPTH, SILL, STAR_DRIFT, starChart, statureAt, STOP, WALK_CYCLES, WALK_TIME, walkPath, WORLD_POS, WORLD_RADIUS } from "./story.ts";

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

test("one small scroll flies to the next chapter, and however hard it's scrolled it can't pass that chapter", () => {
  const stops = [0, 3, 5, 8];
  assert.equal(nextGoal(stops, 3, 3.05, null, true), 5, "a small scroll is enough");
  assert.equal(nextGoal(stops, 3, 7.9, null, true), 5, "a huge one still stops at the next chapter");
  assert.equal(nextGoal(stops, 3, 3.002, null, true), null, "the slightest touch does nothing");
  assert.equal(nextGoal(stops, 4, 8, 5, true), 5, "scrolling on mid-flight doesn't change where it's going");
  assert.equal(nextGoal(stops, 3, 2.5, null, true), 0, "and it goes back the same way");
  assert.equal(nextGoal(stops, 8, 9, null, true), 8, "the last chapter is as far as it goes");
});

test("scrolling back mid-flight turns round to the chapter just left, even moments after leaving it", () => {
  assert.equal(nextGoal([0, 3, 5, 8], 4, 4.5, 5, true), 3);
  assert.equal(nextGoal([0, 3, 5, 8], 3.005, 4.5, 5, true), 3);
  assert.equal(nextGoal([0, 3, 5, 8], 2.995, 2.5, 0, true), 3);
});

test("momentum left over from the last gesture can't carry on past a chapter, until a new gesture starts", () => {
  assert.equal(nextGoal([0, 3, 5], 3, 3.5, null, false), null);
  assert.equal(nextGoal([0, 3, 5], 3, 3.5, null, true), 5);
});

test("a flight counts as arrived before it has fully eased to a stop, and that isn't confused for the next chapter", () => {
  assert.equal(nextGoal([0, 3, 5], 5 - ARRIVED / 2, 5.5, null, true), 5);
  assert.equal(nextGoal([0, 3, 5, 8], 5 - ARRIVED / 2, 5.5, null, true), 8);
});

test("every chapter is further apart than the nudge, so one scroll can't land between two", () => {
  const times = Object.values(AT);
  times.slice(1).forEach((time, i) => assert.ok(time - times[i] > ARRIVED * 2));
  assert.ok(LET_GO_MS > 0);
});

test("trees clear the bridge along its whole length, and only near it", () => {
  const [cos, sin] = [Math.cos(BRIDGE.turn), Math.sin(BRIDGE.turn)];
  for (let along = -BRIDGE.reach; along <= BRIDGE.reach; along += 20) assert.ok(!offBridge(BRIDGE.x + along * cos, BRIDGE.z - along * sin), `over the deck at ${along}`);
  assert.ok(offBridge(0, 0), "the plaza");
  assert.ok(offBridge(170, -120), "the far side of the headland");
});

test("Axie shrinks to door size on the ramp, without a jump, and fits through the door", () => {
  assert.equal(statureAt(RAMP_FOOT), FULL_STATURE);
  assert.equal(statureAt(SILL.along), 1);
  for (let along = SILL.along; along < RAMP_FOOT; along += 0.1) assert.ok(statureAt(along + 0.1) - statureAt(along) < 0.05);
});

test("each little planet stays in view with room for its name, on a wide screen and a phone", () => {
  // At the camera's distance and 42 degree view: half the height of the view in world units, and half its width at 16:9 and on a tall phone
  const halfUp = CAMERA_GAP * Math.tan((21 * Math.PI) / 180);
  [[true, 16 / 9], [false, 390 / 844]].forEach(([wide, aspect]) => {
    const radius = wide ? OFFICE_RADIUS.wide : OFFICE_RADIUS.tall;
    officeSpots(wide as boolean).forEach(([x, y, z]) => {
      assert.equal(z, FLEET.z);
      assert.ok(Math.abs(x - FLEET.x) + radius <= halfUp * (aspect as number), `in the width at ${x}`);
      assert.ok(Math.abs(y - FLEET.y) + radius + 2 <= halfUp, `in the height at ${y}`);
    });
  });
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

test("offline, Axie answers what it knows and says the link is down otherwise", () => {
  assert.equal(axieReply("Tell me about ROUTING"), worlds[0].line);
  assert.match(axieReply("what are the departments?"), /Enterprise Networking.*Administrative Department/);
  assert.equal(axieReply("what does marketing do"), offices[2].line);
  assert.match(axieReply("how do i join"), /Sign-ups/);
  assert.match(axieReply("what's the weather like"), /link to mission control/);
});

test("the story's beats run in order", () => {
  const times = Object.values(AT);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("the crew starts on the current year and runs back to 2024", () => {
  assert.deepEqual(crews.map((crew) => crew.year), [2026, 2025, 2024]);
  crews.forEach((crew) => assert.ok(crew.officers.length > 0));
});

test("every officer gets a star on the chart with room for their label, whatever the head count", () => {
  crews.forEach(({ year }) => {
    [true, false].forEach((wide) => {
      [1, 2, 4, 6, 15, 40, 80].forEach((count) => {
        const { stars, cols, rows } = starChart(year, count, wide);
        assert.equal(stars.length, count);
        // A label is at most this wide, centred under its star
        const label = ((1 - STAR_DRIFT * 2) / (cols + 0.5)) * 100;
        stars.forEach(([x, y], i) => {
          assert.ok(x - label / 2 >= -0.2 && x + label / 2 <= 100.2, "the label stays on the chart");
          assert.ok(y >= 0 && y <= 100);
          if (i % cols && Math.floor(i / cols) === Math.floor((i - 1) / cols)) assert.ok(x - stars[i - 1][0] >= label - 0.2, "neighbours' labels don't touch");
        });
        assert.ok(rows * cols >= count);
      });
    });
  });
});

test("a constellation is joined up in one piece and lights up outward from its first star", () => {
  [1, 2, 6, 15, 40].forEach((count) => {
    const { links, order } = starChart(2026, count, true);
    assert.equal(links.length, count - 1);
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i));
    links.forEach(([from, to], i) => assert.ok(order[from] <= i && order[to] === i + 1, "a link grows from a star already lit"));
  });
});

test("a year always draws the same constellation, and each year draws its own", () => {
  assert.deepEqual(starChart(2026, 12, true), starChart(2026, 12, true));
  assert.notDeepEqual(starChart(2026, 12, true).stars, starChart(2025, 12, true).stars);
});

test("org.json has what the show needs from every event and officer", () => {
  events.forEach((event) => assert.ok(event.when && event.short && event.title && event.note));
  events.forEach((event) => {
    assert.equal(new Set(event.photos.map((photo) => photo.alt)).size, event.photos.length, "a contact strip tells its photos apart by their captions");
    event.photos.forEach((photo) => assert.ok(!photo.src || existsSync(`public${photo.src}`), `${photo.src} is in public`));
  });
  assert.equal(new Set(crews.map((crew) => crew.year)).size, crews.length, "one entry per year");
  crews.forEach((crew) => crew.officers.forEach((person) => assert.ok(person.name && person.role)));
});

test("every planet has its own air and knows what it covers, and everyone named as a lead belongs to a real planet", () => {
  assert.equal(ATMOSPHERES.length, worlds.length + offices.length);
  assert.equal(FIRST_OFFICE, worlds.length);
  assert.equal(new Set(ATMOSPHERES.map((air) => air.low)).size, ATMOSPHERES.length);
  assert.deepEqual(offices.map((office) => office.name), ["Operations Department", "Creatives Department", "Marketing Department", "Relations Department", "Administrative Department"]);
  offices.forEach((office) => {
    assert.ok(office.line && office.covers.length);
    office.leads.forEach((person) => assert.ok(person.name && person.role && !/@/.test(person.name + person.role)));
    assert.equal(new Set(office.leads.map((person) => person.name)).size, office.leads.length, `nobody is listed twice in ${office.name}`);
    assert.match(office.leads[0].role, /^Chief /, "the chief comes first");
  });
  worlds.forEach((world) => {
    assert.ok(world.line && world.covers.length);
    assert.match(world.source.url, /^https:\/\/www\.cisco\.com\//, "what a department covers says where it came from");
  });
  worlds.forEach((world) => {
    assert.ok(world.leads.length > 0, "each planet says who leads it");
    world.leads.forEach((person) => assert.ok(person.name && person.role));
    assert.equal(new Set(world.leads.map((person) => person.name)).size, world.leads.length, "nobody is listed twice on a planet");
  });
});

test("adrift on a planet, Axie wanders slowly and stays where the camera can see them", () => {
  for (let time = 0; time < 600; time += 0.5) {
    const now = floatAt(time);
    const soon = floatAt(time + 0.5);
    assert.ok(Math.abs(now.x) < 4 && Math.abs(now.y) < 2.5, "stays in frame");
    assert.ok(Math.abs(now.roll) < 0.3 && Math.abs(now.pitch) < 0.2 && Math.abs(now.yaw) < 0.45, "leans, never tumbles");
    assert.ok(Math.hypot(soon.x - now.x, soon.y - now.y) / 0.5 < 1.1, "drifts rather than darts");
  }
});

test("Axie's legs keep to a walking pace at the show's top cruising speed", () => {
  assert.ok((WALK_CYCLES / WALK_TIME) * CRUISE <= 1.25, "strides a second");
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
