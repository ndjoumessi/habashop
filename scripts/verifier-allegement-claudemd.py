#!/usr/bin/env python3
"""
CE QUI A QUITTÉ CLAUDE.md — et rien d'autre.

⚠️ Ce script ne regarde JAMAIS `docs/lessons/`. C'est le point de la règle : une
compression se vérifie sur ce qui DISPARAÎT du fichier qui se charge à chaque session,
pas sur ce qui est bien arrivé à destination. Le 2026-08-07, une compression conforme
(149 844 caractères) avait supprimé CINQ règles ; vérifier les leçons ne l'aurait pas dit.

Identifiant = tout ce qui est entre accents graves. Normalisé pour que `lib/x.ts` et `x`
soient le MÊME identifiant : on retire le chemin, l'extension, et on garde le nom nu.
"""
import re, subprocess, sys, pathlib

SPAN = re.compile(r'`([^`\n]{2,120})`')

def normalise(s: str) -> str:
    s = s.strip()
    s = re.sub(r'^[\w./@-]*/', '', s)          # chemin → dernier segment
    s = re.sub(r'\.(tsx?|mjs|json|css|ya?ml|sql|md|html)$', '', s)
    s = re.sub(r'\(\)$', '', s)                 # `foo()` == `foo`
    return s.strip()

def identifiants(texte: str) -> set[str]:
    out = set()
    for m in SPAN.finditer(texte):
        brut = m.group(1)
        # On ne garde que ce qui ressemble à un IDENTIFIANT (pas une phrase, pas une
        # commande complète) : un mot technique, éventuellement pointé ou en chemin.
        if ' ' in brut.strip() and not re.match(r'^[\w./@-]+ [\w./@-]+$', brut.strip()):
            continue
        n = normalise(brut)
        if len(n) >= 3 and re.search(r'[A-Za-z]', n):
            out.add(n)
    return out

def lire_git(ref: str) -> str:
    return subprocess.run(['git', 'show', f'{ref}:CLAUDE.md'],
                          capture_output=True, text=True, check=True).stdout

def main() -> int:
    ref = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'
    avant = identifiants(lire_git(ref))
    apres = identifiants(pathlib.Path('CLAUDE.md').read_text(encoding='utf8'))

    # ── CONTRÔLE DISCRIMINANT — sans lui, un extracteur cassé rendrait deux ensembles
    # vides, donc « aucune perte », et le zéro aurait l'air d'une preuve.
    assert len(avant) > 200, f"extraction AVANT trop maigre ({len(avant)}) — extracteur cassé ?"
    assert len(apres) > 200, f"extraction APRÈS trop maigre ({len(apres)}) — extracteur cassé ?"
    temoin_present = 'writeAudit' in avant                    # existe vraiment
    temoin_absent  = 'zzzIdentifiantQuiNexistePas' in avant   # n'existe pas
    assert temoin_present, "témoin POSITIF introuvable — l'extraction ne lit pas ce qu'elle devrait"
    assert not temoin_absent, "témoin NÉGATIF trouvé — l'extraction invente"
    # Normalisation : les deux formes doivent se confondre.
    assert normalise('apps/frontend/src/lib/barcode.ts') == normalise('barcode'), "normalisation cassée"

    perdus = sorted(avant - apres)
    gagnes = sorted(apres - avant)
    print(f"identifiants AVANT {len(avant)} · APRÈS {len(apres)}")
    print(f"contrôle discriminant : témoin positif OK · témoin inexistant non signalé OK\n")
    print(f"── IDENTIFIANTS DISPARUS ({len(perdus)}) ──")
    for p in perdus:
        print(f"   − {p}")
    if gagnes:
        print(f"\n── apparus ({len(gagnes)}) ──")
        for g in gagnes:
            print(f"   + {g}")

    # ── SECOND AXE : les règles en PROSE ────────────────────────────────────────────
    # ⚠️ L'axe des identifiants est aveugle à une règle écrite sans accents graves —
    # « on retire l'avertissement QU'ON A INTRODUIT », « une surface à la fois ». Or ce
    # sont exactement des règles de comportement. Dans ce fichier elles portent toutes
    # un ⚠️ : on en fait donc l'inventaire, et on compare les EMPREINTES.
    def regles(texte: str) -> dict[str, str]:
        out = {}
        for ligne in texte.split('\n'):
            if '⚠️' not in ligne:
                continue
            # Empreinte = les mots significatifs de la règle, sans la ponctuation ni le
            # gras, pour qu'une reformulation mineure ne crie pas au loup.
            nu = re.sub(r'[*`_#⚠️]', '', ligne)
            mots = re.findall(r'[A-Za-zÀ-ÿ]{4,}', nu.lower())[:8]
            if len(mots) >= 4:
                out[' '.join(mots)] = ligne.strip()[:100]
        return out

    ra, rp = regles(lire_git(ref)), regles(pathlib.Path('CLAUDE.md').read_text(encoding='utf8'))
    assert len(ra) > 100, f"inventaire des règles AVANT trop maigre ({len(ra)})"
    disparues = [ra[k] for k in ra if k not in rp]
    print(f"\n── RÈGLES ⚠️ : AVANT {len(ra)} · APRÈS {len(rp)} · disparues {len(disparues)} ──")
    for d in disparues:
        print(f"   − {d}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
