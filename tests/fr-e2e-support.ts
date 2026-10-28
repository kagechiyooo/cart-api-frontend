import { expect, test, type Locator, type Page } from '@playwright/test';

export const webBaseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export type ProductRecord = {
  id: string;
  price: number;
  weightGram: number;
  stock: number;
  active: boolean;
};

type ProductDto = {
  id?: string;
  productId?: string;
  price: number;
  weightGram: number;
  stock: number;
  active?: boolean;
  status?: string;
};

const apiOrigins = new WeakMap<Page, string>();

/**
 * ลงทะเบียนขั้นตอนเตรียมฐานข้อมูลก่อนแต่ละ test
 * ต้องชี้ไปฐานข้อมูลทดสอบที่ล้างข้อมูลได้ และเปิด opt-in ก่อนเรียก POST /test/reset
 * หากยังไม่ได้ตั้งค่า จะข้าม test เพื่อป้องกันการล้างฐานข้อมูลที่ไม่ตั้งใจ
 */
export function installIsolatedReset() {
  test.beforeEach(async ({ request }) => {
    const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL;
    if (process.env.PLAYWRIGHT_E2E_ISOLATED_DB !== 'true' || !apiBaseUrl) {
      test.skip(true, 'Set PLAYWRIGHT_E2E_ISOLATED_DB=true and PLAYWRIGHT_API_BASE_URL for a disposable test database.');
    }

    const response = await request.post(`${apiBaseUrl!.replace(/\/$/, '')}/test/reset`);
    expect(response.ok(), 'POST /test/reset must be enabled only on the isolated test API').toBeTruthy();

    // ตรวจ postcondition ของ reset ว่าตะกร้า Customer กลับมาว่างจริงก่อนเริ่มแต่ละ test
    const login = await request.post(`${apiBaseUrl!.replace(/\/$/, '')}/auth/login`, {
      data: { username: 'cus_normal', password: 'password123' },
    });
    expect(login.ok(), 'Seed must restore the normal Customer test account').toBeTruthy();
    const { token } = await login.json() as { token: string };
    const cart = await request.get(`${apiBaseUrl!.replace(/\/$/, '')}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cart.ok(), 'Seeded Customer cart must be available after reset').toBeTruthy();
    const cartData = await cart.json() as { stage: string; items: unknown[]; couponCode: string | null };
    expect(cartData.stage, 'Customer cart must start at the cart stage').toBe('ตะกร้า');
    expect(cartData.items, 'Customer cart must be empty after reset').toHaveLength(0);
    expect(cartData.couponCode, 'Customer cart must not retain a coupon after reset').toBeNull();
  });
}

/** เข้าระบบผ่านหน้าเว็บด้วยบัญชี Customer, Prime หรือ Admin แล้วเก็บ origin ของ API ไว้ใช้เรียก API ต่อ */
export async function loginAs(page: Page, account: 'customer' | 'prime' | 'admin') {
  const loginResponse = page.waitForResponse(response => {
    try {
      return new URL(response.url()).pathname.replace(/\/$/, '') === '/auth/login'
        && response.request().method() === 'POST';
    } catch {
      return false;
    }
  });

  await page.goto(`${webBaseUrl}/login`);
  await expect(page.getByTestId('api-mode')).toContainText(/api|pay_succeed|pay_failed/);
  const loginPanel = page.getByTestId('page-login');
  await expect(loginPanel).toBeVisible();
  await loginPanel.getByTestId(`fill-${account}`).click();
  await loginPanel.getByTestId('login-submit').click();

  const response = await loginResponse;
  expect(response.ok(), 'Login should reach the configured API').toBeTruthy();
  apiOrigins.set(page, new URL(response.url()).origin);
  await expect(page.getByTestId('current-user-name')).toBeVisible();
  if (account === 'admin') await expect(page.getByTestId('page-admin-products')).toBeVisible();
  else await expect(page.getByTestId('page-products')).toBeVisible();
}

/** เรียก API ที่ต้องยืนยันตัวตน โดยใช้ token จาก sessionStorage ของหน้าที่ login ไว้ */
export async function apiRequest(page: Page, method: string, path: string, body?: Record<string, unknown>) {
  const origin = apiOrigins.get(page);
  if (!origin) throw new Error('Log in through the page before calling an authenticated API operation.');
  const token = await page.evaluate(() => window.sessionStorage.getItem('auth-token'));
  return page.request.fetch(`${origin}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(body !== undefined ? { data: body } : {}),
  });
}

/** เรียก payment gateway callback ซึ่งไม่ใช้ token แต่ใช้ API origin เดียวกับหน้าที่ login */
export async function gatewayRequest(page: Page, path: string) {
  const origin = apiOrigins.get(page);
  if (!origin) throw new Error('Log in through the page before using the configured API origin.');
  return page.request.post(`${origin}${path}`);
}

/** เข้าระบบ Customer/Prime เปิดหน้าสินค้า แล้วคืนข้อมูลสินค้าจาก API สำหรับเลือก test data */
export async function loginCustomer(page: Page, account: 'customer' | 'prime' = 'customer'): Promise<ProductRecord[]> {
  await loginAs(page, account);
  await page.goto(`${webBaseUrl}/products`);
  await expect(page.getByTestId('page-products')).toBeVisible();
  // ขอข้อมูลจาก API แยกจากการนำทางหน้าเว็บ ป้องกัน response body ถูกใช้/ปิดไปแล้ว
  const response = await apiRequest(page, 'GET', '/products');
  const responseBody = await response.text();
  expect(response.ok(), `Customer product listing failed (${response.status()}): ${responseBody}`).toBeTruthy();
  const rows = JSON.parse(responseBody) as ProductDto[];
  return rows.map(row => ({
    id: row.productId ?? row.id ?? '',
    price: row.price,
    weightGram: row.weightGram,
    stock: row.stock,
    active: row.status ? row.status === 'เปิดขาย' : row.active === true,
  }));
}

/** กรองเฉพาะสินค้าที่พร้อมขาย มีรหัสสินค้า และมีสต็อกเหลือ */
export function availableProducts(products: ProductRecord[]) {
  return products.filter(product => product.id && product.active && product.stock > 0);
}

/** เพิ่มสินค้าตามจำนวนที่กำหนดผ่านปุ่มบนหน้ารายการสินค้า */
export async function addProduct(page: Page, product: ProductRecord, quantity: number) {
  const card = page.getByTestId(`product-row-${product.id}`);
  await expect(card).toBeVisible();
  await card.getByTestId('product-add-qty').fill(String(quantity));
  await card.getByTestId('product-add-button').click();
}

/** เปิดหน้าตะกร้าจากเมนูและรอจนส่วนแสดงตะกร้าพร้อมใช้งาน */
export async function openCart(page: Page) {
  await page.getByTestId('nav-cart').click();
  await expect(page.getByTestId('page-cart')).toBeVisible();
}

/** เลือก locator ของแถวสินค้าในตะกร้าจาก product ID */
export function cartLine(page: Page, productId: string): Locator {
  return page.getByTestId(`cart-line-${productId}`);
}

/** อ่านค่าตัวเลขจาก data-value ของ element เช่น ยอดรวม ราคา หรือจำนวนสินค้า */
export async function numericValue(locator: Locator): Promise<number> {
  const value = await locator.getAttribute('data-value');
  expect(value, 'Expected a numeric data-value attribute').not.toBeNull();
  return Number(value);
}
