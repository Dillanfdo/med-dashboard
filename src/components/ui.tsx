import * as Dialog from '@radix-ui/react-dialog'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { createContext, useContext, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-teal-800 text-white hover:bg-teal-900',
        outline: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50',
        ghost: 'text-stone-800 hover:bg-stone-100',
        danger: 'bg-red-800 text-white hover:bg-red-900',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-500',
        props.className,
      )}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn('min-h-24 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900', props.className)}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn('h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900', props.className)}
    />
  )
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-stone-600">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Badge({ children, tone = 'stone' }: { children: ReactNode; tone?: 'stone' | 'teal' | 'amber' | 'red' | 'violet' | 'blue' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-800',
    teal: 'bg-teal-50 text-teal-900',
    amber: 'bg-amber-50 text-amber-950',
    red: 'bg-red-50 text-red-900',
    violet: 'bg-violet-50 text-violet-950',
    blue: 'bg-blue-50 text-blue-950',
  }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-stone-200 bg-white p-4 shadow-sm', className)}>{children}</section>
}

const described = createContext<string | undefined>(undefined)

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  wide?: boolean
}) {
  const descriptionId = useId()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-900/40" />
        <Dialog.Content
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-xl',
            wide ? 'max-w-2xl' : 'max-w-lg',
          )}
        >
          <described.Provider value={descriptionId}>
            <Dialog.Title className="pr-8 text-lg font-semibold text-stone-900">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description id={descriptionId} className="mt-1 text-sm text-stone-600">
                {description}
              </Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">Dialog</Dialog.Description>
            )}
            <div className="mt-4">{children}</div>
          </described.Provider>
          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-stone-600 hover:bg-stone-100" aria-label="Close">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Drawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-900/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-stone-200 px-4 py-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">Session details</Dialog.Description>
            <Dialog.Close className="rounded-md p-1 text-stone-600 hover:bg-stone-100" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Menu({ trigger, children, label }: { trigger: ReactNode; children: ReactNode; label: string }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="z-50 min-w-56 rounded-md border border-stone-200 bg-white p-1 shadow-lg" align="end" sideOffset={6} aria-label={label}>
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

export function MenuItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return (
    <Dropdown.Item className="cursor-pointer rounded px-2 py-2 text-sm text-stone-800 outline-none data-[highlighted]:bg-stone-100" onSelect={onSelect}>
      {children}
    </Dropdown.Item>
  )
}

export const Tabs = TabsPrimitive.Root
export const TabsList = ({ children }: { children: ReactNode }) => (
  <TabsPrimitive.List className="flex gap-1 overflow-x-auto rounded-lg bg-stone-100 p-1">{children}</TabsPrimitive.List>
)
export const TabsTrigger = ({ value, children }: { value: string; children: ReactNode }) => (
  <TabsPrimitive.Trigger
    value={value}
    className="rounded-md px-3 py-1.5 text-sm text-stone-700 data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-stone-900"
  >
    {children}
  </TabsPrimitive.Trigger>
)
export const TabsContent = ({ value, children }: { value: string; children: ReactNode }) => (
  <TabsPrimitive.Content value={value} className="mt-4 focus:outline-none">
    {children}
  </TabsPrimitive.Content>
)

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (value: boolean) => void; label: string }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative h-6 w-11 rounded-full bg-stone-300 data-[state=checked]:bg-teal-800"
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-stone-200', className)} />
}

export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyBody,
  children,
}: {
  isLoading?: boolean
  isError?: boolean
  error?: unknown
  onRetry?: () => void
  isEmpty?: boolean
  emptyTitle?: string
  emptyBody?: string
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
        <p className="text-sm text-red-900">{error instanceof Error ? error.message : 'Something went wrong loading this.'}</p>
        {onRetry ? (
          <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    )
  }
  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center">
        <p className="font-medium text-stone-800">{emptyTitle ?? 'Nothing here yet'}</p>
        {emptyBody ? <p className="mt-1 text-sm text-stone-600">{emptyBody}</p> : null}
      </div>
    )
  }
  return children
}

export function useDescribedBy() {
  return useContext(described)
}
