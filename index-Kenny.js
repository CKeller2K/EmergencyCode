const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccKey.json");
const fs = require('fs');
const latex = require('node-latex');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const collectionRef = db.collection('kennyTest');
const documentRef= collectionRef.doc('1');

// Define file paths
const texFilePath = 'template.tex';
const backupTexFilePath = 'backup.tex'; // Create a backup file


// Read the original TeX file and create a backup
fs.readFile(texFilePath, 'utf8', (err, originalData) => {
  if (err) {
    console.error('Error reading LaTeX file:', err);
    return;
  }

  // Create a backup of the original content
  fs.writeFile(backupTexFilePath, originalData, 'utf8', (err) => {
    if (err) {
      console.error('Error creating a backup of the TeX file:', err);
      return;
    }
    console.log('Backup of the TeX file created:', backupTexFilePath);
  });

documentRef
.get()
.then((doc) => {
  if(doc.exists) {
    const data = doc.data();
    const newContent1 = data.name;
    const newContent2 = data.age;

    let modifiedData = originalData.replace('<<dataPoint1>>', newContent1);
    modifiedData = modifiedData.replace('<<dataPoint2>>', newContent2);

    fs.writeFile(texFilePath, modifiedData, 'utf8', (err) => {
      if(err) {
        console.error('Error writing modified LaTeX file:', err);
        return;
      }
      
      console.log('Content replaced successfully.');

      const options = { inputs: ['.', 'TeXworks'] };
      const pdf = latex(modifiedData, options);

      pdf.pipe(fs.createWriteStream('output.pdf'));
      pdf.on('finish',() => {
        console.log('PDF generated successfully.');
        resetTexFile();
      });
    });
  } else {
    console.log('Document does not exist');
  }
})
.catch((error) => {
  console.error('Error getting document', error);
});
});

// Function to reset the TeX file to its original content
function resetTexFile() {
  fs.readFile(backupTexFilePath, 'utf8', (err, originalData) => {
    if (err) {
      console.error('Error reading the backup TeX file:', err);
      return;
    }

    // Write the original backup content back to the TeX file
    fs.writeFile(texFilePath, originalData, 'utf8', (err) => {
      if (err) {
        console.error('Error resetting the TeX file:', err);
        return;
      }
      console.log('TeX file reset to its original content.');
    });
  });
}

// Call resetTexFile() to reset the TeX file to its original content