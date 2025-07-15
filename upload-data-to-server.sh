#!/bin/bash

# 远程服务器用户名
USERNAME="ec2-user"
# 远程服务器地址或IP
REMOTE_SERVER="18.171.230.55"
#
CERT=/Users/nickma/Develop/darkhorseone/keys/aws/darkhorseone-mbp.pem

REMOTE_PATH=/data/docker-composes/ico-mcp/data
LOCAL_PATH=data

echo Start upload to server [${REMOTE_SERVER}]...
# 传输文件
scp -i "$CERT" $LOCAL_PATH/* ${USERNAME}@${REMOTE_SERVER}:$REMOTE_PATH
echo Upload to remote dir \[DONE\]

echo All done!
