import {describe, expect, test, jest} from '@jest/globals';
import {S3Event} from 'aws-lambda';
import {handler as processingHandler} from '../aws-lambda/processing';
import {handler as notificationHandler} from '../aws-lambda/notification';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
    S3: jest.fn(() => ({
        headObject: jest.fn().mockReturnValue({
            promise: () => Promise.resolve({ContentLength: 1024})
        }),
        copyObject: jest.fn().mockReturnValue({
            promise: () => Promise.resolve({})
        }),
        deleteObject: jest.fn().mockReturnValue({
            promise: () => Promise.resolve({})
        })
    })),
    DynamoDB: {
        DocumentClient: jest.fn(() => ({
            put: jest.fn().mockReturnValue({
                promise: () => Promise.resolve({})
            })
        }))
    },
    SNS: jest.fn(() => ({
        publish: jest.fn().mockReturnValue({
            promise: () => Promise.resolve({})
        })
    }))
}));

describe('File Processing Lambda', () => {
    test('processes valid file upload correctly', async () => {
        const event: S3Event = {
            Records: [{
                s3: {
                    bucket: {name: 'test-bucket'},
                    object: {key: 'test-file.pdf'}
                }
            }]
        } as any;

        await expect(processingHandler(event)).resolves.not.toThrow();
    });

    test('handles invalid file extension', async () => {
        const event: S3Event = {
            Records: [{
                s3: {
                    bucket: {name: 'test-bucket'},
                    object: {key: 'test-file.txt'}
                }
            }]
        } as any;

        await expect(processingHandler(event)).resolves.not.toThrow();
    });
});

describe('Notification Lambda', () => {
    test('sends notification for new file upload', async () => {
        const event = {
            Records: [{
                eventName: 'INSERT',
                dynamodb: {
                    NewImage: {
                        fileExtension: {S: '.pdf'},
                        fileSize: {N: '1024'},
                        uploadDate: {S: '2024-11-24T12:00:00Z'},
                        fileName: {S: 'test-file.pdf'}
                    }
                }
            }]
        };

        await expect(notificationHandler(event)).resolves.not.toThrow();
    });
});