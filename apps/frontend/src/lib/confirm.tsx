import { useState, useEffect } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface ConfirmOpts {
  title:         string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  danger?:       boolean
}

type Resolver = (value: boolean) => void
let openImpl: ((o: ConfirmOpts) => Promise<boolean>) | null = null

/**
 * Confirmation accessible (remplace `window.confirm`). Renvoie une Promise<boolean>.
 * Usage : `if (!(await confirm({ title, message, danger: true }))) return`.
 * Repli sur `window.confirm` si l'hôte n'est pas monté.
 */
export function confirm(opts: ConfirmOpts): Promise<boolean> {
  if (openImpl) return openImpl(opts)
  return Promise.resolve(window.confirm(opts.message))
}

/** Hôte global : monté une seule fois (App), rend la `ConfirmModal` à la demande. */
export function ConfirmHost() {
  const [state, setState] = useState<(ConfirmOpts & { resolve: Resolver }) | null>(null)

  useEffect(() => {
    openImpl = (o) => new Promise<boolean>(resolve => setState({ ...o, resolve }))
    return () => { openImpl = null }
  }, [])

  const close = (value: boolean) => {
    state?.resolve(value)
    setState(null)
  }

  return (
    <ConfirmModal
      open={!!state}
      title={state?.title ?? ''}
      message={state?.message ?? ''}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      danger={state?.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  )
}
