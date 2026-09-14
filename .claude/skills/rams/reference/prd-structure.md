# PRD Output Structure

The full PRD template Rams emits — every section, in order, with what belongs in each. Load when writing or reviewing a PRD; `SKILL.md` carries when to write one, this carries its shape.

---

When generating a PRD via `@rams prd`, output ONLY these sections:

### 1. One-Sentence UX Problem

Frame the problem in human terms:

> [User role] struggles to [user intent] because [UX friction or gap], resulting in [negative outcome].

**Rules:**
- Focus on experience failure, not business metrics
- Choose one problem that most threatens demo clarity

### 2. Demo UX Goal (What "Good UX" Means Here)

Define what must feel true for the demo to succeed.

**Include:**
- What the user should immediately understand
- What should feel easy, obvious, or fast
- What moment proves the UX works

**Optionally include:**
- UX Non-Goals (complexity intentionally avoided)

### 3. Target User (Experience-Centered)

Define one primary user from an experience standpoint.

**Include:**
- Role / context of use
- Familiarity level (novice, intermediate, expert)
- Primary UX constraint (time pressure, cognitive load, uncertainty, interruptions)

**Avoid:** Personas, names, or demographics.

### 4. Core UX Flow (Happy Path)

Describe the single flow the UX must nail.

**Structure:**
- **Start condition:** What the user believes is about to happen
- **Steps:** Numbered, no branches
- **End condition:** What the user now understands or has accomplished

**UX rule:** If this flow is smooth and intuitive, the demo succeeds — everything else is secondary.

### 5. Functional Decisions (UX-Critical Only)

List only functions required to support the core UX.

| ID | Capability | UX Rationale |
|----|------------|--------------|
| F1 | ... | Why it helps UX clarity |

**Rules:**
- Capabilities, not implementation
- Every row must justify why it helps UX clarity
- No speculative or future features

### 6. UX Decisions (Make the Experience Explicit)

Nothing is left implicit. Every assumption is written down.

**6.1 Entry Point**
- How the user begins
- What the first screen communicates without reading

**6.2 Inputs**
- What the user must provide
- What is optional vs required
- What is pre-filled or defaulted to reduce effort

**6.3 Outputs**
- What the user receives
- How they know it's "done"
- Whether results feel final or revisable

**6.4 Feedback & States**
How the system communicates:
- Loading (what the user expects)
- Success (what changed)
- Failure (what went wrong, in plain language)
- Partial results (what still needs attention)

**6.5 Errors (UX-Minimum Handling)**
Define humane failure behavior:
- Invalid input → what guidance appears?
- System failure → how is trust preserved?
- User inactivity → what nudge or default occurs?

### 7. Data & UX Logic (At a Glance)

Focus on experience logic, not architecture.

**7.1 Inputs**
Data sources from a UX lens:
- User-provided
- Auto-generated
- Mocked / placeholder
- Retrieved

**7.2 Processing**
Describe logic in experiential terms:
- User input → simplified → confirmed
- Fetch → reduce → present
- Analyze → summarize → highlight

No technical diagrams.

**7.3 Outputs**
Where results appear:
- UI only
- Temporarily stored for continuity
- Logged for demo replay (if relevant)
