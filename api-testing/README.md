# SRS-CART API Automated Testing Suite

ชุดทดสอบอัตโนมัติ (Automated API Test Suite) พัฒนาด้วย **Vitest** โดยแปลงจากเอกสาร Test Cases ใน [`test-case.xlsx`](./test-case.xlsx) ครบถ้วนทั้ง **56 Test Cases**:
- **Happy Paths (A1 – A20)**: 20 เคส
- **Negative Paths (B1 – B22)**: 22 เคส
- **Boundary Paths (C1 – C14)**: 14 เคส

---

## 1. ข้อกำหนดเบื้องต้น (Prerequisites)

ก่อนเริ่มรันชุดทดสอบ ต้องเปิด Service ของระบบให้พร้อมทำงาน:

1. **PostgreSQL Database (Docker / Supabase)**:
   * ทำงานที่ Port `54322` (ค่าเริ่มต้น: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`)
   * คำสั่งสตาร์ท (ถ้ายังไม่เปิด):
     ```cmd
     cd ../backend/database
     npx supabase start
     ```
2. **Express API Server**:
   * ทำงานที่ Port `3001` (`http://localhost:3001`)
   * คำสั่งสตาร์ท:
     ```cmd
     cd ../backend/api
     npm run dev
     ```

---

## 2. การติดตั้ง Dependencies

เปิด Command Prompt หรือ PowerShell แล้วเข้าไปที่โฟลเดอร์ `api-testing`:

```cmd
cd api-testing
npm install
```

---

## 3. คำสั่งการรันชุดทดสอบ (How to Run)

### 3.1 รันการทดสอบทั้งหมด (Run All Tests)

```cmd
npm test
```
*หรือใช้คำสั่ง:*
```cmd
npx vitest run
```

### 3.2 รันเฉพาะกลุ่ม Test Cases

สามารถเลือกทดสอบเฉพาะหมวดหมู่ได้โดยใช้ flag `-t`:

* **รันเฉพาะ Happy Paths (A1 - A20):**
  ```cmd
  npx vitest run -t "Happy Paths"
  ```
* **รันเฉพาะ Negative Paths (B1 - B22):**
  ```cmd
  npx vitest run -t "Negative Paths"
  ```
* **รันเฉพาะ Boundary Paths (C1 - C14):**
  ```cmd
  npx vitest run -t "Boundary Paths"
  ```
* **รันเฉพาะเคสที่ต้องการ (เช่น A10 หรือ B4):**
  ```cmd
  npx vitest run -t "A10"
  ```

### 3.3 รันในโหมด Watch (สำหรับ Development)

```cmd
npx vitest
```

### 3.4 รันผ่าน Web UI

Vitest Web UI ใช้สำหรับดูผลการทดสอบและสั่งรัน test ผ่านเบราว์เซอร์ โดย test ยังคงทำงานบน Node.js และเชื่อมต่อกับ Express API และ PostgreSQL ตามปกติ

ติดตั้ง dependency สำหรับ Web UI ครั้งแรกจากโฟลเดอร์ `api-testing`:

```cmd
npm install --save-dev @vitest/ui@^3.0.0
```

จากนั้นเริ่ม Web UI:

```cmd
npx vitest --ui
```

Vitest จะแสดง URL ใน CMD โดยปกติจะเป็น:

```text
http://localhost:51204
```

เปิด URL ที่แสดงใน CMD หรือใช้คำสั่งนี้:

```cmd
start http://localhost:51204
```

> หาก Vitest แสดง port อื่น ให้ใช้ URL และ port ที่แสดงจริงใน CMD แทน `51204` คำสั่ง `npx vitest --ui` จะทำงานแบบ watch และจะรันใหม่เมื่อไฟล์ถูกแก้ไข

หากต้องการใช้คำสั่งสั้น ๆ ให้เพิ่ม script นี้ใน `api-testing/package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:ui": "vitest --ui"
}
```

แล้วรัน:

```cmd
npm run test:ui
```

ก่อนเปิด Web UI ต้องเปิด service ที่ใช้ทดสอบใน CMD แยกกัน:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npx --yes supabase start
```

และอีกหน้าต่างหนึ่ง:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm run dev
```

API ต้องทำงานที่ `http://localhost:3001` และ Supabase PostgreSQL ต้องทำงานที่ port `54322` ตามค่าเริ่มต้น

หยุด Web UI ด้วยการกด **Ctrl+C** ในหน้าต่าง CMD ที่รัน Vitest

---

## 4. การตั้งค่า Environment Variables (ถ้าต้องการปรับเปลี่ยน)

ค่าเริ่มต้นถูกตั้งไว้ให้ตรงกับระบบ Local Development:
- `API_URL`: `http://localhost:3001`
- `DATABASE_URL`: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

หากรัน API หรือ Database บน Port หรือ Host อื่น สามารถกำหนดค่าผ่าน Command Line ได้:

* **Windows Command Prompt (CMD):**
  ```cmd
  set API_URL=http://localhost:3001
  set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
  npm test
  ```
* **Windows PowerShell:**
  ```powershell
  $env:API_URL="http://localhost:3001"
  $env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  npm test
  ```

---

## 5. การจัดการ State และความปลอดภัยของข้อมูล (Test Isolation)

* ตัว Script มี `beforeAll` ที่จะตรวจสอบและเพิ่มสินค้าอ้างอิง `P1`, `P2`, `P3` ตามข้อกำหนดของ Section 7 SRS
* มี `beforeEach` ที่จะ **Reset ตะกร้า, คูปอง, สต็อก และราคาสินค้า** ให้กลับสู่สถานะ Clean เริ่มต้นเสมอก่อนเริ่มทุกเคส
* ตั้งค่า `fileParallelism: false` ใน `vitest.config.ts` เพื่อให้รันแบบเป็นลำดับ (Sequential) ป้องกันการเกิด Race Condition บนฐานข้อมูลเดียวกัน
