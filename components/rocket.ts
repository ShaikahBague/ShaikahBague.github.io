import {
  AdditiveBlending,
  AnimationMixer,
  type AnimationAction,
  type AnimationClip,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  Shape,
  ShaderMaterial,
  SphereGeometry,
  SplineCurve,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Bone,
  type Camera,
  type SkinnedMesh,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DOOR_DIR, GROUND_Y, RAMP_FOOT, SILL, WALK_CYCLES, walkPath, type SkyState } from "@/lib/story";

const SCALE = 0.8;
const CABIN_FLOOR = 1.72;
const AXIE_SIZE = 1.85;
const ON_FOOT = 1.4;
const STRIDE = 1.45;
// How far below their own centre Axie's feet are when standing on the ground, in world units
const FEET = 0.56 * AXIE_SIZE * SCALE * ON_FOOT;
// Round the hull from the logo, in the gap between a front fin and the back one, so both leaves have room to slide
const DOOR_ANGLE = (120 * Math.PI) / 180;
const DOOR_SPAN = 0.86;
const DOOR_WORLD = Math.atan2(DOOR_DIR.x, DOOR_DIR.z);
const HULL_PROFILE = [[0.95, -3.4], [1.45, -2.8], [1.8, -1.7], [1.92, -0.5], [1.82, 0.7], [1.55, 1.45], [1.42, 1.72]];
const YELLOW = "#ffc23f";

const smooth = (points: number[][], count: number) => new SplineCurve(points.map(([r, y]) => new Vector2(r, y))).getSpacedPoints(count);

// A Lathe starts its seam at phi 0, so half a turn puts the middle of the texture on +Z, the side facing the camera
const lathe = (points: Vector2[]) => new LatheGeometry(points, 48, Math.PI);

// Paint for the hull, and the same logo on black for the emissive map, so it glows like the neon it is
function hullTextures() {
  const canvas = () => {
    const element = document.createElement("canvas");
    element.width = 2048;
    element.height = 1024;
    return element;
  };
  const paint = canvas();
  const c = paint.getContext("2d")!;
  c.scale(2, 2);
  c.fillStyle = "#5a3fd0";
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = "#2f1275";
  c.fillRect(0, 400, 1024, 112);
  c.fillStyle = "#c084fc";
  c.fillRect(0, 386, 1024, 14);
  c.fillRect(0, 60, 1024, 8);
  const glow = canvas();
  const g = glow.getContext("2d")!;
  g.scale(2, 2);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1024, 512);

  const map = new CanvasTexture(paint);
  const emissiveMap = new CanvasTexture(glow);
  map.colorSpace = emissiveMap.colorSpace = SRGBColorSpace;
  map.anisotropy = emissiveMap.anisotropy = 8;
  const logo = new Image();
  logo.src = "/cncp-decal.webp";
  logo
    .decode()
    .then(() => {
      // The hull's texture is a little denser going up than around, hence taller than the image's own ratio
      [c, g].forEach((context) => context.drawImage(logo, 342, 86, 340, 284));
      map.needsUpdate = emissiveMap.needsUpdate = true;
    })
    .catch((error) => console.error(error));
  return { map, emissiveMap };
}

// The door lies on the hull's own curve, a hair proud of it, and both leaves slide round the hull to open
function buildDoor() {
  const hullCurve = (grow: number) => smooth(HULL_PROFILE, 48).filter(({ y }) => y > -2.9 && y < 0.3).map(({ x, y }) => new Vector2(x * grow, y));
  const opening = new Mesh(new LatheGeometry(hullCurve(1.012), 14, DOOR_ANGLE - DOOR_SPAN / 2, DOOR_SPAN), new MeshBasicMaterial({ color: YELLOW }));
  const paint = new MeshStandardMaterial({ color: "#4a2fb4", metalness: 0.5, roughness: 0.4 });
  const leaves = [DOOR_ANGLE - DOOR_SPAN / 2, DOOR_ANGLE].map((from) => new Mesh(new LatheGeometry(hullCurve(1.024), 8, from, DOOR_SPAN / 2 - 0.012), paint));
  return { opening, leaves };
}

function buildCraft() {
  const chrome = new MeshStandardMaterial({ color: "#dfe3ff", metalness: 0.95, roughness: 0.22 });
  const dark = new MeshStandardMaterial({ color: "#1c0e45", metalness: 0.75, roughness: 0.45 });
  const orchid = new MeshStandardMaterial({ color: "#b56cf5", metalness: 0.45, roughness: 0.32 });

  const hull = new Mesh(
    lathe(smooth(HULL_PROFILE, 48)),
    new MeshStandardMaterial({ ...hullTextures(), emissive: "#ffffff", emissiveIntensity: 1.1, metalness: 0.45, roughness: 0.36 }),
  );
  const nose = new Mesh(lathe(smooth([[1.06, 3.72], [0.92, 4.3], [0.58, 5], [0.08, 5.65], [0, 5.72]], 28)), chrome);
  const trim = new Mesh(
    mergeGeometries([
      new TorusGeometry(1.45, 0.1, 10, 48).rotateX(Math.PI / 2).translate(0, 1.72, 0),
      new TorusGeometry(1.08, 0.08, 10, 48).rotateX(Math.PI / 2).translate(0, 3.72, 0),
      new TorusGeometry(1.0, 0.07, 10, 48).rotateX(Math.PI / 2).translate(0, -3.4, 0),
      new SphereGeometry(0.11, 12, 10).translate(0, 5.75, 0),
      ...[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + Math.PI;
        return new CylinderGeometry(0.035, 0.035, 2, 6).translate(Math.sin(a) * 1.33, 2.72, Math.cos(a) * 1.33);
      }),
    ]),
    chrome,
  );
  const nozzle = new Mesh(lathe(smooth([[0.55, -3.4], [0.72, -3.8], [1.02, -4.2]], 10)), new MeshStandardMaterial({ color: "#2a1a70", metalness: 0.9, roughness: 0.35, side: DoubleSide }));

  const finShape = new Shape();
  finShape.moveTo(0, 0);
  finShape.bezierCurveTo(0.7, -0.15, 1.5, -1.1, 1.6, -3.3);
  finShape.bezierCurveTo(1.2, -2.8, 0.6, -2.4, 0, -2.3);
  finShape.closePath();
  const finBase = new ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 10 }).translate(1.45, -0.9, -0.07);
  // Front-left, front-right and back: nothing covers the logo, which always faces the camera
  const fins = new Mesh(mergeGeometries([60, 180, 300].map((d) => finBase.clone().rotateY(((d - 90) * Math.PI) / 180))), orchid);

  const cabinProfile = smooth([[1.42, 1.72], [1.46, 2.3], [1.38, 3.1], [1.06, 3.72]], 20);
  const cabinBack = new Mesh(lathe(cabinProfile), new MeshBasicMaterial({ color: "#12072e", transparent: true, opacity: 0.55, side: BackSide, depthWrite: false }));
  const cabinFloor = new Mesh(new CylinderGeometry(1.4, 1.4, 0.06, 40).translate(0, CABIN_FLOOR, 0), dark);
  const glass = new Mesh(
    lathe(cabinProfile),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: "varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}",
      fragmentShader: /* glsl */ `
        varying vec3 vN,vV;
        void main(){
          vec3 n=normalize(vN),v=normalize(vV);
          float rim=pow(1.-max(dot(n,v),0.),2.6);
          float glint=pow(max(dot(n,normalize(vec3(-.55,.6,.6))),0.),60.);
          gl_FragColor=vec4(vec3(.66,.72,1.)*rim*.8+vec3(1.)*glint*.85,1.);
        }`,
    }),
  );
  glass.renderOrder = 2;

  // The lift that carries Axie up from the door: a shaft of the door's yellow, rising through a lit hatch in the cabin floor
  const liftBeam = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uGlow: { value: 0 } },
    vertexShader: "varying float vUp;void main(){vUp=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform float uGlow;varying float vUp;void main(){gl_FragColor=vec4(vec3(1.,.72,.2)*pow(vUp,1.6)*uGlow*.75,1.);}",
  });
  const hatch = new MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0, depthWrite: false });
  const lift = new Group();
  lift.add(
    new Mesh(new CylinderGeometry(0.82, 0.82, 1.9, 28, 1, true).translate(0, CABIN_FLOOR + 0.95, 0), liftBeam),
    new Mesh(new CircleGeometry(0.82, 28).rotateX(-Math.PI / 2).translate(0, CABIN_FLOOR + 0.04, 0), hatch),
  );

  const flameMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime; varying float vT; varying vec3 vN,vV;
      void main(){
        // A cone's v runs to 1 at its tip, and the flame is hottest at the other end, against the nozzle
        vec3 p=position; vT=1.-uv.y;
        p.xz*=1.+sin(uTime*34.+vT*14.)*.08*(1.-vT);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vN=normalMatrix*normal; vV=-mv.xyz;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uPower; varying float vT; varying vec3 vN,vV;
      void main(){
        float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.4);
        vec3 c=mix(vec3(.46,.2,.95),vec3(.78,.72,1.),smoothstep(.15,.7,vT));
        c=mix(c,vec3(1.),smoothstep(.72,1.,vT)*edge);
        gl_FragColor=vec4(c*edge*vT*vT*min(uPower*1.6,1.)*1.5,1.);
      }`,
  });
  // Tip down, with its wide end at the nozzle
  const flame = new Mesh(new ConeGeometry(0.95, 7, 22, 8, true).rotateX(Math.PI).translate(0, -3.5, 0), flameMaterial);
  flame.position.y = -3.95;
  flame.renderOrder = 1;

  const cabinLight = new PointLight("#ffe6f5", 5, 5);
  cabinLight.position.set(0, 3.1, 0.6);

  const group = new Group();
  group.scale.setScalar(SCALE);
  const door = buildDoor();
  group.add(hull, nose, trim, nozzle, fins, cabinBack, cabinFloor, lift, glass, flame, cabinLight, door.opening, ...door.leaves);
  return { group, flame, flameMaterial, hull, cabinBack, glass, cabinLight, door, lift, liftBeam, hatch };
}

export function createRocket(low: boolean, onAxie: (axie: Group, clip: AnimationClip) => void) {
  const { group, flame, flameMaterial, hull, cabinBack, glass, cabinLight, door, lift, liftBeam, hatch } = buildCraft();
  const hullPaint = hull.material as MeshStandardMaterial;

  // What stays put on the ground however the rocket turns: the ramp, the door's light and its glow
  const yard = new Group();
  const rampFall = SILL.y - GROUND_Y;
  const rampRun = RAMP_FOOT - SILL.along;
  const rampLength = Math.hypot(rampFall, rampRun);
  const ramp = new Mesh(new BoxGeometry(1.7, 0.1, rampLength).translate(0, 0, rampLength / 2), new MeshStandardMaterial({ color: "#5a5580", metalness: 0.4, roughness: 0.6 }));
  ramp.position.set(DOOR_DIR.x * SILL.along, SILL.y - 0.05, DOOR_DIR.z * SILL.along);
  ramp.rotation.set(Math.atan2(rampFall, rampRun), DOOR_WORLD, 0, "YXZ");
  ramp.receiveShadow = true;

  // A real shadow rather than a faked one: in the dark this is the only light there is, and it comes from behind Axie
  const doorLight = new SpotLight(YELLOW, 0, 70, 0.5, 0.5, 1.1);
  // Well back through the hull, which casts nothing: from close behind, Axie's shadow would swallow the whole beam as they step out
  doorLight.position.set(DOOR_DIR.x * -4, 2.2, DOOR_DIR.z * -4);
  doorLight.target.position.set(DOOR_DIR.x * 7, GROUND_Y, DOOR_DIR.z * 7);
  doorLight.castShadow = true;
  doorLight.shadow.mapSize.set(1024, 1024);
  doorLight.shadow.camera.near = 0.3;
  doorLight.shadow.camera.far = 40;
  doorLight.shadow.bias = -0.002;
  // Only redrawn while Axie is out in it
  doorLight.shadow.autoUpdate = false;

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const glowPaint = glowCanvas.getContext("2d")!;
  const falloff = glowPaint.createRadialGradient(64, 64, 0, 64, 64, 64);
  falloff.addColorStop(0, "rgb(255 170 40 / 0.4)");
  falloff.addColorStop(0.35, "rgb(255 180 50 / 0.2)");
  falloff.addColorStop(1, "rgb(255 170 40 / 0)");
  glowPaint.fillStyle = falloff;
  glowPaint.fillRect(0, 0, 128, 128);
  const glowMap = new CanvasTexture(glowCanvas);
  glowMap.colorSpace = SRGBColorSpace;
  const haloMaterial = new SpriteMaterial({ map: glowMap, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false });
  const halo = new Sprite(haloMaterial);
  // Clear of the hull's widest point: a sprite is a flat plane, and where the hull pokes through it the glow cuts off in a hard curve
  halo.position.set(DOOR_DIR.x * 2.6, 0.2, DOOR_DIR.z * 2.6);
  halo.scale.set(7.5, 7.5, 1);
  yard.add(ramp, doorLight, doorLight.target, halo);

  const parked = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), DOOR_WORLD - DOOR_ANGLE);
  const axieMaterials: MeshStandardMaterial[] = [];
  let clipLength = 1;
  let mixer: AnimationMixer | undefined;
  let walk: AnimationAction | undefined;
  let armRoot: Bone | undefined;
  let forearm: Bone | undefined;
  const pilot = new Group();
  group.add(pilot);
  let lost = false;

  // Ships separately because Axie is by far the heaviest asset; the rocket flies on until it lands. Up close on a big screen the
  // lighter copy's textures go soft, so only smaller screens get it
  new GLTFLoader()
    .loadAsync(low ? "/axie-flight.glb" : "/axie-new.glb")
    .then((gltf) => {
      if (lost) return;
      const axie = gltf.scene;
      axie.traverse((node) => {
        const skinned = node as SkinnedMesh;
        if (!skinned.isSkinnedMesh) return;
        skinned.frustumCulled = false;
        skinned.castShadow = true;
        const material = skinned.material as MeshStandardMaterial;
        axieMaterials.push(material);
        if (material.map) material.map.anisotropy = 8;
        material.metalness = 0.05;
        material.roughness = 0.65;
        // Keeps the character readable through the glass in the darker chapters
        material.emissive.set("#ffffff");
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0.3;
      });
      axie.scale.setScalar(AXIE_SIZE);
      pilot.add(axie);
      // The rig's names run one joint out on this side: L_Collar is the arm's root and L_Shoulder its elbow
      armRoot = axie.getObjectByName("L_Collar") as Bone | undefined;
      forearm = axie.getObjectByName("L_Shoulder") as Bone | undefined;
      if (armRoot && forearm) {
        armPose.copy(armRoot.quaternion);
        forearmPose.copy(forearm.quaternion);
      }

      // The clip walks forward by moving the pelvis, which would march Axie out through the glass
      const clip = gltf.animations[0];
      clipLength = clip.duration;
      clip.tracks = clip.tracks.filter((track) => !track.name.endsWith(".position"));
      // Longer strides: the legs swing further either side of where they hang, so each step covers the ground it now has to
      clip.tracks.filter((track) => /[LR]_(Hip|Knee)\.quaternion$/.test(track.name)).forEach(({ values }) => {
        const hang = new Quaternion();
        for (let i = 0; i < values.length; i += 4) hang.set(hang.x + values[i], hang.y + values[i + 1], hang.z + values[i + 2], hang.w + values[i + 3]);
        hang.normalize();
        const key = new Quaternion();
        const swing = new Quaternion();
        for (let i = 0; i < values.length; i += 4) {
          key.fromArray(values, i);
          swing.copy(hang).invert().multiply(key);
          const half = Math.acos(Math.min(1, Math.abs(swing.w)));
          const stretch = half > 1e-4 ? Math.sin(half * STRIDE) / Math.sin(half) : 1;
          swing.set(swing.x * stretch, swing.y * stretch, swing.z * stretch, Math.sign(swing.w || 1) * Math.cos(half * STRIDE)).normalize();
          key.copy(hang).multiply(swing).toArray(values, i);
        }
      });
      mixer = new AnimationMixer(axie);
      walk = mixer.clipAction(clip);
      walk.play();
      onAxie(axie, clip);
    })
    .catch((error) => console.error(error));

  const nose = new Vector3();
  const facing = new Vector3();
  const across = new Vector3();
  const basis = new Matrix4();
  const bend = new Quaternion();
  const bendAxis = new Vector3(0, 0, 1);
  // From where the arm hangs, up and in front of the cheek: at this reach, straight up or out to the side ends behind the head
  const raised = new Quaternion().setFromUnitVectors(new Vector3(0.4, -0.23, -0.11).normalize(), new Vector3(0.28, 0.12, 0.3).normalize());
  const armPose = new Quaternion();
  const forearmPose = new Quaternion();
  const worldUp = new Vector3(0, 1, 0);
  const seat = new Vector3(0, CABIN_FLOOR + AXIE_SIZE * 0.56, 0);
  // Just below where Axie's head would show through the cabin floor
  const liftFoot = new Vector3(0, 0.2, 0);
  const onFoot = new Vector3();
  const upright = new Quaternion();
  const toCamera = new Quaternion();
  let roll = 0;
  let yaw = DOOR_WORLD;
  let lastOut = 1;
  let headingOut = false;

  return {
    group,
    yard,
    // The hull's +Z side turns to the camera, so the cabin and logo are never hidden on the way past. Parked, it holds still instead
    place(position: Vector3, heading: Vector3, camera: Camera, ground: number) {
      group.position.copy(position);
      nose.copy(heading).normalize();
      facing.copy(camera.position).sub(position);
      facing.addScaledVector(nose, -facing.dot(nose));
      // Flying straight at or away from the camera there is no sideways to face, so keep the last one
      if (facing.lengthSq() > 1e-4) {
        facing.normalize();
        across.crossVectors(nose, facing);
        basis.makeBasis(across, nose, facing);
        group.quaternion.setFromRotationMatrix(basis);
        // The ship tips over in flight but its pilot stays head-up, so the face always reads
        roll = Math.atan2(-worldUp.dot(across), worldUp.dot(nose));
      }
      group.quaternion.slerp(parked, ground);
    },
    animate(time: number, dt: number, power: number, speed: number, { wave, out, door: open, dim, climb, ground }: SkyState, camera: Camera) {
      flameMaterial.uniforms.uTime.value = time;
      flameMaterial.uniforms.uPower.value = power;
      flame.visible = power > 0.01;
      flame.scale.set(0.7 + power * 0.3, 0.25 + power * 0.95, 0.7 + power * 0.3);
      const light = 1 - dim;
      hullPaint.emissiveIntensity = 1.1 * light;
      cabinLight.intensity = 5 * light;
      glass.visible = cabinBack.visible = dim < 0.5;
      axieMaterials.forEach((material) => (material.emissiveIntensity = 0.3 * light));

      door.leaves[0].rotation.y = -open * (DOOR_SPAN / 2);
      door.leaves[1].rotation.y = open * (DOOR_SPAN / 2);
      door.opening.visible = yard.visible = open > 0.005;
      ramp.scale.z = Math.max(open, 0.01);
      doorLight.intensity = open * 150;
      haloMaterial.opacity = open;

      // Out, Axie's feet are placed on the ground however the rocket is turned, and they face the way they are walking, or the
      // camera once on their mark. Past the door they are out of sight in the hull until the lift brings them up into the cabin
      const outside = out > 0.004;
      if (outside) {
        const { along, y } = walkPath(out);
        onFoot.set(DOOR_DIR.x * along, y + FEET, DOOR_DIR.z * along);
        const moved = out - lastOut;
        let want = yaw;
        if (out > 0.985) want = Math.atan2(camera.position.x - onFoot.x, camera.position.z - onFoot.z);
        else if (Math.abs(moved) > 1e-5) want = moved > 0 ? DOOR_WORLD : DOOR_WORLD + Math.PI;
        if (Math.abs(moved) > 1e-5) headingOut = moved > 0;
        yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-dt * 6));
        group.updateMatrixWorld();
        pilot.position.copy(group.worldToLocal(onFoot));
        pilot.quaternion.copy(group.quaternion).invert().multiply(upright.setFromAxisAngle(worldUp, yaw));
        pilot.scale.setScalar(ON_FOOT);
      } else {
        pilot.position.lerpVectors(liftFoot, seat, climb);
        // Settles to cabin size while still below the floor, where the change doesn't show
        pilot.scale.setScalar(Math.max(1, ON_FOOT - (climb * (ON_FOOT - 1)) / 0.15));
        // Parked the rocket holds still, so they turn themselves to the camera. In flight the hull does that for them
        upright.setFromAxisAngle(worldUp, Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z));
        toCamera.copy(group.quaternion).invert().multiply(upright);
        pilot.quaternion.setFromAxisAngle(bendAxis, roll).slerp(toCamera, ground);
      }
      const riding = outside || climb <= 0 || climb >= 1 ? 0 : Math.sin(climb * Math.PI);
      lift.visible = riding > 0;
      liftBeam.uniforms.uGlow.value = riding;
      hatch.opacity = riding;
      lastOut = out;
      doorLight.shadow.needsUpdate = outside && open > 0.005;
      if (!mixer || !armRoot || !forearm) return;
      // A mixer only writes a bone when its value changes, so last frame's wave has to be taken off first or it stacks up
      armRoot.quaternion.copy(armPose);
      forearm.quaternion.copy(forearmPose);
      // On the ground the stride is tied to distance, walked or lifted, so feet don't slide and each journey ends on the clip's standing first frame. In flight, it paces with the rocket
      const grounded = outside || ground > 0.5;
      // Stepping out runs the same count from the other end, or the legs would play backward while Axie walks forward. The lift is a slow shuffle, one stride all the way up
      if (grounded && walk) walk.time = (((outside ? (headingOut ? out : 1 - out) * WALK_CYCLES : climb) % 1) * clipLength);
      mixer.update(grounded ? 0 : dt * (0.25 + speed * 1.6));
      armPose.copy(armRoot.quaternion);
      forearmPose.copy(forearm.quaternion);
      armRoot.quaternion.premultiply(bend.identity().slerp(raised, wave));
      forearm.quaternion.premultiply(bend.setFromAxisAngle(bendAxis, wave * Math.sin(time * 6) * 0.5));
    },
    dispose() {
      lost = true;
    },
  };
}
