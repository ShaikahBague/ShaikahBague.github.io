# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: PUP - Manila students curious about enterprise networking, cybersecurity operations, and development networking, usually arriving on a phone from a social link or a campus mention, deciding whether this org is for them.

Secondary: mentors and partners checking whether the org is real and worth supporting. They get a small path, not the main story.

## Product Purpose

The main website of Cisco NetConnect PUP - Manila. It tells the org's story and gets a curious student to join. Success means a visitor finishes the story understanding what the org does and takes the join action.

## Positioning

A student community at PUP - Manila built around three departments: Enterprise Networking, Cybersecurity Operations, and Development Networking. It moved from online initiatives to on-ground engagements.

## Operating Context

Student org with a semester rhythm of events and talks. Visitors are often on mid-range phones and campus or mobile data, so weight and frame rate are real constraints.

## Capabilities and Constraints

- Stack in place: Next.js 16.4 App Router, React 19, Tailwind 4, TypeScript. `cacheComponents` is enabled.
- Requested by the user: GSAP-heavy scroll storytelling, and 3D assets that do not cause lag.
- 3D: the user wants the rocket generated with ForgeGUI, but its 3D generation is locked on the current plan (`paid_generation_required`), so the rocket is hand-built in Three.js until that changes. Axie is the org's rigged mascot: `public/axie-new.glb` is the source and what bigger screens load, because the lighter `public/axie-flight.glb` copy that smaller screens get goes soft up close.
- Story: Axie starts at headquarters, with the org's logo on the roof and a gold Golden Gate Bridge behind it for last term's "Building Bridges" theme, walks into the rocket, visits the three department worlds and the flight log's asteroids, lands back at headquarters in the dark, walks out of the door's light to the camera and becomes a chatbot, standing centre stage and talking in subtitles under them. Visitors can land on any department's planet from its chapter: each has its own coloured atmosphere and landscape, what the department covers and who leads it, with Axie floating in zero gravity in a hand-built astronaut suit (`components/astronaut.ts`). Chapter words stand straight on the scene with no boxes. The chatbot is a placeholder: `axieReply` in `lib/content.ts` is a keyword lookup until the real one exists, and the panel says so.
- Earth scene: everything on the campus is painted once at load and merged or instanced, with its motion in the shaders, so detail costs triangles rather than draw calls (`components/campus.ts`). Measure real frame rates with the tab in front, since a background window is throttled to about one frame a second.
- Undecided: mission wording, the dates, descriptions and photos of the events still marked as placeholders, upcoming events, join link, social links, domain. The crew chapter opens on the newest year's constellation with a tab for each other year, using the officer rosters for 2024 to 2026 supplied by the user. Departments, events, photos and people live in `lib/org.json`, and the constellation lays itself out for any head count. A department's `leads` are who its planet lists; each department's `line` and `covers` follow Cisco's own description of the matching certification (CCNP Enterprise, CCNA Cybersecurity, formerly CyberOps Associate, and CCNA Automation, formerly DevNet Associate), and the planet names and links that source; `confirmed: false` prints the Unissued stamp, and an empty photo `src` shows a labelled slot.

## Brand Commitments

- Name: "Cisco NetConnect PUP - Manila". The abbreviation CNCP is the user's own.
- Theme set by the user: galaxy/space, mostly purple, told as a story. The scenes on Earth are the exception: the user wants a blue daytime sky there, turning purple only on the climb to space.
- Logo: `public/cncp-white.png`, a chrome-periwinkle neon mark with a cyan glow.
- Do not imply an official Cisco partnership or endorsement beyond the org's own name. No confirmation of one exists yet.

## Evidence on Hand

Confirmed from the public launch page (https://luma.com/2ntq5ce1):

- Launch event title: "Building Bridges, Powering Connections: Welcome to Cisco NetConnect PUP -Manila!"
- Described as the org's official hard launch, a transition "from online initiatives to on-ground engagements" and "a milestone in establishing a thriving Cisco-powered community at PUP - Manila."
- Brought together students with talks from industry experts, interactive sessions, and networking.
- Hosts named on the page, with no roles given: Jhered Miguel C. Republica, Mhyca Monterola, David Gabriel.
- Venue: White Cloak Technologies, Inc., Strata 2000, Ortigas Center, Pasig. 54 attended.

Departments come from the user, not the launch page, whose older wording named data analytics and IoT.

From the user and the org's own photos in `public/images/`: Stellaris Ascensus, the 2026 General Onboarding, at White Cloak Technologies on September 28, 2026 (the date is printed on the recap posts); the Packet Capture CTF: Beneath the Network with CyberPH (filed under October in `public/images/`, and placed before ECEGA by the user), The Schematic Sandbox at ECEGA 2026, and the Enterprise and Development Networking onboardings, all October 2026 with no exact day given. The flight log lists only events with photos: the user removed the placeholder stops, so the launch's 54 attendees are now only told by Axie. The call sizes (101 and 49) are what the Google Meet screenshots showed at that moment. The photos in `public/events/` are crops of these, with the post frames removed and the meeting codes and a chat message masked.

Absent, must not be fabricated: member counts, founding date, other event dates, partners or sponsors, testimonials, speakers' names, mission statement. Use clearly marked placeholders until the org supplies them.

## Product Principles

1. The story earns the join: each chapter moves a curious student closer to acting.
2. True before impressive: only confirmed facts stated as facts, everything else visibly a placeholder.
3. A mid-range phone on mobile data gets the full story, smoothly.
4. Content works without the spectacle: readable without WebGL or if the show fails to load.

## Accessibility & Inclusion

WCAG AA contrast and keyboard reachable actions. The user chose to run the show for every visitor by default, including those whose device asks for reduced motion. The scroll never snaps, and the camera has a capped speed, because fast moves made the user dizzy; jumps between chapters dip through black rather than flying there. No required standard beyond that was established.
