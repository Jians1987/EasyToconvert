import { PDFDocument } from 'pdf-lib-plus-encrypt';
import fs from 'fs';

async function main() {
    try {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        page.drawText('This is a test');

        // Can we encrypt?
        doc.encrypt({
            userPassword: 'password123',
            ownerPassword: 'password123',
            permissions: {
                modifying: false,
                printing: false,
                copying: false,
            }
        });

        const bytes = await doc.save();
        fs.writeFileSync('test.pdf', bytes);
        console.log("Success");
    } catch(e) {
        console.error(e);
    }
}
main();
