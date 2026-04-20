public with sharing class TransactionController {
    @AuraEnabled(cacheable=true)
    public static List<Transaction__c> getTransactionsForCreditNotes(List<Id> creditNoteIds) {
        return [
            SELECT Id, Name, CreatedDate, Amount__c, Credit_Note__c
            FROM Transaction__c
            WHERE Credit_Note__c IN :creditNoteIds
            ORDER BY CreatedDate ASC
        ];
    }

    @AuraEnabled(cacheable=false)
    public static void applyTransactions(List<AllocationWrapper> allocations, Id invoiceId) {
        List<Transaction__c> txnsToInsert = new List<Transaction__c>();
        for (AllocationWrapper alloc:allocations) {
            if (alloc != null && alloc.amount != null && alloc.amount > 0 && alloc.creditNoteId != null) {
                txnsToInsert.add(new Transaction__c(
                    Invoice__c = invoiceId,
                    Credit_Note__c = alloc.creditNoteId,
                    Amount__c = alloc.amount
                ));
            }
        }
        if (!txnsToInsert.isEmpty()) {
            insert txnsToInsert;
        }
    }

    public class AllocationWrapper {
        @AuraEnabled
        public Id creditNoteId { get; set; }
        @AuraEnabled
        public Decimal amount { get; set; }
    }
}
