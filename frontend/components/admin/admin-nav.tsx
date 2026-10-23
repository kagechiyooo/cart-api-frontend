'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/admin/products', label: 'Products', testId: 'admin-nav-products' },
  { href: '/admin/coupons', label: 'Coupons', testId: 'admin-nav-coupons' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        Admin console
      </p>
      <nav aria-label="Admin">
        <ul className="inline-flex rounded-lg bg-muted p-1">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  data-testid={link.testId}
                  className={cn(
                    'block rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
