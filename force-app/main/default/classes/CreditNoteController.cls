public with sharing class CreditNoteController {
    @AuraEnabled(cacheable=true)
    public static List<Credit_Note__c> getCreditNotesForInvoice(Id invoiceId) {
        return [
            SELECT Id, Name, CreatedDate, Total_Credit_Amount__c
            FROM Credit_Note__c
            WHERE 
                Invoice__c = :invoiceId AND
                Status__c != 'Closed'
            ORDER BY CreatedDate ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Credit_Note__c> getCreditNotesForAccount(Id accountId) {
        return [
            SELECT Id, Name, CreatedDate, Total_Credit_Amount__c
            FROM Credit_Note__c
            WHERE 
                Account__c = :accountId AND
                Status__c != 'Closed'
            ORDER BY CreatedDate ASC
        ];
    }
}