import mongoose from 'mongoose';

const PaymentAllocationSchema = new mongoose.Schema(
  {
    referenceType: { type: String, default: 'SalesInvoice' },
    referenceName: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const SalesPaymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    paymentNumber: { type: String, required: true, unique: true, index: true },
    party: { type: String, required: true, index: true },
    paymentType: { type: String, enum: ['Receive', 'Pay'], default: 'Receive' },
    paymentMethod: { type: String, default: 'Bank Transfer (NEFT/RTGS/IMPS)' },
    account: { type: String, default: 'Debtors' },
    paymentAccount: { type: String, default: 'HDFC Bank Operating A/c' },
    date: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    referenceNumber: { type: String, default: '' },
    for: [PaymentAllocationSchema],
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

export const SalesPayment = mongoose.model('SalesPayment', SalesPaymentSchema);
