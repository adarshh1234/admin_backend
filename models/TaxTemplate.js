import mongoose from 'mongoose';

const TaxDetailSchema = new mongoose.Schema(
  {
    account: { type: String, required: true },
    rate: { type: Number, required: true },
  },
  { _id: false }
);

const TaxTemplateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    rate: { type: Number, required: true },
    isDefault: { type: Boolean, default: false },
    details: [TaxDetailSchema],
  },
  {
    timestamps: true,
  }
);

export const TaxTemplate = mongoose.model('TaxTemplate', TaxTemplateSchema);
