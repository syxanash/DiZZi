# DiZZi 0.2 [![blog](https://raw.githubusercontent.com/syxanash/awesome-web-desktops/refs/heads/main/assets/notebook.png)](https://blog.simone.computer/reverse-beyblade-spin-counter)

LET IT RIP!

## Setup and Installation

Follow these steps to get DiZZi set up and ready to run.

### 1. Clone the repository

```sh
git clone https://github.com/syxanash/dizzi.git
cd dizzi
```

### 2. Install Node dependencies

```sh
nvm use
npm i
```

### 3. Set up Ollama

After [installing Ollama](https://ollama.com/download/linux), pull the necessary language models:

```sh
ollama pull gemma3:1b
```

## Configure

Before starting the app, you need to configure the following variables in your `.env` file:

```
AI_ENABLED=true
BACKEND_PORT=4568
```

You can decide if you'd like to enable the AI features: Kokoro text to speech or Gemma 3 commenting on your launches.

## Usage

To start the DiZZi, run the following command from the root of the project directory:

```sh
npm run prod-start
```

You should now be able to see the app running on localhost.
For development instead run:

```sh
npm run dev-start
```

## Architecture

![architecture](external-assets/beyblade-arch.png)

## Demo



## External resources

* Text to speech model used: [Kokoro.js](https://huggingface.co/posts/Xenova/503648859052804)
* [Gemma 3:1b](https://ollama.com/library/gemma3) pulled from Ollama.
