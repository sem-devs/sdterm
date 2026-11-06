import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm">{description}</p>
      )}
      <div className="mt-4 flex flex-col divide-y border-y">{children}</div>
    </section>
  )
}

export function Row({
  label,
  hint,
  htmlFor,
  children,
  className
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex items-center justify-between gap-8 py-3.5', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-[13px] font-medium">
          {label}
        </label>
        {hint && <p className="text-muted-foreground max-w-[52ch] text-xs">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export function Toggle({
  id,
  checked,
  onChange
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return <Switch id={id} checked={checked} onCheckedChange={onChange} />
}

export function Choice<T extends string | number>({
  id,
  value,
  options,
  onChange,
  className
}: {
  id: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  className?: string
}): React.JSX.Element {
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => {
        const match = options.find((o) => String(o.value) === v)
        if (match) onChange(match.value)
      }}
    >
      <SelectTrigger id={id} className={cn('w-44', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(o.value)} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Range({
  id,
  value,
  min,
  max,
  step,
  format,
  onChange
}: {
  id: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <>
      <Slider
        id={id}
        className="w-36"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <span className="w-10 text-right font-mono text-xs tabular-nums">
        {format ? format(value) : value}
      </span>
    </>
  )
}

/** Text field that saves on blur or Enter, so half-typed paths are never applied. */
export function TextField({
  id,
  value,
  placeholder,
  onCommit,
  className
}: {
  id: string
  value: string
  placeholder?: string
  onCommit: (v: string) => void
  className?: string
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  // The stored value changed from outside (reset, another window): adopt it.
  if (seen !== value) {
    setSeen(value)
    setDraft(value)
  }
  const commit = (): void => {
    if (draft !== value) onCommit(draft.trim())
  }
  return (
    <Input
      id={id}
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      className={cn('w-60 font-mono text-xs', className)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
