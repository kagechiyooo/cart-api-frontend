type MemberTier = "normal" | "prime";
interface Coupon {
  expiresAt: string | null;
}

/** UI compatibility only; SRS coupons have no expiration rule. */
export function isCouponExpired(
  coupon: Coupon,
  now: Date = new Date(),
): boolean {
  return (
    !!coupon.expiresAt &&
    now.getTime() > new Date(`${coupon.expiresAt}T23:59:59.999Z`).getTime()
  );
}
export const MAX_QUANTITY_PER_ITEM = 10;
export const isProductAvailable = (active: boolean, stock: number): boolean =>
  active && stock >= 1;
export type QuantityResult =
  | "OK"
  | "VALIDATION_ERROR"
  | "QTY_OUT_OF_RANGE"
  | "PRODUCT_NOT_FOUND"
  | "ITEM_NOT_IN_CART"
  | "PRODUCT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK";
export function validateQuantityChange(input: {
  operation: "add" | "update";
  quantity: unknown;
  productExists: boolean;
  inCart: boolean;
  available: boolean;
  currentQtyInCart: number;
  availableStock: number;
}): QuantityResult {
  const q = input.quantity;
  if (typeof q !== "number" || !Number.isInteger(q)) return "VALIDATION_ERROR";
  if (q < 1 || q > 10) return "QTY_OUT_OF_RANGE";
  if (input.operation === "add" && !input.productExists)
    return "PRODUCT_NOT_FOUND";
  if (input.operation === "update" && !input.inCart) return "ITEM_NOT_IN_CART";
  if (!input.available) return "PRODUCT_UNAVAILABLE";
  const combined = input.operation === "add" ? input.currentQtyInCart + q : q;
  if (combined > 10) return "QTY_OUT_OF_RANGE";
  if (combined > input.availableStock) return "INSUFFICIENT_STOCK";
  return "OK";
}
export const calculateSubtotal = (
  items: { price: number; quantity: number }[],
): number => items.reduce((sum, i) => sum + i.price * i.quantity, 0);
export const calculateTotalWeight = (
  items: { weightGram: number; quantity: number }[],
): number => items.reduce((sum, i) => sum + i.weightGram * i.quantity, 0);
export function calculateDiscount(
  subtotal: number,
  memberTier: MemberTier,
  coupon: { percent: number; minSpend: number; active: boolean } | null,
): {
  discount: number;
  source: "coupon" | "member" | "none";
  couponRemoved: boolean;
} {
  const valid = coupon !== null && coupon.active && subtotal >= coupon.minSpend;
  const percent = valid ? coupon.percent : memberTier === "prime" ? 5 : 0;
  return {
    discount: Math.floor((subtotal * percent) / 100),
    source: valid ? "coupon" : memberTier === "prime" ? "member" : "none",
    couponRemoved: coupon !== null && !valid,
  };
}
export type WeightTier = "light" | "medium" | "heavy" | "overLimit";
export const classifyWeight = (weight: number): WeightTier =>
  weight <= 1000
    ? "light"
    : weight <= 5000
      ? "medium"
      : weight <= 20000
        ? "heavy"
        : "overLimit";
export function calculateShippingFee(
  weightTier: Exclude<WeightTier, "overLimit">,
  zone: "inCity" | "upcountry" | "remote",
  speed: "standard" | "express",
  memberTier: MemberTier,
): number {
  const base = {
    light: { inCity: 30, upcountry: 50, remote: 80 },
    medium: { inCity: 50, upcountry: 80, remote: 120 },
    heavy: { inCity: 80, upcountry: 120, remote: 180 },
  }[weightTier][zone];
  return memberTier === "prime"
    ? speed === "standard"
      ? 0
      : Math.floor(base * 0.5)
    : speed === "standard"
      ? base
      : Math.floor(base * 1.5);
}
export const calculateNetTotal = (
  subtotal: number,
  discount: number,
  shippingFee: number,
): number => subtotal - discount + shippingFee;
export type CheckoutValidation =
  | { result: "OK" }
  | { result: "VALIDATION_ERROR" | "CART_EMPTY" | "WEIGHT_LIMIT_EXCEEDED" }
  | { result: "ITEMS_UNAVAILABLE"; productIds: string[] };
export function validateCheckout(input: {
  zone: unknown;
  speed: unknown;
  lines: {
    productId: string;
    quantity: number;
    available: boolean;
    availableStock: number;
  }[];
  totalWeightGram: number;
}): CheckoutValidation {
  if (
    !["inCity", "upcountry", "remote"].includes(input.zone as string) ||
    !["standard", "express"].includes(input.speed as string)
  )
    return { result: "VALIDATION_ERROR" };
  if (!input.lines.length) return { result: "CART_EMPTY" };
  const productIds = input.lines
    .filter((i) => !i.available || i.quantity > i.availableStock)
    .map((i) => i.productId);
  if (productIds.length) return { result: "ITEMS_UNAVAILABLE", productIds };
  if (input.totalWeightGram > 20000) return { result: "WEIGHT_LIMIT_EXCEEDED" };
  return { result: "OK" };
}
export function validateProductUpdate(input: {
  price?: unknown;
  stock?: unknown;
}): ("price" | "stock")[] {
  if (input.price === undefined && input.stock === undefined)
    return ["price", "stock"];
  const fields: ("price" | "stock")[] = [];
  if (
    input.price !== undefined &&
    (typeof input.price !== "number" ||
      !Number.isInteger(input.price) ||
      input.price < 1 ||
      input.price > 50000)
  )
    fields.push("price");
  if (
    input.stock !== undefined &&
    (typeof input.stock !== "number" ||
      !Number.isInteger(input.stock) ||
      input.stock < 0 ||
      input.stock > 9999)
  )
    fields.push("stock");
  return fields;
}
