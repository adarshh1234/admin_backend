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

  // 1. Check & Migrate CMS Content
  try {
    const cmsCount = await LandingPageContent.countDocuments();
    if (cmsCount === 0) {
      console.log('📦 Migrating CMS JSON data to MongoDB...');
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

      await LandingPageContent.create({
        key: 'main_cms_content',
        live,
        draft,
        history,
      });
      console.log('✅ CMS data migrated to MongoDB.');
    } else {
      console.log(`ℹ️ CMS collection already populated (${cmsCount} record).`);
    }
  } catch (err) {
    console.error('❌ CMS migration error:', err.message);
  }

  // 2. Check & Migrate Accounting Database
  try {
    const accountCount = await Account.countDocuments();
    if (accountCount === 0) {
      console.log('📦 Migrating Accounting JSON data to MongoDB...');
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

      // Populate Settings
      const settings = acctData.settings || defaultAccountingData.settings;
      await AccountingSetting.create({
        key: 'main_settings',
        ...settings,
      });

      // Populate collections safely
      if (Array.isArray(acctData.accounts) && acctData.accounts.length > 0) {
        await Account.insertMany(acctData.accounts);
      }
      if (Array.isArray(acctData.parties) && acctData.parties.length > 0) {
        await Party.insertMany(acctData.parties);
      }
      if (Array.isArray(acctData.items) && acctData.items.length > 0) {
        await Item.insertMany(acctData.items);
      }
      if (Array.isArray(acctData.salesQuotes) && acctData.salesQuotes.length > 0) {
        await SalesQuote.insertMany(acctData.salesQuotes);
      }
      if (Array.isArray(acctData.salesInvoices) && acctData.salesInvoices.length > 0) {
        await SalesInvoice.insertMany(acctData.salesInvoices);
      }
      if (Array.isArray(acctData.salesPayments) && acctData.salesPayments.length > 0) {
        await SalesPayment.insertMany(acctData.salesPayments);
      }
      if (Array.isArray(acctData.purchaseInvoices) && acctData.purchaseInvoices.length > 0) {
        await PurchaseInvoice.insertMany(acctData.purchaseInvoices);
      }
      if (Array.isArray(acctData.purchasePayments) && acctData.purchasePayments.length > 0) {
        await PurchasePayment.insertMany(acctData.purchasePayments);
      }
      if (Array.isArray(acctData.journalEntries) && acctData.journalEntries.length > 0) {
        await JournalEntry.insertMany(acctData.journalEntries);
      }
      if (Array.isArray(acctData.ledgerEntries) && acctData.ledgerEntries.length > 0) {
        await LedgerEntry.insertMany(acctData.ledgerEntries);
      }
      if (Array.isArray(acctData.taxTemplates) && acctData.taxTemplates.length > 0) {
        await TaxTemplate.insertMany(acctData.taxTemplates);
      }
      if (Array.isArray(acctData.paymentMethods) && acctData.paymentMethods.length > 0) {
        await PaymentMethod.insertMany(acctData.paymentMethods);
      }
      if (Array.isArray(acctData.printTemplates) && acctData.printTemplates.length > 0) {
        await PrintTemplate.insertMany(acctData.printTemplates);
      }

      await accountingEngine.recalculateBalances();
      console.log('✅ Accounting data migrated to MongoDB successfully.');
    } else {
      console.log(`ℹ️ Accounting collections already populated (${accountCount} accounts).`);
    }
  } catch (err) {
    console.error('❌ Accounting migration error:', err.message);
  }
}
