

## Hide Scrollbars Globally

The project already hides scrollbars on `html` and `body` (lines 7-15 of `src/index.css`). To remove scrollbars from **all** scrollable elements (drawers, menus, scroll areas, etc.), add a universal rule.

### Change in `src/index.css`

After the existing `body::-webkit-scrollbar` block (line 15), add a universal scrollbar-hiding rule:

```css
*::-webkit-scrollbar {
  display: none;
}
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
```

This hides scrollbars on every element while preserving scroll functionality. One file, one change.

