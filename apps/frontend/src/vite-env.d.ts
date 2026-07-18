/// <reference types="vite/client" />

// Injecté au build par Vite (`define` dans vite.config.ts) : horodatage + SHA court.
declare const __BUILD_ID__: string
// Forme courte affichée dans la sidebar : « v<version> · JJ/MM » (détail complet en title).
declare const __BUILD_SHORT__: string
// Version PRODUIT brute (« 2.6.0 ») = package.json racine, injectée au build. SOURCE UNIQUE.
declare const __APP_VERSION__: string
