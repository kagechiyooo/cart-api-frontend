import { test, expect } from '@playwright/test';
import { addProduct, apiRequest, availableProducts, gatewayRequest, installIsolatedReset, loginCustomer, openCart } from './fr-e2e-support';

test.describe('FR-8: จำกัด operation ตาม stage', () => {
  installIsolatedReset();

  test('FR-8.1: ขณะ checkout บล็อกการแก้ตะกร้าและอนุญาตการอ่าน', async ({ page }) => {
    const products = availableProducts(await loginCustomer(page));
    const product = products.find(item => item.weightGram <= 20000);
    test.skip(!product, 'ต้องมีสินค้าพร้อมขายน้ำหนักไม่เกิน 20,000 กรัมใน seed');
    await addProduct(page, product!, 1);
    await openCart(page);
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    const orderId = (await page.getByTestId('checkout-order-id').textContent())!.trim();

    const blocked = [
      await apiRequest(page, 'POST', '/cart/items', { productId: product!.id, quantity: 1 }),
      await apiRequest(page, 'PATCH', `/cart/items/${encodeURIComponent(product!.id)}`, { quantity: 2 }),
      await apiRequest(page, 'DELETE', `/cart/items/${encodeURIComponent(product!.id)}`),
      await apiRequest(page, 'PUT', '/cart/coupon', { code: 'SAVE10' }),
      await apiRequest(page, 'POST', '/checkout', { zone: 'inCity', speed: 'standard' }),
    ];
    for (const response of blocked) {
      expect(response.status()).toBe(400);
      expect((await response.json()).code).toBe('OPERATION_NOT_ALLOWED');
    }

    // FR-8 อนุญาตอ่านตะกร้า สินค้า รายการออเดอร์ และออเดอร์ของตนได้ทุก stage
    for (const [method, path] of [
      ['GET', '/cart'], ['GET', '/products'], ['GET', '/orders'], ['GET', `/orders/${encodeURIComponent(orderId)}`],
    ] as const) {
      const response = await apiRequest(page, method, path);
      expect(response.ok(), `${method} ${path} should be readable during checkout`).toBeTruthy();
    }
    const cart = await apiRequest(page, 'GET', '/cart');
    const current = await cart.json();
    expect(current.stage).toBe('ชำระเงิน');
    expect(current.items).toHaveLength(1);
    expect(current.items[0].quantity).toBe(1);
  });

  test('FR-8.2: operation ต่อคำสั่งซื้อที่ยกเลิกแล้วและ continue shopping ใน stage ตะกร้าถูกปฏิเสธ', async ({ page }) => {
    const products = availableProducts(await loginCustomer(page));
    const product = products.find(item => item.weightGram <= 20000);
    test.skip(!product, 'ต้องมีสินค้าพร้อมขายน้ำหนักไม่เกิน 20,000 กรัมใน seed');
    await addProduct(page, product!, 1);
    await openCart(page);
    await page.getByTestId('checkout-button').click();
    const orderId = (await page.getByTestId('checkout-order-id').textContent())!.trim();
    await page.getByTestId('cancel-checkout-button').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();

    for (const action of ['success', 'fail'] as const) {
      const response = await gatewayRequest(page, `/payments/${encodeURIComponent(orderId)}/${action}`);
      expect(response.status()).toBe(400);
      expect((await response.json()).code).toBe('OPERATION_NOT_ALLOWED');
    }
    const cancelAgain = await apiRequest(page, 'POST', '/checkout/cancel');
    expect((await cancelAgain.json()).code).toBe('OPERATION_NOT_ALLOWED');
    const continueAtCart = await apiRequest(page, 'POST', '/checkout/continue-shopping');
    expect((await continueAtCart.json()).code).toBe('OPERATION_NOT_ALLOWED');
  });
});
