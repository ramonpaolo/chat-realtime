# Chat Realtime — salas efêmeras

Chat em tempo real, sem cadastro e sem banco de dados. Cada sala vive em memória e desaparece quando fica vazia.

[![Deploy na Zenifra](https://docs.zenifra.com/badge/deploy-pt.svg)](https://console.zenifra.com/deploy?repository=https://github.com/ramonpaolo/chat-realtime&port=3000&name=chat-realtime&branch=main&runtime=nodejs&version=22&start=yarn%20start&build=yarn%20build)
[![Hospedado na Zenifra](https://img.shields.io/badge/hospedado%20na-Zenifra-13f4b0?style=flat-square)](https://chat-realtime.clients.zenifra.com)

**Deploy / Implantar:** o badge abre o Console da Zenifra com este repositório, a porta `3000`, Node 22, `yarn build` e `yarn start` já preenchidos. O app está hospedado em [chat-realtime.clients.zenifra.com](https://chat-realtime.clients.zenifra.com). Veja a [documentação do botão](https://docs.zenifra.com/pt/docs/deploy/deploy-button).

O repositório é público, então o deploy não exige conectar sua conta GitHub; o projeto criado usa deploy manual até você conectar o repositório para auto-deploy.

![Chat Realtime — landing](docs/landing-v2.png)

## Novidades na v2

- **Salas isoladas de verdade:** cada conversa usa uma room do Socket.io; ninguém recebe mensagens de outra sala.
- **Presença e digitação:** lista de pessoas online, nomes únicos, indicador de “está digitando” e mensagens de entrada/saída.
- **Histórico em memória:** as últimas 100 mensagens de texto ficam na memória do servidor. Arquivos são transmitidos apenas para quem está online e não são persistidos.
- **Interface responsiva:** landing, chat em tela cheia, sidebar móvel, tema escuro e foco em acessibilidade.
- **Segurança:** CSP, headers de segurança, validação de nomes/mensagens/arquivos, limite de 4 MB por arquivo, até 3 anexos, limite de 30 pessoas por sala e rate-limit por socket/IP.
- **Ciclo de vida:** salas vazias expiram após 1 hora; o servidor tem limite de salas e faz limpeza periódica.
- **Operação:** healthcheck em `/healthz`, encerramento gracioso, Docker com Node 22 e deploy de um clique na Zenifra.

![Sala de chat](docs/chat-v2.png)

## Stack e segurança

- TypeScript, Node.js 22+, Express 5, EJS e Socket.io.
- Sem banco de dados: o estado é efêmero e local ao processo.
- `maxHttpBufferSize` reduzido, uploads validados por MIME/tamanho e nomes de arquivo higienizados.
- Rate-limit de mensagens (15/10 s), arquivos (4/30 s) e criação de salas (10/10 min por IP).
- CSP com `script-src 'self'`, `frame-ancestors 'none'` e `object-src 'none'`.
- Testes unitários de validação e do armazenamento de salas com `yarn test`.

## Languages Translates
- [Portuguese](#portuguese)
- [English](#english)

<div id="english" />

# English

##### Ops: this translate was made by me(Ramon Paolo Maran). Sorry for any problem in translate : )

## Index
- [About the Project](#abouttheproject-english)
- [How it's works?](#howwork-english)
- [Technologies Useds](#technologiesuseds-english)
- [How execute this project?](#howexecute-english)
- [Tips](#tips-english)

---

<div id="abouttheproject-english"/>

# 📑 About the Project

The project consist in are the chat in realtime, in that those people can use with security, because the datas not is saved in databases or cache.

---

<div id="howwork-english"/>

# How it's works?

I'm using EJS to do the frontend, in the side of server(NodeJs), that are get the datas of Socket.io and making a broadcas for all machines that listening one determined room.

The network use cryptograph peer-to-peer with HTTPS

---
<div id="technologiesuseds-english"/>

# 🚀 Technologies Useds
- TypeScript
- NodeJs
- Express
- EJS
- Socket.io

---
<div id="howexecute-english"/>

# 📁 How Execute this Project?
Requirements: Node.js 22 and Yarn

```bash
# clone the repositore
$ git clone https://github.com/ramonpaolo/chat-realtime

# enter inside the folder of project
$ cd chat-realtime/

# install the dependencies:
$ yarn

# build the application:
$ yarn build

# init the project:
$ yarn start
```

---
<div id="tips-english"/>

# Tips

Warning with people in the room, using cell phone, because, some files can break the navigator in cell phone.

---
</br>

<div id="portuguese" />

# Portuguese

---

## Índice
- [Sobre o Projeto](#abouttheproject-portuguese)
- [Como Funciona?](#howwork-portuguese)
- [Tecnologias Usadas](#technologiesuseds-portuguese)
- [Como executar o Projeto?](#howexecute-portuguese)
- [Dicas](#tips-portuguese)

---

<div id="abouttheproject-portuguese"/>

# 📑 Sobre o Projeto

O projeto consiste em um chat em tempo real, no qual as pessoas podem usar com segurança, pois os dados não são gravados

---

<div id="howwork-portuguese"/>

# Como Funciona ?

Eu estou usando o EJS para fazer o HTML do frontend, no lado do servidor(NodeJs), que está pegando como parâmentos os dados do Socket.io e fazendo um broadcast para todas as máquinas que estão ouvindo uma determinada sala.

A rede usa criptografia de ponta a ponta com HTTPS

---
<div id="technologiesuseds-portuguese"/>

# 🚀 Tecnologias Utilizadas
- TypeScript
- NodeJs
- Express
- EJS
- Socket.io

---
<div id="howexecute-portuguese"/>

# 📁 Como executar o projeto?
Pré-requisitos: Node.js 22 e Yarn

```bash
# clonar repositório
$ git clone https://github.com/ramonpaolo/chat-realtime

# entrar na pasta do projeto
$ cd chat-realtime/

# instalar as depêndencias:
$ yarn install

# buildar a aplicação:
$ yarn build

# iniciar o projeto:
$ yarn start
```

---
<div id="tips-portuguese"/>

# Dicas

Cuidado ao mandar arquivos pesados na sala, e uma pessoa estiver usando o dispositovo móvel. Ele pode travar devido ao tamanho do arquivo no navegador.

![GitHub top language](https://img.shields.io/github/languages/top/ramonpaolo/chat-realtime)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/ramonpaolo/chat-realtime)
![GitHub](https://img.shields.io/github/license/ramonpaolo/chat-realtime)

<br/>

# Make by Ramon Paolo Maran &#10084;