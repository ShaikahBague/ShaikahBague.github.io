import {
  AdditiveBlending,
  AnimationMixer,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type AnimationClip,
  type Bone,
  type BufferGeometry,
  type Material,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

// How each joint hangs when nothing is pulling it down: arms lifted away from the body, legs loose and trailing. An axis in the model's own
// space (+x is Axie's left, +z their front), how far round it the joint rests, and how far and how fast it then sways
const FLOATING: [string, [number, number, number], number, number, number][] = [
  ["L_Collar", [0, 0, 1], 0.8, 0.14, 0.5],
  ["L_Shoulder", [0, 0, 1], 0.3, 0.1, 0.7],
  ["R_Shoulder", [0, 0, -1], 0.62, 0.16, 0.43],
  ["R_Elbow", [0, 0, -1], 0.3, 0.1, 0.61],
  ["L_Hip", [-0.6, 0, 0.8], 0.42, 0.1, 0.37],
  ["L_Knee", [1, 0, 0], 0.5, 0.14, 0.53],
  ["R_Hip", [0.6, 0, -0.8], 0.34, 0.12, 0.31],
  ["R_Knee", [1, 0, 0], 0.75, 0.14, 0.47],
  ["Head", [1, 0, 0], -0.08, 0.05, 0.29],
];

// Turns the hoodie and legs into the suit in the shader rather than wrapping shells round them, so it can't clip through the body. Everything
// here is measured on the model at rest: above the neck is Axie's face, and behind the back is their tail, which stays out
const paintSuit = (source: MeshStandardMaterial) => {
  const material = source.clone();
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest=position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;")
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
        float suit=step(vRest.y,-.095)*step(-.075,vRest.z);
        // The hood rises up round the chin at the front, so up here only its blue turns, and the face stays
        float hood=step(vRest.y,.03)*step(abs(vRest.x),.24)*step(diffuseColor.r*1.25,diffuseColor.b);
        suit=max(suit,hood);
        float fold=dot(diffuseColor.rgb,vec3(.3,.59,.11));
        vec3 cloth=mix(vec3(.62,.65,.74),vec3(.98,.98,1.),smoothstep(.04,.42,fold));
        // Grey boots, and one band of the logo's periwinkle round the waist
        cloth=mix(cloth,vec3(.2,.21,.3),step(vRest.y,-.415));
        cloth=mix(cloth,vec3(.34,.42,1.),step(abs(vRest.y+.292),.012));
        diffuseColor.rgb=mix(diffuseColor.rgb,cloth,suit);`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance=mix(totalEmissiveRadiance,emissive*cloth,suit);");
  };
  // Brighter than in the rocket: these skies tint everything under them, and the face has to stay pink
  material.emissiveIntensity = 0.55;
  material.customProgramCacheKey = () => "axie-suit";
  return material;
};

// A clear bubble, seen mostly by the light along its rim and one glint, the same way as the rocket's cabin glass
const visor = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: "varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}",
    fragmentShader: /* glsl */ `
      varying vec3 vN,vV;
      void main(){
        vec3 n=normalize(vN),v=normalize(vV);
        float rim=pow(1.-max(dot(n,v),0.),2.4);
        float glint=pow(max(dot(n,normalize(vec3(-.5,.6,.62))),0.),70.);
        gl_FragColor=vec4(vec3(.8,.88,1.)*(rim*.75+.03)+vec3(1.)*glint,1.);
      }`,
  });

export function suitUp(source: Object3D, clip: AnimationClip) {
  const axie = clone(source);
  axie.position.set(0, 0, 0);
  axie.rotation.set(0, 0, 0);
  axie.scale.setScalar(1);
  axie.traverse((node) => {
    const skinned = node as SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    skinned.frustumCulled = false;
    skinned.material = paintSuit(skinned.material as MeshStandardMaterial);
  });
  // Starts from the clip's standing frame and stays there, so only the sway below ever moves a joint
  new AnimationMixer(axie).clipAction(clip).play().getMixer().setTime(0);
  axie.updateWorldMatrix(true, true);

  const bone = (name: string) => axie.getObjectByName(name) as Bone;
  const up = new Quaternion();
  const joints = FLOATING.flatMap(([name, axis, rest, sway, speed], i) => {
    const joint = bone(name);
    if (!joint) return [];
    const local = new Vector3(...axis).normalize().applyQuaternion(joint.parent!.getWorldQuaternion(up).invert());
    return [{ joint, local, rest, sway, speed, phase: i * 1.7, standing: joint.quaternion.clone() }];
  });

  // The kit is placed in the model's own space and handed to the bone that carries it, which keeps it where it was put
  const white = new MeshStandardMaterial({ color: "#eef0f6", roughness: 0.55 });
  const grey = new MeshStandardMaterial({ color: "#555b78", roughness: 0.5 });
  const fit = (carrier: string, geometry: BufferGeometry, material: Material, x: number, y: number, z: number) => {
    const piece = new Mesh(geometry, material);
    piece.position.set(x, y, z);
    bone(carrier).attach(piece);
    return piece;
  };
  // A pack wider than the body, so its edges and tanks show from the front as well as the back
  fit("Spine3", new BoxGeometry(0.34, 0.24, 0.1), white, -0.02, -0.2, -0.04);
  [-0.16, 0.12].forEach((x) => fit("Spine3", new CylinderGeometry(0.038, 0.038, 0.26, 14), grey, x, -0.2, -0.015));
  fit("Spine3", new BoxGeometry(0.11, 0.06, 0.03), grey, -0.02, -0.2, 0.205);
  ["#ff5a66", "#ffd34d", "#5ee0b0"].forEach((color, i) => fit("Spine3", new BoxGeometry(0.02, 0.02, 0.01), new MeshBasicMaterial({ color }), -0.052 + i * 0.032, -0.2, 0.222));
  fit("Spine3", new TorusGeometry(0.16, 0.022, 12, 40).rotateX(Math.PI / 2), new MeshStandardMaterial({ color: "#aab0cc", roughness: 0.4 }), -0.02, -0.09, 0.085);
  // Round the frills, flattened top to bottom so the bubble stops at the neck ring rather than swallowing the suit
  const helmet = fit("Head", new SphereGeometry(1, 40, 28).scale(0.57, 0.39, 0.47), visor(), 0, 0.17, 0.03);
  helmet.renderOrder = 3;

  const group = new Group();
  group.add(axie);
  const turn = new Quaternion();
  return {
    group,
    update(time: number) {
      joints.forEach(({ joint, local, rest, sway, speed, phase, standing }) => {
        joint.quaternion.copy(turn.setFromAxisAngle(local, rest + Math.sin(time * speed + phase) * sway)).multiply(standing);
      });
    },
  };
}
