import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import gsap from "gsap";
import { ATMOSPHERES, EARTH_RADIUS, FLIGHT, GROUND_Y, LOGO_STROKES, passBy, ROCK_DEPTH, WORLD_POS, WORLD_RADIUS, type SkyState } from "@/lib/story";
import { buildCampus } from "./campus";
import { suitUp } from "./astronaut";
import { createRocket } from "./rocket";
import { createSurface } from "./surface";

const NOISE = /* glsl */ `
float hash(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p=p*2.03+7.1;a*=.5;}return v;}
vec3 sphereDir(vec2 uv){float lon=uv.x*6.2831853,lat=(uv.y-.5)*3.1415927;return vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon));}
`;

const hex = (h: string) => {
  // Custom shaders here write display colours directly, so skip the linear conversion
  const c = parseInt(h.slice(1), 16);
  return new Vector3((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
};

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function fibonacci(i: number, n: number) {
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.39996323;
  return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
}

function bake(
  renderer: WebGLRenderer,
  w: number,
  h: number,
  frag: string,
  uniforms: Record<string, { value: unknown }>,
): Texture {
  const target = new WebGLRenderTarget(w, h, {
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
  });
  const scene = new Scene();
  const quad = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      uniforms,
      depthTest: false,
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: NOISE + frag,
    }),
  );
  scene.add(quad);
  renderer.setRenderTarget(target);
  renderer.render(scene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(null);
  quad.geometry.dispose();
  quad.material.dispose();
  return target.texture;
}

function buildEnvironment(renderer: WebGLRenderer) {
  const room = new Scene();
  room.add(new Mesh(new SphereGeometry(20, 16, 12), new MeshBasicMaterial({ color: "#2a1266", side: BackSide })));
  const strip = (color: string, x: number, y: number, z: number, w: number, h: number) => {
    const m = new Mesh(new BoxGeometry(w, h, 0.4), new MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  strip("#ffffff", 0, 14, 4, 18, 5);
  strip("#a9b4ff", -13, 3, 7, 5, 12);
  strip("#e879f9", 13, 1, 4, 4, 14);
  strip("#7c3aed", 0, -12, 6, 24, 5);
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  return env;
}

function buildSatellite() {
  const body = new MeshStandardMaterial({ color: "#cfd4ff", metalness: 0.85, roughness: 0.32 });
  const trim = new MeshStandardMaterial({ color: "#2a1a70", metalness: 0.8, roughness: 0.4 });

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#26127a";
  c.fillRect(0, 0, 128, 64);
  c.strokeStyle = "#a9b4ff";
  for (let x = 0; x <= 128; x += 16) c.strokeRect(x, 0, 16, 64);
  c.beginPath();
  c.moveTo(0, 32);
  c.lineTo(128, 32);
  c.stroke();
  const panelMap = new CanvasTexture(canvas);
  panelMap.colorSpace = SRGBColorSpace;
  const panel = new MeshStandardMaterial({ map: panelMap, metalness: 0.5, roughness: 0.3 });

  const dishProfile: Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 1.1;
    dishProfile.push(new Vector2(r, r * r * 0.38));
  }
  const group = new Group();
  group.add(
    new Mesh(new BoxGeometry(1.5, 1.2, 1.2), body),
    new Mesh(
      mergeGeometries([
        new CylinderGeometry(0.05, 0.05, 1.3, 6).translate(0, 1.2, 0),
        new CylinderGeometry(0.04, 0.04, 2.2, 6).rotateZ(Math.PI / 2),
        new CylinderGeometry(0.34, 0.42, 0.3, 12).translate(0, -0.75, 0),
      ]),
      trim,
    ),
    new Mesh(mergeGeometries([new BoxGeometry(3, 0.04, 1.1).translate(-2.7, 0, 0), new BoxGeometry(3, 0.04, 1.1).translate(2.7, 0, 0)]), panel),
    new Mesh(new LatheGeometry(dishProfile, 24).translate(0, 1.55, 0), new MeshStandardMaterial({ color: "#eef0ff", metalness: 0.4, roughness: 0.4, side: DoubleSide })),
  );
  return group;
}

function buildStars(count: number, px: number) {
  const random = seeded(11);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const tints = ["#ffffff", "#d7dcff", "#a9b4ff", "#e3b8ff", "#c084fc"].map(hex);
  for (let i = 0; i < count; i++) {
    let x = (random() - 0.5) * 460;
    let y = (random() - 0.5) * 460;
    const z = 170 - random() * 1000;
    // Keep the flight path clear so a star never fills the screen
    const r = Math.hypot(x, y);
    if (r < 16) {
      x *= 16 / Math.max(r, 1);
      y *= 16 / Math.max(r, 1);
    }
    positions.set([x, y, z], i * 3);
    const t = tints[Math.floor(random() * tints.length)];
    colors.set([t.x, t.y, t.z], i * 3);
    sizes[i] = 0.7 + Math.pow(random(), 4) * 2.6;
    seeds[i] = random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: px }, uHouse: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uTime,uPx,uHouse;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.);
        float tw=.72+.28*sin(uTime*(.8+aSeed*1.6)+aSeed*40.);
        gl_PointSize=clamp(aSize*uPx*(150./-mv.z),1.,5.*uPx);
        vA=tw*(1.-uHouse);
        vC=aColor;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA;
      void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d);gl_FragColor=vec4(vC,a*a*vA);}`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

function buildOrbiters(
  count: number,
  rMin: number,
  rMax: number,
  flat: boolean,
  tint: string,
  px: number,
  seed: number,
) {
  const random = seeded(seed);
  const orbit = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    orbit.set(
      [
        rMin + random() * (rMax - rMin),
        flat ? (random() - 0.5) * 0.02 : random() * Math.PI,
        random() * Math.PI * 2,
        (0.05 + random() * 0.16) * (random() > 0.5 ? 1 : -1),
      ],
      i * 4,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aOrbit", new BufferAttribute(orbit, 4));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: px }, uTint: { value: hex(tint) } },
    vertexShader: /* glsl */ `
      attribute vec4 aOrbit; uniform float uTime,uPx;
      void main(){
        float a=aOrbit.z+uTime*aOrbit.w, c=cos(aOrbit.y), s=sin(aOrbit.y);
        vec3 p=vec3(cos(a)*aOrbit.x, sin(a)*aOrbit.x*s, sin(a)*aOrbit.x*c);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=clamp(uPx*200./-mv.z,1.5,7.*uPx);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      void main(){float a=smoothstep(.5,.15,length(gl_PointCoord-.5));gl_FragColor=vec4(uTint,a);}`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

// IoT: small things joined to their nearest neighbours, so the swarm reads as a network
function buildThingNetwork(count: number, radius: number, px: number, tint: string) {
  const random = seeded(17);
  const nodes = Array.from({ length: count }, (_, i) =>
    fibonacci(i, count).multiplyScalar(radius * (1.12 + random() * 0.42)),
  );
  const lines: number[] = [];
  nodes.forEach((node, i) => {
    nodes
      .map((other, j) => ({ j, d: node.distanceToSquared(other) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach(({ j }) => lines.push(node.x, node.y, node.z, nodes[j].x, nodes[j].y, nodes[j].z));
  });
  const group = new Group();
  group.add(
    new LineSegments(
      new BufferGeometry().setAttribute("position", new Float32BufferAttribute(lines, 3)),
      new LineBasicMaterial({ color: tint, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }),
    ),
    new Points(
      new BufferGeometry().setFromPoints(nodes),
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uPx: { value: px } },
        vertexShader: "uniform float uPx;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(uPx*300./-mv.z,2.,8.*uPx);gl_Position=projectionMatrix*mv;}",
        fragmentShader: "void main(){float a=smoothstep(.5,.2,length(gl_PointCoord-.5));gl_FragColor=vec4(.92,.94,1.,a);}",
      }),
    ),
  );
  return group;
}

const PLANET_BAKE = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uA,uB,uC; uniform float uScale,uBands,uSeed;
  void main(){
    vec3 d=sphereDir(vUv);
    float warp=fbm(d*uScale+uSeed);
    float bands=.5+.5*sin(d.y*uBands+warp*11.);
    float v=mix(fbm(d*uScale*1.7+warp*2.+uSeed),bands,step(.01,uBands)*.42);
    vec3 col=mix(uA,uB,smoothstep(.25,.6,v));
    col=mix(col,uC,smoothstep(.58,.85,v));
    gl_FragColor=vec4(col,1.);
  }`;

function planetMesh(map: Texture, radius: number, segments: number, rim: string) {
  return new Mesh(
    new SphereGeometry(radius, segments, Math.round(segments * 0.66)),
    new ShaderMaterial({
      uniforms: { uMap: { value: map }, uRim: { value: hex(rim) }, uLight: { value: new Vector3(-0.55, 0.5, 0.67).normalize() } },
      vertexShader: /* glsl */ `
        varying vec3 vN,vV; varying vec2 vUv;
        void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uRim,uLight;
        varying vec3 vN,vV; varying vec2 vUv;
        void main(){
          vec3 n=normalize(vN);
          float l=smoothstep(-.28,.9,dot(n,uLight));
          float rim=pow(1.-max(dot(n,normalize(vV)),0.),3.2);
          vec3 c=texture2D(uMap,vUv).rgb*(.09+l*1.05);
          c+=uRim*rim*(.22+l*.9);
          gl_FragColor=vec4(c,1.);
        }`,
    }),
  );
}

function buildPlanet(
  renderer: WebGLRenderer,
  size: number,
  radius: number,
  segments: number,
  look: { a: string; b: string; c: string; scale: number; bands: number; seed: number; rim: string },
) {
  const map = bake(renderer, size, size / 2, PLANET_BAKE, {
    uA: { value: hex(look.a) },
    uB: { value: hex(look.b) },
    uC: { value: hex(look.c) },
    uScale: { value: look.scale },
    uBands: { value: look.bands },
    uSeed: { value: look.seed },
  });
  return planetMesh(map, radius, segments, look.rim);
}

// Manila, enlarged so the pad has land to stand on when seen from the ground
const HOME = { lon: 121, lat: 14.6 };

// Continents as rough ellipses: longitude, latitude, half-width and half-height in degrees. The bake's noise roughens the coasts
const LAND = [
  [-100, 50, 32, 20], [-80, 65, 35, 10], [-112, 38, 14, 12], [-95, 20, 8, 8], [-88, 14, 5, 7], [-40, 72, 12, 9],
  [-60, -8, 16, 16], [-66, -30, 8, 18], [-70, -48, 3, 8],
  [18, 10, 24, 16], [25, -12, 14, 18], [45, 8, 6, 5], [22, -28, 8, 6], [47, -19, 2.5, 6],
  [15, 50, 18, 9], [30, 58, 22, 10], [-3, 42, 5, 5], [-2, 54, 2, 4],
  [90, 55, 55, 18], [100, 35, 38, 14], [78, 20, 9, 10], [105, 15, 8, 10], [45, 28, 10, 9], [135, 62, 20, 8],
  [112, -2, 9, 3], [HOME.lon, HOME.lat, 9, 12], [138, 36, 3, 6], [134, -25, 18, 11], [172, -42, 2, 5], [0, -85, 180, 8],
];

const EARTH_BAKE = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uMask; uniform vec2 uHome;
  void main(){
    vec3 d=sphereDir(vUv);
    float warp=fbm(d*3.2+4.)-.5;
    float coast=texture2D(uMask,vUv+vec2(warp*.035,warp*.05)).r+(fbm(d*11.+warp)-.5)*.28;
    float land=smoothstep(.46,.54,coast);
    vec3 sea=mix(vec3(.04,.13,.42),vec3(.07,.33,.68),fbm(d*4.+9.));
    vec3 ground=mix(vec3(.13,.46,.3),vec3(.52,.48,.27),smoothstep(.42,.66,fbm(d*6.+2.)));
    vec3 c=mix(sea,ground,land);
    c=mix(c,vec3(.93,.96,1.),smoothstep(.86,.92,abs(vUv.y-.5)*2.+warp*.2));
    // Clear skies over home, so seen from the pad the ground is ground
    float clear=smoothstep(.03,.12,length((vUv-uHome)*vec2(2.,1.)));
    float cloud=smoothstep(.54,.72,fbm(d*5.+warp*2.+20.))*clear;
    gl_FragColor=vec4(mix(c,vec3(.95,.93,1.),cloud*.72),1.);
  }`;

function buildEarth(renderer: WebGLRenderer, size: number, segments: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#000";
  c.fillRect(0, 0, 1024, 512);
  c.filter = "blur(3px)";
  c.fillStyle = "#fff";
  LAND.forEach(([lon, lat, rx, ry]) => {
    c.beginPath();
    c.ellipse(((lon + 180) / 360) * 1024, ((90 - lat) / 180) * 512, (rx / 360) * 1024, (ry / 180) * 512, 0, 0, Math.PI * 2);
    c.fill();
  });
  const u = (HOME.lon + 180) / 360;
  const v = (HOME.lat + 90) / 180;
  const map = bake(renderer, size, size / 2, EARTH_BAKE, { uMask: { value: new CanvasTexture(canvas) }, uHome: { value: new Vector2(u, v) } });
  const mesh = planetMesh(map, EARTH_RADIUS, segments, "#8fc7ff");
  mesh.position.y = GROUND_Y - EARTH_RADIUS;
  // SphereGeometry's own mapping of a texture point onto the sphere, turned so that point is the top, under the pad
  const phi = u * Math.PI * 2;
  const theta = (1 - v) * Math.PI;
  mesh.quaternion.setFromUnitVectors(new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)), new Vector3(0, 1, 0));
  return mesh;
}

// The logo's neon line drawn as a star chart, tracing itself stroke by stroke as the scroll moves
function buildConstellation(px: number) {
  const scale = 55 / 860;
  const toWorld = (x: number, y: number) => new Vector3((x - 500) * scale, (380 - y) * scale, 0);
  const curves = LOGO_STROKES.map((stroke) => new CatmullRomCurve3(stroke.map(([x, y]) => toWorld(x, y)), false, "centripetal"));
  const lengths = curves.map((curve) => curve.getLength());
  const total = lengths.reduce((sum, length) => sum + length, 0);
  // Leaves the last of the scroll for the finished figure to sit and glow
  const drawn = 0.86;

  const stars: { x: number; y: number; size: number; at: number; warm: number }[] = [];
  const positions: number[] = [];
  const uvs: number[] = [];
  const times: number[] = [];
  const indices: number[] = [];
  const width = 0.42;
  let run = 0;
  curves.forEach((curve, i) => {
    const stroke = LOGO_STROKES[i];
    const steps = (stroke.length - 1) * 8;
    const points = curve.getPoints(steps);
    // One unbroken ribbon per stroke: quads that only meet at their edges leave a visible tick at every join
    points.forEach((point, n) => {
      const a = points[Math.max(0, n - 1)];
      const b = points[Math.min(steps, n + 1)];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = (-(b.y - a.y) / length) * width;
      const ny = ((b.x - a.x) / length) * width;
      const first = positions.length / 3;
      positions.push(point.x + nx, point.y + ny, 0, point.x - nx, point.y - ny, 0);
      uvs.push(0, -1, 0, 1);
      const time = ((run + (lengths[i] * n) / steps) / total) * drawn;
      times.push(time, time);
      if (n < steps) indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    });
    stroke.forEach(([x, y, size], n) => {
      if (!size) return;
      const point = toWorld(x, y);
      stars.push({ x: point.x, y: point.y, size, at: ((run + (lengths[i] * n) / (stroke.length - 1)) / total) * drawn, warm: 0 });
    });
    run += lengths[i];
  });
  const random = seeded(7);
  for (let i = 0; i < 170; i++) {
    // The reference's scattered amber stars are every twelfth one
    const warm = i % 12 === 0 ? 1 : 0;
    stars.push({ x: (random() - 0.5) * 100, y: (random() - 0.5) * 58, size: warm ? 0.7 : 0.26 + random() * 0.4, at: random() * 0.8, warm });
  }

  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  lineGeometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  lineGeometry.setAttribute("aTime", new Float32BufferAttribute(times, 1));
  lineGeometry.setIndex(indices);
  const uniforms = { uP: { value: 0 }, uTime: { value: 0 }, uPx: { value: px } };
  const lines = new Mesh(
    lineGeometry,
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms,
      vertexShader: "attribute float aTime;varying vec2 vU;varying float vTime;void main(){vU=uv;vTime=aTime;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: /* glsl */ `
        uniform float uP; varying vec2 vU; varying float vTime;
        void main(){
          if(vTime>uP) discard;
          float across=abs(vU.y);
          float core=exp(-across*across*30.);
          float halo=exp(-across*2.8)*.3;
          gl_FragColor=vec4(vec3(.95,.93,1.)*core+vec3(.32,.66,1.)*halo,1.);
        }`,
    }),
  );

  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute("position", new Float32BufferAttribute(stars.flatMap((star) => [star.x, star.y, 0]), 3));
  starGeometry.setAttribute("aAt", new Float32BufferAttribute(stars.map((star) => star.at), 1));
  starGeometry.setAttribute("aSize", new Float32BufferAttribute(stars.map((star) => star.size), 1));
  starGeometry.setAttribute("aWarm", new Float32BufferAttribute(stars.map((star) => star.warm), 1));
  const points = new Points(
    starGeometry,
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms,
      vertexShader: /* glsl */ `
        attribute float aAt,aSize,aWarm; uniform float uP,uTime,uPx; varying float vPop,vSize,vWarm;
        void main(){
          float t=clamp((uP-aAt)/.05,0.,1.);
          // Each star overshoots as the line reaches it, then settles
          vPop=t*(1.+sin(t*3.1416)*.9);
          vSize=aSize;
          vWarm=aWarm;
          vec4 mv=modelViewMatrix*vec4(position,1.);
          float tw=.86+.14*sin(uTime*1.7+position.x*3.+position.y*2.);
          gl_PointSize=aSize*uPx*(2100./-mv.z)*vPop*tw;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vPop,vSize,vWarm;
        void main(){
          vec2 c=gl_PointCoord*2.-1.;
          float d=length(c);
          float core=exp(-d*d*42.);
          float halo=exp(-d*5.)*.45;
          // Only the brightest stars carry a four-point flare
          float flare=smoothstep(1.6,2.2,vSize)*(exp(-abs(c.x)*48.)*exp(-abs(c.y)*3.6)+exp(-abs(c.y)*48.)*exp(-abs(c.x)*3.6));
          vec3 tint=mix(vec3(.55,.72,1.),vec3(1.,.7,.3),vWarm);
          gl_FragColor=vec4((vec3(1.)*core+tint*(halo+flare*.9))*smoothstep(1.,.72,d)*min(vPop,1.),1.);
        }`,
    }),
  );
  points.frustumCulled = false;

  // The logo itself: a wide blur is its cyan glow behind the chart, and once the line is drawn it shows through faintly
  const logoMap = { value: null as Texture | null };
  new TextureLoader().load("/cncp-decal.webp", (texture) => (logoMap.value = texture), undefined, (error) => console.error(error));
  const glow = new Mesh(
    new PlaneGeometry(1000 * scale, 773 * scale),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { ...uniforms, uLogo: logoMap },
      vertexShader: "varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: /* glsl */ `
        uniform sampler2D uLogo; uniform float uP; varying vec2 vU;
        void main(){
          float wide=textureLod(uLogo,vU,3.5).a;
          vec4 sharp=textureLod(uLogo,vU,0.);
          vec3 c=vec3(.14,.5,1.)*wide*.42*smoothstep(.1,.86,uP)+sharp.rgb*sharp.a*.12*smoothstep(.7,1.,uP);
          gl_FragColor=vec4(c,1.);
        }`,
    }),
  );
  glow.position.set(0, (380 - 386.5) * scale, -1);

  const group = new Group();
  group.add(glow, lines, points);
  return { group, uniforms };
}

// The flight log's asteroids, one per event, each with a comet's tail streaming back the way it came. Shooting stars
// cross behind them, and a belt of loose rock gives the moving camera something to pass
function buildAsteroids(count: number) {
  const rockShape = new IcosahedronGeometry(1, 3);
  const position = rockShape.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const lump = 1 + Math.sin(x * 3.1 + 1) * Math.sin(y * 2.7 + 2) * Math.sin(z * 3.3) * 0.2 + Math.sin(x * 9) * Math.sin(y * 8) * Math.sin(z * 10) * 0.05;
    position.setXYZ(i, x * lump, y * lump, z * lump);
  }
  rockShape.computeVertexNormals();
  const rockSkin = new MeshStandardMaterial({ color: "#6a5a9c", roughness: 0.92, metalness: 0.08, flatShading: true });

  const tailShape = new PlaneGeometry(1, 1).translate(0.5, 0, 0);
  const tailSkin = () =>
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uFade: { value: 1 } },
      vertexShader: "varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: /* glsl */ `
        uniform float uFade; varying vec2 vU;
        void main(){
          float along=vU.x, across=(vU.y-.5)*2., reach=pow(1.-along,1.1)+.02;
          float a=exp(-across*across/(reach*reach)*5.)*pow(1.-along,2.2);
          vec3 c=mix(vec3(1.,.97,1.),vec3(.45,.3,1.),smoothstep(0.,.4,along));
          gl_FragColor=vec4(c*a*uFade*.8,1.);
        }`,
    });

  const group = new Group();
  // Tails stream up and to the right, back towards where the rocks come from
  const tailAngle = Math.atan2(0.72, 1);
  const rocks = Array.from({ length: count }, () => {
    const holder = new Group();
    const rock = new Mesh(rockShape, rockSkin);
    const tailMaterial = tailSkin();
    const tail = new Mesh(tailShape, tailMaterial);
    tail.rotation.z = tailAngle;
    tail.position.z = -2;
    holder.add(tail, rock);
    group.add(holder);
    return { holder, rock, tail, tailMaterial };
  });

  const streaks = [0, 1, 2, 3].map(() => {
    const material = tailSkin();
    const streak = new Mesh(tailShape, material);
    streak.rotation.z = tailAngle;
    group.add(streak);
    return { streak, material };
  });

  let seed = 31;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const belt = new InstancedMesh(rockShape, rockSkin, 26);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  for (let i = 0; i < 26; i++) {
    const place = new Vector3((random() - 0.5) * 300, (random() - 0.5) * 120, -540 - random() * 170);
    const size = 1 + random() * 5;
    turn.setFromAxisAngle(new Vector3(random(), random(), random()).normalize(), random() * 6);
    belt.setMatrixAt(i, matrix.compose(place, turn, new Vector3(size, size * (0.7 + random() * 0.5), size)));
  }
  return { group, rocks, streaks, belt };
}

// Exhaust: dust left along the path already flown, so it holds still when the rocket does
function buildTrail(count: number, px: number) {
  const positions = new Float32Array(count * 3);
  const random = seeded(23);
  const age = new Float32Array(count);
  const jitter = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    age[i] = i / count;
    jitter.set([random() - 0.5, random() - 0.5, random() - 0.5], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aAge", new BufferAttribute(age, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uPx: { value: px }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aAge; uniform float uPx; varying float vAge;
      void main(){vAge=aAge;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(uPx*(26.+aAge*150.)/-mv.z*3.,2.,46.*uPx);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; varying float vAge;
      void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);vec3 c=mix(vec3(.9,.86,1.),vec3(.42,.26,.95),vAge);gl_FragColor=vec4(c*a*a*(1.-vAge)*.55*uAlpha,1.);}`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material, positions, jitter };
}

// Pad smoke, thrown outward along the floor at ignition
function buildSmoke(count: number, px: number) {
  const random = seeded(29);
  const dirs = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2;
    const r = 0.25 + random() * 0.75;
    dirs.set([Math.cos(a) * r, 0.04 + random() * 0.22, Math.sin(a) * r], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aDir", new BufferAttribute(dirs, 3));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uSmoke: { value: 0 }, uPx: { value: px } },
    vertexShader: /* glsl */ `
      attribute vec3 aDir; uniform float uSmoke,uPx; varying float vA;
      void main(){
        vec3 p=vec3(0.,-2.3,0.)+aDir*uSmoke*17.;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=clamp(uPx*(120.+uSmoke*780.)/-mv.z,4.,140.*uPx);
        vA=sin(min(uSmoke*1.15,1.)*3.1416);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: "varying float vA;void main(){float a=smoothstep(.5,0.,length(gl_PointCoord-.5));gl_FragColor=vec4(vec3(.74,.62,1.)*a*a*.16*vA,1.);}",
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

export function createSky(canvas: HTMLCanvasElement, s: SkyState) {
  const low = matchMedia("(max-width: 768px)").matches || navigator.hardwareConcurrency <= 4;
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false });
  let dpr = Math.min(devicePixelRatio, low ? 1.75 : 2);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(s.fov, 1, 0.1, 2600);
  scene.environment = buildEnvironment(renderer);
  const ambient = new AmbientLight("#8a7cff", 0.5);
  const sun = new DirectionalLight("#ffffff", 1.6);
  sun.position.set(-6, 8, 8);
  scene.add(ambient, sun);
  // Melts the far ground and buildings into the daytime sky, whose horizon is this colour. Far past anything else that takes fog
  const haze = new Fog("#8fc9f5", 50, 300);
  const spaceHaze = new Color("#170a38");
  const spaceAmbient = new Color("#8a7cff");
  const dayAmbient = new Color("#dcebff");
  scene.fog = haze;

  const nebula = bake(renderer, low ? 1024 : 2048, low ? 512 : 1024, /* glsl */ `
    varying vec2 vUv;
    void main(){
      vec3 d=sphereDir(vUv);
      float band=exp(-pow(d.y+.12*sin(d.x*3.),2.)*5.);
      float w=fbm(d*2.2+3.);
      float n=fbm(d*3.1+w*2.4);
      float wisps=smoothstep(.34,.8,n)*(.35+band);
      vec3 c=mix(vec3(.105,.048,.27),vec3(.19,.08,.46),wisps);
      c=mix(c,vec3(.34,.13,.66),smoothstep(.34,.72,wisps)*.8);
      c=mix(c,vec3(.6,.34,.82),smoothstep(.62,.95,wisps)*.4);
      gl_FragColor=vec4(c,1.);
    }`, {});

  // Baked once, because noise worked out per pixel across a full-screen sky is more than a mid-range phone should be asked for
  const clouds = bake(renderer, low ? 1024 : 2048, low ? 512 : 1024, /* glsl */ `
    varying vec2 vUv;
    void main(){
      vec3 d=sphereDir(vUv);
      float n=fbm(d*vec3(3.2,9.,3.2)+11.);
      gl_FragColor=vec4(vec3(smoothstep(.5,.72,n)),1.);
    }`, {});

  const skyMaterial = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uMap: { value: nebula }, uClouds: { value: clouds }, uHouse: { value: 1 }, uLight: { value: 1 }, uDrift: { value: 0 } },
    vertexShader: "varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap,uClouds; uniform float uHouse,uLight,uDrift; varying vec3 vD;
      void main(){
        vec3 d=normalize(vD);
        vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,asin(d.y)/3.1415927+.5);
        vec3 space=textureLod(uMap,uv,0.).rgb;
        float e=max(d.y,0.);
        vec3 day=mix(vec3(.56,.79,.96),vec3(.06,.29,.66),pow(e,.35));
        day=mix(day,vec3(.97,.98,1.),textureLod(uClouds,uv+vec2(uDrift,0.),0.).r*smoothstep(.14,.42,e)*.85);
        vec3 c=mix(space,day,uHouse);
        float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        gl_FragColor=vec4((c+(n-.5)/180.)*uLight,1.);
      }`,
  });
  const sky = new Mesh(new SphereGeometry(1200, 40, 24), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const starCount = low ? 2400 : 6500;
  const stars = buildStars(starCount, dpr);
  scene.add(stars.points);

  const curve = new CatmullRomCurve3(FLIGHT.map(([x, y, z]) => new Vector3(x, y, z)), false, "centripetal");
  const lastStop = FLIGHT.length - 1;
  const surface = createSurface(low, dpr);
  // The same Axie that flies the rocket, dressed up for going outside
  const rocket = createRocket(low, (axie, clip) => surface.give(suitUp(axie, clip)));
  scene.add(rocket.group, rocket.yard);
  const trailCount = low ? 50 : 90;
  const trail = buildTrail(trailCount, dpr);
  scene.add(trail.points);
  const smoke = buildSmoke(low ? 70 : 140, dpr);
  scene.add(smoke.points);

  const satellite = buildSatellite();
  scene.add(satellite);
  const relay = satellite.clone();
  relay.scale.setScalar(0.55);

  const earth = buildEarth(renderer, low ? 1024 : 2048, low ? 64 : 112);
  const pad = new Mesh(new CylinderGeometry(3.5, 4, 0.5, 48).translate(0, GROUND_Y + 0.05, 0), new MeshStandardMaterial({ color: "#4a3aa8", metalness: 0.5, roughness: 0.55 }));
  pad.receiveShadow = true;
  const campus = buildCampus(low);
  campus.group.add(pad);
  scene.add(earth, campus.group);

  const constellation = buildConstellation(dpr);
  constellation.group.position.set(0, 6.6, -110);
  scene.add(constellation.group);

  const texSize = low ? 768 : 1536;
  const segments = low ? 40 : 64;
  const looks = [
    { scale: 2.2, bands: 34, seed: 2 },
    { scale: 3.4, bands: 0, seed: 9 },
    { scale: 2, bands: 9, seed: 22 },
    // From orbit each planet wears the colours of the air inside it, so going down feels like arriving somewhere you could already see
  ].map((look, i) => ({ ...look, a: ATMOSPHERES[i].ground[0], b: ATMOSPHERES[i].ground[1], c: ATMOSPHERES[i].low, rim: ATMOSPHERES[i].accent }));
  const worlds = looks.map((look, i) => {
    const group = new Group();
    group.position.set(...WORLD_POS[i]);
    const planet = buildPlanet(renderer, texSize, WORLD_RADIUS, segments, look);
    group.add(planet);
    scene.add(group);
    return { group, planet };
  });

  // Enterprise Networking: packets travelling round one link, with a relay satellite on it
  const packets = buildOrbiters(low ? 70 : 130, WORLD_RADIUS * 1.5, WORLD_RADIUS * 1.5, true, "#ffffff", dpr, 3);
  const linkRing = new Mesh(
    new RingGeometry(WORLD_RADIUS * 1.495, WORLD_RADIUS * 1.505, 128).rotateX(Math.PI / 2),
    new MeshBasicMaterial({ color: ATMOSPHERES[0].accent, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  );
  const linkPlane = new Group();
  linkPlane.rotation.set(0.42, 0, 0.3);
  linkPlane.add(linkRing, packets.points, relay);
  worlds[0].group.add(linkPlane);

  // Cybersecurity Operations: a lattice shell that closes as you arrive
  const shellMaterial = new LineBasicMaterial({ color: ATMOSPHERES[1].accent, transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false });
  const shell = new LineSegments(new EdgesGeometry(new IcosahedronGeometry(WORLD_RADIUS * 1.14, 2)), shellMaterial);
  worlds[1].group.add(shell);

  // Development Networking: nodes joined by the links code can reach and automate
  const things = buildThingNetwork(low ? 44 : 70, WORLD_RADIUS, dpr, ATMOSPHERES[2].accent);
  worlds[2].group.add(things);

  const stops = [...canvas.parentElement!.querySelectorAll<HTMLElement>(".log-stop")];
  const asteroids = buildAsteroids(stops.length);
  // Hung off the camera, so they keep their place on screen while it tracks along with the rocket
  camera.add(asteroids.group);
  scene.add(camera, asteroids.belt);
  stops.forEach((stop) => (stop.style.left = stop.style.top = "0"));
  let rockSize = 8;

  const core = new Vector3();

  let width = 1;
  let height = 1;
  const resize = () => {
    const parent = canvas.parentElement!;
    width = parent.clientWidth;
    height = parent.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    surface.resize(width, height);
    constellation.group.scale.setScalar(Math.min(1, camera.aspect * 0.87));
    // On a wide screen it sits a little right, clear of the copy in the bottom left
    constellation.group.position.x = camera.aspect >= 1 ? 5 : 0;
    // Each rock is as big as it needs to be for the photo on it to sit inside its outline, whatever the screen
    const pixelsPerUnit = height / (2 * ROCK_DEPTH * Math.tan((s.fov * Math.PI) / 360));
    rockSize = (stops[0]?.querySelector<HTMLElement>(".log-frame")?.offsetWidth ?? 480) * 0.58 / pixelsPerUnit;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);
  resize();

  let inView = true;
  const seen = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting));
  seen.observe(canvas);

  const stage = canvas.parentElement!;
  const signal = stage.querySelector<HTMLElement>('[data-beat="signal"]');
  const dish = new Vector3();
  let screenX = 0;
  let screenY = 0;
  const place = (point: Vector3) => {
    point.project(camera);
    screenX = (point.x * 0.5 + 0.5) * width;
    screenY = (0.5 - point.y * 0.5) * height;
  };

  let lastKey = "";
  let lastDraw = 0;
  let wasMoving = false;
  let frame = 0;
  let slow = 16;
  let level = 0;
  let lastFly = s.fly;
  let speed = 0;
  const craft = new Vector3();
  const heading = new Vector3();
  const dust = new Vector3();
  const aim = new Vector3();
  const ahead = new Vector3();
  const behind = new Vector3();
  const beside = new Vector3();
  const worldUp = new Vector3(0, 1, 0);
  const steady = new Vector3(0, 1, 0);
  const steadySide = new Vector3(1, 0, 0);
  const sideways = new Vector3();

  const tick = (time: number) => {
    if (!inView || document.hidden) return;
    // Drawing on every tick of a 120 or 240Hz display floods the GPU queue and stalls the page
    if (time - lastDraw < 0.0145) return;
    const gap = (time - lastDraw) * 1000;
    lastDraw = time;
    const key = Object.values(s).join();
    const moving = key !== lastKey;
    lastKey = key;
    frame++;
    // Twinkle does not need 60fps, so an idle page draws half the frames
    if (!moving && frame % 2) return;

    if (moving && wasMoving) slow += (gap - slow) * 0.04;
    wasMoving = moving;
    if (frame > 120 && slow > 30 && level < 2) {
      // Trade star count and some sharpness for frame rate on hardware that is struggling. Never below one pixel for each pixel on
      // screen, where the whole show goes visibly soft, and a passing stall on the visitor's machine would make that permanent
      level++;
      dpr = Math.max(Math.min(devicePixelRatio, 1), dpr * 0.85);
      renderer.setPixelRatio(dpr);
      resize();
      stars.points.geometry.setDrawRange(0, Math.floor(starCount * (level === 1 ? 0.7 : 0.45)));
      slow = 16;
      frame = 0;
    }

    const dt = Math.min(gap / 1000, 0.1);
    const u = s.fly / lastStop;
    curve.getPoint(u, craft);
    curve.getTangent(u, heading);
    // The path's corners would swing a camera hung off them, so the rocket and its chase camera both turn through them gently
    const settle = 1 - Math.exp(-dt * 2.6);
    steady.lerp(heading, settle).normalize();
    // Straight up there is no sideways to follow from, so that keeps the last one rather than spinning round the rocket
    sideways.crossVectors(heading, worldUp);
    if (sideways.lengthSq() > 0.04) steadySide.lerp(sideways.normalize(), settle).normalize();
    if (s.house < 0.5) {
      // Hanging in space it drifts a little, which sitting on the pad it would not
      const drift = 1 - s.house * 2;
      craft.x += Math.sin(time * 0.7) * 0.18 * drift;
      craft.y += Math.sin(time * 1.1) * 0.22 * drift;
    }

    camera.position.set(s.cx, s.cy, s.cz);
    aim.set(s.lx, s.ly, s.lz);
    // Between chapters the camera follows off the rocket's shoulder, close enough to the side that the cabin still shows
    if (s.chase > 0) {
      beside.copy(steadySide);
      // A narrow screen has less width to fit the rocket in, so it follows from further out
      const reach = camera.aspect >= 1 ? 1 : 1.9;
      behind.copy(craft).addScaledVector(steady, -8 * reach).addScaledVector(beside, 20 * reach);
      behind.y += 5;
      camera.position.lerp(behind, s.chase);
      aim.lerp(ahead.copy(craft).addScaledVector(steady, camera.aspect >= 1 ? 8 : 3), s.chase);
    }
    // Going down to a planet: the camera turns square on and falls towards it, with its air closing over the screen before it would reach the surface
    const fall = Math.min(1, s.inside * 2);
    if (fall > 0) {
      core.set(...WORLD_POS[s.planet]);
      surface.prepare(s.planet);
      camera.position.lerp(core, fall * fall * 0.72);
      aim.lerp(core, Math.min(1, fall * 1.8));
    }
    camera.lookAt(aim);
    const side = s.side * (1 - s.chase) * (1 - fall);
    // Narrow screens pull back a little so a whole world still fits across the width
    camera.fov = (camera.aspect >= 1 ? s.fov : s.fov + Math.abs(side) * 22) + fall * 16;
    if (camera.aspect >= 1) camera.setViewOffset(width, height, -side * 0.24 * width, 0, width, height);
    else camera.setViewOffset(width, height, 0, Math.abs(side) * 0.17 * height, width, height);

    sky.position.copy(camera.position);
    const light = 1 - s.dim;
    skyMaterial.uniforms.uHouse.value = s.house;
    skyMaterial.uniforms.uLight.value = light;
    stars.points.visible = s.dim < 0.5;
    stars.material.uniforms.uTime.value = time;
    stars.material.uniforms.uHouse.value = s.house;
    // The surroundings the metal reflects are the purple of space, so on the ground daylight takes over from them
    scene.environmentIntensity = (0.75 - s.house * 0.4) * light;
    ambient.color.copy(spaceAmbient).lerp(dayAmbient, s.house);
    ambient.intensity = (0.5 + s.house * 0.9) * light;
    sun.intensity = (1.6 + s.house * 0.8) * light;
    // As the sky turns to space the haze closes in until the campus has melted into it and can go without a pop. In space, where far rocks would turn flat with it, there is none
    const hazy = s.house > 0.01;
    haze.near = hazy ? 60 - s.house * 10 : 1e4;
    haze.far = hazy ? 72 + s.house * 228 : 2e4;
    // Darkens well ahead of the sky, or the campus shows as a bright slab of horizon colour against the dark above it
    haze.color.set("#8fc9f5").lerp(spaceHaze, 1 - s.house ** 3).multiplyScalar(light);
    campus.setDim(s.dim);
    // Lost a little before the sky turns, when the fog has already taken everything at this distance
    campus.setHaze(haze.color, Math.min(1, (1 - s.house) / 0.28));
    // People, traffic and birds only move while someone can see them
    if (campus.group.visible && light > 0) campus.animate(time);
    skyMaterial.uniforms.uDrift.value = (time * 0.0012) % 1;

    // Thrust follows the scroll: the flame stretches while the visitor moves and idles when they stop
    speed += (Math.abs(s.fly - lastFly) / Math.max(dt, 0.001) - speed) * 0.18;
    lastFly = s.fly;
    rocket.place(craft, steady, camera, s.ground);
    rocket.animate(time, dt, s.burn * Math.min(1, 0.32 + speed * 0.5), Math.min(speed, 2), s, camera);

    trail.points.visible = s.house < 0.95 && s.burn > 0;
    if (trail.points.visible) {
      trail.material.uniforms.uAlpha.value = s.burn;
      for (let i = 0; i < trailCount; i++) {
        const back = Math.max(0, s.fly - 0.05 - i * 0.022) / lastStop;
        curve.getPoint(back, dust);
        const spread = 0.15 + (i / trailCount) * 1.5;
        trail.positions[i * 3] = dust.x + trail.jitter[i * 3] * spread;
        trail.positions[i * 3 + 1] = dust.y + trail.jitter[i * 3 + 1] * spread;
        trail.positions[i * 3 + 2] = dust.z + trail.jitter[i * 3 + 2] * spread;
      }
      trail.points.geometry.attributes.position.needsUpdate = true;
    }
    smoke.points.visible = s.smoke > 0 && s.smoke < 1;
    smoke.material.uniforms.uSmoke.value = s.smoke;

    // Campus and planet never share a frame: by the time the sky has turned to space the camera has tipped up off the ground
    campus.group.visible = s.house > 0.01;
    // The ground falls away as the rocket climbs, so nothing is left in frame to vanish when the sky reaches space
    campus.group.position.y = -(Math.max(0, 1 - s.house / 0.5) ** 2) * 60;
    earth.visible = !campus.group.visible && s.cz > -200;

    satellite.visible = s.sat > 0 && s.sat < 1;
    if (satellite.visible) {
      satellite.scale.setScalar(camera.aspect >= 1 ? 1 : 0.55);
      // On narrow screens the path stays on the camera's line of sight so the craft is never cut off
      satellite.position.set(camera.aspect >= 1 ? -24 + s.sat * 50 : s.cx * 0.6 + (s.sat - 0.5) * 10, 8 - s.sat * 9, -44 - s.sat * 8);
      satellite.rotation.set(0.5 + s.sat * 0.8, -0.6 + s.sat * 1.4, 0.25);
    }

    constellation.group.visible = s.links > 0.001 && s.cz > -112;
    if (constellation.group.visible) {
      constellation.uniforms.uP.value = s.links;
      constellation.uniforms.uTime.value = time;
    }

    worlds.forEach(({ group, planet }, i) => {
      group.visible = Math.abs(s.cz - WORLD_POS[i][2]) < 150;
      if (group.visible) planet.rotation.y = time * 0.03 + i;
    });
    // The first world grows in once the camera leaves the constellation, so it never sits behind a heading
    worlds[0].group.scale.setScalar(Math.min(1, Math.max(0.001, (-s.cz - 41) / 30)));
    if (worlds[0].group.visible) {
      packets.material.uniforms.uTime.value = time;
      const a = time * 0.14;
      relay.position.set(Math.cos(a) * WORLD_RADIUS * 1.5, 0, Math.sin(a) * WORLD_RADIUS * 1.5);
      relay.rotation.y = -a;
    }
    if (worlds[1].group.visible) {
      shell.scale.setScalar(2.4 - s.shell * 1.4);
      shellMaterial.opacity = s.shell * 0.8;
      shell.rotation.y = time * 0.05;
    }
    if (worlds[2].group.visible) things.rotation.y = time * 0.06;

    const passing = s.log > -1 && s.log < stops.length;
    asteroids.group.visible = passing;
    asteroids.belt.visible = s.cz < -400 && s.cz > -600;
    // The rocket climbs out of the belt as the last event goes, so loose rock doesn't sit behind the crew's constellations
    asteroids.belt.position.y = -(Math.max(0, s.log - (stops.length - 1)) ** 2) * 180;
    if (passing) {
      const halfUp = Math.tan((camera.fov * Math.PI) / 360);
      const wide = camera.aspect >= 1;
      const [restX, restY] = wide ? [-0.4, -0.08] : [0, 0.34];
      asteroids.rocks.forEach(({ holder, rock, tail, tailMaterial }, i) => {
        const p = s.log - i;
        holder.visible = Math.abs(p) < 1;
        if (!holder.visible) return;
        const [fx, fy, depth] = passBy(p, restX, restY);
        const up = depth * halfUp;
        holder.position.set(fx * up * camera.aspect, fy * up, -depth);
        rock.scale.setScalar(rockSize);
        rock.rotation.set(time * 0.05 + i, time * 0.08 + i * 2, 0);
        tail.scale.set(rockSize * (4.6 + Math.sin(time * 0.9 + i) * 0.4), rockSize * 1.3, 1);
        tailMaterial.uniforms.uFade.value = Math.min(1, (1 - Math.abs(p)) * 4);
        // The photo rides on the rock, so it grows and moves exactly as the rock does. Whole pixels, because text and photos on a fractional one go soft
        stops[i].style.transform = `translate(${Math.round((fx * 0.5 + 0.5) * width)}px,${Math.round((0.5 - fy * 0.5) * height)}px) scale(${ROCK_DEPTH / depth})`;
      });
      asteroids.streaks.forEach(({ streak, material }, i) => {
        const cycle = (time * 0.13 + i * 0.27) % 1;
        streak.visible = cycle < 0.22;
        if (!streak.visible) return;
        const run = cycle / 0.22;
        const up = 170 * halfUp;
        streak.position.set((0.95 - i * 0.36 - run * 0.7) * up * camera.aspect, (0.95 - (i % 2) * 0.3 - run * 0.8) * up, -170);
        streak.scale.set(50 * Math.sin(run * Math.PI), 1.6, 1);
        material.uniforms.uFade.value = Math.sin(run * Math.PI);
      });
    }

    if (s.inside >= 0.5) surface.render(renderer, time, s.planet, (s.inside - 0.5) * 2);
    else renderer.render(scene, camera);

    // DOM pieces that belong to 3D objects follow them on screen
    // Written to the small element that uses them: on the stage they would restyle every beat
    if (satellite.visible && signal) {
      place(satellite.localToWorld(dish.set(0, 1.6, 0)));
      signal.style.setProperty("--sat-x", `${screenX}px`);
      signal.style.setProperty("--sat-y", `${screenY}px`);
    }
  };

  gsap.ticker.add(tick);

  return () => {
    gsap.ticker.remove(tick);
    observer.disconnect();
    seen.disconnect();
    rocket.dispose();
    renderer.dispose();
  };
}
