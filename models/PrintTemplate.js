import mongoose from 'mongoose';

const PrintTemplateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    templateType: { type: String, default: 'SalesInvoice' },
    isDefault: { type: Boolean, default: true },
    headerTitle: { type: String, default: 'TAX INVOICE' },
    themeColor: { type: String, default: '#0284c7' },
    showLogo: { type: Boolean, default: true },
    showGstBreakup: { type: Boolean, default: true },
    showBankDetails: { type: Boolean, default: true },
    termsAndConditions: {
      type: String,
      default: '1. Goods once sold will not be taken back or exchanged.\n2. Payment is due within agreed credit terms.\n3. Subject to local jurisdiction only.',
    },
  },
  {
    timestamps: true,
  }
);

export const PrintTemplate = mongoose.model('PrintTemplate', PrintTemplateSchema);
