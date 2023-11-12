const admin = require("firebase-admin");
const functions = require("firebase-functions");
const serviceAccount = require("./ServiceAccountKey.json");
const { PubSub } = require("@google-cloud/pubsub");

admin.initializeApp({
   credential: admin.credential.cert(serviceAccount)
});

const pubsub = new PubSub();

exports.pubsub = functions.firestore
   .document('coleTest/{docId}').onUpdate(async (change, context) => {

    const newValue = change.after.data();
    const oldValue = change.before.data();

    var errorBool = false;

    errorBool = (!newValue.hasOwnProperty('metaData'));
    if (errorBool){
        console.log ("Improper document structure. Expected document information in metaData object.");
        return;
    }

    errorBool = ((newValue.metaData.state !== 'create') ||
        (oldValue.metaData.state === 'create'));
    if (errorBool){
        console.log("Update trigger 'create' not detected. Change 'state' variable to 'create' to begin processing.");
        return;
    }

    //console.log('New Value:', newValue);
    //console.log('Old Value:', oldValue);

    console.log('Preparing to publish message.');

    const topicName = 'projects/csc-131-project-398318/topics/csc131project';
    /*
    const data = {
        docId: context.params.docId,
        newValue: newValue,
        oldValue: oldValue
    };

    @Shayn: to my knowledge Buffer.from(a, b) turns string 'a' of encoding 'b' into buffer format
        pubsub message-publish just requires a message of Buffer encoding, but doesn't seem to need Base64
        left old code here incase it does, in fact, need Base64
    
    const dataBuffer = Buffer.from(JSON.stringify(data), 'utf8');
    const base64String = dataBuffer.toString('base64');
    console.log('Base64String: ', base64String);

    const DecodeddataBuffer = Buffer.from(base64String, 'base64');
    return pubsub.topic(topicName).publish(dataBuffer)
    .then(() => console.log('Message published successfully.'))
    .catch(error => console.error('Error publishing message:', error));
    */

    const docID = context.params.docId;
    const message = Buffer.from(docID, 'utf-8');
    //const attributes = //attributes here lol

    const messageID = await pubsub
        .topic(topicName)
        .publishMessage({
            'data': message
            //, 'attributes': attributes
        })
        .catch(error => console.error('Error publishing message:', error));

    console.log(`No error: Message "${messageID}" published.`);
});