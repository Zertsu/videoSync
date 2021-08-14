# Description

Web application to play videos on multiple devices/screens synchronously, with the ability to crop the video on per device basis to create one bigger display from multiple clients

# Installation

*You'll need Python 3 and git installed*

**Clone this repository and open it**
    
    git clone https://github.com/Redstonik/videoSync.git
    cd videoSync

**Create a virtual enviroment and download the required dependencies**
    
Linux (bash/zsh):

    python -m venv .env
    .env/bin/python -m pip install -r requirements.txt

Windows (cmd):

    python -m venv .env
    .env\Scripts\python.exe -m pip install -r requirements.txt

**Start the server**
    
Linux (bash/zsh):

    .env/bin/python main.py

Windows (cmd):

    .env\Scripts\python.exe main.py
