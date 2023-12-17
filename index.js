const admin = require("firebase-admin");
const functions = require("firebase-functions");
const axios = require('axios');

//validate firestore access
const serviceAccount = require("./ServiceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



// ---establish Cloud Functions triggers---

//document update trigger Cloud Function
exports.updateTriggerHTTP = functions.firestore
   .document(`coleTest/{docID}`)
   .onUpdate( async (change, context) => {

    //onUpdate 'change' value has before and after components: save both for cross-referencing
    const newValue = change.after.data();
    const oldValue = change.before.data();

    //check for metaData in new data (metaData may have been the update)
    if (!(newValue.hasOwnProperty('metaData'))) {
        //one or both do not have metaData: document likely not ready to launch
        return;
    }

    //check for state variable in new data (state may have been created)
    if (!(newValue.metaData.hasOwnProperty('state'))) {
        //no state -> will not trigger
        return;
    }

    //check if new data is set to create
    if ((newValue.metaData.state !== 'create')) {
        //definitely not ready to trigger
        return;
    }

    // ---if here: want to trigger!---

    //check if old data has sub-map
    if (oldValue.hasOwnProperty('metaData')) {

        //metaData already existed before update: check if state did as well
        if (oldValue.metaData.hasOwnProperty('state')) {

            //state already existed: check if 'create'
            if (oldValue.metaData.state === 'create') {
                //update is potentially from program: do not trigger
                return;
            }
        }
    }
    //if here: a document update added a state = 'create' to new data AND state is not 'create' in old data

    //attempt processing
    await sendPost(context.params.docID, process.env.SERVICEURL);

});



//document create Cloud Function
exports.createTriggerHTTP = functions.firestore
   .document(`coleTest/{docID}`)
   .onCreate( async (snap, context) => {

    const data = snap.data();

    //check for metaData in data
    if (!(data.hasOwnProperty('metaData'))) {
        //metaData not included in creation -> do not trigger
        return;
    }

    //check for state variable in data
    if (!(data.metaData.hasOwnProperty('state'))) {
        //no state -> will not trigger
        return;
    }

    //check if new data is set to create
    if ((data.metaData.state !== 'create')) {
        //definitely not ready to trigger
        return;
    }

    //if here: ready to attempt processing

    await sendPost(context.params.docID, process.env.SERVICEURL);

});



//parameters: (Cloud document object, string [valid ID for Firestore doc], string [active Cloud Run service URL])
async function sendPost(docID, url) {

    try {

        //---get Firestore document data through series of GCS calls---

        //get database from firestore
        const db = admin.firestore();
        //collection string -> Google collection object
        const collectionRef = db.collection(process.env.COLLECTION);
        //collection object -> Google document object
        const docRef = collectionRef.doc(docID);



        console.log(`Attempting HTTP request via axios: ${docID}.`);

        //we don't know the difference between get and post, but this sure works
        //https://axios-http.com/docs/handling_errors
        const httpResponse = await axios.post(url, { 
            docID: docID,
            validateStatus: function (status) {
                return status < 500;
            }
        });

        // ---response caught: update console + Firestore doc depending on status---
        console.log(`Response caught: ${httpResponse.status} - ${httpResponse.data}`);

        if (httpResponse.status < 300) {

            //update Firestore doc
            await docRef.update({
                'metaData.state': 'completed',
                'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()
            });
            
        }

        else {

            //update doc
            await docRef.update({
                'metaData.state': "ERROR",
                'metaData.ERROR': `${httpResponse.data}`,
                'metaData.timeERROR': admin.firestore.FieldValue.serverTimestamp()
            });

        }

        /*
        else {

            //unknown exception...
            console.log(`Unexpected error: ${httpResponse.statusText}`);
            await docRef.update({
                'metaData.state': "ERROR",
                'metaData.ERROR': `${httpResponse.statusText}`,
                'metaData.timeERROR': admin.firestore.FieldValue.serverTimestamp()
            });

        }
        */

    }
    
    //catch request errors -> errors are not expected to be thrown by Cloud Run processing
    catch (error) {

        //---get Firestore document data through series of GCS calls---

        //get database from firestore
        const db = admin.firestore();
        //collection string -> Google collection object
        const collectionRef = db.collection(process.env.COLLECTION);
        //collection object -> Google document object
        const docRef = collectionRef.doc(docID);

        if (error.response) {
            //somehow response was still caught through error
            //console.log(error);
            console.log(error.message);

            //update doc to error
            await docRef.update({
                'metaData.state': "ERROR",
                'metaData.ERROR': `${error.response.data}`,
                'metaData.timeERROR': admin.firestore.FieldValue.serverTimestamp()
            });

        }  else {
            console.log(error);
        }

    }

    console.log("Cloud Function wrapping up.");

}