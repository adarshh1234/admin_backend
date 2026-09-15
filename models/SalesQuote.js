import mongoose from 'mongoose';

const SalesQuoteItemSchema = new mongoose.Schema(
  {
    item: { type: String },
    itemName: { type: String },
    name: { type: String },
    description: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'Nos' },
    rate: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 18 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    account: { type: String, default: 'Sales' },
  },
  { _id: false }
);

const SalesQuoteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    quoteNumber: { type: String, required: true, unique: true, index: true },
    party: { type: String, required: true, index: true },
    date: { type: String, required: true },
    validUntil: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Cancelled'],
      default: 'Draft',
    },
    currency: { type: String, default: 'INR' },
    items: [SalesQuoteItemSchema],
    netTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    convertedToInvoice: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export const SalesQuote = mongoose.model('SalesQuote', SalesQuoteSchema);
