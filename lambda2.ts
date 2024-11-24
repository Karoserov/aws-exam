import {DynamoDBStreamEvent} from 'aws-lambda';
import {SNS} from 'aws-sdk';

const sns = new SNS();

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
    console.log('Processing DynamoDB Stream event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        if (record.eventName !== 'INSERT') continue;

        const newImage = record.dynamodb!.NewImage!;
        const fileData = {
            fileExtension: newImage.fileExtension.S,
            fileSize: newImage.fileSize.N,
            uploadDate: newImage.uploadDate.S
        };

        try {
            const message = `
        New file uploaded:
        Extension: ${fileData.fileExtension}
        Size: ${fileData.fileSize} bytes
        Upload Date: ${fileData.uploadDate}
      `;

            await sns.publish({
                TopicArn: process.env.TOPIC_ARN!,
                Subject: 'New File Upload Notification',
                Message: message
            }).promise();

            console.log('Successfully sent notification for file:', newImage.fileName.S);
        } catch (error) {
            console.error('Error sending notification:', error);
            throw error;
        }
    }
};