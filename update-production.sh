#! /bin/bash

ssh aws << EOF
  rm -rf shazam-webapp/
  mkdir shazam-webapp
EOF

scp -i ~/.ssh/keys/aws-marcuschiu.pem -r ./web ec2-user@www.marcuschiu.com:~/shazam-webapp
