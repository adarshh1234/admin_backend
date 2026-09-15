import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, index: true },
    accountType: { type: String, default: 'General' },
    rootType: {
      type: String,
      enum: ['Asset', 'Liability', 'Equity', 'Income', 'Expense', 'Other'],
      default: 'Asset',
    },
    parent: { type: String, default: null },
    isGroup: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  {
    timestamps: true,
  }
);

export const Account = mongoose.model('Account', AccountSchema);
