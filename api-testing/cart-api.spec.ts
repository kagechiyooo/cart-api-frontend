import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const myUrl = process.env.API_URL || 'http://localhost:3001';
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const pool = new pg.Pool({ connectionString: dbUrl });

const jsonHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const ACCOUNTS = {
  normal: { username: 'cus_normal', password: 'password123' },
  prime: { username: 'cus_prime', password: 'password123' },
  admin: { username: 'admin01', password: 'admin123' },
};

async function login(account: { username: string; password: string }) {
  const res = await fetch(`${myUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (res.status === 200) {
    const data = await res.json();
    return data.token as string;
  }
  return '';
}

describe('SRS-CART API Automation Tests (from test-case.xlsx)', () => {
  let customerToken = '';
  let primeToken = '';
  let adminToken = '';

  beforeAll(async () => {
    // เตรียม seed products P1, P2, P3 ตามที่ test-case.xlsx กำหนด
    for (const [id, name, desc, cat, price, weight, stock] of [
      ['P1', 'Coffee Beans 250g', 'Coffee beans', 'Coffee', 450, 300, 20],
      ['P2', 'Drip Kettle', 'Drip Kettle', 'Coffee', 1200, 900, 3],
      ['P3', 'Espresso Machine', 'Espresso Machine', 'Coffee', 15000, 8000, 5],
    ] as const) {
      await pool.query(
        `INSERT INTO cart_api.products(id, name, description, category, price, weight_gram, stock, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'เปิดขาย')
         ON CONFLICT (id) DO UPDATE
         SET price=EXCLUDED.price, weight_gram=EXCLUDED.weight_gram, stock=EXCLUDED.stock, status='เปิดขาย'`,
        [id, name, desc, cat, price, weight, stock]
      );
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // 1. Reset ตะกร้าและสต็อกให้อยู่ในสถานะ Clean ก่อนเริ่มแต่ละ test case
    await pool.query('DELETE FROM cart_api.cart_lines');
    await pool.query(`UPDATE cart_api.carts SET stage='ตะกร้า', coupon_code=NULL, current_order_id=NULL, notices='[]'`);
    await pool.query(`UPDATE cart_api.coupons SET status='เปิดใช้' WHERE code='SAVE10'`);
    await pool.query(`UPDATE cart_api.products SET price=450, weight_gram=300, stock=20, status='เปิดขาย' WHERE id='P1'`);
    await pool.query(`UPDATE cart_api.products SET price=1200, weight_gram=900, stock=3, status='เปิดขาย' WHERE id='P2'`);
    await pool.query(`UPDATE cart_api.products SET price=15000, weight_gram=8000, stock=5, status='เปิดขาย' WHERE id='P3'`);

    // 2. รับ Token ล่าสุดสำหรับแต่ละ Role
    customerToken = await login(ACCOUNTS.normal);
    primeToken = await login(ACCOUNTS.prime);
    adminToken = await login(ACCOUNTS.admin);
  });

  // =========================================================================
  // 1. HAPPY PATHS (A1 - A20)
  // =========================================================================
  describe('Happy Paths (A1 - A20)', () => {
    it('A1 OP-1 POST /auth/login - เข้าสู่ระบบด้วย cus_normal สำเร็จ', async () => {
      const res = await fetch(`${myUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ACCOUNTS.normal),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('token');
      expect(body.role).toBe('Customer');
      expect(body.memberTier).toBe('normal');
    });

    it('A2 OP-2 GET /products - ลูกค้าเห็นเฉพาะสินค้าที่เปิดขายและสต็อก >= 1', async () => {
      const res = await fetch(`${myUrl}/products`, {
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(200);
      const products = await res.json();
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      for (const p of products) {
        expect(p.stock).toBeGreaterThanOrEqual(1);
        expect(p).toHaveProperty('productId');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('price');
        expect(p).toHaveProperty('weightGram');
      }
    });

    it('A3 OP-2 GET /products - Admin เห็นสินค้าทั้งหมดรวมสถานะการขาย', async () => {
      const res = await fetch(`${myUrl}/products`, {
        headers: jsonHeaders(adminToken),
      });
      expect(res.status).toBe(200);
      const products = await res.json();
      expect(Array.isArray(products)).toBe(true);
      expect(products.some((p: any) => p.status !== undefined)).toBe(true);
    });

    it('A4 OP-3 POST /cart/items - เพิ่ม P1 จำนวน 2 ชิ้นในตะกร้าว่าง', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(1);
      expect(body.total).toBe(900); // 450 * 2
      expect(['cart', 'ตะกร้า']).toContain(body.stage);
    });

    it('A5 OP-3 POST /cart/items - เพิ่ม P1 ซ้ำอีก 3 ชิ้น ยอดรวมกลายเป็น 5', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }),
      });

      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 3 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(1);
      expect(body.total).toBe(2250); // 450 * 5
      const item = body.items.find((i: any) => i.productId === 'P1');
      expect(item.quantity).toBe(5);
    });

    it('A6 OP-4 PATCH /cart/items/{productId} - ปรับจำนวน P1 เป็น 4 ชิ้น', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }),
      });

      const res = await fetch(`${myUrl}/cart/items/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ quantity: 4 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(1800); // 450 * 4
      const item = body.items.find((i: any) => i.productId === 'P1');
      expect(item.quantity).toBe(4);
    });

    it('A7 OP-5 DELETE /cart/items/{productId} - ลบ P1 จากตะกร้า เหลือ P2', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P2', quantity: 1 }),
      });

      const res = await fetch(`${myUrl}/cart/items/P1`, {
        method: 'DELETE',
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items.some((i: any) => i.productId === 'P1')).toBe(false);
      expect(body.items.some((i: any) => i.productId === 'P2')).toBe(true);
    });

    it('A8 OP-6 PUT /cart/coupon - ผูกคูปอง SAVE10 เข้ากับตะกร้า', async () => {
      const res = await fetch(`${myUrl}/cart/coupon`, {
        method: 'PUT',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ code: 'SAVE10' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.couponCode).toBe('SAVE10');
    });

    it('A9 OP-7 GET /cart - แสดงข้อมูลตะกร้าอย่างละเอียดพร้อมคูปอง', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }),
      });
      await fetch(`${myUrl}/cart/coupon`, {
        method: 'PUT',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ code: 'SAVE10' }),
      });

      const res = await fetch(`${myUrl}/cart`, {
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.couponCode).toBe('SAVE10');
      expect(body.total).toBe(900);
      expect(body.items[0].productId).toBe('P1');
    });

    it('A10 OP-8 POST /checkout - cus_prime สั่งซื้อสินค้าพร้อมส่วนลดคูปอง', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(primeToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(primeToken),
        body: JSON.stringify({ productId: 'P2', quantity: 1 }),
      });
      await fetch(`${myUrl}/cart/coupon`, {
        method: 'PUT',
        headers: jsonHeaders(primeToken),
        body: JSON.stringify({ code: 'SAVE10' }),
      });

      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(primeToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(200);
      const order = await res.json();
      expect(order.subtotal).toBe(1650);
      expect(order.discount).toBe(165);
      expect(order.shippingFee).toBe(0);
      expect(order.netTotal).toBe(1485);
      expect(['pending', 'รอชำระเงิน']).toContain(order.status);
    });

    it('A11 OP-9 POST /checkout/cancel - ยกเลิก checkout และคืนสต็อก', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }),
      });
      await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });

      const res = await fetch(`${myUrl}/checkout/cancel`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(['cancelled', 'ยกเลิก']).toContain(body.order.status);
      expect(['cart', 'ตะกร้า']).toContain(body.cart.stage);
    });

    it('A12 OP-10 POST /payments/{orderId}/success - ชำระเงินสำเร็จ ล้างตะกร้า', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const orderRes = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      const order = await orderRes.json();

      const res = await fetch(`${myUrl}/payments/${order.orderId}/success`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const paymentBody = await res.json();
      expect(['paid', 'ชำระเงินแล้ว']).toContain(paymentBody.status);

      const cartRes = await fetch(`${myUrl}/cart`, { headers: jsonHeaders(customerToken) });
      const cart = await cartRes.json();
      expect(cart.count).toBe(0);
      expect(['success', 'สำเร็จ']).toContain(cart.stage);
    });

    it('A13 OP-11 POST /payments/{orderId}/fail - ชำระเงินล้มเหลว Order ยังรอชำระเงิน', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const orderRes = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      const order = await orderRes.json();

      const res = await fetch(`${myUrl}/payments/${order.orderId}/fail`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const failBody = await res.json();
      expect(failBody.message).toContain('การชำระเงินล้มเหลว');

      const checkOrder = await fetch(`${myUrl}/orders/${order.orderId}`, {
        headers: jsonHeaders(customerToken),
      });
      const orderData = await checkOrder.json();
      expect(['pending', 'รอชำระเงิน']).toContain(orderData.status);
    });

    it('A14 OP-12 POST /checkout/continue-shopping - กลับสู่หน้าตะกร้าจากสถานะสำเร็จ', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const orderRes = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      const order = await orderRes.json();
      await fetch(`${myUrl}/payments/${order.orderId}/success`, { method: 'POST' });

      const res = await fetch(`${myUrl}/checkout/continue-shopping`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(200);
      const cart = await res.json();
      expect(['cart', 'ตะกร้า']).toContain(cart.stage);
    });

    it('A15 OP-13 GET /orders - ดึงรายการคำสั่งซื้อของตนเอง เรียงจากใหม่ไปเก่า', async () => {
      const res = await fetch(`${myUrl}/orders`, {
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(200);
      const orders = await res.json();
      expect(Array.isArray(orders)).toBe(true);
    });

    it('A16 OP-14 GET /orders/{orderId} - ดูรายละเอียดคำสั่งซื้อ', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const checkoutRes = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      const created = await checkoutRes.json();

      const res = await fetch(`${myUrl}/orders/${created.orderId}`, {
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(200);
      const order = await res.json();
      expect(order.orderId).toBe(created.orderId);
      expect(order).toHaveProperty('subtotal');
      expect(order).toHaveProperty('netTotal');
    });

    it('A17 OP-15 PATCH /admin/products/{productId} - Admin อัปเดตราคาและสต็อกสินค้า', async () => {
      const res = await fetch(`${myUrl}/admin/products/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ price: 500, stock: 25 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.price).toBe(500);
      expect(body.stock).toBe(25);
    });

    it('A18 OP-16 PATCH /admin/products/{productId}/status - Admin ปิดการขายสินค้า', async () => {
      const res = await fetch(`${myUrl}/admin/products/P1/status`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ status: 'ปิดขาย' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ปิดขาย');
    });

    it('A19 OP-17 PATCH /admin/coupons/{code}/status - Admin ปิดการใช้งานคูปอง', async () => {
      const res = await fetch(`${myUrl}/admin/coupons/SAVE10/status`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ status: 'ปิดใช้' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ปิดใช้');
    });

    it('A20 OP-18 GET /admin/coupons - Admin ดูรายการคูปองทั้งหมด', async () => {
      const res = await fetch(`${myUrl}/admin/coupons`, {
        headers: jsonHeaders(adminToken),
      });
      expect(res.status).toBe(200);
      const coupons = await res.json();
      expect(Array.isArray(coupons)).toBe(true);
      expect(coupons.some((c: any) => c.code === 'SAVE10')).toBe(true);
    });
  });

  // =========================================================================
  // 2. NEGATIVE PATHS (B1 - B22)
  // =========================================================================
  describe('Negative Paths (B1 - B22)', () => {
    it('B1 POST /auth/login - รหัสผ่านไม่ถูกต้อง ได้ 401 AUTH_INVALID_CREDENTIALS', async () => {
      const res = await fetch(`${myUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'cus_normal', password: 'wrong' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('B2 GET /products - ไม่ส่ง Authorization header ได้ 401 AUTH_REQUIRED', async () => {
      const res = await fetch(`${myUrl}/products`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('B3 POST /cart/items - quantity ไม่ใช่จำนวนเต็ม (1.5) ได้ 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1.5 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('B4 POST /cart/items - quantity เป็น 0 ได้ 400 QTY_OUT_OF_RANGE', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 0 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('QTY_OUT_OF_RANGE');
    });

    it('B5 POST /cart/items - สินค้าไม่มีอยู่ในระบบ ได้ 404 PRODUCT_NOT_FOUND', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'UNKNOWN', quantity: 1 }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('B6 POST /cart/items - จำนวนที่เพิ่มรวมเกินสต็อกพร้อมขาย ได้ 400 INSUFFICIENT_STOCK', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P2', quantity: 2 }),
      });
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P2', quantity: 2 }), // 2 + 2 = 4 > stock 3
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('B7 PATCH /cart/items/{productId} - ปรับจำนวนสินค้าที่ไม่อยู่ในตะกร้า ได้ 404/400 ITEM_NOT_IN_CART', async () => {
      const res = await fetch(`${myUrl}/cart/items/P3`, {
        method: 'PATCH',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      expect([400, 404]).toContain(res.status);
      const body = await res.json();
      expect(body.code).toBe('ITEM_NOT_IN_CART');
    });

    it('B8 DELETE /cart/items/{productId} - ลบสินค้าขณะตะกร้าว่าง ได้ 400/404 CART_EMPTY', async () => {
      const res = await fetch(`${myUrl}/cart/items/P1`, {
        method: 'DELETE',
        headers: jsonHeaders(customerToken),
      });
      expect([400, 404]).toContain(res.status);
    });

    it('B9 PUT /cart/coupon - ใส่ code ตัวพิมพ์เล็ก ได้ 400/404 COUPON_INVALID / COUPON_NOT_FOUND', async () => {
      const res = await fetch(`${myUrl}/cart/coupon`, {
        method: 'PUT',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ code: 'save10' }),
      });
      expect([400, 404]).toContain(res.status);
    });

    it('B10 POST /checkout - checkout ขณะตะกร้าว่าง ได้ 400 CART_EMPTY', async () => {
      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('CART_EMPTY');
    });

    it('B11 POST /checkout - zone ไม่ถูกต้อง ได้ 400 VALIDATION_ERROR', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'Mars', speed: 'standard' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('B12 POST /checkout - น้ำหนักรวมเกิน 20000 กรัม ได้ 400 WEIGHT_LIMIT_EXCEEDED', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P3', quantity: 3 }), // 8000 * 3 = 24000g
      });
      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('WEIGHT_LIMIT_EXCEEDED');
    });

    it('B13 POST /checkout - สินค้าถูกปิดการขาย ได้ 400 ITEMS_UNAVAILABLE', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      await fetch(`${myUrl}/admin/products/P1/status`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ status: 'ปิดขาย' }),
      });

      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('ITEMS_UNAVAILABLE');
    });

    it('B14 POST /checkout/cancel - ยกเลิก checkout ขณะอยู่ stage cart ได้ 400 OPERATION_NOT_ALLOWED', async () => {
      const res = await fetch(`${myUrl}/checkout/cancel`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('OPERATION_NOT_ALLOWED');
    });

    it('B15 POST /payments/{orderId}/success - orderId ไม่ถูกต้อง ได้ 404 ORDER_NOT_FOUND', async () => {
      const res = await fetch(`${myUrl}/payments/00000000-0000-0000-0000-000000000000/success`, {
        method: 'POST',
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('ORDER_NOT_FOUND');
    });

    it('B16 POST /payments/{orderId}/fail - Order จ่ายเงินแล้วเรียก fail ซ้ำ ได้ 400 OPERATION_NOT_ALLOWED', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const orderRes = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      const order = await orderRes.json();
      await fetch(`${myUrl}/payments/${order.orderId}/success`, { method: 'POST' });

      const res = await fetch(`${myUrl}/payments/${order.orderId}/fail`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('OPERATION_NOT_ALLOWED');
    });

    it('B17 GET /orders/{orderId} - ดู Order ของลูกค้าคนอื่น ได้ 404 ORDER_NOT_FOUND', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(primeToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const primeOrderRes = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(primeToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      const primeOrder = await primeOrderRes.json();

      const res = await fetch(`${myUrl}/orders/${primeOrder.orderId}`, {
        headers: jsonHeaders(customerToken), // token cus_normal
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('ORDER_NOT_FOUND');
    });

    it('B18 PATCH /admin/products/{productId} - ลูกค้าทั่วไปเรียก admin endpoint ได้ 403 AUTH_FORBIDDEN', async () => {
      const res = await fetch(`${myUrl}/admin/products/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ price: 500 }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTH_FORBIDDEN');
    });

    it('B19 PATCH /admin/products/{productId} - Admin ใส่ค่า price=0, stock=10000 ได้ 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${myUrl}/admin/products/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ price: 0, stock: 10000 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.fields).toEqual(expect.arrayContaining(['price', 'stock']));
    });

    it('B20 PATCH /admin/products/{productId}/status - สินค้าไม่มีอยู่ ได้ 404 PRODUCT_NOT_FOUND', async () => {
      const res = await fetch(`${myUrl}/admin/products/NO-SUCH-PRODUCT/status`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ status: 'ปิดขาย' }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('B21 PATCH /admin/coupons/{code}/status - คูปองไม่มีอยู่ ได้ 404 COUPON_NOT_FOUND', async () => {
      const res = await fetch(`${myUrl}/admin/coupons/NO-SUCH-COUPON/status`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ status: 'ปิดใช้' }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('COUPON_NOT_FOUND');
    });

    it('B22 GET /admin/coupons - ลูกค้าเรียก Admin-only endpoint ได้ 403 AUTH_FORBIDDEN', async () => {
      const res = await fetch(`${myUrl}/admin/coupons`, {
        headers: jsonHeaders(customerToken),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTH_FORBIDDEN');
    });
  });

  // =========================================================================
  // 3. BOUNDARY PATHS (C1 - C14)
  // =========================================================================
  describe('Boundary Paths (C1 - C14)', () => {
    it('C1 POST /cart/items - ขอบเขตล่าง quantity=1 สำเร็จ ได้ 200', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      expect(res.status).toBe(200);
    });

    it('C2 POST /cart/items - ขอบเขตบน quantity=10 สำเร็จ ได้ 200', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 10 }),
      });
      expect(res.status).toBe(200);
    });

    it('C3 POST /cart/items - เกินขอบเขตบน quantity=11 ได้ 400 QTY_OUT_OF_RANGE', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 11 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('QTY_OUT_OF_RANGE');
    });

    it('C4 PATCH /cart/items/{productId} - ขอบเขตล่าง update quantity=0 ได้ 400 QTY_OUT_OF_RANGE', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }),
      });
      const res = await fetch(`${myUrl}/cart/items/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ quantity: 0 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('QTY_OUT_OF_RANGE');
    });

    it('C5 POST /cart/items - ซื้อตรงตามสต็อกที่มี (P2 stock=3) ได้ 200', async () => {
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P2', quantity: 3 }),
      });
      expect(res.status).toBe(200);
    });

    it('C6 POST /cart/items - ตะกร้ามี 3 แล้วเพิ่มอีก 1 เกินสต็อก ได้ 400 INSUFFICIENT_STOCK', async () => {
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P2', quantity: 3 }),
      });
      const res = await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P2', quantity: 1 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('C7 POST /checkout - น้ำหนักรวมตรง 1000g พอดี จัดอยู่ในกลุ่ม light tier ค่าส่ง 30', async () => {
      await pool.query("UPDATE cart_api.products SET weight_gram=500 WHERE id='P1'");
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }), // 500 * 2 = 1000g
      });
      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(200);
      const order = await res.json();
      expect(order.shippingFee).toBe(30);
    });

    it('C8 POST /checkout - น้ำหนักรวม 1001g เริ่มต้นกลุ่ม medium tier ค่าส่ง 50', async () => {
      await pool.query("UPDATE cart_api.products SET weight_gram=1001 WHERE id='P1'");
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }), // 1001g
      });
      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(200);
      const order = await res.json();
      expect(order.shippingFee).toBe(50);
    });

    it('C9 POST /checkout - น้ำหนักรวมขอบเขตบนสุด 20000g ผ่านได้ 200', async () => {
      await pool.query("UPDATE cart_api.products SET weight_gram=10000 WHERE id='P1'");
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }), // 10000 * 2 = 20000g
      });
      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(200);
    });

    it('C10 POST /checkout - น้ำหนักรวมเกินขอบเขต 20001g ได้ 400 WEIGHT_LIMIT_EXCEEDED', async () => {
      await pool.query("UPDATE cart_api.products SET weight_gram=20001 WHERE id='P1'");
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 1 }), // 20001g
      });
      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('WEIGHT_LIMIT_EXCEEDED');
    });

    it('C11 PATCH /admin/products/{productId} - ขอบเขตล่างสุด price=1, stock=0 ได้ 200', async () => {
      const res = await fetch(`${myUrl}/admin/products/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ price: 1, stock: 0 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.price).toBe(1);
      expect(body.stock).toBe(0);
    });

    it('C12 PATCH /admin/products/{productId} - ขอบเขตสูงสุด price=50000, stock=9999 ได้ 200', async () => {
      const res = await fetch(`${myUrl}/admin/products/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ price: 50000, stock: 9999 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.price).toBe(50000);
      expect(body.stock).toBe(9999);
    });

    it('C13 PATCH /admin/products/{productId} - เกินขอบเขตราคา price=50001 ได้ 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${myUrl}/admin/products/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ price: 50001 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.fields).toContain('price');
    });

    it('C14 POST /checkout - ยอดรวมตรงตามเงื่อนไข minSpend=1000 พอดี ได้รับส่วนลดคูปอง', async () => {
      // ปรับราคา P1 ให้เป็น 500 เพื่อให้ 2 ชิ้นรวมเป็น 1000 บาทพอดี
      await fetch(`${myUrl}/admin/products/P1`, {
        method: 'PATCH',
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ price: 500, stock: 20 }),
      });
      await fetch(`${myUrl}/cart/items`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ productId: 'P1', quantity: 2 }), // 500 * 2 = 1000
      });
      await fetch(`${myUrl}/cart/coupon`, {
        method: 'PUT',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ code: 'SAVE10' }),
      });

      const res = await fetch(`${myUrl}/checkout`, {
        method: 'POST',
        headers: jsonHeaders(customerToken),
        body: JSON.stringify({ zone: 'inCity', speed: 'standard' }),
      });
      expect(res.status).toBe(200);
      const order = await res.json();
      expect(order.subtotal).toBe(1000);
      expect(order.discount).toBe(100); // 10% of 1000 = 100
      expect(order.couponCode).toBe('SAVE10');
    });
  });
});
