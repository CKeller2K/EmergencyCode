//dunno what these do LOL
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKeys.json");
const { QuerySnapshot } = require("@google-cloud/firestore");
const PDFDoc = require('pdfkit');
const fs = require('fs');


//gets service key and logs in as admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//db is a database constant
const db = admin.firestore();
//documentRef is a (currently) hard-coded collection from database
const documentRef = db.collection("coleTest");


//'snapshot's' collection
documentRef.get().then((QuerySnapshot) => {
  //loops through every document in collection, document can be any name, usually doc
  QuerySnapshot.forEach(document => {

    //do stuff to document data here

    //TODO find less messy way to get data
    //document.data() returns firestore doc as map
    //console.log(document.data());

    //checks: if processed tag exists and is true, then does not create or open new pdf
    // can use "document.hasOwnProperty('processed')" to check if tag exists, but no error if you just try to check value
    if (document.data()['processed'] === true) {
      //console.log("Already processed.");
      return;
    }

    //doc var is new pdf
    let doc = new PDFDoc();
    //open doc for editing: createWriteStream takes a string input for file name; here name made with client name + order number
    doc.pipe(fs.createWriteStream(`${document.data()['user_data']['name']}${document.data()['order']['order_number']}.pdf`));

    //print title
    doc.fontSize(16).text('Order\n', {align: 'center'});

    //print data
    //can use \n or doc.moveDown() to create lines, movedown takes spacing ex: doc.moveDown(.5)
    doc.font('Times-Italic');
    doc.fontSize(12).text(`
    Subtotal: ${document.data()['order']['subtotal']}\n
    Tax (8.25%): ${document.data()['order']['subtotal'] * 0.0825}\n
    Total: ${document.data()['order']['total']}\n\n
    Date: ${document.data()['order']['date']} || Order #: ${document.data()['order']['order_number']}
    `, {align: 'left'});

    //close pdf
    doc.end();

    //updates document with timestamp and 'processed' key + sets to true (creates key if not found)
    // COMMENTED FOR REPEATED TESTS
    //const res = await documentRef.update({timestamp: FieldValue.serverTimestamp(), processed: true});
    });

  //tries to catch errors AT GET SNAPSHOT, NOT DOCUMENT
  }).catch((error) => {
  console.log("Error at document read: ", error);
});
