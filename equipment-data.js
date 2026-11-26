/* =========================================================
   equipment-data.js — single list of gym equipment.
   Used by the Equipment page AND the add-ons in the class
   booking popup. Prices and stock are PLACEHOLDERS: edit
   them to match your real rates.
   ========================================================= */
window.GTG_EQUIPMENT = {
  items: [
    { id: 'boxing-gloves',   name: 'Boxing gloves',    type: 'Rental', category: 'Boxing',    price: 50, stock: 12, icon: '\uD83E\uDD4A' },
    { id: 'muaythai-gloves', name: 'Muay Thai gloves', type: 'Rental', category: 'Muay Thai', price: 50, stock: 10, icon: '\uD83E\uDD4A' },
    { id: 'hand-wraps',      name: 'Hand wraps',       type: 'Buy',    category: 'Boxing',    price: 40, stock: 30, icon: '\uD83E\uDD4A' }
  ],

  // Which items are offered as add-ons when booking each class
  byClass: {
    boxing:   ['boxing-gloves', 'hand-wraps'],
    muaythai: ['muaythai-gloves', 'hand-wraps']
  }
};