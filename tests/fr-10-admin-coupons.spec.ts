import { test, expect } from '@playwright/test';
import { addProduct, apiRequest, availableProducts, installIsolatedReset, loginAs, loginCustomer, openCart } from './fr-e2e-support';

test.describe('FR-10: Admin จัดการคูปอง', () => {
  installIsolatedReset();

  test('FR-10.1 และ FR-10.2: แสดงรายการคูปอง; ปิดคูปองมีผลกับ checkout ถัดไปเท่านั้น', async ({ page, context }) => {
    const products = availableProducts(await loginCustomer(page));
    const chosen = products.filter(item => item.weightGram <= 20000);
    test.skip(!chosen.length, 'ต้องมีสินค้าพร้อมขายใน seed');
    const plan: typeof chosen = [];
    let subtotal = 0;
    let totalWeight = 0;
    for (const product of chosen) {
      if (totalWeight + product.weightGram > 20000) continue;
      plan.push(product);
      subtotal += product.price;
      totalWeight += product.weightGram;
      if (subtotal >= 1000) break;
    }
    test.skip(subtotal < 1000, 'ต้องมีสินค้าใน seed ให้ยอดถึงขั้นต่ำคูปอง SAVE10 โดยน้ำหนักรวมไม่เกิน 20,000 กรัม');
    for (const product of plan) await addProduct(page, product, 1);

    await openCart(page);
    await page.getByTestId('coupon-input').fill('SAVE10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');

    const admin = await context.newPage();
    await loginAs(admin, 'admin');
    await expect(admin.getByTestId('page-admin-coupons')).toBeVisible();
    const row = admin.getByTestId('admin-coupon-row-SAVE10');
    await expect(row).toBeVisible();
    await expect(row.getByTestId('admin-coupon-percent')).toHaveAttribute('data-value', '10');
    await expect(row.getByTestId('admin-coupon-min-spend')).toHaveAttribute('data-value', '1000');

    // สร้างออเดอร์ก่อนเปลี่ยนสถานะ เพื่อยืนยัน snapshot ไม่เปลี่ยนย้อนหลัง
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    const orderId = (await page.getByTestId('checkout-order-id').textContent())!.trim();
    const savedOrder = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(orderId)}`);
    const beforeStatusChange = await savedOrder.json();
    expect(beforeStatusChange.couponCode).toBe('SAVE10');
    expect(beforeStatusChange.discount).toBe(Math.floor(subtotal * 10 / 100));

    await row.getByTestId('admin-coupon-toggle-status').click();
    await expect(row.getByTestId('admin-coupon-status')).toHaveAttribute('data-status', 'ปิดใช้');
    const oldOrder = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(orderId)}`);
    const oldSnapshot = await oldOrder.json();
    expect(oldSnapshot.couponCode).toBe('SAVE10');
    expect(oldSnapshot.discount).toBe(beforeStatusChange.discount);

    await page.getByTestId('cancel-checkout-button').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    // คูปองที่ผูกอยู่เดิมถูกปิด จึงถูกนำออกเมื่อ checkout สำเร็จครั้งนี้
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'COUPON_NOT_APPLICABLE');
    const checkoutOrderId = (await page.getByTestId('checkout-order-id').textContent())!.trim();
    const nextOrder = await apiRequest(page, 'GET', `/orders/${encodeURIComponent(checkoutOrderId)}`);
    const nextSnapshot = await nextOrder.json();
    expect(nextSnapshot.couponCode).toBeNull();
    expect(nextSnapshot.discount).toBe(0);
  });

  test('FR-10.3: เปลี่ยนสถานะ code ที่ไม่มีอยู่ตอบ COUPON_NOT_FOUND', async ({ page }) => {
    await loginAs(page, 'admin');
    const list = await apiRequest(page, 'GET', '/admin/coupons');
    expect(list.ok()).toBeTruthy();
    const coupons = await list.json() as Array<{ code: string; percent: number; minSpend: number; status: string }>;
    expect(coupons.some(coupon => coupon.code === 'SAVE10')).toBeTruthy();
    const missing = await apiRequest(page, 'PATCH', '/admin/coupons/NO-SUCH-COUPON/status', { status: 'ปิดใช้' });
    expect(missing.status()).toBe(404);
    expect((await missing.json()).code).toBe('COUPON_NOT_FOUND');
  });
});
