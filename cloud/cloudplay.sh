#!/usr/bin/env bash
# Start / stop the cloud game machine ON DEMAND (you pay only while it is on). Needs the AWS CLI logged in on YOUR computer (no keys are stored here).
#   CLOUDPLAY_INSTANCE_ID=i-0123abcd AWS_REGION=ap-south-1 bash cloud/cloudplay.sh start|stop|status
set -euo pipefail
: "${CLOUDPLAY_INSTANCE_ID:?set CLOUDPLAY_INSTANCE_ID (the GPU machine you created)}"
R="${AWS_REGION:-us-east-1}"; I="$CLOUDPLAY_INSTANCE_ID"
case "${1:-status}" in
  start)  aws ec2 start-instances --region "$R" --instance-ids "$I" >/dev/null; aws ec2 wait instance-running --region "$R" --instance-ids "$I"
          echo "ON. Address: $(aws ec2 describe-instances --region "$R" --instance-ids "$I" --query 'Reservations[0].Instances[0].PublicDnsName' --output text)  (the game server prints the full link with its token on the machine)";;
  stop)   aws ec2 stop-instances --region "$R" --instance-ids "$I" >/dev/null; echo "stopping - billing for compute stops when it is stopped (disk still costs a little)";;
  status) aws ec2 describe-instances --region "$R" --instance-ids "$I" --query 'Reservations[0].Instances[0].State.Name' --output text;;
  *) echo "usage: start|stop|status"; exit 2;;
esac
