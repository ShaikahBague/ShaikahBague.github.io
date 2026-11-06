import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LatheGeometry,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  RepeatWrapping,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import gsap from "gsap";
import { seats as seatPlan, WORLD_POS, WORLD_RADIUS, type SkyState } from "@/lib/story";

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

function buildProjector(low: boolean) {
  const silver = new MeshStandardMaterial({ color: "#d8dcff", metalness: 0.92, roughness: 0.3 });
  const paint = new MeshStandardMaterial({ color: "#6d55d8", metalness: 0.55, roughness: 0.42 });
  const dark = new MeshStandardMaterial({ color: "#1c0e45", metalness: 0.7, roughness: 0.5 });

  const baseProfile = [
    [0, -3.1], [1.75, -3.1], [1.75, -2.92], [1.35, -2.8], [1.3, -2.55], [0.72, -2.32], [0.5, -1.9], [0.42, -0.6], [0.5, -0.35], [0.38, 0.1], [0, 0.1],
  ].map(([x, y]) => new Vector2(x, y));
  const base = new Mesh(new LatheGeometry(baseProfile, 40), paint);
  const collar = new Mesh(new TorusGeometry(1.32, 0.05, 8, 40).rotateX(Math.PI / 2).translate(0, -2.7, 0), silver);
  const yokeA = new BoxGeometry(0.16, 1.5, 0.5).translate(-0.62, 0.72, 0);
  const yokeB = new BoxGeometry(0.16, 1.5, 0.5).translate(0.62, 0.72, 0);
  const yokeC = new BoxGeometry(1.4, 0.18, 0.56).translate(0, 0.1, 0);
  const yoke = new Mesh(mergeGeometries([yokeA, yokeB, yokeC]), dark);

  const head = new Group();
  head.position.y = 1.35;
  head.rotation.z = 0.42;

  const chromeParts: BufferGeometry[] = [];
  const darkParts: BufferGeometry[] = [new CylinderGeometry(0.34, 0.34, 2.2, 20).rotateZ(Math.PI / 2)];
  for (let x = -1; x <= 1.01; x += 0.33) {
    chromeParts.push(new TorusGeometry(0.42, 0.045, 8, 28).rotateY(Math.PI / 2).translate(x, 0, 0));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    chromeParts.push(new CylinderGeometry(0.035, 0.035, 2.2, 6).rotateZ(Math.PI / 2).translate(0, Math.cos(a) * 0.42, Math.sin(a) * 0.42));
  }
  const globeParts: BufferGeometry[] = [];
  [-1.72, 1.72].forEach((x) => {
    globeParts.push(new SphereGeometry(0.98, low ? 28 : 40, low ? 20 : 28).translate(x, 0, 0));
    chromeParts.push(new TorusGeometry(1, 0.035, 8, 44).rotateY(Math.PI / 2).translate(x, 0, 0));
    chromeParts.push(new TorusGeometry(0.72, 0.05, 8, 32).rotateY(Math.PI / 2).translate(x * 0.62, 0, 0));
  });
  head.add(
    new Mesh(mergeGeometries(chromeParts), silver),
    new Mesh(mergeGeometries(darkParts), dark),
    new Mesh(mergeGeometries(globeParts), new MeshStandardMaterial({ color: "#c9c6f5", metalness: 0.78, roughness: 0.34 })),
  );

  const lensCount = low ? 200 : 400;
  const lensMaterial = new MeshBasicMaterial({ color: "#150a35" });
  const lenses = new InstancedMesh(new CylinderGeometry(0.022, 0.03, 0.03, low ? 6 : 10), lensMaterial, lensCount);
  const dummy = new Object3D();
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i < lensCount; i++) {
    const dir = fibonacci(i % (lensCount / 2), lensCount / 2);
    dummy.position.copy(dir).multiplyScalar(0.98).add(new Vector3(i < lensCount / 2 ? -1.72 : 1.72, 0, 0));
    dummy.quaternion.setFromUnitVectors(up, dir);
    dummy.updateMatrix();
    lenses.setMatrixAt(i, dummy.matrix);
  }
  head.add(lenses);

  // Beam brightness lives in a vertex attribute, and the shader feathers the edges so cones read as dusty light
  const beamParts: BufferGeometry[] = [];
  if (!low) {
    const random = seeded(5);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const dir = fibonacci(i, 18);
      const cone = new ConeGeometry(0.5, 11, 14, 1, true).translate(0, -5.5, 0).rotateX(Math.PI);
      const count = cone.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const y = cone.attributes.position.array;
      for (let v = 0; v < count; v++) {
        const t = 1 - y[v * 3 + 1] / 11;
        const strength = t * t * (0.09 + random() * 0.05);
        colors.set([0.66 * strength, 0.7 * strength, strength], v * 3);
      }
      cone.setAttribute("aGlow", new BufferAttribute(colors, 3));
      dummy.position.set(side * 1.72, 0, 0);
      dummy.quaternion.setFromUnitVectors(up, dir);
      dummy.updateMatrix();
      beamParts.push(cone.applyMatrix4(dummy.matrix));
    }
  }
  const beamMaterial = new ShaderMaterial({
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aGlow; varying vec3 vG,vN,vV;
      void main(){vG=aGlow;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vG,vN,vV;
      void main(){float edge=pow(abs(dot(normalize(vN),normalize(vV))),2.6);gl_FragColor=vec4(vG*edge*uOpacity,1.);}`,
  });
  if (beamParts.length) head.add(new Mesh(mergeGeometries(beamParts), beamMaterial));

  const group = new Group();
  group.add(base, collar, yoke, head);
  return { group, head, lensMaterial, beamMaterial };
}

// The house: the same 55 seats as the printed plan, facing the projector
function buildSeats() {
  const parts = [
    new BoxGeometry(0.72, 0.16, 0.62).translate(0, 0.42, 0),
    new BoxGeometry(0.72, 0.86, 0.14).translate(0, 0.76, 0.3),
    new BoxGeometry(0.1, 0.42, 0.5).translate(-0.33, 0.2, 0),
    new BoxGeometry(0.1, 0.42, 0.5).translate(0.33, 0.2, 0),
  ];
  const material = new ShaderMaterial({
    uniforms: { uLit: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aOrder; uniform float uLit; varying float vLit,vOpen,vY;
      void main(){
        vOpen=step(aOrder,-.5)*smoothstep(.85,1.,uLit);
        vLit=aOrder<0.?0.:smoothstep(aOrder,aOrder+.04,uLit);
        vY=position.y;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);
      }`,
    fragmentShader: /* glsl */ `
      varying float vLit,vOpen,vY;
      void main(){
        vec3 c=mix(vec3(.05,.02,.15),vec3(.94,.9,1.),vLit);
        c=mix(c,vec3(.66,.71,1.),vOpen);
        gl_FragColor=vec4(c*(.62+vY*.42),1.);
      }`,
  });
  const mesh = new InstancedMesh(mergeGeometries(parts), material, seatPlan.length);
  const order = new Float32Array(seatPlan.length);
  const random = seeded(41);
  const dummy = new Object3D();
  const openSeat = new Vector3();
  seatPlan.forEach((seat, i) => {
    const x = (seat.x - 320) / 26;
    const z = (350 - seat.y) / 26;
    dummy.position.set(x, -2.6, z);
    dummy.rotation.y = Math.atan2(x, z) + Math.PI;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    order[i] = seat.open ? -1 : random() * 0.96;
    if (seat.open) openSeat.set(x, -1.9, z);
  });
  mesh.geometry.setAttribute("aOrder", new InstancedBufferAttribute(order, 1));
  mesh.frustumCulled = false;

  // A soft spotlight singles out the one seat still open
  const spotGeometry = new ConeGeometry(1.15, 11, 20, 1, true).translate(openSeat.x, openSeat.y + 5.2, openSeat.z);
  const spotMaterial = new ShaderMaterial({
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: "varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}",
    fragmentShader: "uniform float uOpacity;varying vec3 vN,vV;void main(){float e=pow(abs(dot(normalize(vN),normalize(vV))),2.2);gl_FragColor=vec4(vec3(.66,.71,1.)*e*.55*uOpacity,1.);}",
  });
  const spot = new Mesh(spotGeometry, spotMaterial);
  spot.frustumCulled = false;
  return { mesh, material, openSeat, spot, spotMaterial };
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
    uniforms: { uBurst: { value: 0 }, uTime: { value: 0 }, uPx: { value: px }, uHouse: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uBurst,uTime,uPx,uHouse;
      varying vec3 vC; varying float vA;
      void main(){
        float e=smoothstep(aSeed*.6,aSeed*.6+.4,uBurst);
        vec3 origin=vec3(aSeed>.5?1.72:-1.72,1.35,0.);
        vec3 p=mix(origin,position,1.-pow(1.-e,3.));
        vec4 mv=modelViewMatrix*vec4(p,1.);
        float tw=.72+.28*sin(uTime*(.8+aSeed*1.6)+aSeed*40.);
        gl_PointSize=clamp(aSize*uPx*(150./-mv.z),1.,5.*uPx);
        vA=smoothstep(0.,.12,e)*tw*(1.-uHouse*.8);
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
function buildThingNetwork(count: number, radius: number, px: number) {
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
      new LineBasicMaterial({ color: "#a9b4ff", transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }),
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
  return new Mesh(
    new SphereGeometry(radius, segments, Math.round(segments * 0.66)),
    new ShaderMaterial({
      uniforms: { uMap: { value: map }, uRim: { value: hex(look.rim) }, uLight: { value: new Vector3(-0.55, 0.5, 0.67).normalize() } },
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

function bridgeGeometry() {
  const segments: number[][] = [];
  const nodes: number[][] = [];
  const add = (a: number[], b: number[]) => {
    segments.push(a, b);
    nodes.push(a, b);
  };
  const deck = -9;
  const top = 15;
  const cable = (x: number) => 15 - 16 * (1 - Math.pow(x / 20, 2));
  [-20, 20].forEach((x) => add([x, deck, 0], [x, top, 0]));
  for (let x = -20; x < 20; x += 4) add([x, cable(x), 0], [x + 4, cable(x + 4), 0]);
  add([-20, top, 0], [-40, deck, 0]);
  add([20, top, 0], [40, deck, 0]);
  for (let x = -40; x < 40; x += 8) add([x, deck, 0], [x + 8, deck, 0]);
  for (let x = -16; x <= 16; x += 4) add([x, cable(x), 0], [x, deck, 0]);
  const lineGeo = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(segments.flat(), 3));
  const dotGeo = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(nodes.flat(), 3));
  return { lineGeo, dotGeo, count: segments.length };
}

export function createSky(canvas: HTMLCanvasElement, s: SkyState) {
  const low = matchMedia("(max-width: 768px)").matches || navigator.hardwareConcurrency <= 4;
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false });
  let dpr = Math.min(devicePixelRatio, low ? 1.25 : 1.5);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new PerspectiveCamera(s.fov, 1, 0.1, 2600);
  scene.environment = buildEnvironment(renderer);
  scene.add(new AmbientLight("#8a7cff", 0.5));
  const sun = new DirectionalLight("#ffffff", 1.6);
  sun.position.set(-6, 8, 8);
  scene.add(sun);

  const nebula = bake(renderer, low ? 768 : 1280, low ? 384 : 640, /* glsl */ `
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

  const skyMaterial = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uMap: { value: nebula }, uHouse: { value: 1 }, uDawn: { value: 0 } },
    vertexShader: "varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uHouse,uDawn; varying vec3 vD;
      void main(){
        vec3 d=normalize(vD);
        vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,asin(d.y)/3.1415927+.5);
        vec3 space=textureLod(uMap,uv,0.).rgb;
        vec3 dawn=mix(vec3(.37,.2,.72),vec3(.2,.08,.5),smoothstep(-.1,.55,d.y));
        space=mix(space,space*.3+dawn,uDawn);
        float e=max(d.y,0.);
        vec3 dome=mix(vec3(.42,.17,.86),vec3(.14,.055,.36),pow(e,.62));
        float lon=fract(atan(d.z,d.x)*7.6394)-.5, lat=fract(e*9.)-.5;
        float rib=smoothstep(.04,0.,abs(lon)*.6)+smoothstep(.04,0.,abs(lat));
        dome+=rib*.035;
        vec3 c=mix(space,dome,uHouse);
        float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        gl_FragColor=vec4(c+(n-.5)/180.,1.);
      }`,
  });
  const sky = new Mesh(new SphereGeometry(1200, 40, 24), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const starCount = low ? 2400 : 6500;
  const stars = buildStars(starCount, dpr);
  scene.add(stars.points);

  const projector = buildProjector(low);
  projector.group.position.y = -0.2;
  scene.add(projector.group);

  const satellite = buildSatellite();
  scene.add(satellite);
  const relay = satellite.clone();
  relay.scale.setScalar(0.55);

  // Links and nodes share one reveal, so the bridge draws on as the scroll moves
  const seats = buildSeats();
  scene.add(seats.mesh, seats.spot);

  const bridge = bridgeGeometry();
  const bridgeLines = new LineSegments(
    bridge.lineGeo,
    new LineBasicMaterial({ color: new Color("#efe6ff"), transparent: true, blending: AdditiveBlending, depthWrite: false }),
  );
  const bridgeDots = new Points(
    bridge.dotGeo,
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uPx: { value: dpr }, uAlpha: { value: 0 } },
      vertexShader: "uniform float uPx;void main(){gl_PointSize=6.*uPx;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "uniform float uAlpha;void main(){float a=smoothstep(.5,.1,length(gl_PointCoord-.5));gl_FragColor=vec4(.95,.93,1.,a*uAlpha);}",
    }),
  );
  const bridgeGroup = new Group();
  bridgeGroup.add(bridgeLines, bridgeDots);
  bridgeGroup.position.set(0, 11, -110);
  scene.add(bridgeGroup);

  const texSize = low ? 384 : 768;
  const segments = low ? 40 : 64;
  const looks = [
    { a: "#2c1570", b: "#5a37c8", c: "#a48cf2", scale: 2.2, bands: 34, seed: 2, rim: "#a9b4ff" },
    { a: "#120829", b: "#32206e", c: "#7c6be0", scale: 3.4, bands: 0, seed: 9, rim: "#7c8bff" },
    { a: "#2a1060", b: "#7a3bd0", c: "#d6a8ff", scale: 2.6, bands: 0, seed: 15, rim: "#c084fc" },
    { a: "#1c1f6e", b: "#4650d8", c: "#9aa6ff", scale: 2, bands: 9, seed: 22, rim: "#9fd0ff" },
  ];
  const worlds = looks.map((look, i) => {
    const group = new Group();
    group.position.set(...WORLD_POS[i]);
    const planet = buildPlanet(renderer, texSize, WORLD_RADIUS, segments, look);
    group.add(planet);
    scene.add(group);
    return { group, planet };
  });

  // Networking: packets travelling round one link, with a relay satellite on it
  const packets = buildOrbiters(low ? 70 : 130, WORLD_RADIUS * 1.5, WORLD_RADIUS * 1.5, true, "#ffffff", dpr, 3);
  const linkRing = new Mesh(
    new RingGeometry(WORLD_RADIUS * 1.495, WORLD_RADIUS * 1.505, 128).rotateX(Math.PI / 2),
    new MeshBasicMaterial({ color: "#a9b4ff", transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  );
  const linkPlane = new Group();
  linkPlane.rotation.set(0.42, 0, 0.3);
  linkPlane.add(linkRing, packets.points, relay);
  worlds[0].group.add(linkPlane);

  // Cybersecurity: a lattice shell that closes as you arrive
  const shellMaterial = new LineBasicMaterial({ color: "#a9b4ff", transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false });
  const shell = new LineSegments(new EdgesGeometry(new IcosahedronGeometry(WORLD_RADIUS * 1.14, 2)), shellMaterial);
  worlds[1].group.add(shell);

  // Data analytics: a histogram wrapped round the equator
  const barCount = low ? 90 : 150;
  const bars = new InstancedMesh(
    new BoxGeometry(0.46, 1, 0.46).translate(0, 0.5, 0),
    new ShaderMaterial({
      uniforms: { uGrow: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aH; uniform float uGrow; varying float vH; varying float vY;
        void main(){vec3 p=position;p.y*=.04+aH*5.5*uGrow;vH=aH;vY=position.y;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
      fragmentShader: /* glsl */ `
        varying float vH,vY;
        void main(){vec3 c=mix(vec3(.5,.3,.85),vec3(.93,.88,1.),vH);gl_FragColor=vec4(c*(.45+.55*vY),1.);}`,
    }),
    barCount,
  );
  const heights = new Float32Array(barCount);
  const barDummy = new Object3D();
  for (let i = 0; i < barCount; i++) {
    const lon = (i / barCount) * Math.PI * 2;
    const dir = new Vector3(Math.cos(lon), 0, Math.sin(lon));
    barDummy.position.copy(dir).multiplyScalar(WORLD_RADIUS * 0.995);
    barDummy.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    barDummy.updateMatrix();
    bars.setMatrixAt(i, barDummy.matrix);
    heights[i] = 0.18 + 0.82 * Math.abs(Math.sin(lon * 3) * Math.sin(lon * 7 + 1));
  }
  bars.geometry.setAttribute("aH", new InstancedBufferAttribute(heights, 1));
  bars.frustumCulled = false;
  const barTilt = new Group();
  barTilt.rotation.set(0.42, 0, 0.2);
  barTilt.add(bars);
  worlds[2].group.add(barTilt);

  const things = buildThingNetwork(low ? 44 : 70, WORLD_RADIUS, dpr);
  worlds[3].group.add(things);

  const ground = buildPlanet(renderer, low ? 768 : 1280, 400, low ? 72 : 112, {
    a: "#24105a",
    b: "#5b2ab0",
    c: "#a98af0",
    scale: 7,
    bands: 0,
    seed: 31,
    rim: "#b9a0ff",
  });
  ground.position.set(0, -430, -760);
  scene.add(ground);

  let width = 1;
  let height = 1;
  const resize = () => {
    const parent = canvas.parentElement!;
    width = parent.clientWidth;
    height = parent.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    bridgeGroup.scale.setScalar(Math.min(0.82, camera.aspect * 0.95));
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);
  resize();

  let inView = true;
  const seen = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting));
  seen.observe(canvas);

  const stage = canvas.parentElement!;
  const fly = stage.querySelector<HTMLElement>(".seat-fly");
  const dish = new Vector3();
  let screenX = 0;
  let screenY = 0;
  const place = (point: Vector3) => {
    point.project(camera);
    screenX = (point.x * 0.5 + 0.5) * width;
    screenY = (0.5 - point.y * 0.5) * height;
  };

  let lastKey = "";
  let frame = 0;
  let slow = 16;
  let level = 0;

  const tick = (time: number, delta: number) => {
    if (!inView || document.hidden) return;
    const key = Object.values(s).join();
    const moving = key !== lastKey;
    lastKey = key;
    frame++;
    // Twinkle does not need 60fps, so an idle page draws half the frames
    if (!moving && frame % 2) return;

    slow += (delta - slow) * 0.04;
    if (frame > 120 && slow > 30 && level < 2) {
      // Trade sharpness and star count for frame rate on hardware that is struggling
      level++;
      dpr *= 0.75;
      renderer.setPixelRatio(dpr);
      resize();
      stars.points.geometry.setDrawRange(0, Math.floor(starCount * (level === 1 ? 0.7 : 0.45)));
      slow = 16;
      frame = 0;
    }

    camera.position.set(s.cx, s.cy, s.cz);
    camera.lookAt(s.lx, s.ly, s.lz);
    // Narrow screens pull back a little so a whole world still fits across the width
    camera.fov = camera.aspect >= 1 ? s.fov : s.fov + Math.abs(s.side) * 22;
    if (camera.aspect >= 1) camera.setViewOffset(width, height, -s.side * 0.24 * width, 0, width, height);
    else camera.setViewOffset(width, height, 0, Math.abs(s.side) * 0.17 * height, width, height);

    sky.position.copy(camera.position);
    skyMaterial.uniforms.uHouse.value = s.house;
    skyMaterial.uniforms.uDawn.value = s.dawn;
    stars.material.uniforms.uBurst.value = s.burst;
    stars.material.uniforms.uTime.value = time;
    stars.material.uniforms.uHouse.value = s.house;
    scene.environmentIntensity = 0.45 + s.house * 0.75 + s.lamp * 0.25;

    const nearDome = s.cz > -70;
    projector.group.visible = nearDome;
    if (nearDome) {
      projector.head.rotation.y = s.spin;
      const lit = s.lamp;
      projector.lensMaterial.color.setRGB(0.008 + lit * 0.99, 0.003 + lit * 0.97, 0.035 + lit * 0.96);
      projector.beamMaterial.uniforms.uOpacity.value = lit * (1 - s.house * 0.6);
    }
    // The camera flies through the rows once the lights drop, so the seats leave with the house lights
    seats.mesh.visible = nearDome && (s.house > 0.45 || s.seats > 0);
    seats.material.uniforms.uLit.value = s.seats;
    seats.spot.visible = s.seats > 0.85;
    seats.spotMaterial.uniforms.uOpacity.value = Math.min(1, (s.seats - 0.85) / 0.15);

    satellite.visible = s.sat > 0 && s.sat < 1;
    if (satellite.visible) {
      satellite.scale.setScalar(camera.aspect >= 1 ? 1 : 0.55);
      satellite.position.set((-24 + s.sat * 50) * Math.min(1, camera.aspect * 1.1), 8 - s.sat * 9, -44 - s.sat * 8);
      satellite.rotation.set(0.5 + s.sat * 0.8, -0.6 + s.sat * 1.4, 0.25);
    }

    bridgeGroup.visible = s.links > 0.001 && s.cz > -112;
    if (bridgeGroup.visible) {
      bridgeLines.geometry.setDrawRange(0, Math.floor(bridge.count * s.links * 0.5) * 2);
      bridgeDots.geometry.setDrawRange(0, Math.floor(bridge.count * s.links));
      (bridgeDots.material as ShaderMaterial).uniforms.uAlpha.value = s.links;
      (bridgeLines.material as LineBasicMaterial).opacity = s.links;
    }

    worlds.forEach(({ group, planet }, i) => {
      group.visible = Math.abs(s.cz - WORLD_POS[i][2]) < 150;
      if (group.visible) planet.rotation.y = time * 0.03 + i;
    });
    // The first world grows in once the camera leaves the bridge, so it never sits behind a heading
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
    if (worlds[2].group.visible) {
      (bars.material as ShaderMaterial).uniforms.uGrow.value = s.bars;
      bars.rotation.y = time * 0.05;
    }
    if (worlds[3].group.visible) things.rotation.y = time * 0.06;
    ground.visible = s.cz < -560;
    if (ground.visible) ground.rotation.y = time * 0.004;

    renderer.render(scene, camera);

    // DOM pieces that belong to 3D objects follow them on screen
    if (satellite.visible) {
      place(satellite.localToWorld(dish.set(0, 1.6, 0)));
      stage.style.setProperty("--sat-x", `${screenX}px`);
      stage.style.setProperty("--sat-y", `${screenY}px`);
    }
    if (s.seats > 0 && fly) {
      place(dish.copy(seats.openSeat));
      fly.style.setProperty("--fly-x", `${screenX - fly.offsetLeft - fly.offsetWidth / 2}px`);
      fly.style.setProperty("--fly-y", `${screenY - fly.offsetTop - fly.offsetHeight / 2}px`);
    }
  };

  gsap.ticker.add(tick);

  return () => {
    gsap.ticker.remove(tick);
    observer.disconnect();
    seen.disconnect();
    renderer.dispose();
  };
}
