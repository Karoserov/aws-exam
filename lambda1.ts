import {S3Event} from 'aws-lambda';
import {DynamoDB, S3} from 'aws-sdk';
import {v4 as uuidv4} from 'uuid';

const dynamodb = new DynamoDB.DocumentClient();
const s3 = new S3();

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.png'];

export const handler = async (event: S3Event): Promise<void> => {
    console.log('Processing file upload event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key);
        const fileExtension = key.substring(key.lastIndexOf('.')).toLowerCase();

        try {
            // Get file metadata from S3
            const s3Object = await s3.headObject({
                Bucket: bucket,
                Key: key
            }).promise();

            if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
                console.error(`Invalid file extension: ${fileExtension}`);
                // Move file to error folder
                await s3.copyObject({
                    Bucket: bucket,
                    CopySource: `${bucket}/${key}`,
                    Key: `errors/${key}`
                }).promise();

                await s3.deleteObject({
                    Bucket: bucket,
                    Key: key
                }).promise();

                continue;
            }

            // Store metadata in DynamoDB
            const timestamp = new Date().toISOString();
            const item = {
                id: uuidv4(),
                uploadDate: timestamp,
                fileExtension,
                fileSize: s3Object.ContentLength,
                fileName: key
            };

            await dynamodb.put({
                TableName: process.env.TABLE_NAME!,
                Item: item
            }).promise();

            console.log('Successfully processed file:', key);
        } catch (error) {
            console.error('Error processing file:', key, error);
            throw error;
        }
    }
};