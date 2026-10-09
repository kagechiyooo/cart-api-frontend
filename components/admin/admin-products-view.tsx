'use client'

import { useEffect, useState } from 'react'
import { AppMessage } from '@/components/app-message'
import { ProductImage } from '@/components/products/product-image'
import { EmptyState, LoadingState, PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, ApiError } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useProducts, useRevalidate } from '@/lib/hooks/use-api'
import type { Product } from '@/lib/types'

function ProductRow({ product }: { product: Product }) {
  const [price, setPrice] = useState(String(product.priceCents))
  const [stock, setStock] = useState(String(product.stock))
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const revalidate = useRevalidate()
  const formId = `admin-product-form-${product.id}`

  useEffect(() => {
    setPrice(String(product.priceCents))
    setStock(String(product.stock))
  }, [product.priceCents, product.stock])

  async function save(toggle = false) {
    setPending(true)
    setError(null)
    try {
      if (toggle) {
        await api.products.setStatus(product.id, product.active ? 'ปิดขาย' : 'เปิดขาย')
      } else {
        await api.products.update(product.id, {
          priceCents: price.trim() ? Number(price) : NaN,
          stock: stock.trim() ? Number(stock) : NaN,
        })
      }
      await revalidate.products()
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
    }
  }

  const fields = error instanceof ApiError ? error.fields : undefined
  return (
    <TableRow data-testid={`admin-product-row-${product.id}`}>
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
            <ProductImage src={product.imageUrl} alt="" />
          </div>
          <span className="font-medium">{product.name}</span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{product.category}</TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="flex flex-col items-end gap-2">
          <span data-testid="admin-product-price" data-value={product.priceCents}>{formatCurrency(product.priceCents)}</span>
          <Input form={formId} aria-label={`Price ${product.name}`} aria-invalid={fields?.includes('price')} data-testid="admin-product-price-input" type="number" step="1" value={price} disabled={pending} onChange={e => setPrice(e.target.value)} className="w-28 text-right" />
        </div>
      </TableCell>
      <TableCell className={`text-right tabular-nums ${product.stock === 0 ? 'text-destructive' : ''}`}>
        <div className="flex flex-col items-end gap-2">
          <span data-testid="admin-product-stock" data-value={product.stock}>{product.stock}</span>
          <Input form={formId} aria-label={`Stock ${product.name}`} aria-invalid={fields?.includes('stock')} data-testid="admin-product-stock-input" type="number" step="1" value={stock} disabled={pending} onChange={e => setStock(e.target.value)} className="w-20 text-right" />
        </div>
      </TableCell>
      <TableCell>
        <Badge data-testid="admin-product-status" data-status={product.active ? 'เปิดขาย' : 'ปิดขาย'} variant={product.active ? 'default' : 'secondary'}>
          {product.active ? 'On sale' : 'Not for sale'}
        </Badge>
      </TableCell>
      <TableCell className="pr-4">
        <form id={formId} noValidate aria-label={`Edit ${product.name}`} className="flex justify-end gap-1" onSubmit={e => { e.preventDefault(); void save() }}>
          <Button size="sm" data-testid="admin-product-save" disabled={pending}>Save</Button>
          <Button size="sm" type="button" variant="outline" data-testid="admin-product-toggle-status" disabled={pending} onClick={() => void save(true)}>Toggle status</Button>
        </form>
        {error != null && <div className="mt-2"><AppMessage error={error} /></div>}
      </TableCell>
    </TableRow>
  )
}

export function AdminProductsView() {
  const { data, error } = useProducts({ includeInactive: true })
  return (
    <section data-testid="page-admin-products">
      <PageHeader title="Products" description="Manage prices, stock, and availability" />
      {error ? <AppMessage error={error} /> : !data ? <LoadingState label="Loading products…" /> : data.length === 0 ? (
        <EmptyState title="No products yet" description="No products are available in the catalog." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table data-testid="admin-products-table">
            <caption className="sr-only">All products. Prices are in whole THB.</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Product</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Price (THB)</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{data.map(product => <ProductRow key={product.id} product={product} />)}</TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
