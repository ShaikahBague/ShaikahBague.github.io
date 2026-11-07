export const LAUNCH_URL = "https://luma.com/2ntq5ce1";

// placeholder: the org has no sign-up form yet, swap this for the real join link
export const JOIN_URL = LAUNCH_URL;

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

// Each event flies past on its own asteroid. Add new ones here. `confirmed: false` prints the Unissued stamp, so nothing
// unverified reads as fact. Photos go in public/events/ (landscape 4:3 fits the print, keep each under about 300 KB), then
// set src to its path, like "/events/launch-group.jpg". An empty src shows a labelled slot. One photo or many.
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

// Each year's officers form that year's constellation in the crew chapter, newest year first. Add or swap people here and the
// stars lay themselves out. A new year goes at the top and fits itself into the chapter.
// placeholder: the launch page names the hosts but not which year anyone served, so the 2026 list is the old roster until the org
// supplies the real ones. `confirmed: false` on a year prints the "Roster to confirm" stamp; set it true once a list is right
export const crews = [
  {
    year: 2026,
    confirmed: false,
    officers: [
      { name: "David Gabriel", role: "Launch host", confirmed: true },
      { name: "Jhered Miguel C. Republica", role: "Launch host", confirmed: true },
      { name: "Mhyca Monterola", role: "Launch host", confirmed: true },
      { name: "Clarisse Jem Salazar", role: "Cybersecurity subject matter expert", confirmed: false },
      { name: "Name to come", role: "Enterprise Networking", confirmed: false },
      { name: "Name to come", role: "Development Networking", confirmed: false },
    ],
  },
  {
    year: 2025,
    confirmed: false,
    officers: [
      { name: "Name to come", role: "Officer", confirmed: false },
      { name: "Name to come", role: "Officer", confirmed: false },
      { name: "Name to come", role: "Officer", confirmed: false },
      { name: "Name to come", role: "Officer", confirmed: false },
    ],
  },
  {
    year: 2024,
    confirmed: false,
    officers: [
      { name: "Name to come", role: "Officer", confirmed: false },
      { name: "Name to come", role: "Officer", confirmed: false },
      { name: "Name to come", role: "Officer", confirmed: false },
    ],
  },
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
