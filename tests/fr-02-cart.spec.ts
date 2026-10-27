import { test, expect, type Locator, type Page } from '@playwright/test';

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

type ProductCardInfo = { card: Locator; id: string; stock: number; price: number };
const safeToClean = new WeakSet<Page>();

async function signInAndRequireCleanCart(page: Page) {
  await page.goto(`${baseURL}/login?next=%2Fproducts`);
  await expect(page.getByTestId('api-mode')).toContainText('api');
  await page.getByTestId('fill-customer').click();
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('page-products')).toBeVisible();

  await page.getByTestId('nav-cart').click();
  await expect(page.getByTestId('page-cart')).toBeVisible();

  // ใช้บัญชี Customer สำหรับทดสอบ และลบรายการค้างจากรอบก่อนเพื่อให้เริ่มด้วยตะกร้าว่าง
  const existingLines = page.locator('li[data-testid^="cart-line-"]');
  while (await existingLines.count()) {
    await existingLines.first().getByTestId('cart-line-remove').click();
  }
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('cart-coupon-code')).toHaveText('');
  await expect(page.getByTestId('checkout-button')).toBeDisabled();
  safeToClean.add(page);

  await page.goto(`${baseURL}/products`);
  await expect(page.getByTestId('page-products')).toBeVisible();
  await waitForProductList(page);
}

async function waitForProductList(page: Page) {
  const terminalState = page.getByTestId('product-count')
    .or(page.getByRole('heading', { name: 'No products found' }))
    .or(page.getByRole('heading', { name: 'Could not load products' }));
  await expect(terminalState, 'Wait for the products request to finish').toBeVisible();
}

async function findProductCard(page: Page, stockPredicate: (stock: number) => boolean): Promise<ProductCardInfo | undefined> {
  const cards = page.locator('[data-testid^="product-row-"]');
  const count = await cards.count();

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const stock = Number(await card.getByTestId('product-stock').getAttribute('data-value'));
    const testId = await card.getAttribute('data-testid');
    if (testId && stockPredicate(stock)) {
      return {
        card,
        id: testId.replace('product-row-', ''),
        stock,
        price: Number(await card.getByTestId('product-price').getAttribute('data-value')),
      };
    }
  }
  return undefined;
}

async function addQuantity(product: ProductCardInfo, quantity: number) {
  await product.card.getByTestId('product-add-qty').fill(String(quantity));
  await product.card.getByTestId('product-add-button').click();
}

async function removeAllCartLines(page: Page) {
  try {
    await page.goto(`${baseURL}/cart`);
    const lines = page.locator('li[data-testid^="cart-line-"]');
    while (await lines.count()) {
      await lines.first().getByTestId('cart-line-remove').click();
    }
  } catch {
    // หาก cleanup ล้มเหลว ให้คง error หลักของเคสทดสอบไว้
  }
}

test.describe('FR-2: Customer cart', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page }) => {
    if (safeToClean.has(page)) await removeAllCartLines(page);
  });

  test('add/update/remove flow and invalid quantities match FR-2.1, FR-2.3, FR-2.5, FR-2.7–2.9', async ({ page }) => {
    await signInAndRequireCleanCart(page);
    const product = await findProductCard(page, stock => stock > 0);
    expect(
      product,
      `No visible product with stock > 0 after the list loaded at ${baseURL}/products. Check the GET /products response and seed data.`,
    ).toBeDefined();

    // FR-2.1.2: quantity ที่เป็นจำนวนเต็มแต่นอกช่วง 1–10 ต้องถูกปฏิเสธด้วย QTY_OUT_OF_RANGE
    await addQuantity(product!, 11);
    await expect(product!.card.getByTestId('app-message')).toHaveAttribute('data-code', 'QTY_OUT_OF_RANGE');

    // FR-2.1.1: quantity ที่ไม่ใช่จำนวนเต็มต้องถูกปฏิเสธด้วย VALIDATION_ERROR
    await product!.card.getByTestId('product-add-qty').fill('1.5');
    await product!.card.getByTestId('product-add-button').click();
    await expect(product!.card.getByTestId('app-message')).toHaveAttribute('data-code', 'VALIDATION_ERROR');

    // เมื่อคำขอถูกปฏิเสธ ต้องไม่มีการเปลี่ยนแปลงรายการในตะกร้า
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('checkout-button')).toBeDisabled();
    await page.goto(`${baseURL}/products`);
    await waitForProductList(page);

    // FR-2.3.1 / FR-2.3.2: เพิ่มสินค้าครั้งแรกให้สร้างรายการ และเพิ่มซ้ำให้บวก quantity เดิม
    await addQuantity(product!, 1);
    await addQuantity(product!, 1);
    await page.getByTestId('nav-cart').click();

    const line = page.getByTestId(`cart-line-${product!.id}`);
    await expect(line.getByTestId('cart-line-name')).toBeVisible();
    await expect(line.getByTestId('cart-line-unit-price')).toHaveAttribute('data-value', String(product!.price));
    await expect(line.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');
    await expect(line.getByTestId('cart-line-availability')).toHaveAttribute('data-available', 'true');
    await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', String(product!.price * 2));
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('');
    await expect(page.getByTestId('checkout-button')).toBeEnabled();

    // FR-2.5.1: updateQuantity ที่ quantity ไม่เป็นจำนวนเต็มต้องได้ VALIDATION_ERROR และค่าเดิมต้องไม่เปลี่ยน
    const quantityInput = line.getByTestId('cart-line-qty-input');
    await quantityInput.fill('2.5');
    await line.getByTestId('cart-line-update').click();
    await expect(line.getByTestId('app-message')).toHaveAttribute('data-code', 'VALIDATION_ERROR');
    await expect(line.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');

    // FR-2.5.2: quantity ใหม่ที่เป็น 0 หรือนอกช่วง 1–10 ต้องได้ QTY_OUT_OF_RANGE และค่าเดิมต้องไม่เปลี่ยน
    for (const invalidQuantity of ['0', '11']) {
      await quantityInput.fill(invalidQuantity);
      await line.getByTestId('cart-line-update').click();
      await expect(line.getByTestId('app-message')).toHaveAttribute('data-code', 'QTY_OUT_OF_RANGE');
      await expect(line.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');
    }

    // FR-2.5.6: updateQuantity ที่ผ่านการตรวจสอบต้องแทนที่ quantity เดิมด้วยค่าใหม่
    await quantityInput.fill('3');
    await line.getByTestId('cart-line-update').click();
    await expect(line.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');
    await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', String(product!.price * 3));

    // FR-2.7.3 / FR-2.7.4: ลบรายการสินค้าออกทั้งรายการ และเมื่อตะกร้าว่างต้องแสดงข้อความตะกร้าว่าง
    await line.getByTestId('cart-line-remove').click();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('app-message')).toContainText('ตะกร้าว่าง');
    await expect(page.getByTestId('checkout-button')).toBeDisabled();
  });

  test('combined quantity and stock limits reject changes without altering existing lines (FR-2.4)', async ({ page }) => {
    await signInAndRequireCleanCart(page);
    const highStockProduct = await findProductCard(page, stock => stock >= 11);
    const limitedStockProduct = await findProductCard(page, stock => stock >= 1 && stock <= 9);
    test.skip(!highStockProduct || !limitedStockProduct, 'Seed data needs one available product with stock >=11 and another with stock 1–9.');

    // FR-2.4.1: quantity รวมหลังเพิ่มเกิน 10 ต้องได้ QTY_OUT_OF_RANGE และข้อมูลเดิมต้องคงอยู่
    await addQuantity(highStockProduct!, 10);
    await addQuantity(highStockProduct!, 1);
    await expect(highStockProduct!.card.getByTestId('app-message')).toHaveAttribute('data-code', 'QTY_OUT_OF_RANGE');

    await page.getByTestId('nav-cart').click();
    const highStockLine = page.getByTestId(`cart-line-${highStockProduct!.id}`);
    await expect(highStockLine.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '10');
    await page.goto(`${baseURL}/products`);
    await waitForProductList(page);

    // FR-2.4.2: quantity หลังเพิ่มที่เกินสต็อกพร้อมขายต้องได้ INSUFFICIENT_STOCK
    await addQuantity(limitedStockProduct!, limitedStockProduct!.stock + 1);
    await expect(limitedStockProduct!.card.getByTestId('app-message')).toHaveAttribute('data-code', 'INSUFFICIENT_STOCK');

    // เพิ่มรายการที่ถูกต้อง แล้วตรวจว่า updateQuantity ที่เกินสต็อกได้ INSUFFICIENT_STOCK โดย quantity เดิมไม่เปลี่ยน
    await addQuantity(limitedStockProduct!, 1);
    await page.getByTestId('nav-cart').click();
    const limitedLine = page.getByTestId(`cart-line-${limitedStockProduct!.id}`);
    await limitedLine.getByTestId('cart-line-qty-input').fill(String(limitedStockProduct!.stock + 1));
    await limitedLine.getByTestId('cart-line-update').click();
    await expect(limitedLine.getByTestId('app-message')).toHaveAttribute('data-code', 'INSUFFICIENT_STOCK');
    await expect(limitedLine.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '1');
  });
});

/*
 * ข้อกำหนดที่ flow บน UI นี้เรียกทดสอบโดยตรงไม่ได้ จึงต้องมี API-level test เพิ่ม:
 * FR-2.2.1/.2 (ไม่พบสินค้า/สินค้าไม่พร้อมขาย), FR-2.5.3/.4 (สินค้าไม่อยู่ในตะกร้า/ไม่พร้อมขาย),
 * FR-2.6 (ลำดับการตรวจสอบและ error แรกที่ไม่ผ่าน) และ FR-2.7.1/.2 (ลบจากตะกร้าว่าง/ลบสินค้าที่ไม่มีในตะกร้า)
 */

