# Montemar Matchday — Design System

## Direction

Modern athletic editorial: a private club noticeboard, not a generic SaaS admin panel. The interface combines field-side utility with the clarity of a match programme. The mobile layout is the primary experience because most visits start from WhatsApp.

## Visual language

- Canvas `#101310`; panels `#141814` and `#171b17`; quiet borders `#2a3029`.
- Turf accent `#b8f45c`; neutral paper `#f0f1e8`; secondary text `#888f85`.
- Position signals: GK amber, DEF sky, MID emerald, FWD rose.
- Payment signals: paid emerald, awaiting verification amber, unpaid neutral.
- Editorial Georgia display headlines paired with compact, neutral sans-serif utility text. Use large titles sparingly and tabular numerals for scores and ratings.
- Pitch lines, roster numbering, field-green panels, and understated result cards provide the sport identity. No purple gradients, generic dashboard charts, or unstyled data tables.

## Interaction and responsive rules

- Mobile-first roster and player cards; keep filters and actions at least 44px high.
- Use clear hover and pressed states, visible `:focus-visible` rings, semantic labels, and high-contrast status colors.
- Respect `prefers-reduced-motion`; transitions are short, functional, and do not move page content.
- Keep data panels dimensionally stable. The server renders the initial dashboard payload; the client refreshes in place and retains the last good payload on errors.
- Use a native dialog for player details, with backdrop dismissal and a dedicated close control.
- Empty, loading/refreshing, connection-error, and cancelled-match states are explicit. Never substitute fabricated player or match data.

## Verification checklist

- [x] Responsive layouts at narrow phone, tablet, and desktop widths.
- [x] Keyboard-visible focus styling on links, buttons, selectors, and form inputs.
- [x] Minimum 44px touch targets for principal navigation and interactive controls.
- [x] Reduced-motion preference is honored.
- [x] The dashboard renders useful empty and upstream-error states.
- [x] A stable skeleton state is shown while the first data request is retried.
- [x] Refresh is optimistic in presentation (keeps last good data), with explicit busy and error states.
- [ ] Run a real-browser CLS audit after the first Vercel preview deployment; no hosted preview credentials are available in local development.
