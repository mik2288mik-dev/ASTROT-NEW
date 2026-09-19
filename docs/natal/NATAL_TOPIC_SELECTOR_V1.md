# NEBO Natal Topic Selector v1

Date: 2026-09-18

## Product rule

Do not balance positive and negative language artificially.

The system must choose the correct theme from the correct calculated facts and must not let one theme leak into neighbouring chapters.

Negative themes are allowed only when:
1. the user explicitly opened a narrow negative question (for example irritation, criticism, conflict, risk), or
2. a directly relevant factor is strong enough that omitting it would make the requested topic materially inaccurate.

The same rule applies to positive themes: do not add warmth, talent, affection, ease, or success unless the selected evidence supports it.

## Stable layers that stay unchanged

- Swiss Ephemeris calculation.
- Tropical / geocentric calculation policy.
- Birth-time reliability policy for exact / approximate / range / unknown.
- Placidus -> Whole Sign fallback.
- Canonical natal snapshot and persistence.
- Existing public API response shapes.
- Evidence IDs and the deterministic "Why?" sheet.
- Premium access checks.
- Existing cache storage contract.
- Released Android / RuStore wire compatibility.

## New interpretation path

calculated chart
-> reliability filter
-> topic routing
-> topic-specific evidence scoring
-> compact evidence set
-> Luna writer
-> evidence / voice / reliability validator
-> existing cache and API contract

## Topic routing

Broad chapters:
- main
- character
- love
- communication
- work
- money

Narrow topics:
- first_impression
- inner
- decisions
- strengths
- change
- boredom
- closeness
- autonomy
- irritation
- conflict
- criticism
- misunderstood
- turnoffs
- risk
- authority
- deadlines

Broad chapters do not inherit conflict, pressure, control, misunderstanding, criticism, or risk from another topic.

## Evidence scoring

The selector scores facts by:
1. reliability (unreliable facts are removed before selection);
2. direct relevance to the current topic;
3. aspect exactness / orb;
4. importance of the participating objects for the current topic;
5. diversity, so the same body does not fill the whole evidence set.

A secondary body may refine a topic but cannot create the topic by itself.

Example:
- Saturn-Pluto cannot create a Love conclusion merely because Saturn is sometimes relevant to relationships.
- Mars-Saturn cannot create a Communication conclusion merely because Mars is sometimes relevant to speech or arguments.
- A direct Mercury-Mars aspect may be considered for an explicit conflict / argument question.

## Hard aspects

Square and opposition are not globally classified as "bad".

They do not automatically mean:
- pressure;
- conflict;
- control;
- irritation;
- fear;
- difficulty.

For broad chapters they compete with other relevant factors on topic relevance and exactness.

Explicit conflict-like topics may prefer a directly relevant hard aspect.

## Fallback

Fallback is topic-specific.

There is no global fixed sequence such as Sun -> Mercury -> Mars for every person.

If a specialised aspect is absent, the selector falls back only to basic placements / houses / angles that belong to the requested topic.

## Luna role

Luna is a writer, not the astrology selector.

Luna receives a compact evidence set and the requested topic.

The writer must not import another theme from the full chart.

Broad chapter copy must not manufacture a problem to create contrast.

## Catalog chapters

The main chapter narrative no longer derives its evidence from the union of all hidden question plans.

Each chapter selects evidence directly for its own topic.

Narrow catalog answers still exist for compatibility and user exploration, but their negative wording does not contaminate broad chapter evidence.

## Permanent / classic reader

Legacy domain keys stay for public contract compatibility.

Their evidence selection becomes narrower:
- communication is anchored in Mercury;
- conflict requires a direct Mercury-Mars hard aspect;
- autonomy/control legacy slot requires a directly relevant autonomy aspect;
- misunderstood requires a direct Mercury-Neptune or Mercury-Uranus aspect;
- central_contradictions uses one strongest relevant hard aspect instead of all hard aspects;
- relationships no longer require the control/freedom slot;
- broad chapter prompts no longer force pressure, bosses, deadlines, conflict, or a mandatory "but".

## Q&A

Question
-> infer requested topic
-> select up to 6 topic-relevant stable evidence facts
-> include only matching permanent-report paragraphs
-> Luna answer
-> validate only against the selected evidence IDs.

The full chart is not exposed to the Q&A writer.

## Length / installed client compatibility

Released clients currently require existing schemas and some minimum narrative lengths.

Do not break those contracts in this refactor.

When the selected evidence contains fewer independent ideas than the installed reader requires paragraphs:
- deepen a supported idea through a genuinely different condition;
- do not invent a new trait;
- do not add a negative counterpoint merely to fill space.

## Validation

Existing safety and reliability validation remains.

New semantic boundary:
- model evidence IDs must belong to the current topic selector output;
- broad chapters cannot cite facts outside their selected compact evidence set;
- Q&A can cite only its selected question evidence.

## Golden-set acceptance rules

Synthetic / test cases must cover:
- strong Venus-Moon without unrelated conflict leaking into Love;
- strong Mercury-Mars appearing in explicit arguments but not automatically in Love;
- tight Saturn-Pluto not creating broad Character / Love conclusions by itself;
- exact, approximate, and unknown birth time;
- charts dominated by harmonious aspects;
- charts dominated by hard aspects;
- different topics selecting different evidence from the same chart.

For every test:
- selected evidence is deterministic;
- unrelated topic evidence is excluded;
- hard aspects are not globally negative;
- unknown-time houses / angles stay excluded;
- output API schemas remain unchanged.

## Rollout safety

1. Work only on an isolated branch.
2. Run full CI: tests, TypeScript, web build, all Android channel builds.
3. Do not merge to main until review.
4. Do not deploy backend until explicit approval.
5. After merge, production backend changes affect already-installed RuStore clients immediately, because they call the server APIs.
6. Therefore public API schemas and legacy wire behaviour must remain compatible before deploy.
