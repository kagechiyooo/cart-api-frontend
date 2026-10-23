'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, ShoppingCart, Store, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { AppMessage } from '@/components/app-message'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'
import { useCart } from '@/lib/hooks/use-api'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'

interface NavLink {
  href: string
  label: string
  matchPrefix: string
  testId: string
}

function getNavLinks(user: User | null): NavLink[] {
  const links: NavLink[] = [
    { href: '/products', label: 'Products', matchPrefix: '/products', testId: 'nav-products' },
  ]
  if (user?.role === 'customer') {
    links.push({ href: '/orders', label: 'Orders', matchPrefix: '/orders', testId: 'nav-orders' })
  }
  if (user?.role === 'admin') {
    links.push({
      href: '/admin/products',
      label: 'Admin',
      matchPrefix: '/admin',
      testId: 'nav-admin-products',
    })
  }
  if (user?.role === 'admin') links.push({ href: '/admin/coupons', label: 'Coupons', matchPrefix: '/admin/coupons', testId: 'nav-admin-coupons' })
  return links
}

export function SiteHeader() {
  const { user, logout } = useAuth()
  const { data: cart } = useCart()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
    const [logoutError, setLogoutError] = useState<unknown>(null)

  const links = getNavLinks(user)
  const cartCount = cart?.count ?? 0

  async function handleLogout() {
    setSigningOut(true)
        setLogoutError(null)
    try {
      await logout()
      setMenuOpen(false)
      toast.success('You have been signed out.')
      router.push('/login')
    } catch (error) {
      setLogoutError(error)
    } finally {
      setSigningOut(false)
    }
  }

  const navItems = links.map((link) => {
    const active = pathname.startsWith(link.matchPrefix)
    return (
      <li key={link.href}>
        <Link
          href={link.href}
          data-testid={link.testId}
          aria-current={active ? 'page' : undefined}
          onClick={() => setMenuOpen(false)}
          className={cn(
            'block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
            active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
          )}
        >
          {link.label}
        </Link>
      </li>
    )
  })

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link
          href="/products"
          className="flex items-center gap-2 font-semibold tracking-tight"
          data-testid="brand-link"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden="true" />
          </span>
          Cartwise
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">{navItems}</ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user?.role === 'customer' && (
            <Link
              href="/cart"
              data-testid="nav-cart"
              aria-label={`Shopping cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
              aria-current={pathname === '/cart' ? 'page' : undefined}
              className={cn(buttonVariants({ variant: 'ghost' }), 'relative')}
            >
              <ShoppingCart aria-hidden="true" />
              <span className="hidden sm:inline">Cart</span>
              <span
                data-testid="cart-count"
                aria-hidden="true"
                className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums"
              >
                {cartCount}
              </span>
            </Link>
          )}

          {user ? (
            <div className="hidden items-center gap-3 md:flex">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm font-medium" data-testid="current-user-name">
                  {user.name}
                </span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] uppercase">
                  {user.role}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={signingOut}
                data-testid="logout-button"
              >
                <LogOut aria-hidden="true" />
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </div>
          ) : (
            <Link
              href="/login"
              data-testid="nav-login"
              className={cn(buttonVariants({ size: 'sm' }), 'hidden md:inline-flex')}
            >
              Sign in
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
            data-testid="mobile-menu-toggle"
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {logoutError != null && <AppMessage error={logoutError} />}
            {menuOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">{navItems}</ul>
          <div className="mt-3 border-t pt-3">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  Signed in as <span className="font-medium">{user.name}</span>
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout} disabled={signingOut}>
                  <LogOut aria-hidden="true" />
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className={cn(buttonVariants(), 'w-full')}
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
