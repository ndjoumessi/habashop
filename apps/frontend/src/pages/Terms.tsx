import { useEffect } from 'react'
import { appUrl, appUrlHost } from '@/lib/appUrl'
import { PLANS, YEARLY_MONTHS } from '@/lib/plans'

/**
 * CONDITIONS GÉNÉRALES D'UTILISATION ET DE VENTE — `/terms`.
 *
 * ⚠️ CE DOCUMENT N'A PAS ÉTÉ RELU PAR UN JURISTE. Il a été rédigé à partir de ce que le
 * produit FAIT réellement (mesuré dans le code le 2026-08-15), pas d'un modèle générique :
 * essai de 14 jours (`routes/auth.ts`), tarifs de `lib/plans.ts`, statuts d'abonnement de
 * `spendGuard.ts`, suppression de compte de `services/accountDeletion.ts`. Les points qu'un
 * commerçant ne peut pas déduire du code — forme juridique, immatriculation, droit
 * applicable — sont marqués À COMPLÉTER et RENDUS VISIBLES : un document qui invente une
 * identité légale est pire que pas de document.
 *
 * ⚠️ LES TARIFS NE SONT PAS RECOPIÉS ICI. Ils sont LUS dans `lib/plans.ts`, la source
 * unique — un prix écrit à la main dans des conditions de vente se périme au premier
 * changement de grille, et il se périme en silence.
 *
 * ⚠️ Divergence CONSTATÉE et non tranchée : `legal/privacy-policy.html` déclare
 * « Éditeur : HabaShop », `pages/Privacy.tsx` déclare « édité par Nelson Djoumessi ». Deux
 * documents publics, deux éditeurs. Ce fichier suit la page in-app, qui est celle vers
 * laquelle pointent le pied de page et le consentement d'inscription.
 */

const A_COMPLETER: React.CSSProperties = {
  background: '#FFF4D6', border: '1px solid #E0B341', borderRadius: 4,
  padding: '1px 6px', fontWeight: 700, color: '#6B4E00',
}

/** Marqueur visible d'une mention que seul l'éditeur peut renseigner. */
function AC({ children }: { children: React.ReactNode }) {
  return <span style={A_COMPLETER}>[À COMPLÉTER — {children}]</span>
}

export default function Terms() {
  useEffect(() => {
    document.title = "Conditions générales — HabaShop"
  }, [])

  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')
  const vendables = PLANS.filter(p => p.purchasable && p.monthly !== null)
  const surDevis  = PLANS.filter(p => p.monthly === null)

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

      <h1 style={{ color: '#6C47FF', marginBottom: 8 }}>
        Conditions générales d'utilisation et de vente
      </h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Dernière mise à jour : 15 août 2026
      </p>

      <div style={{
        background: '#FFF4D6', border: '1px solid #E0B341', borderRadius: 8,
        padding: '14px 16px', marginBottom: 40, fontSize: 'var(--fs-sm)', color: '#6B4E00',
      }}>
        <strong>Document en cours de validation juridique.</strong> Les mentions surlignées
        restent à compléter par l'éditeur. Jusqu'à leur renseignement et à une relecture
        professionnelle, ce texte décrit l'usage du service mais ne peut pas être invoqué
        comme un engagement contractuel complet.
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2>1. Objet</h2>
        <p>
          Les présentes conditions régissent l'accès et l'utilisation de HabaShop, logiciel
          de gestion commerciale accessible sur{' '}
          <a href={appUrl()} style={{ color: '#6C47FF' }}>{appUrlHost()}</a>. Elles forment
          un contrat entre l'éditeur et le commerçant qui souscrit un compte (« le Client »).
        </p>
        <p>
          La création d'un compte vaut acceptation sans réserve des présentes. Le Client qui
          n'y consent pas doit renoncer à utiliser le service.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>2. Éditeur</h2>
        <p>
          HabaShop est édité par <strong>Nelson Djoumessi</strong>{' '}
          (romel.djoumessi@gmail.com) — <AC>forme juridique, numéro d'immatriculation et
          adresse du siège</AC>.
        </p>
        <p>
          Contact commercial : contact@habashop.com · Support : support@habashop.com ·
          Données personnelles : voir la{' '}
          <a href="/privacy" style={{ color: '#6C47FF' }}>politique de confidentialité</a>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>3. Description du service</h2>
        <p>
          HabaShop est un logiciel en ligne (SaaS) de gestion pour commerces de détail :
          caisse, catalogue et stock, clients et fidélité, achats et fournisseurs,
          ressources humaines et paie, dépenses, rapports.
        </p>
        <h3>3.1 Ce que le service ne fait pas, à ce jour</h3>
        <p>
          Ces limites sont énoncées parce qu'elles conditionnent l'usage attendu :
        </p>
        <ul>
          <li>
            <strong>Aucun encaissement en ligne n'est opérationnel.</strong> Les intégrations
            de paiement mobile sont développées mais les comptes marchands ne sont pas
            ouverts : aucun paiement réel ne transite par le service. Les paiements
            enregistrés dans la caisse sont des <em>saisies</em> du commerçant, pas des
            transactions traitées par HabaShop.
          </li>
          <li>
            <strong>La caisse web exige une connexion.</strong> Il n'existe pas de
            persistance locale des ventes dans le navigateur : hors réseau, l'encaissement
            n'aboutit pas.
          </li>
          <li>
            <strong>L'application mobile n'est pas publiée.</strong> Les fonctions annoncées
            comme mobiles ne sont pas disponibles au public tant que la publication n'a pas
            eu lieu.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>4. Compte et période d'essai</h2>
        <p>
          L'inscription ouvre une période d'essai de <strong>14 jours</strong>, sans
          communication de moyen de paiement. À l'issue de cette période, l'accès aux
          fonctions facturées est suspendu tant qu'aucun abonnement n'est activé ; les
          données du Client sont conservées dans les conditions de l'article 9.
        </p>
        <p>
          Le Client est responsable de la confidentialité de ses identifiants et des actions
          effectuées depuis son compte. Il lui appartient de gérer les droits des
          utilisateurs qu'il invite dans sa boutique.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>5. Abonnements et tarifs</h2>
        <p>
          Les tarifs en vigueur, exprimés en francs CFA (XOF) <AC>hors taxes ou toutes taxes
          comprises, et régime de TVA applicable</AC>, sont :
        </p>
        <ul>
          {vendables.map(p => (
            <li key={p.id}>
              <strong>{p.label}</strong> — {fmt(p.monthly as number)} FCFA par mois, ou{' '}
              {fmt(p.yearly as number)} FCFA par an.
            </li>
          ))}
          {surDevis.map(p => (
            <li key={p.id}><strong>{p.label}</strong> — sur devis.</li>
          ))}
        </ul>
        <p>
          L'engagement annuel est facturé {YEARLY_MONTHS} mois pour douze mois d'usage.
        </p>
        <p>
          Les tarifs peuvent être modifiés. Toute modification est notifiée au Client et ne
          s'applique qu'à compter de la période de facturation suivante.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>6. Facturation et paiement</h2>
        <p>
          Le règlement s'effectue par les moyens proposés lors de la souscription. À ce jour,
          l'activation d'un abonnement est traitée manuellement par l'éditeur après demande
          du Client : aucun prélèvement automatique n'est en place.
        </p>
        <p>
          Un compte peut prendre les états suivants : essai, actif, paiement en attente,
          suspendu, résilié. En cas de défaut de paiement, l'éditeur peut suspendre l'accès
          après <AC>délai de relance avant suspension</AC>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>7. Obligations du Client</h2>
        <p>Le Client s'engage à :</p>
        <ul>
          <li>fournir des informations exactes lors de l'inscription et les tenir à jour ;</li>
          <li>
            n'utiliser le service que dans le cadre d'une activité licite, et respecter la
            réglementation applicable à son commerce — notamment en matière fiscale, de
            facturation et de conservation des pièces comptables ;
          </li>
          <li>ne pas tenter d'accéder aux données d'une autre boutique ;</li>
          <li>
            ne pas soumettre le service à une charge manifestement anormale, ni contourner
            les limites d'usage.
          </li>
        </ul>
        <h3>7.1 Données des clients du commerçant</h3>
        <p>
          Le Client enregistre dans HabaShop des données concernant ses propres clients
          (identité, téléphone, historique d'achat). Il en demeure <strong>responsable de
          traitement</strong> : il lui revient de disposer d'une base légale, d'informer les
          personnes concernées et de répondre à leurs demandes. L'éditeur agit comme
          sous-traitant pour ces données.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>8. Données personnelles</h2>
        <p>
          Le traitement des données personnelles est décrit dans la{' '}
          <a href="/privacy" style={{ color: '#6C47FF' }}>politique de confidentialité</a>,
          qui fait partie intégrante des présentes conditions.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>9. Disponibilité, sauvegarde et données</h2>
        <p>
          L'éditeur met en œuvre les moyens raisonnables pour assurer la disponibilité du
          service, sans engagement de continuité : <strong>aucun niveau de disponibilité
          n'est garanti</strong> à ce jour. Des interruptions pour maintenance ou pour cause
          externe (hébergeur, réseau, fournisseur tiers) peuvent survenir.
        </p>
        <p>
          Le Client peut exporter ses données depuis l'application à tout moment. Il lui est
          recommandé de conserver ses propres copies des documents dont la loi lui impose la
          conservation.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>10. Responsabilité</h2>
        <p>
          Le service est fourni en l'état. L'éditeur ne peut être tenu responsable des
          conséquences d'une saisie erronée par le Client, d'une perte de données imputable à
          un tiers ou au Client, ni d'un manque à gagner résultant d'une indisponibilité.
        </p>
        <p>
          Les chiffres produits par le service (rapports, marges, bulletins de paie,
          déclarations) sont des aides à la décision : leur exactitude dépend des données
          saisies et des paramètres choisis par le Client, qui en conserve la
          responsabilité. <AC>Plafond de responsabilité retenu</AC>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>11. Suspension, résiliation et suppression du compte</h2>
        <p>
          Le Client peut résilier son abonnement à tout moment ; l'abonnement reste actif
          jusqu'au terme de la période payée, sans remboursement au prorata{' '}
          <AC>sauf mention contraire à retenir</AC>.
        </p>
        <p>
          L'éditeur peut suspendre ou résilier un compte en cas de défaut de paiement, de
          manquement aux présentes conditions, ou d'usage manifestement illicite, après mise
          en demeure restée sans effet sauf urgence.
        </p>
        <p>
          Le Client peut demander la suppression définitive de son compte depuis
          l'application ou par écrit à support@habashop.com. La suppression est
          irréversible : elle efface le compte et les données associées, sous réserve des
          durées de conservation légales décrites dans la politique de confidentialité.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>12. Propriété intellectuelle</h2>
        <p>
          Le logiciel, sa marque et ses éléments graphiques demeurent la propriété de
          l'éditeur. L'abonnement confère un droit d'usage personnel, non exclusif et non
          cessible, pour la durée de l'abonnement.
        </p>
        <p>
          Les données saisies par le Client restent sa propriété. L'éditeur ne les exploite
          que pour fournir le service.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>13. Modification des conditions</h2>
        <p>
          Les présentes conditions peuvent être modifiées. Le Client en est informé et
          dispose d'un délai raisonnable pour résilier s'il refuse les nouvelles conditions.
          La date de dernière mise à jour figure en tête de ce document.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>14. Droit applicable et litiges</h2>
        <p>
          Les présentes conditions sont régies par <AC>droit applicable</AC>. En cas de
          différend, les parties rechercheront une solution amiable avant toute action.
          À défaut, compétence est attribuée à <AC>juridiction compétente</AC>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>15. Contact</h2>
        <p>
          Toute question relative aux présentes conditions peut être adressée à{' '}
          <a href="mailto:contact@habashop.com" style={{ color: '#6C47FF' }}>
            contact@habashop.com
          </a>.
        </p>
      </section>
    </div>
  )
}
