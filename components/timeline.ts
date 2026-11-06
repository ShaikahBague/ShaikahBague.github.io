import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { cues } from "@/lib/content";
import { AT, CAMERA_GAP, DOME_VIEW, DOME_VIEW_PORTRAIT, WORLD_POS, type SkyState } from "@/lib/story";

export function buildShow(root: HTMLElement, s: SkyState) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const q = gsap.utils.selector(root);
  const now = q(".cue-now")[0];
  const next = q(".cue-next")[0];
  const dots = q(".cue-dot") as HTMLElement[];
  const beats = q("[data-beat]") as HTMLElement[];
  let live: gsap.core.Timeline;
  let current = "";

  const setCue = (id: string) => {
    if (id === current || id === "end") return;
    current = id;
    const i = cues.findIndex((c) => c.id === id);
    now.textContent = `${cues[i].seat} ${cues[i].label}`;
    next.textContent = cues[i + 1] ? `Next: ${cues[i + 1].label}` : "Next: the programme";
    dots.forEach((d, n) => {
      if (n === i) d.setAttribute("aria-current", "step");
      else d.removeAttribute("aria-current");
    });
    // stacked beats sit on top of each other, so only the visible one takes clicks
    beats.forEach((b) => b.toggleAttribute("data-active", b.dataset.beat === id));
  };

  const goTo = (id: string) => {
    const st = live?.scrollTrigger;
    // Not st.labelToScroll: with the trigger starting at 0 it forces a refresh that strands the timeline
    if (st) window.scrollTo(0, st.start + (AT[id as keyof typeof AT] / AT.end) * (st.end - st.start));
  };

  const mm = gsap.matchMedia(root);
  mm.add(
    { land: "(min-aspect-ratio: 1/1)", port: "(max-aspect-ratio: 1/1)" },
    (ctx) => {
      const land = Boolean(ctx.conditions?.land);
      const fine = matchMedia("(pointer: fine)").matches;
      const dome = land ? DOME_VIEW : DOME_VIEW_PORTRAIT;
      Object.assign(s, dome);
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: "#story",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
          invalidateOnRefresh: true,
          // touch momentum already settles on its own, and snapping fights it
          snap: fine
            ? {
                snapTo: "labelsDirectional",
                // Velocity projection flings fast scrolls past whole chapters
                inertia: false,
                duration: { min: 0.25, max: 0.8 },
                delay: 0.12,
                ease: "power2.inOut",
              }
            : undefined,
          // A beat counts as current from the moment it starts to enter
          onUpdate: (self) => {
            const time = self.progress * AT.end + 0.34;
            setCue(cues.reduce((on, cue) => (time >= (AT[cue.id as keyof typeof AT] ?? 0) ? cue.id : on), "house"));
          },
        },
      });
      live = tl;
      tl.addLabel("house", 0);
      Object.entries(AT).forEach(([id, at]) => tl.addLabel(id, at));

      const fly = (
        to: Partial<SkyState>,
        at: number,
        duration: number,
        ease = "sine.inOut",
      ) => tl.to(s, { ...to, duration, ease }, at);

      const nextAt = (id: keyof typeof AT) => Math.min(...Object.values(AT).filter((at) => at > AT[id]));

      const beat = (id: keyof typeof AT, enter: "rise" | "flicker" | "drop" | "wipe", exit = true, exitAt?: number) => {
        const at = AT[id];
        const el = q(`[data-beat="${id}"]`)[0];
        const heading = el.querySelector("h2");
        const words = SplitText.create(heading, { type: "words" }).words;
        const rest = el.querySelectorAll("[data-rest]");
        tl.set(el, { opacity: 1 }, at - 0.34);
        if (enter === "rise") {
          tl.from(words, { yPercent: 70, opacity: 0, stagger: 0.03, duration: 0.2, ease: "power3.out" }, at - 0.34);
        } else if (enter === "flicker") {
          tl.from(words, { opacity: 0, stagger: { each: 0.04, from: "random" }, duration: 0.1, ease: "steps(3)" }, at - 0.34);
        } else if (enter === "drop") {
          tl.from(words, { y: "-22vh", opacity: 0, stagger: 0.02, duration: 0.28, ease: "power4.out" }, at - 0.34);
        } else {
          tl.from(heading, { clipPath: "inset(0 100% 0 0)", duration: 0.3, ease: "power2.inOut" }, at - 0.34);
        }
        if (rest.length) tl.from(rest, { y: 18, opacity: 0, stagger: 0.04, duration: 0.14, ease: "power2.out" }, at - 0.16);
        // Each beat holds until the next one starts, so a touch scroll can never rest on an empty stage
        if (exit) tl.to(el, { opacity: 0, y: -24, duration: 0.12, ease: "power1.in" }, exitAt ?? nextAt(id) - 0.46);
      };

      // House open to lights down
      tl.to(".arc-letter", { fillOpacity: 0, stagger: { each: 0.018, from: "edges" }, duration: 0.14 }, 0.08)
        .to(".hero-copy", { opacity: 0, y: -18, duration: 0.2 }, 0.05)
        .to(".hero-action", { opacity: 0, y: 40, rotation: 4, duration: 0.24, ease: "power2.in" }, 0.05)
        .to(".scrim", { opacity: 1, duration: 0.3 }, 0.3)
        .set('[data-beat="house"]', { pointerEvents: "none" }, 0.2)
        .to(".nav-join", { opacity: 1, duration: 0.1 }, 0.25);
      fly({ house: 0 }, 0.05, 0.55, "power1.inOut");
      fly({ lamp: 1 }, 0.1, 0.35);
      fly({ burst: 1 }, 0.22, 1.15, "power1.out");
      fly({ spin: Math.PI * 3 }, 0, 2.2);
      fly({ cy: -0.8, cz: land ? 9 : 15, ly: 4 }, 0, AT.lights);

      beat("lights", "rise");

      // Up over the projector, out through the top of the dome
      fly({ cy: 7, cz: 2, ly: 9, lz: -8 }, AT.lights + 0.05, 0.3);
      fly({ cx: 8, cy: 3, cz: -26, lx: 0, ly: 0, lz: -80, fov: 50 }, AT.lights + 0.35, 0.45);
      fly({ lamp: 0 }, AT.lights + 0.4, 0.3);
      fly({ sat: 1 }, AT.lights + 0.2, 1.2, "none");

      beat("signal", "flicker");
      tl.fromTo(".signal-pulse", { scale: 0.2, opacity: 0.9 }, { scale: 3, opacity: 0, duration: 0.5, ease: "power1.out", stagger: 0.14 }, AT.signal - 0.3);

      fly({ cx: 0, cy: 0, cz: -40, lx: 0, ly: 0, lz: -110, fov: 42 }, AT.signal + 0.15, 0.45);
      fly({ links: 1 }, AT.signal + 0.2, 0.5, "power1.inOut");
      beat("links", "wipe");
      fly({ links: 0 }, AT.links + 0.25, 0.2);

      // Four worlds, with a flyby between each
      (["networking", "cybersecurity", "data", "iot"] as const).forEach((id, i) => {
        const [x, y, z] = WORLD_POS[i];
        const at = AT[id];
        const side = i % 2 === 0 ? 1 : -1;
        fly({ cx: x, cy: y, cz: z + CAMERA_GAP, lx: x, ly: y, lz: z, side }, at - 0.55, 0.55, "power2.inOut");
        beat(id, "rise");
        tl.to(
          ".pointer",
          land
            ? { opacity: 1, x: side > 0 ? "45vw" : "47vw", y: "-50%", rotation: side > 0 ? 0 : 180, duration: 0.28, ease: "power2.inOut" }
            : { opacity: 1, x: "44vw", y: "7vh", rotation: -90, duration: 0.28, ease: "power2.inOut" },
          at - 0.34,
        );
      });
      fly({ shell: 1 }, AT.cybersecurity - 0.4, 0.5, "power2.out");
      fly({ bars: 1 }, AT.data - 0.4, 0.5, "power2.out");
      tl.to(".pointer", { opacity: 0, duration: 0.1 }, AT.iot + 0.22);

      // Down onto the ground
      fly({ cx: 0, cy: -8, cz: -630, lx: 0, ly: -40, lz: -760, side: 0, fov: 50 }, AT.iot + 0.25, 0.65, "power2.inOut");
      fly({ dawn: 1 }, AT.iot + 0.4, 0.9);
      beat("descent", "drop");
      fly({ cy: -24, cz: -700, ly: -24, lz: -900 }, AT.descent + 0.1, 0.7);
      beat("launch", "rise", true, AT.launch + 0.3);
      // Counters must finish before their label, because snapping can rest the page exactly there
      tl.fromTo(".launch-count", { textContent: 0 }, { textContent: 54, snap: { textContent: 1 }, duration: 0.24, ease: "power1.out" }, AT.launch - 0.28);

      // The house lights themselves cover the jump back into the dome
      tl.to(".cover", { opacity: 1, duration: 0.3, ease: "power2.in" }, AT.launch + 0.35);
      tl.set(s, land
        ? { cx: 0, cy: 15, cz: 24, lx: 0, ly: -2, lz: 3, side: 1.1, fov: 42, house: 1, dawn: 0, lamp: 0 }
        : { cx: 0, cy: 22, cz: 30, lx: 0, ly: 3.5, lz: 3, side: 0, fov: 42, house: 1, dawn: 0, lamp: 0 }, AT.launch + 0.66);
      tl.set(".scrim", { opacity: 0 }, AT.launch + 0.66);
      tl.to(".cover", { opacity: 0, duration: 0.3, ease: "power1.out" }, AT.launch + 0.7);

      beat("houselights", "rise");
      fly({ seats: 1 }, AT.houselights - 0.45, 0.4, "none");
      tl.fromTo(".plan-count", { textContent: 0 }, { textContent: 54, snap: { textContent: 1 }, duration: 0.4 }, AT.houselights - 0.45);
      beat("seat", "rise", false);
      // The ticket leaves the empty seat, so the seat and the action read as one thing
      tl.fromTo(".seat-fly", { "--t": 1, opacity: 0 }, { "--t": 0, opacity: 1, duration: 0.2, ease: "power2.out" }, AT.seat - 0.16);
      tl.to(".cover", { opacity: 1, duration: 0.25 }, AT.seat + 0.15);

      tl.set({}, {}, AT.end);
      setCue("house");
    },
  );

  // Keyboard focus can land on a link in a beat that is not on screen yet
  const onFocus = (e: FocusEvent) => {
    const beat = (e.target as HTMLElement).closest<HTMLElement>("[data-beat]");
    if (beat?.dataset.beat && beat.dataset.beat !== current) goTo(beat.dataset.beat);
  };
  root.addEventListener("focusin", onFocus);

  const onClick = (e: MouseEvent) => {
    const dot = (e.target as HTMLElement).closest<HTMLElement>(".cue-dot");
    if (!dot?.dataset.cue) return;
    e.preventDefault();
    goTo(dot.dataset.cue);
  };
  root.addEventListener("click", onClick);

  const showCues = ScrollTrigger.create({
    trigger: "#story",
    start: "top top",
    end: "bottom 60%",
    toggleClass: { targets: q(".cues"), className: "on" },
  });

  return () => {
    root.removeEventListener("focusin", onFocus);
    root.removeEventListener("click", onClick);
    showCues.kill();
    mm.revert();
  };
}
