import {
  Account,
  Party,
  LedgerEntry,
  SalesInvoice,
  PurchaseInvoice,
} from '../models/AccountingModel.js';

export const accountingEngine = {
  /**
   * Recalculate account balances and party outstanding amounts from all active ledger entries
   */
  async recalculateBalances() {
    const [ledger, accounts, parties] = await Promise.all([
      LedgerEntry.find({ reverted: false }).lean(),
      Account.find(),
      Party.find(),
    ]);

    // Reset balances map
    const accountBalances = {};
    accounts.forEach((acc) => {
      accountBalances[acc.name] = 0;
    });

    const partyBalances = {};
    parties.forEach((p) => {
      partyBalances[p.name] = 0;
    });

    // Aggregate active ledger entries
    ledger.forEach((entry) => {
      const debit = Number(entry.debit) || 0;
      const credit = Number(entry.credit) || 0;
      const accountName = entry.account;

      if (accountBalances[accountName] !== undefined) {
        accountBalances[accountName] += debit - credit;
      }

      if (entry.party && partyBalances[entry.party] !== undefined) {
        const party = parties.find((p) => p.name === entry.party);
        if (party) {
          const acc = accounts.find((a) => a.name === entry.account);
          const isReceivable = entry.account === 'Debtors' || acc?.accountType === 'Receivable' || party.defaultAccount === entry.account;
          const isPayable = entry.account === 'Creditors' || acc?.accountType === 'Payable' || party.defaultAccount === entry.account;

          if (party.role === 'Customer' && isReceivable) {
            partyBalances[entry.party] += debit - credit;
          } else if (party.role === 'Supplier' && isPayable) {
            partyBalances[entry.party] += credit - debit;
          } else if (isReceivable) {
            partyBalances[entry.party] += debit - credit;
          } else if (isPayable) {
            partyBalances[entry.party] += credit - debit;
          }
        }
      }
    });

    // Update Account documents in MongoDB
    const accountUpdates = accounts.map((acc) => {
      const bal = Math.abs(accountBalances[acc.name] || 0);
      acc.balance = bal;
      return acc.save();
    });

    // Update Party documents in MongoDB
    const partyUpdates = parties.map((p) => {
      const outstanding = Math.max(0, partyBalances[p.name] || 0);
      p.outstandingAmount = outstanding;
      return p.save();
    });

    await Promise.all([...accountUpdates, ...partyUpdates]);
    return { accounts, parties };
  },

  /**
   * Post Sales Invoice to General Ledger
   * Debit: Receivable Account (Debtors) = Grand Total
   * Credit: Income Account (Sales/Service) = Net Total
   * Credit: Tax Accounts (CGST/SGST/IGST) = Tax Amounts
   */
  async postSalesInvoice(invoice) {
    const newEntries = [];
    const date = invoice.date || new Date().toISOString().split('T')[0];
    const party = invoice.party;
    const refType = 'SalesInvoice';
    const refName = invoice.invoiceNumber || invoice.id;

    // 1. Debit Receivable Account
    newEntries.push({
      id: `le-${Date.now()}-1`,
      account: invoice.account || 'Debtors',
      date,
      debit: Number(invoice.grandTotal) || 0,
      credit: 0,
      party,
      referenceType: refType,
      referenceName: refName,
      reverted: false,
    });

    // 2. Credit Item Income Accounts
    (invoice.items || []).forEach((item, idx) => {
      const itemAcc = item.account || 'Sales';
      newEntries.push({
        id: `le-${Date.now()}-${idx + 2}`,
        account: itemAcc,
        date,
        debit: 0,
        credit: Number(item.amount) || 0,
        party: '',
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
    });

    // 3. Credit Taxes
    (invoice.taxes || []).forEach((tax, idx) => {
      newEntries.push({
        id: `le-${Date.now()}-tax-${idx}`,
        account: tax.account,
        date,
        debit: 0,
        credit: Number(tax.amount) || 0,
        party: '',
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
    });

    // Validate Debit == Credit
    this.validateEntriesEquality(newEntries);

    await LedgerEntry.insertMany(newEntries);
    await this.recalculateBalances();
    return newEntries;
  },

  /**
   * Post Purchase Invoice to General Ledger
   * Credit: Payable Account (Creditors) = Grand Total
   * Debit: Expense/Asset Account = Net Total
   * Debit: Tax Accounts (Input CGST/SGST/IGST) = Tax Amounts
   */
  async postPurchaseInvoice(invoice) {
    const newEntries = [];
    const date = invoice.date || new Date().toISOString().split('T')[0];
    const party = invoice.party;
    const refType = 'PurchaseInvoice';
    const refName = invoice.invoiceNumber || invoice.id;

    // 1. Credit Payable Account
    newEntries.push({
      id: `le-${Date.now()}-1`,
      account: invoice.account || 'Creditors',
      date,
      debit: 0,
      credit: Number(invoice.grandTotal) || 0,
      party,
      referenceType: refType,
      referenceName: refName,
      reverted: false,
    });

    // 2. Debit Expense / Stock Accounts
    (invoice.items || []).forEach((item, idx) => {
      const itemAcc = item.account || 'Stock In Hand';
      newEntries.push({
        id: `le-${Date.now()}-${idx + 2}`,
        account: itemAcc,
        date,
        debit: Number(item.amount) || 0,
        credit: 0,
        party: '',
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
    });

    // 3. Debit Taxes (Input Tax Credit)
    (invoice.taxes || []).forEach((tax, idx) => {
      newEntries.push({
        id: `le-${Date.now()}-tax-${idx}`,
        account: tax.account,
        date,
        debit: Number(tax.amount) || 0,
        credit: 0,
        party: '',
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
    });

    // Validate Debit == Credit
    this.validateEntriesEquality(newEntries);

    await LedgerEntry.insertMany(newEntries);
    await this.recalculateBalances();
    return newEntries;
  },

  /**
   * Post Payment (Customer Receive or Supplier Pay)
   */
  async postPayment(payment) {
    const newEntries = [];
    const date = payment.date || new Date().toISOString().split('T')[0];
    const party = payment.party;
    const refType = 'Payment';
    const refName = payment.paymentNumber || payment.id;
    const amount = Number(payment.amount) || 0;

    if (payment.paymentType === 'Receive') {
      // Debit Bank/Cash Account
      newEntries.push({
        id: `le-${Date.now()}-1`,
        account: payment.paymentAccount || 'HDFC Bank Operating A/c',
        date,
        debit: amount,
        credit: 0,
        party: '',
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
      // Credit Receivable Account
      newEntries.push({
        id: `le-${Date.now()}-2`,
        account: payment.account || 'Debtors',
        date,
        debit: 0,
        credit: amount,
        party,
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
    } else {
      // Pay supplier: Debit Payable Account, Credit Bank/Cash Account
      newEntries.push({
        id: `le-${Date.now()}-1`,
        account: payment.account || 'Creditors',
        date,
        debit: amount,
        credit: 0,
        party,
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
      newEntries.push({
        id: `le-${Date.now()}-2`,
        account: payment.paymentAccount || 'HDFC Bank Operating A/c',
        date,
        debit: 0,
        credit: amount,
        party: '',
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
    }

    this.validateEntriesEquality(newEntries);
    await LedgerEntry.insertMany(newEntries);

    // Update allocated invoice outstanding amounts if payment was for specific invoices
    if (Array.isArray(payment.for) && payment.for.length > 0) {
      for (const ref of payment.for) {
        if (ref.referenceType === 'SalesInvoice') {
          const inv = await SalesInvoice.findOne({
            $or: [{ invoiceNumber: ref.referenceName }, { id: ref.referenceName }],
          });
          if (inv) {
            const paidAmt = Number(ref.amount) || 0;
            inv.outstandingAmount = Math.max(0, (Number(inv.outstandingAmount) || 0) - paidAmt);
            inv.paymentStatus = inv.outstandingAmount === 0 ? 'Paid' : 'Partially Paid';
            await inv.save();
          }
        } else if (ref.referenceType === 'PurchaseInvoice') {
          const inv = await PurchaseInvoice.findOne({
            $or: [{ invoiceNumber: ref.referenceName }, { id: ref.referenceName }],
          });
          if (inv) {
            const paidAmt = Number(ref.amount) || 0;
            inv.outstandingAmount = Math.max(0, (Number(inv.outstandingAmount) || 0) - paidAmt);
            inv.paymentStatus = inv.outstandingAmount === 0 ? 'Paid' : 'Partially Paid';
            await inv.save();
          }
        }
      }
    }

    await this.recalculateBalances();
    return newEntries;
  },

  /**
   * Post Journal Entry
   * Strictly verifies Debit == Credit
   */
  async postJournalEntry(journal) {
    const newEntries = [];
    const date = journal.date || new Date().toISOString().split('T')[0];
    const refType = 'JournalEntry';
    const refName = journal.entryNumber || journal.id;

    let totalDebit = 0;
    let totalCredit = 0;

    (journal.accounts || []).forEach((row, idx) => {
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      totalDebit += debit;
      totalCredit += credit;

      newEntries.push({
        id: `le-${Date.now()}-${idx}`,
        account: row.account,
        date,
        debit,
        credit,
        party: row.party || '',
        referenceType: refType,
        referenceName: refName,
        reverted: false,
      });
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Unbalanced Journal Entry: Total Debit (₹${totalDebit.toFixed(2)}) must equal Total Credit (₹${totalCredit.toFixed(2)})`);
    }

    await LedgerEntry.insertMany(newEntries);
    await this.recalculateBalances();
    return newEntries;
  },

  /**
   * Revert all ledger entries associated with a voucher/reference
   */
  async revertTransaction(referenceType, referenceName) {
    const res = await LedgerEntry.updateMany(
      { referenceType, referenceName },
      { $set: { reverted: true } }
    );
    if (res.modifiedCount > 0) {
      await this.recalculateBalances();
    }
    return res.modifiedCount > 0;
  },

  /**
   * Helper to validate that total debit equals total credit
   */
  validateEntriesEquality(entries) {
    let debit = 0;
    let credit = 0;
    entries.forEach((e) => {
      debit += Number(e.debit) || 0;
      credit += Number(e.credit) || 0;
    });
    if (Math.abs(debit - credit) > 0.01) {
      throw new Error(`Double entry imbalance: Total Debit (₹${debit.toFixed(2)}) does not match Total Credit (₹${credit.toFixed(2)})`);
    }
  },
};
