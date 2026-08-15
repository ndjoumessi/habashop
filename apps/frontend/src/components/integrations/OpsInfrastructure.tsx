import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'

// ⚠️ Même base d'API que `useOnlineStatus` — une seconde définition divergerait le jour
// où l'API déménage, et la sonde interrogerait un hôte mort en affichant du vert.
const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://habashop-production.up.railway.app'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { sentryStatusApi, resendAccountApi, type ResendAccount } from '@/lib/api'
import { INTEGRATIONS_LIST, CATEGORY_OF, OPS_CATS, API_VERSION, CARD_DETAIL } from '@/pages/Integrations'

// ── Infrastructure OPÉRATEUR (étape 1bis) ────────────────────────────────────
// L'infra (base/hébergement/monitoring) récupérée depuis la page intégrations : elle
// n'a plus rien à faire chez le commerçant (publierait la stack). Vue factuelle pour
// l'opérateur : endpoint, version, détail, statut. L'étape 2 la condensera en bande
// « santé technique » ; ce composant reste la source réutilisable.
/**
 * ⚠️ CE PANNEAU NE MESURE RIEN — et il faut le dire plutôt que d'afficher du vert.
 *
 * MESURÉ le 2026-08-06 : `itg.declared` (nommé `itg.status` à l'époque, ce qui était la
 * moitié du problème) est un LITTÉRAL écrit dans `pages/Integrations.tsx` — aucune requête
 * n'est émise pour lui. Le champ a été renommé pour que son nom dise sa nature ; le
 * `status` mesuré, lui, vient de `GET /api/integrations/status`. La pastille verte décrit un
 * fichier TypeScript, pas une infrastructure — elle ne peut PAS rougir, quoi qu'il arrive
 * en production. Un indicateur qu'on n'a jamais vu échouer ne prouve rien.
 *
 * Deux conséquences appliquées ici :
 *   1. le vocabulaire dit ce que c'est — « configuration déclarée », pas « santé » ;
 *   2. UNE sonde réelle est ajoutée, sur la seule chose qu'un navigateur peut vérifier :
 *      l'API (`/api/health-extended`). Celle-là peut rougir, et son horodatage le dit.
 *
 * ⚠️ RESEND : dette CLOSE le 2026-08-15 — `GET /api/admin/integrations/resend` mesure
 * réellement le domaine d'expédition (bandeau dédié ci-dessous). Elle avait été écrite ici
 * comme « à sonder côté serveur » ; entre-temps un panneau qui SIMULAIT ce monitoring
 * (`Math.random()` sous un badge LIVE) avait pris sa place sur l'écran commerçant. **Une
 * dette écrite vaut mieux qu'une pastille rassurante — mais une dette écrite quelque part
 * n'empêche personne de la « combler » ailleurs avec de la fiction.**
 * TWILIO reste à sonder : dette assumée, toujours écrite plutôt que peinte en vert.
 *
 * ⚠️ SENTRY fait exception depuis le 2026-08-06, et pour une raison qui vaut d'être écrite :
 * sa sonde EXISTAIT DÉJÀ (`sentryStatusApi.check()`, vérification côté backend), mais elle
 * était appelée depuis la page COMMERÇANT — dont Sentry avait été retiré lors de
 * l'extraction de ce composant. Elle y écrivait une clé de plus que de cartes affichées, ce
 * qui produisait « 3/2 OK » et figeait « Vérification en cours… » pour toujours. La sonde
 * n'était donc pas manquante : elle était au mauvais endroit. Elle vit ici, avec sa carte.
 */
function useSentryProbe() {
  const [etat, setEtat] = useState<{ ok: boolean | null; ms: number | null }>({ ok: null, ms: null })
  useEffect(() => {
    let vivant = true
    sentryStatusApi.check()
      .then(r => { if (vivant) setEtat({ ok: r.connected, ms: r.ms }) })
      .catch(() => { if (vivant) setEtat({ ok: false, ms: null }) })
    return () => { vivant = false }
  }, [])
  return etat
}

/**
 * SONDE D'EXPÉDITION E-MAIL — la dette « Resend reste à sonder côté serveur » est CLOSE.
 *
 * ⚠️ Ce qu'elle mesure est étroit ET choisi : **le domaine d'où nous expédions est-il
 * vérifié ?** Tant que la réponse est `resend.dev`, nous partageons la réputation
 * d'expéditeurs inconnus et rien ne relie nos e-mails à HabaShop. C'est le seul fait de
 * cet écran qui change une décision.
 *
 * ⚠️ Elle NE relaie PAS le flux des e-mails : ces réponses portent les adresses des
 * clients de nos commerçants (cf. `resendAccountStatus` côté serveur). Le panneau
 * supprimé, lui, en INVENTAIT.
 */
function useResendProbe() {
  const [etat, setEtat] = useState<{ compte: ResendAccount | null; a: number | null }>({ compte: null, a: null })
  useEffect(() => {
    let vivant = true
    resendAccountApi.get()
      .then(r => { if (vivant) setEtat({ compte: r, a: Date.now() }) })
      // ⚠️ Un échec réseau laisse `compte` à `null` : l'écran reste MUET, jamais rassurant.
      .catch(() => { if (vivant) setEtat({ compte: null, a: Date.now() }) })
    return () => { vivant = false }
  }, [])
  return etat
}

function useApiProbe() {
  const [etat, setEtat] = useState<{ ok: boolean | null; a: number | null; ms: number | null }>({ ok: null, a: null, ms: null })
  useEffect(() => {
    let vivant = true
    const sonder = async () => {
      const t0 = Date.now()
      try {
        const r = await fetch(`${API_BASE}/api/health-extended`, { signal: AbortSignal.timeout(6000), cache: 'no-store' })
        if (vivant) setEtat({ ok: r.ok, a: Date.now(), ms: Date.now() - t0 })
      } catch {
        if (vivant) setEtat({ ok: false, a: Date.now(), ms: null })
      }
    }
    sonder()
    const id = setInterval(sonder, 30_000)
    return () => { vivant = false; clearInterval(id) }
  }, [])
  return etat
}

export default function OpsInfrastructure() {
  const lang = useAppStore(s => s.lang)
  const infra = INTEGRATIONS_LIST.filter(itg => OPS_CATS.has(CATEGORY_OF[itg.id]))
  const probe = useApiProbe()
  const sentry = useSentryProbe()
  const resend = useResendProbe()
  const [maintenant, setMaintenant] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setMaintenant(Date.now()), 1000); return () => clearInterval(id) }, [])
  const ilYA = probe.a === null ? null : Math.max(0, Math.round((maintenant - probe.a) / 1000))

  return (
    <>
      {/* ── LA SEULE SONDE RÉELLE — elle peut rougir, et elle est datée ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12,
        padding: '10px 14px', borderRadius: 12,
        background: probe.ok === false ? 'color-mix(in srgb, var(--danger) 8%, var(--card))' : 'var(--card)',
        border: `1px solid ${probe.ok === false ? 'var(--danger)' : 'var(--border)'}`,
      }}>
        <span aria-hidden="true" style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: probe.ok === null ? 'var(--text4)' : probe.ok ? 'var(--acc2)' : 'var(--danger)',
        }}/>
        <span style={{ fontSize: 13.5, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
          API {probe.ok === null
            ? (lang === 'en' ? 'checking…' : lang === 'es' ? 'verificando…' : lang === 'it' ? 'verifica…' : 'vérification…')
            : probe.ok
              ? (lang === 'en' ? 'responding' : lang === 'es' ? 'responde' : lang === 'it' ? 'risponde' : 'répond')
              : (lang === 'en' ? 'NOT responding' : lang === 'es' ? 'NO responde' : lang === 'it' ? 'NON risponde' : 'NE répond PAS')}
        </span>
        {probe.ms !== null && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{probe.ms} ms</span>}
        {ilYA !== null && (
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>
            {lang === 'en' ? `checked ${ilYA}s ago` : lang === 'es' ? `verificado hace ${ilYA}s` : lang === 'it' ? `verificato ${ilYA}s fa` : `vérifié il y a ${ilYA} s`}
          </span>
        )}
      </div>

      {/* ── SONDE D'EXPÉDITION E-MAIL — mesurée, datée, capable de ne PAS conclure ── */}
      {(() => {
        const c = resend.compte
        // ⚠️ QUATRE états de rendu, et l'ordre est celui de la PRUDENCE : tant qu'on n'a
        // rien reçu, on n'est pas optimiste ; quand on a reçu sans pouvoir conclure, on
        // dit POURQUOI ; le vert est le dernier cas, jamais le premier.
        const verifie = c?.domaineVerifie ?? null
        const ton = verifie === true ? 'var(--acc2)' : verifie === false ? 'var(--warn)' : 'var(--text4)'
        const cause = !c
          ? (lang === 'en' ? 'probe unavailable' : lang === 'es' ? 'sonda no disponible' : lang === 'it' ? 'sonda non disponibile' : 'sonde indisponible')
          : c.echec === 'NOT_CONFIGURED'
          ? (lang === 'en' ? 'no API key on the server' : lang === 'es' ? 'sin clave API en el servidor' : lang === 'it' ? 'nessuna chiave API sul server' : 'aucune clé API sur le serveur')
          : c.echec === 'UNREACHABLE'
          ? (lang === 'en' ? 'Resend API unreachable' : lang === 'es' ? 'API Resend inaccesible' : lang === 'it' ? 'API Resend irraggiungibile' : 'API Resend injoignable')
          : c.echec === 'UNEXPECTED_SHAPE'
          ? (lang === 'en' ? 'unexpected API response' : lang === 'es' ? 'respuesta inesperada de la API' : lang === 'it' ? 'risposta API inattesa' : 'réponse d’API inattendue')
          : !c.domaineExpedition
          /* ⚠️ TROUVÉ À L'ÉCRAN, pas en relisant : `domaines` lu correctement mais adresse
             d'expédition illisible donne `domaineVerifie: null` AVEC `echec: null` — donc
             un « non concluant » NU, qui n'explique rien. Un état non concluant qui ne dit
             pas pourquoi est un état muet, et c'est ce qu'on reprochait à l'ancien panneau. */
          ? (lang === 'en' ? 'sender address unreadable' : lang === 'es' ? 'dirección de envío ilegible' : lang === 'it' ? 'indirizzo mittente illeggibile' : 'adresse d’expédition illisible')
          : (lang === 'en' ? 'reason unknown' : lang === 'es' ? 'motivo desconocido' : lang === 'it' ? 'motivo sconosciuto' : 'motif inconnu')
        const ilYAResend = resend.a === null ? null : Math.max(0, Math.round((maintenant - resend.a) / 1000))
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12,
            padding: '10px 14px', borderRadius: 12, background: 'var(--card)',
            border: `1px solid ${verifie === false ? 'var(--warn)' : 'var(--border)'}`,
          }}>
            <span aria-hidden="true" style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: verifie === null ? 'transparent' : ton,
              border: `1px solid ${verifie === null ? 'var(--text4)' : ton}`,
            }}/>
            <span style={{ fontSize: 13.5, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
              {lang === 'en' ? 'Email sending domain' : lang === 'es' ? 'Dominio de envío de emails' : lang === 'it' ? 'Dominio di invio email' : 'Domaine d’expédition e-mail'}
            </span>
            {/* Le domaine RÉELLEMENT employé, lu côté serveur — plus un littéral du dépôt. */}
            {c?.domaineExpedition && (
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text2)', fontFamily: 'var(--mono)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px' }}>
                {c.domaineExpedition}
              </span>
            )}
            <span style={{ fontSize: 'var(--fs-caption)', color: ton, fontWeight: 'var(--fw-semibold)' }}>
              {verifie === true
                ? (lang === 'en' ? 'verified' : lang === 'es' ? 'verificado' : lang === 'it' ? 'verificato' : 'vérifié')
                : verifie === false
                /* ⚠️ On NOMME la conséquence : « non vérifié » seul ne dit pas ce qu'on risque. */
                ? (lang === 'en' ? 'NOT verified — shared sender reputation' : lang === 'es' ? 'NO verificado — reputación de envío compartida' : lang === 'it' ? 'NON verificato — reputazione di invio condivisa' : 'NON vérifié — réputation d’expédition partagée')
                : `${lang === 'en' ? 'not concluded' : lang === 'es' ? 'no concluyente' : lang === 'it' ? 'non concludente' : 'non concluant'}${cause ? ` — ${cause}` : ''}`}
            </span>
            {ilYAResend !== null && (
              <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>
                {lang === 'en' ? `checked ${ilYAResend}s ago` : lang === 'es' ? `verificado hace ${ilYAResend}s` : lang === 'it' ? `verificato ${ilYAResend}s fa` : `vérifié il y a ${ilYAResend} s`}
              </span>
            )}
          </div>
        )
      })()}

      {/* ⚠️ Ci-dessous : CONFIGURATION DÉCLARÉE, pas mesure — SAUF Sentry, qui est sondé. */}
      <p style={{ margin: '0 0 10px', fontSize: 'var(--fs-caption)', color: 'var(--text3)', lineHeight: 1.5 }}>
        {lang === 'en' ? 'Below: declared configuration, not a live check — these dots read a repository constant and cannot turn red. Sentry is the exception: it is actually probed.'
         : lang === 'es' ? 'Abajo: configuración declarada, no una verificación — estos puntos leen una constante del repositorio y no pueden ponerse en rojo. Sentry es la excepción: sí se verifica.'
         : lang === 'it' ? 'Sotto: configurazione dichiarata, non una verifica — questi punti leggono una costante del repository e non possono diventare rossi. Sentry fa eccezione: è realmente verificato.'
         : 'Ci-dessous : configuration DÉCLARÉE, pas une vérification — ces pastilles lisent une constante du dépôt et ne peuvent pas rougir. Sentry fait exception : il est réellement sondé.'}
      </p>
    <ResponsiveGrid min={260} gap={12}>
      {infra.map(itg => {
        // ⚠️ Sentry est SONDÉ ; les autres sont DÉCLARÉS. Ne pas fondre les deux : c'est
        // toute la différence entre une pastille qui peut rougir et une qui ne le peut pas.
        const sonde  = itg.id === 'sentry'
        const ok = sonde ? sentry.ok === true : itg.declared === 'configured'
        const detail = CARD_DETAIL[itg.id]?.[lang] ?? CARD_DETAIL[itg.id]?.fr
        return (
          <div key={itg.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><itg.IconSvg /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{itg.name}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itg.endpoint}</div>
              </div>
              {/* ⚠️ GRIS, JAMAIS VERT — le SIGNAL prime sur la phrase.
                  La légende disait que ces pastilles ne peuvent pas rougir, et le point
                  vert disait le contraire ; entre les deux, l'œil croit la couleur. Le
                  vert est réservé à ce qui a été VÉRIFIÉ — aujourd'hui, la seule sonde
                  réelle est celle de l'API, en tête de ce panneau. Ici on distingue
                  seulement « déclaré configuré » (gris plein) de « déclaré absent »
                  (gris creux) : deux états d'un fichier, pas deux états d'une machine. */}
              <span title={sonde
                ? sentry.ok === null
                  ? (lang === 'en' ? 'Probing…' : lang === 'es' ? 'Verificando…' : lang === 'it' ? 'Verifica…' : 'Vérification en cours…')
                  : sentry.ok
                  ? (lang === 'en' ? `Probed — reachable${sentry.ms !== null ? ` (${sentry.ms}ms)` : ''}` : lang === 'es' ? `Verificado — accesible${sentry.ms !== null ? ` (${sentry.ms}ms)` : ''}` : lang === 'it' ? `Verificato — raggiungibile${sentry.ms !== null ? ` (${sentry.ms}ms)` : ''}` : `Sondé — joignable${sentry.ms !== null ? ` (${sentry.ms} ms)` : ''}`)
                  : (lang === 'en' ? 'Probed — unreachable' : lang === 'es' ? 'Verificado — inaccesible' : lang === 'it' ? 'Verificato — irraggiungibile' : 'Sondé — injoignable')
                : ok
                ? (lang === 'en' ? 'Declared as configured — not probed' : lang === 'es' ? 'Declarado configurado — sin verificar' : lang === 'it' ? 'Dichiarato configurato — non verificato' : 'Déclaré configuré — non vérifié')
                : (lang === 'en' ? 'Declared as not configured' : lang === 'es' ? 'Declarado no configurado' : lang === 'it' ? 'Dichiarato non configurato' : 'Déclaré non configuré')}
                style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, boxShadow: 'none',
                  // ⚠️ Le VERT et le ROUGE sont réservés à ce qui a été sondé. Le gris dit
                  // « déclaré » et le gris creux « déclaré absent » — deux états d'un fichier.
                  background: sonde
                    ? (sentry.ok === null ? 'transparent' : sentry.ok ? 'var(--acc2)' : 'var(--danger)')
                    : (ok ? 'var(--text3)' : 'transparent'),
                  border: `1px solid ${sonde && sentry.ok !== null ? (sentry.ok ? 'var(--acc2)' : 'var(--danger)') : 'var(--text4)'}`,
                }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 'var(--fs-caption)' }}>
              <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px' }}>{API_VERSION[itg.id]}</span>
              {detail && <span style={{ color: 'var(--text3)' }}>{detail}</span>}
            </div>
          </div>
        )
      })}
    </ResponsiveGrid>
    </>
  )
}
