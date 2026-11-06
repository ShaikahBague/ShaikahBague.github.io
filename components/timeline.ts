import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { cues, events } from "@/lib/content";
import { AT, CAMERA_GAP, PAD_VIEW, PAD_VIEW_PORTRAIT, snapTarget, STOP, WORLD_POS, type SkyState } from "@/lib/story";

// Each photo stop in the flight log, evenly spaced from the chapter's start to just before the crew's flight leaves
const stepAt = (i: number) => AT.log + i * ((AT.crew - 0.85 - AT.log) / Math.max(1, events.length - 1));
const RESTS = [...new Set([...Object.values(AT), ...events.map((_, i) => stepAt(i))])].sort((a, b) => a - b);

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
      let rest = 0;
      let target = 0;
      const pad = land ? PAD_VIEW : PAD_VIEW_PORTRAIT;
      Object.assign(s, pad);
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
                snapTo: (progress) => {
                  target = snapTarget(RESTS, rest, progress * AT.end);
                  return target / AT.end;
                },
                // Velocity projection flings fast scrolls past whole chapters
                inertia: false,
                // Gaps between wheel notches run past 120ms, so a shorter wait snaps mid-scroll and fights the visitor
                delay: 0.28,
                // A chapter is a whole flight, which a quarter second can't show
                duration: { min: 0.7, max: 1.2 },
                ease: "power2.inOut",
                // Only a finished snap counts: one the visitor interrupted never reached its chapter
                onComplete: () => {
                  rest = target;
                },
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

      const fly = (
        to: Partial<SkyState>,
        at: number,
        duration: number,
        ease = "sine.inOut",
      ) => tl.to(s, { ...to, duration, ease }, at);

      const nextAt = (id: keyof typeof AT) => Math.min(...Object.values(AT).filter((at) => at > AT[id]));

      const beat = (id: keyof typeof AT, enter: "rise" | "flicker" | "wipe", exit = true, exitAt?: number) => {
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
        } else {
          tl.from(heading, { clipPath: "inset(0 100% 0 0)", duration: 0.3, ease: "power2.inOut" }, at - 0.34);
        }
        if (rest.length) tl.from(rest, { y: 18, opacity: 0, stagger: 0.04, duration: 0.14, ease: "power2.out" }, at - 0.16);
        // Copy clears once the rocket has left, so the flight itself is the only thing between two chapters
        if (exit) tl.to(el, { opacity: 0, y: -24, duration: 0.12, ease: "power1.in" }, exitAt ?? nextAt(id) - 0.62);
      };

      // A leg between chapters: the rocket and framed view arrive together, and the camera chases in between
      const flight = (to: Partial<SkyState>, at: number, duration = 0.7) => {
        fly(to, at - duration, duration, "power2.inOut");
        fly({ chase: 1 }, at - duration, duration * 0.4);
        fly({ chase: 0 }, at - duration * 0.45, duration * 0.45);
      };

      // Axie looks out and waves at each arrival, then settles before the next burn
      const wave = (at: number) => {
        fly({ wave: 1 }, at - 0.22, 0.14, "power2.out");
        fly({ wave: 0 }, at + 0.28, 0.14, "power2.in");
      };

      // Axie boards from the ground, then ignition
      tl.to(".arc-letter", { fillOpacity: 0, stagger: { each: 0.018, from: "edges" }, duration: 0.14 }, 0.08)
        .to(".hero-action", { opacity: 0, y: 40, rotation: 2, duration: 0.24, ease: "power2.in" }, 0.05)
        .to(".scrim", { opacity: 1, duration: 0.3 }, 0.3)
        .set('[data-beat="house"]', { pointerEvents: "none" }, 0.2);
      fly({ out: 0, wave: 0 }, 0.02, 0.2, "power1.inOut");
      fly({ burn: 1 }, 0.24, 0.16, "power2.out");
      fly({ smoke: 1 }, 0.24, 0.95, "power1.out");
      fly({ house: 0 }, 0.3, 0.6, "power1.inOut");
      fly({ fly: STOP.liftoff, cx: 0, cy: 21, cz: land ? 26 : 38, lx: 0, ly: 21, lz: -4, side: land ? 1 : 0.8 }, 0.3, AT.liftoff - 0.3, "power2.inOut");
      beat("liftoff", "rise");
      wave(AT.liftoff);

      // Past the satellite: the first signal
      flight({ fly: STOP.signal, cx: 8, cy: 3, cz: -26, lx: 0, ly: 0, lz: -80, side: 0, fov: 50 }, AT.signal);
      fly({ sat: 1 }, AT.liftoff + 0.1, 2, "none");
      beat("signal", "flicker");
      tl.fromTo(".signal-pulse", { scale: 0.2, opacity: 0.9 }, { scale: 3, opacity: 0, duration: 0.5, ease: "power1.out", stagger: 0.14 }, AT.signal - 0.3);

      // The stars join up behind the rocket as it crosses them
      flight({ fly: STOP.links, cx: 0, cy: 0, cz: -40, lx: 0, ly: 0, lz: -110, fov: 42 }, AT.links);
      fly({ links: 1 }, AT.links - 0.7, 0.7, "power1.inOut");
      beat("links", "wipe");
      fly({ links: 0 }, AT.links + 0.4, 0.2);

      // Three departments, with a flight between each
      (["enterprise", "cyberops", "devnet"] as const).forEach((id, i) => {
        const [x, y, z] = WORLD_POS[i];
        const at = AT[id];
        const side = i % 2 === 0 ? 1 : -1;
        flight({ fly: STOP[id], cx: x, cy: y, cz: z + CAMERA_GAP, lx: x, ly: y, lz: z, side }, at);
        beat(id, "rise");
        wave(at);
      });
      fly({ shell: 1 }, AT.cyberops - 0.4, 0.5, "power2.out");

      // The flight log: the rocket crosses the sky while a strip of film runs under it. Each print swings
      // up out of the reel and develops as it reaches the middle, then swings away
      const logX = land ? 0 : 10;
      const logView = land ? { cy: 0, ly: 0, cz: -445 } : { cy: -5.7, ly: -5.7, cz: -425 };
      const lastStep = stepAt(events.length - 1);
      flight({ fly: STOP.logStart, cx: -50 + logX, lx: -50 + logX, lz: -520, side: 0, fov: 42, ...logView }, AT.log);
      fly({ fly: STOP.logEnd, cx: 50 + logX, lx: 50 + logX }, AT.log, lastStep - AT.log, "none");
      beat("log", "rise", true, AT.crew - 0.5);
      const track = q(".log-track")[0];
      tl.to(track, { x: () => -(track.scrollWidth - track.parentElement!.clientWidth), duration: lastStep - AT.log }, AT.log);
      (q(".log-stop") as HTMLElement[]).forEach((stop, i) => {
        tl.fromTo(stop, { opacity: 0.35, scale: 0.9, rotationY: 34 }, { opacity: 1, scale: 1, rotationY: 0, duration: 0.24, ease: "power2.out" }, stepAt(i) - 0.3);
        tl.fromTo(stop.querySelector(".log-develop"), { opacity: 0.9 }, { opacity: 0, duration: 0.24, ease: "power1.in" }, stepAt(i) - 0.3);
        if (i < events.length - 1) tl.to(stop, { opacity: 0.35, scale: 0.9, rotationY: -34, duration: 0.2, ease: "power2.in" }, stepAt(i) + 0.26);
      });
      // Counters must finish before their chapter, because snapping rests the page exactly there
      const launchStep = events.findIndex((event) => event.went);
      wave(stepAt(launchStep));
      tl.fromTo(".launch-count", { textContent: 0 }, { textContent: 54, snap: { textContent: 1 }, duration: 0.22, ease: "power1.out" }, stepAt(launchStep) - 0.24);

      // The crew, stamped into the manifest one at a time, with the phone scrim out of the rocket's way
      tl.to(".scrim", { opacity: 0, duration: 0.2 }, AT.crew - 0.5);
      // A phone stacks the manifest on top, so the rocket flies in the clear space under it
      flight(land
        ? { fly: STOP.crew, cx: 70, cy: 2, cz: -470, lx: 70, ly: 2, lz: -540, side: 1.1 }
        : { fly: STOP.crew, cx: 72, cy: 9.5, cz: -460, lx: 72, ly: 9.5, lz: -540, side: 0 }, AT.crew);
      beat("crew", "rise", true, AT.crew + 0.55);
      tl.from(".crew-card", { opacity: 0, scale: 1.35, rotation: -7, stagger: 0.045, duration: 0.14, ease: "back.out(1.7)" }, AT.crew - 0.42);
      wave(AT.crew);

      // A flash hides the jump home, then the rocket backs down onto the pad it left, tail first
      const cut = AT.crew + 0.76;
      const touchdown = AT.chat - 0.35;
      tl.to(".cover", { opacity: 1, duration: 0.3, ease: "power2.in" }, AT.crew + 0.45);
      tl.set(s, { fly: STOP.descent, retro: 1, smoke: 0, cx: 0, lx: 0, lz: 0, fov: 42, ...(land ? { cy: 6, cz: 110, ly: 0, side: 1 } : { cy: 6, cz: 150, ly: -10, side: 0 }) }, cut);
      tl.to(".cover", { opacity: 0, duration: 0.25, ease: "power1.out" }, cut + 0.04);
      fly({ fly: STOP.approach }, cut, AT.home - cut, "power1.out");
      beat("home", "rise");
      fly({ fly: STOP.home, ...(land ? { ...PAD_VIEW, side: 0.55 } : { ...PAD_VIEW_PORTRAIT, cz: 40, ly: -8.5, side: 0 }) }, AT.home + 0.25, touchdown - AT.home - 0.25, "power2.inOut");
      fly({ house: 1 }, AT.home + 0.3, 0.45);

      // Touchdown: the burn stops, Axie hops out and the chat opens beside them
      fly({ burn: 0 }, touchdown - 0.05, 0.1);
      fly({ smoke: 1 }, touchdown - 0.05, 0.3, "power1.out");
      fly({ out: 1 }, touchdown, 0.2, "power1.inOut");
      fly({ wave: 1 }, touchdown + 0.2, 0.08);
      beat("chat", "rise", false);
      tl.from(".chat", { y: 28, opacity: 0, duration: 0.16, ease: "power2.out" }, AT.chat - 0.2);
      tl.to(".cover", { opacity: 1, duration: 0.22 }, AT.chat + 0.22);

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

  // Over the show the bar stays out of the picture; over reading sections it needs its own ground
  const solidBar = ScrollTrigger.create({
    trigger: "#programme",
    start: "top 4rem",
    end: "max",
    toggleClass: { targets: q(".topbar"), className: "solid" },
  });

  return () => {
    root.removeEventListener("focusin", onFocus);
    root.removeEventListener("click", onClick);
    showCues.kill();
    solidBar.kill();
    mm.revert();
  };
}
