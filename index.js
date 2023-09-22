var admin = require("firebase-admin");

var serviceAccount = require("./serviceAccountKeys.json");
const { QuerySnapshot } = require("@google-cloud/firestore");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const db = admin.firestore();
let documentRef = db.collection("INSERT-FIRESTORE-COLLECTION-HERE");

documentRef.get().then((QuerySnapshot) => {  //learn a little javascript, => operator returns the next braces like a function
    QuerySnapshot.forEach(document => {
        console.log(document.data());   //seems to log like a python dictionary in key-value pairs
    })
})
