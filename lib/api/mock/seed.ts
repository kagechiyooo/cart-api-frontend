import type { Coupon, Order, Product, User } from '@/lib/types'

export interface MockUser extends User {
  password: string
}

export interface MockCart {
  items: { productId: string; quantity: number }[]
  couponCode: string | null
}

export interface MockDb {
  users: MockUser[]
  products: Product[]
  coupons: Coupon[]
  orders: Order[]
  carts: Record<string, MockCart>
  sessionUserId: string | null
  nextOrderNumber: number
  nextId: number
}

export const DEMO_ACCOUNTS = {
  customer: { email: 'customer@example.com', password: 'password123' },
  admin: { email: 'admin@example.com', password: 'admin123' },
} as const

export function createSeedDb(): MockDb {
  return {
    users: [
      {
        id: 'u-customer',
        name: 'Casey Customer',
        email: DEMO_ACCOUNTS.customer.email,
        password: DEMO_ACCOUNTS.customer.password,
        role: 'customer',
      },
      {
        id: 'u-admin',
        name: 'Alex Admin',
        email: DEMO_ACCOUNTS.admin.email,
        password: DEMO_ACCOUNTS.admin.password,
        role: 'admin',
      },
    ],
    products: [
      {
        id: 'p-1',
        name: 'Wireless Headphones',
        description: 'Over-ear noise cancelling headphones with 30-hour battery life.',
        priceCents: 12999,
        category: 'Electronics',
        stock: 15,
        imageUrl: '/products/headphones.png',
        active: true,
      },
      {
        id: 'p-2',
        name: 'Mechanical Keyboard',
        description: 'Compact 75% layout with hot-swappable tactile switches.',
        priceCents: 8950,
        category: 'Electronics',
        stock: 8,
        imageUrl: '/products/keyboard.png',
        active: true,
      },
      {
        id: 'p-3',
        name: 'Ceramic Coffee Mug',
        description: 'Hand-glazed 350ml stoneware mug. Dishwasher safe.',
        priceCents: 1499,
        category: 'Home',
        stock: 40,
        imageUrl: '/products/mug.png',
        active: true,
      },
      {
        id: 'p-4',
        name: 'Canvas Backpack',
        description: 'Water-resistant waxed canvas with a padded laptop sleeve.',
        priceCents: 5900,
        category: 'Accessories',
        stock: 12,
        imageUrl: '/products/backpack.png',
        active: true,
      },
      {
        id: 'p-5',
        name: 'Minimal Desk Lamp',
        description: 'Adjustable LED desk lamp with three color temperatures.',
        priceCents: 3995,
        category: 'Home',
        stock: 0,
        imageUrl: '/products/lamp.png',
        active: true,
      },
      {
        id: 'p-6',
        name: 'Running Sneakers',
        description: 'Lightweight breathable mesh with responsive foam cushioning.',
        priceCents: 7499,
        category: 'Apparel',
        stock: 20,
        imageUrl: '/products/sneakers.png',
        active: true,
      },
      {
        id: 'p-7',
        name: 'Insulated Water Bottle',
        description: 'Keeps drinks cold for 24 hours or hot for 12. 750ml.',
        priceCents: 2400,
        category: 'Accessories',
        stock: 30,
        imageUrl: '/products/bottle.png',
        active: true,
      },
      {
        id: 'p-8',
        name: 'Cotton Hoodie',
        description: 'Heavyweight brushed-fleece hoodie in heather gray.',
        priceCents: 4999,
        category: 'Apparel',
        stock: 3,
        imageUrl: '/products/hoodie.png',
        active: true,
      },
    ],
    coupons: [
      {
        id: 'c-1',
        code: 'SAVE10',
        description: '10% off any order',
        type: 'percent',
        value: 10,
        minSubtotalCents: 0,
        active: true,
        expiresAt: null,
      },
      {
        id: 'c-2',
        code: 'WELCOME5',
        description: '$5 off orders over $25',
        type: 'fixed',
        value: 500,
        minSubtotalCents: 2500,
        active: true,
        expiresAt: '2030-12-31',
      },
      {
        id: 'c-3',
        code: 'BIG20',
        description: '20% off orders over $100',
        type: 'percent',
        value: 20,
        minSubtotalCents: 10000,
        active: true,
        expiresAt: null,
      },
      {
        id: 'c-4',
        code: 'EXPIRED15',
        description: 'Expired seasonal promotion',
        type: 'percent',
        value: 15,
        minSubtotalCents: 0,
        active: true,
        expiresAt: '2025-01-01',
      },
      {
        id: 'c-5',
        code: 'INACTIVE50',
        description: 'Disabled internal coupon',
        type: 'percent',
        value: 50,
        minSubtotalCents: 0,
        active: false,
        expiresAt: null,
      },
    ],
    orders: [
      {
        id: 'ORD-1001',
        userId: 'u-customer',
        createdAt: '2026-09-02T14:20:00.000Z',
        status: 'delivered',
        items: [
          { productId: 'p-3', name: 'Ceramic Coffee Mug', priceCents: 1499, quantity: 2 },
          { productId: 'p-7', name: 'Insulated Water Bottle', priceCents: 2400, quantity: 1 },
        ],
        couponCode: null,
        totals: {
          subtotalCents: 5398,
          discountCents: 0,
          shippingCents: 0,
          taxCents: 432,
          totalCents: 5830,
        },
        shippingAddress: {
          fullName: 'Casey Customer',
          addressLine: '12 Testing Lane',
          city: 'Springfield',
          postalCode: '12345',
          country: 'United States',
        },
        paymentMethod: 'card',
      },
      {
        id: 'ORD-1002',
        userId: 'u-customer',
        createdAt: '2026-10-01T09:05:00.000Z',
        status: 'pending',
        items: [{ productId: 'p-2', name: 'Mechanical Keyboard', priceCents: 8950, quantity: 1 }],
        couponCode: 'SAVE10',
        totals: {
          subtotalCents: 8950,
          discountCents: 895,
          shippingCents: 0,
          taxCents: 644,
          totalCents: 8699,
        },
        shippingAddress: {
          fullName: 'Casey Customer',
          addressLine: '12 Testing Lane',
          city: 'Springfield',
          postalCode: '12345',
          country: 'United States',
        },
        paymentMethod: 'paypal',
      },
    ],
    carts: {},
    sessionUserId: null,
    nextOrderNumber: 1003,
    nextId: 100,
  }
}
