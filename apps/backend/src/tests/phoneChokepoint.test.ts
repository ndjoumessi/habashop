import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

/**
 * MÉTA-TEST — un seul endroit résout un numéro.
 *
 * Volontairement SÉPARÉ de `spendGuardAllowlist.test.ts` : celui-ci garde les SDK
 * FACTURÉS (un échec = fuite d'argent). Ici il n'y a pas un centime en jeu, mais un
 * message livré au mauvais destinataire. Mélanger les deux rendrait chaque échec
 * ambigu au moment où il faut comprendre vite.
 *
 * Ce que ça empêche concrètement : les quatre reverts ont tous ajouté leur
 * transformation à un endroit DIFFÉRENT (lib/spend/phone.ts, lib/phoneE164.ts,
 * SendAudience, le mapping des campagnes). Une pré-transformation en AMONT ne
 * contourne pas seulement le goulot — elle le TROMPE : un `+` collé avant l'appel
 * arrive comme un « international explicite » et passe le garde.
 *
 * ⚠️ RÉSIDU ASSUMÉ — ce scan interdit les motifs de fabrication CONNUS (`'+' + x`,
 * `` `+${x}` ``, `replace(/^0/)`, `replace(/^00/, '+')`), c'est-à-dire ceux qui ont
 * réellement fui. Un futur appelant qui fabriquerait un faux international par un
 * motif INÉDIT (concaténation via une variable, `String.fromCharCode(43)`, une
 * fonction utilitaire tierce…) passerait au travers. Ce n'est PAS une preuve
 * d'exhaustivité, et il ne faut pas la lire comme telle.
 *
 * La protection est EN COUCHES, pas absolue :
 *   1. le paramètre `owner` OBLIGATOIRE — un nouveau chemin d'envoi ne compile pas
 *      sans déclarer à qui appartient le numéro (c'est la couche la plus solide,
 *      parce qu'elle ne dépend d'aucune reconnaissance de motif) ;
 *   2. ce scan, qui attrape les récidives des quatre motifs historiques ;
 *   3. `phoneCollision.test.ts`, à faire tourner sur TOUT nouveau chemin d'envoi —
 *      c'est lui, et non ce scan, qui décide si un chemin est sûr.
 */

const SRC = join(__dirname, '..')
const RESOLVER = 'lib/spend/recipientPhone.ts'

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p, acc) }
    else if (e.endsWith('.ts')) acc.push(p)
  }
  return acc
}
const files = walk(SRC).map(f => ({ rel: relative(SRC, f).split('\\').join('/'), src: readFileSync(f, 'utf8') }))

describe('Goulot de résolution téléphonique (méta-test)', () => {
  it('libphonenumber-js n’est importé QUE par le résolveur', () => {
    const re = /from\s+['"]libphonenumber-js['"]|require\(\s*['"]libphonenumber-js['"]\s*\)/
    const offenders = files
      .filter(f => f.rel !== RESOLVER && !f.rel.startsWith('tests/') && re.test(f.src))
      .map(f => f.rel)

    expect(offenders, `Toute résolution doit passer par ${RESOLVER} :\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('aucune fabrication de « + » à la main sur la surface d’envoi', () => {
    // Motifs exacts des quatre fuites : `'+' + x`, `` `+${x}` ``, `replace(/^0/, '')`,
    // `replace(/^00/, '+')`. Restreint aux fichiers qui manipulent des numéros.
    const SURFACE = /whatsapp|twilioClient|phone/i
    const FABRICATIONS: { label: string; re: RegExp }[] = [
      { label: "concaténation `'+' +`",        re: /['"]\+['"]\s*\+/ },
      { label: 'gabarit `+${…}`',              re: /`\+\$\{/ },
      { label: 'strip du zéro de tête',        re: /replace\(\s*\/\^0/ },
      { label: 'réécriture `00` → `+`',        re: /replace\(\s*\/\^00\/\s*,\s*['"]\+['"]/ },
    ]
    // `redactPhone.ts` construit un AFFICHAGE caviardé (`+221****4567`) destiné aux
    // journaux. Sa sortie n'est jamais composée ni transmise à Twilio — l'exclure ne
    // rouvre donc aucun chemin d'envoi.
    const HORS_SURFACE_ENVOI = ['lib/redactPhone.ts']

    const offenders: string[] = []
    for (const f of files) {
      if (f.rel === RESOLVER || f.rel.startsWith('tests/')) continue
      if (HORS_SURFACE_ENVOI.includes(f.rel)) continue
      if (!SURFACE.test(f.rel)) continue
      for (const { label, re } of FABRICATIONS) {
        f.src.split('\n').forEach((line, i) => {
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return // commentaires
          if (re.test(line)) offenders.push(`${f.rel}:${i + 1} — ${label}`)
        })
      }
    }
    expect(offenders, `Numéro fabriqué à la main hors du résolveur :\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  // Contre-preuve : le scan détecte-t-il réellement une violation ?
  it('le scan détecte bien une fabrication (contre-preuve)', () => {
    const echantillon = "const p = phone.startsWith('+') ? phone : '+' + phone.replace(/^0/, '')"
    expect(/['"]\+['"]\s*\+/.test(echantillon)).toBe(true)
    expect(/replace\(\s*\/\^0/.test(echantillon)).toBe(true)
  })
})
