

## Auto-dismiss Toast After 3 Seconds

### Change — `src/hooks/use-toast.ts`

**Line 6**: Change `TOAST_REMOVE_DELAY` from `1000000` to `3000` so toasts auto-disappear after 3 seconds.

Additionally, add an auto-dismiss dispatch in the `ADD_TOAST` case so toasts start their dismiss timer immediately upon appearing.

