import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LandingPageContent } from '../models/LandingPageContent.js';
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
  LedgerEntry,
  TaxTemplate,
  PaymentMethod,
  PrintTemplate,
  AccountingSetting,
} from '../models/AccountingModel.js';
import { defaultLandingPageContent } from '../data/defaultLandingPageContent.js';
import { defaultAccountingData } from '../data/defaultAccountingData.js';
import { accountingEngine } from './accountingEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigration() {
  console.log('🔄 Checking MongoDB migration status...');

  // 1. Check & Migrate CMS Content (Idempotent per document key)
  try {
    const existingCms = await LandingPageContent.findOne({ key: 'main_cms_content' }).lean();
    if (!existingCms) {
      console.log('📦 Seeding initial CMS JSON data to MongoDB...');
      const cmsJsonPath = path.join(__dirname, '../data/cms_database.json');
      let cmsData = null;

      if (fs.existsSync(cmsJsonPath)) {
        try {
          const raw = fs.readFileSync(cmsJsonPath, 'utf-8');
          cmsData = JSON.parse(raw);
        } catch (e) {
          console.warn('⚠️ Could not parse cms_database.json, using default seed:', e.message);
        }
      }

      const live = cmsData?.live || { ...defaultLandingPageContent, status: 'published' };
      const draft = cmsData?.draft || { ...defaultLandingPageContent, status: 'draft' };
      const history = Array.isArray(cmsData?.history) ? cmsData.history : [];

      await LandingPageContent.findOneAndUpdate(
        { key: 'main_cms_content' },
        {
          $setOnInsert: {
            key: 'main_cms_content',
            live,
            draft,
            history,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('✅ CMS data seeded to MongoDB.');
    } else {
      console.log('ℹ️ CMS collection already populated (1 record) - skipped.');
    }
  } catch (err) {
    console.error('❌ CMS migration error:', err.message);
  }

  // 2. Check & Migrate Accounting Database (Granular per-collection idempotency)
  try {
    const acctJsonPath = path.join(__dirname, '../data/accounting_database.json');
    let acctData = defaultAccountingData;

    if (fs.existsSync(acctJsonPath)) {
      try {
        const raw = fs.readFileSync(acctJsonPath, 'utf-8');
        acctData = JSON.parse(raw);
      } catch (e) {
        console.warn('⚠️ Could not parse accounting_database.json, using default seed:', e.message);
      }
    }

    // 2a. Accounting Settings
    const existingSettings = await AccountingSetting.findOne({ key: 'main_settings' }).lean();
    if (!existingSettings) {
      const settings = acctData.settings || defaultAccountingData.settings;
      await AccountingSetting.findOneAndUpdate(
        { key: 'main_settings' },
        {
          $setOnInsert: {
            key: 'main_settings',
            ...settings,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('✅ Accounting settings seeded.');
    }

    // 2b. Granular check for each accounting collection
    const accountingCollections = [
      { key: 'accounts', model: Account, name: 'Account' },
      { key: 'parties', model: Party, name: 'Party' },
      { key: 'items', model: Item, name: 'Item' },
      { key: 'salesQuotes', model: SalesQuote, name: 'SalesQuote' },
      { key: 'salesInvoices', model: SalesInvoice, name: 'SalesInvoice' },
      { key: 'salesPayments', model: SalesPayment, name: 'SalesPayment' },
      { key: 'purchaseInvoices', model: PurchaseInvoice, name: 'PurchaseInvoice' },
      { key: 'purchasePayments', model: PurchasePayment, name: 'PurchasePayment' },
      { key: 'journalEntries', model: JournalEntry, name: 'JournalEntry' },
      { key: 'ledgerEntries', model: LedgerEntry, name: 'LedgerEntry' },
      { key: 'taxTemplates', model: TaxTemplate, name: 'TaxTemplate' },
      { key: 'paymentMethods', model: PaymentMethod, name: 'PaymentMethod' },
      { key: 'printTemplates', model: PrintTemplate, name: 'PrintTemplate' },
    ];

    let collectionsSeededCount = 0;
    let seededAccountsOrLedger = false;

    for (const { key, model, name } of accountingCollections) {
      const count = await model.countDocuments();
      if (count === 0) {
        const seedItems = acctData[key];
        if (Array.isArray(seedItems) && seedItems.length > 0) {
          await model.insertMany(seedItems, { ordered: false });
          console.log(`📦 Seeded ${seedItems.length} records into ${name}.`);
          collectionsSeededCount++;
          if (name === 'Account' || name === 'LedgerEntry') {
            seededAccountsOrLedger = true;
          }
        }
      }
    }

    if (seededAccountsOrLedger) {
      await accountingEngine.recalculateBalances();
      console.log('✅ Accounting initial balances calculated.');
    }

    if (collectionsSeededCount === 0) {
      console.log('ℹ️ All Accounting collections already populated - skipped.');
    } else {
      console.log(`✅ Accounting migration complete (${collectionsSeededCount} collections initialized).`);
    }
  } catch (err) {
    console.error('❌ Accounting migration error:', err.message);
  }
}
