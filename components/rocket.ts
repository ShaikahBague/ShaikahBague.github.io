import {
  AdditiveBlending,
  AnimationMixer,
  type AnimationAction,
  BackSide,
  CanvasTexture,
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

const SCALE = 0.8;
const CABIN_FLOOR = 1.72;
const AXIE_SIZE = 1.85;

const smooth = (points: number[][], count: number) => new SplineCurve(points.map(([r, y]) => new Vector2(r, y))).getSpacedPoints(count);

// A Lathe starts its seam at phi 0, so half a turn puts the middle of the texture on +Z, the side facing the camera
const lathe = (points: Vector2[]) => new LatheGeometry(points, 48, Math.PI);

// Paint for the hull, and the same logo on black for the emissive map, so it glows like the neon it is
function hullTextures() {
  const canvas = () => {
    const element = document.createElement("canvas");
    element.width = 1024;
    element.height = 512;
    return element;
  };
  const paint = canvas();
  const c = paint.getContext("2d")!;
  c.fillStyle = "#5a3fd0";
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = "#2f1275";
  c.fillRect(0, 400, 1024, 112);
  c.fillStyle = "#c084fc";
  c.fillRect(0, 386, 1024, 14);
  c.fillRect(0, 60, 1024, 8);
  const glow = canvas();
  const g = glow.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1024, 512);

  const map = new CanvasTexture(paint);
  const emissiveMap = new CanvasTexture(glow);
  map.colorSpace = emissiveMap.colorSpace = SRGBColorSpace;
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

function buildCraft() {
  const chrome = new MeshStandardMaterial({ color: "#dfe3ff", metalness: 0.95, roughness: 0.22 });
  const dark = new MeshStandardMaterial({ color: "#1c0e45", metalness: 0.75, roughness: 0.45 });
  const orchid = new MeshStandardMaterial({ color: "#b56cf5", metalness: 0.45, roughness: 0.32 });

  const hull = new Mesh(
    lathe(smooth([[0.95, -3.4], [1.45, -2.8], [1.8, -1.7], [1.92, -0.5], [1.82, 0.7], [1.55, 1.45], [1.42, 1.72]], 48)),
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
  group.add(hull, nose, trim, nozzle, fins, cabinBack, cabinFloor, glass, flame, cabinLight);
  return { group, flame, flameMaterial };
}

export function createRocket() {
  const { group, flame, flameMaterial } = buildCraft();
  let mixer: AnimationMixer | undefined;
  let walk: AnimationAction | undefined;
  let armRoot: Bone | undefined;
  let forearm: Bone | undefined;
  const pilot = new Group();
  group.add(pilot);
  let lost = false;

  // Ships separately because Axie is by far the heaviest asset; the rocket flies on until it lands
  new GLTFLoader()
    .loadAsync("/axie-flight.glb")
    .then((gltf) => {
      if (lost) return;
      const axie = gltf.scene;
      axie.traverse((node) => {
        const skinned = node as SkinnedMesh;
        if (!skinned.isSkinnedMesh) return;
        skinned.frustumCulled = false;
        const material = skinned.material as MeshStandardMaterial;
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
      clip.tracks = clip.tracks.filter((track) => !track.name.endsWith(".position"));
      mixer = new AnimationMixer(axie);
      walk = mixer.clipAction(clip);
      walk.play();
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
  const ground = new Vector3(5.4, -3.1, 1.2);

  return {
    group,
    // The hull's +Z side turns to the camera, so the cabin and logo are never hidden on the way past
    place(position: Vector3, heading: Vector3, camera: Camera) {
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
        pilot.rotation.z = Math.atan2(-worldUp.dot(across), worldUp.dot(nose));
      }
    },
    animate(time: number, dt: number, power: number, speed: number, wave: number, out: number) {
      flameMaterial.uniforms.uTime.value = time;
      flameMaterial.uniforms.uPower.value = power;
      flame.visible = power > 0.01;
      flame.scale.set(0.7 + power * 0.3, 0.25 + power * 0.95, 0.7 + power * 0.3);
      // Out on the ground Axie stands beside the ship and larger, with a hop between there and the cabin
      const eased = out * out * (3 - 2 * out);
      pilot.position.lerpVectors(seat, ground, eased);
      pilot.position.y += Math.sin(out * Math.PI) * 2.4;
      pilot.scale.setScalar(1 + eased * 0.4);
      if (!mixer || !armRoot || !forearm) return;
      // A mixer only writes a bone when its value changes, so last frame's wave has to be taken off first or it stacks up
      armRoot.quaternion.copy(armPose);
      forearm.quaternion.copy(forearmPose);
      // On the ground Axie stands on the clip's first frame; aboard, the walk paces with the flight
      if (out > 0.95 && walk) walk.time = 0;
      mixer.update(out > 0.95 ? 0 : dt * (0.25 + speed * 1.6));
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
