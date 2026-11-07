import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ATMOSPHERES, floatAt } from "@/lib/story";
import type { suitUp } from "./astronaut";

type Look = (typeof ATMOSPHERES)[number];

// The sky writes display colours directly, like the other custom shaders in the show
const display = (h: string) => {
  const c = parseInt(h.slice(1), 16);
  return new Vector3((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
};

const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Level where the camera stands, rising into hills further out
const heightAt = (x: number, z: number, { relief, seed }: Look) => {
  const rise = 0.1 + Math.min(1, Math.max(0, (Math.hypot(x, z) - 35) / 150));
  const hills = Math.sin(x * 0.021 + seed) * Math.cos(z * 0.017 + seed * 2) * 0.55 + Math.sin(x * 0.053 + z * 0.041 + seed) * 0.2 + Math.abs(Math.sin(x * 0.009 - z * 0.012 + seed)) * 0.9;
  return hills * relief * rise * rise;
};

function buildGround(look: Look, segments: number) {
  const geometry = new PlaneGeometry(1500, 1500, segments, segments).rotateX(-Math.PI / 2).toNonIndexed();
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setY(i, heightAt(position.getX(i), position.getZ(i), look));
  geometry.computeVertexNormals();
  const [low, high] = look.ground.map((color) => new Color(color));
  const shade = new Color();
  const colors: number[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const up = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3 / look.relief;
    shade.copy(low).lerp(high, Math.min(1, Math.max(0, up)));
    for (let corner = 0; corner < 3; corner++) colors.push(shade.r, shade.g, shade.b);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
}

function buildSky(look: Look) {
  return new Mesh(
    new SphereGeometry(1000, 32, 20),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTop: { value: display(look.top) }, uLow: { value: display(look.low) }, uMoon: { value: display(look.moon) }, uAt: { value: new Vector3().fromArray(look.moonAt).normalize() } },
      vertexShader: "varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: /* glsl */ `
        uniform vec3 uTop,uLow,uMoon,uAt; varying vec3 vD;
        void main(){
          vec3 d=normalize(vD);
          float e=max(d.y,0.);
          vec3 c=mix(uLow,uTop,pow(e,.5));
          // Stars only where the air has thinned out, high up
          vec3 cell=floor(d*260.);
          float star=step(.9972,fract(sin(dot(cell,vec3(12.9898,78.233,37.719)))*43758.5453));
          c+=star*smoothstep(.45,.85,e)*.7;
          // A moon hung in the air, lit from one side, with the haze thickening round it
          float m=dot(d,uAt);
          c+=uLow*smoothstep(.93,.998,m)*.16;
          // Rounded off by a soft shade across the disc rather than a hard line
          vec3 lit=uMoon*(.8+.2*smoothstep(-.11,.11,d.x-uAt.x+d.y-uAt.y));
          gl_FragColor=vec4(mix(c,lit,smoothstep(.9925,.9935,m)),1.);
        }`,
    }),
  );
}

// Air with dust drifting through it, so the atmosphere is something the camera is inside
function buildMotes(count: number, tint: string, px: number) {
  const random = seeded(19);
  const places: number[] = [];
  for (let i = 0; i < count; i++) places.push((random() - 0.5) * 300, 4 + random() * 80, 20 - random() * 260);
  const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(places, 3));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: px }, uTint: { value: display(tint) } },
    vertexShader: /* glsl */ `
      uniform float uTime,uPx;
      void main(){
        vec3 p=position;
        p.x+=sin(uTime*.12+position.z*.05)*5.;
        p.y+=sin(uTime*.2+position.x*.07)*2.5;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=clamp(uPx*160./-mv.z,1.,7.*uPx);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: "uniform vec3 uTint;void main(){float a=smoothstep(.5,0.,length(gl_PointCoord-.5));gl_FragColor=vec4(uTint*a*.55,1.);}",
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

// Enterprise Networking: sites joined up. Masts stand across the hills with one link strung through them all, and packets run along it
function buildLinks(look: Look) {
  const group = new Group();
  const sites = [[-50, -90], [8, -150], [88, -190], [166, -150], [220, -80], [280, -190], [130, -290], [-20, -280]].map(([x, z]) => new Vector3(x, heightAt(x, z, look) + 30, z));
  const masts = sites.flatMap(({ x, y, z }) => [
    new CylinderGeometry(0.5, 1.5, y, 6).translate(x, y / 2, z),
    new BoxGeometry(11, 0.6, 0.6).translate(x, y - 2, z),
    new BoxGeometry(7, 0.5, 0.5).translate(x, y - 6, z),
  ]);
  group.add(new Mesh(mergeGeometries(masts.map((mast) => mast.toNonIndexed())), new MeshLambertMaterial({ color: look.ground[0] })));
  const path = new CatmullRomCurve3(sites.flatMap((site, i) => {
    const next = sites[(i + 1) % sites.length];
    return [site, site.clone().lerp(next, 0.5).setY((site.y + next.y) / 2 - 7)];
  }), true, "centripetal");
  group.add(new Mesh(new TubeGeometry(path, 240, 0.22, 5, true), new MeshBasicMaterial({ color: look.accent, fog: false })));
  const packets = new InstancedMesh(new SphereGeometry(0.85, 10, 8), new MeshBasicMaterial({ color: "#ffffff", fog: false }), 22);
  packets.frustumCulled = false;
  group.add(packets);
  const matrix = new Matrix4();
  const place = new Vector3();
  return {
    group,
    update(time: number) {
      for (let i = 0; i < packets.count; i++) {
        path.getPointAt((time * 0.012 + i / packets.count) % 1, place);
        packets.setMatrixAt(i, matrix.makeTranslation(place.x, place.y, place.z));
      }
      packets.instanceMatrix.needsUpdate = true;
    },
  };
}

// Cybersecurity Operations: the same lattice shell seen closing round this planet from orbit, now overhead, with a watch beam sweeping under it
function buildWatch(look: Look) {
  const group = new Group();
  const shell = new LineSegments(
    new EdgesGeometry(new IcosahedronGeometry(330, 2)),
    new LineBasicMaterial({ color: look.accent, transparent: true, opacity: 0.45, fog: false, blending: AdditiveBlending, depthWrite: false }),
  );
  const beam = new Mesh(
    new CircleGeometry(320, 40, 0, 0.75).rotateX(-Math.PI / 2),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: { uTint: { value: display(look.accent) } },
      vertexShader: "varying vec2 vP;void main(){vP=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "uniform vec3 uTint;varying vec2 vP;void main(){float r=length(vP)/320.;float a=atan(-vP.y,vP.x);float along=smoothstep(0.,.6,a)*(1.-smoothstep(.6,.75,a));gl_FragColor=vec4(uTint*along*(1.-r)*.26,1.);}",
    }),
  );
  beam.position.set(20, 22, -150);
  const spire = new Mesh(new ConeGeometry(4.5, 62, 6).translate(20, 31, -150), new MeshLambertMaterial({ color: look.ground[1], flatShading: true }));
  const random = seeded(53);
  const shards = new InstancedMesh(new ConeGeometry(1, 1, 5), new MeshLambertMaterial({ color: look.ground[0], flatShading: true }), 46);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  for (let i = 0; i < shards.count; i++) {
    const a = random() * Math.PI * 2;
    const r = 70 + random() * 240;
    const [x, z] = [Math.cos(a) * r, Math.sin(a) * r - 120];
    const tall = 8 + random() * 26;
    turn.setFromAxisAngle(new Vector3(random() - 0.5, 0, random() - 0.5).normalize(), random() * 0.3);
    shards.setMatrixAt(i, matrix.compose(new Vector3(x, heightAt(x, z, look) + tall / 2 - 1, z), turn, new Vector3(3 + random() * 4, tall, 3 + random() * 4)));
  }
  group.add(shell, beam, spire, shards);
  return {
    group,
    update(time: number) {
      beam.rotation.y = time * 0.45;
      shell.rotation.y = time * 0.02;
    },
  };
}

// Development Networking: code as the landscape. Indented rows of glowing bars rise slowly up the sky like a listing being read
function buildListing(look: Look) {
  const group = new Group();
  const random = seeded(71);
  const bars: { x: number; y: number; width: number }[] = [];
  const ROWS = 30;
  const ROW_GAP = 5;
  let indent = 0;
  for (let row = 0; row < ROWS; row++) {
    indent = Math.max(0, Math.min(4, indent + Math.floor(random() * 3) - 1));
    let x = indent * 7;
    const tokens = 1 + Math.floor(random() * 4);
    for (let t = 0; t < tokens; t++) {
      const width = 4 + random() * 15;
      bars.push({ x: x + width / 2, y: row * ROW_GAP, width });
      x += width + 2;
    }
  }
  const listing = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: "#ffffff", fog: false, transparent: true, opacity: 0.85 }), bars.length);
  const matrix = new Matrix4();
  const still = new Quaternion();
  const tones = [look.accent, look.moon, "#ffffff"].map((tone) => new Color(tone));
  bars.forEach(({ x, y, width }, i) => {
    listing.setMatrixAt(i, matrix.compose(new Vector3(x, y, 0), still, new Vector3(width, 1.5, 1.5)));
    listing.setColorAt(i, tones[Math.floor(random() * tones.length)]);
  });
  listing.frustumCulled = false;
  listing.position.set(-14, 0, -150);
  listing.rotation.y = -0.2;
  group.add(listing);
  const mesas = mergeGeometries([[-120, -210, 40, 34], [150, -190, 54, 26], [240, -300, 70, 44], [-230, -310, 66, 52]].map(([x, z, wide, tall]) => new CylinderGeometry(wide * 0.8, wide, tall, 7).translate(x, heightAt(x, z, look) + tall / 2 - 2, z)));
  group.add(new Mesh(mesas, new MeshLambertMaterial({ color: look.ground[1], flatShading: true })));
  return {
    group,
    update(time: number) {
      // Whole rows at a time, so the climb never visibly restarts
      listing.position.y = 6 + ((time * 1.5) % (ROW_GAP * 6));
    },
  };
}

// A soft cone of light for the stage and broadcast worlds, brightest at its source
const lightCone = (length: number, wide: number, tint: string) =>
  new Mesh(
    new ConeGeometry(wide, length, 20, 1, true).translate(0, -length / 2, 0),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: { uTint: { value: display(tint) } },
      vertexShader: "varying float vUp;void main(){vUp=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "uniform vec3 uTint;varying float vUp;void main(){gl_FragColor=vec4(uTint*vUp*vUp*.3,1.);}",
    }),
  );

// Operations: a show being put on. Lighting towers either side of a stage, their beams sweeping across it
function buildStage(look: Look) {
  const group = new Group();
  const z = -170;
  const parts = [new BoxGeometry(120, 7, 44).translate(20, 3.5, z), new BoxGeometry(100, 44, 3).translate(20, 22, z - 21)];
  [-48, 88].forEach((x) => {
    parts.push(new BoxGeometry(5, 86, 5).translate(x, 43, z + 8), new BoxGeometry(44, 3, 3).translate(x + (x < 0 ? 18 : -18), 84, z + 8));
    for (let y = 8; y < 84; y += 11) parts.push(new BoxGeometry(6, 0.8, 6).translate(x, y, z + 8));
  });
  group.add(new Mesh(mergeGeometries(parts.map((part) => part.toNonIndexed())), new MeshLambertMaterial({ color: look.ground[0] })));
  const screen = new Mesh(new PlaneGeometry(84, 32).translate(20, 24, z - 19), new MeshBasicMaterial({ color: look.accent, fog: false }));
  group.add(screen);
  const beams = [-34, -20, 60, 74].map((x) => {
    const beam = lightCone(105, 20, look.moon);
    beam.position.set(x, 83, z + 8);
    group.add(beam);
    return beam;
  });
  return {
    group,
    update(time: number) {
      beams.forEach((beam, i) => (beam.rotation.z = (i < 2 ? -0.42 : 0.42) + Math.sin(time * 0.5 + i * 1.3) * 0.32));
    },
  };
}

// Creatives: a studio in the open. Big frames hang in the air, each holding one bright swatch, with drops of paint drifting up past them
function buildStudio(look: Look) {
  const group = new Group();
  const swatches = ["#ff9be4", "#ffd34d", "#5ee0e0", "#ffffff", "#ff7a59", "#b78cff"];
  // All on the right, where the words aren't
  const frames = [[36, 62, -150, 34, 44], [86, 80, -190, 46, 32], [134, 52, -160, 30, 40], [190, 72, -205, 40, 30], [150, 92, -250, 44, 56], [250, 60, -290, 40, 52]].map(([x, y, z, wide, tall], i) => {
    const frame = new Group();
    frame.add(
      new Mesh(new BoxGeometry(wide + 4, tall + 4, 1.4), new MeshLambertMaterial({ color: look.ground[0] })),
      new Mesh(new PlaneGeometry(wide, tall).translate(0, 0, 0.9), new MeshBasicMaterial({ color: swatches[i], fog: false })),
    );
    frame.position.set(x, y, z);
    group.add(frame);
    return { frame, y };
  });
  const random = seeded(83);
  const drops = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshBasicMaterial({ fog: false }), 44);
  drops.frustumCulled = false;
  group.add(drops);
  const paint = new Color();
  const places = Array.from({ length: drops.count }, (_, i) => {
    drops.setColorAt(i, paint.set(swatches[i % swatches.length]));
    return { x: 10 + random() * 260, z: -60 - random() * 240, size: 0.8 + random() * 2.2, phase: random() * 100 };
  });
  const matrix = new Matrix4();
  return {
    group,
    update(time: number) {
      frames.forEach(({ frame, y }, i) => {
        frame.rotation.y = Math.sin(time * 0.2 + i) * 0.22;
        frame.position.y = y + Math.sin(time * 0.5 + i) * 1.6;
      });
      places.forEach(({ x, z, size, phase }, i) => drops.setMatrixAt(i, matrix.makeScale(size, size, size).setPosition(x + Math.sin(time * 0.3 + phase) * 4, ((time * 3 + phase * 3) % 120) + 2, z)));
      drops.instanceMatrix.needsUpdate = true;
    },
  };
}

// Marketing: getting the word out. A broadcast mast sends rings of signal rolling outward over a row of billboards
function buildBroadcast(look: Look) {
  const group = new Group();
  const spots = [[44, -170, 0.2], [130, -190, -0.2], [66, -270, 0.3], [205, -250, -0.3]];
  const boards = spots.flatMap(([x, z, turn]) => [
    new BoxGeometry(46, 26, 1.5).rotateY(turn).translate(x, 36, z),
    new BoxGeometry(2.4, 24, 2.4).translate(x - 14, 12, z),
    new BoxGeometry(2.4, 24, 2.4).translate(x + 14, 12, z),
  ]);
  group.add(new Mesh(mergeGeometries(boards.map((part) => part.toNonIndexed())), new MeshLambertMaterial({ color: look.ground[0] })));
  // Bars on each board, standing in for headlines nobody needs to read
  const copy = spots.flatMap(([x, z, turn]) => [[6, 34], [0, 27], [-6, 20]].map(([up, wide]) => new PlaneGeometry(wide, 3.4).translate(0, up, 1).rotateY(turn).translate(x, 36, z)));
  group.add(new Mesh(mergeGeometries(copy), new MeshBasicMaterial({ color: look.moon, fog: false })));
  group.add(new Mesh(new CylinderGeometry(0.8, 3, 112, 6).translate(14, 56, -210), new MeshLambertMaterial({ color: look.ground[1] })));
  const rings = [0, 1, 2, 3].map(() => {
    const ring = new Mesh(new TorusGeometry(1, 0.012, 6, 64).rotateX(Math.PI / 2), new MeshBasicMaterial({ color: look.accent, transparent: true, depthWrite: false, fog: false }));
    ring.position.set(14, 106, -210);
    group.add(ring);
    return ring;
  });
  return {
    group,
    update(time: number) {
      rings.forEach((ring, i) => {
        const run = (time * 0.16 + i / rings.length) % 1;
        ring.scale.setScalar(6 + run * 210);
        (ring.material as MeshBasicMaterial).opacity = (1 - run) * 0.85;
      });
    },
  };
}

// Relations: people connecting. Scattered gathering places, with arcs strung between them and sparks passing along each one
function buildBonds(look: Look) {
  const group = new Group();
  const hubs = [[26, -130], [74, -190], [150, -130], [230, -210], [40, -260], [140, -290]].map(([x, z]) => new Vector3(x, heightAt(x, z, look) + 9, z));
  group.add(new Mesh(mergeGeometries(hubs.map(({ x, y, z }) => new CylinderGeometry(9, 13, 10, 7).translate(x, y - 5, z).toNonIndexed())), new MeshLambertMaterial({ color: look.ground[1], flatShading: true })));
  group.add(new Mesh(mergeGeometries(hubs.map(({ x, y, z }) => new IcosahedronGeometry(4.4, 1).translate(x, y + 5, z))), new MeshBasicMaterial({ color: look.moon, fog: false })));
  const links = [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 5], [4, 5], [3, 5]].map(([from, to]) => {
    const [a, b] = [hubs[from], hubs[to]];
    return new CatmullRomCurve3([a, a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + a.distanceTo(b) * 0.28), b]);
  });
  group.add(new Mesh(mergeGeometries(links.map((curve) => new TubeGeometry(curve, 28, 0.32, 5))), new MeshBasicMaterial({ color: look.accent, fog: false })));
  const sparks = new InstancedMesh(new SphereGeometry(1.1, 10, 8), new MeshBasicMaterial({ color: "#ffffff", fog: false }), links.length * 2);
  sparks.frustumCulled = false;
  group.add(sparks);
  const matrix = new Matrix4();
  const place = new Vector3();
  return {
    group,
    update(time: number) {
      links.forEach((curve, i) => {
        [0, 1].forEach((side) => {
          const run = (time * 0.11 + i * 0.13 + side * 0.5) % 1;
          // Half the sparks run back the other way, because connecting goes both ways
          curve.getPoint(side ? 1 - run : run, place);
          sparks.setMatrixAt(i * 2 + side, matrix.makeTranslation(place.x, place.y, place.z));
        });
      });
      sparks.instanceMatrix.needsUpdate = true;
    },
  };
}

// Administrative: everything in its place. A city of filing stacks in exact rows, with records circling overhead in perfect order
function buildArchive(look: Look) {
  const group = new Group();
  const stacks = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: "#ffffff", flatShading: true }), 96);
  const random = seeded(97);
  const matrix = new Matrix4();
  const still = new Quaternion();
  const [low, high] = look.ground.map((tone) => new Color(tone));
  const tone = new Color();
  for (let i = 0; i < stacks.count; i++) {
    const [row, col] = [Math.floor(i / 12), i % 12];
    // A clear aisle down the middle, leading the eye to the horizon
    const x = (col - 5.5) * 40 + (col < 6 ? -12 : 12);
    const z = -90 - row * 42;
    const tall = 14 + random() * 62;
    stacks.setMatrixAt(i, matrix.compose(new Vector3(x, tall / 2 - 1, z), still, new Vector3(26, tall, 26)));
    stacks.setColorAt(i, tone.copy(low).lerp(high, random()));
  }
  stacks.frustumCulled = false;
  group.add(stacks);
  const records = new InstancedMesh(new BoxGeometry(5, 0.5, 7), new MeshBasicMaterial({ color: look.moon, fog: false }), 40);
  records.frustumCulled = false;
  group.add(records);
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const place = new Vector3();
  const size = new Vector3(1, 1, 1);
  return {
    group,
    update(time: number) {
      for (let i = 0; i < records.count; i++) {
        const a = (i / records.count) * Math.PI * 2 + time * 0.07;
        records.setMatrixAt(i, matrix.compose(place.set(Math.cos(a) * 100, 96 + (i % 2) * 6, -210 + Math.sin(a) * 100), turn.setFromAxisAngle(up, -a), size));
      }
      records.instanceMatrix.needsUpdate = true;
    },
  };
}

const LANDMARKS = [buildLinks, buildWatch, buildListing, buildStage, buildStudio, buildBroadcast, buildBonds, buildArchive];

const CAMERA_Z = 62;
const FOV = 52;
const ASTRONAUT_Z = 18;
// How many world units the screen's height spans at Axie's distance, to turn pixels on the screen into a place in the world
const UNITS_DOWN_THE_SCREEN = 2 * (CAMERA_Z - ASTRONAUT_Z) * Math.tan((FOV * Math.PI) / 360);
// The words' width on a wide screen and the margin beside them, in pixels, from .planet-words in the CSS
const WORDS_WIDTH = 800;

// The world inside a planet, built the first time someone lands there because most visitors won't land on all of them
export function createSurface(low: boolean, px: number) {
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 2400);
  const built = new Map<number, ReturnType<typeof build>>();
  let astronaut: ReturnType<typeof suitUp> | undefined;
  let viewWidth = 1;
  let viewHeight = 1;

  function build(planet: number) {
    const look = ATMOSPHERES[planet];
    const scene = new Scene();
    scene.fog = new Fog(look.low, 90, 640);
    const sun = new DirectionalLight(look.moon, 2.2);
    sun.position.fromArray(look.moonAt);
    // The moon is ahead of the camera, so this lights the side of Axie that faces the visitor
    const fill = new DirectionalLight(look.moon, 1.3);
    fill.position.set(-0.3, 0.5, 1);
    scene.add(sun, fill, new HemisphereLight(look.low, look.ground[0], 1.5));
    const motes = buildMotes(low ? 120 : 260, look.moon, px);
    const landmark = LANDMARKS[planet](look);
    scene.add(buildSky(look), buildGround(look, low ? 70 : 130), motes.points, landmark.group);
    return { scene, motes, landmark };
  }

  return {
    resize(width: number, height: number) {
      camera.aspect = width / height;
      viewWidth = width;
      viewHeight = height;
      // The words take the left of a wide screen, so the middle of this world sits in the rest of it
      if (camera.aspect >= 1) camera.setViewOffset(width, height, -0.2 * width, 0, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    },
    // Arrives whenever the model has loaded. A visitor who lands before that gets the world without Axie until they turn up
    give(suited: ReturnType<typeof suitUp>) {
      astronaut = suited;
    },
    // Only the first dip in should pay for building a world, not the moment it comes into view
    prepare(planet: number) {
      if (!built.has(planet)) built.set(planet, build(planet));
    },
    // arrive runs 0 high in the air, coming through it, to 1 settled on the ground
    render(renderer: WebGLRenderer, time: number, planet: number, arrive: number) {
      const { scene, motes, landmark } = built.get(planet)!;
      motes.material.uniforms.uTime.value = time;
      landmark.update(time);
      if (astronaut) {
        if (astronaut.group.parent !== scene) scene.add(astronaut.group);
        astronaut.update(time);
        const { x, y, roll, pitch, yaw } = floatAt(time);
        // Beside the words on a wide screen, centred in whatever room they leave and sized to it, and up in the open sky above them on a phone. Sinks into place as the camera comes down
        const wide = camera.aspect >= 1;
        const room = Math.max(0.5, Math.min(1, (viewWidth - WORDS_WIDTH) / 400));
        const beside = ((WORDS_WIDTH + (viewWidth - WORDS_WIDTH) / 2 - viewWidth * 0.7) * UNITS_DOWN_THE_SCREEN) / viewHeight;
        astronaut.group.position.set(wide ? beside + x * room : x * 0.45, (wide ? 30 : 37) + y * (wide ? room : 0.6) + (1 - arrive) * 26, ASTRONAUT_Z);
        astronaut.group.rotation.set(pitch, yaw, roll);
        astronaut.group.scale.setScalar(wide ? 17 * room : 11);
      }
      camera.position.set(Math.sin(time * 0.05) * 7, 14 + (1 - arrive) ** 2 * 90, CAMERA_Z);
      camera.lookAt(0, 58 - (1 - arrive) * 30, -120);
      renderer.render(scene, camera);
    },
  };
}
