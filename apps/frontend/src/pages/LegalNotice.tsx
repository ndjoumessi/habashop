import { useEffect } from 'react'
import { appUrl, appUrlHost } from '@/lib/appUrl'

/**
 * MENTIONS LÉGALES — `/mentions-legales`.
 *
 * ⚠️ L'APPLICATION N'EN AVAIT AUCUNE jusqu'au 2026-09-12. Un site professionnel doit
 * identifier son éditeur, son directeur de la publication et son hébergeur (LCEN,
 * art. 6-III) — et `legal/index.html` s'intitulait déjà « Mentions légales » sans en
 * contenir une seule.
 *
 * ⚠️ RIEN N'EST INVENTÉ ICI. L'identité et le siège viennent de l'attestation RNE du
 * 10/09/2026 ; l'hébergement vient de l'infrastructure RÉELLE (Vercel sert l'application,
 * Railway l'API et la base, GitHub Pages les documents de `legal/`), et chaque adresse
 * d'hébergeur a été lue sur la page légale officielle du prestataire. Le téléphone, que la
 * loi demande et que l'attestation ne porte pas, a été fourni par l'éditeur le 2026-09-12.
 *
 * ⚠️ SOURCE UNIQUE : `docs/shared-fixtures/publisher.json`. Cette page et son jumeau statique
 * `legal/mentions-legales.html` portent les valeurs en dur (une page statique ne peut rien
 * importer) ; `publisherIdentity.test.ts` les confronte à la fixture et échoue si l'une dérive.
 *
 * ⚠️ « RNE », JAMAIS « RCS » : l'activité est libérale non réglementée, l'éditeur n'est pas
 * commerçant. Et la date de naissance, présente sur l'attestation, n'a rien à faire ici.
 */

const lien = { color: '#6C47FF' } as const

export default function LegalNotice() {
  useEffect(() => {
    document.title = 'Mentions légales — HabaShop'
  }, [])

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: 'system-ui, sans-serif',
      color: '#1a1a2e',
      lineHeight: 1.7,
    }}>
      <div style={{ marginBottom: 40 }}>
        <a href="/" style={{ color: '#6C47FF', textDecoration: 'none', fontSize: 'var(--fs-body)' }}>
          ← Retour à HabaShop
        </a>
      </div>

      <h1 style={{ color: '#6C47FF', marginBottom: 8 }}>Mentions légales</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>
        Dernière mise à jour : 12 septembre 2026
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2>1. Éditeur</h2>
        <p>
          Le service HabaShop, accessible sur{' '}
          <a href={appUrl()} style={lien}>{appUrlHost()}</a>, est édité par{' '}
          <strong>Nelson Djoumessi</strong>, <strong>entrepreneur individuel</strong>.
        </p>
        <ul>
          <li>Immatriculation : Registre national des entreprises (RNE)</li>
          <li>SIREN : 109 761 023 — SIRET : 109 761 023 00018</li>
          <li>Code APE : 6201Z</li>
          <li>Siège : 71 rue de Rome, 13001 Marseille, France</li>
          <li>
            E-mail :{' '}
            <a href="mailto:romel.djoumessi@gmail.com" style={lien}>romel.djoumessi@gmail.com</a>
          </li>
          <li>Téléphone : <a href="tel:+33661751923" style={lien}>+33 6 61 75 19 23</a></li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>2. Directeur de la publication</h2>
        <p>Nelson Djoumessi.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>3. Hébergement</h2>
        <ul>
          <li>
            <strong>Application web</strong> — Vercel Inc., 440 N Barranca Ave #4133, Covina,
            CA 91723, États-Unis.
          </li>
          <li>
            <strong>API et base de données</strong> — Railway Corporation, 548 Market St
            PMB 68956, San Francisco, CA 94104, États-Unis.
          </li>
          <li>
            <strong>Documents légaux publics</strong> — GitHub, Inc., 88 Colin P. Kelly Jr.
            St., San Francisco, CA 94107, États-Unis.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>4. Données personnelles</h2>
        <p>
          Le traitement des données personnelles est décrit dans la{' '}
          <a href="/privacy" style={lien}>politique de confidentialité</a>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>5. Conditions d'utilisation</h2>
        <p>
          L'accès au service et sa souscription sont régis par les{' '}
          <a href="/terms" style={lien}>conditions générales d'utilisation et de vente</a>.
        </p>
      </section>
    </div>
  )
}
