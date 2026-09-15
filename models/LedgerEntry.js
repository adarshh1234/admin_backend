import mongoose from 'mongoose';

const LedgerEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    account: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    party: { type: String, default: '', index: true },
    referenceType: { type: String, required: true, index: true },
    referenceName: { type: String, required: true, index: true },
    reverted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

export const LedgerEntry = mongoose.model('LedgerEntry', LedgerEntrySchema);
