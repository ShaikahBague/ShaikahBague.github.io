export const LAUNCH_URL = "https://luma.com/2ntq5ce1";

// placeholder: the org has no sign-up form yet, swap this for the real join link
export const JOIN_URL = LAUNCH_URL;

export type Cue = { id: string; label: string; seat: string };

export const cues: Cue[] = [
  { id: "house", label: "On the pad", seat: "A1" },
  { id: "liftoff", label: "Liftoff", seat: "A2" },
  { id: "signal", label: "A signal", seat: "A3" },
  { id: "links", label: "The bridge", seat: "B1" },
  { id: "enterprise", label: "Enterprise Networking", seat: "B2" },
  { id: "cyberops", label: "Cybersecurity Operations", seat: "B3" },
  { id: "devnet", label: "Development Networking", seat: "C1" },
  { id: "log", label: "Flight log", seat: "C2" },
  { id: "crew", label: "The crew", seat: "C3" },
  { id: "home", label: "Back on Earth", seat: "D1" },
  { id: "chat", label: "Talk to Axie", seat: "D2" },
];

export const worlds = [
  {
    id: "enterprise",
    name: "Enterprise Networking",
    line: "How an organization's sites, devices and people stay connected: routing, switching and the networks underneath.",
  },
  {
    id: "cyberops",
    name: "Cybersecurity Operations",
    line: "Watching those networks, spotting what doesn't belong and responding when something gets in.",
  },
  {
    id: "devnet",
    name: "Development Networking",
    line: "Writing code that talks to the network: automation, APIs and the software around the wires.",
  },
];

// Add new stops here. `confirmed: false` prints the Unissued stamp, so nothing unverified reads as fact.
// Photos go in public/events/ (landscape 4:3 fits the print, keep each under about 300 KB), then set
// src to its path, like "/events/launch-group.jpg". An empty src shows a labelled slot. One photo or many.
export const events = [
  {
    when: "Before the launch",
    title: "Online initiatives",
    note: "The org started online, before it had a room to meet in.",
    photos: [{ src: "", alt: "A screenshot from an online session" }],
    confirmed: true,
  },
  {
    when: "The hard launch",
    title: "Building Bridges, Powering Connections",
    note: "White Cloak Technologies, Ortigas Center. Talks from industry experts, interactive sessions and networking.",
    went: 54,
    photos: [
      { src: "", alt: "The whole group at White Cloak" },
      { src: "", alt: "A talk from an industry expert" },
      { src: "", alt: "Students at an interactive session" },
    ],
    confirmed: true,
  },
  {
    when: "Date to confirm",
    title: "Co-organized cybersecurity event",
    note: "Name, date and partners to come from the org.",
    photos: [
      { src: "", alt: "The event itself" },
      { src: "", alt: "The organizers together" },
    ],
    confirmed: false,
  },
  {
    when: "Next stop",
    title: "Next event",
    note: "Date and venue to be announced.",
    photos: [{ src: "", alt: "Your photo could go here" }],
    confirmed: false,
  },
];

// Launch hosts are named on the launch page. Everyone else here waits on the org's roster.
export const crew = [
  { name: "David Gabriel", role: "Launch host", confirmed: true },
  { name: "Jhered Miguel C. Republica", role: "Launch host", confirmed: true },
  { name: "Mhyca Monterola", role: "Launch host", confirmed: true },
  { name: "Clarisse Jem Salazar", role: "Cybersecurity subject matter expert", confirmed: false },
  { name: "Name to come", role: "Enterprise Networking", confirmed: false },
  { name: "Name to come", role: "Development Networking", confirmed: false },
];

// placeholder: waits on the org, not a confirmed fact
export const unissued = [{ title: "Our mission", note: "Mission statement to come from the org." }];

export const AXIE_GREETING = "Hi, I'm Axie, and I just got back! Ask me about the departments, the events or how to join.";

export const AXIE_SUGGESTIONS = ["What are the departments?", "What events have you done?", "How do I join?"];

const NO_ANSWER = "I'm a placeholder for now, so I only know the basics. Try asking about the departments, the events or how to join.";

// placeholder: a keyword lookup until the real chatbot exists, swap this for the call to it
const AXIE_ANSWERS: [RegExp, string][] = [
  [/enterprise|routing|switching/, worlds[0].line],
  [/cyber|security/, worlds[1].line],
  [/develop|devnet|code|automation|api/, worlds[2].line],
  [/department|focus|what do you do/, `There are three: ${worlds.map((world) => world.name).join(", ")}. Ask me about any of them.`],
  [/event|launch|timeline/, "The hard launch was \"Building Bridges, Powering Connections\" at White Cloak Technologies in Ortigas Center, and 54 people went. The rest of the flight log is above."],
  [/join|member|sign/, "Sign-ups aren't open here yet. You can reach the team through the launch page, linked in the Join section below."],
  [/crew|officer|people|who/, "The launch hosts were David Gabriel, Jhered Miguel C. Republica and Mhyca Monterola. The full roster is still to come."],
  [/\b(hi|hello|hey|kumusta)\b/, "Hello! It's good to be back on Earth. What would you like to know?"],
];

export const axieReply = (message: string) => AXIE_ANSWERS.find(([words]) => words.test(message.toLowerCase()))?.[1] ?? NO_ANSWER;
