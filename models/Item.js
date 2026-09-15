import mongoose from 'mongoose';

const ItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    unit: { type: String, default: 'Nos' },
    rate: { type: Number, default: 0 },
    purchaseRate: { type: Number, default: 0 },
    category: { type: String, default: 'Services' },
    hsnSac: { type: String, default: '' },
    incomeAccount: { type: String, default: 'Sales' },
    expenseAccount: { type: String, default: 'Cost of Goods Sold' },
    taxTemplate: { type: String, default: 'tax-1' },
    taxRate: { type: Number, default: 18 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  {
    timestamps: true,
  }
);

export const Item = mongoose.model('Item', ItemSchema);
