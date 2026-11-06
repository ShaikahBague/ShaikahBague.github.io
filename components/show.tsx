"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AXIE_GREETING, AXIE_SUGGESTIONS, axieReply, crew, cues, events, JOIN_URL, LAUNCH_URL, unissued, worlds } from "@/lib/content";
import { initialSky } from "@/lib/story";

// A no-break space, because SVG text collapses a normal one that sits alone in its own tspan
const TITLE = "CISCO\u00A0NETCONNECT".split("");

function Origin({ label = "Source: launch page" }: { label?: string }) {
  return (
    <a className="origin" href={LAUNCH_URL} target="_blank" rel="noreferrer" data-rest>
      {label}
    </a>
  );
}

// A frame on the film: the print being shown, a contact strip to pick another, and the notes beside it
function LogStop({ event }: { event: (typeof events)[number] }) {
  const [shown, setShown] = useState(0);
  const photo = event.photos[shown];
  return (
    <li className={`log-stop ${event.confirmed ? "" : "log-pending"}`}>
      <div className="log-frame">
        <figure className="log-print">
          {photo.src ? (
            <Image src={photo.src} alt={photo.alt} fill sizes="(max-aspect-ratio: 1/1) 84vw, 26rem" />
          ) : (
            <figcaption className="log-empty">
              <small>Photo to come</small>
              {photo.alt}
            </figcaption>
          )}
          <span className="log-develop" aria-hidden="true" />
        </figure>
        {event.photos.length > 1 ? (
          <div className="log-contact" role="group" aria-label={`Photos of ${event.title}`}>
            {event.photos.map((item, i) => (
              <button className="log-thumb" type="button" key={item.alt} aria-pressed={i === shown} aria-label={`Show photo ${i + 1}: ${item.alt}`} onClick={() => setShown(i)}>
                {item.src ? <Image src={item.src} alt="" fill sizes="4rem" /> : i + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="log-notes">
        <small>{event.when}</small>
        <h3>{event.title}</h3>
        <p>{event.note}</p>
        {event.went ? (
          <p className="log-went">
            <strong className="launch-count">{event.went}</strong> people went
          </p>
        ) : null}
        {event.confirmed ? event.went ? <Origin /> : null : <span className="origin unissued">Unissued</span>}
      </div>
    </li>
  );
}

// placeholder: answers come from a keyword lookup in lib/content.ts until the real chatbot exists
function AxieChat() {
  const [messages, setMessages] = useState([{ from: "axie", text: AXIE_GREETING }]);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);

  const ask = (text: string) => {
    const question = text.trim();
    if (!question) return;
    setMessages((all) => [...all, { from: "you", text: question }, { from: "axie", text: axieReply(question) }]);
    setDraft("");
  };

  return (
    <div className="chat">
      <div className="chat-head">
        <strong>Axie</strong>
        <span className="origin unissued">Placeholder</span>
      </div>
      <div className="chat-log" ref={log} role="log" aria-label="Conversation with Axie">
        {messages.map((message, i) => (
          <p className={`chat-line chat-${message.from}`} key={i}>
            {message.text}
          </p>
        ))}
      </div>
      <div className="chat-suggest">
        {AXIE_SUGGESTIONS.map((suggestion) => (
          <button type="button" key={suggestion} onClick={() => ask(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input aria-label="Message Axie" placeholder="Ask Axie something" autoComplete="off" maxLength={200} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
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
        <a className="nav-join" href="#join">
          Join
        </a>
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
              <svg className="hero-rocket" viewBox="0 0 200 360" aria-hidden="true">
                <path d="M100 8 C142 56 152 150 142 268 L58 268 C48 150 58 56 100 8Z" fill="#7c3aed" />
                <circle cx="100" cy="118" r="38" fill="#efe6ff" />
                <path d="M58 200 L14 318 L62 276Z M142 200 L186 318 L138 276Z" fill="#c084fc" />
                <path d="M72 268 L128 268 L142 330 L58 330Z" fill="#12072e" />
              </svg>
              <div className="hero-action">
                <div className="hero-lede">
                  <p className="hero-copy">
                    A student community at PUP - Manila for enterprise networking, cybersecurity operations and development networking.
                  </p>
                  <p className="hero-cue live-only">
                    <strong>Axie&rsquo;s still on Earth.</strong> Scroll to start the countdown.
                  </p>
                </div>
              </div>
            </div>

            <div className="beat world world-left" data-beat="liftoff">
              <h2>Three. Two. One.</h2>
              <p className="live-only" data-rest>
                Keep scrolling and the rocket keeps flying. Stop, and Axie waits for you.
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
                <small className="kicker" data-rest>
                  Department {i + 1} of {worlds.length}
                </small>
                <h2>{world.name}</h2>
                <p data-rest>{world.line}</p>
              </div>
            ))}

            <div className="beat log" data-beat="log">
              <h2>The flight log.</h2>
              <div className="log-window">
                <ol className="log-track">
                  {events.map((event) => (
                    <LogStop event={event} key={event.title} />
                  ))}
                </ol>
              </div>
            </div>

            <div className="beat crew" data-beat="crew">
              <h2>The people flying it.</h2>
              <ul className="crew-grid">
                {crew.map((person, i) => (
                  <li className={`crew-card ${person.confirmed ? "" : "crew-pending"}`} key={person.role + i}>
                    <span className="crew-patch" aria-hidden="true">
                      {person.name === "Name to come" ? "?" : person.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}
                    </span>
                    <span>
                      <strong>{person.name}</strong>
                      <small>{person.role}</small>
                      {person.confirmed ? null : <span className="origin unissued">Unissued</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="beat world world-left" data-beat="home">
              <h2>Back on Earth.</h2>
              <p data-rest>Axie has been to all three worlds, and has plenty to tell you about them.</p>
            </div>

            <div className="beat chat-beat" data-beat="chat">
              <h2>Now say hi.</h2>
              <AxieChat />
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
            <span className="cue-now">A1 On the pad</span>
            <span className="cue-next">Next: Liftoff</span>
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
            <h2>Join the crew.</h2>
            <p>Enterprise Networking, Cybersecurity Operations, Development Networking. Come for one, stay for the people working on all three.</p>
            <p className="join-note">
              <span className="origin unissued">Unissued</span> Sign-ups aren&rsquo;t open here yet. Reach the team through the launch page.
            </p>
          </div>
          <a className="join-link" href={JOIN_URL}>
            Join
          </a>
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
