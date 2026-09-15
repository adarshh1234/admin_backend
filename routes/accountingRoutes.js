import { Router } from 'express';
import { accountingController } from '../controllers/accountingController.js';
import { requireAdminAuth } from '../middleware/auth.js';

const router = Router();

// Dashboard
router.get('/dashboard', accountingController.getDashboard);

// Chart of Accounts
router.get('/accounts', accountingController.getAccounts);
router.post('/accounts', requireAdminAuth, accountingController.createAccount);
router.put('/accounts/:id', requireAdminAuth, accountingController.updateAccount);
router.delete('/accounts/:id', requireAdminAuth, accountingController.deleteAccount);

// Parties (Customers, Suppliers)
router.get('/parties', accountingController.getParties);
router.post('/parties', requireAdminAuth, accountingController.createParty);
router.put('/parties/:id', requireAdminAuth, accountingController.updateParty);
router.delete('/parties/:id', requireAdminAuth, accountingController.deleteParty);

// Item Master
router.get('/items', accountingController.getItems);
router.post('/items', requireAdminAuth, accountingController.createItem);
router.put('/items/:id', requireAdminAuth, accountingController.updateItem);
router.delete('/items/:id', requireAdminAuth, accountingController.deleteItem);

// Sales Quotes
router.get('/sales-quotes', accountingController.getSalesQuotes);
router.post('/sales-quotes', requireAdminAuth, accountingController.createSalesQuote);
router.put('/sales-quotes/:id', requireAdminAuth, accountingController.updateSalesQuote);
router.post('/sales-quotes/:id/convert', requireAdminAuth, accountingController.convertQuoteToInvoice);
router.delete('/sales-quotes/:id', requireAdminAuth, accountingController.deleteSalesQuote);

// Sales Invoices
router.get('/sales-invoices', accountingController.getSalesInvoices);
router.post('/sales-invoices', requireAdminAuth, accountingController.createSalesInvoice);
router.put('/sales-invoices/:id', requireAdminAuth, accountingController.updateSalesInvoice);
router.post('/sales-invoices/:id/cancel', requireAdminAuth, accountingController.cancelSalesInvoice);
router.delete('/sales-invoices/:id', requireAdminAuth, accountingController.deleteSalesInvoice);

// Sales Payments
router.get('/sales-payments', accountingController.getSalesPayments);
router.post('/sales-payments', requireAdminAuth, accountingController.createSalesPayment);
router.delete('/sales-payments/:id', requireAdminAuth, accountingController.deleteSalesPayment);

// Purchase Invoices
router.get('/purchase-invoices', accountingController.getPurchaseInvoices);
router.post('/purchase-invoices', requireAdminAuth, accountingController.createPurchaseInvoice);
router.post('/purchase-invoices/:id/cancel', requireAdminAuth, accountingController.cancelPurchaseInvoice);
router.delete('/purchase-invoices/:id', requireAdminAuth, accountingController.deletePurchaseInvoice);

// Purchase Payments
router.get('/purchase-payments', accountingController.getPurchasePayments);
router.post('/purchase-payments', requireAdminAuth, accountingController.createPurchasePayment);

// Journal Entries (Double-Entry Vouchers)
router.get('/journal-entries', accountingController.getJournalEntries);
router.post('/journal-entries', requireAdminAuth, accountingController.createJournalEntry);
router.post('/journal-entries/:id/cancel', requireAdminAuth, accountingController.cancelJournalEntry);

// General Ledger & Financial Reports
router.get('/ledger', accountingController.getGeneralLedger);
router.get('/reports/general-ledger', accountingController.getGeneralLedger);
router.get('/reports/trial-balance', accountingController.getTrialBalance);
router.get('/reports/profit-and-loss', accountingController.getProfitAndLoss);
router.get('/reports/balance-sheet', accountingController.getBalanceSheet);

// GST Reports
router.get('/gst/gstr1', accountingController.getGSTR1);
router.get('/gst/gstr2', accountingController.getGSTR2);

// Tax Templates & Payment Methods
router.get('/tax-templates', accountingController.getTaxTemplates);
router.post('/tax-templates', requireAdminAuth, accountingController.createTaxTemplate);
router.get('/payment-methods', accountingController.getPaymentMethods);

// Print Templates
router.get('/print-templates', accountingController.getPrintTemplates);
router.put('/print-templates/:id', requireAdminAuth, accountingController.updatePrintTemplate);

// Accounting Settings & Import
router.get('/settings', accountingController.getSettings);
router.put('/settings', requireAdminAuth, accountingController.updateSettings);
router.post('/reset', requireAdminAuth, accountingController.resetData);
router.post('/import', requireAdminAuth, accountingController.importCsv);

export default router;
