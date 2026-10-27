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
 * The backend's documented POST /test/reset truncates and reseeds cart_api.
 * Keep every stateful E2E case skipped unless the caller explicitly points
 * Playwright at a disposable database and opts in to resetting it.
 */
export function installIsolatedReset() {
  test.beforeEach(async ({ request }) => {
    const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL;
    if (process.env.PLAYWRIGHT_E2E_ISOLATED_DB !== 'true' || !apiBaseUrl) {
      test.skip(true, 'Set PLAYWRIGHT_E2E_ISOLATED_DB=true and PLAYWRIGHT_API_BASE_URL for a disposable test database.');
    }

    const response = await request.post(`${apiBaseUrl!.replace(/\/$/, '')}/test/reset`);
    expect(response.ok(), 'POST /test/reset must be enabled only on the isolated test API').toBeTruthy();
  });
}

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

export async function gatewayRequest(page: Page, path: string) {
  const origin = apiOrigins.get(page);
  if (!origin) throw new Error('Log in through the page before using the configured API origin.');
  return page.request.post(`${origin}${path}`);
}

export async function loginCustomer(page: Page, account: 'customer' | 'prime' = 'customer'): Promise<ProductRecord[]> {
  await loginAs(page, account);
  const productResponse = page.waitForResponse(response => {
    try {
      return new URL(response.url()).pathname.replace(/\/$/, '') === '/products'
        && response.request().method() === 'GET';
    } catch {
      return false;
    }
  });
  await page.goto(`${webBaseUrl}/products`);
  await expect(page.getByTestId('page-products')).toBeVisible();
  const response = await productResponse;
  expect(response.ok(), 'Customer product listing should return successfully').toBeTruthy();
  const rows = await response.json() as ProductDto[];
  return rows.map(row => ({
    id: row.productId ?? row.id ?? '',
    price: row.price,
    weightGram: row.weightGram,
    stock: row.stock,
    active: row.status ? row.status === 'เปิดขาย' : row.active === true,
  }));
}

export function availableProducts(products: ProductRecord[]) {
  return products.filter(product => product.id && product.active && product.stock > 0);
}

export async function addProduct(page: Page, product: ProductRecord, quantity: number) {
  const card = page.getByTestId(`product-row-${product.id}`);
  await expect(card).toBeVisible();
  await card.getByTestId('product-add-qty').fill(String(quantity));
  await card.getByTestId('product-add-button').click();
}

export async function openCart(page: Page) {
  await page.getByTestId('nav-cart').click();
  await expect(page.getByTestId('page-cart')).toBeVisible();
}

export function cartLine(page: Page, productId: string): Locator {
  return page.getByTestId(`cart-line-${productId}`);
}

export async function numericValue(locator: Locator): Promise<number> {
  const value = await locator.getAttribute('data-value');
  expect(value, 'Expected a numeric data-value attribute').not.toBeNull();
  return Number(value);
}
