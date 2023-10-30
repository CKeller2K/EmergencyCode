require("dotenv").config();
const admin = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const latex = require("node-latex");
const fs = require("fs");
const fsp = require('fs/promises');
const sendGrid = require('@sendgrid/mail');

const serviceAccount = require("./ServiceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const storage = new Storage({
  credentials: serviceAccount
});
const db = admin.firestore();
const collectionRef = db.collection(process.env.COLLECTION);

const inBucketName = process.env.INBUCKET;
const outBucketName = process.env.OUTBUCKET;

sendGrid.setApiKey(process.env.SENDGRIDKEY);

collectionRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach( async (change) => {
    const docRef = change.doc.ref;
    const data = change.doc.data();
    const docID = change.doc.id;

    if (change.type === 'modified' && data.state === "create") {
      // prep storage bucket objects
      const inBucket = storage.bucket(inBucketName);
      const outBucket = storage.bucket(outBucketName);
      // local / temporary file paths
      const inFilePath = `./tmp/${docID}.tex`;
      const outFilePath = `./tmp/${docID}.pdf`;
      // specify template file IN BUCKET using template data; TODO figure out error handling for file not exist
      const inFile = inBucket.file(`${data.template}.tex`); //TODO template should include file extension; currently hardcoded as .tex
      if (inFile.exists) console.log("Template found in bucket.");

      //get template from bucket; same as onCreate: see notes there
      const downloading = await inBucket.file(`${data.template}.tex`).download({destination: inFilePath});
      if (downloading.err) console.log(downloading.err);
      else console.log(`After download line. Sent to ${inFilePath}`);


      //kenny code to process, expects tex file exists in /tmp/ subdirectory; after done, pdf expected in /tmp/ subdirectory
      const originalData = await fsp.readFile(inFilePath, { encoding: 'utf8' });

      console.log('In readFile block.');

      const itemMap0 = data.items[0];
      const itemMap1 = data.items[1];
      const itemMap2 = data.items[2];
  
      let modifiedData = originalData;
      modifiedData = modifiedData.replace('<<customerName>>', data.client_name);
      modifiedData = modifiedData.replace('<<customerPhone>>', 'N/A');
      modifiedData = modifiedData.replace('<<customerAddress>>', data.client_address);
      modifiedData = modifiedData.replace('<<customerEmail>>', data.client_email);
  
      modifiedData = modifiedData.replace('<<companyName>>', data.host_name);
      modifiedData = modifiedData.replace('<<companyPhone>>', 'N/A');
      modifiedData = modifiedData.replace('<<companyAddress>>', data.host_location);
      modifiedData = modifiedData.replace('<<companyEmail>>', 'N/A');
  
      modifiedData = modifiedData.replace('<<invoiceNumber>>', 'N/A');
      modifiedData = modifiedData.replace('<<subTotal>>' , data.order_subtotal);
      modifiedData = modifiedData.replace('<<taxAmount>>' , data.order_tax);
      modifiedData = modifiedData.replace('<<totalAmount>>' , data.order_total);
      
      modifiedData = modifiedData.replace('<<product1Name>>' , itemMap0.name);
      modifiedData = modifiedData.replace('<<product1Cost>>' , itemMap0.cost);
      modifiedData = modifiedData.replace('<<product1Amount>>' , itemMap0.count);
  
      modifiedData = modifiedData.replace('<<product2Name>>' , itemMap1.name);
      modifiedData = modifiedData.replace('<<product2Cost>>' , itemMap1.cost);
      modifiedData = modifiedData.replace('<<product2Amount>>' , itemMap1.count);
  
      modifiedData = modifiedData.replace('<<product3Name>>' , itemMap2.name);
      modifiedData = modifiedData.replace('<<product3Cost>>' , itemMap2.cost);
      modifiedData = modifiedData.replace('<<product3Amount>>' , itemMap2.count);
  
        
      console.log('Template modified with doc data.');

      const options = { inputs: ['.', 'TeXworks'] };
      const outPDF = latex(modifiedData, options);
      console.log(`After out string converted to pdf format.`);

      await outPDF.pipe(fs.createWriteStream(outFilePath))
      .on('error', (error) => {console.log(`Pipe error: ${error}`)})
      .on('finish', async () => {
        console.log(' PDF generated successfully.');

        //upload finished pdf to processed bucket
        const uploading = await outBucket.upload(outFilePath);
        if (uploading.err) console.log(`  Error uploading PDF: ${uploading.err}`);
        else console.log(`  File uploaded: ${docID}.pdf`);

        console.log(`Sending Email.`);


        var attachmentBuffer = await fsp.readFile(outFilePath, { encoding: 'base64' });

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
              disposition: 'attachment'
            }
          ]
        };
      
        sendGrid.send(message)
          .catch((error) => {
            console.error(error);
          });
        });
      
      // updates the state to completed
      console.log("job's done");
      return docRef.update({ state: "completed" });

    } else {
    console.log(`Caught change without trigger at document: ${change.doc.id}`);
    }
  });
});