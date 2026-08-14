# Security Handoff — Dex → Bruce

The canonical protocol. `skills/dex/SKILL.md` and `skills/bruce/SKILL.md` both point
here; neither restates these rules. Design rationale lives in
`docs/superpowers/specs/2026-08-07-dex-bruce-security-handoff-design.md`.

Load when `@dex commit` reaches the security-handoff step, or when `@bruce` is
invoked as part of a commit gate.

---

## 0. What this does not touch

**This adds a semantic judgment step. It removes no deterministic check.**

Secret and credential scanning, build and type checks, and test runs remain **direct
Dex gates**, evaluated unconditionally and independently of Bruce. A committed
credential is blocking because it is a credential — never because an expert loaded
successfully and reached that conclusion.

If Bruce is unavailable, mis-triggered, or returns indeterminate, those checks are
**entirely unaffected**. Never present them as a substitute for the handoff.

**There is no acceptance path for a deterministic gate.** §5 accepts a *finding*; §6
accepts an *absence of review*. Neither clears a committed credential, a failing
build, or a failing test — those are cleared by changing the code, and by nothing
else. This is intentional: a control that can be waived by asserting it does not
matter is not deterministic.

---

## 1. Trigger

Evaluate **both changed paths and diff content**. Path-only matching misses
authorization logic and input boundaries in generically named files.

| Class | Path signals | Diff-content signals |
|---|---|---|
| Authorization | `auth`, `authz`, `policy`, `permission`, `role`, `guard`, `middleware` | permission/role checks, `can*`/`is*Allowed`, policy predicates, session or claim reads |
| Credentials | `.env*`, `secrets`, `credentials`, key/cert paths | key/token/password identifiers, credential construction, signing, header injection |
| Untrusted input | route/handler/controller/api paths | new or changed request parsing, deserialization, query construction, template interpolation, file path assembly |
| Tenant scoping | `rls`, `tenant`, `org`, migrations | row-scoping predicates, `organization_id`/`tenant_id` filters, RLS policy statements, service-role client construction |
| Dependencies | `package.json`, lockfiles, `requirements*`, `go.mod` | added or upgraded dependencies, changed registry or source |
| CI / release | `.github/workflows`, deploy and release config | changes to secret plumbing, permissions blocks, publish or deploy steps |

**If you cannot determine whether a change matches, trigger Bruce.** Loading an
expert unnecessarily costs a triage pass. Silently skipping the gate costs the gate.

Every project uses this list. There is no per-project sensitivity.

---

## 2. Fingerprint first — on every run, including non-triggering ones

### 2.1 What the fingerprint *is*

**A diff has two ends, and the record pins both.**

```sh
git write-tree                                  # tree    — the staged content
git rev-parse HEAD          # or ROOT if unborn # head    — what it is a diff against
cat "$(git rev-parse --git-dir)/MERGE_HEAD"     # parents — when merging
```

The staged tree alone is not the fingerprint, and treating it as one leaves a hole:
`git reset --soft <other-commit>` moves HEAD while leaving the index untouched, so the
tree still matches while the diff Bruce reviewed — tree *against a base* — is a
different diff entirely. Same content, different change.

The tree is still the right content half: it is the identity of the whole index,
including paths the handoff never looked at, so a staged binary, a mode change or a
deletion moves it where a diff-text hash would not.

Recorded to `.git/security-handoff.review` on every run:

```text
tree=<oid>
head=<oid|ROOT>
parents=<oid,oid>     # empty unless mid-merge
```

`ROOT` is the sentinel for an unborn HEAD, so an initial commit compares equal to
itself instead of erroring. Merge parents are recorded because a merge commit's diff
depends on every parent, not only HEAD.

### 2.2 When it is computed

**Before §1 trigger evaluation**, not before invoking Bruce. Unconditionally, on every
`@dex commit`.

Every outcome and every acceptance is bound to that tree ID — **including
`not triggered`**.

### 2.3 Commit modes that mutate the reviewed tree are prohibited

These change what gets committed *after* the handoff looked at the index, so the tree
reviewed and the tree committed are not the same object:

| Prohibited | Why |
|---|---|
| `git commit -a` / `-am` | Stages tracked modifications at commit time, after review |
| `git commit <path>` | Commits a path set assembled at commit time, bypassing the index that was reviewed |
| `git commit --amend` after review | Rewrites the committed tree post-review |
| `git reset --soft <other>` after review | Leaves the index identical while changing the base the diff is against |

Commit from the reviewed index only: `git commit` with no path arguments and no `-a`.
If something needs staging, stage it and **re-run the handoff** — that is a diff
change like any other.

### 2.4 Recompute immediately before commit, and refuse on mismatch

Immediately before invoking `git commit`, recompute all three — tree, head, parents —
and compare them to the recorded values. **On mismatch of any one, refuse to commit**
and re-run the handoff from §1.

This is enforced outside the agent by `.githooks/pre-commit`, which performs the same
comparison at commit time. Its honest scope: it catches the **workflow silently
drifting** — a late `git add`, a `-a`, an amend, a stray write between review and
commit. It is not an adversarial control; hooks are opt-in per clone
(`git config core.hooksPath .githooks`) and the record can be removed. The value is
that the common accidental path now fails loudly in a different process instead of
depending on the agent remembering its own instruction.

**If the staged diff changes, the entire handoff re-runs** from §1 trigger
evaluation, because a change can newly touch a trigger class the previous diff did
not. The Codex Review Gate runs *after* this handoff and routinely produces code
changes.

**Why `not triggered` must be fingerprinted too.** If only triggering runs recorded a
baseline, this would be a clean bypass: commit a prose-only diff, get `not triggered`,
then let the Codex round add authorization code — with no recorded fingerprint,
nothing detects that the diff moved, and the added code is never evaluated against
§1 at all. A run that found no trigger still made a claim *about a specific diff*, and
that claim expires the moment the diff does.

A clearance is a statement about a specific diff, not about a branch or an intention.
So is a non-trigger.

---

## 3. Triage

Hand Bruce **the diff and the reason it triggered**. Triage is bounded to that
material — no architecture spelunking. Only escalation opens the full lens.

| Verdict | Meaning | Requires |
|---|---|---|
| `clear` | Nothing here warrants a threat model | One-line rationale |
| `escalate` | Something specific concerns him | The specific concern |
| `cannot determine` | Cannot reach a verdict on available evidence | **Naming the missing evidence** |

`cannot determine` **must name what evidence is missing.** An indeterminate verdict
that does not say what would resolve it is indistinguishable from an evasion.

**If Bruce returns `cannot determine` without naming the missing evidence**, that is
not a verdict — re-request a conforming one, once. If he still does not name it,
treat the run as **`unavailable`** (§6), not as advisory. Bruce answering
unusably is closer to Bruce not answering than to Bruce clearing the change, and
mapping it to advisory would let an unusable answer become a pass.

**Disposition of `cannot determine`:**

- **Inside** the authoritative domains (§4) → **blocks**. Resolve it by §3.1, and only
  if that fails, clear it by §5 using the `Security-Risk-Accepted` key with the missing
  evidence as the summary. What is accepted is a specific unresolved question, not an
  absence of review, so it is not the §6 key.
- **Outside** them → **advisory**. Commit proceeds, and it persists on the same terms
  as any other advisory finding (§7) — the gate report alone does not survive the
  session.

### 3.1 Supply the evidence before offering acceptance

**Acceptance is the last resort, not the first exit.** Bruce named what he was missing;
if it can be handed to him, hand it to him. A workflow whose only route past "I could
not tell" is "accept the risk" trains people to accept unresolved risk rather than
resolve uncertainty — and it does so precisely when the answer was one file away.

Order, and it is not optional:

1. **Present the request** — Bruce's named missing evidence, verbatim, as a question
   with an obvious answer shape ("Bruce needs the implementation of `resolveRole()`;
   it is outside the diff").
2. **Let the author supply it.** Source files, a policy definition, a deployment fact —
   whatever was named. Supplied evidence is **not** an argument that the concern is
   unfounded; if the author wants to argue that, it is Bruce's call, not theirs.
3. **Re-run Bruce** against the **same staged tree ID plus a digest of the supplied
   evidence**. The tree did not change — the evidence did — so the outcome binds to
   both. An evidence digest that changes invalidates the verdict exactly as a tree
   change does (§2), for the same reason: the verdict was about specific inputs.
4. **Only if the evidence cannot or will not be supplied** — it does not exist, it is
   not obtainable, or the author declines — is §5 acceptance offered. Record which of
   those it was in the summary, because "we could not find out" and "we chose not to
   look" are different admissions.

A `cannot determine` that becomes `clear` or `escalate` after evidence is the system
working. An acceptance recorded when step 2 was never attempted is the system being
routed around.

Inside those domains, "I could not tell whether this authorization check is correct"
carries the same operational weight as "this authorization check is wrong."

---

## 4. Classification and gate

On `escalate`, Bruce runs his normal lens and returns findings, each classified:

| Class | Scope | Effect |
|---|---|---|
| **Authoritative** | Authorization correctness, credential handling, trust boundaries | **Blocks.** Cleared only by §5 |
| **Advisory** | Everything else | Logged; commit proceeds |

**Bruce may not block on** style, performance, speculative threats carrying a certain
usability cost, or compliance conclusions (he maps to requirements, never certifies).
Without this floor the gate inflates until it is waved through.

**Ordering:** the handoff is `@dex commit` **step 8** and runs **before** the Codex
Review Gate, which is **step 9**. A commit that will be blocked should not burn an
external review round first.

---

## 5. Risk acceptance

An acceptance record is worth only its resistance to being manufactured.

### 5.1 Requirements

1. **Explicit human approval, after the exact finding is presented.** Not a general
   "go ahead" — approval of the specific finding, quoted.
2. **The accepter identity is copied from that approval, never inferred.** Not from
   git config, environment, or assumption. If the approval carried no identity, ask.
   Do not guess.
3. **A stable finding identifier**, or a concise normalized summary where none exists.
   Identifiers (`BRUCE-1`, `BRUCE-2`) are sequential *within a run* and are not stable
   across runs — which is why the trailer also carries the summary.

### 5.2 Normalization — mandatory

The accepter identity and the summary are each reduced to **a single line**, with
**control characters rejected** and **embedded trailer syntax rejected**: a value
containing a newline followed by `Key: value`, or any `Security-*:` sequence, is
**refused, not escaped**.

The trailer block is parsed as structured data by anything reading history. A summary
carrying its own newline could otherwise inject a second trailer — including a forged
acceptance for a finding nobody accepted. Never silently rewrite one.

**On rejection, ask whoever authored the offending value** — Bruce for a summary, the
human for an accepter identity. Do not ask the other party to supply a value they did
not write, and do not author it yourself: a normalization failure is not a licence to
paraphrase a security finding. **Ask once.** If the second value also fails, treat the
run as `unavailable` (§6) — a party that cannot produce a conforming value is not
producing a usable one.

The §6 `<cause>` is the exception: Dex authors it, so Dex may rewrite it to conform.
It describes a tooling failure, not a security judgment.

### 5.3 Trailer — authoritative

```text
Security-Risk-Accepted: BRUCE-1 authorization bypass; accepted-by James
```

The trailer must correspond to the **final** fingerprint — the diff actually being
committed. **A stale acceptance never carries forward automatically:** it is presented
again against the new fingerprint and re-accepted explicitly, or it does not apply.

**If the human declines to re-accept**, the finding is simply an unaccepted
authoritative finding again, and §4 blocks. A previous acceptance is not evidence for
the current diff.

**If the re-run comes back `clear`** — the change removed the finding — no trailer is
written. There is nothing to accept. The prior run's `escalated` line stays in the
report (§7).

### 5.4 Knowledge record — index only

`knowledge_ingest`, tagged `["learning", "persona:bruce", "risk-accepted"]`, binding
**all four** of:

| Field | Why |
|---|---|
| Final commit SHA | Where the acceptance landed |
| Final staged-diff fingerprint | Which code was accepted — the SHA alone does not distinguish a re-run |
| Exact trailer string | The authoritative text, unparaphrased |
| Finding classification | Whether this was an accepted *finding* or an accepted *absence of review* (§6) |

**Written after the commit**, since it binds the SHA. If the commit is abandoned, the
acceptance never applied to anything and no record is written — unlike an advisory
finding (§7), which was an observation about real code regardless of whether it landed.

**On failure**, Dex prints the failure explicitly **and** the recovery command or the
exact fields needed to retry, then proceeds — the trailer is authoritative and already
written. **Never swallow the failure silently.**

---

## 6. When Bruce cannot be reached

The §3 verdicts are all things Bruce **returns**. None covers Bruce being absent,
unloadable, or failing before returning anything.

**Retry the invocation once** before declaring it. A transient load failure is not the
same as an unreachable expert, and burning a block on a retryable error trains people
to wave the block through.

If it fails again, a fourth outcome — which is **not** a triage verdict:

```text
security-handoff: unavailable — <cause>
```

**A triggered-but-unavailable handoff blocks.** Classification into
authoritative-vs-advisory is *Bruce's* judgment; with Bruce absent, Dex cannot know
which side a finding falls on, so cannot know whether proceeding is safe. Treating
unavailable as advisory assumes the answer Bruce was invoked to provide.

Cleared by the §5 acceptance path, except that what is accepted is **the absence of
the review**, not a finding — and it uses a **distinct trailer key**:

```text
Security-Review-Unavailable-Accepted: <cause>; accepted-by <identity>
```

A reader grepping history for accepted findings must not have unreviewed commits
silently answer.

**Never substitute a degraded check for the unavailable one.** The §0 deterministic
gates keep running and keep blocking on their own terms, but they are not a fallback
for Bruce.

---

## 7. Reporting

**Visibility — the Dex commit-gate report.** Every run emits exactly one line:

```text
security-handoff: not triggered
security-handoff: clear — <rationale>
security-handoff: escalated — <classification> <finding>
security-handoff: indeterminate — <missing evidence>
security-handoff: unavailable — <cause>
```

A single-finding `escalated` line carries its classification too — `escalated —
authoritative role check runs after the resource is loaded`. Otherwise the one case
where classification matters most is the one case that omits it.

`escalated` reports **what Bruce concluded**, not whether the commit stopped — a run
whose findings are all advisory reports `escalated` and proceeds. Blocking is a
consequence of §4.

**Multiple findings.** The one-line rule is about the *status* line, not the findings.
Render it as a count with the highest classification, then list the findings beneath
it — one per line, each with its classification:

```text
security-handoff: escalated — 2 findings (advisory)
  BRUCE-1 advisory  transitive dep gained a postinstall script
  BRUCE-2 advisory  new version logs request bodies at debug level
```

Never collapse several findings into one prose blob, and never report only the most
severe: an advisory finding that is silently dropped is a finding nobody will ever
see again.

**Where advisory findings persist.** The gate report is per-run terminal output and
does not survive the session. Advisory findings are therefore **also written to the
knowledge graph** — `knowledge_ingest`, tagged
`["persona:bruce", "security-advisory"]`, binding the commit SHA, the staged-diff
fingerprint, the finding text, and its classification.

This is deliberately **not** the `risk-accepted` tag of §5.4: nothing was accepted and
nothing blocked. It exists because "worth watching, no evidence of exploitability
*here*" is exactly the observation that matters six months later, and the §7 report
line is not a place anything can be read from again.

**One record per finding**, not one per run — collapsing them loses exactly what the
per-finding rule above preserves.

**Written after the commit**, since it binds the SHA. If the commit is abandoned at
step 9, write the records anyway with the fingerprint and no SHA: the findings were
real observations about real code, and a commit that never happened is not a reason to
forget them.

**Failure is loud.** Print the failure and the retry fields, as §5.4. But note the
difference: §5.4 may proceed because the trailer is authoritative and already written,
and **here there is no trailer** — a failed advisory write means the findings persist
nowhere at all. So it is still non-blocking (nothing here blocked), but the failure
notice must say plainly that the findings are unrecorded, rather than implying a
durable copy exists elsewhere.

`not triggered`, `clear` and `unavailable` are the three most consequential to
confuse: *never ran*, *ran and found nothing*, *could not run*. Never render one as
another.

**Every run's line is retained, in order, never overwritten**, and a line superseded
by a later run is marked:

```text
security-handoff: clear — input is a fixed enum  (SUPERSEDED: diff changed)
security-handoff: escalated — authoritative query built from request path
```

A superseded `clear` must stay visible. Replacing it hides that a clearance was
voided, which is the single most useful thing the report can say.

**Persistence — the commit message.** Only §5.3 and §6 acceptance trailers reach the
commit message. Nothing else from this protocol does.
