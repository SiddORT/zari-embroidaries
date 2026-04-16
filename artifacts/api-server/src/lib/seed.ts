import { eq, sql } from "drizzle-orm";
import { db, pool, usersTable, styleCategoriesTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const ADMIN_EMAIL = "admin@zarierp.com";
const ADMIN_PASSWORD = "Admin@123";

export async function seedAdminUser(): Promise<void> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing) {
    return;
  }

  await db.insert(usersTable).values({
    username: "admin",
    email: ADMIN_EMAIL,
    hashedPassword: hashPassword(ADMIN_PASSWORD),
    role: "admin",
    isActive: true,
  });

  logger.info("Default admin user created: admin@zarierp.com");
}

export async function seedDummyData(): Promise<void> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(styleCategoriesTable);

  if (Number(row?.count ?? 0) > 0) {
    return;
  }

  logger.info("Seeding dummy data...");

  const statements = [
    `INSERT INTO style_categories (category_name, is_active, is_deleted, created_by) VALUES
      ('Saree',    true, false, 'admin'),
      ('Lehenga',  true, false, 'admin'),
      ('Kurti',    true, false, 'admin'),
      ('Dupatta',  true, false, 'admin'),
      ('Blouse',   true, false, 'admin'),
      ('Suit Set', true, false, 'admin'),
      ('Dress',    true, false, 'admin'),
      ('Anarkali', true, false, 'admin')
    ON CONFLICT (category_name) DO NOTHING`,

    `INSERT INTO vendors (vendor_code, brand_name, contact_name, email, contact_no, country, has_gst, gst_no, address1, city, state, pincode, is_active, is_deleted, created_by) VALUES
      ('VND-001', 'Silk Route Textiles', 'Ramesh Kumar',  'ramesh@silkroute.com',    '9876543210', 'India', true,  '27AABCS1234A1Z5', 'Shop 12, Surat Textile Market', 'Surat',    'Gujarat',       '395002', true, false, 'admin'),
      ('VND-002', 'Golden Thread Co.',   'Priya Mehta',   'priya@goldenthread.in',   '9123456780', 'India', true,  '09AABCG5678B2Z3', 'Plot 44, Embroidery Zone',      'Delhi',    'Delhi',         '110006', true, false, 'admin'),
      ('VND-003', 'Banaras Silk House',  'Suresh Gupta',  'suresh@banarassilk.com',  '9988776655', 'India', true,  '09AABCB9012C3Z1', 'Chowk Market, Varanasi',        'Varanasi', 'Uttar Pradesh', '221001', true, false, 'admin'),
      ('VND-004', 'Jaipur Print Works',  'Anita Sharma',  'anita@jaipurprint.in',    '9870001122', 'India', false, NULL,               'MI Road, Block 7',              'Jaipur',   'Rajasthan',     '302001', true, false, 'admin'),
      ('VND-005', 'Mumbai Zari Works',   'Deepak Patel',  'deepak@mumbaizari.com',   '9811223344', 'India', true,  '27AABCM3456D4Z2', 'Dharavi Textile Hub',           'Mumbai',   'Maharashtra',   '400017', true, false, 'admin'),
      ('VND-006', 'Chennai Lace House',  'Kavitha Nair',  'kavitha@chennaince.in',   '9944556677', 'India', false, NULL,               'T. Nagar, Row 3',               'Chennai',  'Tamil Nadu',    '600017', true, false, 'admin')
    ON CONFLICT (vendor_code) DO NOTHING`,

    `INSERT INTO clients (client_code, brand_name, contact_name, email, contact_no, country, country_of_origin, has_gst, gst_no, address1, city, state, pincode, is_active, is_deleted, created_by) VALUES
      ('CLI-001', 'House of Amore',   'Aisha Bhatia',  'aisha@houseofamore.com',  '9871112233', 'India', 'India',  true,  '07AABCH1234A1Z5', '23 Fashion Street',     'Delhi',     'Delhi',       '110001', true, false, 'admin'),
      ('CLI-002', 'Vera Couture',     'Veena Rao',     'veena@veracouture.in',    '9982233445', 'India', 'India',  false, NULL,               '14 MG Road',            'Bangalore', 'Karnataka',   '560001', true, false, 'admin'),
      ('CLI-003', 'Nila Threads',     'Nila Krishnan', 'nila@nilathreads.com',    '9771234567', 'India', 'India',  true,  '33AABCN5678B2Z3', 'Anna Salai Shop 9',     'Chennai',   'Tamil Nadu',  '600002', true, false, 'admin'),
      ('CLI-004', 'Meera Bespoke',    'Meera Joshi',   'meera@meerabespoke.com',  '9661234567', 'India', 'India',  false, NULL,               'Bandra West Row 5',     'Mumbai',    'Maharashtra', '400050', true, false, 'admin'),
      ('CLI-005', 'Elara Fashion',    'Elyn DSilva',   'elyn@elarafashion.in',    '9541234567', 'India', 'India',  true,  '27AABCE9012C3Z1', 'Parel Unit 12',         'Mumbai',    'Maharashtra', '400012', true, false, 'admin'),
      ('CLI-006', 'Sanskriti Labels', 'Sangeeta Verma','sangeeta@sanskriti.in',   '9431234567', 'India', 'India',  true,  '07AABCS3456D4Z2', 'Connaught Place B-8',   'Delhi',     'Delhi',       '110001', true, false, 'admin'),
      ('CLI-007', 'Ruhani Couture',   'Ruhi Kapoor',   'ruhi@ruhanicouture.com',  '9321234567', 'India', 'UAE',    false, NULL,               '212 Palm Jumeirah',     'Dubai',     'Dubai',       '00000',  true, false, 'admin'),
      ('CLI-008', 'Mira Atelier',     'Mira Singh',    'mira@miraatelier.in',     '9211234567', 'India', 'India',  true,  '08AABCM7890E5Z3', 'Park Street Suite 6',   'Kolkata',   'West Bengal', '700016', true, false, 'admin'),
      ('CLI-009', 'Aria Handloom',    'Aruna Pillai',  'aruna@ariahandloom.com',  '9101234567', 'India', 'India',  false, NULL,               'MG Road Ernakulam',     'Kochi',     'Kerala',      '682016', true, false, 'admin'),
      ('CLI-010', 'Zoya Designs',     'Zoya Hussain',  'zoya@zoyadesigns.in',     '9001234567', 'India', 'India',  true,  '06AABCZ1234F6Z1', 'Sector 29 Cyber City',  'Gurugram',  'Haryana',     '122001', true, false, 'admin')
    ON CONFLICT (client_code) DO NOTHING`,

    `INSERT INTO fabrics (fabric_code, fabric_type, quality, color, hex_code, color_name, width, width_unit_type, price_per_meter, unit_type, current_stock, hsn_code, gst_percent, vendor, location, is_active, is_deleted, created_by) VALUES
      ('FAB-001', 'Banarasi Silk',  'Premium',  '#F5E6C8', '#F5E6C8', 'Ivory Gold',      '44', 'inch', '850',  'meter', '120', '50072100', '5',  'Banaras Silk House',  'Shelf A1', true, false, 'admin'),
      ('FAB-002', 'Chanderi Silk',  'Standard', '#E8D5B7', '#E8D5B7', 'Champagne Beige', '42', 'inch', '620',  'meter', '85',  '50072100', '5',  'Silk Route Textiles', 'Shelf A2', true, false, 'admin'),
      ('FAB-003', 'Georgette',      'Premium',  '#FFFFFF', '#FFFFFF', 'Pure White',      '44', 'inch', '280',  'meter', '200', '54075100', '12', 'Mumbai Zari Works',   'Shelf B1', true, false, 'admin'),
      ('FAB-004', 'Crepe',          'Standard', '#2C2C2C', '#2C2C2C', 'Jet Black',       '44', 'inch', '320',  'meter', '150', '54075100', '12', 'Mumbai Zari Works',   'Shelf B2', true, false, 'admin'),
      ('FAB-005', 'Net Fabric',     'Standard', '#FAF0E6', '#FAF0E6', 'Linen White',     '54', 'inch', '180',  'meter', '300', '54041000', '12', 'Silk Route Textiles', 'Shelf C1', true, false, 'admin'),
      ('FAB-006', 'Katan Silk',     'Premium',  '#D4AF37', '#D4AF37', 'Gold',            '42', 'inch', '1200', 'meter', '60',  '50072100', '5',  'Banaras Silk House',  'Shelf A3', true, false, 'admin'),
      ('FAB-007', 'Cotton Muslin',  'Basic',    '#F5F5DC', '#F5F5DC', 'Natural',         '36', 'inch', '120',  'meter', '400', '52081200', '5',  'Jaipur Print Works',  'Shelf D1', true, false, 'admin'),
      ('FAB-008', 'Organza',        'Premium',  '#E6E6FA', '#E6E6FA', 'Lavender Frost',  '44', 'inch', '420',  'meter', '95',  '54041000', '12', 'Mumbai Zari Works',   'Shelf B3', true, false, 'admin')
    ON CONFLICT (fabric_code) DO NOTHING`,

    `INSERT INTO materials (material_code, item_type, quality, type, color, hex_code, color_name, size, unit_price, unit_type, current_stock, hsn_code, gst_percent, vendor, location, is_active, is_deleted, created_by) VALUES
      ('MAT-001', 'Zari Thread',       'Premium',  'Gold Zari',    '#D4AF37', '#D4AF37', 'Antique Gold',  '1kg spool',  '2400', 'spool',  '48',  '56010000', '12', 'Mumbai Zari Works',  'Rack 1A', true, false, 'admin'),
      ('MAT-002', 'Sequins',           'Standard', 'Round',        '#C0C0C0', '#C0C0C0', 'Silver',        '3mm',        '180',  'packet', '120', '56012200', '18', 'Golden Thread Co.',  'Rack 2A', true, false, 'admin'),
      ('MAT-003', 'Beads',             'Premium',  'Crystal',      '#E8E8E8', '#E8E8E8', 'Crystal Clear', '4mm',        '350',  'packet', '80',  '70181000', '18', 'Golden Thread Co.',  'Rack 2B', true, false, 'admin'),
      ('MAT-004', 'Embroidery Thread', 'Standard', 'Silk',         '#C6AF4B', '#C6AF4B', 'Golden Yellow', '200m spool', '65',   'spool',  '250', '56010000', '5',  'Mumbai Zari Works',  'Rack 1B', true, false, 'admin'),
      ('MAT-005', 'Buttons',           'Premium',  'Pearl',        '#F8F8FF', '#F8F8FF', 'Pearl White',   '12mm',       '12',   'piece',  '500', '96062100', '18', 'Chennai Lace House', 'Rack 3A', true, false, 'admin'),
      ('MAT-006', 'Lace Trim',         'Premium',  'Crochet',      '#FFFAF0', '#FFFAF0', 'Ivory',         '1inch wide', '85',   'meter',  '180', '58080000', '12', 'Chennai Lace House', 'Rack 3B', true, false, 'admin'),
      ('MAT-007', 'Mirror Work',       'Standard', 'Round Mirror', '#C0C0C0', '#C0C0C0', 'Silver',        '1inch',      '8',    'piece',  '1000','70099900', '18', 'Jaipur Print Works', 'Rack 4A', true, false, 'admin'),
      ('MAT-008', 'Piping Cord',       'Standard', 'Cotton',       '#E0E0E0', '#E0E0E0', 'Off White',     '4mm',        '22',   'meter',  '300', '56049000', '12', 'Mumbai Zari Works',  'Rack 1C', true, false, 'admin')
    ON CONFLICT (material_code) DO NOTHING`,

    `INSERT INTO styles (client, style_no, invoice_no, description, style_category, is_active, is_deleted, created_by) VALUES
      ('House of Amore',   'STY-HAM-001', 'INV-2024-001', 'Bridal Banarasi Lehenga with Zari Work',           'Lehenga',  true, false, 'admin'),
      ('Vera Couture',     'STY-VER-001', NULL,            'Contemporary Georgette Saree with Printed Border', 'Saree',    true, false, 'admin'),
      ('Nila Threads',     'STY-NIL-001', 'INV-2024-003', 'Designer Chanderi Kurti with Hand Embroidery',     'Kurti',    true, false, 'admin'),
      ('Meera Bespoke',    'STY-MEE-001', NULL,            'Party Wear Anarkali with Sequin Border',            'Anarkali', true, false, 'admin'),
      ('Elara Fashion',    'STY-ELA-001', 'INV-2024-005', 'Floral Organza Dupatta with Lace Border',          'Dupatta',  true, false, 'admin'),
      ('Sanskriti Labels', 'STY-SAN-001', NULL,            'Classic Cotton Suit Set with Block Print',          'Suit Set', true, false, 'admin'),
      ('Ruhani Couture',   'STY-RUH-001', 'INV-2024-007', 'Luxury Katan Silk Blouse with Zari Motifs',        'Blouse',   true, false, 'admin'),
      ('Mira Atelier',     'STY-MIR-001', NULL,            'Contemporary Silk Dress with Mirror Embellishment', 'Dress',    true, false, 'admin')
    ON CONFLICT DO NOTHING`,

    `INSERT INTO swatch_orders (order_code, swatch_name, client_id, client_name, is_chargeable, quantity, priority, order_status, fabric_id, fabric_name, has_lining, unit_length, unit_width, unit_type, order_issue_date, delivery_date, target_hours, issued_to, department, description, is_deleted, created_by) VALUES
      ('ZSW-0101', 'Ivory Banarasi Swatch',      '1',  'House of Amore',   false, '3',  'High',   'Completed',   '1', 'Banarasi Silk',  false, '45', '36', 'cm', '2026-01-05', '2026-01-15', '8',  'Priya',  'Sampling', 'Bridal collection swatch test',                 false, 'admin'),
      ('ZSW-0102', 'Champagne Georgette Swatch', '2',  'Vera Couture',     true,  '5',  'Medium', 'Completed',   '3', 'Georgette',      false, '50', '44', 'cm', '2026-01-10', '2026-01-20', '6',  'Ravi',   'Sampling', 'Season 2 georgette drape test',                 false, 'admin'),
      ('ZSW-0103', 'Black Crepe Swatch',         '3',  'Nila Threads',     false, '2',  'Low',    'Completed',   '4', 'Crepe',          true,  '40', '36', 'cm', '2026-01-15', '2026-01-25', '4',  'Sneha',  'Sampling', 'Winter crepe series test',                      false, 'admin'),
      ('ZSW-0104', 'Net Overlay Swatch',         '4',  'Meera Bespoke',    false, '4',  'Urgent', 'In Progress', '5', 'Net Fabric',     true,  '60', '44', 'cm', '2026-02-01', '2026-02-10', '10', 'Priya',  'Sampling', 'Evening wear net test piece',                   false, 'admin'),
      ('ZSW-0105', 'Gold Katan Swatch',          '5',  'Elara Fashion',    true,  '2',  'High',   'In Progress', '6', 'Katan Silk',     false, '45', '36', 'cm', '2026-02-10', '2026-02-20', '8',  'Ravi',   'Sampling', 'Heritage katan for festive line',               false, 'admin'),
      ('ZSW-0106', 'Chanderi Embroidery Swatch', '6',  'Sanskriti Labels', false, '3',  'Medium', 'Issued',      '2', 'Chanderi Silk',  false, '50', '42', 'cm', '2026-02-15', '2026-02-28', '6',  'Sneha',  'Sampling', 'Hand embroidery test on chanderi',              false, 'admin'),
      ('ZSW-0107', 'Lavender Organza Swatch',    '7',  'Ruhani Couture',   true,  '5',  'Medium', 'Issued',      '8', 'Organza',        true,  '45', '44', 'cm', '2026-03-01', '2026-03-15', '5',  'Priya',  'Sampling', 'Sheer overlay with lace trim test',             false, 'admin'),
      ('ZSW-0108', 'Cotton Block Print Swatch',  '9',  'Aria Handloom',    false, '6',  'Low',    'Draft',       '7', 'Cotton Muslin',  false, '55', '36', 'cm', '2026-03-10', '2026-03-20', '4',  'Ravi',   'Sampling', 'Block print repeat test for summer collection', false, 'admin'),
      ('ZSW-0109', 'Sequin Net Swatch',          '4',  'Meera Bespoke',    true,  '3',  'High',   'In Progress', '5', 'Net Fabric',     false, '40', '44', 'cm', '2026-03-15', '2026-03-25', '8',  'Sneha',  'Sampling', 'Party wear sequin scatter test',                false, 'admin'),
      ('ZSW-0110', 'Mirror Work Cotton Swatch',  '10', 'Zoya Designs',     false, '4',  'Medium', 'Draft',       '7', 'Cotton Muslin',  false, '50', '36', 'cm', '2026-03-20', '2026-03-30', '6',  'Priya',  'Sampling', 'Rajasthani mirror work placement test',         false, 'admin'),
      ('ZSW-0111', 'Ivory Georgette Swatch',     '1',  'House of Amore',   false, '2',  'High',   'Issued',      '3', 'Georgette',      true,  '45', '44', 'cm', '2026-04-01', '2026-04-10', '6',  'Ravi',   'Sampling', 'Ivory drape with gold zari border',             false, 'admin'),
      ('ZSW-0112', 'Embroidered Silk Swatch',    '8',  'Mira Atelier',     true,  '3',  'Urgent', 'Issued',      '1', 'Banarasi Silk',  false, '50', '36', 'cm', '2026-04-05', '2026-04-15', '10', 'Sneha',  'Sampling', 'Heritage hand embroidery on banarasi',          false, 'admin')
    ON CONFLICT (order_code) DO NOTHING`,

    `INSERT INTO style_orders (order_code, style_name, style_no, client_id, client_name, quantity, priority, order_status, season, colorway, sample_size, fabric_type, order_issue_date, delivery_date, target_hours, issued_to, department, description, is_chargeable, is_deleted, created_by) VALUES
      ('ZST-2601', 'Ivory Bridal Lehenga',       'STY-HAM-001', '1',  'House of Amore',   '1',  'High',   'In Progress', 'Bridal 2026',   'Ivory & Gold',    'S',   'Banarasi Silk', '2026-04-01', '2026-04-30', '80',  'Team A', 'Tailoring', 'Full bridal lehenga with heavy zari embroidery',     true,  false, 'admin'),
      ('ZST-2600', 'Champagne Saree',            'STY-VER-001', '2',  'Vera Couture',     '2',  'Medium', 'Issued',      'Spring 2026',   'Champagne Beige', 'M',   'Georgette',     '2026-04-02', '2026-04-25', '40',  'Team B', 'Tailoring', 'Pre-draped saree with printed border',               false, false, 'admin'),
      ('ZST-2599', 'Black Chanderi Kurti',       'STY-NIL-001', '3',  'Nila Threads',     '5',  'Low',    'Completed',   'Festive 2025',  'Midnight Black',  'M',   'Chanderi Silk', '2026-03-15', '2026-04-10', '30',  'Team C', 'Tailoring', 'Embroidered chanderi kurti with contrast lining',    false, false, 'admin'),
      ('ZST-2598', 'Party Anarkali',             'STY-MEE-001', '4',  'Meera Bespoke',    '3',  'Urgent', 'Draft',       'Party 2026',    'Coral & Gold',    'S',   'Net Fabric',    '2026-04-08', '2026-05-01', '60',  'Team A', 'Tailoring', 'Heavy anarkali with sequin and net overlay',         true,  false, 'admin'),
      ('ZST-2597', 'Floral Organza Saree',       'STY-ELA-001', '5',  'Elara Fashion',    '4',  'High',   'In Progress', 'Summer 2026',   'Pastel Lavender', 'L',   'Organza',       '2026-04-05', '2026-04-28', '50',  'Team B', 'Tailoring', 'Floral motif organza saree with zari border',        false, false, 'admin'),
      ('ZST-2596', 'Heritage Red Lehenga',       'STY-HAM-001', '1',  'House of Amore',   '1',  'High',   'Completed',   'Bridal 2025',   'Ruby Red & Gold', 'S',   'Katan Silk',    '2026-02-01', '2026-03-15', '100', 'Team A', 'Tailoring', 'Red bridal lehenga with kadhwa zari work',           true,  false, 'admin'),
      ('ZST-2595', 'Cotton Suit Set',            'STY-SAN-001', '6',  'Sanskriti Labels', '10', 'Low',    'Completed',   'Summer 2026',   'Natural & Indigo','M',   'Cotton Muslin', '2026-02-10', '2026-03-10', '20',  'Team C', 'Tailoring', 'Block print cotton suit set for festive retail',     false, false, 'admin'),
      ('ZST-2594', 'Zari Blouse Collection',     'STY-RUH-001', '7',  'Ruhani Couture',   '8',  'Medium', 'Completed',   'Festive 2025',  'Champagne Gold',  'S',   'Katan Silk',    '2026-01-20', '2026-02-20', '60',  'Team B', 'Tailoring', 'Luxe katan blouse with intricate zari motifs',       true,  false, 'admin'),
      ('ZST-2593', 'Mirror Embellished Dress',   'STY-MIR-001', '8',  'Mira Atelier',     '3',  'Medium', 'In Progress', 'Resort 2026',   'Ivory & Mirror',  'M',   'Cotton Muslin', '2026-03-20', '2026-04-20', '45',  'Team C', 'Tailoring', 'Contemporary dress with traditional mirror work',    false, false, 'admin'),
      ('ZST-2592', 'Net Dupatta Collection',     'STY-ELA-001', '5',  'Elara Fashion',    '12', 'Low',    'Completed',   'Spring 2026',   'Multi Color',     'Free','Net Fabric',    '2026-01-15', '2026-02-15', '15',  'Team B', 'Tailoring', 'Assorted net dupattas with lace border',             false, false, 'admin'),
      ('ZST-2591', 'Bridal Anarkali',            'STY-RUH-001', '7',  'Ruhani Couture',   '2',  'Urgent', 'In Progress', 'Bridal 2026',   'Dusty Rose',      'M',   'Georgette',     '2026-04-10', '2026-05-10', '70',  'Team A', 'Tailoring', 'Full-length anarkali with embroidery and dupatta',   true,  false, 'admin'),
      ('ZST-2590', 'Festive Silk Kurti',         'STY-NIL-001', '3',  'Nila Threads',     '6',  'Medium', 'Issued',      'Festive 2026',  'Saffron & Gold',  'M',   'Chanderi Silk', '2026-04-03', '2026-04-25', '25',  'Team C', 'Tailoring', 'Festive kurti with mirror and zari border',          false, false, 'admin'),
      ('ZST-2589', 'Organza Dupatta Deluxe',     'STY-ELA-001', '5',  'Elara Fashion',    '5',  'High',   'Issued',      'Bridal 2026',   'Pearl White',     'Free','Organza',       '2026-04-06', '2026-04-30', '20',  'Team B', 'Tailoring', 'Sheer organza dupatta with heavy embroidered border',false, false, 'admin'),
      ('ZST-2588', 'Aria Handloom Saree',        NULL,          '9',  'Aria Handloom',    '15', 'Low',    'Draft',       'Summer 2026',   'Earthy Tones',    'Free','Cotton Muslin', '2026-04-12', '2026-05-05', '18',  'Team C', 'Tailoring', 'Traditional handloom saree with natural dyes',       false, false, 'admin'),
      ('ZST-2587', 'Mirror Work Kurti Batch',    NULL,          '10', 'Zoya Designs',     '20', 'Medium', 'Draft',       'Summer 2026',   'Multi',           'M',   'Cotton Muslin', '2026-04-14', '2026-05-10', '35',  'Team A', 'Tailoring', 'Rajasthani mirror work kurti for retail batch',      false, false, 'admin'),
      ('ZST-2586', 'Kochi Kasavu Saree',         NULL,          '9',  'Aria Handloom',    '8',  'Low',    'Completed',   'Heritage 2025', 'Gold & White',    'Free','Cotton Muslin', '2025-12-01', '2026-01-15', '30',  'Team C', 'Tailoring', 'Traditional kasavu weave with golden border',        false, false, 'admin'),
      ('ZST-2585', 'Party Lehenga Navy',         'STY-HAM-001', '1',  'House of Amore',   '1',  'High',   'Completed',   'Party 2025',    'Navy & Silver',   'S',   'Net Fabric',    '2025-11-10', '2025-12-10', '65',  'Team A', 'Tailoring', 'Party lehenga with sequin embellishment',             true,  false, 'admin'),
      ('ZST-2584', 'Sequin Blouse Collection',   'STY-RUH-001', '7',  'Ruhani Couture',   '6',  'Medium', 'Completed',   'Party 2025',    'Rose Gold',       'S',   'Georgette',     '2025-11-20', '2025-12-20', '40',  'Team B', 'Tailoring', 'Sequin-embellished georgette blouses for season',    true,  false, 'admin'),
      ('ZST-2583', 'Zoya Summer Set',            NULL,          '10', 'Zoya Designs',     '12', 'Medium', 'Cancelled',   'Summer 2025',   'Pastel Mint',     'M',   'Cotton Muslin', '2025-10-01', '2025-11-01', '25',  'Team C', 'Tailoring', 'Summer cotton set cancelled due to design change',   false, false, 'admin'),
      ('ZST-2582', 'Mira Silk Dress Pilot',      'STY-MIR-001', '8',  'Mira Atelier',     '2',  'Low',    'Cancelled',   'Resort 2025',   'Oyster White',    'S',   'Chanderi Silk', '2025-09-15', '2025-10-30', '50',  'Team A', 'Tailoring', 'Pilot run cancelled — client changed brief',         false, false, 'admin')
    ON CONFLICT (order_code) DO NOTHING`,

    `INSERT INTO artworks (artwork_code, swatch_order_id, artwork_name, unit_length, unit_width, unit_type, artwork_created, work_hours, hourly_rate, total_cost, feedback_status, is_deleted, created_by)
    SELECT
      'ART-' || LPAD(ROW_NUMBER() OVER ()::text, 3, '0'),
      so.id,
      aw.artwork_name,
      aw.unit_length, aw.unit_width, aw.unit_type,
      aw.artwork_created, aw.work_hours, aw.hourly_rate, aw.total_cost,
      aw.feedback_status, false, 'admin'
    FROM (VALUES
      ('ZSW-0101', 'Zari Border Motif',        '20', '8',  'cm', 'Inhouse',   '12', '350', '4200',  'Approved'),
      ('ZSW-0101', 'Floral Centre Panel',      '30', '15', 'cm', 'Inhouse',   '18', '350', '6300',  'Approved'),
      ('ZSW-0102', 'Geometric Print Block',    '25', '25', 'cm', 'Outsource', '0',  '0',   '3500',  'Approved'),
      ('ZSW-0103', 'Leaf Crepe Embroidery',    '15', '10', 'cm', 'Inhouse',   '8',  '350', '2800',  'Approved'),
      ('ZSW-0104', 'Sequin Scatter Pattern',   '20', '20', 'cm', 'Inhouse',   '10', '350', '3500',  'Pending'),
      ('ZSW-0104', 'Net Border Zari',          '40', '5',  'cm', 'Inhouse',   '14', '350', '4900',  'Pending'),
      ('ZSW-0105', 'Katan Zari Bootaa',        '12', '12', 'cm', 'Inhouse',   '20', '400', '8000',  'Pending'),
      ('ZSW-0105', 'Kadhwa Border Strip',      '50', '8',  'cm', 'Inhouse',   '24', '400', '9600',  'Pending'),
      ('ZSW-0106', 'Chikankari Motif',         '18', '18', 'cm', 'Outsource', '0',  '0',   '5000',  'Pending'),
      ('ZSW-0107', 'Organza Rose Cluster',     '22', '15', 'cm', 'Inhouse',   '10', '350', '3500',  'Pending'),
      ('ZSW-0109', 'Scattered Sequin Grid',    '30', '30', 'cm', 'Inhouse',   '12', '350', '4200',  'Pending'),
      ('ZSW-0111', 'Gold Zari Running Border', '45', '6',  'cm', 'Inhouse',   '16', '400', '6400',  'Pending'),
      ('ZSW-0112', 'Heritage Kalamkari Panel', '35', '25', 'cm', 'Inhouse',   '30', '450', '13500', 'Pending')
    ) AS aw(order_code, artwork_name, unit_length, unit_width, unit_type, artwork_created, work_hours, hourly_rate, total_cost, feedback_status)
    JOIN swatch_orders so ON so.order_code = aw.order_code
    WHERE NOT EXISTS (
      SELECT 1 FROM artworks a WHERE a.artwork_name = aw.artwork_name AND a.swatch_order_id = so.id
    )`,
  ];

  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      await client.query(stmt);
    }
    logger.info("Dummy data seeded successfully");
  } finally {
    client.release();
  }
}
