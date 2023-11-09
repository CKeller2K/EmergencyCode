require("dotenv").config();
const admin = require("firebase-admin");
const {Storage} = require("@google-cloud/storage");
const latex = require("node-latex");
const fs = require("fs");
const Handlebars = require("handlebars");
const fsp = require("fs/promises");
const sendGrid = require("@sendgrid/mail");
const {PubSub} = require("@google-cloud/pubsub");


const serviceAccount = require("./ServiceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const storage = new Storage({
    credentials: serviceAccount
});
const pubsub = new PubSub({
    projectId: process.env.PROJECTID,
    credentials: serviceAccount
});
const subscription = pubsub.subscription(process.env.PUBSUB);

const db = admin.firestore();
const collectionRef = db.collection(process.env.COLLECTION);
sendGrid.setApiKey(process.env.SENDGRIDKEY);

subscription.on('message', async (message) => {

    console.log(Buffer.from(message.data, "base64").toString('utf8'));
    
    // changing it to Javascript object for compatability 
    /* RAW MESSAGE example from Subscription
        {"docId":"97025378921","newValue":{"client_address":"6000 J St, Sacramento, CA 95819","client_email":
        "N/A","client_name":"Belarus","client_payment":"Mastercard ending in 6969","date":"Sep 26, 2023","host_dotd":
        "N/A","host_location":"6000 J St, Sacramento, CA 95819","host_name":"Taco Bell","host_slogan":
        "Think Outside the Bun","items":[{"cost":3.5,"count":2,"name":"Bean Burrito"},{"cost":27,"count":1,"name":
        "Cheesy Gordita Crunch"},{"cost":2,"count":4,"name":"Fountain Drink - Medium"},{"cost":5,"count":6,"name":
        "Crunchwrap Supreme"}],"metaData":{"inBucket":"pdf-json-buckets","outBucket":"131project-processed-pdfs","state":
        "create","template":"test_template_1.tex"},"order_subtotal":72,"order_tax":8.25,"order_tip":100,"order_total":
        177.94,"reward_member":true},"oldValue":{"client_address":"6000 J St, Sacramento, CA 95819","client_email":
        "N/A","client_name":"Belarus","client_payment":"Mastercard ending in 6969","date":"Sep 26, 2023","host_dotd":
        "N/A","host_location":"6000 J St, Sacramento, CA 95819","host_name":"Taco Bell","host_slogan":
        "Think Outside the Bun","items":[{"cost":3.5,"count":2,"name":"Bean Burrito"},{"cost":27,"count":1,"name":
        "Cheesy Gordita Crunch"},{"cost":2,"count":4,"name":"Fountain Drink - Medium"},{"cost":5,"count":6,"name":
        "Crunchwrap Supreme"}],"metaData":{"inBucket":"pdf-json-buckets","outBucket":"131project-processed-pdfs","state":
        "a","template":"test_template_1.tex"},"order_subtotal":72,"order_tax":8.25,"order_tip":100,"order_total":
        177.94,"reward_member":true}}
    */

    // convert to make data usable in the code
    // ie. data.docID = "97025378921", so you can do "const docID = data.docID;""
    /*
    const data = JSON.parse(Buffer.from(message.data, "base64").toString('utf8'));
    const docRef = admin.firestore().doc(process.env.COLLECTION/data.docID);
    const docData = data.docData;
    */


    collectionRef.onSnapshot(async (snapshot) => {
        const data = JSON.parse(Buffer.from(message.data, "base64").toString('utf8'));
        const docID = data.docId;
        console.log(process.env.COLLECTION);
        console.log(docID);
        console.log(admin.firestore().doc(process.env.COLLECTION + "/" + docID));
        const docRef = admin.firestore().doc(process.env.COLLECTION + "/" + docID);
        var resultBool = false;

        console.log('Document triggered: ${change.doc.id}...');

        resultBool = (!data.hasOwnProperty('metadata'));
        if (resultBool) {
            console.log("Improper document structure. Expected document information in metaData object.");
            return null;
        }
        const metaData = data.metaData;
        const inBucketName = metaData.inBucket;
        const outBucketName = metaData.outBucket;

        resultBool = metaData.state !== "create";
        if (resultBool) {
            console.log("Update trigger 'create' not detected. Change 'state' variable to begin processing.");
            return null;
        }

        const inBucket = storage.bucket(inBucketName);
        const outBucket = storage.bucket(outBucketName);

        const inFilePath = './tmp/${docID}.tex';
        const outFilePath = './tmp/${docID}.pdf';

        const inFile = inBucket.file('${metaData.template}');

        await inFile.exists()
            .catch(function(err) {
                console.log(err);
                resultBool = true;
            })
            .then(function(data) {
                if(data[0]) resultBool = false;
                else resultBool = true;
        });

        if (resultBool)
        return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR' : 'ERROR: Template does not exist: ${metaData.template}', 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
        else console.log("Template found in bucket.");

        await inFile.download({destination: inFilePath})
            .catch(function(err) {
                console.log(err);
                resultBool = true;
            })
            .then(function(data) {
                resultBool = false;
        });
        if (resultBool)
        return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR' : 'ERROR: Template does not exist: ${metaData.template}', 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
        else console.log("No Error downloading. Sent to ${inFilePath}");

        const originalData = await fsp.readFile(inFilePath, { encoding: 'utf8' });
        if (resultBool)
        return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR' : 'ERROR: Template does not exist: ${metaData.template}', 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
        else console.log('No error reading download. Modifying...');

        const handlebarsTemplate = Handlebars.compile(originalData);
        const latexDocument = handlebarsTemplate(data);

        console.log('Template modified with doc data.');

        const options = { inputs: ['.', 'TeXworks']};
        const outPDF = latex(latexDocument, options);
        console.log('No error running PDFLatex.');

        await outPDF.pipe(fs.createWriteStream(outFilePath))
            .on('error', (error) => {
                console.log('Write-stream pipe error: ${error}');
                resultBool = true;
                return null;
            })
            .on('finish', async() => {
                console.log("PDF generated successfully.");

                await outBucket.upload(outFilePath)
                .catch(function(err) {
                    console.log(err);
                    resultBool = true;
                })
                .then(function(data) {
                    resultBool = false;
                });
                if (resultBool)
                return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR' : 'ERROR: Template does not exist: ${metaData.template}', 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
                else console.log('No error uplading: ${docID}.pdf sent to ${outBucketName}');

                console.log('Sending Email.');

                var attachmentBuffer = await fsp.readFile(outFilePath, { encoding: 'base64'});

                if (resultBool)
                return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR' : 'ERROR: Template does not exist: ${metaData.template}', 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
                else console.log("No error reading download. Modifying ...");

                    const message = {
                        to: process.env.EMAIL,
                        from: 'CSC131.emergency.code@gmail.com',
                        subject: 'PDF Generated',
                        text: 'Check PDF is attached. Do not reply to this email.',
                        attachments: [
                            {
                                filename: outFilePath,
                                content: attachmentBuffer,
                                type: 'application/pdf',
                                disposition: 'attachement'
                            }
                        ]
                    };

                    sendGrid.send(message)
                        .catch((error) => {
                            console.error(error);
                            resultBool = true;
                        })
                        .then((data) => {
                            resultBool = false;
                        });
                    if(resultBool)
                    return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR' : 'ERROR: Template does not exist: ${metaData.template}', 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
                    else console.log("No error sending email through SendGrid.");

                    resultBool = false;
            });
            if (resultBool)
            return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR' : 'ERROR: Template does not exist: ${metaData.template}', 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});

            console.log("Main thread finished, awaiting async functions.");
            return docRef.update({ 'metaData.state': "completed"});

    });
});