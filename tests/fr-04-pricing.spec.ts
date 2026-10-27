import { test, expect } from '@playwright/test';
import {
  addProduct,
  availableProducts,
  installIsolatedReset,
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
});
