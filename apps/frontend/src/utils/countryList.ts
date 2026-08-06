// Pays proposés au commerçant — SOURCE UNIQUE partagée par l'onboarding et les réglages.
//
// ⚠️ La `value` stockée et envoyée à l'API est TOUJOURS le code ISO-2 ; le nom français
// n'est qu'un affichage. C'est la confusion inverse qui a mis « France » dans
// `Tenant.country` : un sélecteur y PATCHait son propre libellé. Or le pays sert à
// normaliser le téléphone du COMMERÇANT (`resolveRecipient`), qui n'accepte que l'ISO-2 —
// un libellé y devient `COUNTRY_UNKNOWN`, donc plus aucun WhatsApp ni SMS, en silence.
//
// Doit rester aligné sur `SUPPORTED_COUNTRIES` (backend `lib/country.ts`) : un pays
// proposé ici mais absent là-bas serait refusé en 400 au moment d'enregistrer.
export const COUNTRIES: { iso: string; name: string; flag: string }[] = [
  { iso: 'CM', name: 'Cameroun',      flag: '🇨🇲' },
  { iso: 'SN', name: 'Sénégal',       flag: '🇸🇳' },
  { iso: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { iso: 'ML', name: 'Mali',          flag: '🇲🇱' },
  { iso: 'BF', name: 'Burkina Faso',  flag: '🇧🇫' },
  { iso: 'GN', name: 'Guinée',        flag: '🇬🇳' },
  { iso: 'CD', name: 'Congo RDC',     flag: '🇨🇩' },
  { iso: 'GA', name: 'Gabon',         flag: '🇬🇦' },
  { iso: 'TG', name: 'Togo',          flag: '🇹🇬' },
  { iso: 'BJ', name: 'Bénin',         flag: '🇧🇯' },
  { iso: 'NE', name: 'Niger',         flag: '🇳🇪' },
  { iso: 'TD', name: 'Tchad',         flag: '🇹🇩' },
  { iso: 'FR', name: 'France',        flag: '🇫🇷' },
  { iso: 'BE', name: 'Belgique',      flag: '🇧🇪' },
  { iso: 'CA', name: 'Canada',        flag: '🇨🇦' },
]

/** Nom affichable d'un code ISO-2. Une valeur héritée (ancien libellé FR) est rendue telle
 *  quelle plutôt que masquée : mieux vaut montrer « France » que rien pendant la migration. */
export function countryLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  return COUNTRIES.find(c => c.iso === iso)?.name ?? iso
}
