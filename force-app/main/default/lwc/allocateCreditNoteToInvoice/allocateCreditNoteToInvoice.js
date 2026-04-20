import { LightningElement, api, wire, track } from 'lwc';
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import getCreditNotesForInvoice from '@salesforce/apex/CreditNoteController.getCreditNotesForInvoice';
import getCreditNotesForAccount from '@salesforce/apex/CreditNoteController.getCreditNotesForAccount';
import getTransactionsForCreditNotes from '@salesforce/apex/TransactionController.getTransactionsForCreditNotes';
import applyTransactions from '@salesforce/apex/TransactionController.applyTransactions';

import NAME_FIELD from "@salesforce/schema/Invoice__c.Name";
import AMOUNT_DUE_ON_INVOICE_FIELD from "@salesforce/schema/Invoice__c.Amount_Due_on_Invoice__c";
import REMAINING_DUE_ON_INVOICE_FIELD from "@salesforce/schema/Invoice__c.Remaining_Due_on_Invoice__c";
import ACCOUNT_ID_ON_INVOICE_FIELD from "@salesforce/schema/Invoice__c.Account__c";

const FIELDS = [
    NAME_FIELD,
    AMOUNT_DUE_ON_INVOICE_FIELD,
    REMAINING_DUE_ON_INVOICE_FIELD,
    ACCOUNT_ID_ON_INVOICE_FIELD
];

export default class AllocateCreditNoteToInvoice extends LightningElement {

    //  Public Properties 

    @api recordId;

    //  Tracked Properties 

    @track creditNotes = [];
    /*
      Array of Credit Note records for the invoice.
      Each record has: Id, Name, CreatedDate, Total_Credit_Amount__c
    */

    @track creditNoteIds = [];
    /*
      Array of Ids extracted from creditNotes, used to fetch related transactions.
    */

    @track creditNotesError;

    @track transactions = {};
    /*
      Object keyed by Credit Note Id, value is an array of related transaction records.
      { 'a01xx0000001AAA': [{ Id, Credit_Note__c, Amount__c, ... }], ... }
    */

    @track transactionsError;

    @track allocations = {};
    /*
      Object keyed by Credit Note Id, value is the amount (number) allocated by the user.
      { 'a01xx0000001AAA': 100.00, 'a01xx0000001AAB': 50.00 }
    */

    @track checkedNotes = {};
    /*
      Object keyed by Credit Note Id, value is a boolean for checkbox state.
      { 'a01xx0000001AAA': true, 'a01xx0000001AAB': false }
    */

    //  Private Properties 

    errorMessages = {
        exceedsCreditNote: 'One or more allocations exceed the available amount for their credit note.',
        exceedsInvoiceDue: 'Total allocated amount exceeds the remaining due on the invoice.',
        hasNoAllocation: 'Please allocate an amount before applying.'
    };

    //  Wire Adapters 

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    invoiceRecord;

    @wire(getCreditNotesForAccount, { accountId: '$accountId' })
    wiredCreditNotes({ error, data }) {
        if (data) {
            this.creditNotes = data;
            this.creditNoteIds = data.map(cn => cn.Id);
            this.creditNotesError = undefined;
        } else if (error) {
            this.creditNotes = [];
            this.creditNotesError = error;
        }
    }

    @wire(getTransactionsForCreditNotes, { creditNoteIds: '$creditNoteIds' })
    wiredTransactions({ error, data }) {
        if (data) {
            const transactionMap = {};
            data.forEach(transaction => {
                if (transaction.Credit_Note__c) {
                    if (!transactionMap[transaction.Credit_Note__c]) {
                        transactionMap[transaction.Credit_Note__c] = [];
                    }
                    transactionMap[transaction.Credit_Note__c].push(transaction);
                }
            });
            this.transactions = transactionMap;
            this.transactionsError = undefined;
        } else if (error) {
            this.transactions = {};
            this.transactionsError = error;
        }
    }

    //  Getters 

    get invoiceId() {
        return getFieldValue(this.invoiceRecord.data, NAME_FIELD);
    }

    get amountDueOnInvoice() {
        return getFieldValue(this.invoiceRecord.data, AMOUNT_DUE_ON_INVOICE_FIELD);
    }

    get remainingDueOnInvoice() {
        return getFieldValue(this.invoiceRecord.data, REMAINING_DUE_ON_INVOICE_FIELD);
    }

    get accountId() {
        return getFieldValue(this.invoiceRecord.data, ACCOUNT_ID_ON_INVOICE_FIELD);
    }

    get availableCreditNotes() {
        return this.creditNotes
            .map(note => {
                const availableAmount = this.getAvailableAmount(note);
                const isChecked = !!this.checkedNotes[note.Id];
                return {
                    ...note,
                    availableAmount,
                    isChecked,
                    allocatedAmount: this.allocations[note.Id] !== undefined ? this.allocations[note.Id] : 0,
                    formattedDate: this.formatDate(note.CreatedDate),
                    isDisabled: !isChecked,
                    inputTitle: !isChecked
                        ? 'Select the credit note to allocate'
                        : 'Enter amount to credit'
                };
            })
            .filter(note => note.availableAmount > 0);
    }

    get computedRemainingDueOnInvoice() {
        return (this.remainingDueOnInvoice || 0) - this.computeTotalAllocated();
    }

    get formattedRemainingDueOnInvoice() {
        return this.remainingDueOnInvoice ? `$${this.remainingDueOnInvoice}` : '$0.00';
    }

    get formattedTotalAllocated() {
        return `$${this.computeTotalAllocated()}`;
    }

    get formattedComputedRemainingDue() {
        return this.computedRemainingDueOnInvoice ? `$${this.computedRemainingDueOnInvoice}` : '$0.00';
    }

    get applyButtonClass() {
        return `allocate-credit-apply-btn${this.isApplyDisabled ? ' allocate-credit-apply-btn-disabled' : ''}`;
    }

    get isApplyDisabled() {
        const { exceedsCreditNote, exceedsInvoiceDue, hasNoAllocation } = this.checkAllocations();
        return exceedsCreditNote || exceedsInvoiceDue || hasNoAllocation;
    }

    get applyButtonTooltip() {
        const { exceedsCreditNote, exceedsInvoiceDue, hasNoAllocation } = this.checkAllocations();
        if (exceedsCreditNote) return this.errorMessages.exceedsCreditNote;
        if (exceedsInvoiceDue) return this.errorMessages.exceedsInvoiceDue;
        if (hasNoAllocation) return this.errorMessages.hasNoAllocation;
        return '';
    }

    //  Event Handlers 

    handleCheckboxChange(event) {
        const creditNoteId = event.target.dataset.id;
        const checked = event.target.checked;
        this.checkedNotes = { ...this.checkedNotes, [creditNoteId]: checked };
    }

    handleAllocationChange(event) {
        const creditNoteId = event.target.dataset.id;
        const value = parseFloat(event.target.value) || 0;
        this.allocations = { ...this.allocations, [creditNoteId]: value };
    }

    handleApply() {
        const { exceedsCreditNote, exceedsInvoiceDue, hasNoAllocation } = this.checkAllocations();

        if (exceedsCreditNote) {
            alert('One or more allocations exceed the available amount for their credit note. Please adjust your allocations.');
            return;
        }
        if (exceedsInvoiceDue) {
            alert('Total allocated amount exceeds the remaining due on the invoice. Please adjust your allocations.');
            return;
        }
        if (hasNoAllocation) {
            alert('Please allocate an amount before applying.');
            return;
        }

        const allocationsToApply = Object.entries(this.allocations)
            .filter(([id, val]) => this.checkedNotes[id] && val > 0)
            .map(([id, val]) => ({ creditNoteId: id, amount: val }));

        applyTransactions({ allocations: allocationsToApply, invoiceId: this.recordId })
            .then(() => {
                alert('Credit successfully applied to the invoice.');
                window.location.reload();
            })
            .catch(error => {
                console.error('Error applying credit:', error);
                alert('An error occurred while applying the credit. Please try again.');
            });
    }

    //  Private Helpers 

    getAvailableAmount(creditNote) {
        const transactionList = this.transactions[creditNote.Id] || [];
        const used = transactionList.reduce((sum, t) => sum + (t.Amount__c || 0), 0);
        return (creditNote.Total_Credit_Amount__c || 0) - used;
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    }

    computeTotalAllocated() {
        return Object.entries(this.allocations)
            .filter(([id]) => this.checkedNotes[id])
            .reduce((sum, [, val]) => sum + (val || 0), 0);
    }

    checkAllocations() {
        const totalAllocated = this.computeTotalAllocated();
        let exceedsCreditNote = false;

        for (const note of this.creditNotes) {
            if (!this.checkedNotes[note.Id]) continue;
            if ((this.allocations[note.Id] || 0) > this.getAvailableAmount(note)) {
                exceedsCreditNote = true;
                break;
            }
        }

        return {
            exceedsCreditNote,
            exceedsInvoiceDue: totalAllocated > (this.remainingDueOnInvoice || 0),
            hasNoAllocation: totalAllocated <= 0
        };
    }
}
