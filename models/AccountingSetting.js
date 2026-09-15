import mongoose from 'mongoose';
import { defaultAccountingData } from '../data/defaultAccountingData.js';

const AccountingSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'main_settings' },
    companyName: { type: String, default: 'CUREMASO Healthcare Pvt Ltd' },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    fiscalYearStart: { type: String, default: '2026-04-01' },
    fiscalYearEnd: { type: String, default: '2027-03-31' },
    gstin: { type: String, default: '27AABCC1234F1Z8' },
    pan: { type: String, default: 'AABCC1234F' },
    defaultCashAccount: { type: String, default: 'Cash' },
    defaultBankAccount: { type: String, default: 'HDFC Bank Operating A/c' },
    defaultReceivableAccount: { type: String, default: 'Debtors' },
    defaultPayableAccount: { type: String, default: 'Creditors' },
    defaultIncomeAccount: { type: String, default: 'Sales' },
    defaultExpenseAccount: { type: String, default: 'Cost of Goods Sold' },
    roundOffAccount: { type: String, default: 'Round Off' },
    writeOffAccount: { type: String, default: 'Bad Debts Written Off' },
    enableDiscounting: { type: Boolean, default: true },
    discountAccount: { type: String, default: 'Discount Received' },
    enablePartialPayment: { type: Boolean, default: true },
    address: { type: String, default: 'Level 5, Medical Towers, Bandra Kurla Complex, Mumbai 400051' },
    email: { type: String, default: 'accounts@curemaso.com' },
    phone: { type: String, default: '+91 22 6890 5400' },
  },
  {
    timestamps: true,
  }
);

export const AccountingSetting = mongoose.model('AccountingSetting', AccountingSettingSchema);
