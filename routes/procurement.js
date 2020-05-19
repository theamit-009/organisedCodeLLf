const pool = require('../db/dbConfig');
const verify = require('../config/verifyToken');
const format = require('pg-format');
const Router = require('express-promise-router');
const router = new Router();

router.get('/',verify,(request, response)=> {
    
    console.log('Procurement request.user '+JSON.stringify(request.user));
    var userId = request.user.sfid; 
    var objUser = request.user;
    console.log('Procurement userId : '+userId);

    pool
    .query('SELECT sfid, Name,Project_Department__c, Approval_Status__c, Number_Of_IT_Product__c, Number_Of_Non_IT_Product__c, Procurement_IT_total_amount__c, Procurement_Non_IT_total_amount__c, Total_amount__c FROM  salesforce.Asset_Requisition_Form__c WHERE Submitted_By_Heroku_User__c = $1',[userId])
    .then((assetQueryResult) => {
            console.log('assetQueryResult   '+assetQueryResult.rows);
            if(assetQueryResult.rowCount > 0)
                response.render('assetRequistionForms',{objUser : objUser, name:request.user.name, email : request.user.email, assetList : assetQueryResult.rows });
            else
                response.render('assetRequistionForms',{objUser : objUser, name:request.user.name, email : request.user.email, assetList : []});
    })
    .catch((assetQueryError) => {
        console.log('assetQueryError   '+assetQueryError.stack);
        response.render('assetRequistionForms',{objUser : objUser,name:request.user.name, email : request.user.email, assetList : []});
    })
});

router.get('/details',verify, async(request, response) => {

    var assetId = request.query.assetId;
    console.log('assetId   '+assetId);

    var assetFormAndRelatedRecords = {};

    await
    pool
    .query('SELECT id, sfid, Name, Project_Department__c, Approval_Status__c, Number_Of_IT_Product__c, Number_Of_Non_IT_Product__c, Procurement_IT_total_amount__c, Procurement_Non_IT_total_amount__c, Total_amount__c FROM  salesforce.Asset_Requisition_Form__c WHERE sfid = $1',[assetId])
    .then((assetQueryResult)=> {
        if(assetQueryResult.rowCount > 0)
        {
            console.log('assetQueryResult  '+assetQueryResult.rows);
            assetFormAndRelatedRecords.assetFormDetails = assetQueryResult.rows;        
        }
        else
        {
            assetFormAndRelatedRecords.assetFormDetails = [];
        }
    })
    .catch((assetQueryError)=> {
        console.log('assetQueryError  : '+assetQueryError.stack);
        assetFormAndRelatedRecords.assetFormDetails = [];
    })

    await
    pool
    .query('SELECT sfid, Name,Products_Services_Name__c, Items__c,Quantity__c, Others__c, Budget__c FROM  salesforce.Product_Line_Item__c WHERE Asset_Requisition_Form__c = $1',[assetId])
    .then((NonItProductResult)=> {
            if(NonItProductResult.rowCount > 0)
            {   
                    console.log('NonItProductResult  '+NonItProductResult.rows);
                    assetFormAndRelatedRecords.nonItProducts = NonItProductResult.rows;
            }
            else
            {
                assetFormAndRelatedRecords.nonItProducts = [];
            }

    })
    .catch((NonItProductError)=> {
        console.log('NonItProductError  '+NonItProductError.stack);
        assetFormAndRelatedRecords.nonItProducts = [];
    })

    await
    pool
    .query('SELECT sfid, Name, Items__c, Quantity__c, Budget__c FROM salesforce.Product_Line_Item_IT__c WHERE Asset_Requisition_Form__c = $1 ',[assetId])
    .then((ItProductResult) => {
            if(ItProductResult.rowCount > 0)
            {
                console.log('ItProductResult  '+ItProductResult.rows);
                assetFormAndRelatedRecords.itProducts = ItProductResult.rows;
            }
            else
            {
                assetFormAndRelatedRecords.itProducts = [];
            }
     })
    .catch((ItProductError) => {
        console.log('ItProductError   '+ItProductError.stack);
        assetFormAndRelatedRecords.itProducts = [];
    })


    response.send(assetFormAndRelatedRecords);

});


router.get('/nonItProducts/:parentAssetId',verify, (request,response) => {

    let parentAssetId = request.params.parentAssetId;
    console.log('parentAssetId  '+parentAssetId);

    response.render('procurementNonIT',{name: request.user.name, email: request.user.email, parentAssetId : parentAssetId});
});


router.post('/nonItProducts', (request,response) => {

   let nonItFormResult = request.body;
   console.log('nonItFormResult  '+JSON.stringify(nonItFormResult));

   let numberOfRows,lstNonItProcurement = [];
   if(typeof(nonItFormResult.quantity) != 'object')
   {
        let singleRecordValues = [];
        singleRecordValues.push(nonItFormResult.itemsCategory);
        singleRecordValues.push(nonItFormResult.items);
        singleRecordValues.push(nonItFormResult.location);
        singleRecordValues.push(nonItFormResult.otherItems);
        singleRecordValues.push(nonItFormResult.itemSpecification);
        singleRecordValues.push(nonItFormResult.quantity);
        singleRecordValues.push(nonItFormResult.budget);
        singleRecordValues.push(nonItFormResult.imgpath);
        singleRecordValues.push(nonItFormResult.impaneledVendorId);
        singleRecordValues.push(nonItFormResult.parentProcurementId);
        lstNonItProcurement.push(singleRecordValues);
   }
   else
   {
        numberOfRows = nonItFormResult.quantity.length;
        for(let i=0; i< numberOfRows ; i++)
        {
            let singleRecordValues = [];
            singleRecordValues.push(nonItFormResult.itemsCategory[i]);
            singleRecordValues.push(nonItFormResult.items[i]);
            singleRecordValues.push(nonItFormResult.location[i]);
            singleRecordValues.push(nonItFormResult.otherItems[i]);
            singleRecordValues.push(nonItFormResult.itemSpecification[i]);
            singleRecordValues.push(nonItFormResult.quantity[i]);
            singleRecordValues.push(nonItFormResult.budget[i]);
            singleRecordValues.push(nonItFormResult.imgpath[i]);
            singleRecordValues.push(nonItFormResult.impaneledVendorId[i]);
            singleRecordValues.push(nonItFormResult.parentProcurementId[i]);
            lstNonItProcurement.push(singleRecordValues);
        }
   }

   let nonItProductsInsertQuery = format('INSERT INTO salesforce.Product_Line_Item__c (Products_Services_Name__c, Items__c, Location__c, Others__c, Product_Service__c, Quantity__c, Budget__c, Heroku_Image_URL__c,Impaneled_Vendor__c, Asset_Requisition_Form__c ) VALUES %L returning id',lstNonItProcurement);

   pool.query(nonItProductsInsertQuery)
   .then((nonItProductsInsertQueryResult) => {
        console.log('nonItProductsInsertQueryResult  '+JSON.stringify(nonItProductsInsertQueryResult.rows));
        response.send('Saved Successfully');
   })
   .catch((nonItProductsInsertQueryError) => {
        console.log('nonItProductsInsertQueryError  '+nonItProductsInsertQueryError.stack);
        response.send('Error Occured !');
   })

   
});





router.get('/itProducts/:parentAssetId',verify, (request,response) => {

    let parentAssetId = request.params.parentAssetId;
    console.log('parentAssetId  '+parentAssetId);
    response.render('procurementIT',{name: request.user.name, email: request.user.email, parentAssetId: parentAssetId});
});


router.post('/itProducts', (request,response) => {

    console.log('Inside ItProducts Post Method');
    let itFormResult = request.body;
    console.log('itFormResult  '+JSON.stringify(itFormResult));

    let numberOfRows, lstItProducts= [];
    if(typeof(itFormResult.quantity) != 'object')
    {
            let singleItProductRecordValue = [];
            singleItProductRecordValue.push(itFormResult.items);
            singleItProductRecordValue.push(itFormResult.location);
            singleItProductRecordValue.push(itFormResult.otherItems);
            singleItProductRecordValue.push(itFormResult.itemSpecification);
            singleItProductRecordValue.push(itFormResult.quantity);
            singleItProductRecordValue.push(itFormResult.budget);
            singleItProductRecordValue.push(itFormResult.imgpath);
            singleItProductRecordValue.push(itFormResult.impaneledVendorId);
            singleItProductRecordValue.push(itFormResult.parentProcurementId);
            lstItProducts.push(singleItProductRecordValue);
    }
    else
    {
        numberOfRows = itFormResult.quantity.length;
        for(let i=0; i< numberOfRows ; i++)
        {
            let singleItProductRecordValue = [];
            singleItProductRecordValue.push(itFormResult.items[i]);
            singleItProductRecordValue.push(itFormResult.location[i]);
            singleItProductRecordValue.push(itFormResult.otherItems[i]);
            singleItProductRecordValue.push(itFormResult.itemSpecification[i]);
            singleItProductRecordValue.push(itFormResult.quantity[i]);
            singleItProductRecordValue.push(itFormResult.budget[i]);
            singleItProductRecordValue.push(itFormResult.imgpath[i]);
            singleItProductRecordValue.push(itFormResult.impaneledVendorId[i]);
            singleItProductRecordValue.push(itFormResult.parentProcurementId[i]);
            lstItProducts.push(singleItProductRecordValue);
        }
    }

    console.log('lstItProducts  '+JSON.stringify(lstItProducts));

    const itProductsInsertQuery = format('INSERT INTO salesforce.Product_Line_Item_IT__c (Items__c,Location__c, Others__c, Product_Service_specification__c, Quantity__c, Budget__c,Heroku_Image_URL__c, Impaneled_Vendor__c, Asset_Requisition_Form__c ) values %L returning id',lstItProducts);

    pool.query(itProductsInsertQuery)
    .then((itProductsInsertQueryResult) => {
        console.log('itProductsInsertQueryResult  : '+JSON.stringify(itProductsInsertQueryResult.rows));
        response.send('Saved Successfully !');
    })
    .catch((itProductsInsertQueryError) => {
        console.log('itProductsInsertQueryError  : '+itProductsInsertQueryError.stack);
        response.send('Error Occurred !');
    })
 
    
});


router.get('/getRelatedQuote',(request, response) => {

    let filterValues = request.query.filtervalues;
    console.log('filtervalues  '+JSON.stringify(filterValues));
    console.log('filterValues.itemsCategoryValue '+filterValues.itemsCategoryValue);

    pool.query('SELECT sfid, Quote_Public_URL__c FROM salesforce.Impaneled_Vendor__c WHERE services__c = $1 AND items__c = $2 AND location_vendor__c = $3 ',[filterValues.itemsCategoryValue ,filterValues.itemValue,filterValues.placeValue])
    .then((QuoteQueryResult) => {
        console.log('QuoteQueryResult  '+JSON.stringify(QuoteQueryResult.rows));
        if(QuoteQueryResult.rowCount > 0)
        {
            response.send(QuoteQueryResult.rows[0]);
        }
        else
        {
            console.log('Else Block');
            response.send('Not Found');
        }
            
    })
    .catch((QuoteQueryError) => {
        console.log('QuoteQueryError  '+QuoteQueryError.stack);
        response.send('Not Found');
    })

});


router.get('/getProjectList',(request,response) => {

    console.log('Hello PRoject List');

    pool.query('SELECT sfid, name FROM salesforce.Milestone1_Project__c')
    .then((projectQueryResult)=> {
            console.log('projectQueryResult  '+JSON.stringify(projectQueryResult.rows));
            response.send(projectQueryResult.rows);
    })
    .catch((projectQueryError) => {
            console.log('projectQueryResult   '+projectQueryResult.stack);
            response.send([]);
    })

})


module.exports = router;