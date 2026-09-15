import mongoose from 'mongoose';

const PaymentMethodSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: 'Bank' },
    account: { type: String, default: 'HDFC Bank Operating A/c' },
  },
  {
    timestamps: true,
  }
);

export const PaymentMethod = mongoose.model('PaymentMethod', PaymentMethodSchema);
