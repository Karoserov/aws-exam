import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class EventTriggersStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Reference existing resources
        const bucket = s3.Bucket.fromBucketName(this, 'ExistingBucket', process.env.BUCKET_NAME!);
        const table = dynamodb.Table.fromTableName(this, 'ExistingTable', process.env.TABLE_NAME!);
        const processingLambda = lambda.Function.fromFunctionName(
            this,
            'ProcessingLambda',
            process.env.PROCESSING_LAMBDA_NAME!
        );
        const notificationLambda = lambda.Function.fromFunctionName(
            this,
            'NotificationLambda',
            process.env.NOTIFICATION_LAMBDA_NAME!
        );

        // Configure S3 event trigger
        bucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(processingLambda),
            { prefix: 'uploads/' }
        );

        // Configure DynamoDB Streams
        const streamSource = new DynamoEventSource(table, {
            startingPosition: lambda.StartingPosition.LATEST,
            batchSize: 1,
            retryAttempts: 3
        });

        notificationLambda.addEventSource(streamSource);

        // Enable CloudWatch logging
        new logs.LogGroup(this, 'ProcessingLambdaLogs', {
            logGroupName: `/aws/lambda/${processingLambda.functionName}`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        new logs.LogGroup(this, 'NotificationLambdaLogs', {
            logGroupName: `/aws/lambda/${notificationLambda.functionName}`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
    }
}