import { test, expect } from '@playwright/test';
import { addProduct, apiRequest, availableProducts, installIsolatedReset, loginAs, loginCustomer, openCart } from './fr-e2e-support';

test.describe('FR-9: Admin จัดการสินค้า', () => {
  installIsolatedReset();

  test('FR-9.1–9.3: แก้ราคา/สต็อก ตรวจ validation และราคาใหม่มีผลกับ cart', async ({ page, context }) => {
    await loginAs(page, 'admin');
    const listing = await apiRequest(page, 'GET', '/products');
    const products = await listing.json() as Array<{ productId: string; name: string; price: number; stock: number; weightGram: number; status: string }>;
    const product = products.find(item => item.status === 'เปิดขาย' && item.stock > 0 && item.weightGram <= 20000);
    test.skip(!product, 'ต้องมีสินค้าเปิดขายและมีสต็อกใน seed');
    const row = page.getByTestId(`admin-product-row-${product!.productId}`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('admin-product-price')).toHaveAttribute('data-value', String(product!.price));

    // ลองค่าผิดตาม FR-9.1 แล้วตรวจ domain error โดย API เพื่อให้เห็น code/fields ชัดเจน
    const invalid = await apiRequest(page, 'PATCH', `/admin/products/${encodeURIComponent(product!.productId)}`, { price: 0, stock: 10000 });
    expect(invalid.status()).toBe(400);
    const invalidBody = await invalid.json();
    expect(invalidBody.code).toBe('VALIDATION_ERROR');
    expect(invalidBody.fields).toEqual(expect.arrayContaining(['price', 'stock']));
    const missing = await apiRequest(page, 'PATCH', '/admin/products/NO-SUCH-PRODUCT', { price: 100 });
    expect(missing.status()).toBe(404);
    expect((await missing.json()).code).toBe('PRODUCT_NOT_FOUND');

    const newPrice = product!.price + 1;
    const updated = await apiRequest(page, 'PATCH', `/admin/products/${encodeURIComponent(product!.productId)}`, { price: newPrice, stock: product!.stock });
    expect(updated.ok()).toBeTruthy();
    expect((await updated.json()).price).toBe(newPrice);

    const customer = await context.newPage();
    await loginCustomer(customer);
    const customerProducts = await apiRequest(customer, 'GET', '/products');
    const customerProduct = (await customerProducts.json() as Array<{ productId: string; price: number }>).find(item => item.productId === product!.productId);
    expect(customerProduct?.price).toBe(newPrice);
    await addProduct(customer, { id: product!.productId, price: newPrice, weightGram: product!.weightGram, stock: product!.stock, active: true }, 1);
    await openCart(customer);
    await expect(customer.getByTestId(`cart-line-${product!.productId}`).getByTestId('cart-line-unit-price')).toHaveAttribute('data-value', String(newPrice));
  });

  test('FR-9.4: ปิดขายสินค้าแล้วคงอยู่ในตะกร้าแต่แสดงว่าไม่พร้อมขาย', async ({ page, context }) => {
    const products = availableProducts(await loginCustomer(page));
    const product = products.find(item => item.weightGram <= 20000);
    test.skip(!product, 'ต้องมีสินค้าพร้อมขายใน seed');
    await addProduct(page, product!, 1);
    await openCart(page);

    const admin = await context.newPage();
    await loginAs(admin, 'admin');
    const adminRow = admin.getByTestId(`admin-product-row-${product!.id}`);
    await adminRow.getByTestId('admin-product-toggle-status').click();
    await expect(adminRow.getByTestId('admin-product-status')).toHaveAttribute('data-status', 'ปิดขาย');

    await page.reload();
    await openCart(page);
    const line = page.getByTestId(`cart-line-${product!.id}`);
    await expect(line).toBeVisible();
    await expect(line.getByTestId('cart-line-availability')).toHaveAttribute('data-available', 'false');

    const unavailableCheckout = await apiRequest(page, 'POST', '/checkout', { zone: 'inCity', speed: 'standard' });
    expect(unavailableCheckout.status()).toBe(400);
    const unavailableBody = await unavailableCheckout.json();
    expect(unavailableBody.code).toBe('ITEMS_UNAVAILABLE');
    expect(unavailableBody.productIds).toContain(product!.id);

    // เปิดขายกลับมาแล้วสร้างออเดอร์ จากนั้นเปลี่ยนสถานะ/ราคาเพื่อยืนยันว่า snapshot เดิมไม่เปลี่ยน
    await adminRow.getByTestId('admin-product-toggle-status').click();
    await expect(adminRow.getByTestId('admin-product-status')).toHaveAttribute('data-status', 'เปิดขาย');
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    const orderId = (await page.getByTestId('checkout-order-id').textContent())!.trim();
    const snapshotResponse = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(orderId)}`);
    const snapshot = await snapshotResponse.json();

    const priceInput = adminRow.getByTestId('admin-product-price-input');
    await priceInput.fill(String(product!.price + 10));
    await adminRow.getByTestId('admin-product-save').click();
    await expect(adminRow.getByTestId('admin-product-price')).toHaveAttribute('data-value', String(product!.price + 10));
    await adminRow.getByTestId('admin-product-toggle-status').click();
    await expect(adminRow.getByTestId('admin-product-status')).toHaveAttribute('data-status', 'ปิดขาย');
    const unchanged = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(orderId)}`);
    const unchangedSnapshot = await unchanged.json();
    expect(unchangedSnapshot.items).toEqual(snapshot.items);
    expect(unchangedSnapshot.subtotal).toBe(snapshot.subtotal);
  });
});
