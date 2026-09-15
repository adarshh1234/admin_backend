import mongoose from 'mongoose';

const PartySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, index: true },
    role: {
      type: String,
      enum: ['Customer', 'Supplier', 'Both'],
      default: 'Customer',
    },
    gstin: { type: String, default: '' },
    pan: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    placeOfSupply: { type: String, default: 'Maharashtra' },
    defaultAccount: { type: String, default: 'Debtors' },
    openingBalance: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  {
    timestamps: true,
  }
);

export const Party = mongoose.model('Party', PartySchema);
