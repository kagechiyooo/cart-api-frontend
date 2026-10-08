'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ProductFormDialog } from '@/components/admin/product-form-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProductImage } from '@/components/products/product-image'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, getErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useProducts, useRevalidate } from '@/lib/hooks/use-api'
import type { Product } from '@/lib/types'

export function AdminProductsView() {
  const { data: products, error, isLoading, mutate } = useProducts({ includeInactive: true })
  const revalidate = useRevalidate()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setFormOpen(true)
  }

  async function refreshAfterChange() {
    await Promise.all([revalidate.products(), revalidate.cart()])
  }

  let content: React.ReactNode
  if (isLoading) {
    content = <LoadingState label="Loading products…" />
  } else if (error || !products) {
    content = (
      <ErrorState
        title="Could not load products"
        message={getErrorMessage(error)}
        onRetry={() => mutate()}
      />
    )
  } else if (products.length === 0) {
    content = (
      <EmptyState
        title="No products yet"
        description="Create your first product to get started."
        action={<Button onClick={openCreate}>Add product</Button>}
      />
    )
  } else {
    content = (
      <div className="rounded-lg border bg-card">
        <Table data-testid="admin-products-table">
          <caption className="sr-only">All products</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Product</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} data-testid={`admin-product-row-${product.id}`}>
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
                  {formatCurrency(product.priceCents)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${product.stock === 0 ? 'text-destructive' : ''}`}
                >
                  {product.stock}
                </TableCell>
                <TableCell>
                  <Badge variant={product.active ? 'default' : 'secondary'}>
                    {product.active ? 'Active' : 'Hidden'}
                  </Badge>
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${product.name}`}
                      onClick={() => openEdit(product)}
                      data-testid="edit-product"
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${product.name}`}
                      onClick={() => setDeleting(product)}
                      data-testid="delete-product"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Create, edit and remove products from the catalog."
        actions={
          <Button onClick={openCreate} data-testid="add-product">
            <Plus aria-hidden="true" />
            Add product
          </Button>
        }
      />
      {content}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSaved={refreshAfterChange}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'product'}?`}
        description="The product will be removed from the catalog and from every cart."
        confirmLabel="Delete product"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!deleting) return
          await api.products.remove(deleting.id)
          await refreshAfterChange()
          toast.success(`${deleting.name} deleted.`)
        }}
      />
    </>
  )
}
