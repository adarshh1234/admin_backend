import mongoose from 'mongoose';

const JournalEntryAccountRowSchema = new mongoose.Schema(
  {
    account: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    party: { type: String, default: '' },
  },
  { _id: false }
);

const JournalEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    entryNumber: { type: String, required: true, unique: true, index: true },
    date: { type: String, required: true, index: true },
    entryType: { type: String, default: 'Journal Entry' },
    referenceNumber: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Cancelled'],
      default: 'Submitted',
    },
    userRemark: { type: String, default: '' },
    accounts: [JournalEntryAccountRowSchema],
    totalDebit: { type: Number, required: true },
    totalCredit: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

export const JournalEntry = mongoose.model('JournalEntry', JournalEntrySchema);
