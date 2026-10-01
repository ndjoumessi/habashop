import { defineConfig } from '@playwright/test'

/**
 * CONFIG DÉDIÉE — CAPTURE VIDÉO DU PARCOURS DE DÉMONSTRATION.
 *
 * ⚠️ POURQUOI UNE CONFIG À PART, et pas un spec de plus dans la suite. Celle-ci ENREGISTRE
 * (`video: 'on'`), elle CRÉE une boutique de démonstration par exécution, et elle dure des
 * minutes. La mettre dans la suite de production la ferait tourner à chaque passage de CI :
 * autant de tenants créés, autant de temps brûlé, pour un artefact que personne ne regarde.
 * `playwright.config.ts` exclut donc `**\/capture\/**` — par DOSSIER, jamais par nom de
 * fichier, exactement comme `e2e/dev/` (un dossier ne se périme pas à l'ajout d'un fichier).
 *
 * ⚠️ AUCUN `storageState`. La suite principale réutilise une session obtenue sur `e2e-tenant` ;
 * ici le parcours DOIT partir de la vitrine, cliquer « Essayer la démo » et traverser
 * l'inscription éphémère — c'est le parcours qu'on filme, pas un raccourci vers l'intérieur.
 *
 * ⚠️ `serviceWorkers: 'block'` : le SW de la PWA sert des réponses en cache et pourrait filmer
 * des données périmées. Piège déjà documenté pour l'E2E.
 *
 * ⚠️ `workers: 1` ET `retries: 0`. Un seul worker parce que chaque exécution crée un tenant et
 * que le backend est une réplique unique ; zéro reprise parce qu'une reprise filmerait un
 * second parcours et laisserait DEUX tenants derrière elle pour une seule vidéo utile.
 *
 * ⚠️ CE QUI EST FILMÉ EST CE QUI EST LIVRÉ. Le parcours ne traverse que des capacités ✅ :
 * caisse NAVIGATEUR, stock, rapports, RH, planning. Il ne montre ni le mode hors-ligne (qui vit
 * dans l'app mobile NON PUBLIÉE), ni un encaissement Mobile Money (aucun compte marchand n'est
 * ouvert). Une vidéo qui les montrerait promettrait ce que le produit ne fait pas — c'est
 * précisément ce que la vitrine a déjà nettoyé.
 */
export default defineConfig({
  // ⚠️ Le DOSSIER, pas un nom : la prochaine capture y tombera sans toucher à cette config.
  testDir: './e2e/capture',
  // Un parcours complet × une création de tenant : large, et mesuré plutôt que deviné.
  timeout: 180_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.CAPTURE_BASE ?? 'https://habashop.vercel.app',
    serviceWorkers: 'block',
    // 1280×720 : le format que lit un lecteur vidéo, et la largeur où la barre latérale tient.
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  reporter: [['list']],
})
