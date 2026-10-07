# B1G Fuel theme

The B1G Fuel theme uses **white (`#FFFFFF`)** and **navy (`#02066F`)** as its main colors. White provides the page and surface backgrounds; navy identifies the brand, primary actions, links and selected states.

This guide records the intended theme. Some existing styles still use older colors; the adoption checklist below tracks the remaining updates.

## Palette

| Color | Hex | Purpose |
| --- | --- | --- |
| White | `#FFFFFF` | Page background, cards, dialogs, forms and text on navy buttons |
| Navy | `#02066F` | Primary buttons, brand accents, links, icons and focus indicators |

Neutral grays can support body text, borders, placeholders and disabled controls. Status colors can communicate errors, warnings and success; they are functional accents rather than additional brand colors. Keep them paired with readable text or icons.

## Component usage

| Component | Recommended treatment |
| --- | --- |
| Page, sidebar and header | White background with subtle neutral borders |
| Cards and dialogs | White surface, neutral border, dark readable content |
| Primary button | Navy background with white text |
| Secondary button | White background with navy text and a navy or neutral border |
| Links | Navy text with an underline or another visible interaction cue |
| Active navigation | Light navy tint with navy text/icon; identify the active item beyond color alone |
| Inputs | White background, neutral border, navy focus indicator |
| Tables | White rows, neutral separators and a subtle hover tint |
| Brand accents | Navy logo backgrounds, text accents and supporting icons |

Use navy for actions that deserve emphasis. A white layout with consistent spacing keeps forms and tables readable without filling every section with a strong color.

## Shared theme tokens

Maintain the brand values in `src/app/globals.css`. The following token configuration is now applied:

```css
:root {
  --background: #ffffff;
  --card: #ffffff;
  --primary: #02066f;
}
```

The existing Tailwind mapping already connects `bg-background`, `bg-card`, `bg-primary`, `text-primary` and `ring-ring` to these variables. `text-primary-foreground` is already white, and the focus-ring color follows `--primary`.

Prefer semantic classes over repeating hex values in components:

```tsx
<Button>Save user</Button>

<Button variant="outline" className="text-primary">
  Cancel
</Button>

<a className="text-primary underline" href="/users">
  View users
</a>
```

The default Button already uses `bg-primary text-primary-foreground hover:bg-primary/90`. After updating the shared token, it follows the navy theme automatically. Use subdued navy tints for hover/selection backgrounds and verify text remains readable over them.

## Readability and interaction

- Use white text on navy primary buttons and navy text on white surfaces.
- Keep focus indicators visible for keyboard users.
- Include text or icons for error and success states; color alone is insufficient.
- Preserve readable disabled text and clear borders on white inputs.
- Check contrast when using opacity, tinted backgrounds or gray supporting text.
- Keep the same brand treatment on desktop and mobile.

This is a light theme. A dark-theme palette would need its own background, text and interaction decisions.

## Adoption checklist

- [x] Set `--background` to white in `src/app/globals.css`.
- [x] Set `--primary` to navy `#02066F`.
- [x] Use semantic navy classes in the mobile dashboard header and sidebar email.
- [ ] Consolidate existing sidebar `#02066F` literals into `bg-primary` and `text-primary` where appropriate.
- [ ] Review login, sidebar, mobile header, buttons, inputs, tables and dialogs together.
- [ ] Verify hover, focus, selected, disabled and status states remain clear.

Documentation creation does not change these application styles. Update this checklist when the theme is applied.
