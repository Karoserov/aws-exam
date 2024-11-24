import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export class MonitoringStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create SNS topic for alerts
        const alertTopic = new sns.Topic(this, 'MonitoringAlertTopic');
        new sns.Subscription(this, 'AlertEmailSubscription', {
            topic: alertTopic,
            protocol: sns.SubscriptionProtocol.EMAIL,
            endpoint: 'example@yahoo.com'
        });

        // Create dashboard
        const dashboard = new cloudwatch.Dashboard(this, 'ServiceDashboard', {
            dashboardName: 'FileProcessingDashboard'
        });

        // Metrics
        const fileUploadsMetric = new cloudwatch.Metric({
            namespace: 'FileProcessingService',
            metricName: 'FileUploads',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1)
        });

        const processingErrorsMetric = new cloudwatch.Metric({
            namespace: 'FileProcessingService',
            metricName: 'ProcessingErrors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1)
        });

        const invalidFileMetric = new cloudwatch.Metric({
            namespace: 'FileProcessingService',
            metricName: 'InvalidFiles',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1)
        });

        // Add widgets to dashboard
        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'File Uploads',
                left: [fileUploadsMetric]
            }),
            new cloudwatch.GraphWidget({
                title: 'Processing Errors',
                left: [processingErrorsMetric]
            }),
            new cloudwatch.GraphWidget({
                title: 'Invalid Files',
                left: [invalidFileMetric]
            })
        );

        // Create alarms
        const errorAlarm = new cloudwatch.Alarm(this, 'ProcessingErrorAlarm', {
            metric: processingErrorsMetric,
            threshold: 10,
            evaluationPeriods: 2,
            alarmDescription: 'Too many processing errors',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });

        errorAlarm.addAlarmAction(
            new cw_actions.SnsAction(alertTopic)
        );

        // Add custom metrics logging helper
        const metricsHelper = new lambda.Function(this, 'MetricsHelper', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const cloudwatch = new AWS.CloudWatch();
        
        exports.handler = async (event) => {
          const { metricName, value = 1 } = event;
          
          await cloudwatch.putMetricData({
            Namespace: 'FileProcessingService',
            MetricData: [{
              MetricName: metricName,
              Value: value,
              Unit: 'Count',
              Timestamp: new Date()
            }]
          }).promise();
        };
      `),
            description: 'Helper function for logging custom metrics'
        });

        metricsHelper.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*']
        }));
    }
}