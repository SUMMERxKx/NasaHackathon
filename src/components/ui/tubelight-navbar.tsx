// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The tubelight navbar. Adapted from the component the owner supplied (21st.dev style) to
// React Router: NavLink lights the tab of the current route, and every link keeps the habitat.
// The lamp is measured only when the route changes, not each time the habitat in the address does.
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { scenarioQuery } from '@/state/scenario.ts'

export interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const [params] = useSearchParams()
  const query = scenarioQuery(params)

  return (
    <nav aria-label="Main" className={cn('no-print fixed bottom-0 left-1/2 z-50 mb-4 -translate-x-1/2 sm:bottom-auto sm:top-0 sm:mb-0 sm:pt-4', className)}>
      <div className="flex items-center gap-1 rounded-full border border-border bg-surface/70 px-1 py-1 shadow-lg backdrop-blur-lg sm:gap-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={`${item.url}${query}`}
              aria-label={item.name}
              className={({ isActive }) =>
                cn(
                  'relative cursor-pointer rounded-full px-5 py-2 text-sm font-semibold no-underline transition-colors hover:no-underline md:px-6',
                  'text-foreground/75 hover:text-primary',
                  isActive && 'bg-surface-2 text-primary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden">
                    <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  {isActive && (
                    <motion.div layoutId="lamp" layoutDependency={item.url} className="absolute inset-0 -z-10 w-full rounded-full bg-primary/5" initial={false} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
                      <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-primary">
                        <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-primary/20 blur-md" />
                        <div className="absolute -top-1 h-6 w-8 rounded-full bg-primary/20 blur-md" />
                        <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-primary/20 blur-sm" />
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
