/**
 * Logo HabaShop — mark « Sac + H » (sac de courses violet, anse or, monogramme H).
 * Tuile autonome (fond violet arrondi inclus) : le conteneur hôte ne doit PAS ajouter de
 * fond violet (double fond). Remplit son conteneur par défaut (width/height 100 %).
 * Source de vérité éditable : ../habashop-brand/habashop-mark.svg.
 */
export default function LogoMark({ size, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size ?? '100%'}
      height={size ?? '100%'}
      role="img"
      aria-label="HabaShop"
      style={style}
    >
      <rect width="100" height="100" rx="24" fill="#6C47FF" />
      <path d="M38 38 C38 24 62 24 62 38" fill="none" stroke="#F0A500" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="29" y="37" width="42" height="40" rx="5" fill="#fff" />
      <rect x="44" y="46" width="4.6" height="22" rx="1.4" fill="#6C47FF" />
      <rect x="52" y="46" width="4.6" height="22" rx="1.4" fill="#6C47FF" />
      <rect x="44" y="55" width="12.6" height="4.6" rx="1.4" fill="#6C47FF" />
    </svg>
  )
}
