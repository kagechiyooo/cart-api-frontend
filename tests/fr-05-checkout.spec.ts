import { test, expect } from '@playwright/test';
import { addProduct, apiRequest, availableProducts, installIsolatedReset, loginCustomer, openCart } from './fr-e2e-support';

test.describe('FR-5: ตรวจสอบและสร้างคำสั่งซื้อ', () => {
  installIsolatedReset();

  test('FR-5.1: checkout ที่สำเร็จสร้าง order snapshot และจองสต็อก', async ({ page }) => {
    const products = availableProducts(await loginCustomer(page));
    const product = products.find(item => item.weightGram <= 20000);
    test.skip(!product, 'ต้องมีสินค้าพร้อมขายน้ำหนักไม่เกิน 20,000 กรัมใน seed');

    await addProduct(page, product!, 1);
    await openCart(page);
    const before = await apiRequest(page, 'GET', '/products');
    expect(before.ok()).toBeTruthy();
    const beforeRows = await before.json() as Array<{ productId: string; stock: number }>;
    const stockBefore = beforeRows.find(row => row.productId === product!.id)!.stock;

    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    const orderId = (await page.getByTestId('checkout-order-id').textContent())?.trim();
    expect(orderId).toBeTruthy();
    await expect(page.getByTestId(`checkout-line-${product!.id}`)).toBeVisible();
    await expect(page.getByTestId('checkout-line-qty')).toHaveAttribute('data-value', '1');

    const orderResponse = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(orderId!)}`);
    expect(orderResponse.ok()).toBeTruthy();
    const order = await orderResponse.json() as { status: string; items: Array<{ productId: string; price: number; quantity: number }>; subtotal: number; netTotal: number };
    expect(order.status).toBe('รอชำระเงิน');
    expect(order.items).toContainEqual(expect.objectContaining({ productId: product!.id, price: product!.price, quantity: 1 }));
    expect(order.subtotal).toBe(product!.price);
    expect(order.netTotal).toBeGreaterThanOrEqual(0);

    const after = await apiRequest(page, 'GET', '/products');
    const afterRows = await after.json() as Array<{ productId: string; stock: number }>;
    expect(afterRows.find(row => row.productId === product!.id)!.stock).toBe(stockBefore - 1);
    const cartResponse = await apiRequest(page, 'GET', '/cart');
    expect((await cartResponse.json()).stage).toBe('ชำระเงิน');
  });

  test('FR-5.2: ตะกร้าว่างและข้อมูล zone/speed ไม่ถูกต้องถูกปฏิเสธ', async ({ page }) => {
    await loginCustomer(page);
    const empty = await apiRequest(page, 'POST', '/checkout', { zone: 'inCity', speed: 'standard' });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).code).toBe('CART_EMPTY');

    const product = availableProducts(await (async () => {
      const response = await apiRequest(page, 'GET', '/products');
      const rows = await response.json() as Array<{ productId: string; price: number; weightGram: number; stock: number; status: string }>;
      return rows.map(row => ({ id: row.productId, price: row.price, weightGram: row.weightGram, stock: row.stock, active: row.status === 'เปิดขาย' }));
    })())[0];
    test.skip(!product, 'ต้องมีสินค้าพร้อมขายใน seed');
    await addProduct(page, product!, 1);

    // SRS กำหนดให้ตรวจ zone/speed ก่อนตรวจว่าตะกร้าว่างหรือไม่
    const invalid = await apiRequest(page, 'POST', '/checkout', { zone: 'unknown-zone', speed: 'standard' });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).code).toBe('VALIDATION_ERROR');
    const invalidSpeed = await apiRequest(page, 'POST', '/checkout', { zone: 'inCity', speed: 'overnight' });
    expect(invalidSpeed.status()).toBe(400);
    expect((await invalidSpeed.json()).code).toBe('VALIDATION_ERROR');
  });
});
