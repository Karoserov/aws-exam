import express from 'express';
import multer from 'multer';
import { S3 } from 'aws-sdk';
import path from 'path';

const app = express();
const s3 = new S3();
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.pdf', '.jpg', '.png'].includes(ext)) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>File Upload</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .upload-container { border: 2px dashed #ccc; padding: 20px; text-align: center; }
          .error { color: red; margin-top: 10px; }
          .success { color: green; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="upload-container">
          <h2>Upload File</h2>
          <p>Allowed extensions: .pdf, .jpg, .png</p>
          <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" accept=".pdf,.jpg,.png" required>
            <button type="submit">Upload</button>
          </form>
          <div id="status"></div>
        </div>
      </body>
    </html>
  `);
});

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Invalid file type' });
    }

    try {
        const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: `uploads/${Date.now()}-${req.file.originalname}`,
            Body: req.file.buffer
    };

        await s3.upload(params).promise();
        res.json({ message: 'File uploaded successfully' });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

const port = process.env.PORT || 80;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});