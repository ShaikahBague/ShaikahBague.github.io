import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { events } from "@/lib/content";
import { AT, ATMOSPHERES, CAMERA_GAP, FLEET, followStep, initialSky, SHOTS, STOP, WALK_TIME, WORLD_POS, type SkyState } from "@/lib/story";

// Each asteroid rests here, evenly spaced from the chapter's start to before the crew's flight leaves, so added events still fit
const STEP = (AT.crew - 1.1 - AT.log) / Math.max(1, events.length - 1);
const stepAt = (i: number) => AT.log + i * STEP;
const BEATS = Object.entries(AT);

export function buildShow(root: HTMLElement, s: SkyState) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const q = gsap.utils.selector(root);
  const beats = q("[data-beat]") as HTMLElement[];
  const veil = q(".veil")[0];
  let live: gsap.core.Timeline;
  let trigger: ScrollTrigger;
  let current = "";
  // The jeepney ride to the ID Finder, while it plays
  let riding: gsap.core.Timeline | undefined;

  // Stacked beats sit on top of each other, so only the visible one takes clicks
  const setBeat = (id: string) => {
    if (id === current || id === "end") return;
    current = id;
    beats.forEach((b) => b.toggleAttribute("data-active", b.dataset.beat === id));
  };

  // Going straight to a chapter dips through black, because flying there at speed is the one thing that must not happen
  const goTo = (time: number) => {
    if (!live) return;
    gsap
      .timeline()
      .to(veil, { opacity: 1, duration: 0.35, ease: "power1.in" })
      .call(() => {
        window.scrollTo(0, trigger.start + (time / AT.end) * (trigger.end - trigger.start));
        ScrollTrigger.update();
        live.time(time);
      })
      .to(veil, { opacity: 0, duration: 0.55, ease: "power1.out" }, "+=0.1");
  };

  const mm = gsap.matchMedia(root);
  mm.add(
    { land: "(min-aspect-ratio: 1/1)", port: "(max-aspect-ratio: 1/1)" },
    (ctx) => {
      const land = Boolean(ctx.conditions?.land);
      const shots = land ? SHOTS.land : SHOTS.port;
      // Undoing the last layout's timeline can't unpick tweens that overlap on one value, which left the cover stuck black on a phone rotation, so each layout starts clean
      // A rotation mid-visit leaves the visitor on the planet
      Object.assign(s, initialSky(), shots.hq, { planet: s.planet, inside: s.inside });
      gsap.set(".cover", { clearProps: "opacity,backgroundColor" });
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
      const st = ScrollTrigger.create({ trigger: "#story", start: "top top", end: "bottom bottom" });
      trigger = st;
      const stops = q(".log-stop") as HTMLElement[];
      const marks = q("[data-stop]") as HTMLElement[];
      let front = -1;
      // The timeline is walked from here rather than scrubbed, so a hard scroll can't drive it faster than the camera should go
      const follow = (_time: number, deltaMs: number) => {
        // Axie is leaving on the jeepney, so the scroll waits
        if (riding) return;
        const time = followStep(tl.time(), st.progress * AT.end, deltaMs / 1000);
        if (time !== tl.time()) tl.time(time);
        // A beat counts as current from the moment it starts to enter
        setBeat(BEATS.reduce((on, [id, at]) => (time + 0.34 >= at ? id : on), "house"));
        const shown = Math.round(s.log);
        if (shown !== front) {
          front = shown;
          // Stops sit on top of each other, so only the one on screen takes clicks
          stops.forEach((stop, i) => stop.toggleAttribute("data-on", i === shown));
          marks.forEach((mark, i) => (i === shown ? mark.setAttribute("aria-current", "step") : mark.removeAttribute("aria-current")));
        }
      };
      gsap.ticker.add(follow);
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
      const flight = (to: Partial<SkyState>, at: number, duration = 0.75) => {
        fly(to, at - duration, duration);
        fly({ chase: 1 }, at - duration, duration * 0.42);
        fly({ chase: 0 }, at - duration * 0.45, duration * 0.45);
      };

      // Axie looks out and waves at each arrival, then settles before the next burn
      const wave = (at: number) => {
        fly({ wave: 1 }, at - 0.22, 0.14, "power2.out");
        fly({ wave: 0 }, at + 0.28, 0.14, "power2.in");
      };

      // Axie crosses the plaza and walks up the ramp into the rocket, and the door shuts behind them
      tl.to(".hero-action", { opacity: 0, y: 40, duration: 0.24, ease: "power2.in" }, 0.05)
        .set('[data-beat="house"]', { pointerEvents: "none" }, 0.2)
        .to(".scrim", { opacity: 1, duration: 0.3 }, 3.24);
      fly({ wave: 0 }, 0.02, 0.1);
      // An even pace, because the strides are tied to this: any ease would have Axie sprinting through the middle of it
      fly({ out: 0 }, 0.06, WALK_TIME, "none");
      fly(shots.walk, 0.02, WALK_TIME + 0.02);
      fly({ door: 0 }, 1.7, 0.2, "power1.inOut");

      // The camera tips up to the glass as a lift carries Axie up inside the hull and through the cabin floor. They wave from their seat, then ignition
      fly(shots.board, 1.66, 0.5);
      fly({ climb: 1 }, 1.8, 0.6);
      fly({ wave: 1 }, 2.4, 0.1, "power2.out");
      fly({ wave: 0 }, 2.62, 0.1, "power2.in");
      fly(shots.launch, 2.63, 0.4);
      fly({ burn: 1 }, 2.85, 0.14, "power2.out");
      fly({ smoke: 1 }, 2.85, 0.95, "power1.out");
      fly({ ground: 0 }, 3.03, 0.5);
      // The blue lasts well into the climb and only deepens to space on the way up
      fly({ house: 0 }, 3.03, 0.85);
      fly({ fly: STOP.liftoff, side: land ? 1 : 0.8 }, 2.93, AT.liftoff - 2.93);
      fly(shots.liftoff, 2.99, AT.liftoff - 2.99);
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

      // Up to the five little planets, which the visitor picks from. They stay put while the rocket hangs off to one side
      flight({ fly: STOP.fleet, cx: FLEET.x, cy: FLEET.y, cz: FLEET.z + CAMERA_GAP, lx: FLEET.x, ly: FLEET.y, lz: FLEET.z, side: 0, fov: 42 }, AT.fleet);
      beat("fleet", "rise");
      wave(AT.fleet);

      // The flight log: the rocket crosses an asteroid belt and each event comes past on a rock of its own, far off and top right
      // at first, rests with its photo up while the visitor reads, then goes by the camera as the next one comes in
      const logX = land ? -3 : 10;
      const logView = land ? { cy: 0, ly: 0, cz: -445 } : { cy: 13, ly: 13, cz: -438 };
      const lastStep = stepAt(events.length - 1);
      const leg = STEP * 0.55;
      flight({ fly: STOP.logStart, cx: -50 + logX, lx: -50 + logX, lz: -520, side: 0, fov: 42, ...logView }, AT.log);
      fly({ fly: STOP.logEnd, cx: 50 + logX, lx: 50 + logX }, AT.log, lastStep - AT.log, "none");
      beat("log", "rise", true, AT.crew - 0.5);
      (q(".log-stop") as HTMLElement[]).forEach((stop, i) => {
        const at = stepAt(i);
        fly({ log: i }, at - leg, leg);
        tl.fromTo(stop, { opacity: 0 }, { opacity: 1, duration: leg * 0.3, ease: "power1.inOut" }, at - leg * 0.45);
        tl.to(stop, { opacity: 0, duration: leg * 0.3, ease: "power1.inOut" }, at + STEP - leg + leg * 0.2);
      });
      fly({ log: events.length }, lastStep + STEP - leg, leg);

      // The crew, with the phone scrim out of the rocket's way. The rocket hangs small in the gap beside the heading, because the constellation needs the sky.
      // It lights itself up with a CSS animation when the chapter opens or a year is picked, since the year is the visitor's choice and not the scroll's
      tl.to(".scrim", { opacity: 0, duration: 0.2 }, AT.crew - 0.5);
      flight(land
        ? { fly: STOP.crew, cx: 99, cy: -27, cz: -380, lx: 99, ly: -27, lz: -540, side: 1.1 }
        : { fly: STOP.crew, cx: 65, cy: -20, cz: -385, lx: 65, ly: -20, lz: -540, side: 0 }, AT.crew);
      const crewEnd = AT.crew + 1.1;
      beat("crew", "rise", true, crewEnd + 0.55);
      tl.from(".crew-tabs", { opacity: 0, y: 14, duration: 0.12, ease: "power2.out" }, AT.crew - 0.2);
      wave(AT.crew);

      // Everything fades to black, and the rocket comes down unseen. Then a door opens in the dark, with nothing to see but its yellow
      // light and the long shadow Axie throws walking out of it, until headquarters slowly comes back up around them
      const home = crewEnd + 1.12;
      tl.to(".cover", { opacity: 1, duration: 0.5, ease: "power1.inOut" }, crewEnd + 0.6);
      tl.set(s, { fly: STOP.home, ground: 1, door: 0, climb: 0, dim: 1, house: 1, burn: 0, smoke: 0, side: 0, fov: 42, ...shots.door }, home);
      tl.set(".cover", { opacity: 0 }, home + 0.02);
      beat("home", "rise", true, AT.home + 0.9);
      fly({ door: 1 }, AT.home, 0.7, "power1.inOut");
      fly(shots.doorBack, AT.home + 0.1, 1.1);
      fly({ dim: 0 }, AT.home + 1.25, 1.1);
      fly({ out: 1 }, AT.home + 0.55, WALK_TIME + 0.05, "none");
      fly({ ...shots.chat, side: 0 }, AT.home + 1.35, AT.chat - AT.home - 1.35);

      // Axie stops in front of the camera, says hello, and this is where they stay to talk. Nothing moves until the visitor scrolls on
      fly({ wave: 1 }, AT.chat - 0.1, 0.1);
      beat("chat", "rise", false);
      tl.from(".chat", { y: 28, opacity: 0, duration: 0.16, ease: "power2.out" }, AT.chat - 0.2);
      tl.set(".cover", { backgroundColor: "#5b21d6" }, AT.chat + 1.6);
      tl.to(".cover", { opacity: 1, duration: 0.35 }, AT.chat + 1.7);

      tl.set({}, {}, AT.end);
      tl.time(st.progress * AT.end);
      setBeat("house");
      return () => gsap.ticker.remove(follow);
    },
  );

  // Keyboard focus can land on a link in a beat that is not on screen yet
  const onFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    const stop = target.closest(".log-stop");
    if (stop) {
      if (!stop.hasAttribute("data-on")) goTo(stepAt((q(".log-stop") as Element[]).indexOf(stop)));
      return;
    }
    const beat = target.closest<HTMLElement>("[data-beat]");
    if (beat?.dataset.beat && beat.dataset.beat !== current) goTo(AT[beat.dataset.beat as keyof typeof AT]);
  };
  root.addEventListener("focusin", onFocus);

  // Down to a planet and back. Real time rather than the scroll's, because this is a place the visitor chose to go. The page stays exactly
  // where it was underneath, and the planet's air covers the moment one scene swaps for the other
  const atmos = q(".atmos")[0];
  const html = document.documentElement;
  let visit: gsap.core.Timeline | undefined;
  const onClick = (e: MouseEvent) => {
    const finder = (e.target as HTMLElement).closest<HTMLAnchorElement>("[data-finder]");
    if (finder) return ride(e, finder.href);
    const mark = (e.target as HTMLElement).closest<HTMLElement>("[data-stop]");
    if (mark) return goTo(stepAt(Number(mark.dataset.stop)));
    const button = (e.target as HTMLElement).closest<HTMLElement>("[data-land]");
    if (!button || s.inside > 0) return;
    const planet = Number(button.dataset.land);
    const { low, top } = ATMOSPHERES[planet];
    s.planet = planet;
    atmos.style.background = `radial-gradient(circle, ${low}, ${top})`;
    html.classList.add("landed");
    visit = gsap
      .timeline()
      .to(s, { inside: 0.5, duration: 1.3, ease: "power2.in" })
      .to(atmos, { opacity: 1, duration: 0.5, ease: "power1.in" }, 0.8)
      .call(() => (q(`[data-planet="${planet}"]`)[0] as HTMLDialogElement).showModal())
      .to(s, { inside: 1, duration: 1.5, ease: "power2.out" })
      .to(atmos, { opacity: 0, duration: 0.9, ease: "power1.out" }, "<0.1");
  };
  root.addEventListener("click", onClick);
  const leave = () => {
    visit?.kill();
    visit = gsap
      .timeline({ onComplete: () => html.classList.remove("landed") })
      .to(atmos, { opacity: 1, duration: 0.4, ease: "power1.in" })
      .to(s, { inside: 0.5, duration: 0.4, ease: "power1.in" }, 0)
      .to(s, { inside: 0, duration: 1.3, ease: "power2.out" })
      .to(atmos, { opacity: 0, duration: 0.8, ease: "power1.out" }, "<0.1");
  };
  // Axie takes a jeepney to the ID Finder, but only from where the show starts: standing on their mark at headquarters, before the
  // walk. Anywhere later (on the way to the rocket, in space, or back home after the flight) the link just goes there, and so does
  // a click meant for a new tab
  const ride = (e: MouseEvent, href: string) => {
    const start = live && Math.max(live.time(), trigger.progress * AT.end) < 0.05 && s.inside === 0;
    const plain = e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (riding || !start || plain || !q("canvas.on").length) return;
    e.preventDefault();
    html.classList.add("riding");
    riding = gsap
      .timeline({ onComplete: () => location.assign(href) })
      .to(".hero-action", { opacity: 0, duration: 0.4, ease: "power1.in" }, 0)
      .to(s, { jeep: 1, duration: 2.4, ease: "power2.out" }, 0)
      .to(s, { jeep: 2, duration: 1.6, ease: "none" })
      .to(s, { jeep: 3, duration: 2.2, ease: "power2.in" })
      .to(".cover", { opacity: 1, duration: 0.5, ease: "power1.in" }, "-=0.5");
  };
  // Coming back with the browser's Back button can restore this page as it was left, mid-ride, so it starts over at headquarters
  const onShow = (e: PageTransitionEvent) => {
    if (!e.persisted || !riding) return;
    riding.progress(0).kill();
    riding = undefined;
    html.classList.remove("riding");
  };
  window.addEventListener("pageshow", onShow);

  const planets = q(".planet") as HTMLDialogElement[];
  planets.forEach((planet) => planet.addEventListener("close", leave));

  // Over the show the bar stays out of the picture; over reading sections it needs its own ground
  const solidBar = ScrollTrigger.create({
    trigger: "#mission",
    start: "top 4rem",
    end: "max",
    toggleClass: { targets: q(".topbar"), className: "solid" },
  });

  return () => {
    root.removeEventListener("focusin", onFocus);
    root.removeEventListener("click", onClick);
    window.removeEventListener("pageshow", onShow);
    riding?.kill();
    html.classList.remove("riding");
    planets.forEach((planet) => planet.removeEventListener("close", leave));
    visit?.kill();
    html.classList.remove("landed");
    solidBar.kill();
    mm.revert();
  };
}
