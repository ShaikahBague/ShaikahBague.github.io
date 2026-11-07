import org from "./org.json" with { type: "json" };

export const LAUNCH_URL = "https://luma.com/2ntq5ce1";

// placeholder: the org has no sign-up form yet, swap this for the real join link
export const JOIN_URL = LAUNCH_URL;

// Each department is a planet, and its `leads` in org.json are who that planet lists. What a department covers follows Cisco's own
// description of the matching certification, named and linked as its source on the planet
export const worlds = org.departments;

// The departments that run the org itself, each a little planet of its own. They land the same way, and their `leads` are everyone in the department
export const offices = org.offices;

// Events and people live in org.json. Each event flies past on its own asteroid, in the file's order. `confirmed: false` prints
// the Unissued stamp, so nothing unverified reads as fact. Photos go in public/events/ (landscape 16:9 fits the print, keep each
// under about 300 KB), then set src to its path, like "/events/launch-group.jpg". An empty src shows a labelled slot. One photo or many.
// A photo's alt is also printed as its caption. `short` is the stop's name on the flight path along the bottom of the chapter.
export const events = org.events;

// Each year's officers form that year's constellation in the crew chapter, and the newest year is the one that opens. Add a person
// to a year in org.json and they get a star, or add a year and it gets a tab. The layout makes room either way. The first listed is the
// brightest star. `confirmed: false` on a year prints the "Roster to confirm" stamp, and on an officer sets their name in italics
export const crews = [...org.crews].sort((a, b) => b.year - a.year);

// placeholder: waits on the org, not a confirmed fact
export const unissued = [{ title: "Our mission", note: "Mission statement to come from the org." }];

export const AXIE_GREETING = "Hi, I'm Axie, and I just got back! Ask me about the departments, the events or how to join.";

export const AXIE_SUGGESTIONS = ["What are the departments?", "What events have you done?", "How do I join?"];

const NO_ANSWER = "My link to mission control dropped, so I only know the basics right now. Try asking about the departments, the events or how to join.";

// What Axie falls back on when the Gemini route in app/api/axie can't be reached: a keyword lookup, so the chat still works offline
const AXIE_ANSWERS: [RegExp, string][] = [
  [/enterprise|routing|switching/, worlds[0].line],
  [/cyber|security/, worlds[1].line],
  [/develop|devnet|code|automation|api/, worlds[2].line],
  ...offices.map((office): [RegExp, string] => [new RegExp(office.id.slice(0, 6)), office.line]),
  [/department|focus|what do you do/, `There are eight: ${[...worlds, ...offices].map((world) => world.name).join(", ")}. Ask me about any of them.`],
  [/event|launch|timeline/, "The hard launch was \"Building Bridges, Powering Connections\" at White Cloak Technologies in Ortigas Center, and 54 people went. The flight log above has what came after: Stellaris Ascensus, our 2026 general onboarding, the Packet Capture CTF with CyberPH, The Schematic Sandbox at ECEGA 2026 and the Enterprise and Development Networking onboardings."],
  [/join|member|sign/, "Sign-ups aren't open here yet. You can reach the team through the launch page, linked in the Join section below."],
  [/crew|officer|people|who/, "The launch hosts were David Gabriel, Jhered Miguel C. Republica and Mhyca Monterola. Every year's officers are in the constellations above, and each planet lists who leads it."],
  [/\b(hi|hello|hey|kumusta)\b/, "Hello! It's good to be back on Earth. What would you like to know?"],
];

export const axieReply = (message: string) => AXIE_ANSWERS.find(([words]) => words.test(message.toLowerCase()))?.[1] ?? NO_ANSWER;
