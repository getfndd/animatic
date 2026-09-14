# Motion, transparency, and contrast preferences

The three user preferences that change how an interface may move and how
solid it must be. All three are independent — honouring one does not
satisfy the others, and a design that respects motion but ignores
transparency still fails the people who set it.

Vestibular disorders are the reason the first one exists. Motion that reads
as tasteful to one person can cause nausea, dizziness or migraine in
another, and the trigger is not the animation's beauty but its size,
duration and direction.

---

## The principle

**Reduced motion does not mean no feedback.** It means a gentler,
non-vestibular equivalent. Stripping all response leaves an interface that
feels broken rather than calm — the user still needs to know that something
happened.

| Instead of | Substitute |
|---|---|
| slide, parallax, spring, elastic overshoot | short opacity cross-fade or a static transition |
| a large surface flying across the viewport | fade out, reposition, fade in |
| translucent blurred chrome | frostier or solid background, blur dropped |
| a subtle low-contrast border | a defined, contrasting border |

Keep opacity and colour changes that aid comprehension. Drop travel,
overshoot and oscillation.

---

## `prefers-reduced-motion: reduce`

Replace movement with a cross-fade. Remove elastic and overshoot entirely —
bounce is the most vestibular thing in a typical UI.

```css
@media (prefers-reduced-motion: reduce) {
  .sheet {
    transition: opacity 200ms ease;
    transform: none !important;
  }
}
```

Beyond individual components, avoid:

- **full-viewport moving backgrounds** — the larger the moving area, the
  stronger the vestibular effect
- **slow looping oscillation**, particularly near 0.2 Hz (one cycle per
  five seconds), which is the range most associated with motion sickness
- **abrupt brightness jumps** — ease dark ↔ light theme changes rather than
  cutting between them

For large objects that must move, make them semi-transparent while
travelling, and fade a big surface out during a large reposition then back
in once it settles.

**Do not detect this once at load.** The preference can change mid-session;
listen to the media query rather than reading it a single time.

---

## `prefers-reduced-transparency: reduce`

Translucent material is a legibility problem before it is an aesthetic one.
When the user asks for less of it, raise the background opacity and drop
the blur — do not merely reduce it.

```css
@media (prefers-reduced-transparency: reduce) {
  .toolbar {
    background: white;
    backdrop-filter: none;
  }
}
```

This is the signal most often missed, because `backdrop-filter` reads as a
visual choice rather than an accessibility surface. It is both.

---

## `prefers-contrast: more`

Near-solid backgrounds with a defined, contrasting border. This is not the
same as raising text contrast alone — the *boundaries* between surfaces
have to become legible too, which is exactly what translucent chrome
removes.

---

## Review checklist

- [ ] Every transform-based transition has a reduced-motion branch
- [ ] Elastic, bounce and overshoot are removed under reduced motion, not just shortened
- [ ] Feedback still occurs under reduced motion — the interface does not go inert
- [ ] Translucent surfaces have a `prefers-reduced-transparency` fallback
- [ ] Surface boundaries remain visible under `prefers-contrast: more`
- [ ] No full-viewport background motion
- [ ] No looping oscillation near 0.2 Hz
- [ ] Theme changes ease rather than cut
- [ ] Preferences are observed live, not read once at startup

---

## Where the rest of this lives

This document covers the preference signals. The motion craft they modify
is split by domain:

| Domain | Where |
|---|---|
| Presentation motion — entrances, state changes, staggers | Maya, `reference/motion-design.md` |
| Interaction motion — gestures, drags, sheets, springs | `_knowledge/mobile-native/reference/fluid-feel.md` |
| Touch target sizing, cognitive load | `reference/touch-and-cognitive.md` |

On any conflict between a motion recommendation and an accessibility
preference, the preference wins. That is not a tie-break rule; it is the
whole point of the signal.
