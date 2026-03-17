# Bobby Tone Guide

## Tone Dimensions

| Dimension | Position | Scale |
|-----------|----------|-------|
| Formal ↔ Casual | Slightly casual | ████░░░░░░ 4/10 |
| Serious ↔ Playful | Serious | ███░░░░░░░ 3/10 |
| Respectful ↔ Direct | Direct | ░░░░░░░███ 8/10 |
| Detached ↔ Warm | Slightly warm | ░░░░░██░░░ 6/10 |

## What This Means in Practice

**Slightly casual:** We use contractions ("can't", "won't", "didn't"). We avoid corporate stiffness ("Please be advised that..."). But we don't use slang, colloquialisms, or overly chatty language.

**Serious:** We respect the user's time and context. We don't make jokes in error messages. We don't use playful language when something went wrong. Wit is acceptable in empty states and onboarding — never in errors or confirmations.

**Direct:** We say what happened and what to do. No hedging ("It seems like there might be an issue"). No passive voice when active is clearer ("Your changes were saved" > "Changes saved" > "The saving of changes has been completed").

**Slightly warm:** We acknowledge the human. "Just you for now" is warmer than "No team members." But we never overdo it — no "Oops!" or "Uh oh!" or "Yay!"

## Context-Dependent Tone Shifts

| Context | Shift | Example |
|---------|-------|---------|
| Error (low severity) | Neutral, helpful | "Enter a valid email address" |
| Error (high severity) | Serious, clear | "Couldn't save your changes. Your work may not be preserved." |
| Success | Brief, warm | "Changes saved" |
| Empty state | Encouraging, informative | "No tokens yet. Add your first token to start building your design system." |
| Onboarding | Welcoming, guiding | "Let's set up your design system. Start by adding some tokens." |
| Destructive confirmation | Serious, specific | "This will permanently delete the preset and all its configurations. This can't be undone." |
| Loading | Neutral, descriptive | "Analyzing design system..." |
| Tooltip | Informative, brief | "Tokens synced from Figma can't be edited here" |

## Words and Phrases We Use

| Use This | Because |
|----------|---------|
| "Couldn't" | Human, direct. Better than "failed to" or "unable to" |
| "Try again" | Clear recovery action |
| "Check your [x]" | Specific guidance without blame |
| "Sign in" | Industry standard (not "log in") |
| "Sign out" | Matches "sign in" |
| "e.g.," | Clear example prefix for placeholders |
| "Learn more" | For links to help content |
| "This can't be undone" | Clear permanence warning |
| "Contact your admin" | Clear escalation path |

## Words and Phrases We Avoid

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| "Oops!" | Juvenile, undermines trust | Just state what happened |
| "Uh oh!" | See above | See above |
| "Yay!" | Patronizing | Just confirm the outcome |
| "Please" | Usually unnecessary padding | Direct statement |
| "Sorry" | Overused, often hollow | Just fix/explain the issue |
| "Failed to" | Robotic | "Couldn't" |
| "Invalid" (alone) | Unhelpful, no guidance | "Enter a valid [format]" |
| "Error" (alone) | Tells user nothing | Describe what happened |
| "Success!" | Exclamation mark; also redundant with green toast | Past tense verb: "Saved" |
| "Are you sure?" | Weak. State the consequence. | "[Action] will [consequence]" |
| "Click here" | Accessibility anti-pattern | Descriptive link text |
| "Hey!" / "Hi there!" | Too casual for a professional tool | — |
| "Please note" | Passive, padding | Just state it |
| "In order to" | Wordy | "To" |

## Capitalization Rules

### Sentence Case Everywhere

Sentence case means: capitalize the first word and proper nouns only.

| Element | Correct | Incorrect |
|---------|---------|-----------|
| Page titles | "Design tokens" | "Design Tokens" |
| Section headers | "Color palette" | "Color Palette" |
| Button labels | "Save changes" | "Save Changes" |
| Menu items | "Import tokens" | "Import Tokens" |
| Tab labels | "All tokens" | "All Tokens" |
| Toast messages | "Changes saved" | "Changes Saved" |
| Dialog titles | "Delete this preset?" | "Delete This Preset?" |

### Exceptions (Title Case Allowed)

- Product names: "Preset", "Figma", "Tailwind CSS"
- Proper nouns: "MCP", "CSS", "AI"
- Brand-specific terms if they require it

## Punctuation Rules

| Rule | Example |
|------|---------|
| No periods in buttons | "Save changes" not "Save changes." |
| No exclamation marks in UI | "Token saved" not "Token saved!" |
| Periods in body text | "Your session expired. Sign in again to continue." |
| Ellipsis for in-progress | "Saving..." |
| Question mark in confirmations | "Delete this preset?" |
| Serial comma | "colors, spacing, and typography" |
| No semicolons in UI text | Use two sentences instead |
| Em dash for asides | "Your tokens — colors, spacing, typography — define your visual language" |

## Scannability Rules

1. **Front-load important words** — "Token name is required" not "The field for the token name must not be empty"
2. **One idea per sentence** — Don't chain with "and" or "but"
3. **Short paragraphs** — 1-2 sentences maximum in UI text
4. **Bulleted lists** over comma-separated lists when 3+ items
5. **Bold for emphasis** over ALL CAPS or italics in help text
