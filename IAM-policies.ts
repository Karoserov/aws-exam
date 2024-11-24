import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

export class IAMPoliciesStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // EC2 Role
        const ec2Role = new iam.Role(this, 'WebServerRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'Role for EC2 web server'
        });

        ec2Role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:PutObject',
                's3:GetObject'
            ],
            resources: [`arn:aws:s3:::${process.env.BUCKET_NAME}/uploads/*`]
        }));

        // Processing Lambda Role
        const processingLambdaRole = new iam.Role(this, 'ProcessingLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Role for file processing Lambda'
        });

        processingLambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                'dynamodb:PutItem',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
            ],
            resources: [
                `arn:aws:s3:::${process.env.BUCKET_NAME}/*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${process.env.TABLE_NAME}`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
            ]
        }));

        // Notification Lambda Role
        const notificationLambdaRole = new iam.Role(this, 'NotificationLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Role for notification Lambda'
        });

        notificationLambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sns:Publish',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:DescribeStream',
                'dynamodb:ListStreams',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
            ],
            resources: [
                `arn:aws:sns:${this.region}:${this.account}:${process.env.TOPIC_NAME}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${process.env.TABLE_NAME}/stream/*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
            ]
        }));

        // DynamoDB Role
        const dynamoDbRole = new iam.Role(this, 'DynamoDBRole', {
            assumedBy: new iam.ServicePrincipal('dynamodb.amazonaws.com'),
            description: 'Role for DynamoDB'
        });

        dynamoDbRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:DescribeStream',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:ListStreams'
            ],
            resources: [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${process.env.TABLE_NAME}/stream/*`
            ]
        }));
    }
}