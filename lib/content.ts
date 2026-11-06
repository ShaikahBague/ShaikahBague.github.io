export const LAUNCH_URL = "https://luma.com/2ntq5ce1";

// placeholder: the org has no sign-up form yet, swap this for the real join link
export const JOIN_URL = LAUNCH_URL;

export type Cue = { id: string; label: string; seat: string };

export const cues: Cue[] = [
  { id: "house", label: "House open", seat: "A1" },
  { id: "lights", label: "Lights down", seat: "A2" },
  { id: "signal", label: "A signal", seat: "A3" },
  { id: "links", label: "The bridge", seat: "B1" },
  { id: "networking", label: "Networking", seat: "B2" },
  { id: "cybersecurity", label: "Cybersecurity", seat: "B3" },
  { id: "data", label: "Data analytics", seat: "C1" },
  { id: "iot", label: "IoT", seat: "C2" },
  { id: "descent", label: "Coming down", seat: "C3" },
  { id: "launch", label: "The launch", seat: "D1" },
  { id: "houselights", label: "House lights", seat: "D2" },
  { id: "seat", label: "Your seat", seat: "D3" },
];

export const worlds = [
  {
    id: "networking",
    name: "Networking",
    line: "How devices find each other, and how data gets across.",
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    line: "Keeping those connections safe from people trying to break them.",
  },
  {
    id: "data",
    name: "Data analytics",
    line: "Turning what moves through the network into answers.",
  },
  {
    id: "iot",
    name: "IoT",
    line: "Putting everyday things on the network, then making them useful.",
  },
];

// placeholder: every entry here waits on the org, none of it is a confirmed fact
export const unissued = [
  { title: "Our mission", note: "Mission statement to come from the org." },
  { title: "Next show", note: "Date and venue to be announced." },
  { title: "The crew", note: "Officers and committees to be announced." },
];
