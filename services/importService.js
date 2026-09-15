import { Account, Party, Item } from '../models/AccountingModel.js';
import { accountingEngine } from './accountingEngine.js';

export const importService = {
  /**
   * Parse and validate CSV data for import
   */
  async processCsvImport(targetType, csvText) {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('CSV content cannot be empty.');
    }

    const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV split supporting quoted strings
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.trim().replace(/^["']|["']$/g, ''));

      const rowObj = {};
      headers.forEach((header, idx) => {
        rowObj[header] = values[idx] !== undefined ? values[idx] : '';
      });

      // Validation according to target type
      if (targetType === 'Customer' || targetType === 'Supplier' || targetType === 'Party') {
        if (!rowObj['Name'] && !rowObj['name']) {
          errors.push(`Row ${i}: Party name is required.`);
        } else {
          rows.push({
            id: `party-${Date.now()}-${i}`,
            name: rowObj['Name'] || rowObj['name'],
            role: targetType === 'Customer' ? 'Customer' : targetType === 'Supplier' ? 'Supplier' : (rowObj['Role'] || rowObj['role'] || 'Customer'),
            gstin: rowObj['GSTIN'] || rowObj['gstin'] || '',
            pan: rowObj['PAN'] || rowObj['pan'] || '',
            email: rowObj['Email'] || rowObj['email'] || '',
            phone: rowObj['Phone'] || rowObj['phone'] || '',
            address: rowObj['Address'] || rowObj['address'] || '',
            placeOfSupply: rowObj['Place of Supply'] || rowObj['placeOfSupply'] || 'Maharashtra',
            defaultAccount: targetType === 'Supplier' ? 'Creditors' : 'Debtors',
            outstandingAmount: parseFloat(rowObj['Opening Balance'] || rowObj['balance'] || 0) || 0,
            status: 'Active',
          });
        }
      } else if (targetType === 'Item') {
        if (!rowObj['Name'] && !rowObj['name']) {
          errors.push(`Row ${i}: Item name is required.`);
        } else {
          rows.push({
            id: `item-${Date.now()}-${i}`,
            code: rowObj['Code'] || rowObj['code'] || `ITEM-${i}`,
            name: rowObj['Name'] || rowObj['name'],
            description: rowObj['Description'] || rowObj['description'] || '',
            unit: rowObj['Unit'] || rowObj['unit'] || 'Nos',
            rate: parseFloat(rowObj['Rate'] || rowObj['rate'] || 0) || 0,
            hsnSac: rowObj['HSN/SAC'] || rowObj['hsnSac'] || '',
            incomeAccount: rowObj['Income Account'] || rowObj['incomeAccount'] || 'Sales',
            expenseAccount: rowObj['Expense Account'] || rowObj['expenseAccount'] || 'Cost of Goods Sold',
            taxTemplate: 'tax-1',
            taxRate: parseFloat(rowObj['Tax Rate'] || rowObj['taxRate'] || 18) || 18,
            status: 'Active',
          });
        }
      } else if (targetType === 'Account') {
        if (!rowObj['Name'] && !rowObj['name']) {
          errors.push(`Row ${i}: Account name is required.`);
        } else {
          rows.push({
            id: `acc-${Date.now()}-${i}`,
            name: rowObj['Name'] || rowObj['name'],
            accountType: rowObj['Account Type'] || rowObj['accountType'] || 'General',
            rootType: rowObj['Root Type'] || rowObj['rootType'] || 'Asset',
            isGroup: (rowObj['Is Group'] || rowObj['isGroup'] || '').toLowerCase() === 'true',
            parent: rowObj['Parent Account'] || rowObj['parent'] || null,
            balance: parseFloat(rowObj['Opening Balance'] || rowObj['balance'] || 0) || 0,
          });
        }
      }
    }

    if (errors.length > 0 && rows.length === 0) {
      throw new Error(`CSV validation failed:\n${errors.slice(0, 5).join('\n')}`);
    }

    // Save valid records into MongoDB
    if (rows.length > 0) {
      if (targetType === 'Customer' || targetType === 'Supplier' || targetType === 'Party') {
        await Party.insertMany(rows);
      } else if (targetType === 'Item') {
        await Item.insertMany(rows);
      } else if (targetType === 'Account') {
        await Account.insertMany(rows);
      }
      await accountingEngine.recalculateBalances();
    }

    return {
      success: true,
      importedCount: rows.length,
      warningCount: errors.length,
      warnings: errors,
      sample: rows.slice(0, 3),
    };
  },
};
