"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AXIE_GREETING, AXIE_SUGGESTIONS, axieReply, crews, events, JOIN_URL, LAUNCH_URL, offices, unissued, worlds } from "@/lib/content";
import { AT, ATMOSPHERES, FIRST_OFFICE, initialSky, SCREENS_PER_UNIT, starChart, voice } from "@/lib/story";

// What an asteroid carries: one lilac print with its caption and a contact strip to pick another, and the notes beside it
function LogStop({ event }: { event: (typeof events)[number] }) {
  const [shown, setShown] = useState(0);
  const photo = event.photos[shown];
  return (
    <li className={`log-stop ${event.confirmed ? "" : "log-pending"}`}>
      <div className="log-frame">
        <figure>
          <div className="log-print">
            {photo.src ? <Image src={photo.src} alt={photo.alt} fill sizes="(max-aspect-ratio: 1/1) 84vw, 34rem" /> : <small className="log-empty">Photo to come</small>}
          </div>
          {/* A real photo's alt already says this to a screen reader */}
          <figcaption className="log-caption" aria-hidden={Boolean(photo.src)}>{photo.alt}</figcaption>
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
        <h3>{event.title}</h3>
        <small>{event.when}</small>
        <p>{event.note}</p>
        {event.confirmed ? null : <span className="origin unissued">Unissued</span>}
      </div>
    </li>
  );
}

// A year's officers as a constellation. It is laid out twice because a phone needs fewer stars across, and the CSS picks one
function CrewYear({ crew, on, leaving, from }: { crew: (typeof crews)[number]; on: boolean; leaving: boolean; from?: (typeof crews)[number] }) {
  const count = crew.officers.length;
  const wide = starChart(crew.year, count, true);
  const tall = starChart(crew.year, count, false);
  // Picked from another year, each star sets off from where that year's star stood, so one figure rearranges into the next. Extra stars split off from the ones already there
  const fromWide = from && starChart(from.year, from.officers.length, true).stars;
  const fromTall = from && starChart(from.year, from.officers.length, false).stars;
  const start = (stars: number[][] | undefined, i: number, axis: number, own: number) => `${stars?.length ? stars[i % stars.length][axis] : own}%`;
  // However many stars there are, the whole figure takes the same time to light up
  const step = 1.4 / Math.max(1, count);
  return (
    <li className="crew-year" data-on={on ? "" : undefined} data-leaving={leaving ? "" : undefined} data-moved={on && from ? "" : undefined}>
      <h3 className="crew-date">
        {crew.year}
        {crew.confirmed ? null : <span className="origin unissued">Roster to confirm</span>}
      </h3>
      <div className="crew-chart">
        <div className="crew-sky" style={{ "--wc": wide.cols, "--wr": wide.rows, "--tc": tall.cols, "--tr": tall.rows } as React.CSSProperties}>
          {[
            { name: "crew-wide", chart: wide },
            { name: "crew-tall", chart: tall },
          ].map(({ name, chart }) => (
            <svg className={name} aria-hidden="true" key={name}>
              {chart.links.map(([from, to], i) => (
                <line
                  className="crew-line"
                  x1={`${chart.stars[from][0]}%`}
                  y1={`${chart.stars[from][1]}%`}
                  x2={`${chart.stars[to][0]}%`}
                  y2={`${chart.stars[to][1]}%`}
                  pathLength={1}
                  style={{ "--line": `${i * step}s` } as React.CSSProperties}
                  key={to}
                />
              ))}
            </svg>
          ))}
          <ul>
            {crew.officers.map((person, i) => (
              <li
                className={`crew-star ${person.confirmed ? "" : "crew-pending"}`}
                style={
                  {
                    "--wx": `${wide.stars[i][0]}%`,
                    "--wy": `${wide.stars[i][1]}%`,
                    "--wd": `${wide.order[i] * step}s`,
                    "--tx": `${tall.stars[i][0]}%`,
                    "--ty": `${tall.stars[i][1]}%`,
                    "--td": `${tall.order[i] * step}s`,
                    "--fwx": start(fromWide, i, 0, wide.stars[i][0]),
                    "--fwy": start(fromWide, i, 1, wide.stars[i][1]),
                    "--ftx": start(fromTall, i, 0, tall.stars[i][0]),
                    "--fty": start(fromTall, i, 1, tall.stars[i][1]),
                    // The first listed is the figure's brightest, and the rest vary so it reads as a sky rather than a diagram
                    "--size": `${i ? 0.5 + ((i * 7) % 3) * 0.11 : 0.95}rem`,
                  } as React.CSSProperties
                }
                key={person.role + i}
              >
                <span className="crew-label">
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

// Opens on the newest year, and the visitor picks any other. Every year stays in the page, so the plain layout still lists them all
function Crew() {
  const [view, setView] = useState({ shown: 0, from: -1, turn: 0 });
  const pick = (i: number) => setView((now) => (i === now.shown ? now : { shown: i, from: now.shown, turn: now.turn + 1 }));
  return (
    <div className="beat crew" data-beat="crew">
      <div className="crew-head">
        <h2>The people flying it.</h2>
        <div className="crew-tabs live-only" role="group" aria-label="Choose a year">
          {crews.map((crew, i) => (
            <button type="button" aria-pressed={i === view.shown} onClick={() => pick(i)} key={crew.year}>
              {crew.year}
            </button>
          ))}
        </div>
      </div>
      <ol className="crew-years">
        {crews.map((crew, i) => {
          const on = i === view.shown;
          // A fresh element for the year coming in, so its animation runs from the start even if it was only just leaving
          return <CrewYear crew={crew} on={on} leaving={i === view.from} from={on ? crews[view.from] : undefined} key={`${crew.year}:${on ? view.turn : 0}`} />;
        })}
      </ol>
    </div>
  );
}

// Inside a planet: what the department is about and who's in it, standing in that planet's own air. Without the show it's plain text in the chapter
function Planet({ world, index }: { world: { id: string; name: string; line: string; covers: string[]; leads: { name: string; role: string }[]; source?: { name: string; url: string } }; index: number }) {
  const { top, low, accent } = ATMOSPHERES[index];
  const everyone = world.leads.length > 8;
  return (
    <dialog className="planet" data-planet={index} aria-labelledby={`${world.id}-name`} style={{ "--top": top, "--low": low, "--accent": accent } as React.CSSProperties}>
      <form method="dialog" className="planet-back live-only">
        <button>Back to orbit</button>
      </form>
      <div className="planet-words">
        <h2 className="planet-name" id={`${world.id}-name`}>
          {world.name}
        </h2>
        <p className="planet-line">{world.line}</p>
        <div className={`planet-facts ${everyone ? "planet-facts-long" : ""}`}>
          <section>
            <h3>What it covers</h3>
            <ul>
              {world.covers.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>{world.source ? "Who leads here" : "Who’s here"}</h3>
            <ul>
              {world.leads.map((person) => (
                <li key={person.name}>
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                </li>
              ))}
            </ul>
          </section>
        </div>
        {world.source ? (
          <p className="planet-source">
            Based on how Cisco describes{" "}
            <a href={world.source.url} target="_blank" rel="noreferrer">
              {world.source.name}
            </a>
            .
          </p>
        ) : null}
      </div>
    </dialog>
  );
}

// The five departments that run the org, as little planets to pick from. The sky keeps each button on top of its planet
function Fleet() {
  return (
    <div className="beat fleet" data-beat="fleet">
      <div className="chapter">
        <h2>The crew behind the missions.</h2>
        <p data-rest>Five more departments keep the org flying. Pick a planet to land on it.</p>
      </div>
      <ul className="fleet-list">
        {offices.map((office, i) => (
          <li key={office.id}>
            <button type="button" className="fleet-planet live-only" data-land={FIRST_OFFICE + i} data-office={i} aria-label={`Land on the ${office.name}`}>
              <span>{office.name}</span>
            </button>
            <Planet world={office} index={FIRST_OFFICE + i} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// An answer appears a little at a time, like subtitles, and Axie's mouth moves for as long as it takes. A screen reader gets all of it at once
function Spoken({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    voice.talking = true;
    let count = 0;
    const timer = setInterval(() => {
      count += 2;
      setShown(count);
      if (count >= text.length) {
        clearInterval(timer);
        voice.talking = false;
      }
    }, 38);
    return () => {
      clearInterval(timer);
      voice.talking = false;
    };
  }, [text]);
  return (
    <>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}

const TOO_MANY = "That's a lot of questions at once! Give me a minute, then ask again.";

// Answers come from Gemini through app/api/axie, which holds the key and the guardrails. If that's out of reach, the keyword lookup in lib/content.ts stands in
function AxieChat() {
  const [messages, setMessages] = useState([{ from: "axie", text: AXIE_GREETING }]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, thinking]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    const earlier = messages.filter((message) => message.from === "you").map((message) => message.text);
    setMessages((all) => [...all, { from: "you", text: question }]);
    setDraft("");
    setThinking(true);
    let reply: string;
    try {
      const response = await fetch("/api/axie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, earlier }) });
      reply = response.ok ? (await response.json()).reply : response.status === 429 ? TOO_MANY : axieReply(question);
    } catch {
      reply = axieReply(question);
    }
    setThinking(false);
    setMessages((all) => [...all, { from: "axie", text: reply }]);
  };

  return (
    <div className="chat">
      <div className="chat-log" ref={log} role="log" aria-label="Conversation with Axie" aria-busy={thinking}>
        {messages.map((message, i) => (
          <p className={`chat-line chat-${message.from}`} key={i}>
            {i && message.from === "axie" ? <Spoken text={message.text} /> : message.text}
          </p>
        ))}
        {thinking ? <p className="chat-line chat-axie chat-thinking">Axie is thinking</p> : null}
      </div>
      <form
        className="chat-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input aria-label="Message Axie" placeholder="Say something to Axie" autoComplete="off" maxLength={200} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" disabled={!draft.trim() || thinking}>
          Send
        </button>
      </form>
      <div className="chat-suggest">
        {AXIE_SUGGESTIONS.map((suggestion) => (
          <button type="button" key={suggestion} disabled={thinking} onClick={() => ask(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <p className="chat-note">Axie only talks about Cisco NetConnect PUP - Manila, and can get things wrong.</p>
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
      </header>

      <main>
        <section id="story" style={{ "--story-height": `${(AT.end * SCREENS_PER_UNIT + 1) * 100}lvh` } as React.CSSProperties}>
          <div className="stage">
            <canvas ref={canvas} aria-hidden="true" />
            <div className="scrim" />
            <div className="cover" />
            <div className="veil" />
            <div className="atmos" />

            <div className="beat hero" data-beat="house" data-active>
              <h1 className="sr-only">Cisco NetConnect PUP - Manila</h1>
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
                    <strong>Axie&rsquo;s at headquarters.</strong> Scroll to walk them to the rocket.
                  </p>
                </div>
              </div>
            </div>

            <div className="beat world world-left" data-beat="liftoff">
              <div className="chapter">
                <h2>Three. Two. One.</h2>
                <p className="live-only" data-rest>
                  Keep scrolling and the rocket keeps flying. Stop, and Axie waits for you.
                </p>
              </div>
            </div>

            <div className="beat at-end" data-beat="signal">
              <span className="signal-pulse" />
              <span className="signal-pulse" />
              <span className="signal-pulse" />
              <div className="chapter">
                <h2>It started as a signal.</h2>
                <p data-rest>Cisco NetConnect PUP - Manila began with online initiatives: points of light, a long way apart.</p>
              </div>
            </div>

            <div className="beat at-bottom" data-beat="links">
              <div className="chapter">
                <h2>Then the points found each other.</h2>
                <p data-rest>&ldquo;Building Bridges, Powering Connections&rdquo; is what the launch was called.</p>
              </div>
            </div>

            {worlds.map((world, i) => (
              <div className={`beat world ${i % 2 ? "world-right" : "world-left"}`} data-beat={world.id} key={world.id}>
                <div className="chapter">
                  <h2>{world.name}</h2>
                  <p data-rest>{world.line}</p>
                  <button type="button" className="land live-only" data-land={i} data-rest>
                    Land on this planet
                  </button>
                </div>
                <Planet world={world} index={i} />
              </div>
            ))}

            <Fleet />

            <div className="beat log" data-beat="log">
              <h2>The flight log.</h2>
              <ol className="log-track">
                {events.map((event) => (
                  <LogStop event={event} key={event.title} />
                ))}
              </ol>
              <nav className="log-rail live-only" aria-label="Stops in the flight log">
                <ol>
                  {events.map((event, i) => (
                    <li className={event.confirmed ? "" : "log-pending"} key={event.title}>
                      <button type="button" data-stop={i}>
                        <span>{event.short}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>

            <Crew />

            <div className="beat world world-left" data-beat="home">
              <div className="chapter">
                <h2>Back on Earth.</h2>
                <p data-rest>Axie has been to every world on the map, and has plenty to tell you about them.</p>
              </div>
            </div>

            <div className="beat chat-beat" data-beat="chat">
              <h2>Now say hi.</h2>
              <AxieChat />
            </div>
          </div>
        </section>

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
