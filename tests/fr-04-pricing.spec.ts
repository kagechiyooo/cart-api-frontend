import { test, expect } from '@playwright/test';
import {
  addProduct,
  availableProducts,
  installIsolatedReset,
  loginAs,
  loginCustomer,
  numericValue,
  openCart,
  webBaseUrl,
  type ProductRecord,
} from './fr-e2e-support';

type Tier = 'light' | 'medium' | 'heavy';
type Zone = 'inCity' | 'upcountry' | 'remote';
type Speed = 'standard' | 'express';
type Member = 'normal' | 'prime';

const baseRate: Record<Tier, Record<Zone, number>> = {
  light: { inCity: 30, upcountry: 50, remote: 80 },
  medium: { inCity: 50, upcountry: 80, remote: 120 },
  heavy: { inCity: 80, upcountry: 120, remote: 180 },
};

function shipping(tier: Tier, zone: Zone, speed: Speed, member: Member): number {
  const base = baseRate[tier][zone];
  if (member === 'prime') return speed === 'standard' ? 0 : Math.floor(base / 2);
  return speed === 'standard' ? base : Math.floor(base * 3 / 2);
}

function tierForWeight(weight: number): Tier {
  if (weight <= 1000) return 'light';
  if (weight <= 5000) return 'medium';
  return 'heavy';
}

function planForTier(products: ProductRecord[], tier: Tier): { product: ProductRecord; quantity: number } | undefined {
  const available = availableProducts(products);
  if (tier === 'light') {
    const product = available.find(item => item.weightGram >= 1 && item.weightGram <= 1000);
    return product ? { product, quantity: 1 } : undefined;
  }

  const direct = available.find(item => tierForWeight(item.weightGram) === tier);
  if (direct) return { product: direct, quantity: 1 };

  const minWeight = tier === 'medium' ? 1001 : 5001;
  const maxWeight = tier === 'medium' ? 5000 : 20000;
  for (const product of available) {
    if (product.weightGram < 1 || product.weightGram > 1000) continue;
    const quantity = Math.ceil(minWeight / product.weightGram);
    const resultingWeight = quantity * product.weightGram;
    if (quantity <= 10 && quantity <= product.stock && resultingWeight <= maxWeight) {
      return { product, quantity };
    }
  }
  return undefined;
}

test.describe('FR-4: subtotal, discounts, shipping, and net total', () => {
  test.describe.configure({ mode: 'serial' });
  installIsolatedReset();

  // FR-4.1 และ FR-4.4–4.8: คำนวณราคาปัจจุบัน ส่วนลดสมาชิก ค่าจัดส่ง และยอดสุทธิตามตารางของ SRS
  for (const account of ['customer', 'prime'] as const) {
    const member: Member = account === 'prime' ? 'prime' : 'normal';
    for (const tier of ['light', 'medium', 'heavy'] as const) {
      test(`FR-4.1 / FR-4.4 / FR-4.5–4.8: ${member}, ${tier} tier totals follow the SRS tables`, async ({ page }) => {
        const products = await loginCustomer(page, account);
        const plan = planForTier(products, tier);
        test.skip(!plan, `The test seed needs an available product/quantity for ${tier} shipping.`);

        await addProduct(page, plan!.product, plan!.quantity);
        await openCart(page);
        const subtotal = plan!.product.price * plan!.quantity;
        const discount = member === 'prime' ? Math.floor(subtotal * 5 / 100) : 0;
        const weight = plan!.product.weightGram * plan!.quantity;
        expect(tierForWeight(weight)).toBe(tier);

        await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', String(subtotal));
        await expect(page.getByTestId('cart-discount')).toHaveAttribute('data-value', String(discount));

        for (const zone of ['inCity', 'upcountry', 'remote'] as const) {
          for (const speed of ['standard', 'express'] as const) {
            await page.getByTestId('zone-select').selectOption(zone);
            await page.getByTestId('speed-select').selectOption(speed);
            const fee = shipping(tier, zone, speed, member);
            await expect(page.getByTestId('cart-shipping')).toHaveAttribute('data-value', String(fee));
            await expect(page.getByTestId('cart-total')).toHaveAttribute('data-value', String(subtotal - discount + fee));
          }
        }
      });
    }
  }

  // FR-4.2: เมื่อคูปองใช้ได้ ให้ใช้ส่วนลดคูปองแทนส่วนลด Prime โดยไม่ซ้อนส่วนลด
  test('FR-4.2.1–4.2.2: active coupon discount applies at the threshold and does not stack with Prime discount', async ({ page }) => {
    const products = availableProducts(await loginCustomer(page, 'prime'));
    let subtotal = 0;
    for (const product of products) {
      await addProduct(page, product, 1);
      subtotal += product.price;
      if (subtotal >= 1000) break;
    }
    test.skip(subtotal < 1000, 'The SRS SAVE10 fixture requires an available cart subtotal of at least 1,000 baht.');

    await openCart(page);
    await page.getByTestId('coupon-input').fill('SAVE10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');

    const discount = Math.floor(subtotal * 10 / 100);
    await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', String(subtotal));
    await expect(page.getByTestId('cart-discount')).toHaveAttribute('data-value', String(discount));
    await expect(page.getByTestId('cart-shipping')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('cart-total')).toHaveAttribute('data-value', String(subtotal - discount));
  });

  // FR-4.3: ตอน checkout ให้นำคูปองที่ยอดไม่ถึงขั้นต่ำออกและแจ้งข้อความตาม SRS
  test('FR-4.3.1–4.3.2: checkout removes a below-minimum coupon and shows the required notice', async ({ page }) => {
    const products = availableProducts(await loginCustomer(page));
    const lowPriceProduct = products.find(product => product.price < 1000);
    test.skip(!lowPriceProduct, 'This SRS case requires an available seed product priced below the SAVE10 minimum of 1,000 baht.');

    await addProduct(page, lowPriceProduct!, 1);
    await openCart(page);
    await page.getByTestId('coupon-input').fill('SAVE10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');
    await page.getByTestId('checkout-button').click();

    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'COUPON_NOT_APPLICABLE');
    await expect(page.getByTestId('checkout-discount')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('checkout-line-' + lowPriceProduct!.id)).toBeVisible();

    // ยกเลิก checkout เพื่อคืนสต็อกที่จองไว้; ฐานทดสอบแยกจะถูก reset ก่อนเคสถัดไป
    await page.getByTestId('cancel-checkout-button').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
  });

  test('FR-4.3–4.4: disabled attached coupon is removed at checkout and Prime discount applies', async ({ page, context }) => {
    // Customer ปกติที่ไม่มีคูปองต้องได้ส่วนลดศูนย์
    const customerProducts = availableProducts(await loginCustomer(page, 'customer'));
    const customerProduct = customerProducts.find(product => product.id === 'p-1');
    test.skip(!customerProduct, 'ต้องมีสินค้า p-1 พร้อมขายใน seed');
    await addProduct(page, customerProduct!, 1);
    await openCart(page);
    await expect(page.getByTestId('cart-discount')).toHaveAttribute('data-value', '0');

    // ออกจาก Customer แล้วเข้าสู่ระบบเป็น Prime; แต่ละบัญชีมีตะกร้าแยกกัน
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();
    const primeProducts = availableProducts(await loginCustomer(page, 'prime'));
    const primeProduct = primeProducts.find(product => product.id === 'p-1');
    test.skip(!primeProduct, 'ต้องมีสินค้า p-1 พร้อมขายใน seed');
    const price = primeProduct!.price;
    test.skip(price < 1000, 'ยอดสินค้า p-1 ต้องถึงขั้นต่ำคูปอง SAVE10');

    // ผูก SAVE10 กับตะกร้า Prime ขณะที่คูปองยังเปิดใช้อยู่
    await addProduct(page, primeProduct!, 1);
    await openCart(page);
    await page.getByTestId('coupon-input').fill('SAVE10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');

    // ใช้อีกแท็บ Login เป็น Admin เพื่อปิดคูปอง โดยไม่เปลี่ยน session ของ Prime
    const adminPage = await context.newPage();
    await loginAs(adminPage, 'admin');
    await adminPage.getByTestId('admin-nav-coupons').click();
    const couponRow = adminPage.getByTestId('admin-coupon-row-SAVE10');
    await expect(couponRow.getByTestId('admin-coupon-status')).toHaveAttribute('data-status', 'เปิดใช้');
    await couponRow.getByTestId('admin-coupon-toggle-status').click();
    await expect(couponRow.getByTestId('admin-coupon-status')).toHaveAttribute('data-status', 'ปิดใช้');

    // FR-4.3: checkout ต้องถอดคูปองที่ถูกปิดและแสดง notice ตาม SRS
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'COUPON_NOT_APPLICABLE');
    await expect(page.getByTestId('app-message')).toContainText('คูปองไม่สามารถใช้กับคำสั่งซื้อนี้');

    // FR-4.4: เมื่อตัดคูปองออก Prime ต้องได้ส่วนลดสมาชิก 5% แทน
    await expect(page.getByTestId('checkout-discount'))
      .toHaveAttribute('data-value', String(Math.floor(price * 5 / 100)));

    // คืนสถานะคูปองให้เปิดใช้เพื่อไม่ทิ้งข้อมูลทดสอบค้างไว้
    await couponRow.getByTestId('admin-coupon-toggle-status').click();
    await expect(couponRow.getByTestId('admin-coupon-status')).toHaveAttribute('data-status', 'เปิดใช้');
  });

  test('FR-4.5: shipping preview reflects light, medium, and heavy total-weight tiers', async ({ page }) => {
    const products = availableProducts(await loginCustomer(page, 'customer'));
    const mediumProduct = products.find(product => product.id === 'p-2' && product.stock >= 2);
    const heavyProduct = products.find(product => product.id === 'p-6' && product.stock >= 7);
    test.skip(!mediumProduct || !heavyProduct, 'Seed ต้องมี p-2 stock >= 2 และ p-6 stock >= 7');

    // p-2 หนัก 900 กรัม × 1 = 900 กรัม จัดเป็น light
    await addProduct(page, mediumProduct!, 1);
    await openCart(page);
    await page.getByTestId('zone-select').selectOption('inCity');
    await page.getByTestId('speed-select').selectOption('standard');
    await expect(page.getByTestId('cart-shipping')).toHaveAttribute('data-value', '30');

    // p-2 หนัก 900 กรัม × 2 = 1,800 กรัม จัดเป็น medium
    const mediumLine = page.getByTestId(`cart-line-${mediumProduct!.id}`);
    await mediumLine.getByTestId('cart-line-qty-input').fill('2');
    await mediumLine.getByTestId('cart-line-update').click();
    await expect(mediumLine.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');
    await expect(page.getByTestId('cart-shipping')).toHaveAttribute('data-value', '50');

    // ลบรายการ medium ก่อน เพื่อไม่ให้น้ำหนักสะสมกับกรณี heavy
    await mediumLine.getByTestId('cart-line-remove').click();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await page.getByTestId('nav-products').click();

    // p-6 หนัก 800 กรัม × 7 = 5,600 กรัม จัดเป็น heavy
    await addProduct(page, heavyProduct!, 7);
    await openCart(page);
    await page.getByTestId('zone-select').selectOption('inCity');
    await page.getByTestId('speed-select').selectOption('standard');
    await expect(page.getByTestId('cart-shipping')).toHaveAttribute('data-value', '80');
  });
});
