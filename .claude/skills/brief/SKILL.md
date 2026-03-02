---
name: brief
description: Guided creative brief authoring using templates from the catalog.
---

# /brief - Creative Brief Authoring

Walk through a guided process to author a creative brief JSON file, using templates from the catalog to structure the content.

---

## Command Interface

```
/brief [template-name]
```

### Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `template-name` | string | (none) | Template to start from. Omit to browse available templates. |

---

## Execution Flow

### 1. Load Templates

Call `list_brief_templates` MCP tool to show available templates with descriptions.

If no template specified, present the list and ask the user to choose.

### 2. Load Template Structure

Call `get_brief_template` MCP tool with the chosen template name to get the section structure, required fields, and example content.

### 3. Walk Through Sections

Guide the user through each section of the brief, asking for:

**Project:**
- Title
- Description
- Target duration (seconds)
- Target scene count

**Tone:**
- Mood (e.g., confident, energetic, calm, dramatic)
- Energy level (low, medium, high)
- Target audience

**Content (per template section):**
- Text content for each section
- Asset references (screenshots, videos, images)
- Notes on emphasis or hierarchy

**Assets:**
- File paths or URLs
- Asset types (screenshot, video, image, icon)
- Placement hints (hero, background, overlay)

**Constraints:**
- Must-include elements
- Brand colors
- Maximum/minimum scene count
- Style pack preference

### 4. Assemble Brief JSON

Build the brief JSON following the schema in `docs/cinematography/specs/brief-schema.md`:
- Generate a unique `brief_id`
- Include template reference
- Populate all sections from user input
- Include asset manifest

### 5. Validate

Check required fields:
- `brief_id` — present and unique
- `template` — valid template name
- `project.title` — non-empty
- `project.description` — non-empty

### 6. Write File

Save as `brief.json` in the current directory (or user-specified path).

---

## Examples

### Browse templates

```
/brief
```

### Start with a specific template

```
/brief product-launch
```

### Quick brief with known template

```
/brief feature-demo
```

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `list_brief_templates` | Show available templates |
| `get_brief_template` | Load template structure and examples |

---

## Rules

### DO
- Always show the template list if no template specified
- Validate required fields before writing
- Show a preview of the assembled brief before saving
- Accept partial input — mark missing sections as TODO

### DO NOT
- Skip the template selection step
- Write the file without user confirmation
- Invent content the user didn't provide
- Require all optional fields to be filled

---

## Related Commands

| Command | Purpose |
|---------|---------|
| `/storyboard` | Brief → scenes (planned, ANI-31) |
| `/sizzle` | Scenes → rendered video |
| `/review` | Evaluate sequence quality |
