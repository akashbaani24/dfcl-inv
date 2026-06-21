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
  value: string
  onChange: (value: string, option?: ComboOption) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Allow clearing the value when input is emptied (for optional fields). */
  clearable?: boolean
  /** Render a footer line below options (e.g. "+ Add new"). */
  footer?: React.ReactNode
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
  const selected = options.find(o => o.value === value)
  const displayValue = open ? query : (selected?.label ?? '')

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
    setQuery(e.target.value)
    setOpen(true)
    // If the field is clearable and input is empty, fire onChange with empty string
    if (clearable && !e.target.value) {
      onChange('', undefined)
    }
  }

  const handleSelect = (opt: ComboOption) => {
    onChange(opt.value, opt)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Select the first matching option
      if (filtered.length > 0) {
        handleSelect(filtered[0])
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
