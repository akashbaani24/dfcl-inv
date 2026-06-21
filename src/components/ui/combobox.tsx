'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type ComboOption = {
  value: string
  label: string
  subLabel?: string
  raw?: unknown
}

interface ComboboxProps {
  options: ComboOption[]
  /**
   * The text to display in the input.
   * - When `allowFreeText` is false (default): pass the selected option's value (ID).
   * - When `allowFreeText` is true: pass the human-readable text (e.g. the entry's name).
   */
  value: string
  onChange: (value: string, option?: ComboOption) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Allow clearing the value when input is emptied (for optional fields). */
  clearable?: boolean
  /** Render a footer line below options (e.g. "+ Add new"). */
  footer?: React.ReactNode
  /**
   * When true, the input shows `value` directly (treated as free text).
   * Typing fires onChange with the typed text and no option — so callers can store
   * free-text entries that are not in the options list.
   * Selecting from the dropdown still fires onChange with the option's label/value.
   */
  allowFreeText?: boolean
}

/**
 * Lightweight inline combobox — type-to-filter dropdown.
 * Built with native input + absolute-positioned dropdown (no Popover/Command overhead).
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  className,
  disabled,
  clearable,
  footer,
  allowFreeText,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Find the currently-selected option to display its label
  const selected = options.find(o => o.value === value || (allowFreeText && o.label === value))
  // In free-text mode, `value` itself IS the text to show (the user's typed name).
  // In id-mode, show the matched option's label.
  const displayValue = open ? query : (allowFreeText ? (value ?? '') : (selected?.label ?? ''))

  // Filter options based on the query (case-insensitive, matches label OR subLabel)
  const filtered = React.useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.subLabel ?? '').toLowerCase().includes(q) ||
      (o.value ?? '').toLowerCase().includes(q)
    )
  }, [options, query])

  const handleInputFocus = () => {
    setOpen(true)
    // Reset query to empty so the user sees the full list when they start typing
    setQuery('')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    // In free-text mode, every keystroke propagates the typed text upward so the
    // parent state stays in sync with what's displayed. option is undefined so the
    // caller knows this is a free-text entry (no makingInfoId match).
    if (allowFreeText) {
      // If the typed text matches an option's label exactly, also pass that option
      // so the caller can pick up the associated id/cost/unit.
      const matched = options.find(o => o.label === v)
      onChange(v, matched)
      return
    }
    // If the field is clearable and input is empty, fire onChange with empty string
    if (clearable && !v) {
      onChange('', undefined)
    }
  }

  const handleSelect = (opt: ComboOption) => {
    // In free-text mode, propagate the human-readable label so the input continues
    // to show the chosen name. Callers receive the option too, so they can grab
    // the underlying id/cost.
    if (allowFreeText) {
      onChange(opt.label, opt)
    } else {
      onChange(opt.value, opt)
    }
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Select the first matching option if any.
      // In free-text mode, if nothing matches, the typed text is already preserved
      // via handleInputChange — just close the dropdown.
      if (filtered.length > 0) {
        handleSelect(filtered[0])
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(className)}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-[9999] mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 italic">No matches found</div>
          ) : (
            filtered.map(opt => {
              const isSelected = opt.value === value
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm border-b last:border-0 transition-colors',
                    isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.subLabel && (
                      <span className="text-xs text-slate-500">{opt.subLabel}</span>
                    )}
                  </div>
                </button>
              )
            })
          )}
          {footer && (
            <div className="border-t bg-slate-50/50">{footer}</div>
          )}
        </div>
      )}
    </div>
  )
}
