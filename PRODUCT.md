# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: PUP - Manila students curious about networking, cybersecurity, data analytics, and IoT, usually arriving on a phone from a social link or a campus mention, deciding whether this org is for them.

Secondary: mentors and partners checking whether the org is real and worth supporting. They get a small path, not the main story.

## Product Purpose

The main website of Cisco NetConnect PUP - Manila. It tells the org's story and gets a curious student to join. Success means a visitor finishes the story understanding what the org does and takes the join action.

## Positioning

A student community at PUP - Manila built around networking, cybersecurity, data analytics, IoT, and emerging technologies, which moved from online initiatives to on-ground engagements.

## Operating Context

Student org with a semester rhythm of events and talks. Visitors are often on mid-range phones and campus or mobile data, so weight and frame rate are real constraints.

## Capabilities and Constraints

- Stack in place: Next.js 16.4 App Router, React 19, Tailwind 4, TypeScript. `cacheComponents` is enabled.
- Requested by the user: GSAP-heavy scroll storytelling, and 3D assets that do not cause lag.
- 3D: the user chose generated hero models inside a coded scene. ForgeGUI 3D generation is locked on the current plan, so the hero models are hand-built in Three.js until that changes.
- Undecided: mission wording, officer roster, upcoming events, join link, social links, domain.

## Brand Commitments

- Name: "Cisco NetConnect PUP - Manila". The abbreviation CNCP is the user's own.
- Theme set by the user: galaxy/space, mostly purple, told as a story.
- Logo: `public/cncp-white.png`, a chrome-periwinkle neon mark with a cyan glow.
- Do not imply an official Cisco partnership or endorsement beyond the org's own name. No confirmation of one exists yet.

## Evidence on Hand

Confirmed from the public launch page (https://luma.com/2ntq5ce1):

- Launch event title: "Building Bridges, Powering Connections: Welcome to Cisco NetConnect PUP -Manila!"
- Described as the org's official hard launch, a transition "from online initiatives to on-ground engagements" and "a milestone in establishing a thriving Cisco-powered community at PUP - Manila."
- Brought together students passionate about networking, cybersecurity, data analytics, and IoT, with talks from industry experts, interactive sessions, and networking.
- Venue: White Cloak Technologies, Inc., Strata 2000, Ortigas Center, Pasig. 54 attended.

Absent, must not be fabricated: member counts, founding date, partners or sponsors, testimonials, speakers, officer roles, mission statement. Use clearly marked placeholders until the org supplies them.

## Product Principles

1. The story earns the join: each chapter moves a curious student closer to acting.
2. True before impressive: only confirmed facts stated as facts, everything else visibly a placeholder.
3. A mid-range phone on mobile data gets the full story, smoothly.
4. Content works without the spectacle: readable with reduced motion or without WebGL.

## Accessibility & Inclusion

WCAG AA contrast, keyboard reachable actions, full `prefers-reduced-motion` support. No required standard beyond that was established.
