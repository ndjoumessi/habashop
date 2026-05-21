import { useState, useCallback } from 'react'

type FieldType = 'text' | 'phone' | 'email' | 'number' | 'amount' | 'name' | 'required'

interface FieldConfig {
  type:      FieldType
  required?: boolean
  min?:      number
  max?:      number
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  fields: Partial<Record<keyof T, FieldConfig>>,
) {
  const [values,  setValues]  = useState<T>(initialValues)
  const [errors,  setErrors]  = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouchedState] = useState<Partial<Record<keyof T, boolean>>>({})

  const validateField = useCallback((field: keyof T, value: any): boolean => {
    const config = fields[field]
    if (!config) return true

    let error: string | null = null
    const v = String(value ?? '').trim()

    if (config.required && !v) {
      error = 'Ce champ est requis'
    } else if (v && config.type === 'phone') {
      const digits = v.replace(/[\s\-()]/g, '')
      if (!/^\+?[\d]{6,15}$/.test(digits)) error = 'Numéro de téléphone invalide'
    } else if (v && config.type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) error = 'Email invalide'
    } else if (v && (config.type === 'number' || config.type === 'amount')) {
      const n = parseFloat(v)
      if (isNaN(n)) {
        error = 'Nombre invalide'
      } else if (config.min !== undefined && n < config.min) {
        error = `Minimum : ${config.min}`
      } else if (config.max !== undefined && n > config.max) {
        error = `Maximum : ${config.max}`
      }
    }

    setErrors(prev => ({ ...prev, [field]: error ?? undefined }))
    return !error
  }, [fields])

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    setTouchedState(prev => {
      if (prev[field]) validateField(field, value)
      return prev
    })
  }, [validateField])

  const validateAll = useCallback((): boolean => {
    let isValid = true
    const newTouched: Partial<Record<keyof T, boolean>> = {}

    for (const field of Object.keys(fields) as (keyof T)[]) {
      newTouched[field] = true
      const valid = validateField(field, values[field])
      if (!valid) isValid = false
    }

    setTouchedState(newTouched)
    return isValid
  }, [fields, values, validateField])

  const reset = useCallback((newValues?: T) => {
    setValues(newValues ?? initialValues)
    setErrors({})
    setTouchedState({})
  }, [initialValues])

  const touchField = useCallback((field: keyof T) => {
    setTouchedState(prev => ({ ...prev, [field]: true }))
  }, [])

  return {
    values, errors, touched,
    setValue, validateField, validateAll, reset, touchField,
  }
}
