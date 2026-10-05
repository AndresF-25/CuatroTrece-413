import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}): React.JSX.Element {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-700',
        variant === 'secondary' && 'border border-slate-300 bg-white hover:bg-slate-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        variant === 'ghost' && 'hover:bg-slate-200',
        className
      )}
    />
  )
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

/** Fila "etiqueta … valor" para resúmenes y totales. */
export function SummaryRow({
  label,
  value,
  bold
}: {
  label: string
  value: string
  bold?: boolean
}): React.JSX.Element {
  return (
    <div className={clsx('flex justify-between', bold && 'text-base font-semibold')}>
      <span className={bold ? '' : 'text-slate-600'}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select
        {...props}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      >
        {children}
      </select>
    </label>
  )
}

export function Badge({
  tone = 'gray',
  children
}: {
  tone?: 'gray' | 'green' | 'red' | 'amber'
  children: ReactNode
}): React.JSX.Element {
  return (
    <span
      className={clsx(
        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'gray' && 'bg-slate-100 text-slate-700',
        tone === 'green' && 'bg-green-100 text-green-800',
        tone === 'red' && 'bg-red-100 text-red-800',
        tone === 'amber' && 'bg-amber-100 text-amber-800'
      )}
    >
      {children}
    </span>
  )
}

export function Alert({
  kind = 'error',
  children
}: {
  kind?: 'error' | 'success' | 'info'
  children: ReactNode
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className={clsx(
        'rounded-md border px-3 py-2 text-sm',
        kind === 'error' && 'border-red-200 bg-red-50 text-red-800',
        kind === 'success' && 'border-green-200 bg-green-50 text-green-800',
        kind === 'info' && 'border-blue-200 bg-blue-50 text-blue-800'
      )}
    >
      {children}
    </div>
  )
}

export function Card({
  className,
  children
}: {
  className?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className={clsx('rounded-lg border border-slate-200 bg-white p-6 shadow-sm', className)}>
      {children}
    </div>
  )
}
