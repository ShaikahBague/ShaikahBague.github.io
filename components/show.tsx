"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { cues, JOIN_URL, LAUNCH_URL, unissued, worlds } from "@/lib/content";
import { initialSky, MOTION_KEY, seats } from "@/lib/story";

const TITLE = "NETCONNECT".split("");

function Origin({ label = "Source: launch page" }: { label?: string }) {
  return (
    <a className="origin" href={LAUNCH_URL} target="_blank" rel="noreferrer" data-rest>
      {label}
    </a>
  );
}

function Ticket({ href, seat, label }: { href: string; seat: string; label: string }) {
  return (
    <a className="ticket" href={href}>
      <span className="ticket-body">
        <small>{seat}</small>
        <strong>Admit one student</strong>
      </span>
      <span className="ticket-stub">{label}</span>
    </a>
  );
}

function toggleMotion() {
  const playing = document.documentElement.classList.contains("live");
  try {
    localStorage.setItem(MOTION_KEY, playing ? "off" : "on");
  } catch {
    // Storage blocked: the visitor stays on the page they already have
    return;
  }
  location.reload();
}

export function Show() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains("live") || !root.current || !canvas.current) return;
    const el = root.current;
    const surface = canvas.current;
    const s = initialSky();
    let disposed = false;
    const cleanups: (() => void)[] = [];

    import("./timeline")
      .then(({ buildShow }) => {
        if (!disposed) cleanups.push(buildShow(el, s));
      })
      .catch((error) => {
        // Without the timeline the stacked beats would overlap, so go back to the plain page
        console.error(error);
        html.classList.remove("live");
      });

    import("./sky")
      .then(({ createSky }) => {
        if (disposed) return;
        cleanups.push(createSky(surface, s));
        surface.classList.add("on");
      })
      .catch((error) => console.error(error));

    return () => {
      disposed = true;
      cleanups.forEach((clean) => clean());
    };
  }, []);

  return (
    <div ref={root}>
      <header className="topbar">
        <a className="brand" href="#story">
          <Image src="/cncp-white.png" alt="" width={1000} height={773} sizes="56px" priority />
          <span>Cisco NetConnect PUP - Manila</span>
        </a>
        <div className="topbar-actions">
          <button className="motion-toggle" type="button" onClick={toggleMotion}>
            <span className="when-plain">Play the show</span>
            <span className="when-live">Stop the motion</span>
          </button>
          <a className="nav-join" href="#join">
            Join
          </a>
        </div>
      </header>

      <main>
        <section id="story">
          <div className="stage">
            <canvas ref={canvas} aria-hidden="true" />
            <div className="scrim" />
            <div className="cover" />

            <div className="beat hero" data-beat="house" data-active>
              <h1 className="sr-only">Cisco NetConnect PUP - Manila</h1>
              {[
                { id: "arc-wide", box: "0 0 1440 470", path: "M50 420 Q720 -90 1390 420" },
                { id: "arc-narrow", box: "0 0 400 230", path: "M6 190 Q200 -20 394 190" },
              ].map((arc) => (
                <svg key={arc.id} className={`arc ${arc.id}`} viewBox={arc.box} aria-hidden="true">
                  <path id={arc.id + "-path"} d={arc.path} fill="none" />
                  <text textAnchor="middle">
                    <textPath href={`#${arc.id}-path`} startOffset="50%">
                      {TITLE.map((letter, i) => (
                        <tspan className="arc-letter" key={i}>
                          {letter}
                        </tspan>
                      ))}
                    </textPath>
                  </text>
                </svg>
              ))}
              <p className="hero-copy">
                A student community at PUP - Manila for networking, cybersecurity, data analytics and IoT.
              </p>
              <svg className="hero-projector" viewBox="0 0 300 360" aria-hidden="true">
                <circle cx="70" cy="90" r="62" fill="#a9b4ff" />
                <circle cx="230" cy="90" r="62" fill="#a9b4ff" />
                <rect x="60" y="76" width="180" height="30" fill="#efe6ff" />
                <rect x="134" y="104" width="32" height="170" fill="#c084fc" />
                <path d="M78 360 L134 262 L166 262 L222 360 Z" fill="#7c3aed" />
              </svg>
              <svg className="hero-seats" viewBox="0 0 1440 290" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
                <g fill="none" stroke="#12072e" strokeWidth="44" strokeDasharray="46 10">
                  <path d="M-40 250 Q720 40 1480 250" />
                  <path d="M-40 330 Q720 130 1480 330" />
                </g>
                <path d="M-40 370 Q720 200 1480 370 L1480 400 L-40 400Z" fill="#12072e" />
              </svg>
              <div className="hero-action">
                <p className="hero-cue">
                  <span className="live-only">
                    <strong>The lights are about to go down.</strong> Scroll to start the show.
                  </span>
                </p>
                <Ticket href="#join" seat="Row D, seat 55" label="Join" />
              </div>
            </div>

            <div className="beat at-top" data-beat="lights">
              <h2>The lights go down.</h2>
              <p className="live-only" data-rest>
                Keep scrolling. The projector does the rest.
              </p>
            </div>

            <div className="beat at-end" data-beat="signal">
              <span className="signal-pulse" />
              <span className="signal-pulse" />
              <span className="signal-pulse" />
              <h2>It started as a signal.</h2>
              <p data-rest>Cisco NetConnect PUP - Manila began with online initiatives: points of light, a long way apart.</p>
              <Origin />
            </div>

            <div className="beat at-bottom" data-beat="links">
              <h2>Then the points found each other.</h2>
              <p data-rest>&ldquo;Building Bridges, Powering Connections&rdquo; is what the launch was called.</p>
              <Origin />
            </div>

            {worlds.map((world, i) => (
              <div className={`beat world ${i % 2 ? "world-right" : "world-left"}`} data-beat={world.id} key={world.id}>
                <h2>{world.name}</h2>
                <p data-rest>{world.line}</p>
                <Origin label="Focus area named on the launch page" />
              </div>
            ))}
            <svg className="pointer" viewBox="0 0 120 48" aria-hidden="true">
              <path d="M0 24H94M72 6l30 18-30 18" fill="none" stroke="#a9b4ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div className="beat at-top" data-beat="descent">
              <h2>Then it came down to earth.</h2>
              <p data-rest>Online initiatives became on-ground engagements.</p>
              <Origin />
            </div>

            <div className="beat at-top" data-beat="launch">
              <h2>
                <span className="launch-count">54</span> people. One launch.
              </h2>
              <p data-rest>
                The official hard launch brought students to White Cloak Technologies in Ortigas Center for talks from industry experts, interactive sessions and networking.
              </p>
              <Origin />
            </div>

            <div className="plan" aria-hidden="true">
              <svg className="plan-art" viewBox="0 0 640 370">
                {seats.map((seat) => (
                  <rect
                    key={seat.key}
                    className={seat.open ? "plan-open" : "plan-seat"}
                    x={seat.x - 13}
                    y={seat.y - 11}
                    width="26"
                    height="22"
                    rx="5"
                    transform={`rotate(${seat.turn} ${seat.x} ${seat.y})`}
                  />
                ))}
              </svg>
            </div>

            <div className="beat at-plan" data-beat="houselights">
              <h2>House lights.</h2>
              <p data-rest>
                <span className="plan-count">54</span> seats filled at the launch. It stopped being a projection and became a room.
              </p>
              <Origin />
            </div>

            <div className="beat at-plan" data-beat="seat">
              <h2>Seat 55 is open.</h2>
              <p data-rest>It&rsquo;s yours if you want it.</p>
              <div className="seat-fly">
                <Ticket href="#join" seat="Row D, seat 55" label="Join" />
              </div>
            </div>
          </div>
        </section>

        <nav className="cues" aria-label="Show programme">
          <div className="cue-plan">
            <svg className="cue-dome" viewBox="0 0 288 40" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2 38 Q144 -20 286 38 Z" />
            </svg>
            <ol>
              {cues.map((cue, i) => (
                <li key={cue.id} style={{ "--lift": `${Math.round(Math.sin((i / (cues.length - 1)) * Math.PI) * 18)}px` } as React.CSSProperties}>
                  <a className="cue-dot" href="#story" data-cue={cue.id} aria-label={cue.label} />
                </li>
              ))}
            </ol>
          </div>
          <p>
            <span className="cue-now">A1 House open</span>
            <span className="cue-next">Next: Lights down</span>
          </p>
        </nav>

        <section id="programme">
          <h2>Still on the programme</h2>
          <ul className="sheet">
            {unissued.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.note}</p>
                <span className="origin unissued">Unissued</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="join">
          <div>
            <h2>Take the seat.</h2>
            <p>Networking, cybersecurity, data analytics, IoT. Come for one, stay for the people working on all four.</p>
            <p className="join-note">
              <span className="origin unissued">Unissued</span> Sign-ups aren&rsquo;t open here yet. Reach the team through the launch page.
            </p>
          </div>
          <Ticket href={JOIN_URL} seat="Unissued: join link pending" label="Join" />
        </section>
      </main>

      <footer className="foot">
        <p>Cisco NetConnect PUP - Manila. A student organization at PUP - Manila.</p>
        <p>
          Mentor or partner? <a href={LAUNCH_URL}>Talk to the team</a>{" "}
          <span className="origin unissued">Unissued: contact pending</span>
        </p>
      </footer>
    </div>
  );
}
