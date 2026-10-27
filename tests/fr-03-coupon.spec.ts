import { test, expect, type Page } from '@playwright/test';

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
type CouponStatus = 'เปิดใช้' | 'ปิดใช้';

async function login(page: Page, account: 'customer' | 'prime' | 'admin') {
  await page.goto(`${baseURL}/login`);
  await expect(page.getByTestId('api-mode')).toContainText('api');
  const loginPanel = page.getByTestId('page-login');
  await expect(loginPanel).toBeVisible();
  await loginPanel.getByTestId(`fill-${account}`).click();
  await loginPanel.getByTestId('login-submit').click();

  if (account === 'admin') {
    await expect(page.getByTestId('page-admin-products')).toBeVisible();
  } else {
    await expect(page.getByTestId('page-products')).toBeVisible();
  }
}

async function openCart(page: Page) {
  await page.getByTestId('nav-cart').click();
  await expect(page.getByTestId('page-cart')).toBeVisible();
}

async function emptyCartLines(page: Page) {
  const lines = page.locator('li[data-testid^="cart-line-"]');
  while (await lines.count()) {
    await lines.first().getByTestId('cart-line-remove').click();
  }
  await expect(page.getByTestId('cart-empty')).toBeVisible();
}

async function openAdminCoupons(page: Page) {
  await page.goto(`${baseURL}/admin/coupons`);
  await expect(page.getByTestId('page-admin-coupons')).toBeVisible();
}

async function ensureAdminCouponStatus(page: Page, expected: CouponStatus) {
  const logout = page.getByTestId('logout-button');
  if (await logout.count()) await logout.click();

  await login(page, 'admin');
  await openAdminCoupons(page);
  const row = page.getByTestId('admin-coupon-row-SAVE10');
  const status = row.getByTestId('admin-coupon-status');
  if (await status.getAttribute('data-status') !== expected) {
    await row.getByTestId('admin-coupon-toggle-status').click();
  }
  await expect(status).toHaveAttribute('data-status', expected);
}

test.describe('FR-3: คูปองฝั่ง Customer', () => {
  test.describe.configure({ mode: 'serial' });

  test('FR-3.1.1 / FR-3.2.1–3.2.3: ผูก SAVE10 ได้แม้ตะกร้าว่าง และ code แยกตัวพิมพ์เล็ก-ใหญ่', async ({ page }) => {
    await login(page, 'prime');
    await openCart(page);
    await emptyCartLines(page);

    // FR-3.2.2 / FR-3.2.3: การผูกคูปองไม่ตรวจยอดขั้นต่ำ และทำได้เมื่อตะกร้าไม่มีรายการ
    await page.getByTestId('coupon-input').fill('SAVE10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');
    await expect(page.getByTestId('cart-empty')).toBeVisible();

    // FR-3.1.1: code ที่ตัวพิมพ์ไม่ตรงกันต้องไม่ถูกนำไปผูกแทน code เดิม
    await page.getByTestId('coupon-input').fill('save10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByRole('form', { name: 'Apply coupon' }).getByTestId('app-message'))
      .toHaveAttribute('data-code', 'COUPON_INVALID');
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');
  });

  test('FR-3.1.2: code ที่ไม่มีอยู่ต้องถูกปฏิเสธด้วย COUPON_INVALID', async ({ page }) => {
    await login(page, 'prime');
    await openCart(page);
    const previousCode = await page.getByTestId('cart-coupon-code').innerText();

    await page.getByTestId('coupon-input').fill('E2E-UNKNOWN-COUPON');
    await page.getByTestId('coupon-apply').click();

    // SRS กำหนด COUPON_INVALID; ปัจจุบัน API อาจส่ง COUPON_NOT_FOUND ซึ่งเป็นข้อแตกต่างที่เคสนี้จะตรวจพบ
    await expect(page.getByRole('form', { name: 'Apply coupon' }).getByTestId('app-message'))
      .toHaveAttribute('data-code', 'COUPON_INVALID');
    await expect(page.getByTestId('cart-coupon-code')).toHaveText(previousCode);
  });

  test('FR-3.1.2: คูปองที่ปิดใช้ต้องถูกปฏิเสธ และสถานะคูปองถูกคืนหลังทดสอบ', async ({ page }) => {
    await login(page, 'admin');
    await openAdminCoupons(page);
    const row = page.getByTestId('admin-coupon-row-SAVE10');
    const status = row.getByTestId('admin-coupon-status');

    let restoreStatus = false;
    try {
      // SRS seed กำหนดให้ SAVE10 เปิดใช้: กรณีรันก่อนหน้าค้างสถานะปิดไว้ ให้เปิดก่อนเริ่มเคส
      if (await status.getAttribute('data-status') !== 'เปิดใช้') {
        restoreStatus = true;
        await row.getByTestId('admin-coupon-toggle-status').click();
        await expect(status).toHaveAttribute('data-status', 'เปิดใช้');
      }

      // ปิด SAVE10 ชั่วคราวเพื่อเตรียมข้อมูลตาม FR-3.1.2
      restoreStatus = true;
      await row.getByTestId('admin-coupon-toggle-status').click();
      await expect(status).toHaveAttribute('data-status', 'ปิดใช้');

      await page.getByTestId('logout-button').click();
      await login(page, 'prime');
      await openCart(page);
      const previousCode = await page.getByTestId('cart-coupon-code').innerText();

      await page.getByTestId('coupon-input').fill('SAVE10');
      await page.getByTestId('coupon-apply').click();
      await expect(page.getByRole('form', { name: 'Apply coupon' }).getByTestId('app-message'))
        .toHaveAttribute('data-code', 'COUPON_INVALID');
      await expect(page.getByTestId('cart-coupon-code')).toHaveText(previousCode);
    } finally {
      // คืนสถานะเริ่มต้นของ seed เพื่อไม่ให้เคสอื่นได้รับผลกระทบ
      if (restoreStatus) await ensureAdminCouponStatus(page, 'เปิดใช้');
    }
  });
});

/*
 * ข้อกำหนดที่ยังต้องมีข้อมูล/flow เพิ่ม:
 * - FR-3.2.1 การแทนคูปองเดิม ต้องมีคูปองเปิดใช้อย่างน้อยสอง code; SRS seed ระบุไว้เพียง SAVE10 ใบเดียว
 * - FR-3.3 การใช้คูปองซ้ำ ต้องทดสอบผ่านการสร้างและชำระหลายออเดอร์ (payment flow) เพิ่มเติม
 */

