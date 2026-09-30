import type { GuideSection } from './types'

/**
 * UTILISATEURS & RÔLES — appuis CDC : `291` (utilisateurs, 6 rôles, matrice de permissions ✅
 * — ADMIN, SUPER_ADMIN, MANAGER, ACCOUNTANT, HR, CASHIER), `290` (multi-boutiques ✅),
 * `292` (journal d'activité ✅).
 *
 * ⚠️ REMPLACE « Mobile & hors-ligne » du périmètre initial : `CDC:251` donne la vente
 * hors-ligne ⚠️ « mobile uniquement, et l'application n'est publiée nulle part ». Décision de
 * Nelson du 2026-10-01.
 *
 * ⚠️ `SUPER_ADMIN` est un rôle INTERNE À LA BOUTIQUE, pas un accès à la plateforme. Ne jamais
 * laisser entendre qu'il ouvre la console d'administration : c'est exactement la confusion
 * qui a causé une fuite inter-tenants, corrigée.
 * ⚠️ Les six rôles sont ceux du CDC. N'en inventer aucun septième, n'en renommer aucun.
 */
export const utilisateurs: GuideSection = {
  id: 'utilisateurs',
  titre: {
    fr: 'Utilisateurs et rôles',
    en: 'Users and roles',
    es: 'Usuarios y roles',
    it: 'Utenti e ruoli',
  },
  intro: {
    fr: 'Dès qu’une deuxième personne travaille dans la boutique, la question n’est plus « qui a accès » mais « qui voit quoi ». Chaque compte porte un rôle, et le rôle décide des écrans accessibles — vos marges n’ont pas à être visibles par tout le monde.',
    en: 'As soon as a second person works in the shop, the question is no longer “who has access” but “who sees what”. Every account carries a role, and the role decides which screens are reachable — your margins do not have to be visible to everyone.',
    es: 'En cuanto una segunda persona trabaja en la tienda, la pregunta ya no es «quién tiene acceso» sino «quién ve qué». Cada cuenta lleva un rol, y el rol decide las pantallas accesibles: sus márgenes no tienen por qué ser visibles para todos.',
    it: 'Appena una seconda persona lavora in negozio, la domanda non è più «chi ha accesso» ma «chi vede cosa». Ogni account porta un ruolo, e il ruolo decide quali schermate sono raggiungibili — i tuoi margini non devono essere visibili a tutti.',
  },
  etapes: [
    {
      titre: { fr: 'Inviter un utilisateur', en: 'Invite a user', es: 'Invitar a un usuario', it: 'Invitare un utente' },
      corps: {
        fr: 'Depuis l’écran Utilisateurs, créez un compte avec son adresse e-mail et choisissez son rôle. Le rôle se change ensuite à tout moment : commencez par le plus restreint, vous élargirez si besoin.',
        en: 'From the Users screen, create an account with their email address and pick their role. The role can be changed at any time afterwards: start with the most restricted one and widen it if needed.',
        es: 'Desde la pantalla Usuarios, cree una cuenta con su dirección de correo y elija su rol. El rol se puede cambiar luego en cualquier momento: empiece por el más restringido y amplíelo si hace falta.',
        it: 'Dalla schermata Utenti, crea un account con il suo indirizzo e-mail e scegli il ruolo. Il ruolo si può cambiare in qualsiasi momento: parti dal più ristretto e allargalo se serve.',
      },
    },
    {
      titre: { fr: 'Les six rôles', en: 'The six roles', es: 'Los seis roles', it: 'I sei ruoli' },
      corps: {
        fr: 'Caissier tient la caisse. Gestionnaire y ajoute le stock et les clients. Comptable voit les finances et les rapports. RH gère les employés et la paie. Administrateur a tout, et Super administrateur est le propriétaire de la boutique. ⚠️ Super administrateur reste un rôle de VOTRE boutique : il ne donne aucun accès à la console de l’éditeur.',
        en: 'Cashier runs the till. Manager adds stock and customers. Accountant sees finance and reports. HR handles staff and payroll. Admin has everything, and Super admin is the shop owner. ⚠️ Super admin remains a role inside YOUR shop: it grants no access to the vendor’s console.',
        es: 'Cajero atiende la caja. Gerente añade stock y clientes. Contable ve finanzas e informes. RR. HH. gestiona personal y nóminas. Administrador tiene todo, y Superadministrador es el propietario de la tienda. ⚠️ Superadministrador sigue siendo un rol de SU tienda: no da acceso a la consola del proveedor.',
        it: 'Cassiere gestisce la cassa. Responsabile aggiunge scorte e clienti. Contabile vede finanze e report. Risorse Umane gestisce personale e buste paga. Amministratore ha tutto, e Super amministratore è il proprietario del negozio. ⚠️ Super amministratore resta un ruolo del TUO negozio: non dà accesso alla console del fornitore.',
      },
    },
    {
      titre: { fr: 'Plusieurs boutiques', en: 'Several shops', es: 'Varias tiendas', it: 'Più negozi' },
      corps: {
        fr: 'Un même compte peut accéder à plusieurs boutiques, avec un rôle propre à chacune : gestionnaire ici, caissier là. Le sélecteur de boutique change la boutique active, et tout ce que vous voyez ensuite — stock, ventes, employés — appartient à celle-là seulement.',
        en: 'One account can reach several shops, with its own role in each: manager here, cashier there. The shop selector switches the active shop, and everything you then see — stock, sales, staff — belongs to that one only.',
        es: 'Una misma cuenta puede acceder a varias tiendas, con un rol propio en cada una: gerente aquí, cajero allí. El selector de tienda cambia la tienda activa, y todo lo que ve después —stock, ventas, personal— pertenece solo a esa.',
        it: 'Un solo account può accedere a più negozi, con un ruolo proprio in ciascuno: responsabile qui, cassiere là. Il selettore di negozio cambia il negozio attivo, e tutto ciò che vedi poi — scorte, vendite, personale — appartiene solo a quello.',
      },
    },
    {
      titre: { fr: 'Le journal d’activité', en: 'The activity log', es: 'El registro de actividad', it: 'Il registro attività' },
      corps: {
        fr: 'Les gestes qui comptent — un remboursement, une suppression, un changement de prix — sont consignés avec leur auteur et leur date. C’est ce que vous consultez quand un écart de caisse demande une explication, plutôt que de demander à chacun ce qu’il a fait.',
        en: 'The actions that matter — a refund, a deletion, a price change — are logged with who did them and when. That is what you consult when a till discrepancy needs explaining, rather than asking everyone what they did.',
        es: 'Los gestos que importan —un reembolso, una eliminación, un cambio de precio— quedan registrados con su autor y su fecha. Es lo que consulta cuando una diferencia de caja necesita explicación, en vez de preguntar a cada uno qué hizo.',
        it: 'I gesti che contano — un rimborso, una cancellazione, una variazione di prezzo — sono registrati con autore e data. È ciò che consulti quando uno scostamento di cassa richiede una spiegazione, invece di chiedere a ciascuno cosa ha fatto.',
      },
    },
  ],
}
