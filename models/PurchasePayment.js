import mongoose from 'mongoose';

const PurchasePaymentAllocationSchema = new mongoose.Schema(
  {
    referenceType: { type: String, default: 'PurchaseInvoice' },
    referenceName: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const PurchasePaymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    paymentNumber: { type: String, required: true, unique: true, index: true },
    party: { type: String, required: true, index: true },
    paymentType: { type: String, enum: ['Receive', 'Pay'], default: 'Pay' },
    paymentMethod: { type: String, default: 'Bank Transfer (NEFT/RTGS/IMPS)' },
    account: { type: String, default: 'Creditors' },
    paymentAccount: { type: String, default: 'HDFC Bank Operating A/c' },
    date: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    referenceNumber: { type: String, default: '' },
    for: [PurchasePaymentAllocationSchema],
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Cancelled'],
      default: 'Submitted',
    },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const PurchasePayment = mongoose.model('PurchasePayment', PurchasePaymentSchema);
