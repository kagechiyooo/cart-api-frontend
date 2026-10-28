import { test, expect, type Page } from '@playwright/test';
import { installIsolatedReset } from './fr-e2e-support';

/**
 * FR-0 / FR-1 smoke coverage for the Cart API frontend.
 *
 * Run with the frontend in API mode and its backend available. The suite
 * checks the UI's API-mode indicator so it cannot silently pass against mock
 * data. It deliberately does not mutate carts/orders; FR-1.1 and FR-1.2 need
 * an isolated SRS seed/reset fixture before they can be tested safely.
 */
const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

async function openPage(page: Page, path: string) {
  await page.goto(`${baseURL}${path}`);
  await expect(page.getByTestId('api-mode')).toContainText('api');
}

async function loginAsDemo(page: Page, account: 'customer' | 'admin') {
  await openPage(page, '/login');
  await page.getByTestId(`fill-${account}`).click();
  await page.getByTestId('login-submit').click();

  if (account === 'customer') {
    await expect(page.getByTestId('page-products')).toBeVisible();
  } else {
    await expect(page.getByTestId('page-admin-products')).toBeVisible();
  }
  await expect(page.getByTestId('current-user-name')).toBeVisible();
}

test.describe('FR-0 / FR-1: authentication and product listing', () => {
  installIsolatedReset();
  test('FR-0.1.1: registered Customer can log in and reach the product list', async ({ page }) => {
    await loginAsDemo(page, 'customer');

    await expect(page.getByTestId('page-products')).toBeVisible();
    await expect(page.getByTestId('product-count')).toBeVisible();
  });

  test('FR-0.1.2: invalid credentials are rejected with AUTH_INVALID_CREDENTIALS', async ({ page }) => {
    await openPage(page, '/login');
    await page.getByTestId('login-username').fill('e2e-user-that-does-not-exist');
    await page.getByTestId('login-password').fill('invalid-password');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('app-message')).toHaveAttribute(
      'data-code',
      'AUTH_INVALID_CREDENTIALS',
    );
    await expect(page.getByTestId('page-login')).toBeVisible();
  });

  test('FR-1.3.1: Customer sees available products with name, price, and available stock', async ({ page }) => {
    await loginAsDemo(page, 'customer');

    const products = page.locator('[data-testid^="product-row-"]');
    await expect(products.first()).toBeVisible();
    const count = await products.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const product = products.nth(index);
      await expect(product.getByTestId('product-name')).toBeVisible();
      await expect(product.getByTestId('product-price')).toHaveAttribute('data-value', /^\d+$/);

      const stock = Number(await product.getByTestId('product-stock').getAttribute('data-value'));
      expect(stock, 'Customer list should contain only products available for sale').toBeGreaterThan(0);
    }
  });

  test('FR-1.3.2: Admin sees product records with price, stock, and sale status', async ({ page }) => {
    await loginAsDemo(page, 'admin');

    const products = page.locator('[data-testid^="admin-product-row-"]');
    await expect(products.first()).toBeVisible();
    const count = await products.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const product = products.nth(index);
      await expect(product.getByTestId('admin-product-price')).toHaveAttribute('data-value', /^\d+$/);
      await expect(product.getByTestId('admin-product-stock')).toHaveAttribute('data-value', /^\d+$/);
      await expect(product.getByTestId('admin-product-status')).toHaveAttribute(
        'data-status',
        /^(เปิดขาย|ปิดขาย)$/,
      );
    }
  });
});

/*
 * Deferred SRS cases (not omitted from the requirements):
 * - FR-1.1 and FR-1.2.1–FR-1.2.4 require a clean, isolated customer fixture.
 *   Set up the documented seed/reset process against a disposable test database
 *   before adding these cases. Do not call a destructive reset against a dev or
 *   shared database.
 * - FR-0.2–FR-0.7 require API-level checks for operation auth/roles, ownership,
 *   ordering, isolation, and no-state-change-on-error; the browser UI alone
 *   cannot prove all of these domain guarantees.
 * - FR-1.4 is verified by comparing seeded product/coupon/account data to
 *   section 7 of the SRS; this file intentionally avoids guessing seed IDs.
 */
