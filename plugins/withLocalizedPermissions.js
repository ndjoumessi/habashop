const { withInfoPlist, withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// Textes de permission iOS localisés (fr / en / es / it). Les clés NS*UsageDescription
// d'app.json ne prennent qu'UNE chaîne → le multilingue exige des fichiers
// `<lang>.lproj/InfoPlist.strings` + CFBundleLocalizations. Ce plugin pose les deux à
// la prébuild EAS. La langue affichée suit les réglages système de l'appareil ; le FR
// reste la base (CFBundleDevelopmentRegion). Mentionne désormais l'OCR factures fournisseurs.
const STRINGS = {
  fr: {
    NSCameraUsageDescription:
      'HabaShop utilise la caméra pour scanner les codes-barres, photographier les profils et numériser les factures fournisseurs.',
    NSPhotoLibraryUsageDescription:
      "HabaShop accède à vos photos pour les photos de profil et l'import de factures fournisseurs.",
  },
  en: {
    NSCameraUsageDescription:
      'HabaShop uses the camera to scan barcodes, take profile photos and capture supplier invoices.',
    NSPhotoLibraryUsageDescription:
      'HabaShop accesses your photos for profile pictures and importing supplier invoices.',
  },
  es: {
    NSCameraUsageDescription:
      'HabaShop usa la cámara para escanear códigos de barras, tomar fotos de perfil y digitalizar facturas de proveedores.',
    NSPhotoLibraryUsageDescription:
      'HabaShop accede a tus fotos para las fotos de perfil y la importación de facturas de proveedores.',
  },
  it: {
    NSCameraUsageDescription:
      'HabaShop usa la fotocamera per scansionare i codici a barre, scattare foto profilo e acquisire le fatture dei fornitori.',
    NSPhotoLibraryUsageDescription:
      "HabaShop accede alle tue foto per le foto profilo e l'importazione delle fatture dei fornitori.",
  },
}

const LOCALES = Object.keys(STRINGS)

const withLocalizedPermissions = (config) => {
  // 1) Déclare les locales prises en charge + pose le FR comme base dans Info.plist.
  config = withInfoPlist(config, (c) => {
    c.modResults.CFBundleDevelopmentRegion = 'fr'
    c.modResults.CFBundleLocalizations = LOCALES
    c.modResults.NSCameraUsageDescription = STRINGS.fr.NSCameraUsageDescription
    c.modResults.NSPhotoLibraryUsageDescription = STRINGS.fr.NSPhotoLibraryUsageDescription
    return c
  })

  // 2) Écrit les `<lang>.lproj/InfoPlist.strings` dans le projet iOS généré (prébuild).
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const projectName = c.modRequest.projectName
      const iosRoot = c.modRequest.platformProjectRoot
      if (!projectName) return c // sécurité : rien à faire sans nom de projet iOS
      for (const [lang, strings] of Object.entries(STRINGS)) {
        const lprojDir = path.join(iosRoot, projectName, `${lang}.lproj`)
        fs.mkdirSync(lprojDir, { recursive: true })
        const content =
          Object.entries(strings)
            .map(([k, v]) => `"${k}" = "${v.replace(/"/g, '\\"')}";`)
            .join('\n') + '\n'
        fs.writeFileSync(path.join(lprojDir, 'InfoPlist.strings'), content, 'utf8')
      }
      return c
    },
  ])

  return config
}

module.exports = withLocalizedPermissions
