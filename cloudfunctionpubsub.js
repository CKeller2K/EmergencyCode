const admin = require("firebase-admin");
const functions = require("firebase-functions");
const serviceAccount = require("./ServiceAccountKey.json");
const { PubSub } = require("@google-cloud/pubsub");

admin.initializeApp({
   credential: admin.credential.cert(serviceAccount)
});

const pubsub = new PubSub();

exports.pubsub = functions.firestore
   .document('coleTest/{docId}').onUpdate((change, context) => {

       const newValue = change.after.data();
       const oldValue = change.before.data();

       console.log('New Value:', newValue);
       console.log('Old Value:', oldValue);

       if (newValue.metaData.state === 'create' &&
           (oldValue.metaData.state != 'create')){

           console.log('Condition met. Preparing to publish message.');

           const topicName = 'projects/csc-131-project-398318/topics/csc131project';
           const data = {
               docId: context.params.docId,
               newValue: newValue,
               oldValue: oldValue
           };
           
           const dataBuffer = Buffer.from(JSON.stringify(data), 'utf8');
           const base64String = dataBuffer.toString('base64');
           console.log('Base64String: ', base64String);

           const DecodeddataBuffer = Buffer.from(base64String, 'base64');
           return pubsub.topic(topicName).publish(dataBuffer)
           .then(() => console.log('Message published successfully.'))
           .catch(error => console.error('Error publishing message:', error));
       } else {
           console.log('Condition not met. No message published.');
           return null;
       }
   });