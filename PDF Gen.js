const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccKey.json");
const fs = require ('fs');
const latex = require('node-latex');
const handlebars = require('handlebars');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const collectionRef = db.collection('InvoiceTest');
const documentRef = collectionRef.doc('one');

const texFilePath = 'template.tex';
const backupTexFilePath = 'backup.tex';

const templateSource = fs.readFileSync(texFilePath, 'utf8');
const template = handlebars.compile(templateSource);

fs.readFile(texFilePath, 'utf8', async (err, originalData) => {
  if (err) {
    console.error('Error reading Latex file:', err);
    return;
  }

  fs.writeFile(backupTexFilePath, originalData, 'utf8', async (err) => {
    if(err) {
      console.error('Error creating a backup of the TeX file:', err);
      return;
    }
    console.log('Backup of the TeX file created:', backupTexFilePath);

    try {
      const doc = await documentRef.get();

      if(doc.exists) {
        const data = doc.data();
        //console.log('Received data:', data);
        const latexDocument = template(data);

        fs.writeFile(texFilePath, latexDocument, 'utf8', async (err) => {
          if (err) {
            console.error('Error writing modified LaTeX file:', err);
            return;
          }

          console.log('Content replaced successfully.');

          const options = { inputs: ['.', 'TeXworks'] };
          const pdf = latex(latexDocument, options);

          pdf.pipe(fs.createWriteStream('OrderSample1.pdf'));
          pdf.on('finish', () => {
            console.log('PDF generation successfully.');
          })
          resetTexFile();
        });
      } else {
        console.log('Document does not exist');
      }
    } catch(error) {
      console.error('Error getting document', error);
    }
  });
});

function resetTexFile() {
  fs.readFile(backupTexFilePath, 'utf8', async (err, originalData) => {
    if (err) {
      console.error('Error reading the backup TeX file:', err);
      return;
    }

    fs.writeFile(texFilePath, originalData, 'utf8', async (err) => {
      if(err) {
        console.error('Error resetting the TeX file:', err);
        return;
      }
      console.log('TeX file reset to its original content.');
    });
  });
}
