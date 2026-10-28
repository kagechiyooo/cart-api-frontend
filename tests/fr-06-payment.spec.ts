import { test, expect } from '@playwright/test';
import { addProduct, apiRequest, availableProducts, gatewayRequest, installIsolatedReset, loginCustomer, openCart } from './fr-e2e-support';

async function createPendingOrder(page: import('@playwright/test').Page) {
  const products = availableProducts(await loginCustomer(page));
  const product = products.find(item => item.weightGram <= 20000);
  test.skip(!product, 'ต้องมีสินค้าพร้อมขายน้ำหนักไม่เกิน 20,000 กรัมใน seed');
  await addProduct(page, product!, 1);
  await openCart(page);
  await page.getByTestId('checkout-button').click();
  await expect(page.getByTestId('page-checkout')).toBeVisible();
  return (await page.getByTestId('checkout-order-id').textContent())!.trim();
}

test.describe('FR-6: ผลการชำระเงิน', () => {
  installIsolatedReset();

  // FR-6.1 และ FR-6.3: callback สำเร็จต้องบันทึกสถานะ จบ stage และล้างตะกร้า
  test('FR-6.1 และ FR-6.3: ชำระสำเร็จ เปลี่ยนสถานะและล้างตะกร้า', async ({ page }) => {
    const orderId = await createPendingOrder(page);
    const response = await gatewayRequest(page, `/payments/${encodeURIComponent(orderId)}/success`);
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).status).toBe('ชำระเงินแล้ว');

    await page.reload();
    await expect(page.getByTestId('page-success')).toBeVisible();
    await expect(page.getByTestId('success-order-id')).toHaveText(orderId);
    const cart = await apiRequest(page, 'GET', '/cart');
    const cartData = await cart.json();
    expect(cartData.stage).toBe('สำเร็จ');
    expect(cartData.items).toHaveLength(0);
    const order = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(orderId)}`);
    expect((await order.json()).status).toBe('ชำระเงินแล้ว');

    await page.getByTestId('continue-shopping-button').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
  });

  // FR-6.2: callback ล้มเหลวคงออเดอร์/การจองสต็อกไว้และอนุญาตให้ลองซ้ำ
  test('FR-6.2: ชำระไม่สำเร็จยังคง pending และลองซ้ำได้', async ({ page }) => {
    const orderId = await createPendingOrder(page);
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await gatewayRequest(page, `/payments/${encodeURIComponent(orderId)}/fail`);
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).message).toBe('การชำระเงินล้มเหลว กรุณาลองใหม่');
      const order = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(orderId)}`);
      expect((await order.json()).status).toBe('รอชำระเงิน');
      const cart = await apiRequest(page, 'GET', '/cart');
      expect((await cart.json()).stage).toBe('ชำระเงิน');
    }
    const unknown = await gatewayRequest(page, '/payments/not-an-existing-order/success');
    expect(unknown.status()).toBe(404);
    expect((await unknown.json()).code).toBe('ORDER_NOT_FOUND');
  });
});
