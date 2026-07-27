# Onboarding implementation handoff

Use this only after the Personal Forecast V3 branch is committed and available remotely.

## Source files

- `docs/ONBOARDING_V1_MASTER_SPEC.md`
- `docs/ONBOARDING_V1_COPY_RU_EN_ES.json`
- `docs/ACTIVE_DECISIONS_ONBOARDING_V1.md`
- `docs/PARALLEL_PRELAUNCH_WORKSTREAMS.md`

`ACTIVE_DECISIONS_ONBOARDING_V1.md` overrides all earlier visual experiments. The onboarding visual direction is currently not fixed.

## Integration sequence

1. Rebase the onboarding branch onto the finished Forecast V3 branch.
2. Audit the final route/view names; do not restore removed legacy screens.
3. Implement onboarding as a versioned state machine, not scattered booleans.
4. Keep Personal and Zodiac paths inside one flow.
5. Wire Personal success to the final Today feed route and section registry.
6. Wire Zodiac success to the existing Zodiac reader without creating a duplicate reader.
7. Keep the visual layer swappable and use neutral placeholders until the current visual direction is separately approved.
8. Keep all copy in RU / EN / ES localization files.
9. Add legal URLs through environment/config, never hardcoded provisional domains.
10. Add analytics without raw birth data, name or place text.

## Required state model

```ts
type OnboardingPath = 'personal' | 'zodiac' | null;

type OnboardingStep =
  | 'welcome'
  | 'product'
  | 'path'
  | 'birth_data'
  | 'zodiac_select'
  | 'calculation';

interface OnboardingStateV1 {
  version: 1;
  step: OnboardingStep;
  path: OnboardingPath;
  selectedZodiacSign?: string;
  draftBirthData?: {
    date?: string;
    time?: string;
    timeKnown?: boolean;
    placeId?: string;
    placeLabel?: string;
  };
  completed: boolean;
}
```

Do not persist raw birth data into analytics or logs. Draft persistence must use the same secure/local conventions already used by the app.

## Important behaviour

- Skip on screens 1–2 goes to the path screen.
- Android Back returns one onboarding step and preserves valid fields.
- Closing/restarting restores the last valid step.
- Zodiac users are complete users; do not show a permanent incomplete-profile warning.
- Birth time must never silently default to noon or midnight.
- Unknown-time mode is shown only if the calculation layer supports it honestly.
- Calculation progress uses actual states and opens available content on partial success.
- No paywall before the first useful content experience.
- Do not implement, generate or lock onboarding visuals from archived design documents.

## Tests

- fresh install → Personal → valid data → Today;
- fresh install → Zodiac → selected sign reader;
- skip from screen 1 and screen 2;
- Back from path and data steps;
- restart on every step;
- unknown birth time supported/unsupported modes;
- invalid place and slow lookup;
- calculation partial failure and total retry;
- existing user never sees onboarding;
- onboarding version upgrade does not erase profile;
- RU / EN / ES long strings on small screen;
- reduced motion and screen reader order;
- analytics payload contains no raw personal data.
