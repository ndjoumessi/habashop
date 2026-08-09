import { resolveDemoMode, DEMO_ACCOUNTS, DEMO_PASSWORD } from '../lib/demoAccounts'

/**
 * RACCOURCI DÉMO MOBILE — le drapeau, et surtout CE QU'IL NE FAIT PAS.
 *
 * ─── CE QUI EST GARDÉ ICI ────────────────────────────────────────────────────
 * La RÈGLE de résolution du drapeau. Le défaut doit être ÉTEINT : avant ce
 * chantier, `app/(auth)/login.tsx` affichait cinq boutons de connexion démo sans
 * aucune condition, dans CHAQUE build — y compris celui du store.
 *
 * ─── ⚠️ LIMITE MESURÉE, À NE PAS LAISSER CROIRE COUVERTE ─────────────────────
 * Côté WEB, `verify:demo-flag` prouve que `demo1234` est ABSENT du `dist/` livré :
 * Rollup élimine le chunk parce que l'`import()` vit dans la branche.
 * **Sur mobile, ce n'est PAS le cas, et c'est mesuré, pas supposé.** Deux
 * `npx expo export --platform android` (2026-08-09), drapeau absent puis à `1` :
 *
 *   EXPO_PUBLIC_DEMO_MODE   éteint=0  allumé=0   ← la substitution a bien lieu
 *   demo1234                éteint=1  allumé=1   ← la chaîne RESTE dans les deux
 *   admin@habashop.com      éteint=1  allumé=1
 *   « Demo accounts: »      éteint=1  allumé=1
 *   taille du .hbc          6 396 969 octets dans les deux cas
 *
 * Metro n'élimine pas la branche morte comme le fait Rollup. Le drapeau MASQUE
 * les boutons à l'exécution ; il ne retire rien de l'artefact. Écrire l'inverse
 * ici serait une garantie de sûreté posée par RAISONNEMENT — la faute exacte qui
 * a produit trois fuites de numéros dans ce dépôt.
 *
 * Ce n'est pas grave, et il faut savoir pourquoi : le mot de passe démo est PUBLIC
 * (README, SETUP.md, dépôt public) et ce sont les tenants `isDemo` qui bornent le
 * coût côté serveur. Ce qu'on corrige, c'est qu'un commerçant réel voyait des
 * boutons de connexion démo — pas une exposition de secret.
 */

describe('drapeau du raccourci démo', () => {
  it('⚠️ DÉFAUT ÉTEINT — absent, vide, ou toute autre valeur', () => {
    // Un défaut allumé serait exactement le défaut qu'on corrige.
    expect(resolveDemoMode(undefined)).toBe(false)
    expect(resolveDemoMode('')).toBe(false)
    expect(resolveDemoMode('0')).toBe(false)
    expect(resolveDemoMode('true')).toBe(false)
    expect(resolveDemoMode('yes')).toBe(false)
    expect(resolveDemoMode(1)).toBe(false) // le nombre 1 n'est pas la chaîne '1'
    expect(resolveDemoMode(null)).toBe(false)
  })

  it('seule la chaîne « 1 » allume — même convention que VITE_DEMO_MODE côté web', () => {
    expect(resolveDemoMode('1')).toBe(true)
  })

  it('les 5 comptes démo portent des adresses distinctes', () => {
    const emails = DEMO_ACCOUNTS.map(a => a.email)
    expect(emails).toHaveLength(5)
    // un doublon rendrait un bouton inatteignable
    expect(new Set(emails).size).toBe(5)
    expect(DEMO_PASSWORD).not.toBe('')
  })

  it('⚠️ le mot de passe n’est PLUS déclaré dans app/ — la logique vit dans src/lib', () => {
    /**
     * Règle mobile n°9 : `app/` = ROUTES uniquement, la logique pure va dans
     * `src/lib/`. Un `const DEMO_PASSWORD` posé à côté de l'écran était à la fois
     * une entorse à cette règle et la raison pour laquelle personne ne voyait que
     * le web gatait ce raccourci et pas le mobile.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const { join } = require('node:path') as typeof import('node:path')
    const src = readFileSync(join(__dirname, '../../app/(auth)/login.tsx'), 'utf8')

    // ⚠️ COUVERTURE : login.tsx illisible ou vide → tout ce qui suit serait vacant.
    expect(src.length).toBeGreaterThan(2000)
    // témoin positif : c'est bien l'écran de connexion qu'on a lu
    expect(src).toContain('LoginScreen')

    // le littéral est revenu dans app/ (entorse à la règle mobile n°9)
    expect(src).not.toContain("= 'demo1234'")
    // le rendu doit rester gardé par le drapeau
    expect(src).toContain('DEMO_MODE &&')
  })
})
