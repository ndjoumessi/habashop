// Région aria-live globale pour les lecteurs d'écran (TalkBack / VoiceOver) :
// les toasts react-hot-toast ne sont pas toujours annoncés → on double les
// mutations clés d'une annonce polie via cette région (montée dans AppLayout).

let region: HTMLElement | null = null
let clearTimer: ReturnType<typeof setTimeout> | undefined
let lastMsg = ''
let lastAt = 0

/** Appelé par AppLayout pour brancher/débrancher la région aria-live. */
export function setAnnounceRegion(el: HTMLElement | null) {
  region = el
}

/**
 * Annonce un message court aux lecteurs d'écran (région aria-live="polite").
 * - throttle simple : un même message répété en < 1,5 s est ignoré ;
 * - vidage automatique après ~3 s (évite la relecture au re-focus).
 * No-op si la région n'est pas montée (pages publiques, tests).
 */
export function announce(msg: string) {
  if (!region || !msg) return
  const now = Date.now()
  if (msg === lastMsg && now - lastAt < 1500) return
  lastMsg = msg
  lastAt = now
  // Vider puis re-poser au tick suivant force la relecture même si le texte est identique
  region.textContent = ''
  setTimeout(() => { if (region) region.textContent = msg }, 50)
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = setTimeout(() => { if (region) region.textContent = '' }, 3000)
}
