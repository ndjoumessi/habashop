import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * AUCUNE SOUMISSION N'AVALE UNE ERREUR SERVEUR.
 *
 * ─── LE DÉFAUT ───────────────────────────────────────────────────────────────
 * Mesuré le 2026-08-08 : SEPT sites écrivaient `xxxApi.update(...).catch(() => {})`
 * juste après avoir mis à jour le store local et affiché un toast de SUCCÈS. Le pire —
 * l'Onboarding — envoyait nom, téléphone, adresse, pays et TVA dans un PATCH unique,
 * jetait le refus, marquait l'onboarding terminé et affichait l'écran de succès. Les
 * cinq champs n'existaient nulle part et disparaissaient au prochain `/me`.
 *
 * Ce trou est PRÉEXISTANT : il a seulement été RÉVÉLÉ par le garde de zone franc CFA,
 * qui a rendu le refus atteignable. Il est corrigé pour lui-même, pas comme un effet
 * du garde — un `.catch(() => {})` sur une écriture est faux même quand rien ne refuse.
 *
 * ⚠️ PÉRIMÈTRE DÉRIVÉ, jamais listé : toute l'arborescence `src/`, hors tests. Un
 * périmètre écrit à la main est faux dès qu'on ajoute un fichier, et l'assertion de
 * couverture ne le dirait pas — elle prouve qu'on a lu N fichiers, jamais que N était
 * le bon N.
 */

const RACINE = join(__dirname, '..')
const IGNORÉS = new Set(['tests', 'node_modules', '__tests__'])

function fichiersSource(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (!IGNORÉS.has(e)) fichiersSource(p, acc)
    } else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) {
      acc.push(p)
    }
  }
  return acc
}

/** Commentaires retirés : sinon la règle interdit d'EXPLIQUER ce qu'elle interdit. */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * Une ÉCRITURE d'API dont le refus est jeté — en UN SEUL motif, et c'est délibéré.
 *
 * ⚠️ La première version testait deux regex sur la MÊME LIGNE. Mesuré le 2026-08-08 :
 * une chaîne coupée en deux lui échappait entièrement —
 *     tenantApi.update(p)
 *       .catch(() => {})
 * — c'est-à-dire la mise en forme que produit n'importe quel reformatage dès que la
 * ligne dépasse la largeur. Le verrou cherchait une forme qu'un espace blanc suffit à
 * faire disparaître : l'angle mort « forme », logé dans le détecteur lui-même.
 *
 * Le motif est ancré aux DEUX bouts (l'appel d'écriture ET le catch vide) : le `\s*`
 * entre les deux ne peut donc pas déborder sur un `catch` sans rapport situé plus bas.
 * `(?:[^()]|\([^()]*\))*` couvre un niveau d'imbrication dans les arguments.
 */
const AVALE_ÉCRITURE =
  /\b\w+Api\.(?:create|update|remove|delete|patch|post|put|save|send|upload|import)\w*\s*\((?:[^()]|\([^()]*\))*\)\s*\.catch\(\s*\(\s*_?\s*\)\s*=>\s*\{\s*\}\s*\)/g

/** Vrai si le texte contient la forme fautive. Réinitialise `lastIndex` : `/g` + `.test()` est à état. */
const avale = (src: string): boolean => {
  AVALE_ÉCRITURE.lastIndex = 0
  return AVALE_ÉCRITURE.test(src)
}

/**
 * ─── LA SECONDE FORME, AJOUTÉE LE 2026-08-12 ─────────────────────────────────
 * Le motif ci-dessus ne voit que la forme CHAÎNÉE. `try { await xxxApi.update(…) }
 * catch {}` lui échappait entièrement — et le balayage en a trouvé **CINQ**, dont
 * trois dans `Stock.tsx`, plus un client et une dépense. Mon relevé À LA MAIN n'en
 * avait vu que deux : c'est la mesure qui a trouvé les trois autres.
 *
 * ⚠️ APPARIEMENT D'ACCOLADES, JAMAIS UNE REGEX. Un `try` contient des blocs
 * imbriqués ; une expression régulière s'arrête au premier `}` venu et rend un
 * verdict au hasard. Même raison que `blocsSelect` côté backend.
 *
 * ⚠️ Un `catch` qui FAIT quelque chose n'est pas fautif — `Expenses.tsx` en a un
 * qui affiche puis sort, et il ne doit pas être signalé. Ce qui est jugé, c'est le
 * catch VIDE sur une ÉCRITURE : la lecture silencieuse reste légitime, rien n'a été
 * promis à l'utilisateur.
 */
const ÉCRITURE_API =
  /\b\w+Api\.(?:create|update|remove|delete|patch|post|put|save|send|upload|import)\w*\s*\(/

function finDeBloc(src: string, ouvrante: number): number {
  let prof = 0
  for (let k = ouvrante; k < src.length; k++) {
    if (src[k] === '{') prof++
    else if (src[k] === '}') { prof--; if (prof === 0) return k }
  }
  return -1
}

function sitesTryCatchVide(src: string): { index: number; extrait: string }[] {
  const trouvés: { index: number; extrait: string }[] = []
  const re = /\btry\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const ouvT = m.index + m[0].length - 1
    const finT = finDeBloc(src, ouvT)
    if (finT < 0) continue
    const corpsTry = src.slice(ouvT + 1, finT)
    const mc = /^\s*catch\s*(\([^)]*\))?\s*\{/.exec(src.slice(finT + 1))
    if (!mc) continue
    const ouvC = finT + 1 + mc[0].length - 1
    const finC = finDeBloc(src, ouvC)
    if (finC < 0) continue
    if (src.slice(ouvC + 1, finC).trim() !== '') continue   // le catch fait quelque chose
    if (!ÉCRITURE_API.test(corpsTry)) continue              // pas une écriture d'API
    trouvés.push({ index: m.index, extrait: corpsTry.replace(/\s+/g, ' ').trim().slice(0, 110) })
  }
  return trouvés
}

function sitesFautifs(): { fichier: string; ligne: number; extrait: string }[] {
  const trouvés: { fichier: string; ligne: number; extrait: string }[] = []
  for (const f of fichiersSource(RACINE)) {
    // Le fichier ENTIER, pas ligne à ligne — sinon une chaîne coupée passe au travers.
    const src = sansCommentaires(readFileSync(f, 'utf-8'))
    AVALE_ÉCRITURE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = AVALE_ÉCRITURE.exec(src)) !== null) {
      trouvés.push({
        fichier: f.slice(RACINE.length + 1),
        ligne: src.slice(0, m.index).split('\n').length,
        extrait: m[0].replace(/\s+/g, ' ').slice(0, 110),
      })
    }
    for (const t of sitesTryCatchVide(src)) {
      trouvés.push({
        fichier: f.slice(RACINE.length + 1),
        ligne: src.slice(0, t.index).split('\n').length,
        extrait: `try { ${t.extrait} } catch {}`,
      })
    }
  }
  return trouvés
}

describe('aucune soumission n’avale une erreur serveur', () => {
  it('le scan COUVRE l’arborescence — un walk cassé rendrait une liste vide, donc un vert qui ne garde rien', () => {
    const fs = fichiersSource(RACINE)
    expect(fs.length).toBeGreaterThan(150)
    // et il atteint bien les deux endroits où le défaut vivait
    expect(fs.some(f => f.endsWith('pages/Onboarding.tsx'))).toBe(true)
    expect(fs.some(f => f.endsWith('components/hr/tabs/PayrollBonuses.tsx'))).toBe(true)
  })

  it('AUCUN appel d’écriture d’API ne jette son erreur', () => {
    const fautifs = sitesFautifs()
    expect(
      fautifs.map(s => `${s.fichier}:${s.ligne}  ${s.extrait}`).join('\n'),
    ).toBe('')
  })

  // ── CONTRE-PREUVE : la règle doit DÉTECTER, pas seulement passer ──────────────
  it('détecte la forme exacte qui a été commise, dans ses variantes d’écriture', () => {
    for (const forme of [
      'await tenantApi.update(patch).catch(() => {})',
      'bonusesApi.delete(id).catch(()=>{})',
      'productsApi.create(x).catch( (  ) => {  } )',
      'customersApi.remove(id).catch((_) => {})',
      // ⚠️ LA VARIANTE QUI ÉCHAPPAIT À LA PREMIÈRE VERSION — une chaîne coupée en deux.
      // C'est la mise en forme que produit tout reformatage sur une ligne trop longue.
      'await tenantApi.update(p)\n  .catch(() => {})',
      // arguments contenant eux-mêmes un appel
      'tenantApi.update({ a: f(1) }).catch(() => {})',
    ]) {
      expect(avale(forme), forme).toBe(true)
    }
  })

  it('ne crie PAS au loup — un verrou qui déborde se fait désarmer', () => {
    for (const légitime of [
      // une LECTURE peut légitimement être silencieuse : rien n'a été promis à l'utilisateur
      'statsApi.get().catch(() => {})',
      'tenantApi.list().catch(() => {})',
      // un catch qui FAIT quelque chose n'est pas un catch qui avale
      'tenantApi.update(p).catch(() => toast.error(msg))',
      'tenantApi.update(p).catch(e => setError(e.message))',
      // et ce qui n'est pas un appel d'API du tout
      'window.matchMedia(q).catch(() => {})',
      // une écriture SANS catch n'est pas fautive
      'tenantApi.update(p).then(ok)',
      // ⚠️ LA CONTRE-ÉPREUVE DU MULTI-LIGNE : autoriser le saut de ligne ne doit PAS
      // faire rejoindre une écriture à un `catch` sans rapport situé plus bas.
      'tenantApi.update(p)\nconst x = 1\nfoo.catch(() => {})',
    ]) {
      expect(avale(légitime), légitime).toBe(false)
    }
  })

  it('⚠️ détecte la forme try/catch VIDE — celle qui a échappé au verrou pendant quatre jours', () => {
    // Formes RÉELLES, copiées des cinq sites trouvés le 2026-08-12.
    for (const forme of [
      'try { await productsApi.update(editingId, apiBody) } catch {}',
      'try { await customersApi.update(id, { name }) } catch {}',
      'try {\n  const c = await expensesApi.create(x)\n  e._apiId = c.id\n} catch {}',
      'try { await productsApi.update(p._id, { barcode }); ok.push(s) } catch {}',
      'try { await tenantApi.update(p) } catch (e) {}',
      'try { await tenantApi.update(p) } catch (_) {  }',
      // imbrication : une regex s'arrêterait au premier `}` du bloc interne
      'try { if (x) { await productsApi.create(a) } } catch {}',
    ]) {
      expect(sitesTryCatchVide(forme).length, forme).toBe(1)
    }
  })

  it('⚠️ la forme try/catch ne crie PAS au loup', () => {
    for (const légitime of [
      // un catch qui FAIT quelque chose — le cas réel d'Expenses.tsx
      'try { await expensesApi.delete(id) } catch { toast.error(m); return }',
      // une LECTURE silencieuse reste légitime : rien n'a été promis
      'try { await statsApi.get() } catch {}',
      'try { const r = await tenantApi.list() } catch {}',
      // un try/catch vide SANS écriture d'API
      'try { JSON.parse(x) } catch {}',
      // une écriture avec un catch qui journalise
      'try { await productsApi.create(a) } catch (e) { logger.warn(e) }',
    ]) {
      expect(sitesTryCatchVide(légitime).length, légitime).toBe(0)
    }
  })

  it('le commentaire qui MENTIONNE la forme interdite ne la déclenche pas', () => {
    const src = `// interdit : tenantApi.update(p).catch(() => {})\nconst x = 1\n`
    expect(avale(sansCommentaires(src))).toBe(false)
  })
})
