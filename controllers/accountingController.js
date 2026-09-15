import {
  Account,
  Party,
  Item,
  SalesQuote,
  SalesInvoice,
  SalesPayment,
  PurchaseInvoice,
  PurchasePayment,
  JournalEntry,
  TaxTemplate,
  PaymentMethod,
  PrintTemplate,
  AccountingSetting,
  AccountingModel,
} from '../models/AccountingModel.js';
import { accountingEngine } from '../services/accountingEngine.js';
import { financialReports } from '../services/financialReports.js';
import { importService } from '../services/importService.js';

export const accountingController = {
  // --- Dashboard ---
  async getDashboard(_req, res) {
    try {
      const summary = await financialReports.getDashboardSummary();
      res.json({ success: true, data: summary });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Accounts & Chart of Accounts ---
  async getAccounts(_req, res) {
    try {
      const accounts = await Account.find().sort({ createdAt: 1 }).lean();
      res.json({ success: true, data: accounts });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createAccount(req, res) {
    try {
      const { name, accountType, rootType, parent, isGroup, balance } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Account name is required.' });

      const existing = await Account.findOne({ name: new RegExp(`^${name}$`, 'i') });
      if (existing) {
        return res.status(400).json({ success: false, message: `Account "${name}" already exists.` });
      }

      const newAccount = await Account.create({
        id: `acc-${Date.now()}`,
        name,
        accountType: accountType || 'General',
        rootType: rootType || 'Asset',
        parent: parent || null,
        isGroup: !!isGroup,
        balance: Number(balance) || 0,
      });

      await accountingEngine.recalculateBalances();
      res.status(201).json({ success: true, data: newAccount.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateAccount(req, res) {
    try {
      const { id } = req.params;
      const account = await Account.findOne({ $or: [{ id }, { name: id }] });
      if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });

      Object.assign(account, req.body);
      await account.save();
      await accountingEngine.recalculateBalances();

      res.json({ success: true, data: account.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteAccount(req, res) {
    try {
      const { id } = req.params;
      const target = await Account.findOne({ $or: [{ id }, { name: id }] });
      if (!target) return res.status(404).json({ success: false, message: 'Account not found.' });

      // Check if account has child accounts
      const hasChildren = await Account.exists({ parent: target.name });
      if (hasChildren) {
        return res.status(400).json({ success: false, message: 'Cannot delete account with child sub-accounts.' });
      }

      await Account.deleteOne({ _id: target._id });
      res.json({ success: true, message: `Account "${target.name}" deleted successfully.` });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Parties (Customers & Suppliers) ---
  async getParties(req, res) {
    try {
      const { role } = req.query;
      const filter = {};
      if (role && role !== 'All') {
        filter.$or = [{ role }, { role: 'Both' }];
      }
      const parties = await Party.find(filter).sort({ createdAt: 1 }).lean();
      res.json({ success: true, data: parties });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createParty(req, res) {
    try {
      const { name, role, gstin, pan, email, phone, address, placeOfSupply, defaultAccount, openingBalance, outstandingAmount, status } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Party name is required.' });

      const newParty = await Party.create({
        id: `party-${Date.now()}`,
        name,
        role: role || 'Customer',
        gstin: gstin || '',
        pan: pan || '',
        email: email || '',
        phone: phone || '',
        address: address || '',
        placeOfSupply: placeOfSupply || 'Maharashtra',
        defaultAccount: defaultAccount || (role === 'Supplier' ? 'Creditors' : 'Debtors'),
        openingBalance: Number(openingBalance) || 0,
        outstandingAmount: Number(outstandingAmount) || Number(openingBalance) || 0,
        status: status || 'Active',
      });

      res.status(201).json({ success: true, data: newParty.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateParty(req, res) {
    try {
      const { id } = req.params;
      const party = await Party.findOne({ $or: [{ id }, { name: id }] });
      if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });

      Object.assign(party, req.body);
      await party.save();

      res.json({ success: true, data: party.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteParty(req, res) {
    try {
      const { id } = req.params;
      await Party.deleteOne({ $or: [{ id }, { name: id }] });
      res.json({ success: true, message: 'Party deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Items Master ---
  async getItems(_req, res) {
    try {
      const items = await Item.find().sort({ createdAt: 1 }).lean();
      res.json({ success: true, data: items });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createItem(req, res) {
    try {
      const { name, code, description, category, unit, rate, purchaseRate, hsnSac, incomeAccount, expenseAccount, taxTemplate, taxRate, status } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Item name is required.' });

      const newItem = await Item.create({
        id: `item-${Date.now()}`,
        code: code || `MED-${Date.now().toString().slice(-4)}`,
        name,
        description: description || '',
        category: category || 'Medical Equipment',
        unit: unit || 'Nos',
        rate: Number(rate) || 0,
        purchaseRate: Number(purchaseRate) || 0,
        hsnSac: hsnSac || '',
        incomeAccount: incomeAccount || 'Sales',
        expenseAccount: expenseAccount || 'Cost of Goods Sold',
        taxTemplate: taxTemplate || 'tax-1',
        taxRate: taxRate !== undefined ? Number(taxRate) : 18,
        status: status || 'Active',
      });

      res.status(201).json({ success: true, data: newItem.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateItem(req, res) {
    try {
      const { id } = req.params;
      const item = await Item.findOne({ $or: [{ id }, { code: id }] });
      if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

      Object.assign(item, req.body);
      await item.save();

      res.json({ success: true, data: item.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      await Item.deleteOne({ $or: [{ id }, { code: id }] });
      res.json({ success: true, message: 'Item deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Sales Quotes ---
  async getSalesQuotes(_req, res) {
    try {
      const quotes = await SalesQuote.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: quotes });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createSalesQuote(req, res) {
    try {
      const { party, date, validUntil, items, currency, notes, status } = req.body;
      if (!party) return res.status(400).json({ success: false, message: 'Party / Customer is required.' });
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one item is required.' });
      }

      let netTotal = 0;
      let taxTotal = 0;
      const processedItems = items.map((it) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || 0;
        const amount = qty * rate;
        const taxRate = Number(it.taxRate) || 18;
        const taxAmount = (amount * taxRate) / 100;
        const total = amount + taxAmount;
        netTotal += amount;
        taxTotal += taxAmount;

        return {
          ...it,
          quantity: qty,
          rate,
          amount,
          taxRate,
          taxAmount,
          total,
          account: it.account || 'Sales',
        };
      });

      const grandTotal = netTotal + taxTotal;
      const quoteCount = await SalesQuote.countDocuments();
      const quoteNumber = `SQ-2026-${String(quoteCount + 1).padStart(3, '0')}`;

      const newQuote = await SalesQuote.create({
        id: quoteNumber,
        quoteNumber,
        party,
        date: date || new Date().toISOString().split('T')[0],
        validUntil: validUntil || '',
        status: status || 'Draft',
        currency: currency || 'INR',
        items: processedItems,
        netTotal,
        taxTotal,
        grandTotal,
        notes: notes || '',
        convertedToInvoice: null,
      });

      res.status(201).json({ success: true, data: newQuote.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async convertQuoteToInvoice(req, res) {
    try {
      const { id } = req.params;
      const quote = await SalesQuote.findOne({ $or: [{ id }, { quoteNumber: id }] });
      if (!quote) return res.status(404).json({ success: false, message: 'Sales Quote not found.' });

      const invoiceCount = await SalesInvoice.countDocuments();
      const invoiceNumber = `SINV-2026-${String(invoiceCount + 1).padStart(3, '0')}`;

      const cgstAmt = quote.taxTotal / 2;
      const sgstAmt = quote.taxTotal / 2;

      const newInvoice = await SalesInvoice.create({
        id: invoiceNumber,
        invoiceNumber,
        party: quote.party,
        account: 'Debtors',
        date: new Date().toISOString().split('T')[0],
        dueDate: quote.validUntil || '',
        status: 'Submitted',
        paymentStatus: 'Unpaid',
        currency: quote.currency || 'INR',
        placeOfSupply: 'Maharashtra',
        isReturn: false,
        items: quote.items,
        taxes: [
          { account: 'CGST', rate: 9, amount: cgstAmt },
          { account: 'SGST', rate: 9, amount: sgstAmt },
        ],
        netTotal: quote.netTotal,
        discountTotal: 0,
        taxTotal: quote.taxTotal,
        grandTotal: quote.grandTotal,
        outstandingAmount: quote.grandTotal,
        notes: `Converted from Quote ${quote.quoteNumber}. ${quote.notes || ''}`,
      });

      // Mark quote as accepted
      quote.status = 'Accepted';
      quote.convertedToInvoice = invoiceNumber;
      await quote.save();

      // Post to Ledger
      await accountingEngine.postSalesInvoice(newInvoice);

      res.json({ success: true, data: newInvoice.toObject(), quote: quote.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateSalesQuote(req, res) {
    try {
      const { id } = req.params;
      const quote = await SalesQuote.findOne({ $or: [{ id }, { quoteNumber: id }] });
      if (!quote) return res.status(404).json({ success: false, message: 'Sales Quote not found.' });

      const { party, date, validUntil, items, currency, notes, status } = req.body;
      if (party) quote.party = party;
      if (date) quote.date = date;
      if (validUntil !== undefined) quote.validUntil = validUntil;
      if (currency) quote.currency = currency;
      if (notes !== undefined) quote.notes = notes;
      if (status) quote.status = status;

      if (Array.isArray(items) && items.length > 0) {
        let netTotal = 0;
        let taxTotal = 0;
        let discountTotal = 0;
        const processedItems = items.map((it) => {
          const qty = Number(it.quantity) || 1;
          const rate = Number(it.rate) || 0;
          const discPct = Number(it.discountPercent) || 0;
          const rawAmt = qty * rate;
          const discAmt = Number(it.discountAmount) || (rawAmt * discPct) / 100;
          const taxableAmt = Math.max(0, rawAmt - discAmt);
          const taxRate = Number(it.taxRate) || 18;
          const taxAmt = (taxableAmt * taxRate) / 100;
          const total = taxableAmt + taxAmt;

          netTotal += taxableAmt;
          discountTotal += discAmt;
          taxTotal += taxAmt;

          return {
            ...it,
            quantity: qty,
            rate,
            discountPercent: discPct,
            discountAmount: discAmt,
            amount: taxableAmt,
            taxRate,
            taxAmount: taxAmt,
            total,
            account: it.account || 'Sales',
          };
        });

        quote.items = processedItems;
        quote.netTotal = netTotal;
        quote.discountTotal = discountTotal;
        quote.taxTotal = taxTotal;
        quote.grandTotal = netTotal + taxTotal;
      }

      await quote.save();
      res.json({ success: true, data: quote.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteSalesQuote(req, res) {
    try {
      const { id } = req.params;
      await SalesQuote.deleteOne({ $or: [{ id }, { quoteNumber: id }] });
      res.json({ success: true, message: 'Sales quote deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Sales Invoices ---
  async getSalesInvoices(_req, res) {
    try {
      const invoices = await SalesInvoice.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: invoices });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createSalesInvoice(req, res) {
    try {
      const { party, account, date, dueDate, items, placeOfSupply, notes, status, isReturn } = req.body;
      if (!party) return res.status(400).json({ success: false, message: 'Customer / Party is required.' });
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one item is required.' });
      }

      let netTotal = 0;
      let taxTotal = 0;
      let discountTotal = 0;
      const processedItems = items.map((it) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || 0;
        const discPct = Number(it.discountPercent) || 0;
        const rawAmt = qty * rate;
        const discAmt = Number(it.discountAmount) || (rawAmt * discPct) / 100;
        const taxableAmt = Math.max(0, rawAmt - discAmt);
        const taxRate = Number(it.taxRate) || 18;
        const taxAmount = (taxableAmt * taxRate) / 100;
        const total = taxableAmt + taxAmount;

        netTotal += taxableAmt;
        discountTotal += discAmt;
        taxTotal += taxAmount;

        return {
          ...it,
          quantity: qty,
          rate,
          discountPercent: discPct,
          discountAmount: discAmt,
          amount: taxableAmt,
          taxRate,
          taxAmount,
          total,
          account: it.account || 'Sales',
        };
      });

      const grandTotal = netTotal + taxTotal;
      const invoiceCount = await SalesInvoice.countDocuments();
      const invoiceNumber = `SINV-2026-${String(invoiceCount + 1).padStart(3, '0')}`;

      const cgstAmt = taxTotal / 2;
      const sgstAmt = taxTotal / 2;

      const newInvoice = await SalesInvoice.create({
        id: invoiceNumber,
        invoiceNumber,
        party,
        account: account || 'Debtors',
        date: date || new Date().toISOString().split('T')[0],
        dueDate: dueDate || '',
        status: status || 'Submitted',
        paymentStatus: 'Unpaid',
        currency: 'INR',
        placeOfSupply: placeOfSupply || 'Maharashtra',
        isReturn: !!isReturn,
        items: processedItems,
        taxes: [
          { account: 'CGST', rate: 9, amount: cgstAmt },
          { account: 'SGST', rate: 9, amount: sgstAmt },
        ],
        netTotal,
        discountTotal,
        taxTotal,
        grandTotal,
        outstandingAmount: grandTotal,
        notes: notes || '',
      });

      if (newInvoice.status === 'Submitted') {
        await accountingEngine.postSalesInvoice(newInvoice);
      }

      res.status(201).json({ success: true, data: newInvoice.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateSalesInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await SalesInvoice.findOne({ $or: [{ id }, { invoiceNumber: id }] });
      if (!invoice) return res.status(404).json({ success: false, message: 'Sales invoice not found.' });

      const { party, account, date, dueDate, items, placeOfSupply, notes, status } = req.body;
      const wasSubmitted = invoice.status === 'Submitted';

      if (wasSubmitted) {
        await accountingEngine.revertTransaction('SalesInvoice', invoice.invoiceNumber || invoice.id);
      }

      if (party) invoice.party = party;
      if (account) invoice.account = account;
      if (date) invoice.date = date;
      if (dueDate !== undefined) invoice.dueDate = dueDate;
      if (placeOfSupply) invoice.placeOfSupply = placeOfSupply;
      if (notes !== undefined) invoice.notes = notes;
      if (status) invoice.status = status;

      if (Array.isArray(items) && items.length > 0) {
        let netTotal = 0;
        let taxTotal = 0;
        let discountTotal = 0;
        const processedItems = items.map((it) => {
          const qty = Number(it.quantity) || 1;
          const rate = Number(it.rate) || 0;
          const discPct = Number(it.discountPercent) || 0;
          const rawAmt = qty * rate;
          const discAmt = Number(it.discountAmount) || (rawAmt * discPct) / 100;
          const taxableAmt = Math.max(0, rawAmt - discAmt);
          const taxRate = Number(it.taxRate) || 18;
          const taxAmount = (taxableAmt * taxRate) / 100;
          const total = taxableAmt + taxAmount;

          netTotal += taxableAmt;
          discountTotal += discAmt;
          taxTotal += taxAmount;

          return {
            ...it,
            quantity: qty,
            rate,
            discountPercent: discPct,
            discountAmount: discAmt,
            amount: taxableAmt,
            taxRate,
            taxAmount,
            total,
            account: it.account || 'Sales',
          };
        });

        invoice.items = processedItems;
        invoice.netTotal = netTotal;
        invoice.discountTotal = discountTotal;
        invoice.taxTotal = taxTotal;
        invoice.grandTotal = netTotal + taxTotal;

        const paidSoFar = Math.max(0, (invoice.grandTotal || 0) - (invoice.outstandingAmount || 0));
        invoice.outstandingAmount = Math.max(0, invoice.grandTotal - paidSoFar);
        invoice.taxes = [
          { account: 'CGST', rate: 9, amount: taxTotal / 2 },
          { account: 'SGST', rate: 9, amount: taxTotal / 2 },
        ];
      }

      await invoice.save();

      if (invoice.status === 'Submitted') {
        await accountingEngine.postSalesInvoice(invoice);
      } else {
        await accountingEngine.recalculateBalances();
      }

      res.json({ success: true, data: invoice.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async cancelSalesInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await SalesInvoice.findOne({ $or: [{ id }, { invoiceNumber: id }] });
      if (!invoice) return res.status(404).json({ success: false, message: 'Sales invoice not found.' });

      invoice.status = 'Cancelled';
      await invoice.save();
      await accountingEngine.revertTransaction('SalesInvoice', invoice.invoiceNumber || invoice.id);

      res.json({ success: true, data: invoice.toObject(), message: 'Sales invoice cancelled and ledger entries reverted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteSalesInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await SalesInvoice.findOne({ $or: [{ id }, { invoiceNumber: id }] });
      if (invoice) {
        await accountingEngine.revertTransaction('SalesInvoice', invoice.invoiceNumber || invoice.id);
        await SalesInvoice.deleteOne({ _id: invoice._id });
      }
      res.json({ success: true, message: 'Sales invoice deleted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Sales Payments ---
  async getSalesPayments(_req, res) {
    try {
      const payments = await SalesPayment.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: payments });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createSalesPayment(req, res) {
    try {
      const { party, paymentMethod, account, paymentAccount, date, amount, referenceNumber, forInvoice, notes } = req.body;
      if (!party) return res.status(400).json({ success: false, message: 'Party / Customer is required.' });
      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });

      const paymentCount = await SalesPayment.countDocuments();
      const paymentNumber = `SPAY-2026-${String(paymentCount + 1).padStart(3, '0')}`;

      const newPayment = await SalesPayment.create({
        id: paymentNumber,
        paymentNumber,
        party,
        paymentType: 'Receive',
        paymentMethod: paymentMethod || 'Bank Transfer (NEFT/RTGS/IMPS)',
        account: account || 'Debtors',
        paymentAccount: paymentAccount || 'HDFC Bank Operating A/c',
        date: date || new Date().toISOString().split('T')[0],
        amount: payAmount,
        referenceNumber: referenceNumber || '',
        for: forInvoice ? [{ referenceType: 'SalesInvoice', referenceName: forInvoice, amount: payAmount }] : [],
        status: 'Submitted',
        notes: notes || '',
      });

      await accountingEngine.postPayment(newPayment);
      res.status(201).json({ success: true, data: newPayment.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteSalesPayment(req, res) {
    try {
      const { id } = req.params;
      const payment = await SalesPayment.findOne({ $or: [{ id }, { paymentNumber: id }] });
      if (!payment) return res.status(404).json({ success: false, message: 'Sales Payment not found.' });

      // Revert ledger transaction
      await accountingEngine.revertTransaction('Payment', payment.paymentNumber || payment.id);

      // Restore outstanding amounts on referenced invoices
      if (Array.isArray(payment.for)) {
        for (const ref of payment.for) {
          if (ref.referenceType === 'SalesInvoice') {
            const inv = await SalesInvoice.findOne({
              $or: [{ invoiceNumber: ref.referenceName }, { id: ref.referenceName }],
            });
            if (inv) {
              const restoredAmt = Number(ref.amount) || 0;
              inv.outstandingAmount = Math.min(inv.grandTotal, (Number(inv.outstandingAmount) || 0) + restoredAmt);
              inv.paymentStatus = inv.outstandingAmount >= inv.grandTotal ? 'Unpaid' : 'Partially Paid';
              await inv.save();
            }
          }
        }
      }

      await SalesPayment.deleteOne({ _id: payment._id });
      await accountingEngine.recalculateBalances();

      res.json({ success: true, message: 'Payment receipt removed and balances updated.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Purchase Invoices ---
  async getPurchaseInvoices(_req, res) {
    try {
      const invoices = await PurchaseInvoice.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: invoices });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createPurchaseInvoice(req, res) {
    try {
      const { party, account, date, dueDate, items, placeOfSupply, notes, status, isReturn } = req.body;
      if (!party) return res.status(400).json({ success: false, message: 'Supplier / Vendor is required.' });
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one item is required.' });
      }

      let netTotal = 0;
      let taxTotal = 0;
      const processedItems = items.map((it) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || 0;
        const amount = qty * rate;
        const taxRate = Number(it.taxRate) || 18;
        const taxAmount = (amount * taxRate) / 100;
        const total = amount + taxAmount;
        netTotal += amount;
        taxTotal += taxAmount;

        return {
          ...it,
          quantity: qty,
          rate,
          amount,
          taxRate,
          taxAmount,
          total,
          account: it.account || 'Stock In Hand',
        };
      });

      const grandTotal = netTotal + taxTotal;
      const invoiceCount = await PurchaseInvoice.countDocuments();
      const invoiceNumber = `PINV-2026-${String(invoiceCount + 1).padStart(3, '0')}`;

      const cgstAmt = taxTotal / 2;
      const sgstAmt = taxTotal / 2;

      const newInvoice = await PurchaseInvoice.create({
        id: invoiceNumber,
        invoiceNumber,
        party,
        account: account || 'Creditors',
        date: date || new Date().toISOString().split('T')[0],
        dueDate: dueDate || '',
        status: status || 'Submitted',
        paymentStatus: 'Unpaid',
        currency: 'INR',
        placeOfSupply: placeOfSupply || 'Maharashtra',
        isReturn: !!isReturn,
        items: processedItems,
        taxes: [
          { account: 'CGST', rate: 9, amount: cgstAmt },
          { account: 'SGST', rate: 9, amount: sgstAmt },
        ],
        netTotal,
        discountTotal: 0,
        taxTotal,
        grandTotal,
        outstandingAmount: grandTotal,
        notes: notes || '',
      });

      if (newInvoice.status === 'Submitted') {
        await accountingEngine.postPurchaseInvoice(newInvoice);
      }

      res.status(201).json({ success: true, data: newInvoice.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async cancelPurchaseInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await PurchaseInvoice.findOne({ $or: [{ id }, { invoiceNumber: id }] });
      if (!invoice) return res.status(404).json({ success: false, message: 'Purchase invoice not found.' });

      invoice.status = 'Cancelled';
      await invoice.save();
      await accountingEngine.revertTransaction('PurchaseInvoice', invoice.invoiceNumber || invoice.id);

      res.json({ success: true, data: invoice.toObject(), message: 'Purchase invoice cancelled and ledger entries reverted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deletePurchaseInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await PurchaseInvoice.findOne({ $or: [{ id }, { invoiceNumber: id }] });
      if (invoice) {
        await accountingEngine.revertTransaction('PurchaseInvoice', invoice.invoiceNumber || invoice.id);
        await PurchaseInvoice.deleteOne({ _id: invoice._id });
      }
      res.json({ success: true, message: 'Purchase invoice deleted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Purchase Payments ---
  async getPurchasePayments(_req, res) {
    try {
      const payments = await PurchasePayment.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: payments });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createPurchasePayment(req, res) {
    try {
      const { party, paymentMethod, account, paymentAccount, date, amount, referenceNumber, forInvoice, notes } = req.body;
      if (!party) return res.status(400).json({ success: false, message: 'Supplier is required.' });
      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });

      const paymentCount = await PurchasePayment.countDocuments();
      const paymentNumber = `PPAY-2026-${String(paymentCount + 1).padStart(3, '0')}`;

      const newPayment = await PurchasePayment.create({
        id: paymentNumber,
        paymentNumber,
        party,
        paymentType: 'Pay',
        paymentMethod: paymentMethod || 'Bank Transfer (NEFT/RTGS/IMPS)',
        account: account || 'Creditors',
        paymentAccount: paymentAccount || 'HDFC Bank Operating A/c',
        date: date || new Date().toISOString().split('T')[0],
        amount: payAmount,
        referenceNumber: referenceNumber || '',
        for: forInvoice ? [{ referenceType: 'PurchaseInvoice', referenceName: forInvoice, amount: payAmount }] : [],
        status: 'Submitted',
        notes: notes || '',
      });

      await accountingEngine.postPayment(newPayment);
      res.status(201).json({ success: true, data: newPayment.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Journal Entries ---
  async getJournalEntries(_req, res) {
    try {
      const entries = await JournalEntry.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: entries });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createJournalEntry(req, res) {
    try {
      const { date, entryType, referenceNumber, userRemark, accounts } = req.body;
      if (!Array.isArray(accounts) || accounts.length < 2) {
        return res.status(400).json({ success: false, message: 'A journal voucher requires at least two account lines.' });
      }

      let totalDebit = 0;
      let totalCredit = 0;
      const processedAccounts = accounts.map((row) => {
        const debit = Number(row.debit) || 0;
        const credit = Number(row.credit) || 0;
        totalDebit += debit;
        totalCredit += credit;
        return {
          account: row.account,
          debit,
          credit,
          party: row.party || '',
        };
      });

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Unbalanced journal entry: Total Debit (₹${totalDebit.toFixed(2)}) must equal Total Credit (₹${totalCredit.toFixed(2)}).`,
        });
      }

      const journalCount = await JournalEntry.countDocuments();
      const entryNumber = `JV-2026-${String(journalCount + 1).padStart(3, '0')}`;

      const newJournal = await JournalEntry.create({
        id: entryNumber,
        entryNumber,
        date: date || new Date().toISOString().split('T')[0],
        entryType: entryType || 'Journal Entry',
        referenceNumber: referenceNumber || '',
        status: 'Submitted',
        userRemark: userRemark || '',
        accounts: processedAccounts,
        totalDebit,
        totalCredit,
      });

      await accountingEngine.postJournalEntry(newJournal);
      res.status(201).json({ success: true, data: newJournal.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async cancelJournalEntry(req, res) {
    try {
      const { id } = req.params;
      const journal = await JournalEntry.findOne({ $or: [{ id }, { entryNumber: id }] });
      if (!journal) return res.status(404).json({ success: false, message: 'Journal entry not found.' });

      journal.status = 'Cancelled';
      await journal.save();
      await accountingEngine.revertTransaction('JournalEntry', journal.entryNumber || journal.id);

      res.json({ success: true, data: journal.toObject(), message: 'Journal entry cancelled and ledger postings reverted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Reports ---
  async getGeneralLedger(req, res) {
    try {
      const report = await financialReports.getGeneralLedger(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getTrialBalance(req, res) {
    try {
      const report = await financialReports.getTrialBalance(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getProfitAndLoss(req, res) {
    try {
      const report = await financialReports.getProfitAndLoss(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getBalanceSheet(req, res) {
    try {
      const report = await financialReports.getBalanceSheet(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- GST Reports ---
  async getGSTR1(req, res) {
    try {
      const report = await financialReports.getGSTR1(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getGSTR2(req, res) {
    try {
      const report = await financialReports.getGSTR2(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Tax Templates & Payment Methods ---
  async getTaxTemplates(_req, res) {
    try {
      const templates = await TaxTemplate.find().sort({ createdAt: 1 }).lean();
      res.json({ success: true, data: templates });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createTaxTemplate(req, res) {
    try {
      const { name, rate, details } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Tax template name is required.' });

      const newTemplate = await TaxTemplate.create({
        id: `tax-${Date.now()}`,
        name,
        rate: Number(rate) || 0,
        isDefault: false,
        details: Array.isArray(details) ? details : [],
      });

      res.status(201).json({ success: true, data: newTemplate.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getPaymentMethods(_req, res) {
    try {
      const methods = await PaymentMethod.find().sort({ createdAt: 1 }).lean();
      res.json({ success: true, data: methods });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Print Templates ---
  async getPrintTemplates(_req, res) {
    try {
      const templates = await PrintTemplate.find().sort({ createdAt: 1 }).lean();
      res.json({ success: true, data: templates });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updatePrintTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = await PrintTemplate.findOne({ id });
      if (!template) return res.status(404).json({ success: false, message: 'Print template not found.' });

      Object.assign(template, req.body);
      await template.save();

      res.json({ success: true, data: template.toObject() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // --- Settings & Import ---
  async getSettings(_req, res) {
    try {
      const settings = await AccountingModel.getSettings();
      res.json({ success: true, data: settings });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateSettings(req, res) {
    try {
      const settings = await AccountingModel.updateSettings(req.body);
      res.json({ success: true, data: settings, message: 'Accounting settings updated successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async resetData(_req, res) {
    try {
      const defaultData = await AccountingModel.resetToDefaults();
      await accountingEngine.recalculateBalances();
      res.json({ success: true, data: defaultData, message: 'Accounting database reset to baseline standard data.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async importCsv(req, res) {
    try {
      const { targetType, csvText } = req.body;
      if (!targetType) return res.status(400).json({ success: false, message: 'Target import type is required.' });
      if (!csvText) return res.status(400).json({ success: false, message: 'CSV text content is required.' });

      const result = await importService.processCsvImport(targetType, csvText);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },
};
