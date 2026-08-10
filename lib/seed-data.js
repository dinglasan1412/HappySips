import { makeUser } from './auth.js';

export const SEED_MENU = [
  { id: 'm1', name: 'Classic Milk Tea', category: 'Milk Tea', sizes: { Medium: 89, Large: 99 } },
  { id: 'm2', name: 'Taro Milk Tea', category: 'Milk Tea', sizes: { Medium: 99, Large: 109 } },
  { id: 'm3', name: 'Wintermelon Milk Tea', category: 'Milk Tea', sizes: { Medium: 95, Large: 105 } },
  { id: 'm4', name: 'Okinawa Milk Tea', category: 'Milk Tea', sizes: { Medium: 99, Large: 109 } },
  { id: 'm5', name: 'Brown Sugar Milk Tea', category: 'Milk Tea', sizes: { Medium: 109, Large: 119 } },
  { id: 'm6', name: 'Matcha Milk Tea', category: 'Milk Tea', sizes: { Medium: 105, Large: 115 } },
  { id: 'm7', name: 'Strawberry Fruit Tea', category: 'Fruit Tea', sizes: { Medium: 89, Large: 99 } },
  { id: 'm8', name: 'Lychee Fruit Tea', category: 'Fruit Tea', sizes: { Medium: 89, Large: 99 } },
  { id: 'm9', name: 'Blueberry Fruit Soda', category: 'Fruit Soda', sizes: { Medium: 95, Large: 105 } },
  { id: 'm10', name: 'Green Apple Fruit Soda', category: 'Fruit Soda', sizes: { Medium: 95, Large: 105 } },
];

export const SEED_INVENTORY = [
  { id: 'i1', name: 'Black Tapioca Pearls', category: 'Ingredient', unit: 'kg', stock: 2, reorderLevel: 5 },
  { id: 'i2', name: 'Brown Sugar Syrup', category: 'Ingredient', unit: 'L', stock: 3, reorderLevel: 5 },
  { id: 'i3', name: 'Wintermelon Syrup', category: 'Ingredient', unit: 'L', stock: 4, reorderLevel: 3 },
  { id: 'i4', name: 'Okinawa Powder', category: 'Ingredient', unit: 'kg', stock: 1, reorderLevel: 3 },
  { id: 'i5', name: 'Taro Powder', category: 'Ingredient', unit: 'kg', stock: 0, reorderLevel: 3 },
  { id: 'i6', name: 'Milk Powder', category: 'Ingredient', unit: 'kg', stock: 6, reorderLevel: 10 },
  { id: 'i7', name: 'Creamer', category: 'Ingredient', unit: 'kg', stock: 8, reorderLevel: 10 },
  { id: 'i8', name: '16oz Plastic Cups', category: 'Supplies', unit: 'pc', stock: 120, reorderLevel: 50 },
  { id: 'i9', name: '22oz Plastic Cups', category: 'Supplies', unit: 'pc', stock: 40, reorderLevel: 50 },
  { id: 'i10', name: 'Straws', category: 'Supplies', unit: 'pc', stock: 200, reorderLevel: 100 },
];

export function generatePlaceholderSales() {
  const at = (daysAgo, h, m) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const item = (menuIndex, size, qty) => {
    const m = SEED_MENU[menuIndex];
    return { menuId: m.id, name: m.name, category: m.category, size, price: m.sizes[size], qty };
  };
  const sale = (id, daysAgo, h, m, items, payment, customer, reference = '') => ({
    id,
    timestamp: at(daysAgo, h, m),
    items,
    total: items.reduce((sum, it) => sum + it.price * it.qty, 0),
    payment,
    reference,
    customer,
    cashier: 'admin',
  });

  return [
    sale('ph1', 14, 9, 10, [item(0, 'Medium', 2)], 'Cash', 'Walk-in Customer'),
    sale('ph2', 14, 15, 40, [item(7, 'Large', 1)], 'GCash', 'Bea S.', 'GC17281940552'),
    sale('ph3', 12, 10, 5, [item(3, 'Medium', 1), item(4, 'Large', 1)], 'Cash', 'Walk-in Customer'),
    sale('ph4', 11, 11, 20, [item(8, 'Medium', 2)], 'Card', 'Miguel A.'),
    sale('ph5', 11, 16, 50, [item(1, 'Large', 1)], 'Cash', 'Walk-in Customer'),
    sale('ph6', 9, 9, 45, [item(5, 'Medium', 1), item(9, 'Medium', 1)], 'GCash', 'Joyce L.', 'GC17280335117'),
    sale('ph7', 8, 13, 15, [item(0, 'Medium', 3)], 'Cash', 'Walk-in Customer'),
    sale('ph8', 8, 17, 30, [item(6, 'Large', 1)], 'Card', 'Ella P.'),
    sale('ph9', 7, 10, 50, [item(3, 'Large', 2)], 'GCash', 'Walk-in Customer', 'GC17279561803'),
    sale('ph10', 6, 14, 10, [item(4, 'Medium', 1), item(1, 'Medium', 1)], 'Cash', 'Ramon D.'),
    sale('ph11', 5, 9, 25, [item(2, 'Medium', 1)], 'Cash', 'Walk-in Customer'),
    sale('ph12', 5, 15, 55, [item(7, 'Large', 2)], 'GCash', 'Grace N.', 'GC17278870264'),
    sale('ph13', 4, 11, 40, [item(5, 'Medium', 1)], 'Card', 'Walk-in Customer'),
    sale('ph14', 3, 10, 15, [item(0, 'Medium', 1), item(8, 'Large', 1)], 'Cash', 'Walk-in Customer'),
    sale('ph15', 2, 13, 50, [item(3, 'Medium', 1)], 'GCash', 'Nico V.', 'GC17278192541'),
    sale('ph16', 2, 16, 20, [item(4, 'Large', 2)], 'Cash', 'Walk-in Customer'),
    sale('ph17', 1, 9, 35, [item(1, 'Medium', 1)], 'Cash', 'Walk-in Customer'),
    sale('ph18', 0, 10, 0, [item(9, 'Medium', 1)], 'GCash', 'Walk-in Customer', 'GC17277540980'),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Demo accounts — change these before giving anyone else access to a real
// deployment. Passwords are hashed the moment this function runs; the
// plaintext values below never leave the server.
//
// admin/staff are VIEW-ONLY demo logins — anyone can use them to look
// around, but they cannot add/edit/delete anything (see the `verified`
// flag). The 'owner' account is a real, working Admin account so there's
// always at least one way in to approve new account requests — change
// its password after your first login (see the account-requests screen,
// or just edit it directly here before your first-ever deploy).
export function seedUsers() {
  return [
    makeUser('admin', 'admin123', 'Admin', 'Admin User', false),
    makeUser('staff', 'staff123', 'Staff', 'Staff User', false),
    makeUser('owner', 'byTi5v2qpv', 'Admin', 'Owner', true),
  ];
}
