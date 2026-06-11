import React, { useState, useCallback } from 'react'

type InputType =
  | 'text'
  | 'phone'
  | 'email'
  | 'number'
  | 'amount'
  | 'percentage'
  | 'name'
  | 'date'
  | 'search'

interface ValidatedInputProps {
  type:         InputType
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  label?:       string
  required?:    boolean
  min?:         number
  max?:         number
  decimals?:    number
  disabled?:    boolean
  autoFocus?:   boolean
  lang?:        string
  className?:   string
  style?:       React.CSSProperties
  onEnter?:     () => void
}

type ErrorEntry = Record<string, string | ((arg: number) => string)>

const ERRORS: Record<string, ErrorEntry> = {
  phone_invalid: {
    fr: 'Numéro invalide (chiffres et + uniquement)',
    en: 'Invalid number (digits and + only)',
    es: 'Número inválido (solo dígitos y +)',
    it: 'Numero non valido (solo cifre e +)',
  },
  email_invalid: {
    fr: 'Email invalide',
    en: 'Invalid email',
    es: 'Email inválido',
    it: 'Email non valida',
  },
  required: {
    fr: 'Ce champ est requis',
    en: 'This field is required',
    es: 'Este campo es obligatorio',
    it: 'Campo obbligatorio',
  },
  number_invalid: {
    fr: 'Valeur numérique requise',
    en: 'Numeric value required',
    es: 'Se requiere valor numérico',
    it: 'Valore numerico richiesto',
  },
  min_value: {
    fr: (min: number) => `Minimum : ${min}`,
    en: (min: number) => `Minimum: ${min}`,
    es: (min: number) => `Mínimo: ${min}`,
    it: (min: number) => `Minimo: ${min}`,
  },
  max_value: {
    fr: (max: number) => `Maximum : ${max}`,
    en: (max: number) => `Maximum: ${max}`,
    es: (max: number) => `Máximo: ${max}`,
    it: (max: number) => `Massimo: ${max}`,
  },
  percentage: {
    fr: 'Pourcentage entre 0 et 100',
    en: 'Percentage between 0 and 100',
    es: 'Porcentaje entre 0 y 100',
    it: 'Percentuale tra 0 e 100',
  },
}

function getError(key: string, lang: string, arg?: number): string {
  const entry = ERRORS[key]
  if (!entry) return key
  const val = entry[lang] ?? entry['fr']
  if (typeof val === 'function') return (val as (n: number) => string)(arg ?? 0)
  return val as string
}

const FILTERS: Record<InputType, (char: string) => boolean> = {
  phone:      (c) => /[\d\s+\-()]/.test(c),
  number:     (c) => /[\d,.\-]/.test(c),
  amount:     (c) => /[\d,.\s]/.test(c),
  percentage: (c) => /[\d.,]/.test(c),
  text:       ()  => true,
  name:       (c) => /[a-zA-ZÀ-ÿ\s'\-.]/.test(c),
  email:      (c) => /[a-zA-Z0-9@._\-+]/.test(c),
  date:       (c) => /[\d\/\-.]/.test(c),
  search:     ()  => true,
}

function validate(
  value: string,
  type: InputType,
  required: boolean,
  min?: number,
  max?: number,
  lang = 'fr',
): string | null {
  if (required && !value.trim()) return getError('required', lang)
  if (!value.trim()) return null

  switch (type) {
    case 'phone': {
      const digits = value.replace(/[\s\-()]/g, '')
      if (!/^\+?[\d]{6,15}$/.test(digits)) return getError('phone_invalid', lang)
      break
    }
    case 'email': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return getError('email_invalid', lang)
      break
    }
    case 'number':
    case 'amount': {
      const n = parseFloat(value.replace(',', '.'))
      if (isNaN(n)) return getError('number_invalid', lang)
      if (min !== undefined && n < min) return getError('min_value', lang, min)
      if (max !== undefined && n > max) return getError('max_value', lang, max)
      break
    }
    case 'percentage': {
      const n = parseFloat(value.replace(',', '.'))
      if (isNaN(n) || n < 0 || n > 100) return getError('percentage', lang)
      break
    }
  }
  return null
}

export default function ValidatedInput({
  type, value, onChange, placeholder,
  label, required, min, max, decimals,
  disabled, autoFocus, lang = 'fr',
  className, style, onEnter,
}: ValidatedInputProps) {

  const [touched, setTouched] = useState(false)
  const [focused, setFocused] = useState(false)
  const error = touched ? validate(value, type, !!required, min, max, lang) : null

  const icons: Partial<Record<InputType, string>> = {
    phone:  '📞',
    email:  '📧',
    amount: '💰',
    search: '🔍',
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() }

    const filter = FILTERS[type]
    if (!filter) return

    const specialKeys = [
      'Backspace','Delete','Tab','Escape','Enter',
      'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
      'Home','End','a','c','v','x','z',
    ]
    if (specialKeys.includes(e.key)) return
    if (e.ctrlKey || e.metaKey) return
    if (!filter(e.key)) e.preventDefault()
  }, [type, onEnter])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    const filter = FILTERS[type]

    if (filter) val = val.split('').filter(filter).join('')

    switch (type) {
      case 'phone':
        val = val.replace(/[^\d\s+\-()]/g, '')
        break
      case 'amount': {
        val = val.replace(',', '.')
        const parts = val.split('.')
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('')
        if (decimals !== undefined && parts[1]?.length > decimals) {
          val = parts[0] + '.' + parts[1].slice(0, decimals)
        }
        break
      }
      case 'percentage':
        val = val.replace(',', '.')
        if (parseFloat(val) > 100) val = '100'
        if (parseFloat(val) < 0)   val = '0'
        break
    }

    onChange(val)
  }, [type, onChange, decimals])

  const icon = icons[type]
  const hasError = !!error
  const borderColor = hasError
    ? 'rgba(255,59,92,.5)'
    : focused
      ? 'var(--p)'
      : 'var(--border)'

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 'var(--fw-bold)',
          textTransform: 'uppercase', letterSpacing: '.6px',
          color: hasError ? 'var(--danger)' : 'var(--text3)',
          marginBottom: 6, transition: 'color .15s',
        }}>
          {label}
          {required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: 12,
            fontSize: 14, pointerEvents: 'none',
            color: focused ? 'var(--p2)' : 'var(--text3)',
            zIndex: 1, transition: 'color .15s',
          }}>{icon}</span>
        )}

        <input
          type={
            type === 'amount' || type === 'number' || type === 'percentage'
              ? 'text'
              : type === 'date'  ? 'date'
              : type === 'email' ? 'email'
              : 'text'
          }
          inputMode={
            type === 'phone' || type === 'number'
            || type === 'amount' || type === 'percentage'
              ? 'decimal' : undefined
          }
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTouched(true) }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={className ?? 'input'}
          style={{
            ...style,
            width: '100%',
            paddingLeft:  icon    ? 36 : undefined,
            paddingRight: hasError ? 36 : undefined,
            borderColor,
            boxShadow: hasError
              ? '0 0 0 3px rgba(255,59,92,.1)'
              : focused
                ? '0 0 0 3px rgba(108,71,255,.15)'
                : 'none',
            transition: 'border-color .15s, box-shadow .15s',
          }}
        />

        {touched && value && (
          <span style={{ position: 'absolute', right: 12, fontSize: 14, pointerEvents: 'none' }}>
            {hasError ? '❌' : '✅'}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          fontSize: 11, color: 'var(--danger)',
          marginTop: 5, fontWeight: 'var(--fw-regular)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
