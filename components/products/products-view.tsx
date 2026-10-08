'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { NativeSelect } from '@/components/form-field'
import { ProductCard } from '@/components/products/product-card'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api'
import { useProducts } from '@/lib/hooks/use-api'
import type { Product } from '@/lib/types'

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name'

const sorters: Record<SortOption, ((a: Product, b: Product) => number) | null> = {
  featured: null,
  'price-asc': (a, b) => a.priceCents - b.priceCents,
  'price-desc': (a, b) => b.priceCents - a.priceCents,
  name: (a, b) => a.name.localeCompare(b.name),
}

export function ProductsView() {
  const { data: products, error, isLoading, mutate } = useProducts()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortOption>('featured')

  const categories = useMemo(
    () => Array.from(new Set(products?.map((p) => p.category))).sort(),
    [products],
  )

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const filtered = (products ?? []).filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)),
    )
    const sorter = sorters[sort]
    return sorter ? [...filtered].sort(sorter) : filtered
  }, [products, query, category, sort])

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setSort('featured')
  }

  return (
    <div className="flex flex-col gap-6">
      <search
        aria-label="Filter products"
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto_auto]"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-search">Search products</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="product-search"
              type="search"
              placeholder="Search by name or description"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-filter">Category</Label>
          <NativeSelect
            id="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="sm:w-44"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sort-select">Sort by</Label>
          <NativeSelect
            id="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="sm:w-44"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name</option>
          </NativeSelect>
        </div>
      </search>

      {isLoading ? (
        <div role="status" aria-live="polite" data-testid="loading-state">
          <span className="sr-only">Loading products…</span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load products"
          message={getErrorMessage(error)}
          onRetry={() => mutate()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try a different search term or category."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="product-count">
            Showing {visible.length} of {products?.length ?? 0} products
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Product list">
            {visible.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
