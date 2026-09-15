import {
  Account,
  Party,
  SalesInvoice,
  PurchaseInvoice,
  LedgerEntry,
} from '../models/AccountingModel.js';

export const financialReports = {
  /**
   * General Ledger Report
   */
  async getGeneralLedger({ account, party, fromDate, toDate, referenceType, includeReverted = false }) {
    const query = {};
    if (!includeReverted) {
      query.reverted = false;
    }
    if (account && account !== 'All') {
      query.account = account;
    }
    if (party && party !== 'All') {
      query.party = party;
    }
    if (referenceType && referenceType !== 'All') {
      query.referenceType = referenceType;
    }
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }

    const entries = await LedgerEntry.find(query).sort({ date: 1, createdAt: 1 }).lean();

    let totalDebit = 0;
    let totalCredit = 0;
    let runningBalance = 0;

    const rows = entries.map((entry, index) => {
      const debit = Number(entry.debit) || 0;
      const credit = Number(entry.credit) || 0;
      totalDebit += debit;
      totalCredit += credit;
      runningBalance += debit - credit;

      return {
        id: entry.id,
        index: index + 1,
        date: entry.date,
        account: entry.account,
        party: entry.party || '—',
        referenceType: entry.referenceType,
        referenceName: entry.referenceName,
        debit,
        credit,
        balance: runningBalance,
        reverted: !!entry.reverted,
      };
    });

    return {
      rows,
      summary: {
        totalDebit,
        totalCredit,
        closingBalance: totalDebit - totalCredit,
        totalCount: rows.length,
      },
    };
  },

  /**
   * Trial Balance Report
   * Total Debit MUST equal Total Credit
   */
  async getTrialBalance({ fromDate, toDate } = {}) {
    const query = { reverted: false };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }

    const [accounts, entries] = await Promise.all([
      Account.find().lean(),
      LedgerEntry.find(query).lean(),
    ]);

    const accountTotals = {};
    accounts.forEach((acc) => {
      accountTotals[acc.name] = { debit: 0, credit: 0, rootType: acc.rootType, isGroup: acc.isGroup };
    });

    entries.forEach((e) => {
      if (!accountTotals[e.account]) {
        accountTotals[e.account] = { debit: 0, credit: 0, rootType: 'Other', isGroup: false };
      }
      accountTotals[e.account].debit += Number(e.debit) || 0;
      accountTotals[e.account].credit += Number(e.credit) || 0;
    });

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const rows = Object.keys(accountTotals)
      .filter((accName) => !accountTotals[accName].isGroup && (accountTotals[accName].debit > 0 || accountTotals[accName].credit > 0))
      .map((accName) => {
        const item = accountTotals[accName];
        const net = item.debit - item.credit;
        let debitBal = 0;
        let creditBal = 0;

        // In trial balance: Asset & Expense normally have Debit balances; Liability, Equity, Income have Credit balances
        if (net >= 0) {
          debitBal = net;
        } else {
          creditBal = Math.abs(net);
        }

        grandTotalDebit += debitBal;
        grandTotalCredit += creditBal;

        return {
          account: accName,
          rootType: item.rootType,
          debit: debitBal,
          credit: creditBal,
        };
      });

    return {
      rows,
      totals: {
        totalDebit: grandTotalDebit,
        totalCredit: grandTotalCredit,
        isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01,
      },
    };
  },

  /**
   * Profit & Loss Report
   */
  async getProfitAndLoss({ fromDate, toDate } = {}) {
    const query = { reverted: false };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }

    const [accounts, entries] = await Promise.all([
      Account.find().lean(),
      LedgerEntry.find(query).lean(),
    ]);

    const incomeAccounts = accounts.filter((a) => a.rootType === 'Income' && !a.isGroup);
    const expenseAccounts = accounts.filter((a) => a.rootType === 'Expense' && !a.isGroup);

    const calcAccountBal = (accName) => {
      let debit = 0;
      let credit = 0;
      entries.forEach((e) => {
        if (e.account === accName) {
          debit += Number(e.debit) || 0;
          credit += Number(e.credit) || 0;
        }
      });
      return { debit, credit, netCredit: credit - debit, netDebit: debit - credit };
    };

    let totalIncome = 0;
    const incomeRows = incomeAccounts
      .map((acc) => {
        const { netCredit } = calcAccountBal(acc.name);
        totalIncome += netCredit;
        return {
          account: acc.name,
          parent: acc.parent,
          amount: netCredit,
        };
      })
      .filter((r) => r.amount !== 0 || true);

    let totalDirectExpense = 0;
    let totalIndirectExpense = 0;
    const directExpenseRows = [];
    const indirectExpenseRows = [];

    expenseAccounts.forEach((acc) => {
      const { netDebit } = calcAccountBal(acc.name);
      if (acc.parent === 'Direct Expenses' || acc.accountType === 'Cost of Goods Sold') {
        totalDirectExpense += netDebit;
        directExpenseRows.push({ account: acc.name, amount: netDebit });
      } else {
        totalIndirectExpense += netDebit;
        indirectExpenseRows.push({ account: acc.name, amount: netDebit });
      }
    });

    const totalExpense = totalDirectExpense + totalIndirectExpense;
    const grossProfit = totalIncome - totalDirectExpense;
    const netProfit = totalIncome - totalExpense;

    return {
      income: { rows: incomeRows, total: totalIncome },
      directExpenses: { rows: directExpenseRows, total: totalDirectExpense },
      indirectExpenses: { rows: indirectExpenseRows, total: totalIndirectExpense },
      summary: {
        totalIncome,
        totalExpense,
        grossProfit,
        netProfit,
        isProfitable: netProfit >= 0,
      },
    };
  },

  /**
   * Balance Sheet Report
   * Assets = Liabilities + Equity + Net Profit
   */
  async getBalanceSheet({ asOfDate } = {}) {
    const query = { reverted: false };
    if (asOfDate) {
      query.date = { $lte: asOfDate };
    }

    const [accounts, entries, pnl] = await Promise.all([
      Account.find().lean(),
      LedgerEntry.find(query).lean(),
      this.getProfitAndLoss({ toDate: asOfDate }),
    ]);

    const calcAccountBal = (accName) => {
      let debit = 0;
      let credit = 0;
      entries.forEach((e) => {
        if (e.account === accName) {
          debit += Number(e.debit) || 0;
          credit += Number(e.credit) || 0;
        }
      });
      return debit - credit;
    };

    // Assets: net debit
    let totalAssets = 0;
    const assetRows = accounts
      .filter((a) => a.rootType === 'Asset' && !a.isGroup)
      .map((acc) => {
        const bal = calcAccountBal(acc.name);
        totalAssets += bal;
        return { account: acc.name, parent: acc.parent, amount: bal };
      });

    // Liabilities: net credit
    let totalLiabilities = 0;
    const liabilityRows = accounts
      .filter((a) => a.rootType === 'Liability' && !a.isGroup)
      .map((acc) => {
        const bal = -calcAccountBal(acc.name);
        totalLiabilities += bal;
        return { account: acc.name, parent: acc.parent, amount: bal };
      });

    // Equity
    let totalEquity = 0;
    const equityRows = accounts
      .filter((a) => a.rootType === 'Equity' && !a.isGroup)
      .map((acc) => {
        const bal = -calcAccountBal(acc.name);
        totalEquity += bal;
        return { account: acc.name, parent: acc.parent, amount: bal };
      });

    const currentPeriodEarnings = pnl.summary.netProfit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + currentPeriodEarnings;

    return {
      assets: { rows: assetRows, total: totalAssets },
      liabilities: { rows: liabilityRows, total: totalLiabilities },
      equity: {
        rows: equityRows,
        currentPeriodEarnings,
        total: totalEquity + currentPeriodEarnings,
      },
      summary: {
        totalAssets,
        totalLiabilitiesAndEquity,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
        difference: totalAssets - totalLiabilitiesAndEquity,
      },
    };
  },

  /**
   * GSTR-1 Report (Outward Supplies)
   */
  async getGSTR1({ fromDate, toDate, transferType } = {}) {
    const invQuery = { status: 'Submitted', isReturn: false };
    if (fromDate || toDate) {
      invQuery.date = {};
      if (fromDate) invQuery.date.$gte = fromDate;
      if (toDate) invQuery.date.$lte = toDate;
    }

    const [invoices, parties] = await Promise.all([
      SalesInvoice.find(invQuery).sort({ date: 1 }).lean(),
      Party.find().lean(),
    ]);

    const rows = invoices.map((inv) => {
      const party = parties.find((p) => p.name === inv.party) || {};
      const gstin = party.gstin || '';
      const inState = (inv.placeOfSupply || '').toLowerCase().includes('maharashtra');

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      (inv.taxes || []).forEach((t) => {
        if (t.account === 'CGST') cgst += Number(t.amount) || 0;
        if (t.account === 'SGST') sgst += Number(t.amount) || 0;
        if (t.account === 'IGST') igst += Number(t.amount) || 0;
      });

      let type = 'B2B';
      if (!gstin) {
        if (!inState && inv.grandTotal >= 250000) {
          type = 'B2CL';
        } else {
          type = 'B2CS';
        }
      }

      return {
        invoiceNumber: inv.invoiceNumber || inv.id,
        invoiceDate: inv.date,
        partyName: inv.party,
        gstin,
        placeOfSupply: inv.placeOfSupply || 'Maharashtra',
        invoiceValue: Number(inv.grandTotal) || 0,
        taxableValue: Number(inv.netTotal) || 0,
        rate: inv.items?.[0]?.taxRate || 18,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalTax: cgst + sgst + igst,
        type,
      };
    });

    const filteredRows = transferType && transferType !== 'All' ? rows.filter((r) => r.type === transferType) : rows;

    const totals = filteredRows.reduce(
      (acc, r) => {
        acc.totalInvoiceValue += r.invoiceValue;
        acc.totalTaxableValue += r.taxableValue;
        acc.totalCgst += r.cgstAmount;
        acc.totalSgst += r.sgstAmount;
        acc.totalIgst += r.igstAmount;
        acc.totalTax += r.totalTax;
        return acc;
      },
      { totalInvoiceValue: 0, totalTaxableValue: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0 }
    );

    const mapGstr1Row = (r) => ({
      invoice_number: r.invoiceNumber,
      invoiceNumber: r.invoiceNumber,
      date: r.invoiceDate,
      invoiceDate: r.invoiceDate,
      customer_name: r.partyName,
      partyName: r.partyName,
      gstin: r.gstin,
      place_of_supply: r.placeOfSupply,
      placeOfSupply: r.placeOfSupply,
      taxable_amount: r.taxableValue,
      taxableValue: r.taxableValue,
      rate: r.rate,
      igst: r.igstAmount,
      igstAmount: r.igstAmount,
      cgst: r.cgstAmount,
      cgstAmount: r.cgstAmount,
      sgst: r.sgstAmount,
      sgstAmount: r.sgstAmount,
      cess: 0,
      total_amount: r.invoiceValue,
      invoiceValue: r.invoiceValue,
      type: r.type,
    });

    const summary = {
      taxable_amount: totals.totalTaxableValue,
      igst: totals.totalIgst,
      cgst: totals.totalCgst,
      sgst: totals.totalSgst,
      cess: 0,
      total_amount: totals.totalInvoiceValue,
    };

    const b2b = filteredRows.filter((r) => r.type === 'B2B').map(mapGstr1Row);
    const b2cl = filteredRows.filter((r) => r.type === 'B2CL').map(mapGstr1Row);
    const b2cs = filteredRows.filter((r) => r.type === 'B2CS').map(mapGstr1Row);

    return {
      rows: filteredRows.map(mapGstr1Row),
      totals,
      summary,
      b2b,
      b2cl,
      b2cs,
    };
  },

  /**
   * GSTR-2 Report (Inward Supplies / Purchase Invoices ITC)
   */
  async getGSTR2({ fromDate, toDate } = {}) {
    const invQuery = { status: 'Submitted', isReturn: false };
    if (fromDate || toDate) {
      invQuery.date = {};
      if (fromDate) invQuery.date.$gte = fromDate;
      if (toDate) invQuery.date.$lte = toDate;
    }

    const [invoices, parties] = await Promise.all([
      PurchaseInvoice.find(invQuery).sort({ date: 1 }).lean(),
      Party.find().lean(),
    ]);

    const rows = invoices.map((inv) => {
      const party = parties.find((p) => p.name === inv.party) || {};
      const gstin = party.gstin || '';

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      (inv.taxes || []).forEach((t) => {
        if (t.account === 'CGST') cgst += Number(t.amount) || 0;
        if (t.account === 'SGST') sgst += Number(t.amount) || 0;
        if (t.account === 'IGST') igst += Number(t.amount) || 0;
      });

      return {
        invoiceNumber: inv.invoiceNumber || inv.id,
        invoiceDate: inv.date,
        supplierName: inv.party,
        gstin,
        placeOfSupply: inv.placeOfSupply || 'Maharashtra',
        invoiceValue: Number(inv.grandTotal) || 0,
        taxableValue: Number(inv.netTotal) || 0,
        rate: inv.items?.[0]?.taxRate || 18,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalTax: cgst + sgst + igst,
        itcEligibility: 'Eligible (Inputs / Capital Goods)',
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.totalInvoiceValue += r.invoiceValue;
        acc.totalTaxableValue += r.taxableValue;
        acc.totalCgst += r.cgstAmount;
        acc.totalSgst += r.sgstAmount;
        acc.totalIgst += r.igstAmount;
        acc.totalTax += r.totalTax;
        return acc;
      },
      { totalInvoiceValue: 0, totalTaxableValue: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0 }
    );

    const mapGstr2Row = (r) => ({
      invoice_number: r.invoiceNumber,
      invoiceNumber: r.invoiceNumber,
      date: r.invoiceDate,
      invoiceDate: r.invoiceDate,
      supplier_name: r.supplierName,
      supplierName: r.supplierName,
      gstin: r.gstin,
      place_of_supply: r.placeOfSupply,
      placeOfSupply: r.placeOfSupply,
      taxable_amount: r.taxableValue,
      taxableValue: r.taxableValue,
      rate: r.rate,
      igst: r.igstAmount,
      igstAmount: r.igstAmount,
      cgst: r.cgstAmount,
      cgstAmount: r.cgstAmount,
      sgst: r.sgstAmount,
      sgstAmount: r.sgstAmount,
      cess: 0,
      itc_eligible: true,
      itcEligibility: r.itcEligibility,
      total_amount: r.invoiceValue,
      invoiceValue: r.invoiceValue,
    });

    const summary = {
      taxable_amount: totals.totalTaxableValue,
      igst: totals.totalIgst,
      cgst: totals.totalCgst,
      sgst: totals.totalSgst,
      cess: 0,
      total_itc_available: totals.totalTax,
      total_amount: totals.totalInvoiceValue,
    };

    return {
      rows: rows.map(mapGstr2Row),
      totals,
      summary,
      inward_supplies: rows.map(mapGstr2Row),
    };
  },

  /**
   * Acmaso Dashboard Summary
   */
  async getDashboardSummary() {
    const [salesInvoices, purchaseInvoices, parties, accounts, ledgerEntries, pnl] = await Promise.all([
      SalesInvoice.find().lean(),
      PurchaseInvoice.find().lean(),
      Party.find().lean(),
      Account.find().lean(),
      LedgerEntry.find({ reverted: false }).sort({ date: -1, createdAt: -1 }).limit(8).lean(),
      this.getProfitAndLoss(),
    ]);

    let totalSales = 0;
    let unpaidSales = 0;
    let paidSales = 0;
    salesInvoices.forEach((i) => {
      const g = Number(i.grandTotal) || 0;
      const o = Number(i.outstandingAmount) || 0;
      totalSales += g;
      unpaidSales += o;
      paidSales += Math.max(0, g - o);
    });

    let totalPurchases = 0;
    let unpaidPurchases = 0;
    purchaseInvoices.forEach((i) => {
      const g = Number(i.grandTotal) || 0;
      const o = Number(i.outstandingAmount) || 0;
      totalPurchases += g;
      unpaidPurchases += o;
    });

    // Bank & Cash Balances
    const bankAccount = accounts.find((a) => a.name === 'HDFC Bank Operating A/c');
    const cashAccount = accounts.find((a) => a.name === 'Cash');

    return {
      kpis: {
        bankBalance: bankAccount?.balance || 1550000,
        cashBalance: cashAccount?.balance || 150000,
        totalSales,
        paidSales,
        unpaidSales,
        totalPurchases,
        unpaidPurchases,
        netProfit: pnl.summary.netProfit,
        profitMargin: totalSales > 0 ? ((pnl.summary.netProfit / totalSales) * 100).toFixed(1) : '0',
        activeCustomersCount: parties.filter((p) => p.role === 'Customer' || p.role === 'Both').length,
        activeSuppliersCount: parties.filter((p) => p.role === 'Supplier' || p.role === 'Both').length,
      },
      pnlSummary: pnl.summary,
      recentTransactions: ledgerEntries,
      topExpenses: pnl.indirectExpenses.rows.slice(0, 5),
    };
  },
};
