import mongoose from 'mongoose';

const InvoiceItemSchema = new mongoose.Schema(
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

const InvoiceTaxSchema = new mongoose.Schema(
  {
    account: { type: String, required: true },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const SalesInvoiceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    party: { type: String, required: true, index: true },
    account: { type: String, default: 'Debtors' },
    date: { type: String, required: true, index: true },
    dueDate: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Cancelled'],
      default: 'Submitted',
    },
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Partially Paid', 'Paid'],
      default: 'Unpaid',
    },
    currency: { type: String, default: 'INR' },
    placeOfSupply: { type: String, default: 'Maharashtra' },
    isReturn: { type: Boolean, default: false },
    items: [InvoiceItemSchema],
    taxes: [InvoiceTaxSchema],
    netTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const SalesInvoice = mongoose.model('SalesInvoice', SalesInvoiceSchema);
