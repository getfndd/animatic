# Content Patterns

Canonical formulas for common UI elements — buttons, errors, empty states, confirmations, tooltips, success, loading, placeholders, form labels, navigation. Load when writing or reviewing any of them.

These are formulas, not suggestions.

---

Canonical patterns for common UI elements. These are formulas, not suggestions.

### Button Labels

**Pattern**: `[Verb] [object]`

| Context | Good | Bad |
|---------|------|-----|
| Save a form | Save changes | Submit |
| Delete an item | Delete investor | Delete / Remove / Yes |
| Create new | Create round | Add / New / + |
| Cancel an action | Cancel | Back / Close / Never mind |
| Confirm destructive | Delete 3 documents | OK / Confirm / Yes, delete |
| Sign in | Sign in | Log in / Login |
| Navigate forward | Continue | Next / Proceed |
| Upload | Upload documents | Choose files / Browse |

**Button pairs** (order: secondary left, primary right):
- Cancel / Save changes
- Cancel / Delete investor
- Go back / Continue
- Keep editing / Discard changes

### Error Messages

**Pattern**: `[What happened]. [Why (optional)]. [What to do]`

| Context | Good | Bad |
|---------|------|-----|
| Auth | "That password is incorrect. Check for typos and try again." | "Authentication failed." |
| Upload | "This file is too large. The maximum size is 25 MB. Compress the file or split it into smaller parts." | "Error: file exceeds limit." |
| Network | "We couldn't reach the server. Check your connection and try again." | "Network error." |
| Validation | "Enter a valid email address, like name@company.com." | "Invalid email." |
| Permission | "You don't have access to this workspace. Ask the workspace owner to invite you." | "403 Forbidden" |
| Not found | "This page doesn't exist. It may have been deleted or the link may be wrong." | "404 Not Found" |
| Conflict | "This investor was updated by someone else. Refresh to see the latest version." | "Conflict error." |

### Empty States

**Pattern**: `[What will be here] + [Why it matters] + [How to get started]`

Every empty state has three parts:

| Part | Purpose | Character Limit |
|------|---------|-----------------|
| **Headline** | Name what's missing (not "Nothing here") | ~40 chars |
| **Description** | Explain the value of filling this space | ~120 chars |
| **Action** | Primary CTA button (verb + object) | ~25 chars |

| Context | Good | Bad |
|---------|------|-----|
| No investors | "No investors yet" / "Track the investors you're talking to and where each conversation stands." / [Add investor] | "Nothing to show" |
| No documents | "No documents yet" / "Upload your pitch deck, financials, and legal docs to share with investors." / [Upload documents] | "Empty" |
| No activity | "No activity yet" / "Actions you and your team take will appear here." / — (no CTA) | "There is no data to display." |
| Search no results | "No results for '[query]'" / "Try a different search term or adjust your filters." / [Clear filters] | "0 results found" |

**Rules:**
- Never use "Oops!", "Uh oh", or any exclamatory opener
- Never explain the system architecture ("The database has no records")
- Illustration is optional — if used, keep it subtle (no 3D renders, no cartoons with faces)
- If there is nothing the user can do, skip the action button

### Confirmation Dialogs

**Pattern**: `[Consequence statement] + [Irreversibility warning if applicable] + [Specific action buttons]`

| Part | Rule |
|------|------|
| Title | Verb + object: "Delete document?" or "Remove investor?" (question form) |
| Body | State the consequence, not the mechanic. "This document will be permanently deleted." not "Are you sure?" |
| Irreversibility | Only warn when truly irreversible. "This can't be undone." is meaningful. Don't use it for reversible actions. |
| Primary button | Matches the title verb: "Delete document" |
| Secondary button | "Cancel" — always "Cancel", not "Go back" or "Never mind" |

**Never write:**
- "Are you sure?" as the title (says nothing about the action)
- "Are you sure you want to...?" as body text (redundant — the user clicked the button)
- "Yes" / "No" as button labels (user must re-read the title to understand what they are confirming)

### Tooltips

**Pattern**: `[What it does] in one sentence, no period`

| Rule | Rationale |
|------|-----------|
| Maximum ~80 characters | If it needs more, it's not a tooltip — it's help text |
| No title repetition | If the tooltip just restates the label, remove it |
| Action-oriented for controls | "Filter investors by stage" not "Stage filter" |
| Definitional for concepts | "The percentage of the company you'd own after all shares are issued" |
| No periods for single sentences | Tooltips are fragments, not paragraphs |

### Success Messages

**Pattern**: `[What happened] + [What's next (optional)]`

| Context | Good | Bad |
|---------|------|-----|
| Saved | "Changes saved" | "Success! Your changes have been saved successfully." |
| Deleted | "Document deleted" | "The document has been successfully removed from the system." |
| Created | "Investor added to pipeline" | "Success!" |
| Sent | "Invite sent to alex@example.com" | "Your invitation was sent successfully." |

**Rules:**
- Use toasts for transient success feedback
- Keep to under 60 characters
- "Successfully" is almost always redundant — remove it
- Include the specific noun when helpful ("3 documents uploaded" not "Upload complete")

### Loading States

**Pattern**: `[Verb]ing [object]...`

| Context | Good | Bad |
|---------|------|-----|
| Data fetch | "Loading investors..." | "Please wait..." |
| Save | "Saving changes..." | "Processing..." |
| Upload | "Uploading 3 documents..." | "Please wait while we process your files..." |
| AI processing | "Analyzing document..." | "AI is working..." |
| Export | "Generating report..." | "Export in progress..." |

**Rules:**
- Use progressive verbs (gerund form: -ing)
- Name what is being loaded/processed
- For AI features, describe the process, not the source (AI-assumed design)
- Skeleton loaders need no text — structural placeholders communicate loading

### Placeholder Text

**Pattern**: `[Example of valid input]` or `[Instruction as hint]`

| Context | Good | Bad |
|---------|------|-----|
| Email field | "name@company.com" | "Enter your email address" |
| Search | "Search investors..." | "Type to search" |
| Name field | "Acme Ventures" | "Enter firm name" |
| Amount | "1,000,000" | "Enter amount" |
| URL | "https://acme.vc" | "Enter URL" |
| Notes | "Add notes about this investor..." | "Notes" |

**Rules:**
- Placeholders are hints, not labels — always have a visible label above the field
- Use realistic examples that demonstrate the expected format
- Placeholders disappear on focus — they must not contain essential information
- Use `...` suffix for open-ended fields (search, notes) to invite input

### Form Labels

| Rule | Rationale |
|------|-----------|
| Short noun phrase | "Company name", "Email address", "Investment amount" |
| No colons after labels | Colons are a legacy form convention — modern UI doesn't need them |
| Required fields: no asterisk needed if most fields are required | Only mark optional fields with "(optional)" |
| Help text below the field, not in the label | "We'll use this to calculate your ownership percentage" |

### Navigation & Menu Items

| Rule | Rationale |
|------|-----------|
| Nouns for destinations | "Dashboard", "Investors", "Settings" |
| Verbs for actions | "Create round", "Import contacts", "Export report" |
| No articles | "Investors" not "The Investors" |
| Plural for collection views | "Documents" not "Document" |
| Sentence case | "Cap table" not "Cap Table" (unless proper noun) |
