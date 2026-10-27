# คู่มือ SRS Unit Test ด้วย Vitest

คู่มือนี้สำหรับผู้ที่ clone โปรเจกต์ไปรันบนเครื่อง Windows หรือ Linux ของตัวเอง

ชุดทดสอบเรียก business logic จริงจาก `backend/api/business/pricing.ts` โดยตรง และค้นหาเฉพาะ `tests/srs-unit/**/*.test.ts` ดังนั้นไม่ต้องเปิด frontend, API server, Docker หรือฐานข้อมูล และไม่ต้องสร้างไฟล์ `.env`

> สถานะการตรวจสอบ: ชุดคำสั่งและ test เคยตรวจบน Linux แล้ว แต่ขั้นตอน Windows ยังไม่ได้ทดสอบบนเครื่อง Windows จริง

## 1. ติดตั้งครั้งแรก

### 1.1 ติดตั้ง Node.js 24 และ npm

ติดตั้ง Node.js 24 บนเครื่อง โดย npm จะติดตั้งมาพร้อม Node.js ไม่ต้องสร้าง virtual environment หรือ environment อื่นเพิ่ม

- **Windows:** ติดตั้ง Node.js 24 แล้วปิดและเปิด Command Prompt, PowerShell หรือ Windows Terminal ใหม่ เพื่ออัปเดต `PATH`
- **Linux:** ติดตั้ง Node.js 24 ด้วยวิธีที่เหมาะกับ Linux distribution ของคุณ แล้วเปิด Terminal ใหม่

ตรวจว่าใช้งานได้:

```text
node --version
npm --version
```

`node --version` ควรแสดง `v24.x.x` และ `npm --version` ต้องแสดงหมายเลขเวอร์ชันโดยไม่มี error

### 1.2 เข้าโฟลเดอร์โปรเจกต์

แทน path ตัวอย่างด้วยตำแหน่งจริงของ `cart-api-frontend` บนเครื่องของคุณ

**Windows Command Prompt (CMD):**

```bat
cd /d "D:\path\to\cart-api-frontend"
```

**Windows PowerShell:**

```powershell
Set-Location "D:\path\to\cart-api-frontend"
```

**Linux Bash:**

```bash
cd /path/to/cart-api-frontend
```

คำสั่งในคู่มือนี้ต้องรันจาก root ของ `cart-api-frontend` ไม่ใช่จาก `tests/` หรือ `tests/srs-unit/`

### 1.3 ติดตั้ง dependencies ของชุดทดสอบ

```text
npm --prefix tests ci
```

คำสั่งนี้อ่าน `tests/package.json` และ `tests/package-lock.json` แล้วสร้าง `tests/node_modules`

## 2. ใช้งานครั้งถัดไป

1. เปิด Terminal
2. เข้า root ของ `cart-api-frontend` ด้วยคำสั่งตามระบบปฏิบัติการในหัวข้อ 1.2
3. รัน test หรือคำสั่งอื่นในหัวข้อถัดไปได้ทันที

ไม่จำเป็นต้องรัน `npm --prefix tests ci` ทุกครั้ง ให้รันใหม่เมื่อ:

- เพิ่ง clone โปรเจกต์ลงเครื่องนี้
- ลบหรือยังไม่มี `tests/node_modules`
- `tests/package-lock.json` เปลี่ยน
- เปลี่ยนเครื่องหรือเปลี่ยนระบบปฏิบัติการ

## 3. คำสั่งทดสอบ

คำสั่งต่อไปนี้เหมือนกันบน Windows CMD, Windows PowerShell และ Linux Bash

### ตรวจ TypeScript แบบ strict

```text
npm --prefix tests run typecheck:srs
```

### รันทั้งหมดหนึ่งครั้ง

```text
npm --prefix tests run test:srs
```

ผลปกติคือ 13 ไฟล์ / 172 เคสผ่าน และไม่มีเคสข้าม

### Watch mode

แก้ไฟล์แล้วให้ Vitest รันทดสอบใหม่อัตโนมัติ:

```text
npm --prefix tests run test:srs:watch
```

### รันเฉพาะ original

```text
npm --prefix tests run test:srs:original
```

ชุด original มี 10 ไฟล์ / 154 เคส

### รันเฉพาะ supplementary

```text
npm --prefix tests run test:srs:supplementary
```

ชุด supplementary มี 3 ไฟล์ / 18 เคส

### รันไฟล์เดียว

ตัวอย่างรัน checkout test:

```text
npm --prefix tests run test:srs -- srs-unit/original/unit-09-checkout.test.ts
```

### รันเคสเดียวด้วยรหัส UT

ตัวอย่างรัน UT-120:

```text
npm --prefix tests run test:srs -- -t "UT-120"
```

เมื่อใช้ `-t` เคสอื่นจะแสดงเป็น `skipped` เพราะถูกกรองชั่วคราว ไม่ได้มีการเพิ่ม `skip` ลงในไฟล์ test

## 4. เปิด Vitest UI บนเครื่องตัวเอง

รันจาก root ของโปรเจกต์:

```text
npm --prefix tests run test:srs:ui
```

เมื่อ UI เริ่มสำเร็จ Terminal จะแสดง URL เต็มพร้อม token ลักษณะนี้:

```text
http://127.0.0.1:51204/__vitest__/?token=...
```

คัดลอก **URL เต็มจาก Terminal รอบล่าสุด** ไปเปิดใน browser บนเครื่องเดียวกัน ต้องคงทั้ง path `/__vitest__/` และ `?token=...` ไว้ อย่าเปิดเพียง `http://127.0.0.1:51204`

UI ฟังเฉพาะ `127.0.0.1:51204`, ใช้ `strictPort` และ token authentication README นี้ไม่เก็บ token จริง และไม่ต้อง Forward Port เมื่อรันบนเครื่องตัวเอง

## 5. อ่านผลทดสอบ

- `Test Files 13 passed (13)` หมายถึงไฟล์ test ทั้ง 13 ผ่าน
- `Tests 172 passed (172)` หมายถึงทั้ง 172 เคสผ่าน
- สีเขียวหรือเครื่องหมายถูกคือผ่าน (`passed`)
- สีแดงหรือเครื่องหมายกากบาทคือไม่ผ่าน (`failed`)
- การรันทั้งหมดตามปกติควรมี 0 failed และ 0 skipped
- เมื่อ assertion ไม่ผ่าน ให้เปรียบเทียบ `actual` ซึ่งเป็นค่าที่โค้ดคืนจริง กับ `expected` ที่ test กำหนด และดูชื่อไฟล์กับเลขบรรทัดใน stack trace

อย่าแก้ expected result เพียงเพื่อทำให้ test ผ่าน ให้ตรวจสาเหตุของความแตกต่างก่อน

## 6. หยุด watch mode หรือ UI

ทั้ง Windows และ Linux ให้กลับไปยัง Terminal ที่กำลังรัน watch/UI แล้วกด:

```text
Ctrl+C
```

ถ้า Windows Command Prompt ถาม:

```text
Terminate batch job (Y/N)?
```

ให้พิมพ์ `Y` แล้วกด Enter

## 7. Git และ `node_modules`

`.gitignore` ของโปรเจกต์มี rule `node_modules/` จึง ignore โฟลเดอร์ `node_modules` ทุกระดับ รวมถึง `tests/node_modules`

- ไม่ต้องและไม่ควรส่ง `node_modules` ขึ้น Git
- หลัง clone ลงแต่ละเครื่อง ให้สร้าง `tests/node_modules` ด้วย `npm --prefix tests ci`
- ห้ามคัดลอก `node_modules` ข้าม Windows และ Linux เพราะ dependency บางตัวมี binary ต่างกันตามระบบปฏิบัติการ
- `tests/package.json` และ `tests/package-lock.json` ต้องติดตามใน Git
- `tests/vitest.config.ts` และ `tests/tsconfig.srs-unit.json` ต้องติดตามใน Git
- `tests/srs-unit/README.md` และไฟล์ test ใต้ `tests/srs-unit/` ต้องติดตามใน Git

## โครงสร้างไฟล์

```text
tests/
├── package.json
├── package-lock.json
├── vitest.config.ts
├── tsconfig.srs-unit.json
└── srs-unit/
    ├── README.md
    ├── original/       # 10 ไฟล์ / 154 เคส
    └── supplementary/  # 3 ไฟล์ / 18 เคส
```
