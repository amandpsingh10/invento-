/* eslint-disable no-console */
import { PrismaClient, RoleName, MasterStatus, StockTxnType, IssueStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo@1234";
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "superadmin@parts_inventory.app";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin@1234";
const SUPER_ADMIN_MOBILE = process.env.SUPER_ADMIN_MOBILE ?? "9999999999";

const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  SUPER_ADMIN: ["platform:manage", "tenants:manage", "subscriptions:manage", "system:manage"],
  TENANT_ADMIN: [
    "users:manage",
    "stores:manage",
    "bins:manage",
    "racks:manage",
    "parts:manage",
    "inventory:view",
    "purchases:create",
    "issues:create",
    "returns:create",
    "adjustments:create",
    "reports:view",
  ],
  INVENTORY_MANAGER: [
    "purchases:create",
    "inventory:view",
    "issues:create",
    "returns:create",
    "adjustments:create",
    "reports:view",
  ],
  STORE_USER: ["inventory:view", "issues:create", "returns:create"],
  VIEWER: ["inventory:view", "reports:view"],
};

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("Seeding PARTS INVENTORY SYSTEM database...");

  // ---- Plans ----
  const [trial, basic, pro, enterprise] = await Promise.all([
    prisma.plan.upsert({
      where: { code: "TRIAL" },
      update: {},
      create: {
        code: "TRIAL",
        name: "Trial",
        description: "14-day free trial",
        priceMonthly: 0,
        maxUsers: 3,
        maxStores: 1,
        maxParts: 200,
        maxMonthlyTxns: 300,
        maxExcelUploadRows: 200,
        maxStorageMb: 100,
      },
    }),
    prisma.plan.upsert({
      where: { code: "BASIC" },
      update: {},
      create: {
        code: "BASIC",
        name: "Basic",
        priceMonthly: 1999,
        maxUsers: 5,
        maxStores: 2,
        maxParts: 2000,
        maxMonthlyTxns: 3000,
        maxExcelUploadRows: 1000,
        maxStorageMb: 1024,
      },
    }),
    prisma.plan.upsert({
      where: { code: "PRO" },
      update: {},
      create: {
        code: "PRO",
        name: "Pro",
        priceMonthly: 4999,
        maxUsers: 20,
        maxStores: 10,
        maxParts: 20000,
        maxMonthlyTxns: 30000,
        maxExcelUploadRows: 5000,
        maxStorageMb: 10240,
      },
    }),
    prisma.plan.upsert({
      where: { code: "ENTERPRISE" },
      update: {},
      create: {
        code: "ENTERPRISE",
        name: "Enterprise",
        priceMonthly: 14999,
        maxUsers: 200,
        maxStores: 100,
        maxParts: 200000,
        maxMonthlyTxns: 500000,
        maxExcelUploadRows: 20000,
        maxStorageMb: 102400,
      },
    }),
  ]);

  // ---- Roles + permissions ----
  for (const roleName of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const code of ROLE_PERMISSIONS[roleName]) {
      const permission = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  const roles = await prisma.role.findMany();
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r]));

  // ---- Super admin (platform-level, no tenant) ----
  // Prisma's compound-unique input type for `tenantId_email` requires a
  // non-null tenantId even though the column itself is nullable, so
  // findUnique/upsert can't be used here for a null-tenant user — fall back
  // to findFirst + create, which accepts null in a plain filter.
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { tenantId: null, email: SUPER_ADMIN_EMAIL },
  });
  const superAdmin =
    existingSuperAdmin ??
    (await prisma.user.create({
      data: {
        tenantId: null,
        email: SUPER_ADMIN_EMAIL,
        mobile: SUPER_ADMIN_MOBILE,
        passwordHash: await hashPassword(SUPER_ADMIN_PASSWORD),
        firstName: "Platform",
        lastName: "Admin",
        userRoles: { create: { roleId: roleByName.SUPER_ADMIN.id } },
      },
    }));

  // Backfill mobile on a super admin created before the mobile+password
  // login migration (mobile is now the unique login identity).
  if (existingSuperAdmin && !existingSuperAdmin.mobile) {
    await prisma.user.update({ where: { id: existingSuperAdmin.id }, data: { mobile: SUPER_ADMIN_MOBILE } });
  }

  // ---- Demo tenant ----
  // name/address are also set on `update` (not just `create`) so re-running
  // the seed rebrands an already-existing tenant rather than leaving it
  // stuck with whatever it was first created with.
  const tenant = await prisma.tenant.upsert({
    where: { dealerCode: "DEMO001" },
    update: {
      name: "AMAN ENTERPRISES",
      address: "SOHNA ROAD, FARIDABAD",
      state: "Haryana",
      pincode: "121002",
      // Placeholder — replace with the real dealer GSTIN via Administration
      // (or a future tenant-settings screen); format-valid so it exercises
      // the invoice layout correctly in the meantime.
      gstin: "06AAAAA0000A1Z5",
    },
    create: {
      dealerCode: "DEMO001",
      name: "AMAN ENTERPRISES",
      contactPerson: "Rajesh Kumar",
      email: "contact@dealerdemo.example",
      phone: "+91-9800000000",
      address: "SOHNA ROAD, FARIDABAD",
      state: "Haryana",
      pincode: "121002",
      gstin: "06AAAAA0000A1Z5",
      status: "ACTIVE",
      trialStartsAt: new Date(),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const existingSubscription = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
  if (!existingSubscription) {
    await prisma.subscription.create({
      data: { tenantId: tenant.id, planId: pro.id, status: "ACTIVE", startsAt: new Date() },
    });
  }

  // ---- Demo users ----
  const [tenantAdmin, inventoryManager, storeUser] = await Promise.all([
    prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: "admin@demo.com" } },
      update: { mobile: "9876500001" },
      create: {
        tenantId: tenant.id,
        email: "admin@demo.com",
        mobile: "9876500001",
        passwordHash: await hashPassword(DEMO_PASSWORD),
        firstName: "Anita",
        lastName: "Sharma",
        userRoles: { create: { roleId: roleByName.TENANT_ADMIN.id } },
      },
    }),
    prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: "inventory@demo.com" } },
      update: { mobile: "9876500002" },
      create: {
        tenantId: tenant.id,
        email: "inventory@demo.com",
        mobile: "9876500002",
        passwordHash: await hashPassword(DEMO_PASSWORD),
        firstName: "Vikram",
        lastName: "Singh",
        userRoles: { create: { roleId: roleByName.INVENTORY_MANAGER.id } },
      },
    }),
    prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: "store@demo.com" } },
      update: { mobile: "9876500003" },
      create: {
        tenantId: tenant.id,
        email: "store@demo.com",
        mobile: "9876500003",
        passwordHash: await hashPassword(DEMO_PASSWORD),
        firstName: "Priya",
        lastName: "Nair",
        userRoles: { create: { roleId: roleByName.STORE_USER.id } },
      },
    }),
  ]);

  // ---- Stores / Bins / Racks ----
  const mainStore = await prisma.store.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MAIN" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "MAIN",
      name: "Main Store",
      address: "Ground Floor, Dealer Demo Workshop",
      status: MasterStatus.ACTIVE,
    },
  });

  const bin01 = await prisma.bin.upsert({
    where: { tenantId_storeId_code: { tenantId: tenant.id, storeId: mainStore.id, code: "BIN-01" } },
    update: {},
    create: { tenantId: tenant.id, storeId: mainStore.id, code: "BIN-01" },
  });
  const bin02 = await prisma.bin.upsert({
    where: { tenantId_storeId_code: { tenantId: tenant.id, storeId: mainStore.id, code: "BIN-02" } },
    update: {},
    create: { tenantId: tenant.id, storeId: mainStore.id, code: "BIN-02" },
  });
  const rack03 = await prisma.rack.upsert({
    where: { tenantId_storeId_code: { tenantId: tenant.id, storeId: mainStore.id, code: "RACK-03" } },
    update: {},
    create: { tenantId: tenant.id, storeId: mainStore.id, code: "RACK-03" },
  });
  const rack04 = await prisma.rack.upsert({
    where: { tenantId_storeId_code: { tenantId: tenant.id, storeId: mainStore.id, code: "RACK-04" } },
    update: {},
    create: { tenantId: tenant.id, storeId: mainStore.id, code: "RACK-04" },
  });

  // ---- Parts ----
  const partDefs = [
    { partNo: "BRK-PAD-001", description: "Front Brake Pad", taxPercent: 28, hsnCode: "87083000", mrp: 5000, ndp: 3500, minimumStockLevel: 5 },
    { partNo: "OIL-FLT-001", description: "Engine Oil Filter", taxPercent: 18, hsnCode: "84212300", mrp: 450, ndp: 280, minimumStockLevel: 20 },
    { partNo: "AIR-FLT-001", description: "Air Filter", taxPercent: 18, hsnCode: "84213100", mrp: 650, ndp: 400, minimumStockLevel: 15 },
    { partNo: "SPARK-001", description: "Spark Plug", taxPercent: 28, hsnCode: "85110000", mrp: 350, ndp: 210, minimumStockLevel: 30 },
    { partNo: "CLUTCH-001", description: "Clutch Plate Assembly", taxPercent: 28, hsnCode: "87083900", mrp: 3200, ndp: 2400, minimumStockLevel: 3 },
  ];

  const parts = [];
  for (const def of partDefs) {
    const part = await prisma.part.upsert({
      where: { tenantId_partNo: { tenantId: tenant.id, partNo: def.partNo } },
      update: {},
      create: { tenantId: tenant.id, ...def, status: MasterStatus.ACTIVE },
    });
    parts.push(part);
  }
  const [brakePad, oilFilter, airFilter, sparkPlug, clutchPlate] = parts;

  // ---- Number sequences ----
  async function nextNumber(key: string, prefix: string) {
    const seq = await prisma.numberSequence.upsert({
      where: { tenantId_sequenceKey: { tenantId: tenant.id, sequenceKey: key } },
      update: { lastValue: { increment: 1 } },
      create: { tenantId: tenant.id, sequenceKey: key, lastValue: 1 },
    });
    return `${prefix}-${String(seq.lastValue).padStart(6, "0")}`;
  }

  async function upsertInventory(partId: string, storeId: string, binId: string, rackId: string) {
    return prisma.inventory.upsert({
      where: { tenantId_partId_storeId_binId_rackId: { tenantId: tenant.id, partId, storeId, binId, rackId } },
      update: {},
      create: { tenantId: tenant.id, partId, storeId, binId, rackId, quantity: 0 },
    });
  }

  async function recordLedger(params: {
    type: StockTxnType;
    transactionNumber: string;
    partId: string;
    inventoryId: string;
    quantityChange: number;
    balanceQuantity: number;
    invoiceNumber?: string;
    reference?: string;
    purchaseId?: string;
    issueId?: string;
    returnId?: string;
    saleInvoiceId?: string;
    createdById: string;
    createdByName: string;
  }) {
    return prisma.stockLedger.create({
      data: {
        tenantId: tenant.id,
        transactionType: params.type,
        transactionNumber: params.transactionNumber,
        partId: params.partId,
        inventoryId: params.inventoryId,
        quantityChange: params.quantityChange,
        balanceQuantity: params.balanceQuantity,
        invoiceNumber: params.invoiceNumber,
        reference: params.reference,
        purchaseId: params.purchaseId,
        issueId: params.issueId,
        returnId: params.returnId,
        saleInvoiceId: params.saleInvoiceId,
        createdById: params.createdById,
        createdByName: params.createdByName,
      },
    });
  }

  const year = new Date().getFullYear();

  // ---- Sample business flow: BRK-PAD-001, purchase 10 -> issue 3 -> return 1 ----
  const inv1 = await upsertInventory(brakePad.id, mainStore.id, bin01.id, rack03.id);

  const purchaseNumber1 = await nextNumber(`PUR-${year}`, `PUR-${year}`);
  const purchase1 = await prisma.purchase.create({
    data: {
      tenantId: tenant.id,
      purchaseNumber: purchaseNumber1,
      invoiceNumber: "INV-10001",
      status: "IMPORTED",
      createdById: inventoryManager.id,
      items: {
        create: {
          partId: brakePad.id,
          inventoryId: inv1.id,
          quantity: 10,
          mrp: 5000,
          ndp: 3500,
          taxPercent: 28,
        },
      },
    },
  });
  await prisma.inventory.update({ where: { id: inv1.id }, data: { quantity: { increment: 10 } } });
  await recordLedger({
    type: "PURCHASE",
    transactionNumber: purchaseNumber1,
    partId: brakePad.id,
    inventoryId: inv1.id,
    quantityChange: 10,
    balanceQuantity: 10,
    invoiceNumber: "INV-10001",
    purchaseId: purchase1.id,
    createdById: inventoryManager.id,
    createdByName: `${inventoryManager.firstName} ${inventoryManager.lastName}`,
  });

  const issueNumber1 = await nextNumber(`ISS-${year}`, `ISS-${year}`);
  const issue1 = await prisma.issue.create({
    data: {
      tenantId: tenant.id,
      issueNumber: issueNumber1,
      reference: "JC-5521 / Maruti Swift / MH12AB1234",
      status: IssueStatus.ISSUED,
      createdById: storeUser.id,
      items: {
        create: {
          partId: brakePad.id,
          inventoryId: inv1.id,
          quantity: 3,
          mrp: 5000,
          ndp: 3500,
          taxPercent: 28,
        },
      },
    },
    include: { items: true },
  });
  await prisma.inventory.update({ where: { id: inv1.id }, data: { quantity: { decrement: 3 } } });
  await recordLedger({
    type: "ISSUE",
    transactionNumber: issueNumber1,
    partId: brakePad.id,
    inventoryId: inv1.id,
    quantityChange: -3,
    balanceQuantity: 7,
    reference: issue1.reference ?? undefined,
    issueId: issue1.id,
    createdById: storeUser.id,
    createdByName: `${storeUser.firstName} ${storeUser.lastName}`,
  });

  const returnNumber1 = await nextNumber(`RET-${year}`, `RET-${year}`);
  const return1 = await prisma.return.create({
    data: {
      tenantId: tenant.id,
      returnNumber: returnNumber1,
      issueId: issue1.id,
      remarks: "Customer changed mind on 1 unit",
      createdById: storeUser.id,
      items: {
        create: {
          issueItemId: issue1.items[0].id,
          partId: brakePad.id,
          inventoryId: inv1.id,
          quantity: 1,
        },
      },
    },
  });
  await prisma.issueItem.update({ where: { id: issue1.items[0].id }, data: { returnedQty: { increment: 1 } } });
  await prisma.issue.update({ where: { id: issue1.id }, data: { status: IssueStatus.PARTIALLY_RETURNED } });
  await prisma.inventory.update({ where: { id: inv1.id }, data: { quantity: { increment: 1 } } });
  await recordLedger({
    type: "RETURN",
    transactionNumber: returnNumber1,
    partId: brakePad.id,
    inventoryId: inv1.id,
    quantityChange: 1,
    balanceQuantity: 8,
    reference: issueNumber1,
    returnId: return1.id,
    createdById: storeUser.id,
    createdByName: `${storeUser.firstName} ${storeUser.lastName}`,
  });

  // ---- Additional stock for other parts so the dashboard looks populated ----
  const extraStock: Array<{ part: typeof oilFilter; qty: number; bin: typeof bin01; rack: typeof rack03 }> = [
    { part: oilFilter, qty: 45, bin: bin01, rack: rack03 },
    { part: airFilter, qty: 8, bin: bin02, rack: rack04 },
    { part: sparkPlug, qty: 2, bin: bin02, rack: rack04 }, // low stock (min 30)
    { part: clutchPlate, qty: 0, bin: bin01, rack: rack04 }, // out of stock
  ];

  for (const row of extraStock) {
    const inv = await upsertInventory(row.part.id, mainStore.id, row.bin.id, row.rack.id);
    if (row.qty > 0) {
      const pNum = await nextNumber(`PUR-${year}`, `PUR-${year}`);
      const purchase = await prisma.purchase.create({
        data: {
          tenantId: tenant.id,
          purchaseNumber: pNum,
          invoiceNumber: `INV-1000${extraStock.indexOf(row) + 2}`,
          status: "IMPORTED",
          createdById: inventoryManager.id,
          items: {
            create: {
              partId: row.part.id,
              inventoryId: inv.id,
              quantity: row.qty,
              mrp: row.part.mrp,
              ndp: row.part.ndp,
              taxPercent: row.part.taxPercent,
            },
          },
        },
      });
      await prisma.inventory.update({ where: { id: inv.id }, data: { quantity: { increment: row.qty } } });
      await recordLedger({
        type: "PURCHASE",
        transactionNumber: pNum,
        partId: row.part.id,
        inventoryId: inv.id,
        quantityChange: row.qty,
        balanceQuantity: row.qty,
        invoiceNumber: purchase.invoiceNumber,
        purchaseId: purchase.id,
        createdById: inventoryManager.id,
        createdByName: `${inventoryManager.firstName} ${inventoryManager.lastName}`,
      });
    }
  }

  // ---- Sample customer + completed sale/invoice ----
  const customer = await prisma.customer.upsert({
    where: { tenantId_mobile: { tenantId: tenant.id, mobile: "9876543210" } },
    update: { pincode: "141001", state: "Punjab", city: "Ludhiana" },
    create: {
      tenantId: tenant.id,
      name: "Raj Kumar",
      mobile: "9876543210",
      address: "Ludhiana, Punjab",
      pincode: "141001",
      state: "Punjab",
      city: "Ludhiana",
      gstin: "03ABCDE1234F1Z5",
    },
  });

  const oilFilterInv = await upsertInventory(oilFilter.id, mainStore.id, bin01.id, rack03.id);
  if (Number(oilFilterInv.quantity) >= 2) {
    const saleQty = 2;
    const sellingPrice = Number(oilFilter.mrp);
    const lineAmount = sellingPrice * saleQty;
    const taxAmt = Math.round(lineAmount * (Number(oilFilter.taxPercent) / 100) * 100) / 100;
    const lineTotal = Math.round((lineAmount + taxAmt) * 100) / 100;

    const invoiceNumber = await nextNumber(`INV-${year}`, `INV-${year}`);
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNumber,
        customerId: customer.id,
        status: "COMPLETED",
        subtotal: lineAmount,
        taxAmount: taxAmt,
        grandTotal: lineTotal,
        createdById: storeUser.id,
        items: {
          create: {
            partId: oilFilter.id,
            inventoryId: oilFilterInv.id,
            quantity: saleQty,
            sellingPrice,
            taxPercent: oilFilter.taxPercent,
            taxAmount: taxAmt,
            // Dealer is Haryana, customer is Punjab — inter-state sale, IGST applies.
            taxType: "IGST",
            igstAmount: taxAmt,
            lineTotal,
          },
        },
      },
    });

    const newBalance = Number(oilFilterInv.quantity) - saleQty;
    await prisma.inventory.update({ where: { id: oilFilterInv.id }, data: { quantity: newBalance } });
    await recordLedger({
      type: "SALE",
      transactionNumber: invoiceNumber,
      partId: oilFilter.id,
      inventoryId: oilFilterInv.id,
      quantityChange: -saleQty,
      balanceQuantity: newBalance,
      reference: invoiceNumber,
      saleInvoiceId: invoice.id,
      createdById: storeUser.id,
      createdByName: `${storeUser.firstName} ${storeUser.lastName}`,
    });

    console.log(`Sample invoice ${invoiceNumber} created for ${customer.name} (${customer.mobile}).`);
  }

  // ---- Audit + notification samples ----
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: tenantAdmin.id,
        userEmail: tenantAdmin.email,
        role: "TENANT_ADMIN",
        action: "LOGIN",
        entityType: "SESSION",
        ipAddress: "127.0.0.1",
      },
      {
        tenantId: tenant.id,
        userId: inventoryManager.id,
        userEmail: inventoryManager.email,
        role: "INVENTORY_MANAGER",
        action: "PURCHASE_CREATED",
        entityType: "Purchase",
        entityId: purchase1.id,
        newValue: { purchaseNumber: purchaseNumber1, invoiceNumber: "INV-10001" },
      },
      {
        tenantId: tenant.id,
        userId: storeUser.id,
        userEmail: storeUser.email,
        role: "STORE_USER",
        action: "ISSUE_CREATED",
        entityType: "Issue",
        entityId: issue1.id,
        newValue: { issueNumber: issueNumber1 },
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: tenantAdmin.id,
        type: "LOW_STOCK",
        title: "Low stock alert",
        message: `${sparkPlug.description} (${sparkPlug.partNo}) is below minimum stock level.`,
      },
      {
        tenantId: tenant.id,
        userId: tenantAdmin.id,
        type: "PURCHASE_SUCCESS",
        title: "Purchase imported",
        message: `Purchase ${purchaseNumber1} imported successfully from invoice INV-10001.`,
      },
    ],
  });

  console.log("Seed complete.");
  console.log("---------------------------------------------------");
  console.log("Super Admin login:", SUPER_ADMIN_EMAIL, "/", SUPER_ADMIN_PASSWORD);
  console.log("Demo dealer code:  DEMO001");
  console.log("Tenant Admin:      admin@demo.com /", DEMO_PASSWORD);
  console.log("Inventory Manager: inventory@demo.com /", DEMO_PASSWORD);
  console.log("Store User:        store@demo.com /", DEMO_PASSWORD);
  console.log("---------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
