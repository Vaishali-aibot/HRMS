import * as React from "react"

const MOBILE_BREAKPOINT = 768

// useSyncExternalStore instead of the original shadcn boilerplate's
// useState+useEffect: that version called setState synchronously inside
// the effect body (flagged by react-hooks/set-state-in-effect — it causes
// an extra render right after mount), for something that's really just
// subscribing to an external source (the media query) and reading its
// current value — exactly what this hook exists for.
function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// No window during SSR — same default the original hook's initial
// `useState<boolean | undefined>(undefined)` (coerced to false via `!!`)
// produced before its effect ran.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
