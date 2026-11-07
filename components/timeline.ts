import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { crews, events } from "@/lib/content";
import { AT, CAMERA_GAP, followStep, holdsAtChat, initialSky, SHOTS, STOP, WORLD_POS, type SkyState } from "@/lib/story";

// Each asteroid rests here, evenly spaced from the chapter's start to before the crew's flight leaves, so added events still fit
const STEP = (AT.crew - 1.1 - AT.log) / Math.max(1, events.length - 1);
const stepAt = (i: number) => AT.log + i * STEP;
// Each year's constellation rests here, evenly spaced up to the fade to black, so added years still fit
const YEAR_STEP = (AT.home - 1.55 - AT.crew) / Math.max(1, crews.length - 1);
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
  // Set when the visitor asks for something past the show, which the wait at the chat must never get in the way of
  let released = false;

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
      Object.assign(s, initialSky(), shots.hq);
      gsap.set(".cover", { clearProps: "opacity,backgroundColor" });
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
      const st = ScrollTrigger.create({ trigger: "#story", start: "top top", end: "bottom bottom" });
      trigger = st;
      const stops = q(".log-stop") as HTMLElement[];
      let front = -1;
      // The timeline is walked from here rather than scrubbed, so a hard scroll can't drive it faster than the camera should go
      let rested = st.progress * AT.end >= AT.chat ? Infinity : 0;
      const follow = (_time: number, deltaMs: number) => {
        const dt = deltaMs / 1000;
        const gate = st.start + (AT.chat / AT.end) * (st.end - st.start);
        if (window.scrollY <= gate) released = false;
        rested = tl.time() >= AT.chat - 0.01 ? rested + dt : 0;
        const held = !released && holdsAtChat(tl.time(), rested);
        if (held && window.scrollY > gate) window.scrollTo(0, gate);
        const wanted = st.progress * AT.end;
        const time = followStep(tl.time(), held ? Math.min(wanted, AT.chat) : wanted, dt);
        if (time !== tl.time()) tl.time(time);
        // A beat counts as current from the moment it starts to enter
        setBeat(BEATS.reduce((on, [id, at]) => (time + 0.34 >= at ? id : on), "house"));
        const shown = Math.round(s.log);
        if (shown !== front) {
          front = shown;
          // Stops sit on top of each other, so only the one on screen takes clicks
          stops.forEach((stop, i) => stop.toggleAttribute("data-on", i === shown));
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
      tl.to(".arc-letter", { fillOpacity: 0, stagger: { each: 0.018, from: "edges" }, duration: 0.14 }, 0.08)
        .to(".hero-action", { opacity: 0, y: 40, duration: 0.24, ease: "power2.in" }, 0.05)
        .set('[data-beat="house"]', { pointerEvents: "none" }, 0.2)
        .to(".scrim", { opacity: 1, duration: 0.3 }, 2.45);
      fly({ wave: 0 }, 0.02, 0.1);
      fly({ out: 0 }, 0.06, 0.96);
      fly(shots.walk, 0.02, 0.98);
      fly({ door: 0 }, 1.04, 0.2, "power1.inOut");

      // The camera tips up to the glass as a lift carries Axie up inside the hull and through the cabin floor. They wave from their seat, then ignition
      fly(shots.board, 1, 0.45);
      fly({ climb: 1 }, 1.12, 0.48);
      fly({ wave: 1 }, 1.58, 0.1, "power2.out");
      fly({ wave: 0 }, 1.84, 0.1, "power2.in");
      fly(shots.launch, 1.85, 0.4);
      fly({ burn: 1 }, 2.07, 0.14, "power2.out");
      fly({ smoke: 1 }, 2.07, 0.95, "power1.out");
      fly({ ground: 0 }, 2.25, 0.5);
      // The blue lasts well into the climb and only deepens to space on the way up
      fly({ house: 0 }, 2.25, 0.85);
      fly({ fly: STOP.liftoff, side: land ? 1 : 0.8 }, 2.15, AT.liftoff - 2.15);
      fly(shots.liftoff, 2.21, AT.liftoff - 2.21);
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
      // Counters must finish before their chapter, because snapping rests the page exactly there
      const launchStep = events.findIndex((event) => event.went);
      wave(stepAt(launchStep));
      tl.fromTo(".launch-count", { textContent: 0 }, { textContent: 54, snap: { textContent: 1 }, duration: 0.22, ease: "power1.out" }, stepAt(launchStep) - 0.24);

      // The crew, with the phone scrim out of the rocket's way. Each year a shooting star falls to the first officer's star, and the
      // line runs on from it lighting the rest. Newest year first, then the year clears for the one before it
      tl.to(".scrim", { opacity: 0, duration: 0.2 }, AT.crew - 0.5);
      // A phone stacks the chart on top, so the rocket flies in the clear space under it
      flight(land
        ? { fly: STOP.crew, cx: 70, cy: 2, cz: -470, lx: 70, ly: 2, lz: -540, side: 1.1 }
        : { fly: STOP.crew, cx: 68, cy: 15, cz: -450, lx: 68, ly: 15, lz: -540, side: 0 }, AT.crew);
      const crewEnd = AT.crew + (crews.length - 1) * YEAR_STEP;
      beat("crew", "rise", true, crewEnd + 0.55);
      (q(".crew-year") as HTMLElement[]).forEach((year, i) => {
        const at = AT.crew + i * YEAR_STEP;
        const stars = year.querySelectorAll(".crew-star");
        tl.set(year, { opacity: 1 }, at - 0.42);
        tl.from(year.querySelector(".crew-date"), { opacity: 0, y: 14, duration: 0.12, ease: "power2.out" }, at - 0.36);
        tl.fromTo(year.querySelectorAll(".crew-streak"), { strokeDashoffset: 0.28 }, { strokeDashoffset: -1.02, duration: 0.16, ease: "power1.in" }, at - 0.42);
        tl.fromTo(year.querySelectorAll(".crew-line"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.3 }, at - 0.26);
        tl.from(stars, { opacity: 0, scale: 0, stagger: 0.26 / stars.length, duration: 0.08, ease: "back.out(3)" }, at - 0.26);
        if (i < crews.length - 1) tl.to(year, { opacity: 0, y: -18, duration: 0.12, ease: "power1.in" }, at + YEAR_STEP - 0.5);
      });
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
      fly({ out: 0.42 }, AT.home + 0.55, 0.75);
      fly({ dim: 0 }, AT.home + 1.25, 1.1);
      fly({ out: 1 }, AT.home + 1.3, AT.chat - 0.1 - AT.home - 1.3);
      fly({ ...shots.chat, side: land ? 0.55 : 1 }, AT.home + 1.35, AT.chat - AT.home - 1.35);

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
    if (!target.closest("#story")) released = true;
    const stop = target.closest(".log-stop");
    if (stop) {
      if (!stop.hasAttribute("data-on")) goTo(stepAt((q(".log-stop") as Element[]).indexOf(stop)));
      return;
    }
    const beat = target.closest<HTMLElement>("[data-beat]");
    if (beat?.dataset.beat && beat.dataset.beat !== current) goTo(AT[beat.dataset.beat as keyof typeof AT]);
  };
  root.addEventListener("focusin", onFocus);

  const onClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a[href^="#"]');
    if (link && link.getAttribute("href") !== "#story") released = true;
  };
  root.addEventListener("click", onClick);

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
    solidBar.kill();
    mm.revert();
  };
}
