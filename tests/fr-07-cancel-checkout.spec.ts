import { test, expect } from '@playwright/test';
import { addProduct, apiRequest, availableProducts, installIsolatedReset, loginCustomer, openCart } from './fr-e2e-support';

test.describe('FR-7: ยกเลิก checkout และคืนสต็อก', () => {
  installIsolatedReset();

  // FR-7: ยกเลิกแล้วคืน stage/รายการ/สต็อก และ checkout ซ้ำต้องสร้าง orderId ใหม่
  test('FR-7.1–7.4: ยกเลิกคืนตะกร้าและสต็อก; checkout รอบใหม่ได้ orderId ใหม่', async ({ page }) => {
    const products = availableProducts(await loginCustomer(page));
    const product = products.find(item => item.weightGram <= 20000);
    test.skip(!product, 'ต้องมีสินค้าพร้อมขายน้ำหนักไม่เกิน 20,000 กรัมใน seed');
    await addProduct(page, product!, 1);
    await openCart(page);
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    const firstOrderId = (await page.getByTestId('checkout-order-id').textContent())!.trim();

    await page.getByTestId('cancel-checkout-button').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId(`cart-line-${product!.id}`)).toBeVisible();
    await expect(page.getByTestId(`cart-line-${product!.id}`).getByTestId('cart-line-qty')).toHaveAttribute('data-value', '1');
    const cancelled = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(firstOrderId)}`);
    expect((await cancelled.json()).status).toBe('ยกเลิก');
    const restockedResponse = await apiRequest(page, 'GET', '/products');
    const restocked = await restockedResponse.json() as Array<{ productId: string; stock: number }>;
    expect(restocked.find(row => row.productId === product!.id)!.stock).toBe(product!.stock);

    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    const secondOrderId = (await page.getByTestId('checkout-order-id').textContent())!.trim();
    expect(secondOrderId).not.toBe(firstOrderId);
  });
});
