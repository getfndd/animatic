#!/bin/bash
# Dex Script - Update Skill Registry
# Scans .claude/skills/ and generates documentation for instructions.md
#
# Usage: .claude/scripts/update-skill-registry.sh [--check | --update]
#   --check   Show what would be generated (default)
#   --update  Update instructions.md in place

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_DIR="$PROJECT_DIR/.claude/skills"
INSTRUCTIONS_FILE="$PROJECT_DIR/.claude/instructions.md"

MODE="${1:---check}"

# Function to extract YAML frontmatter value
extract_frontmatter() {
    local file="$1"
    local key="$2"
    # Extract value after "key:" from frontmatter (between --- markers)
    sed -n '/^---$/,/^---$/p' "$file" | grep "^$key:" | sed "s/^$key:[[:space:]]*//"
}

# Generate skill documentation
generate_skill_docs() {
    echo "## Registered Skills"
    echo ""
    echo "The following skills are available. Invoke with \`@skillname\`."
    echo ""

    for skill_file in "$SKILLS_DIR"/*/SKILL.md; do
        if [ -f "$skill_file" ]; then
            local skill_dir=$(dirname "$skill_file")
            local skill_name=$(basename "$skill_dir")
            local name=$(extract_frontmatter "$skill_file" "name")
            local description=$(extract_frontmatter "$skill_file" "description")
            local user_invocable=$(extract_frontmatter "$skill_file" "user-invocable")
            local disable_model=$(extract_frontmatter "$skill_file" "disable-model-invocation")

            # Use directory name if frontmatter name is empty
            name="${name:-$skill_name}"

            # Build metadata tags
            local tags=""
            if [ "$user_invocable" = "false" ]; then
                tags=" *(background knowledge)*"
            fi
            if [ "$disable_model" = "true" ]; then
                tags="$tags *(user-invoked only)*"
            fi

            echo "### $name$tags"
            echo ""
            if [ -n "$description" ]; then
                echo "$description"
                echo ""
            fi
            echo "See \`.claude/skills/$skill_name/SKILL.md\` for full specification."
            echo ""
            echo "---"
            echo ""
        fi
    done
}

# Main
echo "Dex Skill Registry Scanner"
echo "=========================="
echo ""
echo "Skills directory: $SKILLS_DIR"
echo "Instructions file: $INSTRUCTIONS_FILE"
echo ""

# Count skills
SKILL_COUNT=$(find "$SKILLS_DIR" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
echo "Found $SKILL_COUNT skill(s):"

for skill_file in "$SKILLS_DIR"/*/SKILL.md; do
    if [ -f "$skill_file" ]; then
        skill_dir=$(dirname "$skill_file")
        skill_name=$(basename "$skill_dir")
        name=$(extract_frontmatter "$skill_file" "name")
        echo "  - ${name:-$skill_name}"
    fi
done

echo ""

if [ "$MODE" = "--check" ]; then
    echo "Generated documentation (preview):"
    echo "-----------------------------------"
    generate_skill_docs
    echo ""
    echo "Run with --update to update instructions.md"
elif [ "$MODE" = "--update" ]; then
    if [ ! -f "$INSTRUCTIONS_FILE" ]; then
        echo "ERROR: $INSTRUCTIONS_FILE not found"
        exit 1
    fi

    echo "Updating instructions.md..."

    # Generate the new skills section
    SKILLS_CONTENT=$(generate_skill_docs)

    # Create temp file
    TEMP_FILE=$(mktemp)

    # Check if the section markers exist
    if grep -q "## Registered Skills" "$INSTRUCTIONS_FILE"; then
        # Replace existing section: everything between "## Registered Skills" and the next "## " heading (or EOF)
        awk '
        /^## Registered Skills/ { skip=1; next }
        skip && /^## [^R]/ { skip=0 }
        !skip { print }
        ' "$INSTRUCTIONS_FILE" > "$TEMP_FILE"

        # Find the line to insert before (first ## heading, or append to end)
        # Insert the skills section at the original position
        # Simpler approach: rebuild the file
        {
            awk '/^## Registered Skills/ { exit } { print }' "$INSTRUCTIONS_FILE"
            echo "$SKILLS_CONTENT"
            awk 'BEGIN{skip=1} /^## Registered Skills/{skip=1; next} skip && /^## [^R]/{skip=0} !skip{print}' "$INSTRUCTIONS_FILE"
        } > "$TEMP_FILE"

        mv "$TEMP_FILE" "$INSTRUCTIONS_FILE"
        echo "Updated existing '## Registered Skills' section."
    else
        # Append to end
        echo "" >> "$INSTRUCTIONS_FILE"
        echo "$SKILLS_CONTENT" >> "$INSTRUCTIONS_FILE"
        rm -f "$TEMP_FILE"
        echo "Appended new '## Registered Skills' section."
    fi

    echo "Done."
else
    echo "Unknown mode: $MODE"
    echo "Usage: $0 [--check | --update]"
    exit 1
fi

exit 0
