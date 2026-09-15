import { Account } from './Account.js';
import { Party } from './Party.js';
import { Item } from './Item.js';
import { SalesQuote } from './SalesQuote.js';
import { SalesInvoice } from './SalesInvoice.js';
import { SalesPayment } from './SalesPayment.js';
import { PurchaseInvoice } from './PurchaseInvoice.js';
import { PurchasePayment } from './PurchasePayment.js';
import { JournalEntry } from './JournalEntry.js';
import { LedgerEntry } from './LedgerEntry.js';
import { TaxTemplate } from './TaxTemplate.js';
import { PaymentMethod } from './PaymentMethod.js';
import { PrintTemplate } from './PrintTemplate.js';
import { AccountingSetting } from './AccountingSetting.js';
import { defaultAccountingData } from '../data/defaultAccountingData.js';

export const modelMap = {
  accounts: Account,
  parties: Party,
  items: Item,
  salesQuotes: SalesQuote,
  salesInvoices: SalesInvoice,
  salesPayments: SalesPayment,
  purchaseInvoices: PurchaseInvoice,
  purchasePayments: PurchasePayment,
  journalEntries: JournalEntry,
  ledgerEntries: LedgerEntry,
  taxTemplates: TaxTemplate,
  paymentMethods: PaymentMethod,
  printTemplates: PrintTemplate,
};

export {
  Account,
  Party,
  Item,
  SalesQuote,
  SalesInvoice,
  SalesPayment,
  PurchaseInvoice,
  PurchasePayment,
  JournalEntry,
  LedgerEntry,
  TaxTemplate,
  PaymentMethod,
  PrintTemplate,
  AccountingSetting,
};

export const AccountingModel = {
  async getData() {
    const [
      settingsDoc,
      accounts,
      parties,
      items,
      salesQuotes,
      salesInvoices,
      salesPayments,
      purchaseInvoices,
      purchasePayments,
      journalEntries,
      ledgerEntries,
      taxTemplates,
      paymentMethods,
      printTemplates,
    ] = await Promise.all([
      AccountingSetting.findOne({ key: 'main_settings' }).lean(),
      Account.find().sort({ createdAt: 1 }).lean(),
      Party.find().sort({ createdAt: 1 }).lean(),
      Item.find().sort({ createdAt: 1 }).lean(),
      SalesQuote.find().sort({ createdAt: -1 }).lean(),
      SalesInvoice.find().sort({ createdAt: -1 }).lean(),
      SalesPayment.find().sort({ createdAt: -1 }).lean(),
      PurchaseInvoice.find().sort({ createdAt: -1 }).lean(),
      PurchasePayment.find().sort({ createdAt: -1 }).lean(),
      JournalEntry.find().sort({ createdAt: -1 }).lean(),
      LedgerEntry.find().sort({ date: 1, createdAt: 1 }).lean(),
      TaxTemplate.find().sort({ createdAt: 1 }).lean(),
      PaymentMethod.find().sort({ createdAt: 1 }).lean(),
      PrintTemplate.find().sort({ createdAt: 1 }).lean(),
    ]);

    return {
      settings: settingsDoc || defaultAccountingData.settings,
      accounts: accounts || [],
      parties: parties || [],
      items: items || [],
      salesQuotes: salesQuotes || [],
      salesInvoices: salesInvoices || [],
      salesPayments: salesPayments || [],
      purchaseInvoices: purchaseInvoices || [],
      purchasePayments: purchasePayments || [],
      journalEntries: journalEntries || [],
      ledgerEntries: ledgerEntries || [],
      taxTemplates: taxTemplates || [],
      paymentMethods: paymentMethods || [],
      printTemplates: printTemplates || [],
    };
  },

  async getCollection(name) {
    const Model = modelMap[name];
    if (!Model) {
      if (name === 'settings') {
        const s = await AccountingSetting.findOne({ key: 'main_settings' }).lean();
        return s || defaultAccountingData.settings;
      }
      return [];
    }
    return await Model.find().sort(name.includes('Invoice') || name.includes('Payment') || name.includes('Quote') || name.includes('journal') ? { createdAt: -1 } : { createdAt: 1 }).lean();
  },

  async saveCollection(name, items) {
    const Model = modelMap[name];
    if (!Model) return items;
    await Model.deleteMany({});
    if (items && items.length > 0) {
      await Model.insertMany(items);
    }
    return items;
  },

  async getSettings() {
    let settings = await AccountingSetting.findOne({ key: 'main_settings' }).lean();
    if (!settings) {
      settings = await AccountingSetting.create({
        key: 'main_settings',
        ...defaultAccountingData.settings,
      });
      return settings.toObject();
    }
    return settings;
  },

  async updateSettings(newSettings) {
    let settings = await AccountingSetting.findOne({ key: 'main_settings' });
    if (!settings) {
      settings = new AccountingSetting({
        key: 'main_settings',
        ...defaultAccountingData.settings,
        ...newSettings,
      });
    } else {
      Object.assign(settings, newSettings);
    }
    await settings.save();
    return settings.toObject();
  },

  async resetToDefaults() {
    await Promise.all([
      Account.deleteMany({}),
      Party.deleteMany({}),
      Item.deleteMany({}),
      SalesQuote.deleteMany({}),
      SalesInvoice.deleteMany({}),
      SalesPayment.deleteMany({}),
      PurchaseInvoice.deleteMany({}),
      PurchasePayment.deleteMany({}),
      JournalEntry.deleteMany({}),
      LedgerEntry.deleteMany({}),
      TaxTemplate.deleteMany({}),
      PaymentMethod.deleteMany({}),
      PrintTemplate.deleteMany({}),
      AccountingSetting.deleteMany({}),
    ]);

    await Promise.all([
      Account.insertMany(defaultAccountingData.accounts),
      Party.insertMany(defaultAccountingData.parties),
      Item.insertMany(defaultAccountingData.items),
      SalesQuote.insertMany(defaultAccountingData.salesQuotes),
      SalesInvoice.insertMany(defaultAccountingData.salesInvoices),
      SalesPayment.insertMany(defaultAccountingData.salesPayments),
      PurchaseInvoice.insertMany(defaultAccountingData.purchaseInvoices),
      PurchasePayment.insertMany(defaultAccountingData.purchasePayments),
      JournalEntry.insertMany(defaultAccountingData.journalEntries),
      LedgerEntry.insertMany(defaultAccountingData.ledgerEntries),
      TaxTemplate.insertMany(defaultAccountingData.taxTemplates),
      PaymentMethod.insertMany(defaultAccountingData.paymentMethods),
      PrintTemplate.insertMany(defaultAccountingData.printTemplates),
      AccountingSetting.create({
        key: 'main_settings',
        ...defaultAccountingData.settings,
      }),
    ]);

    return defaultAccountingData;
  },
};
