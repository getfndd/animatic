# Data Tables, Loading & Progress

Tabular structure behind `@steve table`, plus loading and progress announcement rules. Load when auditing a data table, a skeleton state, or a progress indicator.

---

## Data Table Requirements

| Feature | Implementation |
|---------|---------------|
| **Caption** | `<caption>` or `aria-label` on `<table>` |
| **Headers** | `<th>` elements with `scope="col"` or `scope="row"` |
| **Complex headers** | `headers` attribute linking cells to multiple headers |
| **Sort indication** | `aria-sort="ascending"`, `"descending"`, or `"none"` on sortable `<th>` |
| **Empty cells** | Use `—` or "None" with `aria-label`, not empty `<td>` |
| **Numerical alignment** | `tabular-nums` for consistent number width |
| **Responsive** | Maintain header association at all viewport widths |

### Sortable Column Pattern

```
<th aria-sort="ascending" scope="col">
  <button>
    Name
    <span aria-hidden="true">▲</span>
  </button>
</th>
```

After sort change, announce: "Table sorted by [column], [direction]" via live region.

### Table Review Checklist

1. Is `<table>` used (not div-based grid) for tabular data?
2. Are headers marked with `<th scope="col/row">`?
3. Is there a `<caption>` or `aria-label`?
4. Are sortable columns using `aria-sort`?
5. Are empty cells handled (not blank)?
6. Is numerical data using `tabular-nums`?
7. Are complex headers using the `headers` attribute?
8. Does the table remain accessible at mobile widths?

---

## Loading & Progress States

| State | ARIA | Announcement |
|-------|------|-------------|
| Loading start | `aria-busy="true"` on container | "Loading [context]" via live region |
| Loading complete | Remove `aria-busy` | Announce result count or content summary |
| Progress bar | `role="progressbar"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax` | Update `aria-valuenow` as progress changes |
| Indeterminate | `role="progressbar"` without `aria-valuenow` | "Loading, please wait" |

### Preventing Announcement Storms

- Debounce rapid live region updates (e.g., file upload progress)
- For progress bars: announce at 25%, 50%, 75%, 100% — not every percentage
- For search-as-you-type: debounce result count announcement (300-500ms)
