#! /bin/bash

ssh aws << EOF
  cd shazaam-web-app/
  git pull
EOF