import { useEffect } from 'react'
import { appUrl, appUrlHost } from '@/lib/appUrl'

export default function Privacy() {
  useEffect(() => {
    document.title = 'Politique de confidentialité — HabaShop'
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
        <a href="/" style={{
          color: '#6C47FF',
          textDecoration: 'none',
          fontSize: 'var(--fs-body)',
        }}>
          ← Retour à HabaShop
        </a>
      </div>

      <h1 style={{ color: '#6C47FF', marginBottom: 8 }}>
        Politique de confidentialité
      </h1>
      <p style={{ color: '#666', marginBottom: 40 }}>
        Dernière mise à jour : 27 mai 2026
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2>1. Qui sommes-nous ?</h2>
        <p>
          HabaShop est un logiciel SaaS de gestion commerciale
          édité par Nelson Djoumessi (romel.djoumessi@gmail.com).
          L'application est accessible sur{' '}
          <a href={appUrl()}
            style={{ color: '#6C47FF' }}>
            {appUrlHost()}
          </a>{' '}
          et sur mobile (Android / iOS).
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>2. Données collectées</h2>
        <h3>2.1 Données de compte</h3>
        <ul>
          <li>Nom et prénom</li>
          <li>Adresse e-mail</li>
          <li>Nom de la boutique (tenant)</li>
        </ul>
        <h3>2.2 Données commerciales</h3>
        <p>
          Les données saisies par le commerçant (produits, ventes,
          clients, stocks) appartiennent exclusivement au commerçant.
          HabaShop ne les utilise qu'à des fins de fonctionnement
          du service.
        </p>
        <h3>2.3 Données techniques</h3>
        <ul>
          <li>Adresse IP (logs serveur)</li>
          <li>Token push (notifications mobiles)</li>
          <li>Version de l'app et type d'appareil</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>3. Utilisation des données</h2>
        <p>Vos données sont utilisées uniquement pour :</p>
        <ul>
          <li>Faire fonctionner le service HabaShop</li>
          <li>Envoyer les notifications push (si activées)</li>
          <li>Assurer la sécurité et la stabilité du service</li>
          <li>Vous contacter en cas de problème technique</li>
        </ul>
        <p>
          <strong>Nous ne vendons pas vos données.</strong>{' '}
          Nous ne les partageons pas avec des tiers à des fins
          publicitaires ou commerciales.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>4. Partage des données</h2>
        <p>Vos données peuvent être traitées par :</p>
        <ul>
          <li>
            <strong>Railway</strong> — hébergement du backend
            (base de données PostgreSQL)
          </li>
          <li>
            <strong>Vercel</strong> — hébergement du frontend web
          </li>
          <li>
            <strong>Resend</strong> — envoi d'e-mails transactionnels
          </li>
          <li>
            <strong>Expo (EAS)</strong> — livraison des mises à jour
            et notifications push mobiles
          </li>
        </ul>
        <p>
          Ces prestataires sont soumis à des obligations de
          confidentialité et de sécurité.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>5. Sécurité</h2>
        <ul>
          <li>Toutes les communications sont chiffrées (HTTPS/TLS)</li>
          <li>
            Les mots de passe sont hachés (bcrypt) —
            jamais stockés en clair
          </li>
          <li>
            Sur mobile, les credentials biométriques sont stockés
            dans le Keychain / Keystore chiffré de l'appareil
          </li>
          <li>
            Les tokens d'authentification ont une durée de vie limitée
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>6. Conservation des données</h2>
        <p>
          Vos données sont conservées tant que votre compte est actif.
          En cas de suppression du compte, toutes les données associées
          sont supprimées dans un délai de 30 jours.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>7. Vos droits (RGPD)</h2>
        <p>
          Conformément au Règlement Général sur la Protection des
          Données (RGPD), vous disposez des droits suivants :
        </p>
        <ul>
          <li>
            <strong>Accès</strong> — obtenir une copie de vos données
          </li>
          <li>
            <strong>Rectification</strong> — corriger vos données
          </li>
          <li>
            <strong>Suppression</strong> — supprimer votre compte
            et toutes vos données
          </li>
          <li>
            <strong>Portabilité</strong> — exporter vos données
            (format CSV disponible)
          </li>
          <li>
            <strong>Opposition</strong> — vous opposer à certains
            traitements
          </li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à :{' '}
          <a href="mailto:romel.djoumessi@gmail.com"
            style={{ color: '#6C47FF' }}>
            romel.djoumessi@gmail.com
          </a>
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>8. Cookies</h2>
        <p>
          HabaShop utilise uniquement des cookies techniques
          nécessaires au fonctionnement du service (session,
          authentification). Aucun cookie publicitaire ou de
          tracking tiers n'est utilisé.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>9. Application mobile</h2>
        <p>
          L'application mobile HabaShop (Android / iOS) stocke
          localement sur votre appareil :
        </p>
        <ul>
          <li>
            Vos préférences (langue, devise, thème) —
            dans AsyncStorage
          </li>
          <li>
            Vos credentials de connexion (si biométrie activée) —
            dans le Keychain / Keystore chiffré
          </li>
          <li>
            Les ventes hors-ligne en attente de synchronisation —
            dans AsyncStorage (supprimées après sync)
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>10. Modifications</h2>
        <p>
          Cette politique peut être mise à jour. En cas de
          modification substantielle, vous serez informé par
          e-mail ou par notification dans l'application.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>11. Contact</h2>
        <p>
          Pour toute question relative à cette politique :
        </p>
        <p>
          <strong>Nelson Djoumessi</strong><br/>
          E-mail :{' '}
          <a href="mailto:romel.djoumessi@gmail.com"
            style={{ color: '#6C47FF' }}>
            romel.djoumessi@gmail.com
          </a><br/>
          Site :{' '}
          <a href={appUrl()}
            style={{ color: '#6C47FF' }}>
            {appUrlHost()}
          </a>
        </p>
      </section>

      <hr style={{
        border: 'none',
        borderTop: '1px solid #eee',
        margin: '40px 0'
      }}/>
      <p style={{ color: '#999', fontSize: 'var(--fs-sm)' }}>
        © 2026 HabaShop. Tous droits réservés.
      </p>
    </div>
  )
}
