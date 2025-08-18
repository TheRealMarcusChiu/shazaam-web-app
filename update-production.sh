#! /bin/bash

ssh aws << EOF
  cd shazam-web-app/
  git pull
EOF