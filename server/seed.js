const { db, getNextDocNumber, logAudit } = require('./db');

function seedData() {
  console.log('--- Starting Database Seeding ---');

  const seedTx = db.transaction(() => {
    // 1. Clear existing data
    db.prepare('DELETE FROM audit_logs').run();
    db.prepare('DELETE FROM stock_movements').run();
    db.prepare('DELETE FROM payments_received').run();
    db.prepare('DELETE FROM expenditures').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM quotation_items').run();
    db.prepare('DELETE FROM quotations').run();
    db.prepare('DELETE FROM purchase_items').run();
    db.prepare('DELETE FROM purchases').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM suppliers').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM businesses').run();
    db.prepare('DELETE FROM document_sequences').run();

    // 2. Business
    const businessInsert = db.prepare(`
      INSERT INTO businesses (id, name, email, phone, address, tax_number, currency, currency_symbol, timezone, date_format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    businessInsert.run(
      1,
      'Acme Trading LLC',
      'info@acmetrading.ae',
      '+971 4 398 2200',
      'Warehouse 14, Al Quoz Industrial Area 3, Dubai, UAE',
      '100293847500003', // 15-digit UAE TRN
      'AED',
      'AED',
      'Asia/Dubai',
      'DD/MM/YYYY'
    );

    // 3. User
    const userInsert = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    userInsert.run(1, 'John Doe', 'john@acmetrading.ae', 'demo_hash_bcrypt_placeholder', 'admin');

    // 4. Reset sequences
    const seqInsert = db.prepare(`
      INSERT INTO document_sequences (business_id, doc_type, prefix, next_number)
      VALUES (?, ?, ?, ?)
    `);
    seqInsert.run(1, 'INV', 'INV-', 1009);
    seqInsert.run(1, 'PUR', 'PUR-', 2007);
    seqInsert.run(1, 'QUO', 'QUO-', 3005);
    seqInsert.run(1, 'PAY', 'PAY-', 4011);
    seqInsert.run(1, 'EXP', 'EXP-', 5011);

    // 5. Suppliers (10)
    const suppliersData = [
      { name: 'Global Supplies FZCO', company: 'Global Supplies FZCO', email: 'sales@globalsupplies.ae', phone: '+971 4 881 2345', address: 'JAFZA Freezone, Dubai', tax: '100345678900003', openBal: 0 },
      { name: 'Apex Electronics Trading', company: 'Apex Electronics Trading LLC', email: 'orders@apexelectronics.com', phone: '+971 4 227 8901', address: 'Deira Wholesale Market, Dubai', tax: '100456789000003', openBal: 0 },
      { name: 'TechZone Wholesale', company: 'TechZone Middle East FZE', email: 'contact@techzone.ae', phone: '+971 6 528 9012', address: 'SAIF Zone, Sharjah', tax: '100567890100003', openBal: 0 },
      { name: 'Prime Stationery FZE', company: 'Prime Stationery & Printing FZE', email: 'info@primestationery.ae', phone: '+971 4 340 5678', address: 'Al Qusais Industrial 1, Dubai', tax: '100678901200003', openBal: 0 },
      { name: 'Metro Logistics LLC', company: 'Metro Fleet & Equipment LLC', email: 'admin@metrologistics.ae', phone: '+971 4 456 7890', address: 'Ras Al Khor Industrial 2, Dubai', tax: '100789012300003', openBal: 0 },
      { name: 'Smart Office Supplies', company: 'Smart Office Ergonomics LLC', email: 'sales@smartoffices.ae', phone: '+971 2 678 9012', address: 'Musaffah Industrial, Abu Dhabi', tax: '100890123400003', openBal: 0 },
      { name: 'National Hardware & Tools', company: 'National Tools Corp', email: 'supply@nationalhardware.ae', phone: '+971 4 269 3456', address: 'Al Khabaisi, Deira, Dubai', tax: '100901234500003', openBal: 0 },
      { name: 'Al Baraka Packaging', company: 'Al Baraka Boxes & Carton Factory', email: 'orders@albarakapack.ae', phone: '+971 6 743 2190', address: 'Ajman Industrial 2, Ajman', tax: '100112233400003', openBal: 0 },
      { name: 'Middle East Distributors', company: 'MED Distribution Group', email: 'info@medgroup.ae', phone: '+971 4 333 4455', address: 'Business Bay, Dubai', tax: '100223344500003', openBal: 0 },
      { name: 'Pioneer Imports Ltd', company: 'Pioneer Commercial Brokerage', email: 'trade@pioneerimports.com', phone: '+971 4 295 6789', address: 'Port Saeed, Deira, Dubai', tax: '100334455600003', openBal: 0 }
    ];

    const suppInsert = db.prepare(`
      INSERT INTO suppliers (business_id, name, company_name, email, phone, address, tax_number, opening_balance, outstanding_balance)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const supplierIds = [];
    for (const s of suppliersData) {
      const info = suppInsert.run(s.name, s.company, s.email, s.phone, s.address, s.tax, s.openBal, s.openBal);
      supplierIds.push(info.lastInsertRowid);
    }

    // 6. Customers (10)
    const customersData = [
      { name: 'Ahmed Al Mansoori', company: 'Al Noor Trading LLC', email: 'ahmed@alnoor.ae', phone: '+971 50 123 4567', address: 'Al Fahidi St, Bur Dubai', tax: '100998877600003', openBal: 0 },
      { name: 'David Miller', company: 'Blue Star Retail LLC', email: 'david@bluestar.ae', phone: '+971 55 234 5678', address: 'Mall of the Emirates, Dubai', tax: '100887766500003', openBal: 0 },
      { name: 'Fatima Al Zahra', company: 'Greenline Services', email: 'fatima@greenline.ae', phone: '+971 52 345 6789', address: 'Business Bay, Tower B, Dubai', tax: '100776655400003', openBal: 0 },
      { name: 'Rajesh Kumar', company: 'Horizon Mart', email: 'rajesh@horizonmart.ae', phone: '+971 56 456 7890', address: 'Karama Central Market, Dubai', tax: '100665544300003', openBal: 0 },
      { name: 'Tariq Rashid', company: 'Dubai Desert Safari LLC', email: 'tariq@desertsafari.ae', phone: '+971 50 567 8901', address: 'Al Barsha 1, Dubai', tax: '100554433200003', openBal: 0 },
      { name: 'Sarah Jenkins', company: 'Gulf Office Solutions', email: 'sarah@gulfoffice.com', phone: '+971 54 678 9012', address: 'Downtown Boulevard, Dubai', tax: '100443322100003', openBal: 0 },
      { name: 'Omar Al Suwaidi', company: 'Marina Bay Cafe', email: 'omar@marinabaycafe.ae', phone: '+971 50 789 0123', address: 'Dubai Marina Walk, Dubai', tax: '100332211000003', openBal: 0 },
      { name: 'Vikram Mehta', company: 'Emirates Tech Hub', email: 'vikram@emiratestech.ae', phone: '+971 55 890 1234', address: 'Dubai Silicon Oasis, Dubai', tax: '100221100900003', openBal: 0 },
      { name: 'Layla Hassan', company: 'Oasis Distribution LLC', email: 'layla@oasisdist.ae', phone: '+971 52 901 2345', address: 'Al Aweer Industrial, Dubai', tax: '100110099800003', openBal: 0 },
      { name: 'Khalid Al Nuaimi', company: 'Pearl General Trading', email: 'khalid@pearltrading.ae', phone: '+971 50 012 3456', address: 'Al Mina Road, Abu Dhabi', tax: '100009988700003', openBal: 0 }
    ];

    const custInsert = db.prepare(`
      INSERT INTO customers (business_id, name, company_name, email, phone, address, tax_number, opening_balance, outstanding_balance)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const customerIds = [];
    for (const c of customersData) {
      const info = custInsert.run(c.name, c.company, c.email, c.phone, c.address, c.tax, c.openBal, c.openBal);
      customerIds.push(info.lastInsertRowid);
    }

    // 7. Products (20)
    const productsData = [
      { sku: 'PRD-001', barcode: '6291001001', name: 'Wireless Keyboard & Mouse Combo', cat: 'Electronics', unit: 'sets', buy: 80, sell: 135, openStock: 50, curStock: 50, reorder: 10, tax: 5, desc: '2.4GHz Ultra-slim wireless keyboard with silent optical mouse' },
      { sku: 'PRD-002', barcode: '6291001002', name: 'USB-C Braided Fast Charging Cable (2m)', cat: 'Electronics', unit: 'pcs', buy: 15, sell: 35, openStock: 120, curStock: 120, reorder: 25, tax: 5, desc: '60W PD Fast charging nylon braided cable' },
      { sku: 'PRD-003', barcode: '6291001003', name: 'Ergonomic Mesh Office Chair', cat: 'Office Furniture', unit: 'pcs', buy: 320, sell: 550, openStock: 18, curStock: 18, reorder: 5, tax: 5, desc: 'High-back breathable mesh chair with lumbar support' },
      { sku: 'PRD-004', barcode: '6291001004', name: 'A4 Copier Paper 80GSM (Box of 5 Reams)', cat: 'Stationery', unit: 'boxes', buy: 65, sell: 110, openStock: 80, curStock: 80, reorder: 15, tax: 5, desc: 'Premium ultra-white multipurpose 80 GSM copy paper' },
      { sku: 'PRD-005', barcode: '6291001005', name: '27-inch 4K IPS Business LED Monitor', cat: 'Electronics', unit: 'pcs', buy: 750, sell: 1150, openStock: 14, curStock: 14, reorder: 4, tax: 5, desc: 'Ultra-thin bezel 4K UHD 60Hz HDR monitor with HDMI/DP' },
      { sku: 'PRD-006', barcode: '6291001006', name: 'Aluminum Laptop Stand (Adjustable)', cat: 'Computer Accessories', unit: 'pcs', buy: 45, sell: 85, openStock: 40, curStock: 40, reorder: 8, tax: 5, desc: 'Foldable ergonomic laptop riser for 11-17 inch laptops' },
      { sku: 'PRD-007', barcode: '6291001007', name: 'Noise-Cancelling Bluetooth Headset', cat: 'Electronics', unit: 'pcs', buy: 180, sell: 320, openStock: 25, curStock: 25, reorder: 6, tax: 5, desc: 'Over-ear hybrid ANC headset with 40-hour battery life' },
      { sku: 'PRD-008', barcode: '6291001008', name: 'Motorized Standing Desk Frame (Dual Motor)', cat: 'Office Furniture', unit: 'pcs', buy: 600, sell: 980, openStock: 8, curStock: 8, reorder: 3, tax: 5, desc: 'Electric height adjustable sit-stand desk base' },
      { sku: 'PRD-009', barcode: '6291001009', name: 'Gel Ink Pen 0.5mm (Pack of 12)', cat: 'Stationery', unit: 'packs', buy: 12, sell: 25, openStock: 150, curStock: 150, reorder: 30, tax: 5, desc: 'Smooth quick-drying waterproof black gel pens' },
      { sku: 'PRD-010', barcode: '6291001010', name: 'USB 3.0 7-Port Powered Hub', cat: 'Computer Accessories', unit: 'pcs', buy: 55, sell: 95, openStock: 30, curStock: 30, reorder: 8, tax: 5, desc: 'High-speed data transfer hub with individual power switches' },
      { sku: 'PRD-011', barcode: '6291001011', name: 'Magnetic Dry Erase Whiteboard 90x60cm', cat: 'Office Furniture', unit: 'pcs', buy: 75, sell: 140, openStock: 22, curStock: 22, reorder: 5, tax: 5, desc: 'Aluminum framed magnetic presentation whiteboard' },
      { sku: 'PRD-012', barcode: '6291001012', name: 'Heavy Duty Document Shredder (Cross Cut)', cat: 'Electronics', unit: 'pcs', buy: 290, sell: 460, openStock: 10, curStock: 10, reorder: 3, tax: 5, desc: '12-sheet cross cut shredder with credit card slot' },
      { sku: 'PRD-013', barcode: '6291001013', name: 'Ethernet Cable Cat6 10m', cat: 'Hardware', unit: 'pcs', buy: 18, sell: 38, openStock: 65, curStock: 65, reorder: 15, tax: 5, desc: 'High performance Gigabit RJ45 patch cord' },
      { sku: 'PRD-014', barcode: '6291001014', name: 'Smart Power Strip 6-Outlet with 4 USB', cat: 'Electronics', unit: 'pcs', buy: 50, sell: 90, openStock: 45, curStock: 45, reorder: 10, tax: 5, desc: 'Surge protector with individual timing and remote app control' },
      { sku: 'PRD-015', barcode: '6291001015', name: 'Leatherette Executive Desk Mat 80x40cm', cat: 'Office Furniture', unit: 'pcs', buy: 28, sell: 60, openStock: 50, curStock: 50, reorder: 10, tax: 5, desc: 'Waterproof non-slip dual-sided PU leather desk blotter' },
      { sku: 'PRD-016', barcode: '6291001016', name: '1080P Full HD Business Webcam', cat: 'Electronics', unit: 'pcs', buy: 95, sell: 175, openStock: 28, curStock: 28, reorder: 6, tax: 5, desc: 'Webcam with autofocus, stereo dual mics, and privacy shutter' },
      { sku: 'PRD-017', barcode: '6291001017', name: 'Thermal Receipt Paper Roll 80mm (Box 50)', cat: 'Stationery', unit: 'boxes', buy: 85, sell: 145, openStock: 35, curStock: 35, reorder: 10, tax: 5, desc: 'BPA-free high sensitivity thermal paper for POS systems' },
      { sku: 'PRD-018', barcode: '6291001018', name: 'Heavy Duty Warehouse Hand Truck / Dolly', cat: 'Hardware', unit: 'pcs', buy: 190, sell: 330, openStock: 7, curStock: 7, reorder: 3, tax: 5, desc: '200kg capacity folding steel platform trolley' },
      { sku: 'PRD-019', barcode: '6291001019', name: 'External SSD 1TB USB 3.2 Gen 2', cat: 'Computer Accessories', unit: 'pcs', buy: 260, sell: 410, openStock: 16, curStock: 16, reorder: 5, tax: 5, desc: 'Portable solid state drive up to 1050MB/s transfer speed' },
      { sku: 'PRD-020', barcode: '6291001020', name: 'Wireless Barcode Scanner (Handheld 2D)', cat: 'Electronics', unit: 'pcs', buy: 140, sell: 260, openStock: 3, curStock: 3, reorder: 5, tax: 5, desc: 'QR code & 1D/2D wireless handheld barcode reader (Low Stock demo)' }
    ];

    const prodInsert = db.prepare(`
      INSERT INTO products (business_id, sku, barcode, name, category, unit, purchase_price, selling_price, opening_stock, current_stock, reorder_level, tax_rate, description)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const productIds = [];
    for (const p of productsData) {
      const info = prodInsert.run(p.sku, p.barcode, p.name, p.cat, p.unit, p.buy, p.sell, p.openStock, p.curStock, p.reorder, p.tax, p.desc);
      productIds.push(info.lastInsertRowid);

      // Log initial stock movement
      db.prepare(`
        INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
        VALUES (1, ?, '2026-01-01', 'OPENING', 'INITIAL', 'INIT', ?, ?, 'Initial inventory balance')
      `).run(info.lastInsertRowid, p.openStock, p.buy);
    }

    // 8. Seed Purchases (6 records across Jan - Aug 2026)
    const purchasesData = [
      {
        num: 'PUR-002001', date: '2026-06-10', suppIdx: 0, ref: 'PO-9812', terms: 'Net 30', status: 'Received', payStatus: 'Paid',
        items: [
          { prodIdx: 0, qty: 30, rate: 80, disc: 0, tax: 5 },
          { prodIdx: 1, qty: 50, rate: 15, disc: 0, tax: 5 }
        ],
        paid: 3307.5
      },
      {
        num: 'PUR-002002', date: '2026-07-05', suppIdx: 1, ref: 'PO-9840', terms: 'Net 15', status: 'Received', payStatus: 'Paid',
        items: [
          { prodIdx: 4, qty: 10, rate: 750, disc: 200, tax: 5 },
          { prodIdx: 6, qty: 15, rate: 180, disc: 0, tax: 5 }
        ],
        paid: 10500
      },
      {
        num: 'PUR-002003', date: '2026-07-22', suppIdx: 3, ref: 'PO-9889', terms: 'Due on Receipt', status: 'Received', payStatus: 'Paid',
        items: [
          { prodIdx: 3, qty: 40, rate: 65, disc: 0, tax: 5 },
          { prodIdx: 8, qty: 50, rate: 12, disc: 0, tax: 5 }
        ],
        paid: 3360
      },
      {
        num: 'PUR-002004', date: '2026-08-02', suppIdx: 5, ref: 'PO-9912', terms: 'Net 30', status: 'Received', payStatus: 'Partially Paid',
        items: [
          { prodIdx: 2, qty: 10, rate: 320, disc: 100, tax: 5 },
          { prodIdx: 7, qty: 5, rate: 600, disc: 0, tax: 5 }
        ],
        paid: 3000
      },
      {
        num: 'PUR-002005', date: '2026-08-14', suppIdx: 2, ref: 'PO-9945', terms: 'Net 30', status: 'Received', payStatus: 'Pending',
        items: [
          { prodIdx: 9, qty: 20, rate: 55, disc: 0, tax: 5 },
          { prodIdx: 18, qty: 10, rate: 260, disc: 0, tax: 5 }
        ],
        paid: 0
      },
      {
        num: 'PUR-002006', date: '2026-08-19', suppIdx: 6, ref: 'PO-9980', terms: 'Due on Receipt', status: 'Draft', payStatus: 'Pending',
        items: [
          { prodIdx: 12, qty: 30, rate: 18, disc: 0, tax: 5 },
          { prodIdx: 17, qty: 4, rate: 190, disc: 0, tax: 5 }
        ],
        paid: 0
      }
    ];

    for (const p of purchasesData) {
      let subtotal = 0;
      let totalDisc = 0;
      let totalTax = 0;

      const preparedItems = p.items.map(item => {
        const lineSub = item.qty * item.rate;
        const lineDisc = item.disc || 0;
        const lineTaxable = lineSub - lineDisc;
        const lineTax = (lineTaxable * item.tax) / 100;
        const lineTotal = lineTaxable + lineTax;

        subtotal += lineSub;
        totalDisc += lineDisc;
        totalTax += lineTax;

        return {
          productId: productIds[item.prodIdx],
          qty: item.qty,
          rate: item.rate,
          discount: lineDisc,
          taxRate: item.tax,
          amount: lineTotal
        };
      });

      const grandTotal = subtotal - totalDisc + totalTax;
      const balance = Math.max(0, grandTotal - p.paid);

      const res = db.prepare(`
        INSERT INTO purchases (business_id, supplier_id, purchase_number, purchase_date, reference_number, payment_terms, subtotal, discount, tax, total, paid_amount, balance, payment_status, status, notes)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(supplierIds[p.suppIdx], p.num, p.date, p.ref, p.terms, subtotal, totalDisc, totalTax, grandTotal, p.paid, balance, p.payStatus, p.status, 'Standard stock replenishment order');

      const purchaseId = res.lastInsertRowid;

      for (const item of preparedItems) {
        db.prepare(`
          INSERT INTO purchase_items (purchase_id, product_id, description, quantity, rate, discount, tax_rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(purchaseId, item.productId, 'Item replenishment', item.qty, item.rate, item.discount, item.taxRate, item.amount);

        // If received, increase stock and log movement
        if (p.status === 'Received') {
          db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(item.qty, item.productId);
          db.prepare(`
            INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
            VALUES (1, ?, ?, 'PURCHASE', 'PURCHASE', ?, ?, ?, 'Supplier purchase order')
          `).run(item.productId, p.date, p.num, item.qty, item.rate);
        }
      }

      // Update supplier balance
      db.prepare('UPDATE suppliers SET outstanding_balance = outstanding_balance + ? WHERE id = ?').run(balance, supplierIds[p.suppIdx]);
    }

    // 9. Quotations (4 records)
    const quotationsData = [
      {
        num: 'QUO-003001', date: '2026-08-01', validUntil: '2026-08-31', custIdx: 0, ref: 'RFQ-881', status: 'Converted',
        items: [
          { prodIdx: 0, qty: 10, rate: 135, disc: 50, tax: 5 },
          { prodIdx: 4, qty: 2, rate: 1150, disc: 0, tax: 5 }
        ]
      },
      {
        num: 'QUO-003002', date: '2026-08-05', validUntil: '2026-09-05', custIdx: 1, ref: 'RFQ-892', status: 'Accepted',
        items: [
          { prodIdx: 2, qty: 6, rate: 550, disc: 100, tax: 5 },
          { prodIdx: 7, qty: 3, rate: 980, disc: 150, tax: 5 }
        ]
      },
      {
        num: 'QUO-003003', date: '2026-08-15', validUntil: '2026-09-15', custIdx: 2, ref: 'RFQ-903', status: 'Sent',
        items: [
          { prodIdx: 5, qty: 15, rate: 85, disc: 0, tax: 5 },
          { prodIdx: 6, qty: 8, rate: 320, disc: 60, tax: 5 }
        ]
      },
      {
        num: 'QUO-003004', date: '2026-08-20', validUntil: '2026-09-20', custIdx: 3, ref: 'RFQ-914', status: 'Draft',
        items: [
          { prodIdx: 11, qty: 2, rate: 460, disc: 0, tax: 5 },
          { prodIdx: 14, qty: 10, rate: 60, disc: 0, tax: 5 }
        ]
      }
    ];

    const quoteIds = [];
    for (const q of quotationsData) {
      let subtotal = 0;
      let totalDisc = 0;
      let totalTax = 0;

      const prepItems = q.items.map(item => {
        const lSub = item.qty * item.rate;
        const lDisc = item.disc || 0;
        const lTaxable = lSub - lDisc;
        const lTax = (lTaxable * item.tax) / 100;
        const lTotal = lTaxable + lTax;

        subtotal += lSub;
        totalDisc += lDisc;
        totalTax += lTax;

        return {
          productId: productIds[item.prodIdx],
          qty: item.qty,
          rate: item.rate,
          discount: lDisc,
          taxRate: item.tax,
          amount: lTotal
        };
      });

      const grandTotal = subtotal - totalDisc + totalTax;

      const res = db.prepare(`
        INSERT INTO quotations (business_id, customer_id, quotation_number, quotation_date, valid_until, reference_number, subtotal, discount, tax, total, status, notes, terms)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Valid for 30 days. Standard UAE warranty included.', 'Payment 50% advance, 50% on delivery.')
      `).run(customerIds[q.custIdx], q.num, q.date, q.validUntil, q.ref, subtotal, totalDisc, totalTax, grandTotal, q.status);

      quoteIds.push(res.lastInsertRowid);

      for (const item of prepItems) {
        db.prepare(`
          INSERT INTO quotation_items (quotation_id, product_id, description, quantity, rate, discount, tax_rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(res.lastInsertRowid, item.productId, 'Quotation line item', item.qty, item.rate, item.discount, item.taxRate, item.amount);
      }
    }

    // 10. Sales / Invoices (8 records across May - Aug 2026)
    const salesData = [
      {
        num: 'INV-001001', date: '2026-07-02', due: '2026-07-17', custIdx: 0, quoId: quoteIds[0], ref: 'PO-ALN-101', status: 'Active', payStatus: 'Paid', method: 'Bank Transfer',
        items: [
          { prodIdx: 0, qty: 10, rate: 135, disc: 50, tax: 5 },
          { prodIdx: 4, qty: 2, rate: 1150, disc: 0, tax: 5 }
        ],
        paid: 3780
      },
      {
        num: 'INV-001002', date: '2026-07-15', due: '2026-07-30', custIdx: 1, quoId: null, ref: 'PO-BST-202', status: 'Active', payStatus: 'Paid', method: 'Card',
        items: [
          { prodIdx: 1, qty: 30, rate: 35, disc: 0, tax: 5 },
          { prodIdx: 9, qty: 10, rate: 95, disc: 50, tax: 5 }
        ],
        paid: 2047.5
      },
      {
        num: 'INV-001003', date: '2026-07-28', due: '2026-08-12', custIdx: 3, quoId: null, ref: 'PO-HRZ-303', status: 'Active', payStatus: 'Paid', method: 'Bank Transfer',
        items: [
          { prodIdx: 3, qty: 20, rate: 110, disc: 100, tax: 5 },
          { prodIdx: 8, qty: 40, rate: 25, disc: 0, tax: 5 }
        ],
        paid: 3255
      },
      {
        num: 'INV-001004', date: '2026-08-03', due: '2026-08-18', custIdx: 4, quoId: null, ref: 'PO-DDS-404', status: 'Active', payStatus: 'Partially Paid', method: 'Cheque',
        items: [
          { prodIdx: 2, qty: 4, rate: 550, disc: 0, tax: 5 },
          { prodIdx: 5, qty: 8, rate: 85, disc: 40, tax: 5 }
        ],
        paid: 1500
      },
      {
        num: 'INV-001005', date: '2026-08-08', due: '2026-08-23', custIdx: 5, quoId: null, ref: 'PO-GOS-505', status: 'Active', payStatus: 'Paid', method: 'Bank Transfer',
        items: [
          { prodIdx: 7, qty: 3, rate: 980, disc: 140, tax: 5 },
          { prodIdx: 10, qty: 5, rate: 140, disc: 0, tax: 5 }
        ],
        paid: 3675
      },
      {
        num: 'INV-001006', date: '2026-08-12', due: '2026-08-27', custIdx: 6, quoId: null, ref: 'PO-MBC-606', status: 'Active', payStatus: 'Pending', method: null,
        items: [
          { prodIdx: 15, qty: 6, rate: 175, disc: 50, tax: 5 },
          { prodIdx: 16, qty: 10, rate: 145, disc: 0, tax: 5 }
        ],
        paid: 0
      },
      {
        num: 'INV-001007', date: '2026-07-20', due: '2026-08-04', custIdx: 7, quoId: null, ref: 'PO-ETH-707', status: 'Active', payStatus: 'Overdue', method: null,
        items: [
          { prodIdx: 18, qty: 5, rate: 410, disc: 50, tax: 5 },
          { prodIdx: 13, qty: 8, rate: 90, disc: 0, tax: 5 }
        ],
        paid: 0
      },
      {
        num: 'INV-001008', date: '2026-08-20', due: '2026-09-04', custIdx: 8, quoId: null, ref: 'PO-OAS-808', status: 'Active', payStatus: 'Pending', method: null,
        items: [
          { prodIdx: 0, qty: 4, rate: 135, disc: 0, tax: 5 },
          { prodIdx: 6, qty: 3, rate: 320, disc: 0, tax: 5 }
        ],
        paid: 0
      }
    ];

    const saleIds = [];
    for (const s of salesData) {
      let subtotal = 0;
      let totalDisc = 0;
      let totalTax = 0;

      const prepItems = s.items.map(item => {
        const lSub = item.qty * item.rate;
        const lDisc = item.disc || 0;
        const lTaxable = lSub - lDisc;
        const lTax = (lTaxable * item.tax) / 100;
        const lTotal = lTaxable + lTax;

        subtotal += lSub;
        totalDisc += lDisc;
        totalTax += lTax;

        return {
          productId: productIds[item.prodIdx],
          qty: item.qty,
          rate: item.rate,
          discount: lDisc,
          taxRate: item.tax,
          amount: lTotal
        };
      });

      const grandTotal = subtotal - totalDisc + totalTax;
      const balance = Math.max(0, grandTotal - s.paid);

      const res = db.prepare(`
        INSERT INTO sales (business_id, customer_id, quotation_id, invoice_number, invoice_date, due_date, reference_number, subtotal, discount, tax, total, paid_amount, balance, payment_status, status, payment_method, notes, terms)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Thank you for your business. Please make payments via bank transfer or cheque.', 'Payment is due within invoice terms. Goods once sold are covered by standard manufacturer warranty.')
      `).run(customerIds[s.custIdx], s.quoId, s.num, s.date, s.due, s.ref, subtotal, totalDisc, totalTax, grandTotal, s.paid, balance, s.payStatus, s.status, s.method);

      const saleId = res.lastInsertRowid;
      saleIds.push(saleId);

      for (const item of prepItems) {
        db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, description, quantity, rate, discount, tax_rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, item.productId, 'Product sale delivery', item.qty, item.rate, item.discount, item.taxRate, item.amount);

        // Decrease stock and log movement
        db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ?').run(item.qty, item.productId);
        db.prepare(`
          INSERT INTO stock_movements (business_id, product_id, movement_date, movement_type, reference_type, reference_id, quantity, unit_cost, notes)
          VALUES (1, ?, ?, 'SALE', 'SALE', ?, ?, ?, 'Customer invoice sale')
        `).run(item.productId, s.date, s.num, -item.qty, item.rate);
      }

      // If initial payment was made, record payment entry
      if (s.paid > 0) {
        const payNum = `PAY-00${4000 + saleIds.length}`;
        db.prepare(`
          INSERT INTO payments_received (business_id, customer_id, sale_id, payment_number, payment_date, amount, payment_method, reference_number, notes)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'Initial invoice settlement')
        `).run(customerIds[s.custIdx], saleId, payNum, s.date, s.paid, s.method || 'Bank Transfer', `REF-${s.num}`);
      }

      // Update customer balance
      db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?').run(balance, customerIds[s.custIdx]);
    }

    // 11. Additional Standalone Payments Received
    // Add extra payment record for customer 4 (partially paid invoice)
    const extraPayment = db.prepare(`
      INSERT INTO payments_received (business_id, customer_id, sale_id, payment_number, payment_date, amount, payment_method, reference_number, notes)
      VALUES (1, ?, ?, 'PAY-004009', '2026-08-16', 500, 'Cash', 'RCPT-1044', 'Installment cash receipt')
    `).run(customerIds[4], saleIds[3]);

    // Update sale 3 (INV-001004)
    db.prepare(`
      UPDATE sales
      SET paid_amount = paid_amount + 500,
          balance = balance - 500
      WHERE id = ?
    `).run(saleIds[3]);
    db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance - 500 WHERE id = ?').run(customerIds[4]);

    // 12. Expenditures (12 realistic business expenses in 2026)
    const expensesData = [
      { num: 'EXP-005001', date: '2026-07-01', cat: 'Rent', desc: 'Commercial Warehouse Q3 Lease Payment', vendor: 'Wasl Properties PJSC', amount: 15000, tax: 750, method: 'Bank Transfer', ref: 'CHQ-89012' },
      { num: 'EXP-005002', date: '2026-07-05', cat: 'Utilities', desc: 'DEWA Monthly Electricity & Water Bill (June)', vendor: 'Dubai Electricity & Water Authority (DEWA)', amount: 1850, tax: 92.5, method: 'Card', ref: 'DEWA-883921' },
      { num: 'EXP-005003', date: '2026-07-28', cat: 'Salaries', desc: 'Staff Payroll July 2026 (WPS Transfer)', vendor: 'Emirates NBD Payroll Services', amount: 24000, tax: 0, method: 'Bank Transfer', ref: 'WPS-JUL26' },
      { num: 'EXP-005004', date: '2026-08-01', cat: 'Marketing', desc: 'Google Ads & Meta Social Media Campaign', vendor: 'Google Ireland / Meta Ads', amount: 2400, tax: 120, method: 'Card', ref: 'TXN-GADS-881' },
      { num: 'EXP-005005', date: '2026-08-04', cat: 'Software', desc: 'SaaS Tooling (Zoho, Slack, GitHub, Cloud)', vendor: 'Zoho Corporation / AWS Cloud', amount: 1150, tax: 57.5, method: 'Card', ref: 'INV-CLOUD-992' },
      { num: 'EXP-005006', date: '2026-08-07', cat: 'Transportation', desc: 'Delivery Fleet Fuel & Salik Toll Top-up', vendor: 'ENOC / Salik Dubai', amount: 920, tax: 46, method: 'Card', ref: 'ENOC-CARD-44' },
      { num: 'EXP-005007', date: '2026-08-10', cat: 'Office Supplies', desc: 'Pantry refreshments, coffee pods & cleaning supplies', vendor: 'Carrefour UAE', amount: 480, tax: 24, method: 'Cash', ref: 'REC-CRF-901' },
      { num: 'EXP-005008', date: '2026-08-14', cat: 'Maintenance', desc: 'Forklift preventive maintenance and AC servicing', vendor: 'Al Futtaim Engineering', amount: 1250, tax: 62.5, method: 'Cheque', ref: 'CHQ-89045' },
      { num: 'EXP-005009', date: '2026-08-18', cat: 'Travel', desc: 'Client meeting transportation & parking', vendor: 'Careem / Dubai RTA', amount: 310, tax: 15.5, method: 'Card', ref: 'CRM-TRIP-77' },
      { num: 'EXP-005010', date: '2026-08-20', cat: 'Software', desc: 'Accounting & Invoicing domain renewal', vendor: 'Namecheap / Cloudflare', amount: 180, tax: 9, method: 'Card', ref: 'DOM-RENEW-26' }
    ];

    const expInsert = db.prepare(`
      INSERT INTO expenditures (business_id, expense_number, expense_date, category, description, vendor, amount, tax, payment_method, reference_number, notes, status)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Standard business operating expenditure', 'Paid')
    `);

    for (const exp of expensesData) {
      expInsert.run(exp.num, exp.date, exp.cat, exp.desc, exp.vendor, exp.amount, exp.tax, exp.method, exp.ref);
    }

    // 13. Audit logs for sample setup
    logAudit(db, { businessId: 1, userId: 1, action: 'CREATE', entityType: 'SYSTEM', entityId: 'INIT', newValues: { message: 'Database initialized and seeded with 2026 demo company data' } });

    console.log('--- Database Seeding Completed Successfully! ---');
  });

  seedTx();
}

if (require.main === module) {
  seedData();
}

module.exports = { seedData };
