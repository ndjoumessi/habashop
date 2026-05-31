import { describe, it, expect } from 'vitest'
import {
  localeOf, roleLabel, deptLabel, contractLabel, attendStatusLabel, leaveStatusLabel,
} from '@/components/hr/hrShared'

// Helpers de libellés HR — pattern CRUCIAL du projet : la valeur FR est la CLÉ (filtres/data
// inchangés), seul l'AFFICHAGE est traduit ; toute valeur custom passe inchangée (fallback).
// Verrouille ce contrat (régression i18n) pour les 6 fonctions d'étiquetage HR.

describe('localeOf', () => {
  it('mappe lang → locale Intl', () => {
    expect(localeOf('fr')).toBe('fr-FR')
    expect(localeOf('en')).toBe('en-US')
    expect(localeOf('es')).toBe('es-ES')
    expect(localeOf('it')).toBe('it-IT')
  })
  it('langue inconnue → fr-FR (défaut)', () => {
    expect(localeOf('de')).toBe('fr-FR')
    expect(localeOf('')).toBe('fr-FR')
  })
})

describe('roleLabel — poste (FR=clé, traduit à l\'affichage)', () => {
  it('traduit les rôles prédéfinis', () => {
    expect(roleLabel('Caissier', 'en')).toBe('Cashier')
    expect(roleLabel('Caissière', 'es')).toBe('Cajera')
    expect(roleLabel('Magasinier', 'it')).toBe('Magazziniere')
    expect(roleLabel('Responsable', 'en')).toBe('Supervisor')
  })
  it('FR : la valeur-clé est rendue telle quelle', () => {
    expect(roleLabel('Comptable', 'fr')).toBe('Comptable')
  })
  it('rôle custom (saisi) → inchangé (fallback)', () => {
    expect(roleLabel('Ninja du stock', 'en')).toBe('Ninja du stock')
  })
  it('langue inconnue → repli sur la clé', () => {
    expect(roleLabel('Manager', 'de')).toBe('Manager')
  })
})

describe('deptLabel — département', () => {
  it('traduit les départements prédéfinis', () => {
    expect(deptLabel('Ventes', 'en')).toBe('Sales')
    expect(deptLabel('Direction', 'en')).toBe('Management')
    expect(deptLabel('RH', 'es')).toBe('RR.HH.')
    expect(deptLabel('Logistique', 'it')).toBe('Logistica')
  })
  it('département custom → inchangé', () => {
    expect(deptLabel('Atelier couture', 'en')).toBe('Atelier couture')
  })
})

describe('contractLabel — type de contrat', () => {
  it('traduit CDI/CDD/Temps partiel/Stage/Freelance', () => {
    expect(contractLabel('CDI', 'en')).toBe('Permanent')
    expect(contractLabel('CDD', 'es')).toBe('Temporal')
    expect(contractLabel('Temps partiel', 'en')).toBe('Part-time')
    expect(contractLabel('Stage', 'it')).toBe('Tirocinio')
  })
  it('CDI/CDD = clés (codes) inchangées en FR', () => {
    expect(contractLabel('CDI', 'fr')).toBe('CDI')
    expect(contractLabel('CDD', 'fr')).toBe('CDD')
  })
  it('type custom → inchangé', () => {
    expect(contractLabel('Apprentissage', 'en')).toBe('Apprentissage')
  })
})

describe('attendStatusLabel — statut de présence', () => {
  it('traduit present/retard/absent/conge/repos', () => {
    expect(attendStatusLabel('present', 'en')).toBe('Present')
    expect(attendStatusLabel('retard', 'it')).toBe('Ritardo')
    expect(attendStatusLabel('absent', 'es')).toBe('Ausente')
    expect(attendStatusLabel('conge', 'en')).toBe('On leave')
    expect(attendStatusLabel('repos', 'es')).toBe('Descanso')
  })
  it('statut inconnu → repli final sur la clé', () => {
    expect(attendStatusLabel('inconnu', 'en')).toBe('inconnu')
  })
})

describe('leaveStatusLabel — statut de congé', () => {
  it('traduit pending/approved/refused', () => {
    expect(leaveStatusLabel('pending', 'en')).toBe('Pending')
    expect(leaveStatusLabel('approved', 'es')).toBe('Aprobado')
    expect(leaveStatusLabel('refused', 'it')).toBe('Rifiutato')
    expect(leaveStatusLabel('pending', 'fr')).toBe('En attente')
  })
  it('statut inconnu → repli final sur la clé', () => {
    expect(leaveStatusLabel('archived', 'en')).toBe('archived')
  })
})
