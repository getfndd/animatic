# Microcopy Standards

## Button Labels

### Primary Actions

| Context | Label | Not This |
|---------|-------|----------|
| Creating something new | "Add token" | "Create" / "New" / "Submit" |
| Saving changes | "Save changes" | "Save" / "Update" / "Submit" |
| Saving a new item | "Save token" | "Create token" / "Add" |
| Deleting | "Delete" or "Delete [thing]" | "Remove" / "Trash" |
| Canceling | "Cancel" | "Go back" / "Never mind" |
| Confirming | Use specific verb: "Delete preset" | "Yes" / "Confirm" / "OK" |
| Connecting | "Connect" | "Link" / "Attach" |
| Importing | "Import tokens" | "Upload" / "Load" |
| Exporting | "Export" or "Export as [format]" | "Download" / "Get" |

### AI Actions

| Context | Label | Not This |
|---------|-------|----------|
| AI suggestion | "Suggest with AI" | "Magic suggest" / "AI generate" |
| AI generation | "Generate" | "Create with AI" / "Auto-generate" |
| AI analysis | "Analyze" | "AI scan" / "Smart analyze" |

### Rules

- Use specific action verbs: "Save preset" not "Submit"
- Include the object when ambiguous: "Delete token" not just "Delete"
- No periods after button labels
- Sentence case: "Save changes" not "Save Changes"
- Destructive actions use the destructive verb: "Delete" not "Remove"

## Form Labels and Placeholders

### Token Studio

| Field | Label | Placeholder | Help Text |
|-------|-------|-------------|-----------|
| Name | "Token name" | "e.g., color-primary" | "Used as the CSS custom property name" |
| Value | "Value" | "e.g., #1a1a1a" | — |
| Description | "Description" | "e.g., Primary brand color for interactive elements" | "Optional. Helps team members understand when to use this token." |
| Category | "Category" | — (select) | — |
| CSS variable | "CSS variable" | "e.g., --color-primary" | "Auto-generated from token name" |

### Preset Studio

| Field | Label | Placeholder | Help Text |
|-------|-------|-------------|-----------|
| Name | "Preset name" | "e.g., Button primary" | — |
| Component | "Component" | — (select) | — |
| Description | "Description" | "e.g., Standard primary action button" | — |
| Tags | "Tags" | "e.g., action, primary" | "Comma-separated" |

### General Form Rules

- Labels are nouns, not instructions
- Placeholders use "e.g.," prefix
- Help text explains purpose or format constraints
- Required fields marked with `*`
- Don't use placeholder as a substitute for label

## Error Messages

### Validation Errors

| Scenario | Message |
|----------|---------|
| Required field empty | "[Field name] is required" |
| Invalid email | "Enter a valid email address" |
| Password too short | "Password must be at least 8 characters" |
| Name already exists | "A token named '[name]' already exists" |
| Invalid hex color | "Enter a valid hex color (e.g., #FF5733)" |
| Invalid URL | "Enter a valid URL starting with https://" |

### Network Errors

| Scenario | Message |
|----------|---------|
| Generic connection | "Couldn't connect to the server. Check your connection and try again." |
| Timeout | "The request timed out. Try again." |
| Server error | "Something went wrong on our end. Try again in a few minutes." |

### Auth Errors

| Scenario | Message |
|----------|---------|
| Wrong credentials | "Email or password is incorrect" |
| Session expired | "Your session expired. Sign in again to continue." |
| No permission | "You don't have permission to do this. Contact your admin." |
| Account locked | "Your account has been locked. Check your email for next steps." |

### Permissions Errors

| Scenario | Message |
|----------|---------|
| Read only | "You can view this but can't make changes. Contact your admin for editor access." |
| Action restricted | "Only admins can [action]. Contact your admin." |
| Org-level restriction | "This feature isn't available on your current plan." |

### Sync/Save Errors

| Scenario | Message |
|----------|---------|
| Save failed | "Couldn't save your changes. Try again." |
| Sync conflict | "Someone else edited this. Refresh to see the latest version." |
| Import failed | "Couldn't import the file. Check the format and try again." |

## Success Messages (Toasts)

| Action | Message |
|--------|---------|
| Saved | "Changes saved" |
| Created | "Token created" / "Preset created" |
| Deleted | "Token deleted" |
| Imported | "12 tokens imported" (use actual count) |
| Exported | "Exported as CSS variables" |
| Connected | "Connected to [service]" |
| Copied | "Copied to clipboard" |
| Invited | "Invitation sent" |

Rules:
- Past tense for completed actions
- Include specifics when useful (count, name, format)
- Maximum ~6 words
- No exclamation marks

## Loading States

| Context | Message |
|---------|---------|
| Page loading | (skeleton, no text) |
| Action in progress | "Saving..." / "Importing..." / "Connecting..." |
| Long operation | "Analyzing design system... This may take a moment." |
| AI processing | "Generating suggestions..." |

Rules:
- Present progressive tense
- Ellipsis for brief waits
- Add "This may take a moment" for operations > 5 seconds
- Never "Please wait" — just describe what's happening

## Empty States by Page

### Tokens

**Title:** "No tokens yet"
**Body:** "Design tokens define your visual language — colors, spacing, typography, and more."
**CTA:** "Add your first token"

### Presets

**Title:** "No presets yet"
**Body:** "Presets are executable component specifications that AI tools use to generate correct code."
**CTA:** "Create a preset"

### Patterns

**Title:** "No patterns yet"
**Body:** "Patterns document reusable solutions for common UI problems in your design system."
**CTA:** "Add a pattern"

### Health

**Title:** "No health data yet"
**Body:** "Run a health check to see how well your codebase follows your design system."
**CTA:** "Run health check"

### MCP Connection

**Title:** "Not connected"
**Body:** "Connect your AI tools to your design system via MCP."
**CTA:** "Set up connection"

### Team Members

**Title:** "Just you for now"
**Body:** "Invite your team to collaborate on your design system."
**CTA:** "Invite a team member"

## Tooltip Conventions

- Maximum 1-2 short sentences
- Explain the what, not the how (save how for help docs)
- No periods if single phrase; period if full sentence
- Sentence case

**Examples:**
- "Tokens synced from Figma can't be edited here"
- "Last synced 3 minutes ago"
- "AI suggestions use your existing tokens as context"

## Breadcrumb Labels

Use short, recognizable labels:
- "Design system" > "Tokens" > "Colors"
- "Settings" > "Team" > "Members"
- "Presets" > "Button primary"

Rules:
- Match navigation labels exactly
- Sentence case
- Truncate long names with ellipsis if needed
