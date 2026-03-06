#!/bin/bash

# Update and install git if missing
apt-get update && apt-get install -y git curl

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Create database file if missing to prevent Docker from creating a directory
if [ ! -f sql_app.db ]; then
    touch sql_app.db
fi

# Build and run the container
echo "Starting Stitch Messenger..."
docker compose up -d --build

echo "Done! App is running on port 8000"
echo "You can access it at http://$(curl -s ifconfig.me):8000"
