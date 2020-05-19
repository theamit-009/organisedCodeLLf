const express = require('express');
const pool = require('../db/dbConfig');
const verify = require('../config/verifyToken');
const format = require('pg-format');
const Router = require('express-promise-router');
const router = new Router();

router.get('/expenseApprovals',verify, (request, response) => {
    let objUser = request.user;
    response.render('./approvals/expenseApprovals',{objUser});

});


router.get('/expenseApprovalsList',verify, (request, response) => {
    let objUser = request.user;
    pool.query('SELECT Submitter__c, status__c, createddate,record_name__c, amount__c, expense__c FROM salesforce.Custom_Approval__c WHERE Approval_Type__c = $1 AND Assign_To__c = $2 ',['Expense', objUser.sfid])
    .then((customApprovalResult) => {
            console.log('customApprovalResult  : '+JSON.stringify(customApprovalResult.rows));
            if(customApprovalResult.rowCount > 0)
            {
                let lstApprovalRecords = [];
                for(let i=0, len = customApprovalResult.rows.length ; i < len ; i++ )
                {
                    let crDate = new Date(customApprovalResult.rows[i].createddate);
                    let strDate = crDate.toLocaleString();
                    let obj = {};
                    obj.sequence = (i+1);
                    obj.recordName = '<a href="#" data-toggle="modal" data-target=""  id="name'+customApprovalResult.rows[i].expense__c+'" class="expnseRecordName" >'+customApprovalResult.rows[i].record_name__c+'</a>';
                    obj.currentStatus = customApprovalResult.rows[i].status__c;
                    obj.totalAmount = customApprovalResult.rows[i].amount__c;
                    obj.createdDate = strDate;
                    obj.approveBtn = '<button class="btn btn-primary" id="approve'+customApprovalResult.rows[i].expense__c+'" >Approve</button>';
                    obj.rejectBtn = '<button class="btn btn-danger" id="reject'+customApprovalResult.rows[i].expense__c+'" >Reject</button>';
                    lstApprovalRecords.push(obj);
                }
                response.send(lstApprovalRecords);
            }
            else
                response.send([]);
    })
    .catch((customApprovalError) => {
            console.log('customApprovalError  : '+customApprovalError.stack);
            response.send([]);
    });

});

module.exports = router;